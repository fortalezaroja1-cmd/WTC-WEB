"use client";

import { useState } from "react";
import { Bot, LoaderCircle, MessageCircle, Send, X } from "lucide-react";

type Turn = { role: "user" | "agent"; text: string };
type Props = { audience: "customer" | "team" };

export default function WiredAssistant({ audience }: Props) {
  const [open,setOpen]=useState(false), [text,setText]=useState(""), [busy,setBusy]=useState(false);
  const [state,setState]=useState<Record<string,unknown>>({});
  const [turns,setTurns]=useState<Turn[]>([{role:"agent",text: audience==="team" ? "Hola. Soy el asistente de Wired. Puedo ayudarte con catálogo, ventas y dudas de operación." : "Hola 👋 Soy el asistente de Wired. ¿Qué producto estás buscando?"}]);
  const send=async()=>{const q=text.trim(); if(!q||busy)return; setText(""); setTurns(v=>[...v,{role:"user",text:q}]); setBusy(true);
    try { const r=await fetch(audience==="team"?"/api/admin/assistant":"/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:q,state,audience})}); const d=await r.json(); if(!r.ok) throw new Error(d.error); setState(d.state||state); setTurns(v=>[...v,{role:"agent",text:d.reply||"¿En qué más te ayudo?"}]); }
    catch { setTurns(v=>[...v,{role:"agent",text:"No pude procesar eso en este momento. Intenta nuevamente."}]); } finally {setBusy(false);}
  };
  return <>
    {open && <section className="fixed bottom-24 right-4 sm:right-6 z-[70] w-[calc(100vw-2rem)] sm:w-[380px] h-[560px] max-h-[72vh] bg-white border border-hair rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <header className="bg-graphite text-white px-4 py-3 flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-copper/20 flex items-center justify-center"><Bot size={19} className="text-copper"/></div><div className="flex-1"><div className="font-semibold text-sm">Asistente Wired</div><div className="text-[10px] text-[#AEB6C0]">{audience==="team"?"Asistente interno del equipo":"Asistente de compras"}</div></div><button onClick={()=>setOpen(false)} aria-label="Cerrar"><X size={18}/></button></header>
      <div className="flex-1 overflow-y-auto bg-[#F7F8FA] p-4 space-y-3">{turns.map((t,i)=><div key={i} className={`flex ${t.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-[84%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${t.role==="user"?"bg-graphite text-white rounded-br-md":"bg-white border border-hair rounded-bl-md"}`}>{t.text}</div></div>)}{busy&&<div className="flex"><div className="bg-white border border-hair rounded-2xl px-3 py-2 text-xs text-muted flex items-center gap-2"><LoaderCircle size={13} className="animate-spin"/>Pensando…</div></div>}</div>
      <div className="p-3 border-t border-hair flex gap-2"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}} placeholder={audience==="team"?"Pregúntame sobre Wired…":"Escribe tu consulta…"} className="flex-1 min-w-0 border border-hair rounded-xl px-3 py-2.5 text-sm outline-none focus:border-copper"/><button onClick={send} disabled={busy||!text.trim()} className="w-11 h-11 rounded-xl bg-copper text-white flex items-center justify-center disabled:opacity-40"><Send size={17}/></button></div>
    </section>}
    <button onClick={()=>setOpen(v=>!v)} className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[70] w-14 h-14 rounded-full bg-graphite text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform" aria-label="Abrir asistente Wired">{open?<X size={22}/>:<MessageCircle size={24}/>}</button>
  </>;
}