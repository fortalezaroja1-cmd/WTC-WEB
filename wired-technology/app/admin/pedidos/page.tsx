"use client";
import { useEffect, useState } from "react";
import { formatCOP, PAY_LABELS, SHIP_LABELS, SHIP_STATUSES } from "@/lib/utils";
import { X, MessageCircle } from "lucide-react";

export default function PedidosAdmin() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { loadOrders(); }, []);
  const loadOrders = () => fetch("/api/admin/orders").then((r) => r.json()).then(setOrders);

  const updateOrder = async (id: string, data: any) => {
    await fetch("/api/admin/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    loadOrders();
  };

  const cur = orders.find((o) => o.id === selected);

  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-5">Pedidos</h1>
      <div className="bg-card border border-hair rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-hair">
            {["Pedido", "Fecha", "Cliente", "Total", "Pago", "Envío", ""].map((h) => (
              <th key={h} className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2.5">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-hair hover:bg-paper/50">
                <td className="px-4 py-3 font-mono font-semibold">{o.number}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{new Date(o.createdAt).toLocaleDateString("es-CO")}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{o.customer?.name || "—"}</div>
                  <div className="font-mono text-[10px] text-muted">{o.customer?.city}</div>
                </td>
                <td className="px-4 py-3 font-display font-semibold">{formatCOP(Number(o.total))}</td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${o.paymentStatus === "APPROVED" ? "bg-green-50 text-green" : o.paymentStatus === "REJECTED" ? "bg-red-50 text-alert" : "bg-amber-50 text-amber-700"}`}>{PAY_LABELS[o.paymentStatus]}</span></td>
                <td className="px-4 py-3"><span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-paper text-muted">{SHIP_LABELS[o.shipStatus]}</span></td>
                <td className="px-4 py-3"><button onClick={() => setSelected(o.id)} className="text-xs font-semibold border border-hair px-3 py-1.5 rounded-lg hover:border-copper transition-colors">Ver</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalle del pedido */}
      {cur && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-[440px] max-w-[90vw] bg-white h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-hair">
              <span className="font-display font-bold">Pedido {cur.number}</span>
              <button onClick={() => setSelected(null)}><X size={20} /></button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-2">Cliente</div>
                <div className="text-sm font-semibold">{cur.customer?.name}</div>
                <div className="font-mono text-xs text-muted">{cur.customer?.phone} · {cur.customer?.email}</div>
                <div className="text-xs mt-1">{cur.customer?.address}, {cur.customer?.city}</div>
                {cur.customer?.phone && (
                  <a href={`https://wa.me/57${cur.customer.phone}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 bg-green text-white text-xs font-semibold px-3 py-1.5 rounded-lg mt-2 hover:opacity-90">
                    <MessageCircle size={13} /> WhatsApp
                  </a>
                )}
              </div>
              <div>
                <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-2">Productos</div>
                {cur.items.map((it: any) => (
                  <div key={it.id} className="flex justify-between py-2 border-b border-hair text-sm">
                    <div><div className="font-medium">{it.name}</div><div className="font-mono text-[10px] text-muted">{it.sku} · {it.qty} × {formatCOP(Number(it.unitPrice))}</div></div>
                    <span className="font-display font-semibold">{formatCOP(Number(it.total))}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2"><span>Total</span><span className="font-display text-copper">{formatCOP(Number(cur.total))}</span></div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-dark block mb-1">Estado del pago</label>
                <select value={cur.paymentStatus} onChange={(e) => updateOrder(cur.id, { paymentStatus: e.target.value })}
                  className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-copper">
                  {["PENDING", "APPROVED", "REJECTED", "REFUNDED"].map((s) => <option key={s} value={s}>{PAY_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-dark block mb-1">Estado del envío</label>
                <select value={cur.shipStatus} onChange={(e) => updateOrder(cur.id, { shipStatus: e.target.value })}
                  className="w-full border border-hair rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-copper">
                  {SHIP_STATUSES.map((s) => <option key={s} value={s}>{SHIP_LABELS[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-dark block mb-1">Número de guía</label>
                <input value={cur.guide || ""} onChange={(e) => updateOrder(cur.id, { guide: e.target.value })}
                  placeholder="TCC / Servientrega…" className="w-full border border-hair rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-copper" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
