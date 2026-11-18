import { catalog } from "../services/catalog.js";
import { actions } from "../services/actions.js";
import { auth } from "../services/auth.js";
import { createSavedRoutes } from "../services/saved-routes.js";
import { card, control, recordPanel } from "../components/records.js";
import { element } from "../components/dom.js";
import { coordinates, routeMap } from "../components/route-map.js";
import { placePhotos } from "../components/place-photos.js";

const saved = createSavedRoutes({ getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) });
const pendingRequests = new Map();
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const currency = (amount) => Number.isFinite(Number(amount)) && amount != null ? `Bs ${Number(amount).toLocaleString("es-BO")}` : "";
const day = (value) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" }).format(new Date(value)) : "";
const routeSummary = (route) => [currency(route.budget), route.available_minutes ? `${route.available_minutes} min disponibles` : ""].filter(Boolean).join(" · ");

export function saveLocalRoute(route) {
  saved.save(route);
}

export function renderSaved(view, navigate) {
  const panel = recordPanel(view, "Mis rutas guardadas");
  let visited = false;
  function draw() {
    panel.replaceChildren();
    const tabs = element("div", { className: "record-actions" });
    for (const [label, value] of [["Guardadas", false], ["Visitadas", true]]) {
      const button = control(label, () => { visited = value; draw(); });
      button.setAttribute("aria-pressed", String(value === visited));
      tabs.append(button);
    }
    panel.append(tabs);
    try {
      const records = saved.list().filter((route) => route.visited === visited);
      if (!records.length) panel.append(element("p", { text: visited ? "Aún no marcaste rutas como visitadas." : "Aún no tienes rutas guardadas." }));
      for (const route of records) {
        const update = (operation) => {
          try { operation(); draw(); }
          catch (error) { panel.append(element("p", { text: error.message, attrs: { role: "alert" } })); }
        };
        const remove = control("Quitar de mis rutas", () => {
          const group = remove.parentElement;
          group.replaceChildren(
            control("Confirmar eliminación", () => update(() => saved.remove(route.id))),
            control("Cancelar", draw),
          );
        });
        panel.append(card(route.name, routeSummary(route), [
          control("Ver ruta", () => navigate(uuid.test(route.id) ? `ruta-real?id=${route.id}` : route.id)),
          control(visited ? "Mover a guardadas" : "Marcar como visitada", () => update(() => saved.setVisited(route.id, !visited))),
          remove,
        ]));
      }
    } catch (error) { panel.append(element("p", { text: error.message, attrs: { role: "alert" } })); }
    panel.append(control("Buscar nuevas rutas", () => navigate("crear-ruta")));
  }
  draw();
}

async function requestPanel(view, label, ctx, draw) {
  const panel = recordPanel(view, label);
  panel.append(element("p", { text: "Cargando…", attrs: { role: "status" } }));
  try {
    await draw(panel);
  } catch (error) {
    if (!ctx.signal.aborted) panel.replaceChildren(element("p", { text: error.message, attrs: { role: "alert" } }));
  }
}

function submitAction(panel, label, fieldLabel, settings, ctx, submit) {
  const labelNode = element("label", { text: fieldLabel });
  const input = element("input", { attrs: { type: "number", ...settings } });
  labelNode.append(input);
  const status = element("p", { attrs: { role: "status" } });
  const button = control(label, async () => {
    if (!ctx.token) return ctx.requireLogin();
    if (!input.reportValidity() || !input.value) return;
    const value = input.valueAsNumber;
    const fingerprint = JSON.stringify([ctx.userId, ctx.id, label, value]);
    const storageKey = `turisteaya.pending.${fingerprint}`;
    button.disabled = true;
    input.disabled = true;
    status.textContent = "Procesando…";
    try {
      const requestKey = pendingRequests.get(fingerprint) ?? sessionStorage.getItem(storageKey) ?? crypto.randomUUID();
      sessionStorage.setItem(storageKey, requestKey);
      pendingRequests.set(fingerprint, requestKey);
      await submit(value, requestKey);
      pendingRequests.delete(fingerprint);
      try { sessionStorage.removeItem(storageKey); } catch { /* Reusing the key is safer than creating a duplicate. */ }
      status.textContent = "Operación confirmada.";
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
      input.disabled = false;
    }
  });
  panel.append(labelNode, button, status);
}

