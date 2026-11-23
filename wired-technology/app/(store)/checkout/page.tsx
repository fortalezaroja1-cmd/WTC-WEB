"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, CheckCircle2, CreditCard, Loader2,
  LockKeyhole, MessageCircle, Minus, PackageCheck, Plus,
  ShoppingCart, Store, Trash2, Truck,
} from "lucide-react";
import { useCart } from "@/components/store/CartProvider";
import { CartProductSearch } from "@/components/store/CartProductSearch";
import { IionPaymentMethods } from "@/components/store/IionPaymentMethods";
import { formatCOP, getDiscountPricing, getPublicPrice, waLink } from "@/lib/utils";
import { trackMetaEvent } from "@/lib/meta-events";

const INPUT = "min-h-12 w-full rounded-xl border border-hair bg-white px-3 py-2.5 text-base text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/20";

type FormState = {
  name: string; phone: string; email: string; city: string; barrio: string;
  address: string; reference: string; notes: string; fulfillment: "DELIVERY" | "PICKUP";
  needsInvoice: boolean; invoiceName: string; invoiceDocument: string; invoiceEmail: string;
};
type ResultState = {
  orderNumber: string; orderId: string; requestId: string; subtotal: number;
  shipping: number; total: number; paymentReady: boolean; customer: FormState;
  orderedItems: { name: string; qty: number }[];
};
const EMPTY_FORM: FormState = {
  name: "", phone: "", email: "", city: "", barrio: "", address: "",
  reference: "", notes: "", fulfillment: "DELIVERY", needsInvoice: false,
  invoiceName: "", invoiceDocument: "", invoiceEmail: "",
};

