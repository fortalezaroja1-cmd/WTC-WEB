"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleDollarSign, Clock3, Filter, GripVertical, Plus, Search, UserRound, X } from "lucide-react";
import { formatCOP, timeAgo } from "@/lib/utils";

const STAGES = [
  { id: "NEW", label: "Nuevo", hint: "Oportunidades nuevas" },
  { id: "CONTACTED", label: "Contactado", hint: "Primer contacto hecho" },
  { id: "QUOTED", label: "Cotizado", hint: "Cotización enviada" },
  { id: "NEGOTIATION", label: "Negociación", hint: "Definiendo cierre" },
  { id: "WON", label: "Ganado", hint: "Venta concretada" },
  { id: "LOST", label: "Perdido", hint: "No concretado" },
] as const;
const OPEN = new Set(["NEW","CONTACTED","QUOTED","NEGOTIATION"]);
const inputClass = "w-full border border-hair rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-copper";

export default function CrmPage() {
  const [items,setItems]=useState<any[]>([]);
  const [sellers,setSellers]=useState<any[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [detail,setDetail]=useState<any|null>(null);
  const [query,setQuery]=useState("");
  const [sellerFilter,setSellerFilter]=useState("ALL");
  const [dragging,setDragging]=useState<string|null>(null);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [newOpen,setNewOpen]=useState(false);
  const [newForm,setNewForm]=useState({customerName:"",phone:"",title:"",value:""});

  const load=async()=>{
    const r=await fetch("/api/admin/opportunities",{cache:"no-store"});
    const d=await r.json();
    if(r.ok)setItems(Array.isArray(d)?d:[]);
  };
  useEffect(()=>{load();fetch("/api/admin/sales-users",{cache:"no-store"}).then(r=>r.ok?r.json():[]).then(setSellers).catch(()=>setSellers([]));},[]);
  const current=useMemo(()=>detail||items.find(x=>x.id===selected),[items,selected,detail]);

  const openDetail=async(id:string)=>{
    setSelected(id);setDetail(null);
    try{const r=await fetch("/api/admin/opportunities?id="+encodeURIComponent(id),{cache:"no-store"});const d=await r.json();if(r.ok)setDetail(d);}catch{}
  };

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return items.filter(x=>{
      if(sellerFilter==="UNASSIGNED"&&x.assignedSellerId)return false;
      if(sellerFilter!=="ALL"&&sellerFilter!=="UNASSIGNED"&&x.assignedSellerId!==sellerFilter)return false;
      if(!q)return true;
      return [x.customerName,x.phone,x.title,x.city,x.source,x.assignedSellerName].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  },[items,query,sellerFilter]);

  const update=async(id:string,data:any)=>{
    setBusy(id);setError("");
    try{
      const r=await fetch("/api/admin/opportunities",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,...data})});
      const d=await r.json(); if(!r.ok)throw new Error(d.error||"No se pudo actualizar");
      await load();
      if(selected===id)await openDetail(id);
    }catch(e:any){setError(e.message);}finally{setBusy("");setDragging(null);}
  };

  const move=async(item:any,stage:string)=>{
    if(!item||item.stage===stage||busy)return;
    if(stage==="LOST"){
      const lossReason=window.prompt("Motivo de pérdida (opcional):")||"";
      await update(item.id,{stage,lossReason});
    }else await update(item.id,{stage});
  };

  const create=async()=>{
    if(!newForm.customerName.trim()&&!newForm.title.trim())return;
    setBusy("new");setError("");
    try{
      const r=await fetch("/api/admin/opportunities",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...newForm,value:Number(newForm.value||0),source:"MANUAL"})});
      const d=await r.json(); if(!r.ok)throw new Error(d.error||"No se pudo crear");
      setNewOpen(false);setNewForm({customerName:"",phone:"",title:"",value:""});await load();openDetail(d.id);
    }catch(e:any){setError(e.message);}finally{setBusy("");}
  };

  const openItems=filtered.filter(x=>OPEN.has(x.stage));
  const pipelineValue=openItems.reduce((s,x)=>s+Number(x.value||0),0);
  const overdue=openItems.filter(x=>x.nextAt&&new Date(x.nextAt).getTime()<Date.now()).length;
  const wonValue=filtered.filter(x=>x.stage==="WON").reduce((s,x)=>s+Number(x.value||0),0);
  const unassigned=openItems.filter(x=>!x.assignedSellerId).length;

  return <div className="min-w-0">
    <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 mb-5">
      <div>
        <div className="flex items-center gap-2"><h1 className="font-display text-2xl font-bold">CRM de ventas</h1><span className="text-[9px] uppercase tracking-wider bg-copper/10 text-copper px-2 py-1 rounded-full">Pipeline comercial</span></div>
        <p className="text-sm text-muted mt-1">Del primer interés al cierre. Los pedidos se gestionan aparte en Operación.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente, teléfono..." className="w-full sm:w-[260px] bg-white border border-hair rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:border-copper"/></div>
        <div className="relative"><Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/><select value={sellerFilter} onChange={e=>setSellerFilter(e.target.value)} className="w-full sm:w-[190px] bg-white border border-hair rounded-lg pl-9 pr-3 py-2.5 text-sm"><option value="ALL">Todos los vendedores</option><option value="UNASSIGNED">Sin asignar</option>{sellers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <button onClick={()=>setNewOpen(true)} className="bg-graphite text-white rounded-lg px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2"><Plus size={15}/> Nueva</button>
      </div>
    </div>

    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      <Metric icon={CircleDollarSign} label="Pipeline abierto" value={formatCOP(pipelineValue)} helper={openItems.length+" oportunidades"}/>
      <Metric icon={Clock3} label="Seguimientos vencidos" value={String(overdue)} helper="Requieren atención" warn={overdue>0}/>
      <Metric icon={UserRound} label="Sin responsable" value={String(unassigned)} helper="Por asignar" warn={unassigned>0}/>
      <Metric icon={CircleDollarSign} label="Ganado" value={formatCOP(wonValue)} helper="Valor registrado"/>
    </div>

    {error&&<div className="mb-4 border border-red-100 bg-red-50 text-alert rounded-lg px-4 py-3 text-sm">{error}</div>}

    <div className="overflow-x-auto pb-4 -mx-2 px-2"><div className="flex gap-3 min-w-max items-start">
      {STAGES.map(stage=>{
        const rows=filtered.filter(x=>x.stage===stage.id);
        const value=rows.reduce((s,x)=>s+Number(x.value||0),0);
        return <section key={stage.id} onDragOver={e=>e.preventDefault()} onDrop={()=>move(items.find(x=>x.id===dragging),stage.id)} className="w-[292px] rounded-xl border border-hair bg-[#ECEEF1]">
          <div className="px-3.5 py-3 border-b border-hair bg-white rounded-t-xl sticky top-0 z-[1]">
            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-copper"/><b className="text-sm">{stage.label}</b><span className="text-[10px] bg-paper rounded-full px-2 py-0.5">{rows.length}</span></div><span className="font-mono text-[10px] text-muted">{formatCOP(value)}</span></div>
            <div className="text-[10px] text-muted mt-1 ml-[18px]">{stage.hint}</div>
          </div>
          <div className="p-2.5 min-h-[170px] space-y-2.5">
            {!rows.length&&<div className="border border-dashed border-[#D0D5DB] rounded-lg px-3 py-8 text-center text-[11px] text-muted">Arrastra una oportunidad aquí</div>}
            {rows.map(x=><article key={x.id} draggable={!busy} onDragStart={()=>setDragging(x.id)} onDragEnd={()=>setDragging(null)} onClick={()=>openDetail(x.id)} className={"bg-white rounded-lg border border-hair p-3 cursor-pointer hover:shadow-sm "+(busy===x.id?"opacity-60":"")}>
              <div className="flex gap-2"><GripVertical size={14} className="text-[#B4BAC2] mt-0.5"/><div className="min-w-0 flex-1">
                <div className="font-semibold text-[13px] truncate">{x.customerName||x.title}</div>
                <div className="text-[10px] text-muted truncate mt-0.5">{x.title}</div>
                <div className="font-display text-[15px] font-bold mt-2">{formatCOP(Number(x.value||0))}</div>
                <div className="flex items-center justify-between gap-2 border-t border-hair pt-2 mt-2"><span className={"text-[10px] truncate "+(x.assignedSellerName?"":"text-alert font-semibold")}>{x.assignedSellerName||"Sin asignar"}</span><span className="text-[9px] text-muted">{timeAgo(x.updatedAt)}</span></div>
                {x.nextAt&&<div className={"text-[9px] mt-2 rounded-full px-2 py-1 inline-block "+(new Date(x.nextAt).getTime()<Date.now()?"bg-red-50 text-alert":"bg-paper text-muted")}>{new Date(x.nextAt).toLocaleString("es-CO")}</div>}
                <div className="mt-2 text-[9px] text-muted">{x.source||"Manual"}{x.quoteCount?" · "+x.quoteCount+" cot.":""}</div>
              </div></div>
            </article>)}
          </div>
        </section>
      })}
    </div></div>

    <div className="border-t border-hair pt-4 text-xs text-muted flex justify-between gap-3"><span>Pipeline comercial separado del flujo logístico de pedidos.</span><Link href="/admin/cotizaciones" className="text-copper font-semibold">Ver cotizaciones →</Link></div>

    {current&&<div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={()=>{setSelected(null);setDetail(null)}}><aside className="w-[500px] max-w-[96vw] h-full bg-white shadow-xl overflow-y-auto" onClick={e=>e.stopPropagation()}>
      <div className="sticky top-0 bg-white z-10 border-b border-hair p-5 flex items-start justify-between gap-3"><div><div className="text-[10px] uppercase tracking-wider text-copper font-semibold">{current.stage}</div><h2 className="font-display text-xl font-bold mt-1">{current.customerName||current.title}</h2><div className="text-xs text-muted mt-1">{current.phone||"Sin teléfono"} · {current.source||"Manual"}</div></div><button onClick={()=>{setSelected(null);setDetail(null)}} className="p-2"><X size={19}/></button></div>
      <div className="p-5 space-y-5">
        <section className="grid grid-cols-2 gap-3">
          <Field label="Valor"><input type="number" defaultValue={Number(current.value||0)} onBlur={e=>update(current.id,{value:Number(e.target.value||0)})} className={inputClass}/></Field>
          <Field label="Prioridad"><select value={current.priority||"MEDIUM"} onChange={e=>update(current.id,{priority:e.target.value})} className={inputClass}><option value="LOW">Baja</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option></select></Field>
        </section>
        <Field label="Responsable"><select value={current.assignedSellerId||""} onChange={e=>{const s=sellers.find(x=>x.id===e.target.value);update(current.id,{assignedSellerId:s?.id||"",assignedSellerName:s?.name||""})}} className={inputClass}><option value="">Sin asignar</option>{sellers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Próxima acción"><input defaultValue={current.nextAction||""} onBlur={e=>update(current.id,{nextAction:e.target.value})} placeholder="Ej. llamar y confirmar" className={inputClass}/></Field>
          <Field label="Fecha de seguimiento"><input type="datetime-local" defaultValue={current.nextAt?new Date(new Date(current.nextAt).getTime()-new Date(current.nextAt).getTimezoneOffset()*60000).toISOString().slice(0,16):""} onBlur={e=>update(current.id,{nextAt:e.target.value||null})} className={inputClass}/></Field>
        </section>
        <Field label="Notas"><textarea defaultValue={current.notes||""} onBlur={e=>update(current.id,{notes:e.target.value})} rows={4} className={inputClass+" resize-none"} placeholder="Contexto comercial, objeciones, acuerdos..."/></Field>
        <section className="rounded-xl border border-hair p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-semibold text-sm">Cotizaciones</div><div className="text-xs text-muted mt-1">{current.quoteCount||0} registrada(s){current.latestQuoteNumber?" · última "+current.latestQuoteNumber:""}</div></div><Link href={"/admin/cotizaciones?opportunityId="+current.id} className="bg-copper text-white rounded-lg px-3 py-2 text-xs font-semibold">Crear / ver</Link></div></section>
        <section><div className="text-[10px] uppercase tracking-[.14em] font-semibold text-muted mb-2">Actividad</div><div className="space-y-2">{(current.activities||[]).map((a:any)=><div key={a.id} className="border-l-2 border-hair pl-3 text-xs"><div>{a.text}</div><div className="text-[9px] text-muted mt-0.5">{a.actorName||"Sistema"} · {new Date(a.createdAt).toLocaleString("es-CO")}</div></div>)}{!(current.activities||[]).length&&<div className="text-xs text-muted">Sin actividad registrada todavía.</div>}</div></section>
      </div>
    </aside></div>}

    {newOpen&&<div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setNewOpen(false)}><div className="bg-white rounded-2xl border border-hair w-full max-w-[520px] p-5" onClick={e=>e.stopPropagation()}><div className="flex justify-between items-center mb-4"><h2 className="font-display text-lg font-bold">Nueva oportunidad</h2><button onClick={()=>setNewOpen(false)}><X size={18}/></button></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><Field label="Cliente"><input value={newForm.customerName} onChange={e=>setNewForm({...newForm,customerName:e.target.value})} className={inputClass}/></Field><Field label="Teléfono"><input value={newForm.phone} onChange={e=>setNewForm({...newForm,phone:e.target.value})} className={inputClass}/></Field><div className="sm:col-span-2"><Field label="Oportunidad"><input value={newForm.title} onChange={e=>setNewForm({...newForm,title:e.target.value})} placeholder="Ej. Compra cableado obra norte" className={inputClass}/></Field></div><Field label="Valor estimado"><input type="number" value={newForm.value} onChange={e=>setNewForm({...newForm,value:e.target.value})} className={inputClass}/></Field></div><button onClick={create} disabled={busy==="new"} className="mt-5 w-full bg-copper text-white rounded-lg py-2.5 text-sm font-semibold">{busy==="new"?"Creando...":"Crear oportunidad"}</button></div></div>}
  </div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="text-[11px] font-semibold block mb-1.5">{label}</span>{children}</label>}
function Metric({icon:Icon,label,value,helper,warn=false}:{icon:any;label:string;value:string;helper:string;warn?:boolean}){return <div className="bg-white border border-hair rounded-xl p-4"><div className="flex justify-between gap-2"><span className="text-[10px] uppercase tracking-wider text-muted">{label}</span><Icon size={16} className={warn?"text-alert":"text-copper"}/></div><div className={"font-display text-xl font-bold mt-2 "+(warn?"text-alert":"")}>{value}</div><div className="text-[10px] text-muted mt-1">{helper}</div></div>}
