import { element } from "./dom.js";

let leaflet;
function loadLeaflet() {
  leaflet ??= new Promise((resolve, reject) => {
    const css = element("link", { attrs: { rel: "stylesheet", href: new URL("../../assets/leaflet/leaflet.css", import.meta.url).href } });
    const script = element("script", { attrs: { src: new URL("../../assets/leaflet/leaflet.js", import.meta.url).href } });
    script.onload = () => resolve(window.L);
    script.onerror = () => { script.remove(); css.remove(); leaflet = undefined; reject(new Error("Mapa no disponible.")); };
    document.head.append(css, script);
  });
  return leaflet;
}

export function coordinates(lat, lng) {
  if (lat == null || lng == null || String(lat).trim() === "" || String(lng).trim() === "") return null;
  const point = [Number(lat), Number(lng)];
  return point.every(Number.isFinite) && Math.abs(point[0]) <= 90 && Math.abs(point[1]) <= 180 ? point : null;
}

export function mapLink(label, points, directions = false) {
  const search = new URLSearchParams({ api: "1" });
  if (directions) {
    search.set("origin", points[0].join(","));
    search.set("destination", points.at(-1).join(","));
    if (points.length > 2) search.set("waypoints", points.slice(1, -1).map((point) => point.join(",")).join("|"));
  } else search.set("query", points[0].join(","));
  return element("a", { className: "map-link", text: label, attrs: {
    href: `https://www.google.com/maps/${directions ? "dir" : "search"}/?${search}`,
    target: "_blank", rel: "noopener noreferrer",
  } });
}

export function routeMap(markers, signal) {
  const section = element("section", { className: "map-section", attrs: { "aria-label": "Mapa de la ruta" } });
  const valid = markers.filter(({ point }) => point);
  if (!valid.length) {
    section.append(element("p", { text: "No hay coordenadas disponibles para mostrar el mapa." }));
    return section;
  }
  const canvas = element("div", { className: "route-map", attrs: { "aria-label": "Mapa interactivo de paradas" } });
  const description = valid.length > 1 ? "La línea une las paradas en orden. Abre las indicaciones para seguir calles y caminos." : "Explora el lugar en el mapa.";
  const note = element("p", { text: description });
  section.append(canvas, note);
  if (valid.length === 1) section.append(mapLink("Abrir en Google Maps", [valid[0].point]));
  else {
    // Google Maps supports up to three intermediate waypoints on mobile browsers.
    for (let start = 0; start < valid.length - 1; start += 4) {
      const segment = valid.slice(start, start + 5);
      const label = valid.length <= 5 ? "Obtener indicaciones" : `Indicaciones · tramo ${Math.floor(start / 4) + 1}`;
      section.append(mapLink(label, segment.map(({ point }) => point), true));
    }
  }
  loadLeaflet().then((L) => {
    if (signal?.aborted || !canvas.isConnected) return;
    const map = L.map(canvas, { scrollWheelZoom: false });
    signal?.addEventListener("abort", () => map.remove(), { once: true });
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    let loadedTiles = false;
    tiles.on("tileload", () => {
      loadedTiles = true;
      note.textContent = description;
    });
    tiles.on("tileerror", () => {
      if (!loadedTiles) note.textContent = "El mapa base no está disponible. Puedes abrir las indicaciones en Google Maps.";
    });
    const points = valid.map(({ point }) => point);
    valid.forEach(({ point, label, number }) => {
      const marker = element("span", { text: number ?? "•" });
      const icon = L.divIcon({ html: marker, className: "route-marker", iconSize: [30, 30], iconAnchor: [15, 15] });
      const popup = element("div", { text: label });
      L.marker(point, { icon, title: label }).addTo(map).bindPopup(popup);
    });
    if (valid.length === 1) map.setView(points[0], 15);
    else {
      L.polyline(points, { color: "#246b53", weight: 4, dashArray: "6 6" }).addTo(map);
      map.fitBounds(points, { padding: [24, 24], maxZoom: 16 });
    }
  }).catch(() => {
    if (signal?.aborted) return;
    canvas.hidden = true;
    note.textContent = "No se pudo cargar el mapa. Abre las indicaciones en Google Maps.";
  });
  return section;
}
