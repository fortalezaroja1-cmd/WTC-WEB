"use client";
import { useEffect, useState } from "react";
import { DollarSign, TrendingUp, ClipboardList, AlertTriangle } from "lucide-react";
import { formatCOP, PAY_LABELS } from "@/lib/utils";

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/stats").then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) return <div className="text-muted py-16 text-center">Cargando panel...</div>;

  const kpis = [
    { label: "Ventas hoy", value: formatCOP(stats.salesToday), icon: DollarSign, color: "text-green" },
    { label: "Ventas 7 días", value: formatCOP(stats.salesWeek), icon: TrendingUp, color: "text-copper" },
    { label: "Ingresos totales", value: formatCOP(stats.salesTotal), icon: DollarSign, color: "text-ink" },
    { label: "Pedidos pendientes", value: stats.pendingOrders, icon: ClipboardList, color: "text-blue" },
  ];

  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-5">Panel</h1>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card border border-hair rounded-xl p-4">
            <div className="flex justify-between items-start">
              <span className="font-mono text-[10px] tracking-wider uppercase text-muted">{k.label}</span>
              <k.icon size={17} className={k.color} />
            </div>
            <div className={`font-display text-2xl font-bold mt-2 ${k.color}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          ["Pendientes de pago", stats.pendingOrders, "bg-amber-50 text-amber-700"],
          ["Agotados", stats.outOfStock, "bg-red-50 text-alert"],
          ["Bajo mínimo", stats.lowStock, "bg-amber-50 text-amber-700"],
        ].map(([label, val, cls]) => (
          <div key={label as string} className="bg-card border border-hair rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-dark">{label as string}</span>
            <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${cls}`}>{val as number}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Pedidos recientes */}
        <div className="col-span-3 bg-card border border-hair rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-hair font-display font-bold text-sm">Pedidos recientes</div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-hair">
              <th className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2">Pedido</th>
              <th className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2">Total</th>
              <th className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2">Estado</th>
            </tr></thead>
            <tbody>
              {stats.recentOrders.map((o: any) => (
                <tr key={o.number} className="border-b border-hair hover:bg-paper/50">
                  <td className="px-4 py-3 font-mono font-semibold">{o.number}</td>
                  <td className="px-4 py-3 font-display font-semibold">{formatCOP(o.total)}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    o.paymentStatus === "APPROVED" ? "bg-green-50 text-green" : "bg-amber-50 text-amber-700"
                  }`}>{PAY_LABELS[o.paymentStatus] || o.paymentStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Inventario bajo + más vendidos */}
        <div className="col-span-2 flex flex-col gap-4">
          <div className="bg-card border border-hair rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-hair flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber" />
              <span className="font-display font-bold text-sm">Inventario bajo</span>
            </div>
            <div className="px-4 py-2 max-h-[180px] overflow-y-auto">
              {stats.lowStockItems.map((it: any, i: number) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-hair/50 last:border-0">
                  <div>
                    <div className="text-xs font-medium">{it.name}</div>
                    <div className="font-mono text-[10px] text-muted">{it.sku}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${it.out ? "bg-red-50 text-alert" : "bg-amber-50 text-amber-700"}`}>
                    {it.out ? "Agotado" : `${it.stock} und`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-hair rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-hair font-display font-bold text-sm">Más vendidos</div>
            <div className="px-4 py-2">
              {stats.topSold.length === 0 && <div className="text-xs text-muted py-2">Sin ventas aún.</div>}
              {stats.topSold.map((it: any, i: number) => (
                <div key={i} className="flex justify-between py-2 border-b border-hair/50 last:border-0 text-xs">
                  <span className="font-medium">{it.name}</span>
                  <span className="font-mono text-copper font-semibold">{it.qty} und</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
