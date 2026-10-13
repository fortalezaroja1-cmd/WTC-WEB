/**
 * El acceso a cables se construye desde las categorías reales del catálogo.
 * Nunca debemos asumir que el slug de la base de datos es "cables".
 */
export function cableCatalogHref(categories: ReadonlyArray<{ name: string; slug: string }>): string {
  const category = categories.find(({ name, slug }) =>
    /\b(cables?|alambres?|conductores?)\b/i.test(`${name} ${slug.replace(/-/g, " ")}`),
  );
  return category?.slug
    ? `/categorias/${encodeURIComponent(category.slug)}`
    : "/productos?q=cable";
}
