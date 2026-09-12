"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Package, Save, Search } from "lucide-react";

type Row = {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  sku: string;
  unit: string;
  category: string;
  brand: string;
  profile: null | {
    weightKg: number;
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    unitsPerPackage: number;
    maxUnitsPerPackage: number | null;
    active: boolean;
  };
};

type Draft = {
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  unitsPerPackage: string;
  maxUnitsPerPackage: string;
};

function fromRow(row: Row): Draft {
  return {
    weightKg: row.profile?.weightKg ? String(row.profile.weightKg) : "",
    lengthCm: row.profile?.lengthCm ? String(row.profile.lengthCm) : "",
    widthCm: row.profile?.widthCm ? String(row.profile.widthCm) : "",
    heightCm: row.profile?.heightCm ? String(row.profile.heightCm) : "",
    unitsPerPackage: String(row.profile?.unitsPerPackage || 1),
    maxUnitsPerPackage: row.profile?.maxUnitsPerPackage ? String(row.profile.maxUnitsPerPackage) : "",
  };
}

export default function AgentLogisticsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const keyOf = (row: Row) => `${row.productId}:${row.variantId || "BASE"}`;

  const load = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/agent/logistics", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar los perfiles");
      const nextRows = Array.isArray(data.rows) ? data.rows : [];
      setRows(nextRows);
      setDrafts(Object.fromEntries(nextRows.map((row: Row) => [keyOf(row), fromRow(row)])));
    } catch (e: any) {
      setError(e?.message || "No se pudieron cargar los perfiles");
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => `${row.productName} ${row.variantName || ""} ${row.sku} ${row.category}`.toLowerCase().includes(q));
  }, [rows, query]);

  const configured = rows.filter((row) => row.profile?.active).length;

  const update = (key: string, field: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const save = async (row: Row) => {
    const key = keyOf(row);
    const draft = drafts[key];
    setSaving(key); setError("");
    try {
      const res = await fetch("/api/admin/agent/logistics", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: row.productId,
          variantId: row.variantId,
          weightKg: Number(draft.weightKg),
          lengthCm: Number(draft.lengthCm),
          widthCm: Number(draft.widthCm),
          heightCm: Number(draft.heightCm),
          unitsPerPackage: Number(draft.unitsPerPackage || 1),
          maxUnitsPerPackage: draft.maxUnitsPerPackage ? Number(draft.maxUnitsPerPackage) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar");
      await load();
    } catch (e: any) {
      setError(e?.message || "No se pudo guardar");
    } finally { setSaving(""); }
  };

  return <div className="max-w-[1400px] mx-auto">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
      <div>
        <div className="flex items-center gap-2"><Package size={21} className="text-copper"/><h1 className="font-display text-2xl font-bold">Logística del agente</h1></div>
        <p className="text-sm text-muted mt-1">Peso y dimensiones reales por SKU para que Skydropx pueda calcular el envío sin estimaciones.</p>
      </div>
      <Link href="/admin/agente/estrategia" className="inline-flex items-center gap-2 border border-hair bg-white rounded-lg px-3 py-2.5 text-sm font-semibold"><ArrowLeft size={15}/>Estrategia del agente</Link>
    </div>

    {error && <div className="mb-4 rounded-lg border border-red-100 bg-red-50 text-alert px-4 py-3 text-sm">{error}</div>}

    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
      <Metric label="SKUs publicados" value={String(rows.length)} />
      <Metric label="Configurados" value={String(configured)} />
      <Metric label="Pendientes" value={String(Math.max(0, rows.length - configured))} />
    </div>

    <div className="bg-white border border-hair rounded-xl overflow-hidden">
      <div className="p-4 border-b border-hair flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><div className="font-semibold">Perfiles de empaque</div><div className="text-xs text-muted mt-0.5">Usa el peso y tamaño del paquete que realmente entregas a la transportadora.</div></div>
        <div className="relative w-full sm:w-[320px]"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Buscar producto o SKU" className="w-full border border-hair rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-copper"/></div>
      </div>

      {loading ? <div className="p-10 text-center text-sm text-muted">Cargando productos…</div> : <div className="divide-y divide-hair">
        {filtered.map((row) => {
          const key = keyOf(row);
          const draft = drafts[key] || fromRow(row);
          const complete = Boolean(row.profile?.active);
          return <div key={key} className="p-4 lg:p-5">
            <div className="flex flex-col xl:flex-row xl:items-center gap-4">
              <div className="xl:w-[280px] min-w-0">
                <div className="flex items-center gap-2"><span className="font-semibold text-sm truncate">{row.productName}{row.variantName ? ` · ${row.variantName}` : ""}</span>{complete && <CheckCircle2 size={15} className="text-green shrink-0"/>}</div>
                <div className="font-mono text-[10px] text-muted mt-1">{row.sku} · {row.unit}</div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 flex-1">
                <Input label="Peso kg" value={draft.weightKg} onChange={(v)=>update(key,"weightKg",v)} />
                <Input label="Largo cm" value={draft.lengthCm} onChange={(v)=>update(key,"lengthCm",v)} />
                <Input label="Ancho cm" value={draft.widthCm} onChange={(v)=>update(key,"widthCm",v)} />
                <Input label="Alto cm" value={draft.heightCm} onChange={(v)=>update(key,"heightCm",v)} />
                <Input label="Unid./paquete" value={draft.unitsPerPackage} onChange={(v)=>update(key,"unitsPerPackage",v)} />
                <Input label="Máx. unid." value={draft.maxUnitsPerPackage} onChange={(v)=>update(key,"maxUnitsPerPackage",v)} placeholder="Opcional" />
              </div>
              <button onClick={()=>save(row)} disabled={saving===key} className="xl:w-[110px] inline-flex items-center justify-center gap-2 rounded-lg bg-graphite text-white px-3 py-2.5 text-xs font-semibold disabled:opacity-50"><Save size={14}/>{saving===key?"Guardando…":"Guardar"}</button>
            </div>
          </div>;
        })}
      </div>}
    </div>

    <div className="mt-4 rounded-xl border border-copper/20 bg-[#FFF9F4] p-4 text-xs leading-relaxed">No cargues pesos aproximados solo para completar la tabla. La tarifa de Skydropx depende de estos datos. Si un producto cambia de empaque según cantidad, usa “Unid./paquete” y “Máx. unid.” para definir la regla de agrupación.</div>
  </div>;
}

function Input({label,value,onChange,placeholder}:{label:string,value:string,onChange:(value:string)=>void,placeholder?:string}){return <label className="block"><span className="text-[10px] text-muted block mb-1">{label}</span><input type="number" min="0" step="0.01" value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="w-full border border-hair rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-copper"/></label>}
function Metric({label,value}:{label:string,value:string}){return <div className="bg-white border border-hair rounded-xl p-4"><div className="text-[10px] uppercase tracking-wider text-muted">{label}</div><div className="font-display text-2xl font-bold mt-2">{value}</div></div>}
