"use client";

import { useState } from "react";
import { Bot, LoaderCircle, Send, X } from "lucide-react";

type Turn = { role: "user" | "agent"; text: string };
type Props = { audience: "customer" | "team" };

export default function WiredAssistant({ audience }: Props) {
  const [open,setOpen]=useState(false), [text,setText]=useState(""), [busy,setBusy]=useState(false);
  const [state,setState]=useState<Record<string,unknown>>({});
  const [turns,setTurns]=useState<Turn[]>([{role:"agent",text: audience==="team" ? "Hola. Soy el asistente de Wired. Puedo ayudarte con catálogo, ventas y dudas de operación." : "¡Hola! Soy Paula, tu asistente virtual de Wired Technology. Puedo ayudarte a elegir productos, resolver dudas y preparar tu pedido. Si prefieres, puedes comprar sin mi ayuda."}]);
  const send=async()=>{const q=text.trim(); if(!q||busy)return; setText(""); setTurns(v=>[...v,{role:"user",text:q}]); setBusy(true);
    try { const r=await fetch(audience==="team"?"/api/admin/assistant":"/api/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:q,state,audience})}); const d=await r.json(); if(!r.ok) throw new Error(d.error); setState(d.state||state); setTurns(v=>[...v,{role:"agent",text:d.reply||"¿En qué más te ayudo?"}]); }
    catch { setTurns(v=>[...v,{role:"agent",text:"No pude procesar eso en este momento. Intenta nuevamente."}]); } finally {setBusy(false);}
  };
  return <>
    {open && <section className="fixed bottom-24 right-4 sm:right-6 z-[70] w-[calc(100vw-2rem)] sm:w-[380px] h-[560px] max-h-[72vh] bg-white border border-hair rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <header className="bg-graphite text-white px-4 py-3 flex items-center gap-3"><PaulaAvatar size="small" /><div className="flex-1"><div className="font-semibold text-sm">{audience==="team"?"Asistente Wired":"Paula · Asistente virtual"}</div><div className="text-[11px] text-green-400 flex items-center gap-1"><span className="w-2 h-2 bg-green-400 rounded-full"/> En línea · Ayuda opcional</div></div><button onClick={()=>setOpen(false)} aria-label="Cerrar"><X size={18}/></button></header>
      <div className="flex-1 overflow-y-auto bg-[#F7F8FA] p-4 space-y-3">{audience==="customer"&&turns.length===1&&<div className="flex flex-wrap gap-2 pb-1">{["Quiero cotizar","Consultar disponibilidad","Ayúdame a armar mi pedido"].map(x=><button key={x} onClick={()=>setText(x)} className="text-[11px] bg-white border border-hair rounded-full px-3 py-1.5 hover:border-copper">{x}</button>)}</div>}{turns.map((t,i)=><div key={i} className={`flex ${t.role==="user"?"justify-end":"justify-start"}`}><div className={`max-w-[84%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${t.role==="user"?"bg-graphite text-white rounded-br-md":"bg-white border border-hair rounded-bl-md"}`}>{t.text}</div></div>)}{busy&&<div className="flex"><div className="bg-white border border-hair rounded-2xl px-3 py-2 text-xs text-muted flex items-center gap-2"><LoaderCircle size={13} className="animate-spin"/>Pensando…</div></div>}</div>
      {audience==="customer" && <a href="/checkout" className="block mx-3 mt-3 text-center bg-copper/10 border border-copper/25 text-copper text-xs font-semibold rounded-lg px-3 py-2 hover:bg-copper/20">Prefiero armar mi pedido sin ayuda de Paula</a>}\n      <div className="p-3 border-t border-hair flex gap-2"><input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")send()}} placeholder={audience==="team"?"Pregúntame sobre Wired…":"Escribe tu consulta…"} className="flex-1 min-w-0 border border-hair rounded-xl px-3 py-2.5 text-sm outline-none focus:border-copper"/><button onClick={send} disabled={busy||!text.trim()} className="w-11 h-11 rounded-xl bg-copper text-white flex items-center justify-center disabled:opacity-40"><Send size={17}/></button></div>
    </section>}
    <button onClick={()=>setOpen(v=>!v)} className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-[70] rounded-full bg-white text-graphite shadow-2xl border border-hair pl-1.5 pr-4 py-1.5 flex items-center gap-2.5 hover:scale-[1.03] transition-transform" aria-label="Abrir chat con Paula"><PaulaAvatar size="large"/><span className="text-left"><span className="block text-sm font-bold leading-tight">Paula</span><span className="text-[11px] text-green-600 font-semibold flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full shadow-[0_0_8px_#22c55e]"/>En línea</span></span>{open&&<X size={15} className="ml-1 text-muted"/>}</button>
  </>;
}
function PaulaAvatar({size}:{size:"small"|"large"}) { const dimensions=size==="small"?"w-10 h-10":"w-12 h-12"; return <span className={`relative block shrink-0 ${dimensions} rounded-full overflow-hidden border-2 border-copper bg-graphite`}><img alt="Paula, asistente virtual" src="/images/paula.webp" className="w-full h-full object-cover" /><span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-green-500 border border-white shadow-[0_0_7px_#22c55e]"/></span>; }
