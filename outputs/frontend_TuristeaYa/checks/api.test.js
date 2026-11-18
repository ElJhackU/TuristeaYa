import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, createApiClient } from "../src/api/client.js";
import { endpoints } from "../src/api/endpoints.js";
import { createSessionManager } from "../src/services/session.js";

test("envía el token y los campos requeridos para reservar", async () => {
  const request = createApiClient({ fetcher: async (url, options) => {
    assert.equal(url.pathname, "/api/v1/experiences/exp-1/reserve");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.get("Authorization"), "Bearer test-token");
    assert.deepEqual(JSON.parse(options.body), { people: 2, request_key: "demo" });
    return Response.json({ id: "booking-1" });
  } });
  const result = await request(endpoints.reserve("exp-1"), {
    method: "POST", token: "test-token", body: { people: 2, request_key: "demo" },
  });
  assert.equal(result.id, "booking-1");
});

test("rechaza destinos externos antes de enviar credenciales", async () => {
  let called = false;
  const client = createApiClient({ fetcher: async () => { called = true; } });
  await assert.rejects(client('https://example.com/steal', { token: 'secret' }), /no permitido/);
  assert.equal(called, false);
});

test("limita solicitudes bloqueadas sin confundirlas con navegación cancelada", async () => {
  const fetcher = (url, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(new DOMException('Aborted', 'AbortError'));
    else signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  const client = createApiClient({ fetcher, timeoutMs: 10 });
  await assert.rejects(client('/health'), /tardó demasiado/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(client('/health', { signal: controller.signal }), (error) => error.name === 'AbortError');
});

test("renueva una sola vez ante solicitudes simultáneas y reutiliza la sesión", async () => {
  let refreshes = 0;
  const initial = { access_token: 'old', refresh_token: 'refresh', user: { id: 'u1' } };
  const session = createSessionManager({ initial, refresh: async () => {
    refreshes++;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ...initial, access_token: 'new', refresh_token: 'rotated' };
  } });
  const client = createApiClient({ session: () => session, fetcher: async (url, options) => {
    return options.headers.get('Authorization') === 'Bearer new' ? Response.json({ ok: true }) : Response.json({}, { status: 401 });
  } });
  assert.deepEqual(await Promise.all([client('/me', { token: 'old' }), client('/me', { token: 'old' })]), [{ ok: true }, { ok: true }]);
  assert.equal(refreshes, 1);
  assert.equal(session.resolve('old'), 'new');
});

test("un refresh tardío no restaura la sesión después del logout", async () => {
  let finish;
  const initial = { access_token: 'old', refresh_token: 'refresh', user: { id: 'u1' } };
  const session = createSessionManager({ initial, refresh: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = session.renew('old');
  session.set(null);
  finish({ ...initial, access_token: 'new' });
  assert.equal(await pending, null);
  assert.equal(session.get(), null);
});

test("un error temporal no elimina la sesión pero un refresh rechazado sí", async () => {
  const initial = { access_token: 'old', refresh_token: 'refresh', user: { id: 'u1' } };
  let status = 502;
  const session = createSessionManager({ initial, refresh: async () => { throw new ApiError('fail', { status }); } });
  await assert.rejects(session.renew('old'));
  assert.equal(session.get(), initial);
  status = 401;
  await assert.rejects(session.renew('old'));
  assert.equal(session.get(), null);
});

test("no renueva indefinidamente si la API vuelve a responder 401", async () => {
  let calls = 0;
  const client = createApiClient({ session: () => ({ resolve: (t) => t, renew: async () => 'new' }),
    fetcher: async () => { calls++; return Response.json({}, { status: 401 }); } });
  await assert.rejects(client('/me', { token: 'old' }), (error) => error.status === 401);
  assert.equal(calls, 2);
});

test("genera parámetros de catálogo sin valores ausentes", async () => {
  const request = createApiClient({ fetcher: async (url) => {
    assert.equal(url.pathname, "/api/v1/places");
    assert.equal(url.search, "?limit=20&offset=0");
    return Response.json([]);
  } });
  assert.deepEqual(await request(endpoints.resource("places"), { query: { limit: 20, offset: 0, category_id: null } }), []);
});

test("maneja la respuesta vacía y conserva el detalle de errores HTTP", async () => {
  const request = createApiClient({ fetcher: async () => new Response(null, { status: 204 }) });
  assert.equal(await request(endpoints.logout, { method: "POST" }), null);
  const forbidden = createApiClient({ fetcher: async () => Response.json({ detail: "Operación no autorizada." }, { status: 403 }) });
  await assert.rejects(forbidden(endpoints.profile), (error) =>
    error instanceof ApiError && error.status === 403 && error.message === "Operación no autorizada.");
});
