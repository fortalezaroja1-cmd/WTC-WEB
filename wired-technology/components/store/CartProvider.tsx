"use client";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { X, Plus, Minus, Trash2, ShoppingCart, ChevronRight, ArrowLeft } from "lucide-react";
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
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart fuera de CartProvider");
  return c;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hidratar carrito desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wt_cart");
      if (saved) setItems(JSON.parse(saved));
    } catch {}
    setHydrated(true);
  }, []);

  // Persistir carrito
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
      {open && <CartDrawer />}
    </Ctx.Provider>
  );
}

function CartDrawer() {
  const { items, removeItem, updateQty, setOpen } = useCart();
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

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
              <span className="text-muted">Subtotal</span><span>{formatCOP(subtotal)}</span>
            </div>
            <a href="/checkout"
              className="mt-3 w-full bg-copper text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-copper-bright transition-colors">
              Continuar al checkout <ChevronRight size={16} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
