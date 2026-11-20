"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Package, Plus, Search } from "lucide-react";
import { useCart } from "@/components/store/CartProvider";
import { formatCOP, getDiscountPricing } from "@/lib/utils";
import { trackMetaEvent } from "@/lib/meta-events";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export function CartProductSearch({ onNavigate }: { onNavigate?: () => void }) {
  const { items, addItem, recommendations } = useCart();
  const [search, setSearch] = useState("");

  const matches = useMemo(() => {
    const words = normalize(search).split(/\s+/).filter(Boolean);
    return recommendations
      .filter(product => product.stock > 0 && product.price > 0)
      .filter(product => {
        if (!words.length) return true;
        const haystack = normalize([product.name, product.sku].join(" "));
        return words.every(word => haystack.includes(word));
      })
      .slice(0, 8);
  }, [recommendations, search]);

  const add = (product: (typeof recommendations)[number]) => {
    const inCart = items.filter(item => item.productId === product.id)
      .reduce((total, item) => total + item.qty, 0);
    if (product.hasVariants || inCart >= product.stock) return;
    addItem({
      productId: product.id,
      variantId: null,
      name: product.name,
      sku: product.sku,
      price: product.price,
      qty: 1,
      image: product.image,
      slug: product.slug,
    });
    trackMetaEvent("AddToCart", {
      content_ids: [product.sku],
      content_type: "product",
      content_name: product.name,
      value: product.price,
      currency: "COP",
      num_items: 1,
    });
  };

  return (
    <section className="rounded-xl border border-copper/30 bg-[#FFF9F3] p-3 sm:p-4" aria-label="Agregar productos al pedido">
      <p className="text-sm font-bold text-ink">Busca y agrega otros productos</p>
      <p className="mt-1 text-xs text-muted">Tu pedido y sus cantidades se conservan mientras buscas.</p>
      <label htmlFor="cart-product-search" className="sr-only">Buscar producto o referencia</label>
      <div className="relative mt-3">
        <Search size={19} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id="cart-product-search"
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Nombre, calibre o referencia..."
          className="w-full min-h-12 rounded-xl border border-hair bg-white pl-10 pr-3 text-base text-ink outline-none focus:border-copper"
        />
      </div>
      <p className="mt-2 text-xs text-muted" role="status">
        {search.trim() ? `${matches.length} resultados visibles` : "Algunas referencias disponibles"}
      </p>
      <div className="mt-2 max-h-[360px] space-y-2 overflow-y-auto">
        {matches.map(product => {
          const offer = getDiscountPricing(product.price);
          const inCart = items.filter(item => item.productId === product.id)
            .reduce((total, item) => total + item.qty, 0);
          const outOfCapacity = !product.hasVariants && inCart >= product.stock;
          return (
            <article key={product.id} className="flex items-center gap-2 rounded-xl border border-hair bg-white p-2.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper">
                {product.image
                  ? <img src={product.image} alt="" loading="lazy" className="h-full w-full object-contain" />
                  : <Package size={23} className="text-copper" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</p>
                <p className="mt-0.5 text-xs text-muted">Ref. {product.sku}</p>
                <p className="mt-0.5 text-xs text-muted"><span className="line-through">{formatCOP(offer.original)}</span> · <span className="font-bold text-green">-30%</span></p>
                <p className="text-sm font-bold text-copper">{product.hasVariants ? "Desde " : ""}{formatCOP(offer.current)}</p>
              </div>
              {product.hasVariants
                ? <Link href={`/productos/${product.slug}`} onClick={onNavigate} className="flex min-h-11 min-w-16 shrink-0 items-center justify-center gap-1 rounded-lg border border-copper px-2 text-center text-xs font-bold text-copper" aria-label={`Elegir opción de ${product.name}`}>
                    Elegir <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                : <button type="button" disabled={outOfCapacity} onClick={() => add(product)} className="flex min-h-11 min-w-16 shrink-0 items-center justify-center gap-1 rounded-lg bg-copper px-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50" aria-label={outOfCapacity ? `Cantidad máxima de ${product.name}` : `Agregar ${product.name}`}>
                    {outOfCapacity ? "Máximo" : <><Plus size={15} aria-hidden="true" /> Agregar</>}
                  </button>}
            </article>
          );
        })}
        {matches.length === 0 && <p className="rounded-lg bg-white p-3 text-sm text-muted">No encontramos esa referencia. Prueba con menos palabras.</p>}
      </div>
      <Link href="/productos" onClick={onNavigate} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-copper bg-white text-sm font-bold text-copper">
        Ver el catálogo completo <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </section>
  );
}
