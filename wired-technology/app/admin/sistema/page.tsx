"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCcw, ShieldCheck, TriangleAlert } from "lucide-react";

export default function SistemaPage(){
  const [data,setData]=useState<any>(null);
  const [loading,setLoading]=useState(false);
  const [running,setRunning]=useState(false);
  const [message,setMessage]=useState("");
  const load=async()=>{setLoading(true);setMessage("");try{const r=await fetch("/api/admin/system/health",{cache:"no-store"});const d=await r.json();setData(d)}finally{setLoading(false)}};
  useEffect(()=>{load()},[]);
  const smoke=async()=>{setRunning(true);setMessage("");try{const r=await fetch("/api/admin/system/health",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"smoke-test"})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Falló la prueba");setData(d.state);setMessage(d.message)}catch(e:any){setMessage(e.message)}finally{setRunning(false)}};
  return <div className="max-w-[1000px]">
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-5">
      <div><div className="flex items-center gap-2"><ShieldCheck size={20} className="text-copper"/><h1 className="font-display text-2xl font-bold">Estado del sistema</h1></div><p className="text-sm text-muted mt-1">Diagnóstico de base de datos, CRM, ventas, inventario y seguridad básica.</p></div>
      <div className="flex gap-2"><button onClick={load} className="border border-hair bg-white rounded-lg px-3 py-2.5 text-xs font-semibold inline-flex items-center gap-2"><RefreshCcw size={13}/>{loading?"Revisando…":"Revisar"}</button><button onClick={smoke} disabled={running} className="bg-graphite text-white rounded-lg px-3 py-2.5 text-xs font-semibold disabled:opacity-50">{running?"Probando…":"Ejecutar prueba segura"}</button></div>
    </div>
    {message&&<div className="mb-4 border border-copper/20 bg-[#FFF9F4] rounded-lg px-4 py-3 text-sm">{message}</div>}
    {data&&<><div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
      {Object.entries(data.counts||{}).map(([k,v]:any)=><div key={k} className="bg-white border border-hair rounded-xl p-3"><div className="text-[9px] uppercase tracking-wider text-muted">{({products:"Productos",customers:"Clientes",orders:"Pedidos",opportunities:"Oportunidades",quotes:"Cotizaciones"} as any)[k]||k}</div><div className="font-display text-xl font-bold mt-1">{String(v)}</div></div>)}
    </div>
    <section className="bg-white border border-hair rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-hair flex items-center justify-between"><div><h2 className="font-semibold text-sm">Comprobaciones</h2><p className="text-[10px] text-muted mt-0.5">Revisión {data.revision||"—"} · {data.environment||"—"}</p></div><span className={"text-[10px] font-semibold rounded-full px-2 py-1 "+(data.ok?"bg-green-50 text-green":"bg-red-50 text-alert")}>{data.ok?"OPERATIVO":"REVISAR"}</span></div>
      <div className="divide-y divide-hair">{(data.checks||[]).map((x:any)=><div key={x.key} className="p-4 flex items-start gap-3">{x.status==="OK"?<CheckCircle2 size={18} className="text-green shrink-0"/>:<TriangleAlert size={18} className={x.status==="ERROR"?"text-alert shrink-0":"text-copper shrink-0"}/>}<div><div className="text-sm font-semibold">{x.label}</div><div className="text-xs text-muted mt-1">{x.detail}</div></div></div>)}</div>
    </section>
    <div className="mt-4 text-[11px] text-muted leading-relaxed">La prueba segura crea temporalmente una oportunidad, una cotización y una actividad dentro de una transacción y luego revierte todo. Sirve para comprobar escritura y relaciones sin dejar información falsa.</div></>}
  </div>
}
