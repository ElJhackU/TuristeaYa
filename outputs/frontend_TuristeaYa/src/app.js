import { pages } from "./pages/index.js";
import { extendControls, screenFeedback } from "./flows/prototype.js";
import { renderLive, saveLocalRoute } from "./flows/live-data.js";
import { renderTeam, teamScreens } from "./flows/team-data.js";
import { dataScreens } from "./pages/catalog-pages.js";
import { screen } from "./components/screen.js";
import { element } from "./components/dom.js";
import { control, recordPanel } from "./components/records.js";
import { coordinates, routeMap } from "./components/route-map.js";
import { auth } from "./services/auth.js";
import { catalog } from "./services/catalog.js";
import { configureSession } from "./api/client.js";
import { createSessionManager } from "./services/session.js";

const app = document.querySelector("#app");
const links = {
  "Entrar como turista": "iniciar-sesion", "Crear una cuenta": "crear-cuenta",
  "Ya tengo una cuenta": "iniciar-sesion", "Continuar como invitado": "inicio",
  "Volver a los recorridos": "bienvenida", "Cambiar ubicación": "ubicacion",
  "Crear una ruta": "crear-ruta", "Filtrar y ordenar": "filtros",
  "Cambiar presupuesto o tiempo": "crear-ruta", "Paseo por el centro": "paseo-centro",
  "Una tarde cultural": "tarde-cultural", "Editar paradas": "editar-paradas",
  "Café del Patio": "cafe-patio", "1. Café del Patio": "cafe-patio",
  "Volver a los resultados": "resultados", "Inicio": "inicio",
};
const pending = new Set(["Ver usuario VIP", "Ver panel del negocio", "Ver soporte", "Ver administrador",
  "Mis rutas", "Cupones", "Perfil", "Ver reseñas", "Ver cupones", "Reportar información incorrecta",
  "2. Galería de la Ciudad", "3. Mirador de los Andes", "1. Galería de la Ciudad",
  "2. Centro cultural", "Avisos de mi salida", "Patrocinado · Restaurante local"]);

const sessionKey = "turisteaya.session";
function getSession() {
  try {
    const value = JSON.parse(sessionStorage.getItem(sessionKey));
    return value?.access_token && value?.user?.id ? value : null;
  } catch { return null; }
}
let session = getSession();
function persistSession(value) {
  session = value;
  try {
    if (value) sessionStorage.setItem(sessionKey, JSON.stringify(value));
    else sessionStorage.removeItem(sessionKey);
  } catch { /* Keep the signed-in session in memory if storage is unavailable. */ }
}
const sessions = createSessionManager({ initial: session, refresh: auth.refresh, onChange: persistSession });
configureSession(sessions);
const setSession = (value) => sessions.set(value);
let afterLogin = "inicio";
let locationName = "Centro de La Paz";
let search = { budget: 100, hours: 3, category: "", sort: "" };
let terms = false;
let rendered;
let currentRequest;
let routeDetail = "paseo-centro";
let editedStops = null;

function navigate(name) {
  if (location.hash === `#/${name}`) return;
  location.hash = `/${name}`;
}

function inform(message) {
  rendered.status.textContent = message;
  rendered.status.hidden = !message;
}

function read(name) {
  return rendered.content.elements.namedItem(name)?.value?.trim() ?? "";
}

function field(name, placeholder, props = {}) {
  const labels = { email: "Correo electrónico", password: "Contraseña", confirmation: "Confirmar contraseña",
    fullName: "Nombre", zone: "Buscar una zona", budget: "Presupuesto por persona (Bs)",
    hours: "Tiempo disponible", departure: "Punto de partida", distance: "Distancia máxima" };
  const input = { name, placeholder, ...props };
  input.title = labels[name];
  return input;
}

