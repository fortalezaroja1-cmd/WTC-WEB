"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCart, type CartItem } from "@/components/store/CartProvider";
import { formatCOP, waLink } from "@/lib/utils";
import { trackMetaEvent } from "@/lib/meta-events";
import { ArrowLeft, ArrowDown, ArrowUp, CalendarDays, MessageCircle, Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

const WHATSAPP = "573143506623";
const TEMPLATES = {
  pedido: { label: "Pedido de productos", intro: "Hola Wired Technology, quiero solicitar el siguiente pedido:" },
  cotizacion: { label: "Solicitar cotización", intro: "Hola Wired Technology, quisiera recibir una cotización de estos productos:" },
  programado: { label: "Agendar pedido", intro: "Hola Wired Technology, deseo programar este pedido para la fecha indicada:" },
  asesoria: { label: "Pedido con asesoría", intro: "Hola Wired Technology, necesito asesoría para confirmar esta selección de productos:" },
};
type TemplateKey = keyof typeof TEMPLATES;
const INPUT = "w-full min-h-12 border border-hair rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-copper";

export default function CheckoutPage() {
  const { items, updateQty, removeItem } = useCart();
  const [sequence, setSequence] = useState<string[]>([]);
  const [mode, setMode] = useState<"automatico" | "manual">("automatico");
  const [template, setTemplate] = useState<TemplateKey>("pedido");
  const [form, setForm] = useState({ name: "", phone: "", city: "", barrio: "", address: "", reference: "", notes: "", date: "", fulfillment: "Entrega a domicilio" });
  const [manual, setManual] = useState("");
  const [origin, setOrigin] = useState("Web");
  const keys = items.map(i => i.productId + ":" + (i.variantId || ""));
  useEffect(() => {
    setSequence(previous => [...previous.filter(key => keys.includes(key)), ...keys.filter(key => !previous.includes(key))]);
  }, [keys.join("|")]);
  useEffect(() => {
    try { setOrigin(localStorage.getItem("wt_order_origin") || "Web"); } catch {}
  }, []);

  const ordered = useMemo(() => {
    const index = new Map(sequence.map((key, i) => [key, i]));
    return [...items].sort((a, b) => (index.get(a.productId + ":" + (a.variantId || "")) ?? 999) - (index.get(b.productId + ":" + (b.variantId || "")) ?? 999));
  }, [items, sequence]);
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const move = (item: CartItem, direction: number) => {
    const key = item.productId + ":" + (item.variantId || "");
    const next = [...sequence];
    const i = next.indexOf(key);
    if (i < 0 || i + direction < 0 || i + direction >= next.length) return;
    [next[i], next[i + direction]] = [next[i + direction], next[i]];
    setSequence(next);
  };
  const generated = [
    TEMPLATES[template].intro,
    "",
    ...ordered.flatMap((item, index) => [
      String(index + 1) + ". " + item.name,
      "Referencia: " + item.sku,
      "Cantidad: " + item.qty,
      "Precio unitario: " + formatCOP(item.price),
      "Subtotal: " + formatCOP(item.price * item.qty),
      "",
    ]),
    "TOTAL PRODUCTOS: " + formatCOP(subtotal),
    "Envío: pendiente de cotización",
    "",
    "Cliente: " + (form.name || "Por confirmar"),
    "Teléfono: " + (form.phone || "Por confirmar"),
    "Ciudad: " + (form.city || "Por confirmar"),
    "Modalidad: " + form.fulfillment,
    ...(form.fulfillment === "Entrega a domicilio" ? ["Barrio: " + (form.barrio || "Por confirmar"), "Dirección: " + (form.address || "Por confirmar")] : []),
    ...(form.reference ? ["Referencia de entrega: " + form.reference] : []),
    ...(form.date ? ["Fecha solicitada: " + form.date + " (sujeta a confirmación)"] : []),
    ...(form.notes ? ["Observaciones: " + form.notes] : []),
    "Origen: " + origin,
    "",
    "Por favor confirmar disponibilidad, fecha y valor final antes de procesar el pedido.",
  ].join("\n");
  const message = mode === "manual" ? manual : generated;
  const valid = items.length > 0 && (mode === "manual" ? manual.trim().length > 10 : !!form.name.trim() && !!form.phone.trim() && !!form.city.trim() && (form.fulfillment === "Recoger en tienda" || !!form.address.trim()));
  const recordContact = () => {
    trackMetaEvent("InitiateCheckout", { content_ids: items.map(i => i.sku), content_type: "product", num_items: items.reduce((s, i) => s + i.qty, 0), value: subtotal, currency: "COP" });
    trackMetaEvent("Contact", { content_ids: items.map(i => i.sku), content_type: "product", value: subtotal, currency: "COP" });
  };

  if (!items.length) return (
    <div className="max-w-[600px] mx-auto px-5 py-16 text-center">
      <ShoppingCart size={44} className="mx-auto mb-4 text-copper" />
      <h1 className="font-display text-2xl font-bold mb-2">Tu pedido está vacío</h1>
      <p className="text-muted mb-5">Selecciona los productos antes de armar tu pedido.</p>
      <Link href="/" className="text-copper font-semibold">Explorar productos</Link>
    </div>
  );

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-5 py-6 sm:py-9">
      <Link href="/" className="inline-flex gap-2 items-center font-semibold text-copper text-sm mb-5"><ArrowLeft size={16} /> Seguir comprando</Link>
      <div className="mb-7">
        <div className="text-xs uppercase font-mono tracking-widest text-copper mb-2">Pedidos Wired Technology</div>
        <h1 className="font-display text-[28px] sm:text-3xl font-bold">Arma y agenda tu pedido</h1>
        <p className="text-muted text-sm mt-2">Organiza tus productos, elige cómo preparar el mensaje y confirma todo directamente con nuestro equipo por WhatsApp.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 lg:gap-7 items-start">
        <div className="space-y-6">
          <section className="bg-card border border-hair rounded-xl p-4 sm:p-5">
            <h2 className="font-display text-lg font-bold mb-1">1. Personaliza tu pedido</h2>
            <p className="text-sm text-muted mb-4">El modo automático completa una plantilla. También puedes escribir tu propio mensaje.</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => setMode("automatico")} className={"rounded-lg min-h-14 px-2 py-3 font-semibold text-sm sm:text-base border " + (mode === "automatico" ? "bg-graphite text-white border-graphite" : "border-hair")}>Mensaje automático</button>
              <button onClick={() => { setManual(generated); setMode("manual"); }} className={"rounded-lg min-h-14 px-2 py-3 font-semibold text-sm sm:text-base border " + (mode === "manual" ? "bg-graphite text-white border-graphite" : "border-hair")}>Editar manualmente</button>
            </div>
            {mode === "automatico" && <>
              <label className="block text-sm font-semibold mb-1">Plantilla de mensaje</label>
              <select className={INPUT + " mb-4"} value={template} onChange={e => setTemplate(e.target.value as TemplateKey)}>
                {(Object.keys(TEMPLATES) as TemplateKey[]).map(key => <option key={key} value={key}>{TEMPLATES[key].label}</option>)}
              </select>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold mb-1">Nombre *</label><input className={INPUT} value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div><label className="block text-sm font-semibold mb-1">Teléfono *</label><input className={INPUT} type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                <div><label className="block text-sm font-semibold mb-1">Ciudad *</label><input className={INPUT} value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
                <div><label className="block text-sm font-semibold mb-1">Entrega o recogida</label><select className={INPUT} value={form.fulfillment} onChange={e => setForm({...form, fulfillment: e.target.value})}><option>Entrega a domicilio</option><option>Recoger en tienda</option></select></div>
                {form.fulfillment === "Entrega a domicilio" && <>
                  <div><label className="block text-sm font-semibold mb-1">Barrio</label><input className={INPUT} value={form.barrio} onChange={e => setForm({...form, barrio: e.target.value})} /></div>
                  <div><label className="block text-sm font-semibold mb-1">Dirección *</label><input className={INPUT} value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
                  <div className="sm:col-span-2"><label className="block text-sm font-semibold mb-1">Referencia de entrega</label><input className={INPUT} value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} /></div>
                </>}
                <div className="sm:col-span-2"><label className="flex items-center gap-2 text-sm font-semibold mb-1"><CalendarDays size={14} /> Fecha deseada (opcional)</label><input type="date" min={new Date().toLocaleDateString("en-CA")} className={INPUT} value={form.date} onChange={e => setForm({...form, date: e.target.value})} /><p className="text-xs text-muted mt-1">La fecha queda solicitada, no reservada, hasta confirmación por WhatsApp.</p></div>
                <div className="sm:col-span-2"><label className="block text-sm font-semibold mb-1">Indicaciones adicionales</label><textarea rows={3} className={INPUT} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Medidas, marcas, detalles del pedido..." /></div>
              </div>
            </>}
            {mode === "manual" && <div><label className="block text-sm font-semibold mb-1">Tu mensaje editable *</label><textarea rows={15} className={INPUT + " font-mono"} value={manual} onChange={e => setManual(e.target.value)} /><p className="text-xs text-muted mt-2">Puedes ajustar libremente el texto antes de abrir WhatsApp.</p></div>}
          </section>

          <section className="bg-card border border-hair rounded-xl p-4 sm:p-5">
            <h2 className="font-display text-lg font-bold mb-1">2. Ordena los productos</h2>
            <p className="text-xs text-muted mb-4">Modifica cantidades, elimina productos o cambia su orden con las flechas.</p>
            {ordered.map((it, i) => {
              const originalIndex = items.findIndex(x => x.productId === it.productId && x.variantId === it.variantId);
              return <div key={it.productId + ":" + it.variantId} className="flex items-center gap-3 py-3 border-b border-hair">
                <div className="flex flex-col gap-1"><button disabled={i === 0} onClick={() => move(it, -1)} aria-label="Subir producto" className="h-11 w-11 flex items-center justify-center border border-hair rounded-lg disabled:opacity-25"><ArrowUp size={16}/></button><button disabled={i === ordered.length - 1} onClick={() => move(it, 1)} aria-label="Bajar producto" className="h-11 w-11 flex items-center justify-center border border-hair rounded-lg disabled:opacity-25"><ArrowDown size={16}/></button></div>
                <div className="min-w-0 flex-1"><div className="text-sm font-semibold">{it.name}</div><div className="text-xs text-muted">{it.sku} · {formatCOP(it.price)} c/u</div><div className="flex gap-2 items-center mt-2"><button className="h-11 w-11 flex items-center justify-center border border-hair rounded-lg" onClick={() => updateQty(originalIndex, -1)}><Minus size={13}/></button><span className="text-sm">{it.qty}</span><button className="h-11 w-11 flex items-center justify-center border border-hair rounded-lg" onClick={() => updateQty(originalIndex, 1)}><Plus size={13}/></button><button aria-label="Quitar producto" onClick={() => removeItem(originalIndex)} className="h-11 w-11 flex items-center justify-center text-alert ml-2"><Trash2 size={14}/></button></div></div>
                <div className="text-sm font-bold whitespace-nowrap">{formatCOP(it.price * it.qty)}</div>
              </div>;
            })}
          </section>
        </div>
        <aside className="bg-white border border-hair rounded-xl p-4 sm:p-5 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-bold mb-3">3. Confirmación por WhatsApp</h2>
          <div className="flex justify-between text-sm border-b border-hair pb-3"><span>Subtotal de productos</span><strong>{formatCOP(subtotal)}</strong></div>
          <div className="flex justify-between text-sm py-3"><span>Envío</span><span className="text-copper font-semibold">Por cotizar</span></div>
          <p className="text-xs text-muted mb-3">Revisa el mensaje que enviaremos a WhatsApp. Wired confirmará existencias, costos y fecha antes de procesar el pedido.</p>
          <details className="bg-paper border border-hair rounded-lg p-3">
            <summary className="text-sm font-semibold cursor-pointer min-h-11 flex items-center">Ver mensaje para WhatsApp</summary>
            <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed max-h-80 overflow-auto font-sans py-2">{message}</pre>
          </details>
          {!valid && <p role="status" className="mt-3 text-sm text-alert font-medium">
            {mode === "manual" ? "Escribe el mensaje que quieres enviar." : "Completa nombre, teléfono, ciudad y dirección si pides domicilio."}
          </p>}
          {valid ? <a href={waLink(WHATSAPP, message)} target="_blank" rel="noopener noreferrer" onClick={recordContact}
            className="mt-4 w-full min-h-14 bg-green text-white font-bold text-base rounded-xl px-3 flex items-center justify-center gap-2 text-center">
            <MessageCircle size={20} aria-hidden="true" /> Enviar pedido a WhatsApp
          </a> : <button type="button" disabled className="mt-4 w-full min-h-14 bg-paper border border-hair text-muted font-bold text-base rounded-xl px-3 cursor-not-allowed">
            Completa tus datos para continuar
          </button>}
          <p className="text-[11px] text-center text-muted mt-3">Se abrirá WhatsApp con el mensaje listo. El pedido solo se confirma cuando nuestro equipo te responda.</p>
        </aside>
      </div>
    </div>
  );
}
