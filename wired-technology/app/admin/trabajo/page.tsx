"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, MessageCircle, Phone, Play, RefreshCcw, UserRound } from "lucide-react";

const CAP_LABELS:Record<string,string>={ENTRY:"Entrada",CONTACT:"Contacto inicial",QUALIFY:"Calificación",DIAGNOSE:"Diagnóstico",PROPOSE:"Propuesta",FOLLOW_UP:"Seguimiento",DECISION:"Decisión",CLOSED:"Cerrado"};

function phoneHref(phone:string){
  const digits=String(phone||"").replace(/\D/g,"");
  return digits?"tel:+"+digits:"#";
}
function waHref(phone:string){
  const digits=String(phone||"").replace(/\D/g,"");
  return digits?"https://wa.me/"+digits:"#";
}
function dueLabel(value?:string|null){
  if(!value)return "Sin fecha";
  const d=new Date(value);
  const overdue=d.getTime()<Date.now();
  return (overdue?"Vencida · ":"")+d.toLocaleString("es-CO");
}

export default function TrabajoPage(){
  const [current,setCurrent]=useState<any|null>(null);
  const [stats,setStats]=useState<any>({mine:0,unassigned:0,overdue:0});
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");

  const load=async()=>{
    setLoading(true);setError("");
    try{
      const r=await fetch("/api/admin/work-queue",{cache:"no-store"});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"No se pudo cargar");
      setCurrent(d.current||null);setStats(d.stats||{mine:0,unassigned:0,overdue:0});
    }catch(e:any){setError(e.message||"No se pudo cargar la cola");}
    finally{setLoading(false);}
  };

  const claim=async()=>{
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/admin/work-queue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"claim-next"})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"No se pudo asignar");
      setCurrent(d.current||null);
      await load();
    }catch(e:any){setError(e.message||"No se pudo asignar");}
    finally{setBusy(false);}
  };

  const snooze=async(minutes:number)=>{
    if(!current)return;
    setBusy(true);setError("");
    try{
      const r=await fetch("/api/admin/work-queue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"snooze",id:current.id,minutes})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"No se pudo aplazar");
      await load();
    }catch(e:any){setError(e.message||"No se pudo aplazar");}
    finally{setBusy(false);}
  };

  useEffect(()=>{load();},[]);

  const isAssigned=Boolean(current?.assignedSellerId);
  const overdue=Boolean(current?.nextAt&&new Date(current.nextAt).getTime()<Date.now());
  const action=useMemo(()=>{
    if(!current)return "";
    if(Number(current.unreadCount||0)>0)return "Responder al cliente: hay un mensaje nuevo";
    if(current.nextAction)return current.nextAction;
    const step=String(current.capStep||"ENTRY");
    if(step==="ENTRY")return "Realizar el primer contacto";
    if(step==="CONTACT")return "Registrar evidencia del contacto";
    if(step==="QUALIFY")return "Completar la calificación";
    if(step==="DIAGNOSE")return "Completar el diagnóstico";
    if(step==="PROPOSE")return "Preparar y enviar la propuesta";
    if(step==="FOLLOW_UP")return "Ejecutar el seguimiento";
    if(step==="DECISION")return "Cerrar la decisión comercial";
    return "Continuar la gestión";
  },[current]);

  return <div className="max-w-[1180px] mx-auto">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
      <div>
        <div className="text-[10px] uppercase tracking-[.16em] text-copper font-semibold">Ejecución comercial</div>
        <h1 className="font-display text-2xl font-bold mt-1">Próxima tarea</h1>
        <p className="text-sm text-muted mt-1">Wired decide qué lead atender primero. El vendedor ejecuta, registra el resultado y sigue con el siguiente.</p>
      </div>
      <button onClick={load} disabled={loading||busy} className="border border-hair bg-white rounded-lg px-3 py-2.5 text-sm font-semibold inline-flex items-center gap-2 w-fit disabled:opacity-50"><RefreshCcw size={15}/>Actualizar cola</button>
    </div>

    <div className="grid grid-cols-3 gap-3 mb-5">
      <Metric label="Mis tareas" value={stats.mine||0} icon={UserRound}/>
      <Metric label="Vencidas" value={stats.overdue||0} icon={Clock3} warn={Number(stats.overdue||0)>0}/>
      <Metric label="Sin asignar" value={stats.unassigned||0} icon={AlertTriangle} warn={Number(stats.unassigned||0)>0}/>
    </div>

    {error&&<div className="mb-4 border border-red-100 bg-red-50 text-alert rounded-lg px-4 py-3 text-sm">{error}</div>}

    {loading?<div className="bg-white border border-hair rounded-2xl p-10 text-sm text-muted">Ordenando prioridades…</div>:
    !current?<section className="bg-white border border-hair rounded-2xl p-10 text-center">
      <CheckCircle2 size={34} className="mx-auto text-green"/>
      <h2 className="font-display text-xl font-bold mt-3">No hay tareas pendientes</h2>
      <p className="text-sm text-muted mt-2">La cola está limpia. Cuando entre un nuevo lead o venza un seguimiento aparecerá aquí.</p>
    </section>:
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_330px] gap-5">
      <section className="bg-white border border-hair rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-hair bg-[#FFF9F4]">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-wider bg-copper/10 text-copper rounded-full px-2.5 py-1">Prioridad {current.priority||"MEDIUM"}</span>
                {Number(current.unreadCount||0)>0&&<span className="text-[10px] uppercase tracking-wider bg-red-50 text-alert rounded-full px-2.5 py-1">{current.unreadCount} mensaje(s) nuevo(s)</span>}
                {overdue&&<span className="text-[10px] uppercase tracking-wider bg-red-50 text-alert rounded-full px-2.5 py-1">Vencida</span>}
              </div>
              <h2 className="font-display text-2xl font-bold mt-3">{current.customerName||current.title||"Cliente"}</h2>
              <div className="text-sm text-muted mt-1">{current.phone||"Sin teléfono"} · {current.source||"Sin origen"}</div>
            </div>
            {!isAssigned&&<button onClick={claim} disabled={busy} className="bg-copper text-white rounded-lg px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"><Play size={15}/>Tomar esta tarea</button>}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="rounded-xl border-2 border-copper/25 p-5">
            <div className="text-[10px] uppercase tracking-[.14em] text-muted">Tarea actual</div>
            <div className="font-display text-xl font-bold mt-2">{action}</div>
            <div className="flex items-center gap-2 text-xs text-muted mt-3"><CalendarClock size={14}/>{dueLabel(current.nextAt)}</div>

            {current.lastMessageText&&<div className="mt-4 bg-paper rounded-lg p-3"><div className="text-[10px] uppercase tracking-wider text-muted">Último mensaje</div><div className="text-sm mt-1">{current.lastMessageText}</div></div>}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-5">
              {current.phone&&<a href={phoneHref(current.phone)} className="border border-hair rounded-lg px-3 py-2.5 text-sm font-semibold flex items-center justify-center gap-2"><Phone size={15}/>Llamar</a>}
              {current.phone&&<a href={waHref(current.phone)} target="_blank" rel="noreferrer" className="border border-hair rounded-lg px-3 py-2.5 text-sm font-semibold flex items-center justify-center gap-2"><MessageCircle size={15}/>WhatsApp</a>}
              <button type="button" disabled className="bg-graphite/40 text-white rounded-lg px-3 py-2.5 text-sm font-semibold flex items-center justify-center gap-2 cursor-not-allowed">Gestión guiada aquí</button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-hair rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted">Paso CAP</div>
              <div className="font-semibold mt-1">{CAP_LABELS[current.capStep||"ENTRY"]||current.capStep||"Entrada"}</div>
              <p className="text-xs text-muted mt-2">El Pipeline indica dónde está el negocio; CAP determina qué debe hacer el agente ahora.</p>
            </div>
            <div className="border border-hair rounded-xl p-4">
              <div className="text-[10px] uppercase tracking-wider text-muted">Etapa comercial</div>
              <div className="font-semibold mt-1">{current.stage||"NEW"}</div>
              <div className="text-xs text-muted mt-2">{current.assignedSellerName?"Responsable: "+current.assignedSellerName:"Aún sin responsable"}</div>
            </div>
          </div>

          {isAssigned&&<div className="mt-5 flex flex-wrap gap-2">
            <button disabled={busy} onClick={()=>snooze(60)} className="border border-hair bg-white rounded-lg px-3 py-2 text-xs font-semibold">Retomar en 1 hora</button>
            <button disabled={busy} onClick={()=>snooze(180)} className="border border-hair bg-white rounded-lg px-3 py-2 text-xs font-semibold">Retomar en 3 horas</button>
            <button disabled={busy} onClick={()=>snooze(1440)} className="border border-hair bg-white rounded-lg px-3 py-2 text-xs font-semibold">Retomar mañana</button>
          </div>}
        </div>
      </section>

      <aside className="space-y-4">
        <div className="bg-graphite text-white rounded-2xl p-5">
          <div className="text-[10px] uppercase tracking-[.14em] text-[#9AA3AD]">Regla de trabajo</div>
          <div className="font-display text-lg font-bold mt-2">No escojas leads.</div>
          <p className="text-xs text-[#C4CCD6] mt-2 leading-relaxed">Wired ordena la cola por mensajes nuevos, vencimiento, prioridad y antigüedad. Cuando termines una gestión, vuelve aquí para recibir la siguiente.</p>
          <button onClick={claim} disabled={busy} className="mt-4 w-full bg-copper text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50">Próxima tarea →</button>
        </div>
        <div className="bg-white border border-hair rounded-xl p-4">
          <div className="font-semibold text-sm">Cómo se prioriza</div>
          <div className="mt-3 space-y-2 text-xs text-muted">
            <div>1. Leads que ya tienes asignados.</div>
            <div>2. Clientes con mensaje nuevo.</div>
            <div>3. Seguimientos vencidos.</div>
            <div>4. Prioridad alta, media y baja.</div>
            <div>5. Antigüedad de la tarea.</div>
          </div>
        </div>
      </aside>
    </div>}
  </div>
}

function Metric({label,value,icon:Icon,warn=false}:{label:string;value:number;icon:any;warn?:boolean}){
  return <div className="bg-white border border-hair rounded-xl p-4"><div className="flex items-center justify-between gap-2"><span className="text-[10px] uppercase tracking-wider text-muted">{label}</span><Icon size={15} className={warn?"text-alert":"text-copper"}/></div><div className={"font-display text-xl font-bold mt-2 "+(warn?"text-alert":"")}>{value}</div></div>
}
