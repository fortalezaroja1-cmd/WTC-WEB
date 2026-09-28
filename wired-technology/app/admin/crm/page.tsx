"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDollarSign, Clock3, Filter, Plus, Search, UserRound, X } from "lucide-react";
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
const CAP_LABELS:Record<string,string>={ENTRY:"Entrada",CONTACT:"Contacto inicial",QUALIFY:"Calificación",DIAGNOSE:"Diagnóstico",PROPOSE:"Propuesta",FOLLOW_UP:"Seguimiento",DECISION:"Decisión",CLOSED:"Cerrado"};
const CAP_ORDER=["ENTRY","CONTACT","QUALIFY","DIAGNOSE","PROPOSE","FOLLOW_UP","DECISION","CLOSED"];

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
  useEffect(()=>{load().then(()=>{const id=new URLSearchParams(window.location.search).get("opportunityId");if(id)openDetail(id);});fetch("/api/admin/sales-users",{cache:"no-store"}).then(r=>r.ok?r.json():[]).then(setSellers).catch(()=>setSellers([]));},[]);
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

    <section className="bg-white border border-hair rounded-xl mb-5 overflow-hidden">
      <div className="px-4 py-3 border-b border-hair flex items-center justify-between gap-3">
        <div><h2 className="font-semibold">Qué hacer ahora</h2><p className="text-xs text-muted mt-0.5">Prioridad por vencimiento, falta de responsable y próxima acción.</p></div>
        <span className="text-[10px] uppercase tracking-wider bg-copper/10 text-copper rounded-full px-2 py-1">CAP guiado</span>
      </div>
      <div className="divide-y divide-hair">
        {openItems.slice().sort((a,b)=>{
          const score=(x:any)=>!x.assignedSellerId?-3:!x.nextAction?-2:(x.nextAt&&new Date(x.nextAt).getTime()<Date.now()?-1:new Date(x.nextAt||"2999-01-01").getTime());
          return score(a)-score(b);
        }).slice(0,6).map(x=>{
          const blocked=!x.assignedSellerId||!x.nextAction||!x.nextAt;
          const overdue=x.nextAt&&new Date(x.nextAt).getTime()<Date.now();
          return <button key={x.id} onClick={()=>openDetail(x.id)} className="w-full text-left p-4 hover:bg-paper/60 flex items-center gap-3">
            <div className={"w-9 h-9 rounded-full flex items-center justify-center shrink-0 "+(blocked||overdue?"bg-red-50 text-alert":"bg-green-50 text-green")}>{blocked||overdue?<AlertTriangle size={16}/>:<CheckCircle2 size={16}/>}</div>
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{x.customerName||x.title}</div><div className="text-xs text-muted mt-0.5 truncate">{blocked?(!x.assignedSellerId?"Asignar responsable":"Definir próxima acción y fecha"):(x.nextAction||"Continuar proceso")} · CAP {CAP_LABELS[x.capStep||"ENTRY"]||x.capStep||"Entrada"}</div></div>
            <div className="text-right shrink-0"><div className={"text-[10px] font-semibold "+(overdue?"text-alert":"text-muted")}>{overdue?"VENCIDO":x.nextAt?new Date(x.nextAt).toLocaleString("es-CO"):"SIN FECHA"}</div><ArrowRight size={15} className="ml-auto mt-1 text-copper"/></div>
          </button>
        })}
        {!openItems.length&&<div className="p-6 text-sm text-muted">No hay oportunidades activas pendientes.</div>}
      </div>
    </section>

    {error&&<div className="mb-4 border border-red-100 bg-red-50 text-alert rounded-lg px-4 py-3 text-sm">{error}</div>}

    <div className="overflow-x-auto pb-4 -mx-2 px-2"><div className="flex gap-3 min-w-max items-start">
      {STAGES.map(stage=>{
        const rows=filtered.filter(x=>x.stage===stage.id);
        const value=rows.reduce((s,x)=>s+Number(x.value||0),0);
        return <section key={stage.id} className="w-[292px] rounded-xl border border-hair bg-[#ECEEF1]">
          <div className="px-3.5 py-3 border-b border-hair bg-white rounded-t-xl sticky top-0 z-[1]">
            <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-copper"/><b className="text-sm">{stage.label}</b><span className="text-[10px] bg-paper rounded-full px-2 py-0.5">{rows.length}</span></div><span className="font-mono text-[10px] text-muted">{formatCOP(value)}</span></div>
            <div className="text-[10px] text-muted mt-1 ml-[18px]">{stage.hint}</div>
          </div>
          <div className="p-2.5 min-h-[170px] space-y-2.5">
            {!rows.length&&<div className="border border-dashed border-[#D0D5DB] rounded-lg px-3 py-8 text-center text-[11px] text-muted">Sin oportunidades en esta etapa</div>}
            {rows.map(x=><article key={x.id} onClick={()=>openDetail(x.id)} className={"bg-white rounded-lg border border-hair p-3 cursor-pointer hover:shadow-sm "+(busy===x.id?"opacity-60":"")}>
              <div className="flex gap-2"><div className="min-w-0 flex-1">
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
        <GuidedOpportunityPanel current={current} update={update}/>
        <section className="rounded-xl border border-hair p-4">
          <div className="text-xs font-semibold mb-3">Datos comerciales del cliente</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Nombre"><input defaultValue={current.customerName||""} onBlur={e=>update(current.id,{customerName:e.target.value})} className={inputClass}/></Field>
            <Field label="Teléfono"><input defaultValue={current.phone||""} onBlur={e=>update(current.id,{phone:e.target.value})} className={inputClass}/></Field>
            <Field label="Email"><input defaultValue={current.email||""} onBlur={e=>update(current.id,{email:e.target.value})} className={inputClass}/></Field>
            <Field label="Ciudad"><input defaultValue={current.city||""} onBlur={e=>update(current.id,{city:e.target.value})} className={inputClass}/></Field>
            <div className="sm:col-span-2"><Field label="Dirección"><input defaultValue={current.address||""} onBlur={e=>update(current.id,{address:e.target.value})} className={inputClass}/></Field></div>
          </div>
          <div className="text-[10px] text-muted mt-2">Estos datos se usan al convertir una cotización en pedido.</div>
        </section>
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


function GuidedOpportunityPanel({current,update}:{current:any;update:(id:string,data:any)=>Promise<void>}){
  const [answers,setAnswers]=useState<Record<string,string>>({});
  const [evidence,setEvidence]=useState("");
  const [qualificationDecision,setQualificationDecision]=useState("");
  const [working,setWorking]=useState(false);

  useEffect(()=>{
    setAnswers(typeof current?.capAnswers==="object"&&current.capAnswers?current.capAnswers:{});
    const ev=Array.isArray(current?.capEvidence)?current.capEvidence:[];
    setEvidence(ev.length?String(ev[ev.length-1]?.text||ev[ev.length-1]||""):"");
    setQualificationDecision(current?.qualificationDecision||"");
  },[current?.id,current?.updatedAt]);

  const step=String(current?.capStep||"ENTRY");
  const stepIndex=Math.max(0,CAP_ORDER.indexOf(step));
  const missing:string[]=[];
  if(!current?.assignedSellerId)missing.push("responsable");
  if(step==="ENTRY"&&(!current?.nextAction||!current?.nextAt))missing.push("próxima acción + fecha");
  if(step==="CONTACT"&&!evidence.trim())missing.push("evidencia de contacto");
  if(step==="QUALIFY"){
    [["need","necesidad"],["objective","objetivo"],["problem","problema"],["budget","presupuesto"],["urgency","urgencia"],["decisionMaker","decisor"]].forEach(([k,l])=>{if(!String(answers[k]||"").trim())missing.push(l)});
    if(!qualificationDecision)missing.push("decisión de calificación");
  }
  if(step==="DIAGNOSE"){if(!String(answers.diagnosis||"").trim())missing.push("diagnóstico");if(!String(answers.bottleneck||"").trim())missing.push("cuello de botella")}
  if(step==="PROPOSE"&&Number(current?.quoteCount||0)<1)missing.push("cotización");
  if(step==="FOLLOW_UP"&&(!current?.nextAction||!current?.nextAt))missing.push("próxima acción + fecha");
  const ready=missing.length===0;

  const advance=async()=>{
    setWorking(true);
    const ev=Array.isArray(current?.capEvidence)?current.capEvidence:[];
    const payload:any={advanceCap:true,capAnswers:answers,qualificationDecision};
    if(step==="CONTACT"&&evidence.trim())payload.capEvidence=[...ev,{text:evidence.trim(),at:new Date().toISOString()}];
    await update(current.id,payload);
    setWorking(false);
  };
  const close=async(stage:"WON"|"LOST")=>{
    let lossReason="";
    if(stage==="LOST"){lossReason=window.prompt("Motivo de pérdida (obligatorio):")||"";if(!lossReason.trim())return;}
    setWorking(true);await update(current.id,{stage,lossReason:lossReason||undefined});setWorking(false);
  };

  return <section className="rounded-xl border-2 border-copper/25 bg-[#FFF9F4] p-4">
    <div className="flex items-start justify-between gap-3">
      <div><div className="text-[10px] uppercase tracking-[.14em] font-semibold text-copper">CAP · sistema guiado</div><h3 className="font-display text-lg font-bold mt-1">{CAP_LABELS[step]||step}</h3><p className="text-xs text-muted mt-1">El Pipeline indica dónde está el negocio. CAP indica qué debes hacer ahora.</p></div>
      <span className={"text-[10px] font-bold rounded-full px-2.5 py-1 "+(ready?"bg-green-50 text-green":"bg-red-50 text-alert")}>{ready?"LISTO":"NO LISTO"}</span>
    </div>
    <div className="mt-4 flex gap-1">{CAP_ORDER.slice(0,-1).map((s,i)=><div key={s} title={CAP_LABELS[s]} className={"h-1.5 flex-1 rounded-full "+(i<=stepIndex?"bg-copper":"bg-[#E4E6E9]")}/>)}</div>

    <div className="mt-4 rounded-lg bg-white border border-hair p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">Qué hacer ahora</div>
      <div className="text-sm font-semibold mt-1">{step==="ENTRY"?"Asignar responsable y programar el primer contacto":step==="CONTACT"?"Ejecutar contacto y dejar evidencia":step==="QUALIFY"?"Completar las preguntas obligatorias de calificación":step==="DIAGNOSE"?"Determinar diagnóstico y cuello de botella":step==="PROPOSE"?"Crear una cotización válida para el prospecto":step==="FOLLOW_UP"?"Dejar próxima acción y fecha de seguimiento":step==="DECISION"?"Registrar la decisión comercial":"Proceso cerrado"}</div>
      {!ready&&<div className="text-xs text-alert mt-2">Falta: {missing.join(", ")}.</div>}
    </div>

    {step==="CONTACT"&&<Field label="Evidencia de contacto"><textarea value={evidence} onChange={e=>setEvidence(e.target.value)} rows={2} className={inputClass+" resize-none"} placeholder="Ej. llamada realizada, respondió y solicitó información…"/></Field>}
    {step==="QUALIFY"&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      {([["need","Qué necesita"],["objective","Objetivo"],["problem","Problema principal"],["budget","Presupuesto aproximado"],["urgency","Urgencia"],["decisionMaker","Quién decide"]] as const).map(([k,l])=><Field key={k} label={l}><input value={answers[k]||""} onChange={e=>setAnswers({...answers,[k]:e.target.value})} className={inputClass}/></Field>)}
      <div className="sm:col-span-2"><Field label="Decisión de calificación"><select value={qualificationDecision} onChange={e=>setQualificationDecision(e.target.value)} className={inputClass}><option value="">Seleccionar…</option><option value="QUALIFIES">Califica</option><option value="MISSING_INFO">Falta información</option><option value="NO_QUALIFIES">No califica</option></select></Field></div>
    </div>}
    {step==="DIAGNOSE"&&<div className="grid grid-cols-1 gap-3 mt-4"><Field label="Diagnóstico estructurado"><textarea value={answers.diagnosis||""} onChange={e=>setAnswers({...answers,diagnosis:e.target.value})} rows={2} className={inputClass+" resize-none"}/></Field><Field label="Cuello de botella"><input value={answers.bottleneck||""} onChange={e=>setAnswers({...answers,bottleneck:e.target.value})} className={inputClass}/></Field></div>}
    {step==="PROPOSE"&&<div className="mt-4 flex items-center justify-between gap-3 bg-white border border-hair rounded-lg p-3"><div><div className="text-sm font-semibold">{current.quoteCount||0} cotización(es)</div><div className="text-[10px] text-muted">La propuesta solo avanza cuando existe una cotización.</div></div><Link href={"/admin/cotizaciones?opportunityId="+current.id} className="text-xs font-semibold text-copper">Abrir cotizaciones →</Link></div>}

    {step==="DECISION"?<div className="grid grid-cols-2 gap-2 mt-4"><button disabled={working} onClick={()=>close("WON")} className="bg-green text-white rounded-lg py-2.5 text-sm font-semibold">Cerrar ganado</button><button disabled={working} onClick={()=>close("LOST")} className="bg-white border border-alert/30 text-alert rounded-lg py-2.5 text-sm font-semibold">Cerrar perdido</button></div>:step!=="CLOSED"&&<button disabled={!ready||working} onClick={advance} className="mt-4 w-full bg-copper text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40">{working?"Validando…":"Completar paso y continuar →"}</button>}
  </section>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="text-[11px] font-semibold block mb-1.5">{label}</span>{children}</label>}
function Metric({icon:Icon,label,value,helper,warn=false}:{icon:any;label:string;value:string;helper:string;warn?:boolean}){return <div className="bg-white border border-hair rounded-xl p-4"><div className="flex justify-between gap-2"><span className="text-[10px] uppercase tracking-wider text-muted">{label}</span><Icon size={16} className={warn?"text-alert":"text-copper"}/></div><div className={"font-display text-xl font-bold mt-2 "+(warn?"text-alert":"")}>{value}</div><div className="text-[10px] text-muted mt-1">{helper}</div></div>}