export default function CheckoutPage() {
  const { items, addItem, updateQty, removeItem, clearCart, recommendations, whatsapp } = useCart();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [requestId, setRequestId] = useState("");
  const [origin, setOrigin] = useState("Web");
  const [showProducts, setShowProducts] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultState | null>(null);
  const checkoutTracked = useRef(false);
  const subtotal = items.reduce((sum, item) => sum + getPublicPrice(item.price) * item.qty, 0);
  const originalTotal = items.reduce((sum, item) => sum + getDiscountPricing(item.price).original * item.qty, 0);
  const savings = Math.max(0, originalTotal - subtotal);
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("wt_checkout_draft") || "null");
      if (saved?.form) setForm({ ...EMPTY_FORM, ...saved.form });
      const savedResult = JSON.parse(localStorage.getItem("wt_checkout_result") || "null");
      if (savedResult?.orderId && savedResult?.requestId) setResult(savedResult);
      const existing = localStorage.getItem("wt_checkout_request_id");
      const next = existing || crypto.randomUUID();
      localStorage.setItem("wt_checkout_request_id", next);
      setRequestId(next);
      setOrigin(localStorage.getItem("wt_order_origin") || "Web");
    } catch { setRequestId(`${Date.now()}-${Math.random().toString(36).slice(2)}`); }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("wt_checkout_draft", JSON.stringify({ form })); } catch {}
  }, [form]);

  useEffect(() => {
    if (!items.length || checkoutTracked.current) return;
    if (trackMetaEvent("InitiateCheckout", {
      content_ids: items.map(item => item.sku), content_type: "product",
      num_items: itemCount, value: subtotal, currency: "COP",
    })) checkoutTracked.current = true;
  }, [items, itemCount, subtotal]);

  const valid = useMemo(() => {
    const base = form.name.trim().length >= 2 && form.phone.replace(/\D/g, "").length >= 7 && form.city.trim().length >= 2;
    const emailValid = !form.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    const addressValid = form.fulfillment === "PICKUP" || (form.barrio.trim().length >= 2 && form.address.trim().length >= 4);
    const invoiceValid = !form.needsInvoice || (
      form.invoiceName.trim().length >= 2 &&
      form.invoiceDocument.replace(/\D/g, "").length >= 5 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.invoiceEmail)
    );
    return base && emailValid && addressValid && invoiceValid;
  }, [form]);

  const openPayment = async (orderId: string, orderRequestId: string) => {
    const response = await fetch("/api/checkout-payment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, requestId: orderRequestId }),
    });
    const payment = await response.json();
    if (!response.ok) throw new Error(payment.error || "No pudimos abrir el pago.");
    if (!/^https:\/\//.test(payment.collectUrl || "")) throw new Error("El enlace de pago no es válido.");
    window.location.assign(payment.collectUrl);
  };

  const submit = async () => {
    if (!items.length) return setError("Agrega al menos un producto.");
    if (!valid) return setError(form.needsInvoice
      ? "Revisa los datos obligatorios de compra y facturación electrónica."
      : "Revisa los campos obligatorios y el correo, si lo escribiste.");
    if (!requestId) return setError("Espera un momento y vuelve a intentarlo.");
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId, origin, fulfillment: form.fulfillment, paymentChoice: "IION", customer: form,
          items: items.map(item => ({ productId: item.productId, variantId: item.variantId, qty: item.qty })),
        }),
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error || "No pudimos registrar el pedido.");
      const nextResult: ResultState = {
        orderNumber: order.orderNumber, orderId: order.orderId, requestId,
        subtotal: Number(order.subtotal || subtotal), shipping: Number(order.shipping || 0),
        total: Number(order.total || subtotal), paymentReady: order.paymentReady === true,
        customer: form, orderedItems: items.map(item => ({ name: item.name, qty: item.qty })),
      };
      setResult(nextResult);
      try {
        localStorage.setItem("wt_checkout_result", JSON.stringify(nextResult));
        localStorage.removeItem("wt_checkout_draft");
      } catch {}
      trackMetaEvent("Lead", { content_ids: items.map(item => item.sku), content_type: "product", value: subtotal, currency: "COP" });
      if (nextResult.paymentReady) await openPayment(nextResult.orderId, nextResult.requestId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pudimos completar el pedido.");
    } finally { setBusy(false); }
  };

  const update = <K extends keyof FormState>(field: K, value: FormState[K]) => setForm(current => ({ ...current, [field]: value }));
  if (!items.length && !result) return <EmptyCart />;
  if (result) return <CheckoutResult result={result} whatsapp={whatsapp} busy={busy} error={error}
    onPay={async () => { setBusy(true); setError(""); try { await openPayment(result.orderId, result.requestId); } catch (payError) { setError(payError instanceof Error ? payError.message : "No pudimos abrir el pago."); } finally { setBusy(false); } }}
    onNewOrder={() => { localStorage.removeItem("wt_checkout_result"); localStorage.removeItem("wt_checkout_request_id"); clearCart(); setResult(null); }} />;

  return (
    <main className="mx-auto max-w-[1120px] px-4 py-6 sm:px-5 sm:py-9">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/productos" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-copper"><ArrowLeft size={17} /> Seguir comprando</Link>
        <a href={waLink(whatsapp, "Hola Wired Technology, necesito ayuda para pagar mi pedido.")} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-green underline underline-offset-4">¿Necesitas ayuda?</a>
      </div>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-copper">Pago seguro</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-graphite">Finaliza tu compra</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Completa tus datos una sola vez y elige la forma de pago que te quede más fácil.</p>
      </div>
      <div className="mb-6"><IionPaymentMethods /></div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-2xl border border-hair bg-card p-4 shadow-sm sm:p-6">
          <div className="grid grid-cols-2 gap-3">
            <Choice active={form.fulfillment === "DELIVERY"} onClick={() => update("fulfillment", "DELIVERY")} icon={<Truck size={22} />} title="Envío a domicilio" note="Con tarifa de envío" />
            <Choice active={form.fulfillment === "PICKUP"} onClick={() => update("fulfillment", "PICKUP")} icon={<Store size={22} />} title="Recoger en tienda" note="Sin costo de envío" />
          </div>
          <h2 className="mt-7 font-display text-xl font-bold text-graphite">Datos para la compra</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre completo *"><input autoComplete="name" className={INPUT} value={form.name} onChange={event => update("name", event.target.value)} /></Field>
            <Field label="WhatsApp *"><input type="tel" inputMode="tel" autoComplete="tel" className={INPUT} value={form.phone} onChange={event => update("phone", event.target.value)} /></Field>
            <Field label="Correo (opcional)"><input type="email" inputMode="email" autoComplete="email" className={INPUT} value={form.email} onChange={event => update("email", event.target.value)} /></Field>
            <Field label="Ciudad *"><input autoComplete="address-level2" className={INPUT} value={form.city} onChange={event => update("city", event.target.value)} /></Field>
            {form.fulfillment === "DELIVERY" && <>
              <Field label="Barrio *"><input autoComplete="address-level3" className={INPUT} value={form.barrio} onChange={event => update("barrio", event.target.value)} /></Field>
              <Field label="Dirección *"><input autoComplete="street-address" className={INPUT} value={form.address} onChange={event => update("address", event.target.value)} /></Field>
              <div className="sm:col-span-2"><Field label="Referencia (opcional)"><input className={INPUT} value={form.reference} onChange={event => update("reference", event.target.value)} placeholder="Portería, local o indicación" /></Field></div>
            </>}
            <div className="sm:col-span-2"><Field label="Nota (opcional)"><textarea rows={2} className={INPUT} value={form.notes} onChange={event => update("notes", event.target.value)} /></Field></div>
          </div>

          <section className="mt-6 rounded-2xl border-2 border-copper/30 bg-[#FFF9F3] p-4 sm:p-5" aria-labelledby="invoice-title">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.needsInvoice}
                onChange={event => update("needsInvoice", event.target.checked)}
                className="mt-0.5 h-6 w-6 shrink-0 accent-[#B86127]"
              />
              <span>
                <strong id="invoice-title" className="block text-base text-graphite">Necesito factura electrónica</strong>
                <span className="mt-1 block text-sm leading-relaxed text-muted">Marca esta opción para registrar los datos que deben aparecer en tu factura.</span>
              </span>
            </label>
            {form.needsInvoice && (
              <div className="mt-5 grid gap-4 border-t border-copper/20 pt-5 sm:grid-cols-2">
                <div className="sm:col-span-2"><Field label="Nombre o razón social *"><input autoComplete="organization" className={INPUT} value={form.invoiceName} onChange={event => update("invoiceName", event.target.value)} /></Field></div>
                <Field label="Documento o NIT *"><input inputMode="numeric" className={INPUT} value={form.invoiceDocument} onChange={event => update("invoiceDocument", event.target.value)} placeholder="Incluye dígito de verificación si aplica" /></Field>
                <Field label="Correo para la factura *"><input type="email" inputMode="email" autoComplete="email" className={INPUT} value={form.invoiceEmail} onChange={event => update("invoiceEmail", event.target.value)} /></Field>
              </div>
            )}
          </section>
          <details className="mt-7 rounded-xl border border-hair bg-paper/60 p-4">
            <summary className="cursor-pointer font-bold text-graphite">Revisar {itemCount} {itemCount === 1 ? "producto" : "productos"}</summary>
            <div className="mt-3 divide-y divide-hair">
              {items.map((item, index) => <article key={`${item.productId}:${item.variantId || ""}`} className="flex items-center gap-2 py-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{item.name}</p><p className="text-xs text-muted">{formatCOP(getPublicPrice(item.price))} c/u · IVA incluido</p></div>
                <button type="button" aria-label={`Quitar una unidad de ${item.name}`} onClick={() => updateQty(index, -1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-hair"><Minus size={16} /></button>
                <strong className="w-5 text-center">{item.qty}</strong>
                <button type="button" aria-label={`Agregar una unidad de ${item.name}`} onClick={() => updateQty(index, 1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-hair"><Plus size={16} /></button>
                <button type="button" aria-label={`Eliminar ${item.name}`} onClick={() => removeItem(index)} className="flex h-10 w-10 items-center justify-center text-alert"><Trash2 size={17} /></button>
              </article>)}
            </div>
            <button type="button" onClick={() => setShowProducts(current => !current)} className="mt-3 inline-flex min-h-11 items-center gap-2 font-bold text-copper"><Plus size={17} /> Agregar más productos</button>
            {showProducts && <div className="mt-3"><CartProductSearch items={items} recommendations={recommendations} addItem={addItem} /></div>}
          </details>
          {error && <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-alert/25 bg-red-50 p-3 text-sm font-semibold text-alert"><AlertCircle className="shrink-0" size={19} /> {error}</div>}
        </section>

        <aside className="rounded-2xl border border-hair bg-white p-5 shadow-sm lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold text-graphite">Resumen</h2>
          <div className="mt-4 space-y-2 border-b border-hair pb-4 text-sm">
            <div className="flex justify-between text-muted"><span>Precio antes del descuento</span><span className="line-through">{formatCOP(originalTotal)}</span></div>
            <div className="flex justify-between font-bold text-green"><span>Descuento aplicado</span><span>-{formatCOP(savings)}</span></div>
            <div className="flex justify-between pt-2 text-base"><span>Productos</span><strong>{formatCOP(subtotal)}</strong></div>
            <div className="flex justify-between text-xs font-semibold text-slate-dark"><span>IVA (19%)</span><span>Incluido</span></div>
          </div>
          <div className="flex justify-between border-b border-hair py-4 text-sm"><span>Envío</span><strong className="text-copper">{form.fulfillment === "PICKUP" ? "$ 0" : "Se calcula al confirmar"}</strong></div>
          <button type="button" onClick={submit} disabled={busy || !items.length} className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-copper px-5 font-bold text-white shadow-md transition hover:bg-copper-bright disabled:opacity-60">
            {busy ? <><Loader2 className="animate-spin" size={19} /> Preparando pago…</> : <><CreditCard size={19} /> Elegir medio y pagar</>}
          </button>
          <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-xs leading-relaxed text-muted"><LockKeyhole size={14} className="mt-0.5 shrink-0" /> El valor mínimo del cobro es $5.000. Al continuar podrás escoger cómo pagar.</p>
          <p className="mt-3 text-center text-[11px] leading-relaxed text-muted">El pedido se confirma cuando Iion notifica el pago aprobado. Si falta definir el envío, primero te mostraremos el pedido registrado.</p>
        </aside>
      </div>
    </main>
  );
}

function Choice({ active, onClick, icon, title, note }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; note: string }) {
  return <button type="button" onClick={onClick} className={`min-h-24 rounded-xl border-2 p-3 text-left transition ${active ? "border-copper bg-orange-50" : "border-hair bg-white"}`}><span className="text-copper">{icon}</span><strong className="mt-2 block text-sm">{title}</strong><span className="text-xs text-muted">{note}</span></button>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm font-bold text-slate-dark">{label}<span className="mt-1.5 block">{children}</span></label>;
}
function CheckoutResult({ result, whatsapp, onPay, busy, error, onNewOrder }: { result: ResultState; whatsapp: string; onPay: () => void; busy: boolean; error: string; onNewOrder: () => void }) {
  const message = [`Hola Wired Technology, registré el pedido ${result.orderNumber}.`, `Cliente: ${result.customer.name}`, `Productos: ${result.orderedItems.map(item => `${item.qty}x ${item.name}`).join(", ")}.`, result.paymentReady ? `Total: ${formatCOP(result.total)}.` : `Productos: ${formatCOP(result.subtotal)}. Falta confirmar el envío.`].join("\n");
  return <main className="mx-auto max-w-[680px] px-4 py-10 sm:py-16"><section className="rounded-3xl border border-hair bg-white p-5 text-center shadow-lg sm:p-9">
    {result.paymentReady ? <CheckCircle2 className="mx-auto text-green" size={54} /> : <PackageCheck className="mx-auto text-copper" size={54} />}
    <h1 className="mt-4 font-display text-3xl font-bold">{result.paymentReady ? "Tu pago está listo" : "Pedido registrado"}</h1><p className="mt-2 font-mono text-sm font-bold text-muted">{result.orderNumber}</p>
    <p className="mt-3 text-sm text-muted">{result.paymentReady ? "Continúa a Iion Pay para completar la compra." : "Debemos confirmar el valor del envío antes de cobrarte. Te enviaremos el enlace de Iion Pay por WhatsApp con el total completo."}</p>
    <div className="mt-6 rounded-xl bg-paper p-4 text-left text-sm"><div className="flex justify-between"><span>Productos</span><strong>{formatCOP(result.subtotal)}</strong></div><div className="mt-2 flex justify-between"><span>Envío</span><strong>{result.paymentReady ? formatCOP(result.shipping) : "Por confirmar"}</strong></div>{result.paymentReady && <div className="mt-3 flex justify-between border-t border-hair pt-3 text-base"><span>Total</span><strong>{formatCOP(result.total)}</strong></div>}</div>
    {result.paymentReady && <button type="button" onClick={onPay} disabled={busy} className="mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-copper px-4 font-bold text-white disabled:opacity-60">{busy ? <Loader2 className="animate-spin" size={19} /> : <CreditCard size={19} />} Ir a Iion Pay</button>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-alert">{error}</p>}
    <a href={waLink(whatsapp, message)} target="_blank" rel="noopener noreferrer" className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-green px-4 font-bold text-green"><MessageCircle size={18} /> Hablar con un asesor</a>
    <button type="button" onClick={onNewOrder} className="mt-3 min-h-12 w-full text-sm font-semibold text-muted underline underline-offset-4">Hacer otro pedido</button>
  </section></main>;
}
function EmptyCart() {
  return <main className="mx-auto max-w-[600px] px-5 py-16 text-center"><ShoppingCart size={48} className="mx-auto text-copper" /><h1 className="mt-4 font-display text-2xl font-bold text-graphite">Tu carrito está vacío</h1><p className="mt-2 text-muted">Selecciona tus productos para iniciar el pago.</p><Link href="/productos" className="mt-6 inline-flex min-h-14 items-center justify-center rounded-xl bg-copper px-6 font-bold text-white">Explorar productos</Link></main>;
}
