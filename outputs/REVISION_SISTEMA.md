# Revisión de TuristeaYa — 17 de noviembre de 2026

## Resultado y alcance

Se completaron conexiones y acciones que todavía usaban ejemplos en web y Expo. Se conservan los componentes visuales compartidos, el planificador local, mapas y las siete ramas integradas. El código está guardado localmente; no se hizo push ni despliegue en Render.

Supabase ya está autorizado: proyecto `xjdiwevkbcvakmqjyzuv` de la organización TuristeaYa. Las 32 tablas tienen RLS activado. Los roles reales son `tourist`, `advertiser`, `support` y `admin`; VIP depende de una suscripción activa, no de un rol `vip`.

## Cambios implementados

- Backend: autenticación y alcance por propietario; campos y filtros validados contra el esquema; operaciones de soporte y administración habilitadas según el rol comprobado. Un administrador no puede modificar sus propios permisos mediante la API. Claves secretas o service_role no se aceptan como clave pública.
- Web: paneles de usuarios/permisos, validación comercial, moderación, auditoría, resolución de tickets, formularios de promociones y campañas, verificación comercial y respuestas a reseñas conectados a la API. Claves de reintento de reservas/canjes guardadas en sessionStorage.
- Expo: sesión restaurable, renovación y logout; refresh token en SecureStore nativo y sessionStorage web. No se guarda la contraseña. Paneles de soporte, administración y negocios; creación/edición/activación de promociones y campañas; verificación y respuestas; reportes con conversación; reseñas publicadas; notificaciones; suscripciones VIP; reservas/canjes con claves persistentes de reintento. El catálogo permite guardar rutas en la cuenta y muestra fotos con créditos para lugares conocidos.
- Los itinerarios del planificador siguen guardándose localmente. Los favoritos del catálogo en Supabase son una función distinta; no se migraron automáticamente los itinerarios locales.
- Arranque conjunto con `INICIAR_LOCAL.ps1`. Configura en tiempo de ejecución el origen de API de la web. `.env` del backend excluido de Git, con URL del proyecto y clave pública.

## Cambios aplicados en Supabase

Se aplicaron `protect_sensitive_fields` y su corrección `scope_sensitive_trigger_fields`:

- El autor puede editar su reseña, pero no cambiar moderación, propietario, lugar, ID ni fecha de creación.
- El destinatario de una notificación solo puede actualizar `read_at`.
- Una cuenta no puede modificar sus propios permisos/estado.
- Cada cambio de visibilidad de una reseña genera una acción de moderación y un registro de auditoría en la misma transacción.

El SQL final está en `backend_TuristeaYa/api/sql/protect_sensitive_fields.sql`. Es una instantánea de cambios ya aplicados, no un esquema completo ni un script para volver a ejecutar sin revisar: sus triggers ya existen. El CLI no pudo crear su directorio de configuración fuera del workspace; las migraciones remotas se aplicaron mediante el conector autorizado.

## Pruebas

- Backend: 13 pruebas con SDK PostgREST y transporte HTTP simulado, correctas. Incluyen aislamiento, campos protegidos, propiedad de negocio, soporte y administrador. Ejecutar desde `api`: `./.venv-test/Scripts/python.exe -m unittest discover -s tests -v`.
- Base real: `tests/supabase_transactions.sql` comprobó aislamiento, importe de reserva, repetición idempotente, sobrecupo y límites de canje. `tests/supabase_sensitive_fields.sql` comprobó edición legítima, rechazo de cambios sensibles y auditoría del administrador. Ambos ejecutados con rollback, sin conservar filas de prueba.
- Backend local contra Supabase: `/health` y catálogo devolvieron 200; tickets y permisos sin sesión devolvieron 401.
- Web: 9 pruebas del cliente HTTP y navegación de 59 pantallas con login/logout simulados, sin errores JavaScript.
- Expo: lint, TypeScript, pruebas del planificador y exportación web de 35 rutas. `scripts/test-browser.cjs` prueba login, restauración, envío de mensajes, resolución de casos, nueve paneles, reserva con reintento idempotente y canje con API simulada.
- El asesor de seguridad de Supabase solo notificó protección contra contraseñas filtradas desactivada. Esto no equivale a una auditoría exhaustiva del sistema.

## Cómo probar

Desde la raíz del workspace:

```powershell
./outputs/INICIAR_LOCAL.ps1 -WebPort 4174
```

Abrir `http://127.0.0.1:4174`. La web usa `http://127.0.0.1:8000` y este backend consulta Supabase. Ingresar con una cuenta existente de Supabase Auth; los perfiles de la carga SQL no necesariamente tienen contraseña o correo confirmado. No hay una contraseña universal.

Para Expo en navegador, con el backend local funcionando:

```powershell
cd outputs/TuristeaYa-Expo
$env:EXPO_PUBLIC_API_URL='http://127.0.0.1:8000'
npm run web
```

En un teléfono físico, `127.0.0.1` apunta al teléfono: hace falta una API desplegada o una dirección LAN accesible. El inicio normal, sin configurar esta variable, sigue usando Render.

## Pendientes para entrega de producción

1. Publicar los cambios del backend y comprobarlos en Render; el despliegue remoto sigue separado de estos archivos. La rama móvil de integración tampoco se publicó.
2. Probar correo de confirmación, recuperación de cuenta y operaciones completas con cuentas de ensayo de cada rol. No se cambiaron contraseñas de usuarios existentes ni se fabricaron sesiones.
3. Revisar/rotar la service_role que apareció en el historial del repositorio original. La revisión no publicó ni rotó esa clave.
4. Sustituir los medios rotos y datos de ejemplo restantes por contenido confirmado. Las fotos alternativas cubren 12 lugares, no todos. Los archivos de verificación de la carga inicial son de prueba; no se añadió un flujo de subida a Storage.
5. VIP muestra planes y suscripciones existentes; no hay pasarela de pago. Las descargas avanzadas y algunas interacciones del prototipo web aún requieren implementación específica. No interpretar un botón del prototipo como una operación productiva.
6. Probar en dispositivos Android/iOS. SecureStore se verificó por tipos/build; el navegador usa sessionStorage.
7. Dependencias: se aplicaron correcciones compatibles. La revisión final de npm informa 11 alertas (8 moderadas y 3 altas), incluidas dependencias de desarrollo, en la cadena Expo/Router; resolverlas requiere revisar versiones y compatibilidad. No se aplicó `audit fix --force` ni se migró automáticamente a otro SDK. Revisar de nuevo antes de publicar.

## Recursos

- Backend: https://github.com/JoseMarca17/backend_TuristeaYa
- App y ramas: https://github.com/Drospi/TuristeaYa
- Figma: https://www.figma.com/design/K4tEGFyk9oVZElp6W8H7SQ/Untitled?node-id=0-1
- Base: https://supabase.com/dashboard/project/xjdiwevkbcvakmqjyzuv
- Render: https://backend-turisteaya.onrender.com/docs
- SecureStore SDK 57: https://docs.expo.dev/versions/v57.0.0/sdk/securestore/
- Protección de contraseñas: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

