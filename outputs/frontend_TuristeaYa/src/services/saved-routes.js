const key = "turisteaya.web.saved-routes.v1";

export function createSavedRoutes(storage) {
  const list = () => {
    const raw = storage.getItem(key);
    if (raw === null) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data) || data.some((route) =>
      typeof route?.id !== "string" || typeof route.name !== "string" || typeof route.visited !== "boolean")) {
      throw new Error("No se pudieron leer tus rutas guardadas.");
    }
    return data;
  };
  const update = (change) => storage.setItem(key, JSON.stringify(change(list())));
  return {
    list,
    save(route) {
      update((routes) => routes.some(({ id }) => id === route.id) ? routes : [...routes, { ...route, visited: false }]);
    },
    setVisited(id, visited) {
      update((routes) => routes.map((route) => route.id === id ? { ...route, visited } : route));
    },
    remove(id) {
      update((routes) => routes.filter((route) => route.id !== id));
    },
  };
}
