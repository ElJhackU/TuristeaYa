import { catalog } from "../services/catalog.js";
import { card, control, recordPanel } from "../components/records.js";
import { element } from "../components/dom.js";
import { adminScreens, renderAdministration } from './administration.js';
import { businessForms, businessEditor } from './business-editor.js';

export const teamScreens = new Set([...adminScreens, ...businessForms, "negocio", "datos-negocio", "promociones", "campanas", "tickets", "ticket", "ayuda", "reportar"]);

function inputField(label, { value = "", ...attrs } = {}) {
  const input = element("input", { attrs: { value, ...attrs } });
  const wrapper = element("label", { text: label });
  wrapper.append(input);
  return { input, wrapper };
}

export async function renderTeam(page, view, ctx) {
  const panel = recordPanel(view, "Datos de la cuenta");
  if (!ctx.token || !ctx.userId) {
    panel.append(element("p", { text: "Inicia sesión para consultar los datos de tu cuenta." }),
      control("Iniciar sesión", ctx.requireLogin));
    return;
  }
  const status = element("p", { text: "Cargando…", attrs: { role: "status" } });
  panel.append(status);
  const options = { token: ctx.token, signal: ctx.signal };
  try {
    if (adminScreens.has(page)) return await renderAdministration(page, panel, ctx);
    if (page === "reportar") {
      panel.replaceChildren();
      const subject = inputField("Asunto", { required: "", maxlength: "160" });
      const description = inputField("Describe el problema", { required: "", maxlength: "4000" });
      const feedback = element("p", { attrs: { role: "status" } });
      const submit = control("Enviar reporte", async () => {
        if (!subject.input.reportValidity() || !description.input.reportValidity()) return;
        submit.disabled = true;
        try {
          const ticket = await catalog.create("tickets", { user_id: ctx.userId, kind: "other", subject: subject.input.value.trim(), description: description.input.value.trim() }, ctx.token);
          if (!ctx.signal.aborted) ctx.navigate(`ticket?id=${encodeURIComponent(ticket.id)}`);
        } catch (error) { feedback.textContent = error.message; submit.disabled = false; }
      });
      panel.append(subject.wrapper, description.wrapper, submit, feedback);
      return;
    }
    if (["tickets", "ticket", "ayuda"].includes(page)) {
      const access = page === "ayuda" ? [] : await catalog.all("user-access", options);
      const staff = access.some((row) => row.user_id === ctx.userId && row.status === "active" && ["support", "admin"].includes(row.role));
      if (page === "tickets" && !staff) {
        status.textContent = "Esta vista requiere una cuenta activa de soporte.";
        return;
      }
      const tickets = (await catalog.all("tickets", options)).filter((row) => staff || row.user_id === ctx.userId);
      if (ctx.signal.aborted) return;
      panel.replaceChildren();
      if (page === "ticket") {
        const ticket = tickets.find((row) => row.id === ctx.id);
        if (!ticket) return panel.append(element("p", { text: "No se encontró el caso solicitado." }),
          control("Volver a los casos", () => ctx.navigate(staff ? "tickets" : "ayuda")));
        panel.append(card(ticket.subject ?? ticket.title ?? "Caso", ticket.description ?? ticket.body ?? ticket.status));
        if (staff) {
          const feedback = element('p', { attrs: { role: 'status' } });
          for (const [label, state] of [['Dejar pendiente', 'pending'], ['Marcar en atención', 'in_progress'], ['Resolver caso', 'resolved']]) {
            const button = control(label, async () => {
              button.disabled = true;
              try { await catalog.update('tickets', ticket.id, { status: state }, ctx.token); feedback.textContent = `Estado guardado: ${state}`; }
              catch (error) { feedback.textContent = error.message; }
              finally { button.disabled = false; }
            });
            panel.append(button);
          }
          panel.append(feedback);
        }
        const messages = await catalog.all("ticket-messages", { ...options, ticket_id: ticket.id });
        if (ctx.signal.aborted) return;
        for (const message of messages.filter((row) => row.ticket_id === ticket.id).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))) {
          panel.append(card("Mensaje del caso", message.body ?? message.message ?? message.content));
        }
        const body = inputField("Mensaje", { required: "", maxlength: "4000" });
        const feedback = element("p", { attrs: { role: "status" } });
        const send = control("Enviar mensaje", async () => {
          if (!body.input.reportValidity() || !body.input.value.trim()) return;
          send.disabled = true;
          try {
            const message = await catalog.create("ticket-messages", { ticket_id: ticket.id, sender_id: ctx.userId, body: body.input.value.trim() }, ctx.token);
            if (!ctx.signal.aborted) { panel.insertBefore(card("Mensaje enviado", message.body), body.wrapper); body.input.value = ""; feedback.textContent = "Mensaje enviado."; }
          } catch (error) { feedback.textContent = error.message; }
          finally { send.disabled = false; }
        });
        panel.append(body.wrapper, send, feedback);
        return;
      }
      if (!tickets.length) panel.append(element("p", { text: "No hay casos disponibles para esta cuenta." }));
      for (const ticket of tickets) panel.append(card(ticket.subject ?? ticket.title ?? "Caso", ticket.status, [
        control("Abrir caso", () => ctx.navigate(`ticket?id=${encodeURIComponent(ticket.id)}`)),
      ]));
      panel.append(control("Nuevo reporte", () => ctx.navigate("reportar")));
      return;
    }
    const businesses = (await catalog.all("businesses", { ...options, owner_id: ctx.userId })).filter((row) => row.owner_id === ctx.userId);
    if (ctx.signal.aborted) return;
    panel.replaceChildren();
    if (!businesses.length) return panel.append(element("p", { text: "Tu cuenta todavía no tiene negocios asociados." }));
    for (const business of businesses) {
      if (businessForms.has(page)) { await businessEditor(page, panel, business, ctx); continue; }
      if (page === "negocio" || page === "datos-negocio") {
        panel.append(card(business.name, [business.contact_email, business.phone].filter(Boolean).join(" · ")));
        if (page === "datos-negocio") {
          const fields = [inputField("Nombre", { value: business.name, required: "", maxlength: "160" }),
            inputField("Correo de contacto", { value: business.contact_email ?? "", type: "email" }),
            inputField("Teléfono", { value: business.phone ?? "", type: "tel" })];
          const feedback = element("p", { attrs: { role: "status" } });
          const save = control("Guardar información", async () => {
            if (!fields.every(({ input }) => input.reportValidity())) return;
            save.disabled = true;
            try {
              const [name, email, phone] = fields.map(({ input }) => input.value.trim());
              await catalog.update("businesses", business.id, { name, contact_email: email || null, phone: phone || null }, ctx.token);
              feedback.textContent = "Información guardada.";
            } catch (error) { feedback.textContent = error.message; }
            finally { save.disabled = false; }
          });
          panel.append(...fields.map(({ wrapper }) => wrapper), save, feedback);
        }
        continue;
      }
      const records = await catalog.all(page === "promociones" ? "promotions" : "campaigns", { ...options, business_id: business.id });
      if (ctx.signal.aborted) return;
      panel.append(card(business.name, records.length ? "" : "Sin registros disponibles."));
      for (const record of records) {
        const entity = page === 'promociones' ? 'promotions' : 'campaigns';
        const feedback = element('p', { attrs: { role: 'status' } });
        const toggle = control(record.status === 'active' ? 'Pausar' : 'Activar', async () => {
          toggle.disabled = true;
          try { const updated = await catalog.update(entity, record.id, { status: record.status === 'active' ? 'paused' : 'active' }, ctx.token); feedback.textContent = `Estado: ${updated.status}`; }
          catch (error) { feedback.textContent = error.message; toggle.disabled = false; }
        });
        panel.append(card(record.title ?? record.name ?? "Registro", record.status, [
          control('Editar', () => ctx.navigate(`${page === 'promociones' ? 'editar-promocion' : 'publicidad'}?id=${record.id}`)), toggle, feedback,
        ]));
      }
      panel.append(control(page === 'promociones' ? 'Crear promoción' : 'Crear campaña', () => ctx.navigate(page === 'promociones' ? 'editar-promocion' : 'publicidad')));
    }
    if (page === "negocio") panel.append(control("Datos del negocio", () => ctx.navigate("datos-negocio")),
      control("Promociones", () => ctx.navigate("promociones")), control("Campañas", () => ctx.navigate("campanas")),
      control('Reseñas y respuestas', () => ctx.navigate('resenas-negocio')), control('Verificar establecimiento', () => ctx.navigate('verificar-negocio')));
  } catch (error) {
    if (!ctx.signal.aborted) panel.replaceChildren(element("p", { text: error.message, attrs: { role: "alert" } }));
  }
}
