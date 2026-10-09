"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Plus, Minus, ArrowRight } from "lucide-react";
import { useCart } from "./CartProvider";
import { formatCOP } from "@/lib/utils";
import { trackMetaEvent } from "@/lib/meta-events";

interface Variant {
  id: string; name: string; sku: string; price: number; stock: number; image: string | null;
}

interface Props {
  productId: string;
  productName: string;
  productSku: string;
  productSlug: string;
  productUnit: string;
  productImage: string | null;
  price?: number;
  stock?: number;
  variants?: Variant[];
  whatsapp: string;
}

export function AddToCart({ productId, productName, productSku, productSlug, productImage, productUnit, price, stock, variants, whatsapp }: Props) {
  const { addItem } = useCart();
  const router = useRouter();
  const hasVariants = variants && variants.length > 0;
  const [selId, setSelId] = useState(hasVariants ? (variants.find(v => v.stock > 0)?.id || variants[0].id) : null);
  const [qty, setQty] = useState(1);

  const sel = hasVariants ? variants.find((v) => v.id === selId) : null;
  const curPrice = sel ? sel.price : (price || 0);
  const curStock = sel ? sel.stock : (stock || 0);
  const curSku = sel ? sel.sku : productSku;
  const curImage = sel?.image || productImage;
  const displayName = productName + (sel ? ` · ${sel.name}` : "");

  const handleAdd = () => {
    if (curStock <= 0) return;
    addItem({
      productId,
      variantId: sel?.id || null,
      name: displayName,
      sku: curSku,
      price: curPrice,
      qty,
      image: curImage,
      slug: productSlug,
    });
    trackMetaEvent("AddToCart", {
      content_ids: [curSku],
      content_type: "product",
      content_name: displayName,
      value: curPrice * qty,
      currency: "COP",
      num_items: qty,
    });
    setQty(1);
  };

  const startOrder = () => {
    if (curStock <= 0) return;
    handleAdd();
    router.push("/checkout");
  };

  return (
    <div>
      <div className="flex items-baseline gap-2.5 mb-1.5">
        <span className="font-display text-3xl font-bold text-copper">{formatCOP(curPrice)}</span>
        <span className="text-sm text-muted">/ {productUnit}</span>
      </div>

      <div className="mb-5">
        {curStock <= 0 ? (
          <span className="text-sm font-semibold bg-red-50 text-alert px-2.5 py-1 rounded-full">Agotado</span>
        ) : curStock <= 5 ? (
          <span className="text-sm font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">Últimas {curStock} unidades</span>
        ) : (
          <span className="text-sm font-semibold bg-green-50 text-green px-2.5 py-1 rounded-full">Disponible</span>
        )}
      </div>

      {hasVariants && (
        <div className="mb-5">
          <label className="text-sm font-semibold text-slate-dark block mb-2">Selecciona variante</label>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button key={v.id} onClick={() => { setSelId(v.id); setQty(1); }} disabled={v.stock <= 0}
                className={`px-4 min-h-12 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  selId === v.id ? "border-copper bg-[#FBF3EC]" : v.stock <= 0 ? "border-hair bg-paper text-muted cursor-not-allowed" : "border-hair hover:border-copper"
                }`}>
                <div>{v.name}</div>
                <div className="font-mono text-[10px] font-normal mt-0.5">{v.stock <= 0 ? "agotado" : formatCOP(v.price)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 items-center mb-4">
        <div className="flex items-center border border-hair rounded-lg">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Quitar una unidad" className="h-12 w-12 flex items-center justify-center"><Minus size={18} /></button>
          <span className="font-mono min-w-[45px] text-center text-lg font-semibold">{qty}</span>
          <button onClick={() => setQty((q) => Math.min(curStock || 1, q + 1))} aria-label="Agregar una unidad" className="h-12 w-12 flex items-center justify-center"><Plus size={18} /></button>
        </div>
        <button onClick={handleAdd} disabled={curStock <= 0}
          className={`flex-1 min-h-14 px-3 flex items-center justify-center gap-2 rounded-xl font-semibold text-base transition-colors ${
            curStock <= 0 ? "bg-paper text-muted cursor-not-allowed" : "bg-copper text-white hover:bg-copper-bright"
          }`}>
          <ShoppingCart size={17} /> {curStock <= 0 ? "Agotado" : "Agregar al carrito"}
        </button>
      </div>

      <button type="button" onClick={startOrder} disabled={curStock <= 0}
        className="w-full min-h-14 flex items-center justify-center gap-2 bg-green text-white rounded-xl font-bold text-base disabled:opacity-40">
        Comprar este producto <ArrowRight size={19} aria-hidden="true" />
      </button>
      <p className="mt-3 text-sm text-muted text-center leading-relaxed">
        No tienes que pagar todavía. Primero revisas tu pedido y después lo envías por WhatsApp para confirmar disponibilidad y entrega.
      </p>
    </div>
  );
}
