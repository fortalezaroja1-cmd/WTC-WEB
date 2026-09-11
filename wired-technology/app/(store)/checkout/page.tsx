"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/store/CartProvider";
import { formatCOP } from "@/lib/utils";
import { ArrowLeft, ShoppingCart, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function CheckoutPage() {
  const { items, clearCart } = useCart();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    barrio: "",
    address: "",
    reference: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal >= 250000 || subtotal === 0 ? 0 : 12000;
  const total = subtotal + shipping;
  const valid = form.name && form.phone && form.city && form.barrio && form.address;

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError("");
    try {
      let requestId = sessionStorage.getItem("wt_order_request_id");
      if (!requestId) {
        requestId = crypto.randomUUID();
        sessionStorage.setItem("wt_order_request_id", requestId);
      }
      const origin = localStorage.getItem("wt_order_origin") || "Web";

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: form, items, subtotal, shipping, total, requestId, origin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear el pedido");
      sessionStorage.removeItem("wt_order_request_id");
      clearCart();
      router.push(`/confirmacion?order=${data.orderNumber}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-[560px] mx-auto px-5 py-16 text-center text-muted">
        <ShoppingCart size={48} className="mx-auto mb-4" strokeWidth={1.2} />
        <p className="mb-4">Tu pedido está vacío.</p>
        <Link href="/" className="text-copper font-semibold hover:underline">Volver a la tienda</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[860px] mx-auto px-5 py-7">
      <Link href="/" className="font-mono text-xs text-copper font-semibold inline-flex items-center gap-1 mb-4 hover:underline">
        <ArrowLeft size={13} /> SEGUIR AGREGANDO PRODUCTOS
      </Link>
      <h1 className="font-display text-2xl font-bold mb-2">Enviar pedido</h1>
      <p className="text-sm text-muted mb-6">Arma tu pedido y déjanos tus datos. Nuestro equipo revisará disponibilidad y coordinará la entrega contigo.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <div className="flex items-start gap-2 bg-green-50 border border-green/20 rounded-lg p-3 mb-5">
            <ShieldCheck size={18} className="text-green shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold">Pago en casa / contraentrega</div>
              <div className="text-xs text-muted mt-0.5">No necesitas crear una cuenta ni pagar para dejar tu pedido.</div>
            </div>
          </div>

          {[
            ["name", "Nombre completo *"],
            ["phone", "Teléfono / WhatsApp *"],
            ["email", "Correo (opcional)"],
            ["city", "Ciudad *"],
            ["barrio", "Barrio *"],
            ["address", "Dirección *"],
            ["reference", "Referencia de entrega (opcional)"],
          ].map(([k, label]) => (
            <div key={k} className="mb-3">
              <label className="text-xs font-semibold text-slate-dark block mb-1">{label}</label>
              <input
                value={form[k as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper"
              />
            </div>
          ))}

          <div className="mb-3">
            <label className="text-xs font-semibold text-slate-dark block mb-1">Observaciones (opcional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Ej: horario de entrega, indicaciones o detalle del pedido"
              className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper resize-none"
            />
          </div>

          {error && <p className="text-alert text-sm mb-3">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={!valid || loading}
            className={`w-full py-3 rounded-lg font-semibold text-sm mt-2 transition-colors ${
              valid && !loading ? "bg-copper text-white hover:bg-copper-bright" : "bg-paper text-muted cursor-not-allowed"
            }`}
          >
            {loading ? "Enviando pedido..." : "Enviar pedido"}
          </button>
          <p className="font-mono text-[10px] text-muted text-center mt-3">
            El pedido queda pendiente de validación de disponibilidad y entrega por nuestro equipo.
          </p>
        </div>

        <div className="bg-card border border-hair rounded-xl p-5 h-fit md:sticky md:top-6">
          <div className="font-display font-bold text-sm mb-3">Tu pedido</div>
          {items.map((it, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-hair text-sm gap-3">
              <div>
                <div className="font-medium">{it.name}</div>
                <div className="font-mono text-[10px] text-muted">{it.qty} × {formatCOP(it.price)}</div>
              </div>
              <span className="font-display font-semibold whitespace-nowrap">{formatCOP(it.price * it.qty)}</span>
            </div>
          ))}
          <div className="flex justify-between text-sm mt-3"><span className="text-muted">Subtotal</span><span>{formatCOP(subtotal)}</span></div>
          <div className="flex justify-between text-sm mt-1"><span className="text-muted">Envío</span><span>{shipping === 0 ? "Gratis" : formatCOP(shipping)}</span></div>
          <div className="flex justify-between font-bold mt-3 pt-3 border-t border-hair">
            <span>Total</span><span className="font-display text-lg text-copper">{formatCOP(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
