# TuristeaYa — contexto del proyecto y guía de entrega

TuristeaYa es un prototipo turístico para explorar lugares, armar o encontrar rutas según el presupuesto y tiempo disponible, guardar itinerarios, consultar cupones y reservar experiencias. El diseño contempla cinco recorridos de usuario: turista, VIP, negocio, soporte y administración.

Este archivo reúne las tres partes del proyecto y la carga de datos de prueba. Los enlaces a entornos remotos describen el estado observado durante el trabajo. La base y el despliegue pueden haber cambiado desde entonces.

## Estado actual — 17 de noviembre de 2026

Se conservan los diseños, componentes, rutas locales y aportes de las siete ramas. La revisión actual está detallada en [REVISION_SISTEMA.md](./REVISION_SISTEMA.md). Esta sección actualiza los estados históricos indicados más abajo.

- **Web:** renovación de sesión compartida entre peticiones, límite de espera de 45 segundos, limpieza local al cerrar sesión, errores de validación legibles y protección frente a destinos externos. Reportes, mensajes de tickets y edición de datos del negocio ahora llaman a la API.
- **Expo:** login, registro, sesión restaurable (refresh token en SecureStore nativo y sessionStorage web), reservas y canjes con claves persistentes para reintentos. Soporte, administración, negocios, promociones, campañas, reseñas, reportes, notificaciones y VIP consultan la API. Los componentes compartidos y el planificador local se conservan. El catálogo también permite guardar rutas en la cuenta. Fotos con autor/licencia para los lugares que tienen recursos verificados.
- **Backend local:** mapa de columnas y llaves foráneas de las 32 tablas importado desde GitHub; validación de payloads, orden estable de paginación, perfil privado, comprobación de JWT y propiedad de escrituras. No se incorporó el acceso anónimo mediante service_role del repositorio remoto. Estos cambios todavía requieren despliegue.
- **Supabase:** acceso confirmado a `xjdiwevkbcvakmqjyzuv`, organización TuristeaYa. Se revisaron las 32 tablas, políticas y RPC. Las pruebas transaccionales con rollback comprobaron aislamiento de datos, reservas, sobrecupo, canjes e idempotencia. Se aplicaron protecciones de campos sensibles y auditoría de moderación; también se probaron con rollback. No se conservaron filas de prueba.
- **Pruebas realizadas:** 13 pruebas del backend y 9 del cliente web; navegación por 59 pantallas web; login, restauración y escritura de soporte en Expo con API simulada. Lint, TypeScript y pruebas del planificador pasan; exportación web de 35 rutas.
- **Arranque local:** ejecutar `./outputs/INICIAR_LOCAL.ps1 -WebPort 4174` desde la raíz. Abre la web con el backend local en `http://127.0.0.1:8000`, conectado a Supabase con clave pública. El `.env` queda fuera de Git. El arranque estándar de los clientes sigue apuntando a Render.

La implementación y las pruebas locales no equivalen a un despliegue. Falta publicar el backend corregido en Render y validar login/correo y escrituras con cuentas de ensayo de cada rol. No se implementó una pasarela de pagos: VIP consulta suscripciones existentes y la contratación remite a soporte. Continúan pendientes la revisión de medios rotos, algunos datos de ejemplo, las pruebas Android/iOS y la revisión de credenciales históricas. Consultar la lista actualizada en REVISION_SISTEMA.md antes de una entrega de producción.

## Carpetas del proyecto

