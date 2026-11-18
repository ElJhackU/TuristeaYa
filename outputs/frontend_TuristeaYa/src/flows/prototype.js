import { auth } from "../services/auth.js";

const destinations = {
  "Ver usuario VIP":"vip", "Ver panel del negocio":"negocio", "Ver soporte":"tickets", "Ver administrador":"admin",
  "Mis rutas":"mis-rutas", "Cupones":"cupones", "Perfil":"perfil", "2. Galería de la Ciudad":"galeria",
  "1. Galería de la Ciudad":"galeria", "3. Mirador de los Andes":"mirador", "2. Centro cultural":"galeria",
  "Avisos de mi salida":"notificaciones", "Patrocinado · Restaurante local":"cupones",
  "Ver reseñas":"resenas", "Ver cupones":"cupones", "Reportar información incorrecta":"reportar",
  "Escribir mi reseña":"escribir-resena", "20% en tu primera bebida":"canjear", "10% en almuerzo":"canjear",
  "Tengo un problema":"reportar", "Volver a mis cupones":"cupones", "Notificaciones":"notificaciones",
  "Ayuda y mis reportes":"ayuda", "Nuevo reporte":"reportar", "Beneficios VIP":"vip",
  "Personalizar ruta avanzada":"ruta-avanzada", "Recomendación exclusiva":"degustacion",
  "Mis rutas sin conexión":"descargas", "Descargar rutas con VIP":"descargas", "Historial de beneficios":"beneficios",
  "Soporte prioritario":"ayuda", "+ Agregar otra parada":"agregar-parada", "Ver más experiencias":"experiencias",
  "Revisar reserva":"confirmar-reserva", "Editar participantes":"degustacion", "Volver a VIP":"vip",
  "Resumen":"negocio", "Negocio":"negocio", "Mis datos":"datos-negocio", "Datos del negocio":"datos-negocio",
  "Promociones":"promociones", "Cupones del negocio":"promociones", "Campañas":"campanas", "Avisos":"avisos-negocio",
  "Reseñas y respuestas":"resenas-negocio", "Avisos de canjes y promociones":"avisos-negocio",
  "Solicitar verificación":"verificar-negocio", "Crear una promoción":"editar-promocion", "20% en primera bebida":"editar-promocion",
  "10% en desayuno":"editar-promocion", "Nueva campaña":"publicidad", "Pausar campaña":"campana-pausada",
  "Reactivar campaña":"campanas", "Revisar periodo y presupuesto":"publicidad", "Reportar un canje incorrecto":"reportar",
  "#2048 · Cupón no reconocido":"ticket", "#2049 · Descarga incompleta":"ticket", "#2050 · Horario incorrecto":"ticket",
  "Conversar con el usuario":"chat", "Historial del usuario":"historial-usuario", "Notificar al negocio":"avisar-negocio",
  "Volver al caso":"ticket", "Volver al ticket":"ticket", "Tickets":"tickets", "Chat":"chat", "Historial":"historial-usuario",
  "Usuarios y permisos":"permisos", "Usuarios":"permisos", "Validar comercios":"validar-comercios", "Comercios":"validar-comercios",
  "Moderar reseñas":"moderar-resenas", "Seguridad y actividad":"seguridad", "Seguridad":"seguridad",
  "VIP":"vip", "Descargas":"descargas", "Beneficios":"beneficios", "Panel":"admin", "Admin":"admin",
  "Mi local":"datos-negocio", "Caso":"ticket", "Recorridos":"bienvenida",
  "Volver a recorridos":"bienvenida", "Volver a los recorridos":"bienvenida",
};

const parents = {
  galeria:"paseo-centro", mirador:"paseo-centro", resenas:"cafe-patio", "escribir-resena":"resenas",
  compartir:"paseo-centro", "mis-rutas":"inicio", cupones:"inicio", canjear:"cupones", "cupon-canjeado":"cupones",
  notificaciones:"inicio", reportar:"ayuda", perfil:"inicio", ayuda:"perfil",
  vip:"bienvenida", descargas:"vip", "ruta-avanzada":"vip", "agregar-parada":"ruta-avanzada",
  degustacion:"vip", "confirmar-reserva":"degustacion", beneficios:"vip",
  negocio:"bienvenida", "datos-negocio":"negocio", promociones:"negocio", "editar-promocion":"promociones",
  "resenas-negocio":"negocio", campanas:"negocio", "campana-pausada":"campanas", publicidad:"campanas",
  "verificar-negocio":"negocio", "avisos-negocio":"negocio",
  tickets:"bienvenida", ticket:"tickets", chat:"ticket", "historial-usuario":"ticket", "avisar-negocio":"ticket",
  admin:"bienvenida", permisos:"admin", "validar-comercios":"admin", "moderar-resenas":"admin", seguridad:"admin",
};

const transitions = {
  "Publicar reseña":"resenas", "Confirmar canje":"cupon-canjeado", "Enviar reporte":"ayuda",
  "Guardar itinerario":"vip", "Confirmar reserva":"beneficios", "Guardar información":"negocio",
  "Guardar promoción":"promociones", "Confirmar contratación de prueba":"campanas", "Enviar solicitud":"negocio",
  "Resolver ticket":"tickets", "Enviar aviso":"ticket", "Guardar permisos":"admin",
  "Aprobar verificación":"admin", "Solicitar corrección":"admin", "Ocultar reseña":"admin",
  "Mantener publicación":"admin", "Guardar medida de seguridad":"admin",
};

