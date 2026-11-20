"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, CreditCard, Loader2,
  MessageCircle, Minus, PackageCheck, Plus, RotateCcw, ShieldCheck, ShoppingCart,
  Store, Trash2, Truck,
} from "lucide-react";
import { useCart } from "@/components/store/CartProvider";
import { CartProductSearch } from "@/components/store/CartProductSearch";
import { formatCOP, getDiscountPricing, waLink } from "@/lib/utils";
import { trackMetaEvent } from "@/lib/meta-events";
import { DEMO_PAYMENT_OPTIONS, saveDemoPayment, type DemoPaymentScenario } from "@/lib/demo-payment";

const INPUT = "w-full min-h-12 rounded-xl border border-hair bg-white px-3 py-2.5 text-base text-ink outline-none transition focus:border-copper focus:ring-2 focus:ring-copper/15";
const STEPS = ["Productos", "Entrega", "Pago", "Revisión"] as const;

type FormState = {
  name: string; phone: string; city: string; barrio: string; address: string;
  reference: string; notes: string; fulfillment: "DELIVERY" | "PICKUP";
};
type PaymentChoice = "CARD_DEMO" | "WHATSAPP" | "PAY_LATER";
type ResultState = {
  orderNumber: string; orderId: string; paymentChoice: PaymentChoice;
  demoStatus?: DemoPaymentScenario; demoReference?: string; demoMessage?: string;
};

const EMPTY_FORM: FormState = {
  name: "", phone: "", city: "", barrio: "", address: "", reference: "", notes: "", fulfillment: "DELIVERY",
};

