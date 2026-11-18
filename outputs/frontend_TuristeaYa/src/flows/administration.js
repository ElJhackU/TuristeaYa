import { catalog } from '../services/catalog.js';
import { card, control } from '../components/records.js';
import { element } from '../components/dom.js';

export const adminScreens = new Set(['admin', 'permisos', 'validar-comercios', 'moderar-resenas', 'seguridad']);
function selectField(label, values, current) {
  const select = element('select', { attrs: { 'aria-label': label } });
  for (const value of values) select.append(element('option', { text: value, attrs: { value } }));
  select.value = current;
  return select;
}
export async function renderAdministration(page, panel, ctx) {
  const options = { token: ctx.token, signal: ctx.signal };
  const access = await catalog.all('user-access', { ...options, user_id: ctx.userId });
  if (!access.some(row => row.user_id === ctx.userId && row.status === 'active' && row.role === 'admin')) {
    panel.replaceChildren(element('p', { text: 'Esta vista requiere una cuenta administradora activa.' }));
    return;
  }
  if (ctx.signal.aborted) return;
  panel.replaceChildren();
  if (page === 'admin') {
    for (const [label, target] of [['Usuarios y permisos', 'permisos'], ['Validar comercios', 'validar-comercios'], ['Moderar reseñas', 'moderar-resenas'], ['Seguridad y actividad', 'seguridad']]) {
      panel.append(control(label, () => ctx.navigate(target)));
    }
    return;
  }
  const entity = { permisos: 'user-access', 'validar-comercios': 'business-verifications', 'moderar-resenas': 'reviews', seguridad: 'audit-logs' }[page];
  const rows = await catalog.all(entity, options);
  const profiles = page === 'permisos' ? await catalog.all('profiles', options) : [];
  if (ctx.signal.aborted) return;
  if (!rows.length) panel.append(element('p', { text: 'No hay registros disponibles.' }));
  for (const row of rows) {
    const item = card(profiles.find(profile => profile.id === row.user_id)?.full_name || row.responsible_name || row.body || row.action || 'Cuenta sin nombre',
      [row.role, row.status, row.rating && `${row.rating}/5`, row.hidden && 'Oculta', row.review_notes, row.created_at].filter(Boolean).join(' · '));
    const feedback = element('p', { attrs: { role: 'status' } });
    const action = (label, payload) => {
      const button = control(label, async () => {
        if (!window.confirm(`${label}\nRegistro: ${row.id}`)) return;
        const buttons = [...item.querySelectorAll('button')];
        buttons.forEach(b => { b.disabled = true; });
        try {
          await catalog.update(entity, row.id, payload(), ctx.token);
          if (!ctx.signal.aborted) { feedback.textContent = 'Cambio guardado. Actualiza para revisar el resultado.'; }
        } catch (error) {
          if (!ctx.signal.aborted) { feedback.textContent = error.message; buttons.forEach(b => { b.disabled = false; }); }
        }
      });
      return button;
    };
    if (page === 'permisos' && row.user_id !== ctx.userId) {
      const role = selectField('Rol', ['tourist', 'advertiser', 'support', 'admin'], row.role);
      const status = selectField('Estado', ['active', 'suspended', 'blocked'], row.status);
      item.append(role, status, action('Guardar permisos', () => ({ role: role.value, status: status.value })));
    }
    if (page === 'validar-comercios') {
      const notes = element('textarea', { attrs: { 'aria-label': 'Notas de revisión', maxlength: '4000' } });
      item.append(element('p', { text: `Documento: ${row.document_path}` }), notes);
      for (const [label, status] of [['Aprobar verificación', 'approved'], ['Solicitar corrección', 'correction_requested']]) {
        item.append(action(label, () => ({ status, reviewer_id: ctx.userId, reviewed_at: new Date().toISOString(), review_notes: notes.value.trim() || null })));
      }
    }
    if (page === 'moderar-resenas') item.append(action(row.hidden ? 'Restaurar reseña' : 'Ocultar reseña', () => ({ hidden: !row.hidden })));
    item.append(feedback); panel.append(item);
  }
  panel.append(control('Actualizar', () => { void renderAdministration(page, panel, ctx).catch(error => { if (!ctx.signal.aborted) panel.append(element('p', { text: error.message })); }); }));
}
