"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Check, LockKeyhole, ShieldCheck } from "lucide-react";

const DEFAULTS={
  agentTeamMission:"Ayudar al equipo de Wired a vender mejor, atender pendientes y operar usando únicamente información real del sistema.",
  agentTeamPriorities:"1. Seguimientos vencidos y clientes activos. 2. Pedidos que requieren atención. 3. Oportunidades comerciales. 4. Inventario crítico.",
  agentTeamRules:"No inventar datos, precios, stock, descuentos, clientes ni estados. No afirmar que una acción se realizó si no se ejecutó. Respetar los permisos del usuario. Si falta información, decirlo claramente.",
  agentTeamEscalation:"Escalar a una persona ante reclamos, excepciones comerciales, descuentos no autorizados, decisiones sensibles o cuando Wired no tenga información suficiente.",
};

export default function AgentControlPage(){
  const [cfg,setCfg]=useState<Record<string,string>>(DEFAULTS);
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  useEffect(()=>{fetch("/api/admin/settings",{cache:"no-store"}).then(r=>r.json()).then(d=>setCfg({...DEFAULTS,...d}))},[]);
  const save=async()=>{setSaving(true);await fetch("/api/admin/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({
    agentTeamMission:cfg.agentTeamMission,
    agentTeamPriorities:cfg.agentTeamPriorities,
    agentTeamRules:cfg.agentTeamRules,
    agentTeamEscalation:cfg.agentTeamEscalation,
  })});setSaving(false);setSaved(true);setTimeout(()=>setSaved(false),1800)};
  const fields=[
    ["agentTeamMission","Misión","Qué papel cumple el agente cuando ayuda al equipo."],
    ["agentTeamPriorities","Prioridades","Qué debe atender primero cuando orienta a un empleado."],
    ["agentTeamRules","Reglas obligatorias","Límites que nunca debe romper."],
    ["agentTeamEscalation","Escalamiento humano","Cuándo debe dejar la decisión en manos de una persona."],
  ];
  return <div className="max-w-[1100px]">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5"><div><div className="flex items-center gap-2"><Bot size={21} className="text-copper"/><h1 className="font-display text-2xl font-bold">Centro de control del agente</h1></div><p className="text-sm text-muted mt-1">Conocimiento, límites y capacidades reales de los asistentes Wired.</p></div><Link href="/admin/agente" className="border border-hair bg-white rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-2 w-fit"><ArrowLeft size={14}/>Volver a pruebas</Link></div>
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-5">
      <section className="bg-white border border-hair rounded-xl p-5">
        <h2 className="font-semibold mb-1">Educación del agente interno</h2><p className="text-xs text-muted mb-5">Estos textos sí forman parte de la guía que consulta el asistente del equipo.</p>
        <div className="space-y-4">{fields.map(([key,label,help])=><label key={key} className="block"><span className="text-xs font-semibold">{label}</span><span className="text-[10px] text-muted ml-2">{help}</span><textarea rows={4} value={cfg[key]||""} onChange={e=>setCfg({...cfg,[key]:e.target.value})} className="mt-1.5 w-full border border-hair rounded-lg px-3 py-2.5 text-sm resize-y outline-none focus:border-copper"/></label>)}</div>
        <div className="flex items-center gap-3 mt-5"><button onClick={save} disabled={saving} className="bg-copper text-white rounded-lg px-5 py-2.5 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-50"><Check size={15}/>{saving?"Guardando…":"Guardar educación"}</button>{saved&&<span className="text-xs font-semibold text-green">Guardado</span>}</div>
      </section>
      <aside className="space-y-4">
        <Card title="Agente interno" items={[
          ["Consultar CRM, oportunidades y seguimientos",true],
          ["Consultar pedidos y ventas",true],
          ["Consultar productos e inventario",true],
          ["Respetar permisos del usuario",true],
          ["Cambiar precios o inventario por chat",false],
          ["Cancelar pedidos sin confirmación",false],
        ]}/>
        <Card title="Agente de clientes" items={[
          ["Consultar catálogo y reglas comerciales",true],
          ["Mantener contexto de compra",true],
          ["Crear lead cuando detecta intención",true],
          ["Inventar precio o stock",false],
          ["Autorizar descuentos por cuenta propia",false],
          ["Mostrar datos internos del CRM",false],
        ]}/>
        <div className="rounded-xl border border-copper/20 bg-[#FFF9F4] p-4"><div className="flex gap-2 items-center text-sm font-semibold"><ShieldCheck size={16} className="text-copper"/>Modo seguro activo</div><p className="text-[11px] text-muted mt-2 leading-relaxed">Las operaciones sensibles siguen siendo humanas. Cuando habilitemos acciones por agente, tendrán confirmación y auditoría antes de ejecutarse.</p></div>
      </aside>
    </div>
  </div>
}

function Card({title,items}:{title:string;items:Array<[string,boolean]>}){return <div className="bg-white border border-hair rounded-xl p-4"><div className="font-semibold text-sm mb-3">{title}</div><div className="space-y-2">{items.map(([label,on])=><div key={label} className="flex items-start gap-2 text-xs"><div className={"mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 "+(on?"bg-green-50 text-green":"bg-paper text-muted")}>{on?<Check size={12}/>:<LockKeyhole size={11}/>}</div><span className={on?"":"text-muted"}>{label}</span></div>)}</div></div>}
