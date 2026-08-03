"use client";
import { useEffect, useState } from "react";
import { formatCOP } from "@/lib/utils";
import { MessageCircle, X } from "lucide-react";

export default function ClientesAdmin() {
  const [orders, setOrders] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => { fetch("/api/admin/orders").then((r) => r.json()).then(setOrders); }, []);

  // Agrupar por cliente
  const customerMap: Record<string, { name: string; phone: string; email: string; city: string; orders: any[]; total: number }> = {};
  orders.forEach((o) => {
    if (!o.customer) return;
    const key = o.customer.id;
    if (!customerMap[key]) {
      customerMap[key] = { name: o.customer.name, phone: o.customer.phone, email: o.customer.email, city: o.customer.city, orders: [], total: 0 };
    }
    customerMap[key].orders.push(o);
    if (o.paymentStatus === "APPROVED") customerMap[key].total += Number(o.total);
  });
  const customers = Object.entries(customerMap).sort((a, b) => b[1].total - a[1].total);

  const cur = selected ? customerMap[selected] : null;

  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-1">Clientes</h1>
      <p className="font-mono text-xs text-muted mb-5">{customers.length} clientes registrados</p>
      <div className="bg-card border border-hair rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-hair">
            {["Nombre", "Contacto", "Ciudad", "Pedidos", "Total pagado", ""].map((h) => (
              <th key={h} className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2.5">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {customers.map(([id, c]) => (
              <tr key={id} className="border-b border-hair hover:bg-paper/50">
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                <td className="px-4 py-3"><div className="font-mono text-xs">{c.phone}</div><div className="text-xs text-muted">{c.email}</div></td>
                <td className="px-4 py-3 text-sm">{c.city}</td>
                <td className="px-4 py-3 font-mono font-semibold">{c.orders.length}</td>
                <td className="px-4 py-3 font-display font-semibold">{formatCOP(c.total)}</td>
                <td className="px-4 py-3 flex gap-1">
                  <button onClick={() => setSelected(id)} className="text-xs font-semibold border border-hair px-3 py-1.5 rounded-lg hover:border-copper transition-colors">Ver</button>
                  {c.phone && <a href={`https://wa.me/57${c.phone}`} target="_blank" rel="noreferrer" className="text-green p-1.5"><MessageCircle size={15} /></a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cur && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="w-[400px] max-w-[90vw] bg-white h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-hair">
              <span className="font-display font-bold">{cur.name}</span>
              <button onClick={() => setSelected(null)}><X size={20} /></button>
            </div>
            <div className="p-5">
              <div className="font-mono text-xs text-muted mb-4">{cur.phone} · {cur.email} · {cur.city}</div>
              <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-2">Historial ({cur.orders.length} pedidos)</div>
              {cur.orders.map((o: any) => (
                <div key={o.id} className="border-b border-hair py-3">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-xs font-semibold">{o.number}</span>
                    <span className="font-display font-semibold text-sm">{formatCOP(Number(o.total))}</span>
                  </div>
                  <div className="text-xs text-muted mt-1">{new Date(o.createdAt).toLocaleDateString("es-CO")} · {o.paymentStatus}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
