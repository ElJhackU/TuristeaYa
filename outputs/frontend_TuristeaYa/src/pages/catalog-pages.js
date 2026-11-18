import savedRoutes from "./mis-rutas.js";

const catalogTitles = {
  "ruta-real": "Detalle de la ruta",
  "lugar-real": "Detalle del lugar",
  "cupon-real": "Detalle del cupón",
  "experiencia-real": "Detalle de la experiencia",
  experiencias: "Experiencias",
  "explorar-lugares": "Explorar lugares",
  "catalogo-rutas": "Catálogo de rutas",
};

export const catalogPages = Object.fromEntries(
  Object.entries(catalogTitles).map(([slug, name]) => [slug, {
    name,
    nodes: savedRoutes.nodes
      .filter(({ y }) => y < 126 || y >= 765)
      .map((node) => node.y === 54 ? { ...node, text: name }
        : node.y === 92 ? { ...node, text: "Catálogo de TuristeaYA" } : node),
  }]),
);

export const dataScreens = new Set(["mis-rutas", "cupones", "perfil", "notificaciones", "beneficios", ...Object.keys(catalogPages)]);
