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
  const [open, setDrawerOpen] = useState(false);
  const [recentItem, setRecentItem] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("wt_cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setItems(parsed);
      }
      const params = new URLSearchParams(window.location.search);
      const source = params.get("origen") || params.get("utm_source");
      if (source) localStorage.setItem("wt_order_origin", source.slice(0, 80));
      else if (!localStorage.getItem("wt_order_origin")) localStorage.setItem("wt_order_origin", "Web");
    } catch {
      // El carrito seguirá funcionando aunque el navegador no permita guardar datos.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("wt_cart", JSON.stringify(items)); } catch {}
  }, [items, hydrated]);

  const setOpen = (value: boolean) => {
    setDrawerOpen(value);
    if (value) setRecentItem(null);
  };

  const addItem = (item: CartItem) => {
    if (item.qty < 1) return;
    setItems((previous) => {
      const key = item.productId + ":" + (item.variantId || "");
      const index = previous.findIndex((p) => p.productId + ":" + (p.variantId || "") === key);
      if (index < 0) return [...previous, item];
      return previous.map((p, i) => i === index ? { ...p, qty: p.qty + item.qty } : p);
    });
    setRecentItem(item.name);
  };

  const removeItem = (idx: number) => setItems((previous) => previous.filter((_, i) => i !== idx));
  const updateQty = (idx: number, delta: number) =>
    setItems((previous) => previous.map((item, i) =>
      i === idx ? { ...item, qty: Math.max(1, item.qty + delta) } : item
    ));
  const clearCart = () => { setItems([]); setRecentItem(null); };

  return (
    <Ctx.Provider value={{ items, addItem, removeItem, updateQty, clearCart, open, setOpen }}>
      {children}
      {recentItem && !open && (
        <div role="status" aria-live="polite" className="fixed top-[126px] sm:top-20 left-3 right-3 sm:left-auto sm:right-5 sm:w-[400px] z-[65] rounded-xl border border-green/30 bg-white p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={24} className="text-green shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-ink">¡Producto agregado!</p>
              <p className="text-sm text-slate-dark break-words">{recentItem}</p>
            </div>
            <button type="button" onClick={() => setRecentItem(null)} aria-label="Cerrar aviso" className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg"><X size={20}/></button>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button type="button" onClick={() => setRecentItem(null)} className="min-h-12 rounded-lg border border-hair text-sm font-semibold">Seguir comprando</button>
            <button type="button" onClick={() => setOpen(true)} className="min-h-12 rounded-lg bg-copper text-white text-sm font-semibold">Ver mi pedido</button>
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
  const quantity = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/60" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="Tu pedido" className="w-full sm:w-[460px] h-full bg-white flex flex-col shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-hair">
          <div>
            <h2 className="font-display font-bold text-xl">Mi pedido</h2>
            <p className="text-sm text-muted">{quantity} {quantity === 1 ? "producto" : "productos"} en el carrito</p>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar carrito" className="w-12 h-12 flex items-center justify-center rounded-lg border border-hair">
            <X size={24}/>
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-2">
          {items.length === 0 && (
            <div className="text-center py-14 text-muted">
              <ShoppingCart size={48} className="mx-auto mb-3"/>
              <p className="text-base">Tu carrito está vacío.</p>
              <button type="button" onClick={() => setOpen(false)} className="mt-4 py-3 px-5 bg-copper text-white rounded-lg font-semibold">Ver productos</button>
            </div>
          )}
          {items.map((item, idx) => (
            <article key={item.productId + ":" + (item.variantId || "")} className="flex gap-3 py-4 border-b border-hair">
              <div className="w-16 h-16 shrink-0 rounded-lg bg-paper flex items-center justify-center overflow-hidden">
                {item.image ? <img src={item.image} alt="" className="w-full h-full object-contain"/> : <ShoppingCart size={22} className="text-copper"/>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base leading-snug break-words">{item.name}</p>
                <p className="text-xs text-muted mt-1">Referencia: {item.sku}</p>
                <p className="font-bold text-copper text-base mt-1">{formatCOP(item.price * item.qty)}</p>
                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex items-center border border-hair rounded-lg">
                    <button type="button" onClick={() => updateQty(idx, -1)} aria-label={"Quitar una unidad de " + item.name} disabled={item.qty <= 1} className="w-11 h-11 flex items-center justify-center disabled:opacity-30"><Minus size={18}/></button>
                    <span className="text-base font-semibold min-w-9 text-center" aria-label={"Cantidad: " + item.qty}>{item.qty}</span>
                    <button type="button" onClick={() => updateQty(idx, 1)} aria-label={"Agregar una unidad de " + item.name} className="w-11 h-11 flex items-center justify-center"><Plus size={18}/></button>
                  </div>
                  <button type="button" onClick={() => removeItem(idx)} aria-label={"Eliminar " + item.name} className="w-11 h-11 flex items-center justify-center text-alert rounded-lg border border-hair"><Trash2 size={19}/></button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {items.length > 0 && (
          <footer className="border-t border-hair px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white">
            <div className="flex justify-between gap-2 font-semibold text-base">
              <span>Total productos</span><span>{formatCOP(subtotal)}</span>
            </div>
            <p className="text-sm text-muted mt-1">El envío se cotiza y el pedido se confirma por WhatsApp.</p>
            <Link href="/checkout" onClick={() => setOpen(false)} className="mt-4 min-h-14 w-full bg-green text-white font-bold text-base rounded-xl flex items-center justify-center gap-2">
              Armar mi pedido <span aria-hidden="true">→</span>
            </Link>
            <button type="button" onClick={() => setOpen(false)} className="mt-2 min-h-12 w-full border border-hair rounded-xl font-semibold text-sm">Seguir comprando</button>
          </footer>
        )}
      </section>
    </div>
  );
}