| Carpeta | Contenido | Cómo probar |
|---|---|---|
| [frontend_TuristeaYa](./frontend_TuristeaYa) | Frontend web móvil en JavaScript, HTML y CSS. Incluye las 52 pantallas del prototipo y fichas adicionales para datos reales. | `npm run dev` y abrir [Inicio](http://127.0.0.1:4173/#/inicio). `npm run check` ejecuta las pruebas del cliente API. |
| [TuristeaYa-Expo](./TuristeaYa-Expo) | App móvil Expo SDK 57, React Native, TypeScript y Expo Router. Integra los trabajos individuales. | `npm ci` si faltan dependencias, luego `npm run web` o `npm start`. |
| [backend_TuristeaYa/api](./backend_TuristeaYa/api) | Copia del backend FastAPI. Incluye cambios locales de protección de datos privados pendientes de desplegar. | Desde `api`, configurar un `.env` local a partir de `.env.example`, instalar `requirements.txt` y ejecutar `uvicorn main:app --reload`. Usar un proyecto de prueba para operaciones que escriben. |
| [integrante_2](./integrante_2) | SQL de carga, exportación de categorías y archivos de UUID para relacionar registros. | Consultar los IDs antes de enlazar las tablas. El SQL ya se utilizó en el proyecto del equipo. |

El flujo web es **navegador → API FastAPI en Render → Supabase**. El frontend llama a la API con `fetch` y envía un token Bearer para solicitudes autenticadas. Las claves administrativas pertenecen a la configuración del servidor. La app Expo tiene navegación, sesión y servicios propios; mantiene el planificador local y consulta los módulos conectados mediante la API.

## Enlaces del equipo y del entorno

- [Repositorio del backend](https://github.com/JoseMarca17/backend_TuristeaYa/tree/main/api)
- [Repositorio móvil del equipo](https://github.com/Drospi/TuristeaYa) · [Ramas](https://github.com/Drospi/TuristeaYa/branches)
- [Diseño original en Figma](https://www.figma.com/design/K4tEGFyk9oVZElp6W8H7SQ/Untitled?node-id=0-1)
- [Proyecto Supabase](https://supabase.com/dashboard/project/xjdiwevkbcvakmqjyzuv) · [SQL Editor](https://supabase.com/dashboard/project/xjdiwevkbcvakmqjyzuv/sql)
- [Backend desplegado en Render](https://backend-turisteaya.onrender.com/) · [Estado](https://backend-turisteaya.onrender.com/health) · [Swagger](https://backend-turisteaya.onrender.com/docs) · [OpenAPI](https://backend-turisteaya.onrender.com/openapi.json)

La rama Expo local `integracion/todas-las-ramas` reúne las siete ramas del repositorio. `sebastian` incorpora `Hecho` y aporta el flujo de rutas. `JoseCupones` incorpora `jose` y aporta cupones. `resenas` aporta las tarjetas y filtros de reseñas. `NegociosSoporte` aporta las vistas de negocio y ayuda. `main` es la rama base del equipo. La integración quedó guardada localmente y sigue pendiente de publicación en GitHub.

## Dónde está cada parte de la web

| Código | Responsabilidad |
|---|---|
| [src/pages](./frontend_TuristeaYa/src/pages) | Pantallas, capas del diseño y registro de rutas de navegación. Las primeras 12 se basan en el contexto detallado de Figma. Las 40 restantes se reconstruyeron con la captura y la estructura de capas disponible. |
| [src/components](./frontend_TuristeaYa/src/components) y [src/styles](./frontend_TuristeaYa/src/styles) | Renderizador, controles, tarjetas, mapas, fotos y estilos compartidos. |
| [app.js](./frontend_TuristeaYa/src/app.js) | Navegación por hash, sesión, filtros de rutas y selección del punto de partida. |
| [src/api](./frontend_TuristeaYa/src/api), [config.js](./frontend_TuristeaYa/src/config.js) y [src/services](./frontend_TuristeaYa/src/services) | URL de Render, endpoints centralizados, cliente HTTP, paginación, autenticación, acciones y rutas guardadas en el navegador. |
| [src/flows](./frontend_TuristeaYa/src/flows) | `live-data.js` carga los catálogos y datos de cuenta. `team-data.js` consulta negocio y soporte. `prototype.js` conserva las interacciones de demostración. |
| [assets](./frontend_TuristeaYa/assets) y [créditos de fotos](./frontend_TuristeaYa/src/data/place-photos.js) | Recursos de Figma, Inter, Leaflet y fotos de Wikimedia con fuente, autor y licencia. |

## Qué probar y qué sigue pendiente

| Flujo | Estado y verificación útil |
|---|---|
| Catálogo de rutas y lugares | Datos reales desde Render. En **Inicio** se puede explorar todo el catálogo autorizado. **Crear una ruta** filtra recorridos existentes por presupuesto, duración y categoría. Revisar que el catálogo y la búsqueda comuniquen esa diferencia al usuario. |
| Detalles y mapas | Las paradas se muestran en orden con coordenadas reales. La línea del mapa conecta puntos. **Obtener indicaciones** abre Google Maps para calcular el trayecto por vías. Probar el [Circuito de Teleféricos y Miradores de La Paz](http://127.0.0.1:4173/#/ruta-real?id=28e163dd-ca4d-41f2-a9d8-f1506a66cc7e). |
| Fotos | El enlace guardado en las 30 filas de `place_media` observadas era el mismo y devolvía 404. Se añadieron fotos con créditos para 12 lugares. Las fichas restantes ofrecen una búsqueda de imágenes. Reemplazar los enlaces rotos por archivos válidos del lugar correspondiente. |
| Mis rutas | Guardar, recargar, marcar como visitada y quitar una ruta. La persistencia actual es local al navegador. Expo tiene su propio repositorio local de itinerarios. |
| Cuenta, reseñas, canjes y reservas | Perfil, notificaciones, suscripciones, reservas y reportes consultan datos de cuenta. Los formularios de publicación, lectura, canje y reserva llaman a la API. Faltan pruebas autenticadas de escritura con cuentas de ensayo. |
| Negocio, soporte y administración | La web consulta los negocios asociados a la cuenta, sus campañas, promociones y los tickets según el rol. Verificar con cuentas de cada rol. La edición y los paneles administrativos principales ya llaman a la API; aún deben validarse con cuentas reales de cada rol. |
| App móvil Expo | Pasaron ESLint, TypeScript y las pruebas de rutas. La exportación web generó 35 rutas. Queda pendiente la prueba en dispositivos Android/iOS y la revisión final del contenido de ejemplo del planificador. |

## Revisiones prioritarias

1. **Permisos de datos.** Durante la revisión, Render devolvió filas de recursos privados como `notifications`, `user-access` y `tickets` sin sesión. La copia local de FastAPI incorpora controles de autenticación y alcance por usuario o rol. Falta desplegar el backend corregido. RLS y las funciones de reserva/canje ya se comprobaron mediante el conector autorizado y pruebas con rollback. Verificar como invitado y con dos usuarios distintos que las lecturas y escrituras quedan separadas.
2. **Credenciales.** El repositorio original del backend incluía un `.env` con una clave `service_role`. Comprobar si sigue activa, rotarla si corresponde y retirar el archivo del repositorio y del historial. Mantener `.env.example` como plantilla y usar variables de entorno del despliegue.
3. **Esquema reproducible.** Incorporar las migraciones con tablas, llaves foráneas, políticas RLS y las funciones de reserva y canje. Probar cupos, límites e idempotencia antes de habilitar escrituras en producción.
4. **Calidad de rutas e imágenes.** Revisar que el nombre, la zona y las paradas de cada recorrido correspondan entre sí. Algunos datos de prueba tienen títulos de otras regiones y paradas en La Paz. Validar también las coordenadas, el orden, los horarios y las licencias de las fotos antes de publicar.
5. **Pruebas de entrega.** Probar registro y confirmación por correo, inicio y cierre de sesión, filtros, rutas guardadas, cupones, reservas, reseñas y roles. Revisar visualmente las pantallas reconstruidas contra Figma. Confirmar que los botones de demostración se distinguen de las operaciones reales.

## Datos de prueba del integrante 2

La carga siguió el orden `categories`, `zones`, `subscription_plans`, `businesses`, `business_verifications` y `subscriptions`. Los negocios usan `profiles.id` como propietario, las verificaciones apuntan a `businesses.id` y las suscripciones apuntan a `profiles.id` y `subscription_plans.id`. El esquema observado no relaciona directamente `businesses` con `zones`.

Se prepararon 20 filas por tabla. El listado posterior a la carga mostró 25 categorías y 21 zonas, incluidos registros previos, y 20 registros en cada una de las otras cuatro tablas. Las categorías existentes conservaron sus IDs. Las rutas de archivos de verificación son de prueba.

- [IDs para relacionar tablas](./integrante_2/ids_para_compartir.json)
- [Categorías confirmadas](./integrante_2/categorias_confirmadas.csv)
- [Consulta para exportar las categorías actuales](./integrante_2/exportar_categorias.sql)
- [SQL histórico de la carga](./integrante_2/cargar_120_registros.sql) · Usar como referencia de la carga realizada. Volver a ejecutarlo puede generar duplicados o errores de claves.

## Recursos técnicos utilizados

- [FastAPI](https://fastapi.tiangolo.com/) y [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) y [Expo Router](https://docs.expo.dev/router/introduction/)
- [Leaflet 1.9.4](https://leafletjs.com/reference-1.9.4.html), [OpenStreetMap](https://www.openstreetmap.org/copyright) y su [política de teselas](https://operations.osmfoundation.org/policies/tiles/)
- [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) para abrir indicaciones en un servicio externo
- [Fotos de Wikimedia Commons](https://commons.wikimedia.org/) con créditos por lugar y [tipografía Inter](https://rsms.me/inter/) con licencia OFL

