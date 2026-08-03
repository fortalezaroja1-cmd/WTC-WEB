"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/store/CartProvider";
import { formatCOP } from "@/lib/utils";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import Link from "next/link";

export default function CheckoutPage() {
  const { items, clearCart } = useCart();
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", city: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal >= 250000 || subtotal === 0 ? 0 : 12000;
  const total = subtotal + shipping;
  const valid = form.name && form.phone && form.address && form.city;

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer: form, items, subtotal, shipping, total }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear el pedido");
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
        <p className="mb-4">Tu carrito está vacío.</p>
        <Link href="/" className="text-copper font-semibold hover:underline">Volver a la tienda</Link>
      </div>
    );
  }

  return (
    <div className="max-w-[720px] mx-auto px-5 py-7">
      <Link href="/" className="font-mono text-xs text-copper font-semibold inline-flex items-center gap-1 mb-4 hover:underline">
        <ArrowLeft size={13} /> TIENDA
      </Link>
      <h1 className="font-display text-2xl font-bold mb-6">Finalizar pedido</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Formulario */}
        <div>
          <p className="font-mono text-[11px] text-muted mb-4">Compra como invitado — no necesitas cuenta.</p>
          {[
            ["name", "Nombre completo *"],
            ["phone", "Teléfono / WhatsApp *"],
            ["email", "Correo (opcional)"],
            ["address", "Dirección *"],
            ["city", "Ciudad *"],
          ].map(([k, label]) => (
            <div key={k} className="mb-3">
              <label className="text-xs font-semibold text-slate-dark block mb-1">{label}</label>
              <input value={form[k as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper" />
            </div>
          ))}
          {error && <p className="text-alert text-sm mb-3">{error}</p>}
          <button onClick={handleSubmit} disabled={!valid || loading}
            className={`w-full py-3 rounded-lg font-semibold text-sm mt-2 transition-colors ${
              valid && !loading ? "bg-copper text-white hover:bg-copper-bright" : "bg-paper text-muted cursor-not-allowed"
            }`}>
            {loading ? "Procesando..." : "Confirmar pedido"}
          </button>
          <p className="font-mono text-[10px] text-muted text-center mt-3">
            Al confirmar recibirás instrucciones para pagar con Mercado Pago.
          </p>
        </div>

        {/* Resumen */}
        <div className="bg-card border border-hair rounded-xl p-5 h-fit">
          <div className="font-display font-bold text-sm mb-3">Resumen del pedido</div>
          {items.map((it, i) => (
            <div key={i} className="flex justify-between py-2 border-b border-hair text-sm">
              <div>
                <div className="font-medium">{it.name}</div>
                <div className="font-mono text-[10px] text-muted">{it.qty} × {formatCOP(it.price)}</div>
              </div>
              <span className="font-display font-semibold">{formatCOP(it.price * it.qty)}</span>
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
