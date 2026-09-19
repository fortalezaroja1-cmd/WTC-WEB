"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Activity, Filter, RefreshCcw } from "lucide-react";

export default function ActividadPage(){
  const [items,setItems]=useState<any[]>([]);
  const [kind,setKind]=useState("ALL");
  const [loading,setLoading]=useState(false);
  const load=async()=>{setLoading(true);try{const r=await fetch("/api/admin/activity",{cache:"no-store"});const d=await r.json();if(r.ok)setItems(Array.isArray(d)?d:[])}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const filtered=useMemo(()=>kind==="ALL"?items:items.filter(x=>x.kind===kind),[items,kind]);
  return <div className="max-w-[1000px]">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
      <div><div className="flex items-center gap-2"><Activity size={20} className="text-copper"/><h1 className="font-display text-2xl font-bold">Actividad</h1></div><p className="text-sm text-muted mt-1">Historial unificado de ventas, CRM y pedidos según tus permisos.</p></div>
      <div className="flex gap-2"><div className="relative"><Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><select value={kind} onChange={e=>setKind(e.target.value)} className="border border-hair bg-white rounded-lg pl-8 pr-3 py-2.5 text-xs"><option value="ALL">Todo</option><option value="SALES">Ventas</option><option value="CRM">CRM</option><option value="ORDER">Pedidos</option></select></div><button onClick={load} className="border border-hair bg-white rounded-lg px-3 py-2.5 text-xs font-semibold inline-flex items-center gap-2"><RefreshCcw size={13}/>{loading?"Cargando…":"Actualizar"}</button></div>
    </div>
    <div className="bg-white border border-hair rounded-xl overflow-hidden">
      {!filtered.length&&!loading&&<div className="p-10 text-sm text-muted text-center">No hay actividad visible todavía.</div>}
      <div className="divide-y divide-hair">
        {filtered.map(a=><Link key={a.id} href={a.href||"#"} className="block p-4 hover:bg-paper/60">
          <div className="flex items-start gap-3"><span className="text-[9px] uppercase tracking-wider rounded-full bg-paper px-2 py-1 shrink-0">{a.kind}</span><div className="min-w-0 flex-1"><div className="text-sm font-medium">{a.text}</div><div className="text-[10px] text-muted mt-1">{a.actor||"Sistema"} · {new Date(a.createdAt).toLocaleString("es-CO")}</div></div></div>
        </Link>)}
      </div>
    </div>
  </div>
}