const inputs = {
  "iniciar-sesion": {
    "1:34": field("email", "usuario@ejemplo.com", { type: "email", autocomplete: "email", required: true }),
    "1:37": field("password", "••••••••", { type: "password", autocomplete: "current-password", required: true }),
  },
  "crear-cuenta": {
    "1:57": field("fullName", "María", { autocomplete: "name", required: true, maxLength: 120 }),
    "1:60": field("email", "maria@ejemplo.com", { type: "email", autocomplete: "email", required: true }),
    "1:63": field("password", "••••••••", { type: "password", autocomplete: "new-password", required: true, minLength: 8 }),
    "1:66": field("confirmation", "••••••••", { type: "password", autocomplete: "new-password", required: true, minLength: 8 }),
  },
  "ubicacion": { "1:120": field("zone", "Centro de La Paz") },
  "crear-ruta": {
    "1:149": field("budget", "100", { type: "number", min: "0", required: true }),
    "1:152": field("hours", "3 horas", { type: "number", min: "0.5", step: "0.5", required: true }),
    "1:162": field("departure", "Centro de La Paz"),
  },
};

async function submitAuth(name) {
  const view = rendered;
  if (!view.content.reportValidity()) return;
  const password = view.content.elements.namedItem("password").value;
  if (name === "crear-cuenta" && password !== view.content.elements.namedItem("confirmation").value) {
    inform("Las contraseñas no coinciden.");
    return;
  }
  if (name === "crear-cuenta" && !terms) {
    inform("Debes aceptar los términos y la privacidad.");
    return;
  }
  if (view.submitting) return;
  view.submitting = true;
  inform("Procesando…");
  try {
    const result = name === "crear-cuenta"
      ? await auth.register({ email: read("email"), password, fullName: read("fullName"), acceptTerms: terms })
      : await auth.login(read("email"), password);
    if (rendered !== view) return;
    if (result?.access_token) {
      setSession(result);
      const destination = afterLogin;
      afterLogin = "inicio";
      navigate(destination);
    } else {
      inform(result?.message || "Revisa tu correo para confirmar tu cuenta.");
    }
  } catch (error) {
    if (rendered === view) inform(error.message);
  } finally {
    view.submitting = false;
  }
}

function mark(node, selected) {
  node.setAttribute("aria-pressed", String(selected));
  node.classList.toggle("selected", selected);
}

function adjustSelection(event, key, value) {
  search[key] = search[key] === value ? "" : value;
  for (const button of rendered.content.querySelectorAll("[data-selection]")) {
    if (button.dataset.selection === key) mark(button, button === event.currentTarget && Boolean(search[key]));
  }
}

async function renderFilters(signal) {
  const panel = recordPanel(rendered, "Filtrar rutas");
  const category = element("select", { attrs: { "aria-label": "Categoría" } });
  category.append(element("option", { text: "Todas las categorías", attrs: { value: "" } }));
  const order = element("select", { attrs: { "aria-label": "Orden" } });
  for (const [value, text] of [["", "Orden del catálogo"], ["Menor precio", "Menor precio"], ["Menor duración", "Menor duración"]]) {
    order.append(element("option", { text, attrs: { value } }));
  }
  order.value = search.sort;
  panel.append(category, order, control("Aplicar filtros", () => {
    search.category = category.value;
    search.sort = order.value;
    navigate("resultados");
  }), control("Quitar filtros", () => {
    search.category = "";
    search.sort = "";
    navigate("resultados");
  }));
  try {
    const rows = await catalog.all("categories", { token: session?.access_token, signal });
    if (signal.aborted) return;
    for (const row of rows.sort((a, b) => a.name.localeCompare(b.name, "es"))) {
      category.append(element("option", { text: row.name, attrs: { value: row.name } }));
    }
    category.value = search.category;
  } catch (error) { if (!signal.aborted) inform(error.message); }
}

function requestLocation() {
  if (!navigator.geolocation) return inform("Elige una zona manualmente.");
  inform("Consultando ubicación…");
  const view = rendered;
  navigator.geolocation.getCurrentPosition(({ coords }) => {
    if (rendered !== view) return;
    view.content.elements.namedItem("zone").value = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
    view.content.elements.namedItem("zone").dispatchEvent(new Event("input"));
    inform("");
  }, () => { if (rendered === view) inform("No se pudo obtener tu ubicación. Escribe una zona."); },
  { timeout: 8000, maximumAge: 300000 });
}

