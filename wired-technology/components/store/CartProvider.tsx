"use client";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { X, Plus, Minus, Trash2, ShoppingCart, MessageCircle } from "lucide-react";
import { formatCOP, waLink } from "@/lib/utils";
import { trackMetaEvent } from "@/lib/meta-events";

export interface CartItem {
  productId: string;
  variantId: string | null;
  name: string;
  sku: string;
  price: number;
  qty: number;
  image: string | null;
  slug: string;
}

interface CartCtx {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (idx: number) => void;
  updateQty: (idx: number, delta: number) => void;
  clearCart: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const Ctx = createContext<CartCtx | null>(null);
export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart fuera de CartProvider");
  return c;
}

export function CartProvider({ children, whatsapp }: { children: ReactNode; whatsapp: string }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wt_cart");
      if (saved) setItems(JSON.parse(saved));

      const params = new URLSearchParams(window.location.search);
      const source = params.get("origen") || params.get("utm_source");
      if (source) localStorage.setItem("wt_order_origin", source.slice(0, 80));
      else if (!localStorage.getItem("wt_order_origin")) localStorage.setItem("wt_order_origin", "Web");
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem("wt_cart", JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const key = item.productId + (item.variantId || "");
      const ex = prev.findIndex((i) => i.productId + (i.variantId || "") === key);
      if (ex >= 0) {
        const next = [...prev];
        next[ex] = { ...next[ex], qty: next[ex].qty + item.qty };
        return next;
      }
      return [...prev, item];
    });
    setOpen(true);
  };

  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));
  const updateQty = (idx: number, delta: number) =>
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, qty: Math.max(1, it.qty + delta) } : it)));
  const clearCart = () => setItems([]);

  return (
    <Ctx.Provider value={{ items, addItem, removeItem, updateQty, clearCart, open, setOpen }}>
      {children}
      {open && <CartDrawer whatsapp={whatsapp} />}
    </Ctx.Provider>
  );
}

function CartDrawer({ whatsapp }: { whatsapp: string }) {
  const { items, removeItem, updateQty, setOpen } = useCart();
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  const orderMessage = (() => {
    let origin = "Web";
    if (typeof window !== "undefined") {
      try {
        origin = localStorage.getItem("wt_order_origin") || "Web";
      } catch {}
    }

    const lines = [
      "Hola Wired Technology, quiero realizar este pedido:",
      "",
      ...items.flatMap((item, index) => [
        `${index + 1}. ${item.name}`,
        `SKU: ${item.sku}`,
        `Cantidad: ${item.qty}`,
        `Precio unitario: ${formatCOP(item.price)}`,
        `Subtotal: ${formatCOP(item.price * item.qty)}`,
        "",
      ]),
      `Total productos: ${formatCOP(subtotal)}`,
      "Envío: por cotizar",
      "",
      "Nombre:",
      "Ciudad:",
      "Dirección:",
      "",
      `Origen: ${origin}`,
      "",
      "¿Me confirman disponibilidad y valor del envío?",
    ];

    return lines.join("\n");
  })();

  const handleWhatsAppOrder = () => {
    trackMetaEvent("InitiateCheckout", {
      content_ids: items.map((item) => item.sku),
      content_type: "product",
      num_items: items.reduce((sum, item) => sum + item.qty, 0),
      value: subtotal,
      currency: "COP",
    });
    trackMetaEvent("Contact", {
      content_ids: items.map((item) => item.sku),
      content_type: "product",
      value: subtotal,
      currency: "COP",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setOpen(false)}>
      <div className="w-[420px] max-w-[90vw] bg-white h-full flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-hair">
          <span className="font-display font-bold text-base">Tu carrito</span>
          <button onClick={() => setOpen(false)}><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 && (
            <div className="text-center py-16 text-muted">
              <ShoppingCart size={40} className="mx-auto mb-3" strokeWidth={1.2} />
              <p>Tu carrito está vacío.</p>
            </div>
          )}
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-3 py-3 border-b border-hair">
              <div className="w-12 h-12 rounded-lg bg-paper flex items-center justify-center shrink-0 overflow-hidden">
                {it.image ? (
                  <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                ) : (
                  <ShoppingCart size={18} className="text-copper" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[13px] leading-tight truncate">{it.name}</div>
                <div className="font-mono text-[10px] text-muted mt-0.5">{it.sku}</div>
                <div className="flex items-center gap-2 mt-2">
                  <div className="flex items-center border border-hair rounded-md">
                    <button onClick={() => updateQty(idx, -1)} className="px-2 py-1"><Minus size={13} /></button>
                    <span className="font-mono text-sm min-w-[26px] text-center">{it.qty}</span>
                    <button onClick={() => updateQty(idx, 1)} className="px-2 py-1"><Plus size={13} /></button>
                  </div>
                  <button onClick={() => removeItem(idx)} className="text-alert p-1"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="font-display font-bold text-sm">{formatCOP(it.price * it.qty)}</div>
            </div>
          ))}
        </div>
        {items.length > 0 && (
          <div className="p-5 border-t border-hair">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted">Subtotal productos</span><span>{formatCOP(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted">Envío</span><span className="font-semibold text-copper">Por cotizar</span>
            </div>
            <p className="text-[10px] text-muted mt-2">WhatsApp abrirá con el pedido completo ya diligenciado.</p>

            <a
              href={waLink(whatsapp, orderMessage)}
              target="_blank"
              rel="noreferrer"
              onClick={handleWhatsAppOrder}
              className="mt-3 w-full bg-green text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <MessageCircle size={17} /> Enviar pedido por WhatsApp
            </a>

            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              className="mt-2 w-full border border-hair text-slate-dark font-semibold py-2.5 rounded-lg flex items-center justify-center text-sm hover:border-copper transition-colors"
            >
              Completar datos de entrega
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
