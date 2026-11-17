"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgePercent, ShoppingCart, X } from "lucide-react";
import { formatCOP } from "@/lib/utils";
import { useCart } from "@/components/store/CartProvider";

export interface EntryPromotion {
  id: string;
  name: string;
  sku: string;
  slug: string;
  description: string | null;
  price: number;
  originalPrice: number | null;
  image: string | null;
  hasVariants: boolean;
}

export function PromotionPopup({
  promotion,
  title,
  message,
}: {
  promotion: EntryPromotion;
  title: string;
  message: string;
}) {
  const { addItem } = useCart();
  const [open, setOpen] = useState(false);
  const storageKey = `wt_promotion_seen:${promotion.id}:${title}`;

  useEffect(() => {
    let alreadySeen = false;
    try { alreadySeen = sessionStorage.getItem(storageKey) === "1"; } catch {}
    if (alreadySeen) return;
    const timeout = window.setTimeout(() => setOpen(true), 650);
    return () => window.clearTimeout(timeout);
  }, [storageKey]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePromotion();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const closePromotion = () => {
    setOpen(false);
    try { sessionStorage.setItem(storageKey, "1"); } catch {}
  };

  const addPromotion = () => {
    addItem({
      productId: promotion.id,
      variantId: null,
      name: promotion.name,
      sku: promotion.sku,
      price: promotion.price,
      qty: 1,
      image: promotion.image,
      slug: promotion.slug,
    });
    closePromotion();
  };

  if (!open) return null;

  const hasDiscount = promotion.originalPrice !== null && promotion.originalPrice > promotion.price;
  const discount = hasDiscount
    ? Math.round((1 - promotion.price / (promotion.originalPrice as number)) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[95] bg-black/65 p-3 sm:p-6 flex items-center justify-center" onClick={closePromotion}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-promotion-title"
        className="relative w-full max-w-[780px] max-h-[92dvh] overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={event => event.stopPropagation()}
      >
        <button type="button" aria-label="Cerrar promoción" onClick={closePromotion}
          className="absolute right-3 top-3 z-10 h-12 w-12 rounded-full bg-white/95 border border-hair shadow-sm flex items-center justify-center">
          <X size={22} />
        </button>

        <div className="grid md:grid-cols-[1.05fr_.95fr]">
          <div className="min-h-[260px] md:min-h-[500px] bg-paper flex items-center justify-center overflow-hidden rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none">
            {promotion.image ? (
              <img src={promotion.image} alt={promotion.name} className="h-full w-full object-contain p-5 sm:p-8" />
            ) : (
              <ShoppingCart size={70} className="text-copper" aria-hidden="true" />
            )}
          </div>

          <div className="p-5 sm:p-8 flex flex-col justify-center">
            <div className="inline-flex self-start items-center gap-2 rounded-full bg-copper/10 text-copper px-3 py-1.5 text-xs font-bold tracking-wide uppercase">
              <BadgePercent size={15} /> Promoción
            </div>
            <h2 id="entry-promotion-title" className="font-display text-3xl sm:text-4xl font-bold text-ink mt-4 leading-tight">{title}</h2>
            <p className="text-slate-dark mt-3">{message}</p>
            <div className="mt-5 pt-5 border-t border-hair">
              <p className="font-display text-xl font-bold leading-snug">{promotion.name}</p>
              {promotion.description && <p className="text-sm text-muted line-clamp-2 mt-2">{promotion.description}</p>}
              <div className="flex items-end gap-3 mt-4">
                <div>
                  {promotion.hasVariants && <span className="block text-xs text-muted mb-1">Desde</span>}
                  <span className="font-display text-3xl font-bold text-copper">{formatCOP(promotion.price)}</span>
                </div>
                {hasDiscount && (
                  <>
                    <span className="text-sm text-muted line-through mb-1">{formatCOP(promotion.originalPrice as number)}</span>
                    <span className="rounded-full bg-green text-white text-xs font-bold px-2.5 py-1 mb-1">-{discount}%</span>
                  </>
                )}
              </div>
            </div>

            {promotion.hasVariants ? (
              <Link href={`/productos/${promotion.slug}`} onClick={closePromotion}
                className="mt-6 min-h-14 rounded-xl bg-copper text-white font-bold flex items-center justify-center text-center px-5">
                Ver opciones del producto
              </Link>
            ) : (
              <button type="button" onClick={addPromotion}
                className="mt-6 min-h-14 rounded-xl bg-copper text-white font-bold flex items-center justify-center gap-2 px-5">
                <ShoppingCart size={19} /> Agregar al pedido
              </button>
            )}
            <button type="button" onClick={closePromotion} className="min-h-12 mt-2 text-sm font-semibold text-muted underline">
              Seguir viendo el catálogo
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
