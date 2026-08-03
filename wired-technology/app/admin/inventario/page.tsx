"use client";
import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";

export default function InventarioAdmin() {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => { fetch("/api/admin/products").then((r) => r.json()).then(setProducts); }, []);

  const rows: { pid: string; vid: string | null; name: string; sku: string; stock: number }[] = [];
  products.forEach((p: any) => {
    if (p.variants?.length) p.variants.forEach((v: any) => rows.push({ pid: p.id, vid: v.id, name: `${p.name} · ${v.name}`, sku: v.sku, stock: v.stock }));
    else rows.push({ pid: p.id, vid: null, name: p.name, sku: p.sku, stock: p.stock });
  });

  const out = rows.filter((r) => r.stock <= 0).length;
  const low = rows.filter((r) => r.stock > 0 && r.stock <= 5).length;

  // Nota: ajuste de inventario requeriría un endpoint dedicado; por ahora es visual
  return (
    <div>
      <h1 className="font-display text-xl font-bold mb-5">Inventario</h1>
      <div className="flex gap-3 mb-4">
        <div className="bg-card border border-hair rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-alert">{out}</span>
          <span className="text-sm">agotados</span>
        </div>
        <div className="bg-card border border-hair rounded-lg px-4 py-2.5 flex items-center gap-2">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{low}</span>
          <span className="text-sm">bajo mínimo (5)</span>
        </div>
      </div>
      <div className="bg-card border border-hair rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-hair">
            {["Producto / variante", "SKU", "Estado", "Stock"].map((h) => (
              <th key={h} className="text-left font-mono text-[10px] tracking-wider uppercase text-muted px-4 py-2.5">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-hair hover:bg-paper/50">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.sku}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    r.stock <= 0 ? "bg-red-50 text-alert" : r.stock <= 5 ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green"
                  }`}>{r.stock <= 0 ? "Agotado" : r.stock <= 5 ? `Últimas ${r.stock}` : "Disponible"}</span>
                </td>
                <td className="px-4 py-3 font-mono font-semibold">{r.stock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
