"""API ownership checks supplement RLS; never use service_role here."""
from fastapi import HTTPException

OWNERS = {"profiles": "id", "businesses": "owner_id", "routes": "user_id", "reviews": "user_id",
          "saved_routes": "user_id", "user_interests": "user_id", "place_visits": "user_id",
          "offline_downloads": "user_id", "tickets": "user_id", "ticket_messages": "sender_id"}
PARENTS = {"places": ("business_id", "businesses"), "promotions": ("business_id", "businesses"),
           "experiences": ("business_id", "businesses"), "campaigns": ("business_id", "businesses"),
           "business_verifications": ("business_id", "businesses"), "review_replies": ("business_id", "businesses"),
           "place_categories": ("place_id", "places"), "opening_hours": ("place_id", "places"),
           "place_media": ("place_id", "places"), "route_stops": ("route_id", "routes"),
           "review_media": ("review_id", "reviews")}
IMMUTABLE = {"user_access", "subscriptions", "reservations", "coupon_redemptions", "audit_logs", "moderation_actions", "campaign_events"}
ADMIN_WRITABLE = {"user_access", "subscriptions", "business_verifications", "moderation_actions", "notifications"}
PRIVATE_WRITABLE = {"saved_routes", "user_interests", "place_visits", "offline_downloads", "tickets", "ticket_messages", "business_verifications"}
PROTECTED = {"reviews": {"hidden"}, "tickets": {"assigned_to", "status"},
             "business_verifications": {"reviewer_id", "review_notes", "reviewed_at", "status"}}


def identity(db, authorization):
    from app.db.client import extract_bearer_token
    token = extract_bearer_token(authorization)
    try:
        user = db.auth.get_user(token).user if token else None
    except Exception:
        user = None
    if user is None:
        raise HTTPException(status_code=401, detail="Se requiere una sesión válida.")
    return str(user.id)


def is_admin(db, user_id):
    rows = db.table("user_access").select("role").eq("user_id", user_id).eq("status", "active").execute().data or []
    return any(row["role"] == "admin" for row in rows)


def is_staff(db, user_id):
    rows = db.table("user_access").select("role").eq("user_id", user_id).eq("status", "active").execute().data or []
    return any(row["role"] in {"admin", "support"} for row in rows)


def owned_query(query, table, db, user_id):
    if is_admin(db, user_id) or (table == "tickets" and is_staff(db, user_id)):
        return query
    if table in OWNERS:
        return query.eq(OWNERS[table], user_id)
    if table in PARENTS:
        column, parent = PARENTS[table]
        parents = owned_query(db.table(parent).select("id"), parent, db, user_id).execute().data or []
        return query.in_(column, [row["id"] for row in parents]) if parents else query.is_("id", "null")
    if is_admin(db, user_id):
        return query
    raise HTTPException(status_code=403, detail="Este recurso requiere permisos de administración.")


def prepare_write(table, payload, db, user_id, *, creating=False):
    admin = is_admin(db, user_id)
    if table in IMMUTABLE and not (admin and table in ADMIN_WRITABLE):
        raise HTTPException(status_code=403, detail="Usa la operación específica de este recurso.")
    staff_ticket = table == "tickets" and is_staff(db, user_id)
    if set(payload) & PROTECTED.get(table, set()) and not (admin or staff_ticket):
        raise HTTPException(status_code=403, detail="El cuerpo incluye campos de moderación o aprobación.")
    if table == "user_access" and set(payload) - {"role", "status"}:
        raise HTTPException(status_code=403, detail="Solo se pueden modificar rol y estado de cuentas existentes.")
    if table == "user_access" and creating:
        raise HTTPException(status_code=403, detail="Las cuentas se crean mediante el registro.")
    if table == "tickets" and not creating and not staff_ticket:
        raise HTTPException(status_code=403, detail="Solo soporte puede actualizar un caso.")
    if admin:
        return dict(payload)
    clean = dict(payload)
    owner = OWNERS.get(table)
    if owner and owner != "id":
        if owner in clean and str(clean[owner]) != user_id:
            raise HTTPException(status_code=403, detail="No puedes asignar datos a otra cuenta.")
        if creating:
            clean[owner] = user_id
    relation = ("ticket_id", "tickets") if table == "ticket_messages" else PARENTS.get(table)
    if relation:
        column, parent = relation
        if creating and not clean.get(column):
            raise HTTPException(status_code=422, detail=f"Falta {column}.")
        if column in clean:
            query = db.table(parent).select("id")
            if not (table == "ticket_messages" and is_staff(db, user_id)):
                query = owned_query(query, parent, db, user_id)
            rows = query.eq("id", clean[column]).execute().data
            if not rows:
                raise HTTPException(status_code=403, detail="El registro relacionado no pertenece a tu cuenta.")
    if not owner and not relation and table != "notifications" and not is_admin(db, user_id):
        raise HTTPException(status_code=403, detail="Se requieren permisos de administración.")
    return clean