async function loadZones(signal) {
  const field = rendered.content.elements.namedItem("zone");
  const panel = recordPanel(rendered, "Mapa de partida");
  let zones = [];
  let mapRequest;
  signal.addEventListener("abort", () => mapRequest?.abort(), { once: true });
  function updateMap() {
    if (signal.aborted) return;
    mapRequest?.abort();
    mapRequest = new AbortController();
    const label = field.value.trim();
    const zone = zones.find((row) => row.name.toLocaleLowerCase("es") === label.toLocaleLowerCase("es"));
    const point = zone ? coordinates(zone.latitude, zone.longitude)
      : label === "Centro de La Paz" ? [-16.495, -68.133]
      : coordinates(...label.split(","));
    panel.replaceChildren(point ? routeMap([{ point, label }], mapRequest.signal)
      : element("p", { text: "Selecciona una zona o usa tu ubicación para verla en el mapa." }));
  }
  field.addEventListener("change", updateMap);
  field.addEventListener("input", () => {
    if (field.value.includes(",") || zones.some((zone) => zone.name === field.value)) updateMap();
  });
  updateMap();
  try {
    zones = await catalog.all("zones", { token: session?.access_token, signal });
    if (signal.aborted) return;
    const list = element("datalist", { attrs: { id: "available-zones" } });
    for (const name of new Set(zones.map((zone) => zone.name))) list.append(element("option", { attrs: { value: name } }));
    rendered.content.append(list);
    rendered.content.elements.namedItem("zone").setAttribute("list", list.id);
  } catch {
    if (!signal.aborted) inform("Puedes escribir la zona manualmente.");
  }
}

function addLiveList(records) {
  const group = recordPanel(rendered, "Resultados de búsqueda");
  if (!records.length) group.append(element("p", { text: "No hay rutas con ese presupuesto y duración. Amplía los filtros o abre el catálogo completo." }));
  for (const route of records) {
    const button = element("button", { text: route.name ?? route.title ?? "Ruta", attrs: { type: "button" } });
    button.addEventListener("click", () => navigate(`ruta-real?id=${encodeURIComponent(route.id)}&from=resultados`));
    group.append(button);
  }
  group.append(control("Ver todas las rutas", () => navigate("catalogo-rutas")));
}

async function loadRoutes(signal) {
  const options = { token: session?.access_token, signal };
  try {
    const categories = search.category ? await catalog.all("categories", options) : [];
    const category = categories.find(({ name }) => name === search.category);
    if (search.category && !category) { addLiveList([]); return; }
    const routes = await catalog.all("routes", { ...options, category_id: category?.id });
    const matches = routes.filter((route) =>
      (route.visibility === "public" || Boolean(session?.user?.id && route.user_id === session.user.id)) &&
      route.budget != null && route.available_minutes != null &&
      Number(route.budget) <= search.budget && Number(route.available_minutes) <= search.hours * 60);
    if (["Menor costo", "Menor precio"].includes(search.sort)) {
      matches.sort((left, right) => Number(left.budget) - Number(right.budget));
    }
    if (search.sort === "Menor duración") {
      matches.sort((left, right) => Number(left.available_minutes) - Number(right.available_minutes));
    }
    if (!signal.aborted) addLiveList(matches);
  } catch (error) {
    if (!signal.aborted) {
      inform(error.message);
      recordPanel(rendered, "Reintentar búsqueda").append(control("Reintentar", show), control("Ver todas las rutas", () => navigate("catalogo-rutas")));
    }
  }
}

function saveRoute() {
  const routes = {
    "paseo-centro": { name: "Paseo por el centro", budget: 85, available_minutes: 150 },
    "tarde-cultural": { name: "Una tarde cultural", budget: 40, available_minutes: 110 },
  };
  try {
    saveLocalRoute({ id: routeDetail, ...routes[routeDetail] });
    inform("Ruta guardada en este dispositivo. Puedes verla en Mis rutas.");
  } catch (error) {
    inform(error.message);
  }
}

