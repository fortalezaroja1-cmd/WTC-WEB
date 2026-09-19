"use client";
import { useEffect, useState } from "react";
import { RefreshCcw, Search, ShieldCheck } from "lucide-react";

const LABELS:Record<string,string>={
  OPPORTUNITY_CREATED:"Oportunidad creada",
  OPPORTUNITY_UPDATED:"Oportunidad actualizada",
  QUOTE_CREATED:"Cotización creada",
  QUOTE_CONVERTED_TO_ORDER:"Cotización convertida en pedido",
  QUOTE_STATUS_CHANGED:"Estado de cotización",
  CUSTOMER_UPDATED:"Cliente actualizado",
  ORDER_STOCK_VALIDATED:"Stock de pedido validado",
  ORDER_CONFIRMED:"Pedido confirmado",
  ORDER_CANCELLED:"Pedido cancelado",
  ORDER_UPDATED:"Pedido actualizado",
};

export default function AuditoriaPage(){
  const [items,setItems]=useState<any[]>([]);
  const [q,setQ]=useState("");
  const [loading,setLoading]=useState(false);
  const load=async()=>{
    setLoading(true);
    try{
      const r=await fetch("/api/admin/audit?q="+encodeURIComponent(q),{cache:"no-store"});
      const d=await r.json();if(r.ok)setItems(Array.isArray(d)?d:[]);
    }finally{setLoading(false)}
  };
  useEffect(()=>{load()},[]);
  return <div className="max-w-[1100px]">
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
      <div><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-copper"/><h1 className="font-display text-2xl font-bold">Auditoría</h1></div><p className="text-sm text-muted mt-1">Trazabilidad de cambios comerciales y operativos sensibles.</p></div>
      <div className="flex gap-2"><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&load()} placeholder="Acción o usuario..." className="border border-hair bg-white rounded-lg pl-9 pr-3 py-2.5 text-sm"/></div><button onClick={load} className="border border-hair bg-white rounded-lg px-3 py-2.5 text-xs font-semibold inline-flex items-center gap-2"><RefreshCcw size={13}/>{loading?"Cargando…":"Buscar"}</button></div>
    </div>
    <div className="bg-white border border-hair rounded-xl overflow-hidden">
      {!items.length&&!loading&&<div className="p-10 text-sm text-muted text-center">Todavía no hay movimientos auditados.</div>}
      <div className="divide-y divide-hair">
        {items.map(a=><div key={a.id} className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div><div className="text-sm font-semibold">{LABELS[a.action]||a.action}</div><div className="text-xs text-muted mt-1">{a.actorName||"Sistema"}{a.actorUserId?" · "+a.actorUserId:""}</div></div>
            <div className="text-[10px] text-muted whitespace-nowrap">{new Date(a.createdAt).toLocaleString("es-CO")}</div>
          </div>
          {a.meta&&<details className="mt-2"><summary className="text-[10px] text-copper cursor-pointer">Ver detalle</summary><pre className="mt-2 bg-paper rounded-lg p-3 text-[10px] overflow-auto whitespace-pre-wrap">{JSON.stringify(a.meta,null,2)}</pre></details>}
        </div>)}
      </div>
    </div>
  </div>
}
