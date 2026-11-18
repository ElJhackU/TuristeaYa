import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Response, status
from supabase import Client

from app.db.client import extract_bearer_token, get_authenticated_supabase, get_required_authenticated_supabase
from app.core.schema_map import TABLE_COLUMNS, FOREIGN_KEY_COLUMNS, READONLY_COLUMNS
from app.core.access import PRIVATE_WRITABLE, ADMIN_WRITABLE, identity, owned_query, prepare_write, is_admin, is_staff

logger = logging.getLogger(__name__)
router = APIRouter()
PRIVATE_ACCOUNT_TABLES = {
    "profiles",
    "businesses", "campaign_events",
    "notifications", "user_access", "subscriptions", "reservations",
    "coupon_redemptions", "saved_routes", "offline_downloads", "user_interests",
    "place_visits", "tickets", "ticket_messages", "business_verifications",
    "moderation_actions", "audit_logs",
}

# Lista permitida estricta: nunca se usa directamente una tabla indicada por el
# usuario sin traducirla mediante este mapa.
TABLE_MAP: dict[str, str] = {
    "profiles": "profiles",
    "user-access": "user_access",
    "categories": "categories",
    "zones": "zones",
    "user-interests": "user_interests",
    "businesses": "businesses",
    "places": "places",
    "place-categories": "place_categories",
    "opening-hours": "opening_hours",
    "place-media": "place_media",
    "routes": "routes",
    "route-stops": "route_stops",
    "saved-routes": "saved_routes",
    "reviews": "reviews",
    "review-media": "review_media",
    "review-replies": "review_replies",
    "subscription-plans": "subscription_plans",
    "subscriptions": "subscriptions",
    "offline-downloads": "offline_downloads",
    "promotions": "promotions",
    "coupon-redemptions": "coupon_redemptions",
    "experiences": "experiences",
    "reservations": "reservations",
    "campaigns": "campaigns",
    "campaign-events": "campaign_events",
    "place-visits": "place_visits",
    "business-verifications": "business_verifications",
    "tickets": "tickets",
    "ticket-messages": "ticket_messages",
    "notifications": "notifications",
    "moderation-actions": "moderation_actions",
    "audit-logs": "audit_logs",
}

# Solo se permite filtrar por columnas que existen en cada entidad. Los permisos
# de lectura y escritura los continúa determinando RLS en PostgreSQL.
FILTERABLE_COLUMNS: dict[str, set[str]] = {
    "place_id": {
        "place_categories",
        "opening_hours",
        "place_media",
        "route_stops",
        "reviews",
        "promotions",
        "experiences",
        "place_visits",
        "tickets",
    },
    "route_id": {"route_stops", "saved_routes", "offline_downloads", "tickets"},
    "business_id": {
        "places",
        "review_replies",
        "promotions",
        "experiences",
        "campaigns",
        "business_verifications",
    },
    "category_id": {"user_interests", "place_categories", "routes", "campaigns"},
}


def _get_table(entity: str) -> str:
    table = TABLE_MAP.get(entity)
    if table is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entidad no encontrada.")
    return table


def _account_query(query: Any, table: str, db: Client, authorization: str | None) -> Any:
    if table not in PRIVATE_ACCOUNT_TABLES:
        return query
    token = extract_bearer_token(authorization)
    try:
        user = db.auth.get_user(token).user if token else None
    except Exception:
        user = None
    if user is None:
        raise HTTPException(status_code=401, detail="Se requiere una sesión válida.")
    user_id = str(user.id)
    if is_admin(db, user_id):
        return query
    if table == "campaign_events":
        raise HTTPException(status_code=403, detail="Se requiere una cuenta administradora.")
    if table == "businesses":
        return query.eq("owner_id", user_id)
    if table == "profiles":
        return query.eq("id", user_id)
    if table in {"tickets", "ticket_messages", "business_verifications", "moderation_actions", "audit_logs"}:
        access = db.table("user_access").select("role").eq("user_id", user_id).eq("status", "active").execute()
        roles = {row["role"] for row in access.data or []}
        if "admin" in roles or (table in {"tickets", "ticket_messages"} and "support" in roles):
            return query
        if table in {"moderation_actions", "audit_logs"}:
            raise HTTPException(status_code=403, detail="Se requiere una cuenta administradora.")
        if table == "ticket_messages":
            owner_records = db.table("tickets").select("id").eq("user_id", user_id).execute().data or []
            return query.in_("ticket_id", [row["id"] for row in owner_records]) if owner_records else query.is_("id", "null")
        if table == "business_verifications":
            owner_records = db.table("businesses").select("id").eq("owner_id", user_id).execute().data or []
            return query.in_("business_id", [row["id"] for row in owner_records]) if owner_records else query.is_("id", "null")
    return query.eq("user_id", user_id)


def _raise_database_error(exc: Exception) -> None:
    code = str(getattr(exc, "code", "") or "")
    if code == "42501":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Operación no autorizada por las políticas de acceso.") from exc
    if code == "23505":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El registro entra en conflicto con uno existente.") from exc
    if code in {"23503", "23514", "23502", "22P02", "22023", "42703", "PGRST204"}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Los datos no cumplen las restricciones de la base de datos.") from exc
    if code == "PGRST116":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro no encontrado.") from exc
    if code in {"PGRST301", "PGRST303"}:
        raise HTTPException(status_code=401, detail="La sesión expiró. Inicia sesión nuevamente.") from exc

    logger.warning("Error de Supabase al operar CRUD (%s)", code or type(exc).__name__)
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="No se pudo completar la operación en la base de datos.",
    ) from exc


def _apply_filters(query: Any, table: str, filters: dict[str, UUID | None]) -> Any:
    for column, value in filters.items():
        if value is None:
            continue
        if column not in FOREIGN_KEY_COLUMNS.get(table, ()):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"El filtro '{column}' no está disponible para esta entidad.",
            )
        query = query.eq(column, str(value))
    return query


