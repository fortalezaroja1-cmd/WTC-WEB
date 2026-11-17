"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgePercent, Check, Package } from "lucide-react";
import { formatCOP } from "@/lib/utils";

type Product = {
  id: string;
  name: string;
  sku: string;
  status: string;
  price: number | string | null;
  promoPrice: number | string | null;
  stock: number;
  images?: Array<{ url: string }>;
  variants?: Array<{ price: number | string; promoPrice?: number | string | null; stock: number; active: boolean }>;
};

const DEFAULT_TITLE = "Promoción destacada";
const DEFAULT_MESSAGE = "Conoce este producto seleccionado y agrégalo a tu pedido.";

export default function PromocionesAdmin() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState(false);
  const [productId, setProductId] = useState("");
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/products", { cache: "no-store" }).then(response => response.json()),
      fetch("/api/admin/settings", { cache: "no-store" }).then(response => response.json()),
    ]).then(([productData, settings]) => {
      setProducts(Array.isArray(productData) ? productData : []);
      setActive(settings.promotionEnabled === "true");
      setProductId(settings.promotionProductId || "");
      setTitle(settings.promotionTitle || DEFAULT_TITLE);
      setMessage(settings.promotionMessage || DEFAULT_MESSAGE);
      setStartsAt(toLocalInput(settings.promotionStartsAt));
      setEndsAt(toLocalInput(settings.promotionEndsAt));
    }).catch(() => setError("No se pudo cargar la configuración de promociones."))
      .finally(() => setLoading(false));
  }, []);

  const publishedProducts = useMemo(
    () => products.filter(product => product.status === "PUBLISHED"),
    [products]
  );
  const selected = publishedProducts.find(product => product.id === productId) ?? null;
  const selectedPrice = selected ? getProductPrice(selected) : 0;
  const selectedStock = selected ? getProductStock(selected) : 0;

  const save = async () => {
    setSaved(false);
    setError("");
    if (active && !productId) {
      setError("Selecciona el producto que quieres anunciar.");
      return;
    }
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      setError("La fecha de finalización debe ser posterior al inicio.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promotionEnabled: String(active),
          promotionProductId: productId,
          promotionTitle: title.trim() || DEFAULT_TITLE,
          promotionMessage: message.trim() || DEFAULT_MESSAGE,
          promotionStartsAt: startsAt ? new Date(startsAt).toISOString() : "",
          promotionEndsAt: endsAt ? new Date(endsAt).toISOString() : "",
        }),
      });
      if (!response.ok) throw new Error("save_failed");
      setSaved(true);
    } catch {
      setError("No se pudo guardar la promoción. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted">Cargando promociones…</p>;

  return (
    <div className="max-w-[980px]">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Promociones de entrada</h1>
        <p className="text-sm text-muted mt-1">Elige el producto que aparecerá en un anuncio cuando un cliente entre al catálogo.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
        <section className="bg-card border border-hair rounded-2xl p-5 sm:p-6 space-y-5">
          <label className="flex items-start justify-between gap-4 rounded-xl bg-paper p-4 cursor-pointer">
            <div>
              <p className="font-bold">Anuncio activo</p>
              <p className="text-xs text-muted mt-1">Al apagarlo, el catálogo deja de mostrar la ventana promocional.</p>
            </div>
            <input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} className="mt-1 h-5 w-5 accent-copper" />
          </label>

          <div>
            <label className="text-sm font-semibold block mb-1.5">Producto a promocionar</label>
            <select value={productId} onChange={event => setProductId(event.target.value)} className="w-full min-h-12 border border-hair rounded-lg px-3 bg-white focus:outline-none focus:border-copper">
              <option value="">Selecciona un producto publicado</option>
              {publishedProducts.map(product => (
                <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>
              ))}
            </select>
            {selected && selectedStock <= 0 && <p className="text-xs text-alert mt-1.5">Este producto no tiene inventario disponible y el anuncio no se mostrará.</p>}
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1.5">Título del anuncio</label>
            <input value={title} onChange={event => setTitle(event.target.value)} maxLength={80}
              className="w-full min-h-12 border border-hair rounded-lg px-3 focus:outline-none focus:border-copper" />
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1.5">Mensaje</label>
            <textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={180} rows={3}
              className="w-full border border-hair rounded-lg px-3 py-2.5 focus:outline-none focus:border-copper" />
            <p className="text-xs text-muted mt-1 text-right">{message.length}/180</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold block mb-1.5">Inicio <span className="text-muted font-normal">(opcional)</span></label>
              <input type="datetime-local" value={startsAt} onChange={event => setStartsAt(event.target.value)} className="w-full min-h-12 border border-hair rounded-lg px-3 focus:outline-none focus:border-copper" />
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1.5">Finalización <span className="text-muted font-normal">(opcional)</span></label>
              <input type="datetime-local" value={endsAt} onChange={event => setEndsAt(event.target.value)} className="w-full min-h-12 border border-hair rounded-lg px-3 focus:outline-none focus:border-copper" />
            </div>
          </div>

          {error && <p role="alert" className="rounded-lg bg-red-50 text-alert text-sm p-3">{error}</p>}
          {saved && <p role="status" className="rounded-lg bg-green-50 text-green text-sm font-semibold p-3">Promoción guardada. El catálogo ya usa esta configuración.</p>}

          <button type="button" onClick={save} disabled={saving}
            className="min-h-12 rounded-xl bg-copper text-white font-bold px-5 flex items-center justify-center gap-2 disabled:opacity-50">
            <Check size={18} /> {saving ? "Guardando…" : "Guardar promoción"}
          </button>
        </section>

        <aside className="bg-card border border-hair rounded-2xl overflow-hidden sticky top-6">
          <div className="px-4 py-3 border-b border-hair">
            <p className="font-mono text-xs tracking-wider uppercase text-muted">Vista previa</p>
          </div>
          {selected ? (
            <div>
              <div className="aspect-square bg-paper flex items-center justify-center overflow-hidden">
                {selected.images?.[0]?.url ? <img src={selected.images[0].url} alt="" className="w-full h-full object-contain p-4" /> : <Package size={52} className="text-copper" />}
              </div>
              <div className="p-4">
                <span className="inline-flex items-center gap-1 rounded-full bg-copper/10 text-copper text-xs font-bold px-2.5 py-1"><BadgePercent size={13} /> Promoción</span>
                <h2 className="font-display text-2xl font-bold mt-3">{title || DEFAULT_TITLE}</h2>
                <p className="text-sm text-muted mt-2">{message || DEFAULT_MESSAGE}</p>
                <p className="font-semibold mt-4">{selected.name}</p>
                <p className="font-display text-2xl font-bold text-copper mt-1">{formatCOP(selectedPrice)}</p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted">Selecciona un producto para ver el anuncio.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function getProductPrice(product: Product) {
  const variants = (product.variants || []).filter(variant => variant.active !== false);
  if (variants.length) return Math.min(...variants.map(variant => Number(variant.promoPrice ?? variant.price)));
  return Number(product.promoPrice ?? product.price ?? 0);
}

function getProductStock(product: Product) {
  const variants = (product.variants || []).filter(variant => variant.active !== false);
  if (variants.length) return variants.reduce((sum, variant) => sum + Math.max(0, variant.stock), 0);
  return Math.max(0, product.stock || 0);
}

function toLocalInput(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
