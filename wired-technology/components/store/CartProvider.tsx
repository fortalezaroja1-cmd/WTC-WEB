"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { formatCOP, getDiscountPricing, getPublicPrice } from "@/lib/utils";
import { CartProductSearch } from "@/components/store/CartProductSearch";

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

export interface CartRecommendation {
  id: string;
  categoryId: string;
  name: string;
  sku: string;
  slug: string;
  price: number;
  image: string | null;
  hasVariants: boolean;
  stock: number;
  featured: boolean;
  variants: Array<{ id: string; name: string; sku: string; price: number; stock: number; image: string | null }>;
}

interface CartCtx {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (idx: number) => void;
  updateQty: (idx: number, delta: number) => void;
  clearCart: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  recommendations: CartRecommendation[];
  whatsapp: string;
}

const Ctx = createContext<CartCtx | null>(null);
export function useCart() {
  const value = useContext(Ctx);
  if (!value) throw new Error("useCart fuera de CartProvider");
  return value;
}

export function CartProvider({
  children,
  recommendations,
  whatsapp,
}: {
  children: ReactNode;
  whatsapp: string;
  recommendations: CartRecommendation[];
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<{ name: string; productId: string } | null>(null);
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
    const timeout = window.setTimeout(() => setNotice(null), 10000);
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
    // No abrimos el carrito: mostramos venta cruzada sin sacar al cliente del catálogo.
    if (open) setNotice(null);
    else setNotice({ name: item.name, productId: item.productId });
  };
  const removeItem = (idx: number) => setItems(previous => previous.filter((_, i) => i !== idx));
  const updateQty = (idx: number, delta: number) => {
    setItems(previous => previous.map((item, i) => i === idx
      ? { ...item, qty: Math.max(1, item.qty + delta) }
      : item
    ));
  };
  const clearCart = () => setItems([]);

  const noticeRecommendations = useMemo(
    () => selectRecommendations(items, recommendations, notice?.productId ?? null, 2),
    [items, recommendations, notice]
  );

  return (
    <Ctx.Provider value={{ items, addItem, removeItem, updateQty, clearCart, open, setOpen, recommendations, whatsapp }}>
      {children}
      {notice && (
        <div role="status" aria-live="polite" className="fixed top-[126px] sm:top-[76px] left-3 right-3 sm:left-auto sm:right-6 z-[65] sm:w-[410px] max-h-[calc(100dvh-140px)] overflow-y-auto bg-white border-2 border-green rounded-2xl p-3 shadow-2xl">
          <div className="flex gap-2.5 items-start">
            <CheckCircle2 className="text-green shrink-0 mt-0.5" size={25} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-ink">¡Producto agregado!</p>
              <p className="text-sm text-slate-dark line-clamp-2 mt-0.5">{notice.name}</p>
            </div>
            <button type="button" onClick={() => setNotice(null)} aria-label="Cerrar aviso" className="min-w-11 min-h-11 flex items-center justify-center rounded-lg"><X size={20}/></button>
          </div>

          {noticeRecommendations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-hair">
              <p className="font-bold text-sm text-ink">¿Quieres agregar algo más?</p>
              <p className="text-xs text-muted mt-0.5 mb-2">Completa tu pedido antes de continuar.</p>
              <div className="space-y-2">
                {noticeRecommendations.map(product => (
                  <RecommendationCard key={product.id} product={product} compact />
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mt-3">
            <button type="button" onClick={() => setNotice(null)} className="min-h-12 rounded-lg border border-hair font-semibold text-sm">
              Seguir comprando
            </button>
            <button type="button" onClick={() => { setNotice(null); setOpen(true); }} className="min-h-12 rounded-lg bg-copper text-white font-semibold text-sm">
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
  const { items, addItem, removeItem, updateQty, setOpen, recommendations } = useCart();
  const [showProductSearch, setShowProductSearch] = useState(false);
  const subtotal = items.reduce((sum, item) => sum + getPublicPrice(item.price) * item.qty, 0);
  const originalTotal = items.reduce((sum, item) => sum + getDiscountPricing(item.price).original * item.qty, 0);
  const discountSavings = Math.max(0, originalTotal - subtotal);
  const drawerRecommendations = useMemo(
    () => selectRecommendations(items, recommendations, items.at(-1)?.productId ?? null, 3),
    [items, recommendations]
  );

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
          <div className="border-b border-hair py-3">
            <button type="button" aria-expanded={showProductSearch} onClick={() => setShowProductSearch(value => !value)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-copper bg-[#FFF9F3] px-3 text-sm font-bold text-copper">
              <Plus size={19} aria-hidden="true" /> {showProductSearch ? "Ocultar búsqueda" : "Agregar más productos al pedido"}
            </button>
            {showProductSearch && <div className="mt-3"><CartProductSearch items={items} recommendations={recommendations} addItem={addItem} onNavigate={() => setOpen(false)} /></div>}
          </div>
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
                <p className="mt-1 text-xs text-muted line-through">Antes {formatCOP(getDiscountPricing(item.price).original * item.qty)}</p>
                <p className="text-sm font-bold text-copper">Ahora {formatCOP(getPublicPrice(item.price) * item.qty)}</p>
                <p className="text-[11px] font-semibold text-slate-dark">IVA incluido</p>
                <div className="flex gap-2 items-center mt-2">
                  <button type="button" aria-label={"Quitar una unidad de " + item.name} onClick={() => updateQty(index, -1)} className="h-11 w-11 border border-hair rounded-lg flex items-center justify-center"><Minus size={18}/></button>
                  <span className="font-bold min-w-7 text-center text-base">{item.qty}</span>
                  <button type="button" aria-label={"Agregar una unidad de " + item.name} onClick={() => updateQty(index, 1)} className="h-11 w-11 border border-hair rounded-lg flex items-center justify-center"><Plus size={18}/></button>
                  <button type="button" aria-label={"Eliminar " + item.name} onClick={() => removeItem(index)} className="h-11 w-11 ml-auto rounded-lg text-alert flex items-center justify-center"><Trash2 size={18}/></button>
                </div>
              </div>
            </div>
          ))}

          {items.length > 0 && drawerRecommendations.length > 0 && (
            <section className="py-4" aria-labelledby="cart-recommendations-title">
              <h3 id="cart-recommendations-title" className="font-display font-bold text-lg">Agrega algo más a tu pedido</h3>
              <p className="text-sm text-muted mt-1 mb-3">Productos disponibles relacionados con tu compra.</p>
              <div className="space-y-2">
                {drawerRecommendations.map(product => (
                  <RecommendationCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          )}
        </div>
        <footer className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-hair bg-white">
          {items.length > 0 && <>
            <div className="flex justify-between text-sm text-muted mb-1"><span>Antes del descuento</span><span className="line-through">{formatCOP(originalTotal)}</span></div>
            <div className="flex justify-between text-sm text-green mb-2"><span>Ahorro aplicado (30%)</span><strong>-{formatCOP(discountSavings)}</strong></div>
            <div className="flex justify-between text-base mb-1"><span>Total de productos</span><strong>{formatCOP(subtotal)}</strong></div>
            <p className="text-xs font-semibold text-slate-dark mb-1">IVA (19%) incluido</p>
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

function RecommendationCard({ product, compact = false }: { product: CartRecommendation; compact?: boolean }) {
  const { addItem, setOpen } = useCart();
  const offer = getDiscountPricing(product.price);
  const addRecommendation = () => {
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
  };

  return (
    <article className={`flex items-center gap-3 rounded-xl border border-hair bg-paper/50 ${compact ? "p-2" : "p-3"}`}>
      <div className={`${compact ? "h-12 w-12" : "h-16 w-16"} shrink-0 rounded-lg bg-white overflow-hidden flex items-center justify-center`}>
        {product.image ? <img src={product.image} alt="" className="h-full w-full object-contain" /> : <ShoppingCart size={20} className="text-copper" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${compact ? "text-xs" : "text-sm"} font-semibold leading-snug line-clamp-2`}>{product.name}</p>
        <p className="mt-1 text-xs text-muted line-through">{formatCOP(offer.original)}</p>
        <p className="text-xs font-bold text-copper">{product.hasVariants ? "Desde " : ""}{formatCOP(offer.current)} <span className="text-green">(-30%)</span></p>
      </div>
      {product.hasVariants ? (
        <Link href={`/productos/${product.slug}`} onClick={() => setOpen(false)} className="min-h-11 px-3 rounded-lg border border-copper text-copper text-xs font-bold flex items-center justify-center text-center">
          Elegir opción
        </Link>
      ) : (
        <button type="button" onClick={addRecommendation} className="min-h-11 px-3 rounded-lg bg-copper text-white text-xs font-bold">
          Agregar
        </button>
      )}
    </article>
  );
}

function selectRecommendations(
  items: CartItem[],
  catalog: CartRecommendation[],
  focusProductId: string | null,
  limit: number,
) {
  const cartProductIds = new Set(items.map(item => item.productId));
  const priceByProduct = new Map(catalog.map(product => [product.id, product.price]));
  const focusItem = focusProductId
    ? items.find(item => item.productId === focusProductId)
    : items.at(-1);
  const referencePrice = focusItem?.price
    ?? (focusProductId ? priceByProduct.get(focusProductId) : undefined)
    ?? Math.max(0, ...items.map(item => item.price));

  // Una venta cruzada debe sentirse como un adicional, no como una segunda compra grande.
  // Para pedidos de alto valor usamos hasta 25 % del producto de referencia, con un techo
  // de $50.000. Para compras pequeñas conservamos un piso de $15.000 para no dejar el
  // bloque vacío y seguir ofreciendo accesorios útiles.
  const addOnBudget = Math.max(15_000, Math.min(50_000, referencePrice * 0.25));

  const isPreferredLowTicket = (product: CartRecommendation) => {
    const name = product.name.toLocaleLowerCase("es");
    return name.includes("bombillo") || name.includes("panel led") || name.includes("iluminacion");
  };

  return catalog
    .filter(product => !cartProductIds.has(product.id) && product.stock > 0 && product.price > 0)
    .sort((a, b) => {
      const budgetScore = (product: CartRecommendation) => product.price <= addOnBudget ? 0 : 1;
      const preferredScore = (product: CartRecommendation) => isPreferredLowTicket(product) ? 0 : 1;
      return budgetScore(a) - budgetScore(b)
        || preferredScore(a) - preferredScore(b)
        || a.price - b.price
        || Number(b.featured) - Number(a.featured)
        || a.name.localeCompare(b.name, "es");
    })
    .slice(0, limit);
}
