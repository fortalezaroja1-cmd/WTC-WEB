"use client";
import { useState } from "react";
import { ShoppingCart, Plus, Minus, MessageCircle } from "lucide-react";
import { useCart, type CartItem } from "./CartProvider";
import { formatCOP, waLink } from "@/lib/utils";

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
  // Si no tiene variantes:
  price?: number;
  stock?: number;
  // Si tiene variantes:
  variants?: Variant[];
  whatsapp: string;
}

export function AddToCart({ productId, productName, productSku, productSlug, productImage, productUnit, price, stock, variants, whatsapp }: Props) {
  const { addItem } = useCart();
  const hasVariants = variants && variants.length > 0;
  const [selId, setSelId] = useState(hasVariants ? variants[0].id : null);
  const [qty, setQty] = useState(1);

  const sel = hasVariants ? variants.find((v) => v.id === selId) : null;
  const curPrice = sel ? sel.price : (price || 0);
  const curStock = sel ? sel.stock : (stock || 0);
  const curSku = sel ? sel.sku : productSku;
  const curImage = sel?.image || productImage;

  const handleAdd = () => {
    addItem({
      productId,
      variantId: sel?.id || null,
      name: productName + (sel ? ` · ${sel.name}` : ""),
      sku: curSku,
      price: curPrice,
      qty,
      image: curImage,
      slug: productSlug,
    });
    setQty(1);
  };

  const waMsg = `Hola, quiero cotizar: ${productName}${sel ? ` (${sel.name})` : ""} - SKU: ${curSku}`;

  return (
    <div>
      {/* Precio */}
      <div className="flex items-baseline gap-2.5 mb-1.5">
        <span className="font-display text-3xl font-bold text-copper">{formatCOP(curPrice)}</span>
        <span className="font-mono text-xs text-muted">/ {productUnit}</span>
      </div>

      {/* Stock badge */}
      <div className="mb-5">
        {curStock <= 0 ? (
          <span className="text-xs font-semibold bg-red-50 text-alert px-2.5 py-1 rounded-full">Agotado</span>
        ) : curStock <= 5 ? (
          <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">Últimas {curStock} unidades</span>
        ) : (
          <span className="text-xs font-semibold bg-green-50 text-green px-2.5 py-1 rounded-full">Disponible</span>
        )}
      </div>

      {/* Variantes */}
      {hasVariants && (
        <div className="mb-5">
          <label className="text-xs font-semibold text-slate-dark block mb-2">Selecciona variante</label>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button key={v.id} onClick={() => setSelId(v.id)} disabled={v.stock <= 0}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  selId === v.id ? "border-copper bg-[#FBF3EC]" : v.stock <= 0 ? "border-hair bg-paper text-muted cursor-not-allowed" : "border-hair hover:border-copper"
                }`}>
                <div>{v.name}</div>
                <div className="font-mono text-[10px] font-normal mt-0.5">{v.stock <= 0 ? "agotado" : formatCOP(v.price)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cantidad + botón */}
      <div className="flex gap-3 items-center mb-4">
        <div className="flex items-center border border-hair rounded-lg">
          <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="px-3 py-2.5"><Minus size={15} /></button>
          <span className="font-mono min-w-[40px] text-center font-semibold">{qty}</span>
          <button onClick={() => setQty((q) => q + 1)} className="px-3 py-2.5"><Plus size={15} /></button>
        </div>
        <button onClick={handleAdd} disabled={curStock <= 0}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition-colors ${
            curStock <= 0 ? "bg-paper text-muted cursor-not-allowed" : "bg-copper text-white hover:bg-copper-bright"
          }`}>
          <ShoppingCart size={17} /> {curStock <= 0 ? "Agotado" : "Agregar al carrito"}
        </button>
      </div>

      {/* WhatsApp */}
      <a href={waLink(whatsapp, waMsg)} target="_blank" rel="noreferrer"
        className="w-full flex items-center justify-center gap-2 border border-green text-green py-2.5 rounded-lg font-semibold text-sm hover:bg-green-50 transition-colors">
        <MessageCircle size={16} /> Cotizar por WhatsApp
      </a>
    </div>
  );
}
