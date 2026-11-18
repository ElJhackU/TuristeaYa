import { catalog } from '../services/catalog.js';
import { card, control } from '../components/records.js';
import { element } from '../components/dom.js';

export const businessForms = new Set(['editar-promocion', 'publicidad', 'verificar-negocio', 'resenas-negocio']);
const fields = {
  promotions: [['title', 'Título'], ['code', 'Código'], ['conditions', 'Condiciones'], ['discount_percent', 'Descuento (%)', 'number'], ['starts_at', 'Inicio', 'datetime-local'], ['ends_at', 'Fin', 'datetime-local'], ['max_redemptions', 'Límite total', 'number'], ['per_user_limit', 'Límite por cuenta', 'number']],
  campaigns: [['title', 'Título'], ['ad_text', 'Texto del anuncio'], ['budget', 'Presupuesto (Bs)', 'number'], ['starts_at', 'Inicio', 'datetime-local'], ['ends_at', 'Fin', 'datetime-local'], ['radius_meters', 'Radio (metros)', 'number']],
  'business-verifications': [['responsible_name', 'Nombre del responsable'], ['contact_email', 'Correo de contacto', 'email'], ['document_path', 'Ruta del documento almacenado']],
};

export async function businessEditor(page, panel, business, ctx) {
  const options = { token: ctx.token, signal: ctx.signal };
  const places = await catalog.all('places', { ...options, business_id: business.id });
  if (ctx.signal.aborted) return;
  if (page === 'resenas-negocio') {
    const reviews = await catalog.all('reviews', options);
    if (ctx.signal.aborted) return;
    const own = reviews.filter(review => places.some(place => place.id === review.place_id));
    if (!own.length) panel.append(card(business.name, 'Sin reseñas disponibles.'));
    for (const review of own) {
      const body = element('textarea', { attrs: { 'aria-label': 'Respuesta del negocio', maxlength: '4000', required: '' } });
      const status = element('p', { attrs: { role: 'status' } });
      const send = control('Publicar respuesta', async () => {
        if (!body.value.trim()) return body.reportValidity();
        send.disabled = true;
        try { await catalog.create('review-replies', { business_id: business.id, review_id: review.id, body: body.value.trim() }, ctx.token); status.textContent = 'Respuesta publicada.'; body.value = ''; }
        catch (error) { status.textContent = error.message; send.disabled = false; }
      });
      panel.append(card(`${review.rating}/5`, review.body, [body, send, status]));
    }
    return;
  }
  const entity = { 'editar-promocion': 'promotions', publicidad: 'campaigns', 'verificar-negocio': 'business-verifications' }[page];
  const row = ctx.id ? await catalog.get(entity, ctx.id, options) : null;
  if (ctx.signal.aborted || (row && row.business_id !== business.id)) return;
  const form = element('form');
  form.append(element('h3', { text: business.name }));
  const inputs = new Map();
  for (const [name, label, type = 'text'] of fields[entity]) {
    const input = element('input', { attrs: { type, required: '', 'aria-label': label, ...(type === 'number' ? { min: '1', step: 'any' } : {}) } });
    if (row?.[name] != null) {
      input.value = type === 'datetime-local' ? (() => { const d = new Date(row[name]); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); })() : row[name];
    }
    const wrapper = element('label', { text: label }); wrapper.append(input); form.append(wrapper); inputs.set(name, input);
  }
  const place = element('select', { attrs: { 'aria-label': 'Lugar del negocio', required: '' } });
  if (entity === 'promotions') {
    for (const row of places) place.append(element('option', { text: row.name, attrs: { value: row.id } }));
    if (row) place.value = row.place_id;
    form.append(place);
  }
  const status = element('p', { attrs: { role: 'status' } });
  const submit = element('button', { text: 'Guardar', attrs: { type: 'submit' } });
  form.append(submit, status);
  let busy = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true; submit.disabled = true;
    try {
      const payload = Object.fromEntries([...inputs].map(([key, input]) => [key, input.type === 'number' ? input.valueAsNumber : input.type === 'datetime-local' ? new Date(input.value).toISOString() : input.value.trim()]));
      if (payload.ends_at && payload.ends_at <= payload.starts_at) throw new Error('La fecha final debe ser posterior al inicio.');
      if (entity === 'promotions') { if (!place.value) throw new Error('El negocio necesita un lugar asociado.'); payload.place_id = place.value; }
      if (row) await catalog.update(entity, row.id, payload, ctx.token);
      else await catalog.create(entity, { ...payload, business_id: business.id, ...(entity === 'campaigns' ? { placement: 'home' } : {}) }, ctx.token);
      status.textContent = 'Guardado correctamente.';
    } catch (error) { status.textContent = error.message; busy = false; submit.disabled = false; }
  });
  panel.append(form);
}