export function renderLive(page, view, ctx) {
  const options = { token: ctx.token, signal: ctx.signal };
  if (page === "mis-rutas") return renderSaved(view, ctx.navigate);
  if (page === "beneficios") return requestPanel(view, "Mis suscripciones y reservas", ctx, async (panel) => {
    const browse = control("Ver experiencias", () => ctx.navigate("experiencias"));
    if (!ctx.token || !ctx.userId) {
      panel.replaceChildren(browse, control("Iniciar sesión", ctx.requireLogin));
      return;
    }
    const [plans, subscriptions, reservations, experiences] = await Promise.all([
      catalog.all("subscription-plans", options),
      catalog.all("subscriptions", options),
      catalog.all("reservations", options),
      catalog.all("experiences", options),
    ]);
    if (ctx.signal.aborted) return;
    const ownPlans = subscriptions.filter((row) => row.user_id === ctx.userId);
    const ownReservations = reservations.filter((row) => row.user_id === ctx.userId);
    panel.replaceChildren(browse);
    panel.append(element("strong", { text: "Mis suscripciones" }));
    for (const row of ownPlans) panel.append(card(plans.find((plan) => plan.id === row.plan_id)?.name ?? "Suscripción",
      [row.status, day(row.starts_at), day(row.ends_at)].filter(Boolean).join(" · ")));
    if (!ownPlans.length) panel.append(element("p", { text: "No tienes suscripciones." }));
    panel.append(element("strong", { text: "Mis reservas" }));
    for (const row of ownReservations) panel.append(card(experiences.find((item) => item.id === row.experience_id)?.title ?? "Reserva",
      [row.status, `${row.participants} participantes`, currency(row.total)].filter(Boolean).join(" · ")));
    if (!ownReservations.length) panel.append(element("p", { text: "No tienes reservas." }));
  });
  if (page === "explorar-lugares" || page === "catalogo-rutas") {
    const isPlace = page === "explorar-lugares";
    return requestPanel(view, isPlace ? "Lugares publicados" : "Rutas públicas", ctx, async (panel) => {
      const rows = await catalog.all(isPlace ? "places" : "routes", options);
      if (ctx.signal.aborted) return;
      const visible = rows.filter((row) => isPlace ? row.published === true : row.visibility === "public" || Boolean(ctx.userId && row.user_id === ctx.userId));
      const search = element("input", { attrs: { type: "search", placeholder: "Buscar por nombre", "aria-label": "Buscar por nombre" } });
      const results = element("div", { className: "record-list" });
      let count = 20;
      function draw() {
        const query = search.value.trim().toLocaleLowerCase("es");
        const matches = visible.filter((row) => (row.name ?? "").toLocaleLowerCase("es").includes(query));
        results.replaceChildren();
        for (const row of matches.slice(0, count)) {
          const target = isPlace ? "lugar-real" : "ruta-real";
          results.append(card(row.name, isPlace ? row.address : routeSummary(row), [
            control(isPlace ? "Ver lugar" : "Ver ruta", () => ctx.navigate(`${target}?id=${encodeURIComponent(row.id)}&from=${page}`)),
          ]));
        }
        if (!matches.length) results.append(element("p", { text: "No se encontraron resultados." }));
        if (matches.length > count) results.append(control("Ver más", () => { count += 20; draw(); }));
      }
      search.addEventListener("input", () => { count = 20; draw(); });
      panel.replaceChildren(search, results);
      draw();
    });
  }
  if (page === "perfil" || page === "notificaciones") {
    return requestPanel(view, page === "perfil" ? "Mi cuenta" : "Mis notificaciones", ctx, async (panel) => {
      if (!ctx.token || !ctx.userId) {
        panel.replaceChildren(element("p", { text: "Inicia sesión para ver los datos de tu cuenta." }),
          control("Iniciar sesión", ctx.requireLogin));
        return;
      }
      if (page === "perfil") {
        const profile = await auth.profile(ctx.token, ctx.signal);
        if (ctx.signal.aborted) return;
        panel.replaceChildren(card(profile.full_name ?? "Mi cuenta", profile.email ?? ""),
          control("Mis notificaciones", () => ctx.navigate("notificaciones")),
          control("Mis rutas", () => ctx.navigate("mis-rutas")),
          control("Mis suscripciones y reservas", () => ctx.navigate("beneficios")),
          control("Mis reportes", () => ctx.navigate("ayuda")),
          control("Cerrar sesión", ctx.logout));
        return;
      }
      const notifications = await catalog.all("notifications", options);
      if (ctx.signal.aborted) return;
      const own = notifications.filter((row) => row.user_id === ctx.userId)
        .sort((left, right) => Date.parse(right.created_at) - Date.parse(left.created_at));
      panel.replaceChildren(...own.map((row) => {
        const markRead = control("Marcar como leída", async () => {
          markRead.disabled = true;
          try {
            await catalog.update("notifications", row.id, { read_at: new Date().toISOString() }, ctx.token);
            markRead.replaceWith(element("span", { text: "Leída" }));
          } catch (error) {
            markRead.disabled = false;
            if (markRead.isConnected) ctx.inform(error.message);
          }
        });
        return card(row.title ?? "Notificación", row.body ?? row.message, row.read_at ? [] : [markRead]);
      }));
      if (!own.length) panel.append(element("p", { text: "No tienes notificaciones." }));
    });
  }
  if (page === "cupones") return requestPanel(view, "Cupones", ctx, async (panel) => {
    const records = await catalog.all("promotions", options);
    if (ctx.signal.aborted) return;
    const valid = records.filter((promo) => promo.status === "active" &&
      Date.parse(promo.starts_at) <= Date.now() && Date.parse(promo.ends_at) > Date.now());
    function draw(used) {
      const tabs = element("div", { className: "record-actions" });
      const available = control("Disponibles", () => draw(false));
      const history = control("Usados", () => draw(true));
      available.setAttribute("aria-pressed", String(!used));
      history.setAttribute("aria-pressed", String(used));
      tabs.append(available, history);
      panel.replaceChildren(tabs);
      if (used) {
        if (!ctx.token) return panel.append(control("Iniciar sesión", () => ctx.navigate("iniciar-sesion")));
        const status = element("p", { text: "Cargando canjes…", attrs: { role: "status" } });
        panel.append(status);
        catalog.all("coupon-redemptions", options).then((rows) => {
          if (!status.isConnected) return;
          const own = rows.filter((row) => row.user_id === ctx.userId);
          status.textContent = own.length ? "" : "Aún no tienes cupones usados.";
          for (const row of own) panel.append(card(records.find((p) => p.id === row.promotion_id)?.title ?? "Cupón canjeado", day(row.redeemed_at ?? row.created_at)));
        }).catch((error) => { if (status.isConnected) status.textContent = error.message; });
      } else {
        if (!valid.length) panel.append(element("p", { text: "No hay promociones vigentes." }));
        for (const promo of valid) panel.append(card(promo.title, `Válido hasta ${day(promo.ends_at)}`, [
          control("Ver cupón", () => ctx.navigate(`cupon-real?id=${promo.id}`)),
        ]));
      }
    }
    draw(false);
  });
  if (page === "experiencias") return requestPanel(view, "Experiencias", ctx, async (panel) => {
    const records = await catalog.all("experiences", options);
    if (ctx.signal.aborted) return;
    const upcoming = records.filter((item) => item.published && Date.parse(item.starts_at) > Date.now());
    panel.replaceChildren(...upcoming.map((item) => card(item.title, [day(item.starts_at), currency(item.price_per_person)].filter(Boolean).join(" · "), [
      control("Ver experiencia", () => ctx.navigate(`experiencia-real?id=${item.id}`)),
    ])));
    if (!upcoming.length) panel.append(element("p", { text: "No hay próximas experiencias disponibles." }));
  });

  if (!["ruta-real", "lugar-real", "cupon-real", "experiencia-real"].includes(page)) return;
  return requestPanel(view, "Datos de TuristeaYA", ctx, async (panel) => {
    if (!uuid.test(ctx.id ?? "")) throw new Error("El enlace no contiene un ID válido.");
    if (page === "ruta-real") {
      const [route, stops] = await Promise.all([
        catalog.get("routes", ctx.id, options),
        catalog.all("route-stops", { ...options, route_id: ctx.id }),
      ]);
      if (ctx.signal.aborted) return;
      panel.replaceChildren(card(route.name, routeSummary(route), [control("Guardar ruta", () => {
        try { saved.save(route); ctx.inform("Ruta guardada en este dispositivo."); }
        catch (error) { ctx.inform(error.message); }
      })]));
      const places = await Promise.allSettled(stops.map((stop) => catalog.get("places", stop.place_id, options)));
      if (ctx.signal.aborted) return;
      const ordered = stops.map((stop, index) => ({ ...stop, place: places[index].value })).sort((a, b) => a.position - b.position);
      if (!ordered.length) panel.append(element("p", { text: "Esta ruta no tiene paradas visibles." }));
      if (ordered.length) {
        const markers = ordered.map(({ place, position }) => ({
          point: coordinates(place?.latitude, place?.longitude), label: place?.name ?? "Parada", number: position,
        }));
        const origin = coordinates(route.origin_lat, route.origin_lng);
        if (origin) markers.unshift({ point: origin, label: "Punto de partida", number: "↗" });
        panel.append(routeMap(markers, ctx.signal));
      }
      for (const stop of ordered) {
        const stopCard = card(`${stop.position}. ${stop.place?.name ?? "Parada"}`,
          [stop.place?.address, currency(stop.estimated_cost), stop.visit_minutes != null ? `${stop.visit_minutes} min de visita` : ""].filter(Boolean).join(" · "),
          stop.place ? [control("Ver lugar", () => ctx.navigate(`lugar-real?id=${stop.place_id}&route=${ctx.id}`))] : []);
        panel.append(stopCard);
        if (stop.place) catalog.all("place-media", { ...options, place_id: stop.place_id })
          .then((media) => { if (!ctx.signal.aborted) stopCard.append(placePhotos(media, stop.place.name)); })
          .catch(() => { if (!ctx.signal.aborted) stopCard.append(placePhotos([], stop.place.name)); });
      }
    } else if (page === "lugar-real") {
      const [place, reviews, pictures] = await Promise.all([
        catalog.get("places", ctx.id, options),
        catalog.all("reviews", { ...options, place_id: ctx.id }),
        catalog.all("place-media", { ...options, place_id: ctx.id }).catch(() => []),
      ]);
      if (ctx.signal.aborted) return;
      const visible = reviews.filter((review) => !review.hidden);
      const heading = card(place.name, [place.address, place.description, currency(place.estimated_cost)].filter(Boolean).join("\n"));
      const photos = placePhotos(pictures, place.name);
      const point = coordinates(place.latitude, place.longitude);
      const map = routeMap([{ point, label: place.name }], ctx.signal);
      const reviewsPanel = element("section", { className: "record-list", attrs: { "aria-label": "Reseñas" } });
      panel.replaceChildren(heading, photos, map, reviewsPanel);
      function draw(best) {
        const order = [...visible].sort((a,b) => (best ? b.rating - a.rating : 0) || Date.parse(b.created_at) - Date.parse(a.created_at));
        const filters = element("div", { className: "record-actions" });
        filters.append(control("Recientes", () => draw(false)), control("Mejor valoradas", () => draw(true)));
        reviewsPanel.replaceChildren(filters, ...order.map((review) => card(`${review.rating} / 5 · ${day(review.created_at)}`, review.body)));
        if (!visible.length) reviewsPanel.append(element("p", { text: "Todavía no hay reseñas visibles." }));
        reviewsPanel.append(control("Escribir reseña", () => {
          if (!ctx.token || !ctx.userId) return ctx.requireLogin();
          form.hidden = false;
          rating.focus();
        }), form);
      }
      const form = element("div", { className: "record-list", attrs: { hidden: "" } });
      const rating = element("input", { attrs: { type: "number", min: "1", max: "5", step: "1", value: "5", "aria-label": "Calificación de 1 a 5" } });
      const body = element("textarea", { attrs: { rows: "3", maxlength: "1000", placeholder: "Cuéntanos tu experiencia", "aria-label": "Comentario" } });
      const submit = control("Publicar reseña", async () => {
        if (!rating.reportValidity() || !rating.value || !body.value.trim()) {
          ctx.inform("Completa la calificación y el comentario.");
          return;
        }
        submit.disabled = true;
        try {
          const review = await catalog.create("reviews", { user_id: ctx.userId, place_id: ctx.id, rating: rating.valueAsNumber, body: body.value.trim() }, ctx.token);
          if (!ctx.signal.aborted) {
            if (review && !review.hidden) visible.push(review);
            body.value = "";
            form.hidden = true;
            draw(false);
            ctx.inform("Reseña publicada.");
          }
        } catch (error) { if (!ctx.signal.aborted) ctx.inform(error.message); }
        finally { submit.disabled = false; }
      });
      form.append(rating, body, submit);
      draw(false);
    } else if (page === "cupon-real") {
      const promo = await catalog.get("promotions", ctx.id, options);
      if (ctx.signal.aborted) return;
      panel.replaceChildren(card(promo.title, [promo.code, promo.conditions, `Válido hasta ${day(promo.ends_at)}`].filter(Boolean).join("\n")));
      if (promo.status === "active" && Date.parse(promo.starts_at) <= Date.now() && Date.parse(promo.ends_at) > Date.now()) {
        submitAction(panel, "Confirmar canje", "Importe de compra (Bs)", { min: "0.01", step: "0.01", required: "" }, ctx,
          (purchaseAmount, requestKey) => actions.redeem(promo.id, { purchaseAmount, requestKey }, ctx.token));
      }
    } else {
      const experience = await catalog.get("experiences", ctx.id, options);
      if (ctx.signal.aborted) return;
      panel.replaceChildren(card(experience.title, [day(experience.starts_at), currency(experience.price_per_person), experience.description].filter(Boolean).join("\n")));
      if (experience.published && Date.parse(experience.starts_at) > Date.now()) {
        submitAction(panel, "Confirmar reserva", "Participantes", { min: "1", max: String(experience.capacity), step: "1", required: "" }, ctx,
          (people, requestKey) => actions.reserve(experience.id, { people, requestKey }, ctx.token));
      }
    }
  });
}
