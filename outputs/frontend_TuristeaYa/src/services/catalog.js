import { request } from "../api/client.js";
import { endpoints } from "../api/endpoints.js";

export const catalog = {
  list: (entity, { token, signal, ...query } = {}) => request(endpoints.resource(entity), { token, signal, query }),
  get: (entity, id, { token, signal } = {}) => request(endpoints.record(entity, id), { token, signal }),
  create: (entity, body, token) => request(endpoints.resource(entity), { method: "POST", body, token }),
  update: (entity, id, body, token) => request(endpoints.record(entity, id), { method: "PATCH", body, token }),
  async all(entity, options = {}) {
    const records = [];
    const seen = new Set();
    const limit = 100;
    for (let offset = 0; ; offset += limit) {
      const page = await catalog.list(entity, { ...options, limit, offset });
      if (!Array.isArray(page)) throw new Error("El catálogo devolvió una respuesta inválida.");
      let added = 0;
      for (const row of page) {
        if (row.id != null && seen.has(row.id)) continue;
        if (row.id != null) seen.add(row.id);
        records.push(row);
        added += 1;
      }
      if (page.length < limit) return records;
      if (!added) throw new Error("No se pudo avanzar en la paginación del catálogo.");
    }
  },
};
