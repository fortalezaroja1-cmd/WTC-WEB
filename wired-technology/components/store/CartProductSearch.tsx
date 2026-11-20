"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Package, Plus, Search } from "lucide-react";
import type { CartItem, CartRecommendation } from "@/components/store/CartProvider";
import { formatCOP, getDiscountPricing } from "@/lib/utils";
import { trackMetaEvent } from "@/lib/meta-events";

type ProductVariant = CartRecommendation["variants"][number];

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export function CartProductSearch({ items, recommendations, addItem, onNavigate }: {
  items: CartItem[];
  recommendations: CartRecommendation[];
  addItem: (item: CartItem) => void;
  onNavigate?: () => void;
}) {
  const searchId = useId();
  const [search, setSearch] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  const matches = useMemo(() => {
    const words = normalize(search).split(/\s+/).filter(Boolean);
    return recommendations
      .filter(product => product.stock > 0 && product.price > 0)
      .filter(product => {
        if (!words.length) return true;
        const haystack = normalize([
          product.name,
          product.sku,
          ...product.variants.flatMap(variant => [variant.name, variant.sku]),
        ].join(" "));
        return words.every(word => haystack.includes(word));
      })
      .slice(0, 8);
  }, [recommendations, search]);

  const add = (product: CartRecommendation, variant: ProductVariant | null) => {
    if (product.hasVariants && !variant) return;
    const stock = variant?.stock ?? product.stock;
    const inCart = items
      .filter(item => item.productId === product.id && item.variantId === (variant?.id ?? null))
      .reduce((total, item) => total + item.qty, 0);
    if (inCart >= stock) return;
    const name = product.name + (variant ? ` · ${variant.name}` : "");
    const sku = variant?.sku ?? product.sku;
    const price = variant?.price ?? product.price;
    addItem({
      productId: product.id,
      variantId: variant?.id ?? null,
      name,
      sku,
      price,
      qty: 1,
      image: variant?.image || product.image,
      slug: product.slug,
    });
    trackMetaEvent("AddToCart", {
      content_ids: [sku],
      content_type: "product",
      content_name: name,
      value: price,
      currency: "COP",
      num_items: 1,
    });
  };

  return (
    <section className="rounded-xl border border-copper/30 bg-[#FFF9F3] p-3 sm:p-4" aria-label="Agregar productos al pedido">
      <p className="text-sm font-bold text-ink">Busca y agrega otros productos</p>
      <p className="mt-1 text-xs text-muted">Tu pedido y sus cantidades se conservan mientras buscas.</p>
      <label htmlFor={searchId} className="sr-only">Buscar producto o referencia</label>
      <div className="relative mt-3">
        <Search size={19} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
        <input
          id={searchId}
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
          const variant = product.hasVariants
            ? product.variants.find(option => option.id === selectedVariants[product.id] && option.stock > 0)
              ?? product.variants.find(option => option.stock > 0)
              ?? null
            : null;
          const unitPrice = variant?.price ?? product.price;
          const offer = getDiscountPricing(unitPrice);
          const inCart = items
            .filter(item => item.productId === product.id && item.variantId === (variant?.id ?? null))
            .reduce((total, item) => total + item.qty, 0);
          const outOfCapacity = (product.hasVariants && !variant) || inCart >= (variant?.stock ?? product.stock);
          return (
            <article key={product.id} className="flex items-start gap-2 rounded-xl border border-hair bg-white p-2.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-paper">
                {product.image
                  ? <img src={product.image} alt="" loading="lazy" className="h-full w-full object-contain" />
                  : <Package size={23} className="text-copper" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</p>
                <p className="mt-0.5 text-xs text-muted">Ref. {variant?.sku ?? product.sku}</p>
                {product.hasVariants && product.variants.length > 0 && (
                  <select
                    value={variant?.id ?? ""}
                    onChange={event => setSelectedVariants(previous => ({ ...previous, [product.id]: event.target.value }))}
                    aria-label={`Elegir presentación de ${product.name}`}
                    className="mt-2 min-h-11 w-full max-w-full rounded-lg border border-copper bg-white px-2 text-sm text-ink"
                  >
                    {product.variants.filter(option => option.stock > 0).map(option => (
                      <option key={option.id} value={option.id}>{option.name} · {formatCOP(option.price)}</option>
                    ))}
                  </select>
                )}
                <p className="mt-1 text-xs text-muted"><span className="line-through">{formatCOP(offer.original)}</span> · <span className="font-bold text-green">-30%</span></p>
                <p className="text-sm font-bold text-copper">{formatCOP(offer.current)}</p>
                <Link href={`/productos/${product.slug}`} onClick={onNavigate} className="mt-1 inline-flex min-h-8 items-center text-xs font-semibold text-copper underline">
                  Ver ficha del producto
                </Link>
              </div>
              <button type="button" disabled={outOfCapacity} onClick={() => add(product, variant)}
                className="flex min-h-11 min-w-16 shrink-0 items-center justify-center gap-1 rounded-lg bg-copper px-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={outOfCapacity ? `Cantidad máxima de ${product.name}` : `Agregar ${product.name}`}>
                {outOfCapacity ? "Máximo" : <><Plus size={15} aria-hidden="true" /> Agregar</>}
              </button>
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
