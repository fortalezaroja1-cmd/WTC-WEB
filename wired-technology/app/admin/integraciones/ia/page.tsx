"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, CheckCircle2, KeyRound, LoaderCircle, Plug, RefreshCw, Send, Trash2 } from "lucide-react";

type Provider = {
  id:"openai"|"anthropic"|"gemini";
  name:string;
  defaultModel:string;
  connected:boolean;
  maskedKey:string|null;
  updatedAt:string|null;
};

type ChatTurn={role:"user"|"assistant";content:string};

const HELPER:Record<string,string>={
  openai:"OpenAI API",
  anthropic:"Claude / Anthropic API",
  gemini:"Google Gemini API",
};

export default function AiIntegrationsPage(){
  const [providers,setProviders]=useState<Provider[]>([]);
  const [defaultProvider,setDefaultProvider]=useState("openai");
  const [keys,setKeys]=useState<Record<string,string>>({});
  const [models,setModels]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  const [testProvider,setTestProvider]=useState("openai");
  const [testModel,setTestModel]=useState("");
  const [input,setInput]=useState("Hola. Responde en una sola frase y dime qué modelo estás usando.");
  const [turns,setTurns]=useState<ChatTurn[]>([]);
  const [chatBusy,setChatBusy]=useState(false);
  const [usage,setUsage]=useState<any>(null);

  const load=async()=>{
    setError("");
    const r=await fetch("/api/admin/ai/providers",{cache:"no-store"});
    const d=await r.json();
    if(!r.ok){setError(d.error||"No se pudieron cargar las conexiones");return}
    setProviders(d.providers||[]);
    setDefaultProvider(d.defaultProvider||"openai");
    const nextModels:Record<string,string>={};
    for(const p of d.providers||[])nextModels[p.id]=p.defaultModel;
    setModels(nextModels);
    const selected=(d.providers||[]).find((p:Provider)=>p.id===(d.defaultProvider||"openai"))||(d.providers||[])[0];
    if(selected){setTestProvider(selected.id);setTestModel(selected.defaultModel)}
  };

  useEffect(()=>{load()},[]);

  const connected=useMemo(()=>providers.filter(p=>p.connected),[providers]);

  const connect=async(provider:Provider)=>{
    const apiKey=(keys[provider.id]||"").trim();
    const model=(models[provider.id]||provider.defaultModel).trim();
    if(!apiKey){setError("Pega la API key de "+provider.name);return}
    setBusy(provider.id);setError("");setMessage("");
    try{
      const r=await fetch("/api/admin/ai/providers",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:provider.id,apiKey,model,makeDefault:connected.length===0})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo conectar");
      setKeys({...keys,[provider.id]:""});
      setMessage(provider.name+" quedó conectado y la clave respondió correctamente.");
      await load();
    }catch(e:any){setError(e.message)}finally{setBusy("")}
  };

  const saveModel=async(provider:Provider,makeDefault=false)=>{
    setBusy("model-"+provider.id);setError("");
    try{
      const r=await fetch("/api/admin/ai/providers",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:provider.id,model:models[provider.id]||provider.defaultModel,makeDefault})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo guardar");
      if(makeDefault)setDefaultProvider(provider.id);
      setMessage(makeDefault?provider.name+" quedó como proveedor principal.":"Modelo guardado.");
      await load();
    }catch(e:any){setError(e.message)}finally{setBusy("")}
  };

  const disconnect=async(provider:Provider)=>{
    if(!window.confirm("¿Desconectar "+provider.name+"?"))return;
    setBusy("delete-"+provider.id);setError("");
    try{
      const r=await fetch("/api/admin/ai/providers",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({provider:provider.id})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo desconectar");
      setMessage(provider.name+" fue desconectado.");
      await load();
    }catch(e:any){setError(e.message)}finally{setBusy("")}
  };

  const switchTest=(id:string)=>{
    setTestProvider(id);
    setTestModel(models[id]||providers.find(p=>p.id===id)?.defaultModel||"");
    setTurns([]);setUsage(null);
  };

  const send=async()=>{
    const text=input.trim();if(!text||chatBusy)return;
    const next=[...turns,{role:"user" as const,content:text}];
    setTurns(next);setInput("");setChatBusy(true);setError("");
    try{
      const r=await fetch("/api/admin/ai/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
        provider:testProvider,
        model:testModel,
        messages:[
          {role:"system",content:"Eres un asistente de prueba dentro del CRM Wired. Responde de forma breve y clara."},
          ...next,
        ],
      })});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"No respondió el proveedor");
      setTurns([...next,{role:"assistant",content:d.reply}]);setUsage(d.usage||null);
    }catch(e:any){setError(e.message)}finally{setChatBusy(false)}
  };

  return <div className="max-w-[1280px]">
    <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
      <div>
        <div className="flex items-center gap-2"><Bot size={22} className="text-copper"/><h1 className="font-display text-2xl font-bold">Inteligencia artificial</h1></div>
        <p className="text-sm text-muted mt-1">Conecta OpenAI, Anthropic o Gemini pegando la API key. Wired valida la clave antes de guardarla.</p>
      </div>
      <div className="flex gap-2"><Link href="/admin/integraciones" className="border border-hair bg-white rounded-lg px-3 py-2 text-xs font-semibold">← Integraciones</Link><button onClick={load} className="border border-hair bg-white rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-2"><RefreshCw size={13}/>Actualizar</button></div>
    </div>

    {message&&<div className="mb-4 rounded-xl border border-green-200 bg-green-50 text-green-800 px-4 py-3 text-sm flex gap-2"><CheckCircle2 size={17}/>{message}</div>}
    {error&&<div className="mb-4 rounded-xl border border-red-100 bg-red-50 text-alert px-4 py-3 text-sm">{error}</div>}

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {providers.map(provider=><section key={provider.id} className="bg-white border border-hair rounded-xl p-5">
        <div className="flex items-start justify-between gap-3"><div className="w-11 h-11 rounded-xl bg-paper flex items-center justify-center text-copper"><KeyRound size={21}/></div><span className={"text-[10px] font-semibold rounded-full px-2.5 py-1 "+(provider.connected?"bg-green-50 text-green":"bg-paper text-muted")}>{provider.connected?"Conectado":"Sin conectar"}</span></div>
        <h2 className="font-display text-lg font-bold mt-4">{provider.name}</h2><div className="text-[11px] text-muted">{HELPER[provider.id]}</div>

        {provider.connected?<div className="mt-4 rounded-lg border border-hair bg-[#FAFAFA] p-3"><div className="text-[10px] uppercase tracking-wider text-muted">Credencial guardada</div><div className="font-mono text-sm mt-1">{provider.maskedKey}</div>{provider.updatedAt&&<div className="text-[9px] text-muted mt-1">Actualizada {new Date(provider.updatedAt).toLocaleString("es-CO")}</div>}</div>:<div className="mt-4"><label className="text-xs font-semibold block mb-1">API key</label><input type="password" autoComplete="off" value={keys[provider.id]||""} onChange={e=>setKeys({...keys,[provider.id]:e.target.value})} placeholder="Pega aquí la clave" className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-copper"/></div>}

        <div className="mt-3"><label className="text-xs font-semibold block mb-1">Modelo</label><input value={models[provider.id]||provider.defaultModel} onChange={e=>setModels({...models,[provider.id]:e.target.value})} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm font-mono outline-none focus:border-copper"/></div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!provider.connected?<button onClick={()=>connect(provider)} disabled={busy===provider.id} className="flex-1 bg-graphite text-white rounded-lg px-3 py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50">{busy===provider.id?<LoaderCircle size={14} className="animate-spin"/>:<Plug size={14}/>}Conectar</button>:<>
            <button onClick={()=>saveModel(provider,false)} disabled={busy==="model-"+provider.id} className="border border-hair rounded-lg px-3 py-2.5 text-xs font-semibold">Guardar modelo</button>
            <button onClick={()=>saveModel(provider,true)} disabled={defaultProvider===provider.id} className="border border-hair rounded-lg px-3 py-2.5 text-xs font-semibold disabled:opacity-40">{defaultProvider===provider.id?"Principal":"Hacer principal"}</button>
            <button onClick={()=>disconnect(provider)} className="border border-hair rounded-lg px-3 py-2.5 text-xs text-alert"><Trash2 size={13}/></button>
          </>}
        </div>
      </section>)}
    </div>

    <section className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
      <div className="bg-white border border-hair rounded-xl overflow-hidden min-h-[560px] flex flex-col">
        <div className="border-b border-hair p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><div className="font-semibold">Chat de prueba</div><div className="text-xs text-muted mt-0.5">Prueba la misma conversación contra cualquiera de los proveedores conectados.</div></div>
          <div className="flex gap-2">
            <select value={testProvider} onChange={e=>switchTest(e.target.value)} className="border border-hair rounded-lg px-3 py-2 text-xs bg-white">{providers.map(p=><option key={p.id} value={p.id} disabled={!p.connected}>{p.name}{p.connected?"":" · no conectado"}</option>)}</select>
            <input value={testModel} onChange={e=>setTestModel(e.target.value)} className="w-[180px] border border-hair rounded-lg px-3 py-2 text-xs font-mono"/>
          </div>
        </div>

        <div className="flex-1 bg-[#F7F8FA] p-5 space-y-3 overflow-y-auto">
          {!turns.length&&<div className="h-full min-h-[320px] flex items-center justify-center text-center text-sm text-muted"><div><Bot size={30} className="mx-auto text-copper mb-3"/><div>Selecciona un proveedor conectado y escribe cualquier prueba.</div></div></div>}
          {turns.map((t,i)=><div key={i} className={"flex "+(t.role==="user"?"justify-end":"justify-start")}><div className={"max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed "+(t.role==="user"?"bg-graphite text-white rounded-br-md":"bg-white border border-hair rounded-bl-md")}>{t.content}</div></div>)}
          {chatBusy&&<div className="flex justify-start"><div className="bg-white border border-hair rounded-2xl rounded-bl-md px-4 py-3 text-xs text-muted inline-flex gap-2 items-center"><LoaderCircle size={14} className="animate-spin"/>Consultando API…</div></div>}
        </div>

        <div className="border-t border-hair p-4"><div className="flex gap-2"><textarea rows={2} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Escribe una prueba…" className="flex-1 border border-hair rounded-lg px-3 py-3 text-sm resize-none outline-none focus:border-copper"/><button onClick={send} disabled={chatBusy||!input.trim()||!providers.find(p=>p.id===testProvider)?.connected} className="self-end bg-copper text-white rounded-lg px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-40"><Send size={15}/>Enviar</button></div></div>
      </div>

      <aside className="space-y-4">
        <div className="bg-white border border-hair rounded-xl p-5"><div className="font-semibold text-sm">Estado</div><div className="mt-3 space-y-2">{providers.map(p=><div key={p.id} className="flex justify-between gap-3 text-xs"><span>{p.name}</span><span className={p.connected?"text-green font-semibold":"text-muted"}>{p.connected?"Conectado":"Pendiente"}</span></div>)}</div></div>
        <div className="bg-white border border-hair rounded-xl p-5"><div className="font-semibold text-sm">Proveedor principal</div><div className="font-mono text-xs mt-2">{providers.find(p=>p.id===defaultProvider)?.name||defaultProvider}</div><p className="text-[11px] text-muted mt-2 leading-relaxed">Después podremos hacer que el agente comercial use automáticamente este proveedor y dejar los demás como respaldo.</p></div>
        <div className="bg-[#14181F] text-white rounded-xl p-5"><div className="font-semibold text-sm">Seguridad</div><p className="text-[11px] text-[#AAB2BD] mt-2 leading-relaxed">Las API keys se validan en servidor, se almacenan cifradas y nunca regresan completas al navegador. Wired solo muestra los últimos caracteres para identificar la conexión.</p></div>
        {usage&&<div className="bg-white border border-hair rounded-xl p-5"><div className="font-semibold text-sm">Uso de la última prueba</div><pre className="text-[10px] bg-paper rounded-lg p-3 mt-2 overflow-auto">{JSON.stringify(usage,null,2)}</pre></div>}
      </aside>
    </section>
  </div>
}