def _validate_payload(table: str, payload: dict[str, Any]) -> None:
    if not payload:
        raise HTTPException(status_code=422, detail="El cuerpo no puede estar vacío.")
    unknown = set(payload) - set(TABLE_COLUMNS[table])
    if unknown:
        raise HTTPException(status_code=422, detail=f"Campos desconocidos: {', '.join(sorted(unknown))}.")
    if set(payload) & READONLY_COLUMNS:
        raise HTTPException(status_code=422, detail="id y created_at son gestionados por el servidor.")


@router.get("/{entity}", summary="Listar registros de una entidad")
def list_records(
    entity: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    place_id: UUID | None = Query(default=None),
    route_id: UUID | None = Query(default=None),
    business_id: UUID | None = Query(default=None),
    category_id: UUID | None = Query(default=None),
    user_id: UUID | None = Query(default=None),
    owner_id: UUID | None = Query(default=None),
    ticket_id: UUID | None = Query(default=None),
    review_id: UUID | None = Query(default=None),
    zone_id: UUID | None = Query(default=None),
    db: Client = Depends(get_authenticated_supabase),
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    table = _get_table(entity)
    try:
        query = _account_query(db.table(table).select("*"), table, db, authorization)
        query = _apply_filters(
            query,
            table,
            {
                "place_id": place_id,
                "route_id": route_id,
                "business_id": business_id,
                "category_id": category_id,
                "user_id": user_id,
                "owner_id": owner_id,
                "ticket_id": ticket_id,
                "review_id": review_id,
                "zone_id": zone_id,
            },
        )
        result = query.order("id").range(offset, offset + limit - 1).execute()
        return result.data or []
    except HTTPException:
        raise
    except Exception as exc:
        _raise_database_error(exc)


@router.post(
    "/{entity}",
    status_code=status.HTTP_201_CREATED,
    summary="Crear un registro",
)
def create_record(
    entity: str,
    payload: dict[str, Any] = Body(...),
    db: Client = Depends(get_required_authenticated_supabase),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    table = _get_table(entity)
    _validate_payload(table, payload)
    if table in PRIVATE_ACCOUNT_TABLES and table not in PRIVATE_WRITABLE | {"businesses"} and not (table in ADMIN_WRITABLE and is_admin(db, identity(db, authorization))):
        raise HTTPException(status_code=403, detail="Este recurso no admite creación desde la API de usuarios.")
    if not payload:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El cuerpo de creación no puede estar vacío.")
    try:
        payload = prepare_write(table, payload, db, identity(db, authorization), creating=True)
        result = db.table(table).insert(payload).execute()
        if not result.data:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="La base de datos no devolvió el registro creado.")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        _raise_database_error(exc)


@router.get("/{entity}/{record_id}", summary="Obtener un registro por ID")
def get_record(
    entity: str,
    record_id: UUID,
    db: Client = Depends(get_authenticated_supabase),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    table = _get_table(entity)
    try:
        result = (
            _account_query(db.table(table).select("*"), table, db, authorization)
            .eq("id", str(record_id))
            .maybe_single()
            .execute()
        )
        if result is None or result.data is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro no encontrado.")
        return result.data
    except HTTPException:
        raise
    except Exception as exc:
        _raise_database_error(exc)


@router.patch("/{entity}/{record_id}", summary="Actualizar parcialmente un registro")
def update_record(
    entity: str,
    record_id: UUID,
    payload: dict[str, Any] = Body(...),
    db: Client = Depends(get_required_authenticated_supabase),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    table = _get_table(entity)
    _validate_payload(table, payload)
    if table in PRIVATE_ACCOUNT_TABLES and table not in PRIVATE_WRITABLE | {"profiles", "businesses"} and (table != "notifications" or set(payload) != {"read_at"}) and not (table in ADMIN_WRITABLE and is_admin(db, identity(db, authorization))):
        raise HTTPException(status_code=403, detail="Este recurso o campo no admite modificación desde esta API.")
    if not payload:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="El cuerpo de actualización no puede estar vacío.")
    if "id" in payload:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No se permite cambiar el ID del registro.")
    try:
        user_id = identity(db, authorization)
        if table == "user_access":
            current = db.table(table).select("user_id").eq("id", str(record_id)).maybe_single().execute()
            if current and current.data and current.data["user_id"] == user_id:
                raise HTTPException(status_code=403, detail="No puedes cambiar tus propios permisos.")
        payload = prepare_write(table, payload, db, user_id)
        query = db.table(table).update(payload)
        query = _account_query(query, table, db, authorization) if table == "notifications" else owned_query(query, table, db, user_id)
        result = (
            query
            .eq("id", str(record_id))
            .execute()
        )
        if result is None or not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro no encontrado o no visible para este usuario.")
        return result.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        _raise_database_error(exc)


@router.delete(
    "/{entity}/{record_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Eliminar un registro",
)
def delete_record(
    entity: str,
    record_id: UUID,
    db: Client = Depends(get_required_authenticated_supabase),
    authorization: str | None = Header(default=None),
) -> Response:
    table = _get_table(entity)
    if table in PRIVATE_ACCOUNT_TABLES and table not in {"saved_routes", "user_interests", "offline_downloads"}:
        raise HTTPException(status_code=403, detail="Este recurso no admite eliminación desde esta API.")
    try:
        user_id = identity(db, authorization)
        prepare_write(table, {}, db, user_id)
        result = owned_query(db.table(table).delete(), table, db, user_id).eq("id", str(record_id)).execute()
        if not result.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registro no encontrado o no visible para este usuario.")
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as exc:
        _raise_database_error(exc)

