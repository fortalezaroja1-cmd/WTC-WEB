"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { formatCOP } from "@/lib/utils";

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
  const value = useContext(Ctx);
  if (!value) throw new Error("useCart fuera de CartProvider");
  return value;
}

export function CartProvider({ children }: { children: ReactNode; whatsapp: string }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("wt_cart") || "[]");
      if (Array.isArray(saved)) {
        setItems(saved.filter((item): item is CartItem =>
          item && typeof item.productId === "string" &&
          typeof item.name === "string" &&
          typeof item.qty === "number" && item.qty > 0 &&
          Number.isFinite(item.price) && item.price >= 0
        ));
      }
      const params = new URLSearchParams(window.location.search);
      const source = params.get("origen") || params.get("utm_source");
      if (source) localStorage.setItem("wt_order_origin", source.slice(0, 80));
      else if (!localStorage.getItem("wt_order_origin")) localStorage.setItem("wt_order_origin", "Web");
    } catch {
      // Si el almacenamiento está bloqueado, el carrito sigue funcionando en esta sesión.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("wt_cart", JSON.stringify(items)); } catch {}
  }, [hydrated, items]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const addItem = (item: CartItem) => {
    if (!Number.isFinite(item.qty) || item.qty < 1) return;
    setItems(previous => {
      const index = previous.findIndex(existing =>
        existing.productId === item.productId && existing.variantId === item.variantId
      );
      if (index < 0) return [...previous, item];
      return previous.map((existing, i) =>
        i === index ? { ...existing, qty: existing.qty + item.qty } : existing
      );
    });
    // No abrimos el carrito: dejamos que el cliente continúe viendo productos.
    setNotice(item.name);
  };
  const removeItem = (idx: number) => setItems(previous => previous.filter((_, i) => i !== idx));
  const updateQty = (idx: number, delta: number) => {
    setItems(previous => previous.map((item, i) => i === idx
      ? { ...item, qty: Math.max(1, item.qty + delta) }
      : item
    ));
  };
  const clearCart = () => setItems([]);

  return (
    <Ctx.Provider value={{ items, addItem, removeItem, updateQty, clearCart, open, setOpen }}>
      {children}
      {notice && (
        <div role="status" aria-live="polite" className="fixed top-[126px] sm:top-[76px] left-3 right-3 sm:left-auto sm:right-6 z-[65] sm:w-[390px] bg-white border-2 border-green rounded-2xl p-3 shadow-2xl">
          <div className="flex gap-2.5 items-start">
            <CheckCircle2 className="text-green shrink-0 mt-0.5" size={25} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-ink">¡Producto agregado!</p>
              <p className="text-sm text-slate-dark line-clamp-2 mt-0.5">{notice}</p>
            </div>
            <button type="button" onClick={() => setNotice("")} aria-label="Cerrar aviso" className="min-w-11 min-h-11 flex items-center justify-center rounded-lg"><X size={20}/></button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button type="button" onClick={() => setNotice("")} className="min-h-12 rounded-lg border border-hair font-semibold text-sm">
              Seguir comprando
            </button>
            <button type="button" onClick={() => { setNotice(""); setOpen(true); }} className="min-h-12 rounded-lg bg-copper text-white font-semibold text-sm">
              Ver mi pedido
            </button>
          </div>
        </div>
      )}
      {open && <CartDrawer />}
    </Ctx.Provider>
  );
}

function CartDrawer() {
  const { items, removeItem, updateQty, setOpen } = useCart();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-end sm:items-stretch sm:justify-end" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="cart-title"
        className="bg-white w-full h-[92dvh] sm:h-full sm:max-w-[460px] rounded-t-2xl sm:rounded-none flex flex-col overflow-hidden"
        onClick={event => event.stopPropagation()}>
        <header className="flex items-center justify-between px-4 py-4 border-b border-hair">
          <div>
            <h2 id="cart-title" className="font-display font-bold text-xl">Mi pedido</h2>
            <p className="text-sm text-muted">Revisa tus productos antes de continuar.</p>
          </div>
          <button type="button" className="min-w-12 min-h-12 rounded-lg flex items-center justify-center" aria-label="Cerrar mi pedido" onClick={() => setOpen(false)}><X size={23}/></button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {items.length === 0 && <div className="text-center py-16">
            <ShoppingCart size={44} className="mx-auto mb-4 text-copper" />
            <p className="font-semibold text-base">Todavía no has agregado productos.</p>
            <button type="button" onClick={() => setOpen(false)} className="mt-4 text-copper underline font-semibold min-h-12">Explorar productos</button>
          </div>}
          {items.map((item, index) => (
            <div key={item.productId + ":" + (item.variantId ?? "")} className="flex gap-3 py-4 border-b border-hair">
              <div className="w-16 h-16 bg-paper rounded-lg shrink-0 overflow-hidden flex items-center justify-center">
                {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain" /> : <ShoppingCart size={20} className="text-copper" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base leading-snug">{item.name}</p>
                <p className="text-xs text-muted mt-1">Referencia: {item.sku}</p>
                <p className="text-sm font-bold text-copper mt-1">{formatCOP(item.price * item.qty)}</p>
                <div className="flex gap-2 items-center mt-2">
                  <button type="button" aria-label={"Quitar una unidad de " + item.name} onClick={() => updateQty(index, -1)} className="h-11 w-11 border border-hair rounded-lg flex items-center justify-center"><Minus size={18}/></button>
                  <span className="font-bold min-w-7 text-center text-base">{item.qty}</span>
                  <button type="button" aria-label={"Agregar una unidad de " + item.name} onClick={() => updateQty(index, 1)} className="h-11 w-11 border border-hair rounded-lg flex items-center justify-center"><Plus size={18}/></button>
                  <button type="button" aria-label={"Eliminar " + item.name} onClick={() => removeItem(index)} className="h-11 w-11 ml-auto rounded-lg text-alert flex items-center justify-center"><Trash2 size={18}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <footer className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-hair bg-white">
          {items.length > 0 && <>
            <div className="flex justify-between text-base mb-1"><span>Subtotal</span><strong>{formatCOP(subtotal)}</strong></div>
            <p className="text-sm text-muted mb-3">El costo de envío se confirma por WhatsApp.</p>
            <Link href="/checkout" onClick={() => setOpen(false)}
              className="w-full min-h-14 rounded-xl bg-green text-white flex items-center justify-center text-base font-bold text-center px-4">
              Continuar mi pedido
            </Link>
            <p className="text-xs text-muted text-center mt-2">En el siguiente paso revisas tus datos y envías el pedido a WhatsApp.</p>
          </>}
          <button type="button" className="w-full min-h-12 mt-2 rounded-lg border border-hair font-semibold" onClick={() => setOpen(false)}>Seguir comprando</button>
        </footer>
      </section>
    </div>
  );
}