const localActions = new Set(["Marcar todo como leído", "Quitar una ruta de favoritos", "Actualizar descargas",
  "Descargar itinerario", "Enviar mensaje", "Enviar respuesta", "Publicar respuesta"]);
const edits = new Map();
const choices = new Map();
let place = "cafe-patio";
let flash = "";

export function screenFeedback() {
  const result = flash;
  flash = "";
  return result;
}

function storeDemo(page, label, form) {
  const items = [...form.elements].filter((node) => node.name && node.type !== "file");
  const entry = { label, values: Object.fromEntries(items.map((node) => [node.name, node.value])) };
  edits.set(page, entry.values);
}

async function shareCurrent(ctx, native) {
  const url = new URL(ctx.routeLink, location.href).href;
  try {
    if (native && navigator.share) await navigator.share({ title: "TuristeaYA", url });
    else { await navigator.clipboard.writeText(url); ctx.inform("Enlace copiado."); }
  } catch (error) {
    if (error.name !== "AbortError") ctx.inform("No se pudo compartir el enlace.");
  }
}

function toggleChoice(event, page, node) {
  const button = event.currentTarget;
  const row = button.parentElement;
  const key = page + ":" + node.y;
  const picked = choices.get(key) === node.id;
  choices.set(key, picked ? "" : node.id);
  for (const candidate of row.querySelectorAll("button[aria-pressed]")) {
    const selected = candidate === button && !picked;
    candidate.classList.toggle("selected", selected);
    candidate.setAttribute("aria-pressed", String(selected));
  }
}

export function extendControls(name, page, controls, ctx) {
  if (["cafe-patio", "galeria", "mirador"].includes(name)) place = name;
  for (const node of page.nodes) {
    const label = node.text?.trim();
    if (!label || node.y === 54) continue;
    if (node.control === "input") {
      const group = page.nodes.find((item) => item.id === node.box);
      const caption = page.nodes.filter((item) => item.text && item.y < group.y && item.x === group.x).at(-1);
      controls.fields[node.id] = {
        name: node.id,
        title: caption?.text ?? label,
        value: edits.get(name)?.[node.id] ?? label,
        ...(caption?.text?.includes("Correo") ? { type: "email" } : {}),
      };
      continue;
    }
    let next = destinations[label];
    if (label === "Resumen" && ["admin", "permisos", "validar-comercios", "moderar-resenas", "seguridad"].includes(name)) next = "admin";
    if (label === "Cupones" && ["negocio", "datos-negocio", "promociones", "editar-promocion",
      "resenas-negocio", "campanas", "campana-pausada", "publicidad", "verificar-negocio", "avisos-negocio"].includes(name)) next = "promociones";
    if (label === "Paseo por el centro" || label === "Una tarde cultural") next = label === "Paseo por el centro" ? "paseo-centro" : "tarde-cultural";
    if (label === "‹" && parents[name]) {
      next = ["galeria", "mirador", "compartir"].includes(name) ? ctx.route : name === "resenas" ? place : parents[name];
    }
    if (label === "Cancelar" && parents[name]) next = parents[name];
    if (label === "Compartir" && ["paseo-centro", "tarde-cultural"].includes(name)) next = "compartir";
    if (label === "Volver al lugar") next = place;
    if (["Continuar mi ruta", "Volver al itinerario", "Volver a mi ruta"].includes(label) && parents[name]) next = ctx.route;
    if (label === "Café del Patio" && name === "negocio") next = "datos-negocio";
    if (label === "Café cerca de ti" && name === "campanas") next = "campana-pausada";
    if (label === "Avisos" && ["tickets","ticket","chat","historial-usuario","avisar-negocio"].includes(name)) next = "avisar-negocio";
    if (label === "Reseñas" && ["admin","permisos","validar-comercios","moderar-resenas","seguridad"].includes(name)) next = "moderar-resenas";
    if (name === "agregar-parada" && node.control === "card") {
      controls.actions[node.id] = () => {
        flash = `Parada añadida en la vista de prueba: ${label}.`;
        ctx.navigate("ruta-avanzada");
      };
    } else if (next) {
      controls.actions[node.id] = label === "‹" ? { label:"Volver", run:() => ctx.navigate(next) } : () => ctx.navigate(next);
    } else if (transitions[label] || localActions.has(label)) {
      controls.actions[node.id] = (event) => {
        storeDemo(name, label, event.currentTarget.form);
        const receipt = `${label} · Registrado en la demostración.`;
        if (transitions[label]) { flash = receipt; ctx.navigate(transitions[label]); }
        else ctx.inform(receipt);
      };
    } else if (node.control === "choice") {
      node.pressed = choices.get(name + ":" + node.y) === node.id;
      controls.actions[node.id] = (event) => toggleChoice(event, name, node);
    } else if (label === "Copiar enlace" || label === "Compartir con otra aplicación") {
      controls.actions[node.id] = () => shareCurrent(ctx, label !== "Copiar enlace");
    } else if (label === "Cerrar sesión") {
      controls.actions[node.id] = async () => {
        ctx.clearSession();
        ctx.navigate("bienvenida");
        try {
          if (ctx.token) await auth.logout(ctx.token);
        } catch { /* The device session is already cleared. */ }
      };
    } else if (label.startsWith("+ ") && node.control === "button") {
      controls.actions[node.id] = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = name === "verificar-negocio" ? "application/pdf,image/*" : "image/*";
        input.addEventListener("change", () => {
          if (input.files.length) ctx.inform(`Seleccionado localmente: ${input.files[0].name}`);
        });
        input.click();
      };
    }
  }
  return controls;
}