function createControls(name, page) {
  const fields = Object.fromEntries(Object.entries(inputs[name] ?? {}).map(([id, value]) => [id, { ...value }]));
  if (name === "ubicacion") fields["1:120"].value = locationName;
  if (name === "crear-ruta") {
    fields["1:149"].value = search.budget;
    fields["1:152"].value = search.hours;
    fields["1:162"].value = locationName;
  }
  const actions = {};
  const callbacks = {
    "Ingresar": () => submitAuth(name), "Registrarme": () => submitAuth(name),
    "Acepto los términos y privacidad": (event) => { terms = !terms; mark(event.currentTarget, terms); },
    "Usar mi ubicación actual": requestLocation,
    "Sin permiso: elegir zona manualmente": () => rendered.content.elements.namedItem("zone").focus(),
    "Confirmar esta ubicación": () => {
      locationName = read("zone") || locationName;
      navigate(new URLSearchParams(location.hash.split("?")[1]).get("from") === "crear-ruta" ? "crear-ruta" : "inicio");
    },
    "Buscar rutas": () => {
      if (!rendered.content.reportValidity()) return;
      search.budget = Number(read("budget")); search.hours = Number(read("hours"));
      locationName = read("departure") || locationName;
      navigate("resultados");
    },
    "Aplicar filtros": () => navigate("resultados"),
    "Guardar": saveRoute, "Guardar ruta": saveRoute,
    "Compartir": async () => {
      try {
        if (navigator.share) await navigator.share({ title: page.name, url: location.href });
        else { await navigator.clipboard.writeText(location.href); inform("Enlace copiado."); }
      } catch (error) { if (error.name !== "AbortError") inform("No se pudo compartir la ruta."); }
    },
    "Guardar cambios": () => {
      editedStops = [...rendered.content.querySelectorAll("[data-stop-label]")].map((node) => node.textContent);
      navigate(routeDetail);
    },
    "Cancelar": () => navigate(routeDetail), "Volver a mi ruta": () => navigate(routeDetail),
    "‹": () => {
      const route = new URLSearchParams(location.hash.split("?")[1]).get("route");
      if (name === "lugar-real" && route) return navigate(`ruta-real?id=${encodeURIComponent(route)}`);
      const from = new URLSearchParams(location.hash.split("?")[1]).get("from");
      if (["inicio", "explorar-lugares", "catalogo-rutas", "resultados", "crear-ruta"].includes(from)) return navigate(from);
      navigate(({ "ruta-real": "resultados", "lugar-real": "explorar-lugares", "cupon-real": "cupones",
      "explorar-lugares": "inicio", "catalogo-rutas": "inicio", perfil: "inicio", notificaciones: "perfil",
      "experiencia-real": "experiencias", experiencias: "vip", "crear-cuenta": "iniciar-sesion", "resultados": "crear-ruta", "filtros": "resultados",
      "paseo-centro": "resultados", "tarde-cultural": "resultados", "editar-paradas": routeDetail, "cafe-patio": routeDetail })[name]
      ?? (name === "ubicacion" || name === "crear-ruta" ? "inicio" : "bienvenida"));
    },
  };
  for (const node of page.nodes) {
    const label = node.text;
    if (!label) continue;
    if (callbacks[label]) actions[node.id] = label === "‹" ? { label: "Volver", run: callbacks[label] } : callbacks[label];
    else if (links[label] && node.font !== 22) actions[node.id] = () => navigate(links[label]);
    else if (pending.has(label)) actions[node.id] = () => inform("Esta pantalla está pendiente de implementación.");
    else if (["Todas", "Gastronomía", "Cultura", "Naturaleza"].includes(label)) {
      actions[node.id] = (event) => adjustSelection(event, "category", label === "Todas" ? "" : label);
      node.selection = "category";
    } else if (["Menor distancia", "Menor costo", "Mejor calificación", "Menor precio"].includes(label)) {
      actions[node.id] = (event) => adjustSelection(event, "sort", label);
      node.selection = "sort";
    }
  }
  if (name === "editar-paradas") {
    for (const [index, node] of page.nodes.filter(({ text }) => text?.startsWith("↑")).entries()) {
      actions[node.id] = { label: `Mover parada ${index + 1}`, run: (event) => {
        const labels = [...rendered.content.querySelectorAll("[data-stop-label]")];
        const other = index === 0 ? 1 : index - 1;
        [labels[index].textContent, labels[other].textContent] = [labels[other].textContent, labels[index].textContent];
      } };
    }
  }
  return extendControls(name, page, { actions, fields,
    submit: name === "iniciar-sesion" || name === "crear-cuenta" ? () => submitAuth(name) : undefined,
  }, {
    navigate, inform, route: routeDetail, routeLink: `#/${routeDetail}`, token: session?.access_token,
    clearSession: () => setSession(null),
  });
}