export default function CheckoutPage() {
  const { items, addItem, updateQty, removeItem, recommendations, whatsapp } = useCart();
  const [step, setStep] = useState(1);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("CARD_DEMO");
  const [demoScenario, setDemoScenario] = useState<DemoPaymentScenario>("APPROVED");
  const [requestId, setRequestId] = useState("");
  const [origin, setOrigin] = useState("Web");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ResultState | null>(null);
  const checkoutTracked = useRef(false);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const originalTotal = items.reduce((sum, item) => sum + getDiscountPricing(item.price).original * item.qty, 0);
  const savings = Math.max(0, originalTotal - subtotal);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("wt_checkout_draft") || "null");
      if (saved?.form) setForm({ ...EMPTY_FORM, ...saved.form });
      if (["CARD_DEMO", "WHATSAPP", "PAY_LATER"].includes(saved?.paymentChoice)) setPaymentChoice(saved.paymentChoice);
      if (["APPROVED", "REJECTED", "PENDING"].includes(saved?.demoScenario)) setDemoScenario(saved.demoScenario);
      const existingId = localStorage.getItem("wt_checkout_request_id");
      const nextId = existingId || crypto.randomUUID();
      localStorage.setItem("wt_checkout_request_id", nextId);
      setRequestId(nextId);
      setOrigin(localStorage.getItem("wt_order_origin") || "Web");
    } catch {
      setRequestId(`${Date.now()}-${Math.random().toString(36).slice(2)}`);
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("wt_checkout_draft", JSON.stringify({ form, paymentChoice, demoScenario })); } catch {}
  }, [form, paymentChoice, demoScenario]);

  useEffect(() => {
    if (!items.length || checkoutTracked.current) return;
    if (trackMetaEvent("InitiateCheckout", {
      content_ids: items.map(item => item.sku), content_type: "product",
      num_items: items.reduce((sum, item) => sum + item.qty, 0), value: subtotal, currency: "COP",
    })) checkoutTracked.current = true;
  }, [items, subtotal]);

  const deliveryValid = useMemo(() => {
    const base = form.name.trim().length >= 2 && form.phone.replace(/\D/g, "").length >= 7 && form.city.trim().length >= 2;
    return base && (form.fulfillment === "PICKUP" || (form.barrio.trim().length >= 2 && form.address.trim().length >= 4));
  }, [form]);

  const goNext = () => {
    setError("");
    if (step === 1 && !items.length) return setError("Agrega al menos un producto para continuar.");
    if (step === 2 && !deliveryValid) return setError("Completa los datos marcados como obligatorios.");
    setStep(current => Math.min(4, current + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submit = async () => {
    if (!deliveryValid || !items.length || !requestId) return;
    setBusy(true); setError("");
    try {
      const orderEndpoint = paymentChoice === "CARD_DEMO" ? "/api/demo-orders" : "/api/orders";
      const response = await fetch(orderEndpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId, origin, fulfillment: form.fulfillment, paymentChoice, customer: form,
          items: items.map(item => ({ productId: item.productId, variantId: item.variantId, qty: item.qty })),
        }),
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error || "No pudimos registrar la solicitud.");

      let demoResult: any = null;
      if (paymentChoice === "CARD_DEMO") {
        const demoResponse = await fetch("/api/demo-payments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: demoScenario, requestId, orderNumber: order.orderNumber, amount: order.subtotal || subtotal }),
        });
        demoResult = await demoResponse.json();
        if (!demoResponse.ok) throw new Error(demoResult.error || "La simulación no pudo completarse.");
        const option = DEMO_PAYMENT_OPTIONS.find(candidate => candidate.scenario === demoScenario)!;
        saveDemoPayment({
          id: demoResult.reference, requestId, orderNumber: order.orderNumber, scenario: demoScenario,
          status: demoResult.status, amount: order.subtotal || subtotal, createdAt: demoResult.processedAt,
          last4: option.last4, label: option.label, simulation: true,
        });
      }

      setResult({
        orderNumber: order.orderNumber, orderId: order.orderId, paymentChoice,
        demoStatus: demoResult?.status, demoReference: demoResult?.reference, demoMessage: demoResult?.message,
      });
      try {
        localStorage.removeItem("wt_checkout_request_id");
        localStorage.removeItem("wt_checkout_draft");
      } catch {}
      if (paymentChoice !== "CARD_DEMO") {
        trackMetaEvent("Lead", { content_ids: items.map(item => item.sku), content_type: "product", value: subtotal, currency: "COP" });
      }
      // Nunca se emite Purchase: la tarjeta es una demostración y la solicitud sigue pendiente.
    } catch (submitError: any) {
      setError(submitError?.message || "No pudimos completar la solicitud.");
    } finally { setBusy(false); }
  };

  if (!items.length && !result) return <EmptyCart />;
  if (result) return <CheckoutResult result={result} subtotal={subtotal} whatsapp={whatsapp} form={form} items={items} onRetry={() => { setResult(null); setStep(3); setError(""); }} />;

  return (
    <main className="mx-auto max-w-[1160px] px-4 py-6 sm:px-5 sm:py-9">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/productos" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-copper"><ArrowLeft size={17} /> Seguir comprando</Link>
        <a href={waLink(whatsapp, "Hola Wired Technology, necesito ayuda para completar mi pedido en la tienda.")} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-green px-3 text-sm font-bold text-green"><MessageCircle size={17} /> Necesito asesoría</a>
      </div>
      <div className="mb-6">
        <p className="font-mono text-xs font-bold uppercase tracking-[.16em] text-copper">Compra guiada</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-graphite">Completa tu pedido paso a paso</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">Puedes volver atrás sin perder la información. El envío y la disponibilidad se confirman antes de cualquier cobro real.</p>
      </div>
      <Progress step={step} />
      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-hair bg-card p-4 shadow-sm sm:p-6">
          {step === 1 && <ProductsStep items={items} showSearch={showProductSearch} setShowSearch={setShowProductSearch} recommendations={recommendations} addItem={addItem} updateQty={updateQty} removeItem={removeItem} />}
          {step === 2 && <DeliveryStep form={form} setForm={setForm} />}
          {step === 3 && <PaymentStep paymentChoice={paymentChoice} setPaymentChoice={setPaymentChoice} demoScenario={demoScenario} setDemoScenario={setDemoScenario} />}
          {step === 4 && <ReviewStep items={items} form={form} paymentChoice={paymentChoice} demoScenario={demoScenario} />}
          {error && <div role="alert" className="mt-5 flex gap-2 rounded-xl border border-alert/25 bg-red-50 p-3 text-sm font-semibold text-alert"><AlertCircle className="shrink-0" size={19} /> {error}</div>}
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-hair pt-5 sm:flex-row sm:justify-between">
            {step > 1 ? <button type="button" onClick={() => { setError(""); setStep(current => current - 1); }} className="min-h-13 rounded-xl border border-hair px-5 font-bold text-ink">Volver</button> : <span />}
            {step < 4 ? <button type="button" onClick={goNext} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-copper px-6 font-bold text-white shadow-sm">Continuar <ArrowRight size={19} /></button>
              : <button type="button" onClick={submit} disabled={busy} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-green px-6 font-bold text-white shadow-sm disabled:opacity-60">{busy ? <><Loader2 className="animate-spin" size={19} /> Procesando solicitud…</> : <><ShieldCheck size={19} /> Confirmar solicitud{paymentChoice === "CARD_DEMO" ? " y simular" : ""}</>}</button>}
          </div>
        </section>
        <OrderSummary subtotal={subtotal} originalTotal={originalTotal} savings={savings} count={items.reduce((sum, item) => sum + item.qty, 0)} />
      </div>
    </main>
  );
}

