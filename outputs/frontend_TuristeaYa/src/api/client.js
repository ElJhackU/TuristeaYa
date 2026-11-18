import { API_ORIGIN } from "../config.js";

export class ApiError extends Error {
  constructor(message, { status, detail, cause } = {}) {
    super(message, { cause });
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

let sessionManager;
export function configureSession(manager) { sessionManager = manager; }

export function createApiClient({ origin = API_ORIGIN, fetcher = globalThis.fetch, session = () => sessionManager, timeoutMs = 45000 } = {}) {
  async function perform(path, { method = "GET", query = {}, body, token, signal, retried = false } = {}) {
    const url = new URL(path, origin);
    if (url.origin !== new URL(origin).origin) throw new ApiError("Destino de API no permitido.");
    token = session()?.resolve(token) ?? token;
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }

    const headers = new Headers({ Accept: "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (body !== undefined) headers.set("Content-Type", "application/json");

    let response;
    try {
      response = await fetcher(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
    } catch (cause) {
      if (signal?.aborted || cause.name === "AbortError") throw cause;
      throw new ApiError("No se pudo conectar con TuristeaYa.", { cause });
    }
    if (response.status === 204) return null;

    if (response.status === 401 && token && !retried) {
      const renewed = await session()?.renew(token);
      if (renewed && !signal?.aborted) return perform(path, { method, query, body, token: renewed, signal, retried: true });
    }
    const isJson = response.headers.get("content-type")?.includes("json");
    let data;
    try {
      data = isJson ? await response.json() : await response.text();
    } catch (cause) {
      if (signal?.aborted || cause.name === "AbortError") throw cause;
      throw new ApiError("No se pudo leer la respuesta de TuristeaYa.", { status: response.status, cause });
    }
    if (!response.ok) {
      const detail = data?.detail;
      const message = Array.isArray(detail) ? detail.map((item) => `${item.loc?.slice(1).join(".") || "Datos"}: ${item.msg}`).join(" · ") : detail;
      throw new ApiError(typeof message === "string" ? message : `La solicitud falló (HTTP ${response.status}).`, {
        status: response.status,
        detail,
      });
    }
    return data;
  }
  return async function request(path, options = {}) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);
    try { return await perform(path, { ...options, signal: controller.signal }); }
    catch (error) {
      if (controller.signal.aborted && !options.signal?.aborted) throw new ApiError("La conexión tardó demasiado. Intenta de nuevo.", { cause: error });
      throw error;
    } finally { clearTimeout(timer); options.signal?.removeEventListener("abort", abort); }
  };
}

export const request = createApiClient();
