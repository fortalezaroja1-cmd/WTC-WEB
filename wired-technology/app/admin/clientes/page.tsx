"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { formatCOP } from "@/lib/utils";

const inputClass="w-full border border-hair rounded-lg px-3 py-2.5 text-sm outline-none focus:border-copper";

export default function ClientesAdmin(){
  const [customers,setCustomers]=useState<any[]>([]);
  const [detail,setDetail]=useState<any|null>(null);
  const [query,setQuery]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const load=async()=>{
    const r=await fetch("/api/admin/customers",{cache:"no-store"});
    const d=await r.json(); if(r.ok)setCustomers(Array.isArray(d)?d:[]);
  };
  useEffect(()=>{load()},[]);

  const open=async(id:string)=>{
    setError("");setBusy(true);
    try{const r=await fetch("/api/admin/customers?id="+encodeURIComponent(id),{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setDetail(d);}
    catch(e:any){setError(e.message)}finally{setBusy(false)}
  };
  const save=async(data:any)=>{
    if(!detail)return;
    setBusy(true);setError("");
    try{const r=await fetch("/api/admin/customers",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:detail.id,...data})});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();await open(detail.id);}
    catch(e:any){setError(e.message)}finally{setBusy(false)}
  };

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();if(!q)return customers;
    return customers.filter(c=>[c.name,c.phone,c.email,c.city].filter(Boolean).join(" ").toLowerCase().includes(q));
  },[customers,query]);

  return <div>
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
      <div><h1 className="font-display text-2xl font-bold">Clientes</h1><p className="text-sm text-muted mt-1">Ficha 360° con pedidos, oportunidades, cotizaciones y actividad.</p></div>
      <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente..." className="w-full md:w-[280px] border border-hair rounded-lg pl-9 pr-3 py-2.5 text-sm bg-white outline-none focus:border-copper"/></div>
    </div>
    {error&&<div className="mb-4 border border-red-100 bg-red-50 text-alert rounded-lg px-4 py-3 text-sm">{error}</div>}
    <div className="bg-white border border-hair rounded-xl overflow-x-auto">
      <table className="w-full min-w-[820px] text-sm"><thead><tr className="border-b border-hair bg-[#FAFAFA]">
        {["Nombre","Contacto","Ciudad","Pedidos","Total pagado","Última compra",""].map(h=><th key={h} className="text-left text-[10px] uppercase tracking-wider text-muted px-4 py-2.5">{h}</th>)}
      </tr></thead><tbody>
        {filtered.map(c=><tr key={c.id} className="border-b border-hair hover:bg-paper/50">
          <td className="px-4 py-3 font-semibold">{c.name}</td>
          <td className="px-4 py-3"><div className="font-mono text-xs">{c.phone||"—"}</div><div className="text-[10px] text-muted">{c.email||""}</div></td>
          <td className="px-4 py-3">{c.city||"—"}</td>
          <td className="px-4 py-3 font-mono font-semibold">{c.orderCount}</td>
          <td className="px-4 py-3 font-display font-semibold">{formatCOP(Number(c.paidTotal||0))}</td>
          <td className="px-4 py-3 text-xs text-muted">{c.lastOrderAt?new Date(c.lastOrderAt).toLocaleDateString("es-CO"):"—"}</td>
          <td className="px-4 py-3"><button onClick={()=>open(c.id)} className="border border-hair rounded-lg px-3 py-1.5 text-xs font-semibold hover:border-copper">Ver 360°</button></td>
        </tr>)}
        {!filtered.length&&<tr><td colSpan={7} className="p-8 text-center text-sm text-muted">No hay clientes que coincidan.</td></tr>}
      </tbody></table>
    </div>

    {detail&&<div className="fixed inset-0 bg-black/45 z-50 flex justify-end" onClick={()=>setDetail(null)}><aside className="w-[620px] max-w-[98vw] h-full bg-white overflow-y-auto shadow-2xl" onClick={e=>e.stopPropagation()}>
      <header className="sticky top-0 bg-white z-10 border-b border-hair p-5 flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-wider text-copper font-semibold">Cliente 360°</div><h2 className="font-display text-xl font-bold mt-1">{detail.name}</h2><div className="text-xs text-muted mt-1">{detail.phone||"Sin teléfono"} · {detail.city||"Sin ciudad"}</div></div><button onClick={()=>setDetail(null)} className="p-2"><X size={19}/></button></header>
      <div className="p-5 space-y-6">
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <K label="Compras" value={String(detail.orders?.length||0)}/>
          <K label="Total pagado" value={formatCOP(Number(detail.paidTotal||0))}/>
          <K label="Oportunidades" value={String(detail.opportunities?.length||0)}/>
          <K label="Cotizaciones" value={String(detail.quotes?.length||0)}/>
        </section>

        <section className="rounded-xl border border-hair p-4">
          <h3 className="font-semibold text-sm mb-3">Datos del cliente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nombre"><input defaultValue={detail.name||""} onBlur={e=>save({name:e.target.value})} className={inputClass}/></Field>
            <Field label="Teléfono"><input defaultValue={detail.phone||""} onBlur={e=>save({phone:e.target.value})} className={inputClass}/></Field>
            <Field label="Email"><input defaultValue={detail.email||""} onBlur={e=>save({email:e.target.value})} className={inputClass}/></Field>
            <Field label="Ciudad"><input defaultValue={detail.city||""} onBlur={e=>save({city:e.target.value})} className={inputClass}/></Field>
            <div className="sm:col-span-2"><Field label="Dirección"><input defaultValue={detail.address||""} onBlur={e=>save({address:e.target.value})} className={inputClass}/></Field></div>
            <div className="sm:col-span-2"><Field label="Notas"><textarea defaultValue={detail.notes||""} onBlur={e=>save({notes:e.target.value})} rows={3} className={inputClass+" resize-none"}/></Field></div>
          </div>
          {busy&&<div className="text-[10px] text-muted mt-2">Guardando / actualizando…</div>}
        </section>

        <section><h3 className="font-semibold text-sm mb-2">Oportunidades</h3><div className="border border-hair rounded-xl overflow-hidden">
          {!(detail.opportunities||[]).length&&<div className="p-4 text-xs text-muted">Sin oportunidades.</div>}
          {(detail.opportunities||[]).map((o:any)=><div key={o.id} className="px-4 py-3 border-b border-hair last:border-0 flex justify-between gap-3"><div><div className="text-sm font-semibold">{o.title}</div><div className="text-[10px] text-muted">{o.stage} · {o.assignedSellerName||"Sin responsable"}</div></div><div className="font-display font-semibold">{formatCOP(Number(o.value||0))}</div></div>)}
        </div></section>

        <section><h3 className="font-semibold text-sm mb-2">Cotizaciones</h3><div className="border border-hair rounded-xl overflow-hidden">
          {!(detail.quotes||[]).length&&<div className="p-4 text-xs text-muted">Sin cotizaciones.</div>}
          {(detail.quotes||[]).map((q:any)=><div key={q.id} className="px-4 py-3 border-b border-hair last:border-0 flex justify-between gap-3"><div><div className="font-mono text-xs font-semibold">{q.number}</div><div className="text-[10px] text-muted">{q.status} · {new Date(q.createdAt).toLocaleDateString("es-CO")}</div></div><div className="font-display font-semibold">{formatCOP(Number(q.total||0))}</div></div>)}
        </div></section>

        <section><h3 className="font-semibold text-sm mb-2">Pedidos</h3><div className="border border-hair rounded-xl overflow-hidden">
          {!(detail.orders||[]).length&&<div className="p-4 text-xs text-muted">Sin pedidos.</div>}
          {(detail.orders||[]).map((o:any)=><div key={o.id} className="px-4 py-3 border-b border-hair last:border-0"><div className="flex justify-between gap-3"><div><div className="font-mono text-xs font-semibold">{o.number}</div><div className="text-[10px] text-muted">{o.shipStatus} · {o.paymentStatus} · {new Date(o.createdAt).toLocaleDateString("es-CO")}</div></div><div className="font-display font-semibold">{formatCOP(Number(o.total||0))}</div></div><div className="text-[10px] text-muted mt-1">{(o.items||[]).map((i:any)=>i.qty+"× "+i.name).join(" · ")}</div></div>)}
        </div></section>

        <section><h3 className="font-semibold text-sm mb-2">Actividad completa</h3><div className="space-y-2">
          {!(detail.timeline||[]).length&&<div className="text-xs text-muted">Sin actividad.</div>}
          {(detail.timeline||[]).map((a:any)=><div key={a.id} className="border-l-2 border-hair pl-3 py-1"><div className="text-xs">{a.text}</div><div className="text-[9px] text-muted mt-0.5">{a.source} · {a.actorName||"Sistema"} · {new Date(a.createdAt).toLocaleString("es-CO")}</div></div>)}
        </div></section>
      </div>
    </aside></div>}
  </div>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="text-[11px] font-semibold block mb-1.5">{label}</span>{children}</label>}
function K({label,value}:{label:string;value:string}){return <div className="bg-paper rounded-lg p-3"><div className="text-[9px] uppercase tracking-wider text-muted">{label}</div><div className="font-display font-bold text-sm mt-1 break-words">{value}</div></div>}