function Progress({ step }: { step: number }) {
  return <ol aria-label="Progreso de compra" className="grid grid-cols-4 gap-1 rounded-2xl border border-hair bg-white p-2 sm:gap-2">{STEPS.map((label, index) => {
    const number = index + 1; const complete = number < step; const active = number === step;
    return <li key={label} aria-current={active ? "step" : undefined} className={`rounded-xl px-1 py-2 text-center text-[11px] font-bold sm:px-3 sm:text-sm ${active ? "bg-graphite text-white" : complete ? "bg-green/10 text-green" : "text-muted"}`}><span className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full ${active ? "bg-white text-graphite" : complete ? "bg-green text-white" : "bg-paper"}`}>{complete ? <Check size={16} /> : number}</span>{label}</li>;
  })}</ol>;
}

function ProductsStep({ items, showSearch, setShowSearch, recommendations, addItem, updateQty, removeItem }: any) {
  return <div><h2 className="font-display text-2xl font-bold text-graphite">1. Revisa tus productos</h2><p className="mt-1 text-sm text-muted">Agrega otras referencias o ajusta cantidades antes de continuar.</p>
    <button type="button" aria-expanded={showSearch} onClick={() => setShowSearch(!showSearch)} className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl border-2 border-copper bg-orange-50 px-4 font-bold text-copper"><Plus size={19} /> {showSearch ? "Ocultar productos" : "Agregar más productos"}</button>
    {showSearch && <div className="mt-4"><CartProductSearch items={items} recommendations={recommendations} addItem={addItem} /></div>}
    <div className="mt-4 divide-y divide-hair">{items.map((item: any, index: number) => <article key={`${item.productId}:${item.variantId || ""}`} className="flex gap-3 py-4"><div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-paper">{item.image ? <img src={item.image} alt="" className="h-full w-full object-contain" /> : <ShoppingCart size={22} className="text-copper" />}</div><div className="min-w-0 flex-1"><h3 className="font-bold leading-snug">{item.name}</h3><p className="mt-1 text-xs text-muted">Referencia: {item.sku} · {formatCOP(item.price)} c/u</p><div className="mt-3 flex items-center gap-2"><button type="button" aria-label={`Quitar una unidad de ${item.name}`} onClick={() => updateQty(index, -1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-hair"><Minus size={17} /></button><span className="min-w-8 text-center font-bold">{item.qty}</span><button type="button" aria-label={`Agregar una unidad de ${item.name}`} onClick={() => updateQty(index, 1)} className="flex h-11 w-11 items-center justify-center rounded-lg border border-hair"><Plus size={17} /></button><button type="button" aria-label={`Eliminar ${item.name}`} onClick={() => removeItem(index)} className="ml-auto flex h-11 w-11 items-center justify-center text-alert"><Trash2 size={18} /></button></div></div><strong className="whitespace-nowrap text-sm text-graphite">{formatCOP(item.price * item.qty)}</strong></article>)}</div>
  </div>;
}

function DeliveryStep({ form, setForm }: { form: FormState; setForm: (value: FormState) => void }) {
  const update = (field: keyof FormState, value: string) => setForm({ ...form, [field]: value });
  return <div><h2 className="font-display text-2xl font-bold text-graphite">2. ¿Cómo recibes tu pedido?</h2><p className="mt-1 text-sm text-muted">Solicitamos solo los datos necesarios para confirmar entrega y disponibilidad.</p>
    <div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={() => update("fulfillment", "DELIVERY")} className={`min-h-24 rounded-xl border-2 p-3 text-left ${form.fulfillment === "DELIVERY" ? "border-copper bg-orange-50" : "border-hair"}`}><Truck className="mb-2 text-copper" size={22} /><strong className="block">Entrega a domicilio</strong><span className="text-xs text-muted">Envío por cotizar</span></button><button type="button" onClick={() => update("fulfillment", "PICKUP")} className={`min-h-24 rounded-xl border-2 p-3 text-left ${form.fulfillment === "PICKUP" ? "border-copper bg-orange-50" : "border-hair"}`}><Store className="mb-2 text-copper" size={22} /><strong className="block">Recoger en tienda</strong><span className="text-xs text-muted">Sujeto a confirmación</span></button></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Nombre completo *"><input autoComplete="name" className={INPUT} value={form.name} onChange={event => update("name", event.target.value)} /></Field><Field label="Teléfono o WhatsApp *"><input type="tel" inputMode="tel" autoComplete="tel" className={INPUT} value={form.phone} onChange={event => update("phone", event.target.value)} /></Field><Field label="Ciudad *"><input autoComplete="address-level2" className={INPUT} value={form.city} onChange={event => update("city", event.target.value)} /></Field>
      {form.fulfillment === "DELIVERY" && <><Field label="Barrio *"><input autoComplete="address-level3" className={INPUT} value={form.barrio} onChange={event => update("barrio", event.target.value)} /></Field><div className="sm:col-span-2"><Field label="Dirección *"><input autoComplete="street-address" className={INPUT} value={form.address} onChange={event => update("address", event.target.value)} /></Field></div><div className="sm:col-span-2"><Field label="Referencia de entrega (opcional)"><input className={INPUT} value={form.reference} onChange={event => update("reference", event.target.value)} placeholder="Ejemplo: portería, local o indicación" /></Field></div></>}
      <div className="sm:col-span-2"><Field label="Indicaciones adicionales (opcional)"><textarea rows={3} className={INPUT} value={form.notes} onChange={event => update("notes", event.target.value)} /></Field></div></div>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-bold text-slate-dark">{label}<span className="mt-1.5 block">{children}</span></label>; }

function PaymentStep({ paymentChoice, setPaymentChoice, demoScenario, setDemoScenario }: { paymentChoice: PaymentChoice; setPaymentChoice: (choice: PaymentChoice) => void; demoScenario: DemoPaymentScenario; setDemoScenario: (scenario: DemoPaymentScenario) => void }) {
  return <div><h2 className="font-display text-2xl font-bold text-graphite">3. Elige cómo continuar</h2><p className="mt-1 text-sm text-muted">La opción de tarjeta es una demostración: no solicita datos bancarios ni efectúa cobros.</p>
    <div className="mt-5 space-y-3"><PaymentOption active={paymentChoice === "CARD_DEMO"} onClick={() => setPaymentChoice("CARD_DEMO")} icon={<CreditCard />} title="Probar pago con tarjeta" text="Simulación completa y segura, sin dinero real." badge="DEMO" /><PaymentOption active={paymentChoice === "WHATSAPP"} onClick={() => setPaymentChoice("WHATSAPP")} icon={<MessageCircle />} title="Confirmar con un asesor" text="Wired confirma inventario, envío y método de pago por WhatsApp." /><PaymentOption active={paymentChoice === "PAY_LATER"} onClick={() => setPaymentChoice("PAY_LATER")} icon={<PackageCheck />} title="Solicitar pago al recibir" text="Disponible solo cuando la ciudad y la transportadora lo permitan." /></div>
    {paymentChoice === "CARD_DEMO" && <section className="mt-5 rounded-2xl border-2 border-dashed border-copper/40 bg-orange-50 p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-copper" /><div><h3 className="font-bold text-graphite">Entorno de demostración</h3><p className="mt-1 text-sm text-muted">Selecciona un resultado predefinido. No escribas números de tarjetas reales.</p></div></div><div className="mt-4 space-y-2">{DEMO_PAYMENT_OPTIONS.map(option => <button key={option.scenario} type="button" onClick={() => setDemoScenario(option.scenario)} className={`w-full rounded-xl border p-3 text-left ${demoScenario === option.scenario ? "border-copper bg-white ring-2 ring-copper/10" : "border-hair bg-white/60"}`}><div className="flex items-center justify-between gap-3"><strong className="text-sm">{option.label}</strong><span className="font-mono text-xs text-muted">•••• {option.last4}</span></div><p className="mt-1 text-xs text-muted">{option.description}</p></button>)}</div></section>}
  </div>;
}

function PaymentOption({ active, onClick, icon, title, text, badge }: any) {
  return <button type="button" onClick={onClick} className={`flex min-h-20 w-full items-center gap-3 rounded-xl border-2 p-3 text-left ${active ? "border-copper bg-orange-50" : "border-hair bg-white"}`}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${active ? "bg-copper text-white" : "bg-paper text-graphite"}`}>{icon}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 font-bold">{title}{badge && <span className="rounded-full bg-alert px-2 py-0.5 text-[10px] text-white">{badge}</span>}</span><span className="mt-1 block text-xs text-muted">{text}</span></span>{active && <CheckCircle2 className="shrink-0 text-green" size={21} />}</button>;
}

function ReviewStep({ items, form, paymentChoice, demoScenario }: { items: any[]; form: FormState; paymentChoice: PaymentChoice; demoScenario: DemoPaymentScenario }) {
  const payment = paymentChoice === "CARD_DEMO" ? `Tarjeta de prueba — ${demoScenario.toLowerCase()}` : paymentChoice === "PAY_LATER" ? "Pago al recibir — por confirmar" : "Confirmación con asesor";
  return <div><h2 className="font-display text-2xl font-bold text-graphite">4. Revisa antes de confirmar</h2><p className="mt-1 text-sm text-muted">Todavía puedes volver y corregir cualquier dato.</p><div className="mt-5 space-y-4"><ReviewBlock title="Productos">{items.map(item => <div key={`${item.productId}:${item.variantId || ""}`} className="flex justify-between gap-4 py-1 text-sm"><span>{item.qty} × {item.name}</span><strong>{formatCOP(item.price * item.qty)}</strong></div>)}</ReviewBlock><ReviewBlock title="Entrega"><p className="text-sm"><strong>{form.name}</strong> · {form.phone}</p><p className="mt-1 text-sm text-muted">{form.fulfillment === "PICKUP" ? `Recoger en tienda · ${form.city}` : `${form.address}, ${form.barrio}, ${form.city}`}</p><p className="mt-2 text-xs font-semibold text-copper">El valor y la fecha de entrega están pendientes de confirmación.</p></ReviewBlock><ReviewBlock title="Método seleccionado"><p className="text-sm font-bold">{payment}</p>{paymentChoice === "CARD_DEMO" && <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs font-bold text-alert">SIMULACIÓN: no se realizará ningún cobro ni se marcará el pedido como pagado.</p>}</ReviewBlock></div></div>;
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-xl border border-hair bg-paper/60 p-4"><h3 className="mb-2 font-bold text-graphite">{title}</h3>{children}</section>; }

function OrderSummary({ subtotal, originalTotal, savings, count }: { subtotal: number; originalTotal: number; savings: number; count: number }) {
  return <aside className="rounded-2xl border border-hair bg-white p-5 shadow-sm lg:sticky lg:top-24"><h2 className="font-display text-lg font-bold text-graphite">Resumen del pedido</h2><div className="mt-4 space-y-2 border-b border-hair pb-4 text-sm"><div className="flex justify-between text-muted"><span>{count} unidades</span><span className="line-through">{formatCOP(originalTotal)}</span></div><div className="flex justify-between font-bold text-green"><span>Ahorro aplicado (30 %)</span><span>-{formatCOP(savings)}</span></div><div className="flex justify-between pt-2 text-base"><span>Productos</span><strong>{formatCOP(subtotal)}</strong></div></div><div className="flex justify-between py-4 text-sm"><span>Envío</span><strong className="text-copper">Por cotizar</strong></div><div className="rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-slate-dark"><ShieldCheck className="mb-1 text-blue" size={18} />El total no incluye un envío inventado. Wired confirmará disponibilidad y costos conocidos antes de un pago real.</div></aside>;
}

function CheckoutResult({ result, subtotal, whatsapp, form, items, onRetry }: any) {
  const isDemo = result.paymentChoice === "CARD_DEMO"; const approved = result.demoStatus === "APPROVED"; const rejected = result.demoStatus === "REJECTED";
  const message = [`Hola Wired Technology, registré la solicitud ${result.orderNumber}.`, `Cliente: ${form.name}`, `Productos: ${items.map((item: any) => `${item.qty}x ${item.name}`).join(", ")}`, `Total de productos: ${formatCOP(subtotal)}. Envío pendiente de cotización.`, isDemo ? `Tarjeta: SIMULACIÓN ${result.demoStatus}. No se realizó ningún cobro.` : "Método de pago pendiente de confirmación."].join("\n");
  return <main className="mx-auto max-w-[720px] px-4 py-10 sm:py-16"><section className="overflow-hidden rounded-3xl border border-hair bg-white shadow-lg">{isDemo && <div className="bg-alert px-4 py-2 text-center text-xs font-black uppercase tracking-[.18em] text-white">Comprobante de simulación — sin cobro real</div>}<div className="p-5 text-center sm:p-9"><span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${isDemo && !approved ? "bg-orange-100 text-copper" : "bg-green/10 text-green"}`}>{rejected ? <AlertCircle size={34} /> : approved ? <CheckCircle2 size={34} /> : <PackageCheck size={34} />}</span><h1 className="mt-5 font-display text-3xl font-bold text-graphite">{isDemo ? (approved ? "Simulación aprobada" : rejected ? "Simulación rechazada" : "Simulación pendiente") : "Solicitud registrada"}</h1><p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">{isDemo ? result.demoMessage : "Wired revisará inventario, entrega y forma de pago antes de confirmar el pedido."}</p><div className="mx-auto mt-6 max-w-md rounded-2xl border border-hair bg-paper p-4 text-left text-sm"><div className="flex justify-between gap-4 py-1"><span className="text-muted">Solicitud</span><strong>{result.orderNumber}</strong></div>{result.demoReference && <div className="flex justify-between gap-4 py-1"><span className="text-muted">Referencia demo</span><strong className="break-all text-right font-mono text-xs">{result.demoReference}</strong></div>}<div className="flex justify-between gap-4 py-1"><span className="text-muted">Productos</span><strong>{formatCOP(subtotal)}</strong></div><div className="flex justify-between gap-4 py-1"><span className="text-muted">Envío</span><strong className="text-copper">Pendiente</strong></div><div className="mt-2 rounded-lg bg-white p-2 text-center text-xs font-bold text-alert">Estado real del pago: PENDIENTE</div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><a href={waLink(whatsapp, message)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-green px-4 font-bold text-white"><MessageCircle size={19} /> Enviar a WhatsApp</a>{isDemo && !approved ? <button type="button" onClick={onRetry} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl border border-copper px-4 font-bold text-copper"><RotateCcw size={18} /> Intentar nuevamente</button> : <Link href="/productos" className="inline-flex min-h-14 items-center justify-center rounded-xl border border-hair px-4 font-bold text-ink">Seguir comprando</Link>}</div><p className="mt-5 text-xs text-muted">La simulación no activa inventario, facturación, despacho ni notificaciones de pago real.</p></div></section></main>;
}

function EmptyCart() { return <main className="mx-auto max-w-[600px] px-5 py-16 text-center"><ShoppingCart size={48} className="mx-auto text-copper" /><h1 className="mt-4 font-display text-2xl font-bold text-graphite">Tu pedido está vacío</h1><p className="mt-2 text-muted">Selecciona los productos antes de iniciar la compra guiada.</p><Link href="/productos" className="mt-6 inline-flex min-h-14 items-center justify-center rounded-xl bg-copper px-6 font-bold text-white">Explorar productos</Link></main>; }