function show() {
  const [name = "bienvenida", query] = (location.hash.slice(2) || "bienvenida").split("?");
  const source = pages[name] ?? pages.bienvenida;
  if (name === "paseo-centro" || name === "tarde-cultural") routeDetail = name;
  const page = { ...source, nodes: source.nodes.map((node) => ({ ...node })) };
  const liveTeam = teamScreens.has(name);
  if (dataScreens.has(name) || liveTeam || name === "filtros") page.nodes = page.nodes.filter(({ y }) => y < 126 || y >= 765);
  if (liveTeam) {
    const subtitle = page.nodes.find(({ y }) => y === 92);
    if (subtitle) subtitle.text = "Datos de la cuenta";
  }
  if (name === "mis-rutas") {
    const subtitle = page.nodes.find(({ y }) => y === 92);
    if (subtitle) subtitle.text = "Guardadas en este dispositivo";
  }
  if (name === "inicio" && locationName !== "Centro de La Paz") {
    page.nodes.find((node) => node.id === "1:80").text = locationName;
  }
  if (name === "inicio") page.nodes = page.nodes.filter(({ y }) => y < 253 || y >= 765);
  if (name === "ubicacion") page.nodes = page.nodes.filter(({ y }) => y < 326 || y >= 504);
  if (name === "resultados") {
    page.nodes = page.nodes.filter(({ y }) => y < 183 || y >= 765);
    page.nodes.find((node) => node.id === "1:178").text = `Hasta Bs ${search.budget} · ${search.hours} h · ${locationName}`;
  }
  currentRequest?.abort();
  currentRequest = new AbortController();
  rendered = screen(page, createControls(name, page));
  app.replaceChildren(rendered.phone);
  const feedback = screenFeedback();
  if (feedback) inform(feedback);
  document.title = `${page.name} · TuristeaYA`;
  for (const node of page.nodes.filter((item) => item.selection)) {
    const button = rendered.content.querySelector(`[data-figma-node="${node.id}"]`);
    button.dataset.selection = node.selection;
    mark(button, search[node.selection] === (node.text === "Todas" ? "" : node.text));
  }
  if (name === "editar-paradas") {
    const textNodes = page.nodes.filter((node) => !node.bold && node.font === 13 && node.w === 266);
    for (const [index, node] of textNodes.entries()) {
      const label = rendered.content.querySelector(`[data-figma-node="${node.id}"]`);
      label.dataset.stopLabel = index;
      if (editedStops?.[index]) label.textContent = editedStops[index];
    }
  }
  const signal = currentRequest.signal;
  if (name === "inicio") recordPanel(rendered, "Explorar TuristeaYA").append(
    control("Explorar lugares", () => navigate("explorar-lugares")),
    control("Ver todas las rutas", () => navigate("catalogo-rutas")),
    control("Experiencias", () => navigate("experiencias")),
    control("Mis notificaciones", () => navigate("notificaciones")),
  );
  if (name === "crear-ruta") recordPanel(rendered, "Más rutas").append(
    control("Ver rutas con mapa y fotos", () => navigate("catalogo-rutas")),
    control("Elegir punto de partida en el mapa", () => navigate("ubicacion?from=crear-ruta")),
  );
  if (name === "ubicacion") void loadZones(signal);
  if (name === "resultados") void loadRoutes(signal);
  if (name === "filtros") void renderFilters(signal);
  const context = {
    signal, navigate, inform, token: session?.access_token, userId: session?.user?.id,
    id: new URLSearchParams(query).get("id"),
    requireLogin: () => {
      afterLogin = location.hash.slice(2);
      navigate("iniciar-sesion");
    },
    logout: async () => {
      const token = session?.access_token;
      setSession(null);
      navigate("bienvenida");
      try {
        if (token) await auth.logout(token);
      } catch { /* Local credentials are cleared even if Auth is offline. */ }
    },
  };
  if (dataScreens.has(name)) void renderLive(name, rendered, context);
  if (liveTeam) void renderTeam(name, rendered, context);
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", show);
show();
