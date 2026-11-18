# TuristeaYa Frontend

Interfaz web móvil en JavaScript con módulos ES. Ejecuta `npm run dev` desde este directorio y abre la URL que imprime el servidor.

Incluye las 52 pantallas del prototipo original de TuristeaYA, organizadas en los recorridos de turista, VIP, negocio, soporte y administración. Las primeras 12 usan el contexto detallado de Figma. Las restantes se reconstruyeron con la captura y la estructura de capas disponibles.

- `src/pages/` contiene un módulo por pantalla de Figma.
- `src/components/` contiene el contenedor, los controles y el renderizador compartidos.
- `src/styles/` contiene los estilos comunes. `assets/` contiene la fuente y los recursos del diseño.
- `src/app.js` coordina navegación, sesión y acciones de la interfaz.
- `src/flows/prototype.js` conecta los recorridos añadidos y sus interacciones de demostración.
- `src/config.js` contiene la URL y el prefijo de la API.
- `src/api/endpoints.js` centraliza las rutas.
- `src/api/client.js` contiene el cliente fetch, la cabecera Bearer y el manejo de respuestas y errores.
- `src/services/` contiene las operaciones de autenticación, catálogo, reservas y canjes.

Ejecuta `npm run check` para verificar el cliente con respuestas HTTP simuladas. Se verificaron en Render la salud y las lecturas de zonas, categorías, rutas y lugares. El formulario de cuenta y de inicio de sesión usa esos endpoints pero requiere una cuenta para probar el flujo de sesión.

Inicio enlaza a los catálogos completos de rutas y lugares. La búsqueda de rutas usa categoría, presupuesto y duración. Los catálogos y datos de cuenta consumen todas las páginas de la API disponibles para su sesión. Mis rutas guarda favoritos y visitas en el navegador.

Cupones muestra promociones vigentes y permite consultar los canjes propios. Desde VIP → Historial de beneficios → Ver más experiencias se abre el catálogo de experiencias. Los formularios de las fichas reales usan los endpoints autenticados de canje y reserva.

Al iniciar sesión se consultan perfil, notificaciones, suscripciones, reservas, reportes propios y los comercios asociados a la cuenta. El panel de soporte exige un rol activo de soporte o administración. El detalle de lugares admite publicar reseñas y cada notificación se puede marcar como leída. Las operaciones autenticadas dependen de los permisos configurados en el backend.

La copia local de FastAPI incluye filtros de alcance para los recursos privados. Esa corrección requiere desplegarse en Render y comprobar las políticas RLS en Supabase. Los controles restantes de edición del prototipo y la administración siguen en demostración.

Las ramas individuales de `Drospi/TuristeaYa` también se reúnen en el proyecto móvil Expo, en la rama local `integracion/todas-las-ramas`.

Al reintentar una reserva o un canje, reutiliza el mismo `requestKey` para la misma operación. La interfaz debe generar un UUID distinto para cada operación nueva.
