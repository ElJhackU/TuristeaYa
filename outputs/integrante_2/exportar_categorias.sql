-- Ejecutar después de una carga exitosa y exportar el resultado como CSV.
-- Estos son los UUID reales, incluidas las categorías que ya existían.
SELECT id, name, slug
FROM public.categories
ORDER BY name;
