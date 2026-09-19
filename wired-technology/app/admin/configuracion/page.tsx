"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";

const FIELDS = [
  ["storeName","Nombre del negocio","text"],
  ["whatsapp","WhatsApp principal","text"],
  ["city","Ciudad base","text"],
  ["workStart","Lunes a viernes · inicio","time"],
  ["workEnd","Lunes a viernes · fin","time"],
  ["saturdayStart","Sábado · inicio","time"],
  ["saturdayEnd","Sábado · fin","time"],
  ["responseSlaMinutes","Meta de primera respuesta (minutos)","number"],
  ["followupHours","Seguimiento sin respuesta (horas)","number"],
  ["agentTeamMission","Misión del agente interno","textarea"],
  ["agentTeamPriorities","Prioridades del equipo","textarea"],
  ["agentTeamRules","Reglas que nunca debe romper","textarea"],
  ["agentTeamEscalation","Cuándo debe escalar a una persona","textarea"],
] as const;

export default function ConfiguracionPage(){
  const [cfg,setCfg]=useState<Record<string,string>>({});
  const [saving,setSaving]=useState(false);
  const [saved,setSaved]=useState(false);
  useEffect(()=>{ fetch("/api/admin/settings").then(r=>r.json()).then((d)=>setCfg({ workStart:"06:00", workEnd:"19:00", saturdayStart:"07:00", saturdayEnd:"14:00", responseSlaMinutes:"10", followupHours:"24", agentTeamMission:"Ayudar al equipo de Wired a vender mejor, atender pendientes y operar usando únicamente información real del sistema.", agentTeamPriorities:"1. Seguimientos vencidos y clientes activos. 2. Pedidos que requieren atención. 3. Oportunidades comerciales. 4. Inventario crítico.", agentTeamRules:"No inventar datos, precios, stock, descuentos, clientes ni estados. No afirmar que una acción se realizó si no se ejecutó. Respetar los permisos del usuario. Si falta información, decirlo claramente.", agentTeamEscalation:"Escalar a una persona ante reclamos, excepciones comerciales, descuentos no autorizados, decisiones sensibles o cuando Wired no tenga información suficiente.", ...d })); },[]);
  const save=async()=>{
    setSaving(true);
    const allowed:any={};
    for(const [key] of FIELDS) allowed[key]=cfg[key]||"";
    await fetch("/api/admin/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(allowed)});
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),2000);
  };
  return <div className="max-w-[900px]">
    <div className="mb-5"><h1 className="font-display text-2xl font-bold">Configuración</h1><p className="text-sm text-muted mt-1">Parámetros operativos del CRM y del equipo comercial.</p></div>
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
      <div className="bg-white border border-hair rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map(([key,label,type])=><div key={key} className={key==="storeName"||type==="textarea"?"md:col-span-2":""}><label className="text-xs font-semibold block mb-1">{label}</label>{type==="textarea"?<textarea rows={4} value={cfg[key]||""} onChange={e=>setCfg({...cfg,[key]:e.target.value})} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper resize-y"/>:<input type={type} value={cfg[key]||""} onChange={e=>setCfg({...cfg,[key]:e.target.value})} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-copper"/>}</div>)}
        <div className="md:col-span-2 rounded-lg border border-hair bg-[#FAFAFA] px-4 py-3 text-xs text-muted">Estrategia activa: lunes a viernes 06:00–19:00; sábado 07:00–14:00; domingo cerrado. Estos horarios controlan ausencia y seguimientos automáticos.</div>
        <div className="md:col-span-2 flex items-center gap-3 pt-2"><button onClick={save} disabled={saving} className="bg-copper text-white rounded-lg px-5 py-2.5 text-sm font-semibold flex items-center gap-2"><Check size={15}/>{saving?"Guardando...":"Guardar"}</button>{saved&&<span className="text-xs font-semibold text-green">Cambios guardados</span>}</div>
      </div>
      <div className="space-y-4">
        <div className="bg-white border border-hair rounded-xl p-5"><div className="font-semibold text-sm">Políticas comerciales</div><p className="text-xs text-muted mt-2 leading-relaxed">Los precios y promociones salen del catálogo. El agente no inventa descuentos y no marca una cotización como completa hasta tener envío.</p></div>
        <div className="bg-white border border-hair rounded-xl p-5"><div className="font-semibold text-sm">Contenido de tienda</div><p className="text-xs text-muted mt-2 mb-3">Nombre, lema y parámetros visibles que ya existían.</p><Link href="/admin/contenido" className="text-xs font-semibold text-copper">Abrir contenido →</Link></div>
        <div className="bg-white border border-hair rounded-xl p-5"><div className="font-semibold text-sm">Reglas comerciales</div><p className="text-xs text-muted mt-2 mb-3">Configura seguimientos, ausencia y alertas automáticas.</p><Link href="/admin/automatizaciones" className="text-xs font-semibold text-copper">Abrir automatizaciones →</Link></div>
      </div>
    </div>
  </div>;
}
