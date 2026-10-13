import assert from "node:assert/strict";
import { test } from "node:test";
import { cableCatalogHref } from "../lib/storefront-navigation";

test("el botón Buscar cables usa la categoría existente, no un slug fijo", () => {
  assert.equal(cableCatalogHref([
    { name: "Iluminación", slug: "iluminacion" },
    { name: "Cables y Alambres", slug: "cables-y-alambres" },
  ]), "/categorias/cables-y-alambres");
});

test("si no existe categoría de cables, abre búsqueda de productos y evita el 404", () => {
  assert.equal(cableCatalogHref([]), "/productos?q=cable");
  assert.equal(cableCatalogHref([{ name: "Accesorios", slug: "accesorios" }]), "/productos?q=cable");
});

test("reconoce nombres alternativos como alambres o conductores", () => {
  assert.equal(cableCatalogHref([{ name: "Conductores eléctricos", slug: "cobre-y-aluminio" }]), "/categorias/cobre-y-aluminio");
  assert.equal(cableCatalogHref([{ name: "Alambres THHN", slug: "alambres-thhn" }]), "/categorias/alambres-thhn");
});
