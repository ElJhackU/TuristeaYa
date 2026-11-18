import { endpoints } from './endpoints';
import { request } from './http';
import { authenticatedRequest, session } from './session';

export type CatalogRow = { id: string; [key: string]: unknown };
export async function listRecords<T extends CatalogRow>(entity: string, options: { signal?: AbortSignal; private?: boolean; filters?: Record<string, string> } = {}): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string>();
  for (let offset = 0; ; offset += 100) {
    const query = new URLSearchParams({ ...options.filters, limit: '100', offset: String(offset) });
    const path = `${endpoints.resource(entity)}?${query}`;
    const fetcher = options.private || session.get() ? authenticatedRequest : request;
    const page = await fetcher<T[]>(path, { signal: options.signal });
    if (!Array.isArray(page)) throw new Error('La API devolvió un catálogo inválido.');
    const fresh = page.filter((row) => !seen.has(row.id));
    fresh.forEach((row) => { seen.add(row.id); rows.push(row); });
    if (page.length < 100) return rows;
    if (!fresh.length) throw new Error('No se pudo avanzar en el catálogo.');
  }
}
export const profile = () => authenticatedRequest<{ id: string; full_name: string; phone?: string }>(endpoints.profile);
