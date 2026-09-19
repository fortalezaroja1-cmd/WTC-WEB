"use client";
import { useEffect, useState } from "react";
import { BellRing, CheckCheck, RefreshCcw } from "lucide-react";

export default function NotificacionesPage(){
  const [items,setItems]=useState<any[]>([]);
  const [busy,setBusy]=useState(false);
  const load=async()=>{const r=await fetch("/api/admin/notifications",{cache:"no-store"});const d=await r.json();if(r.ok)setItems(Array.isArray(d)?d:[])};
  useEffect(()=>{load()},[]);
  const mark=async(id:string)=>{await fetch("/api/admin/notifications",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});await load()};
  const all=async()=>{setBusy(true);await fetch("/api/admin/notifications",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({all:true})});await load();setBusy(false)};
  const unread=items.filter(x=>!x.read).length;
  return <div className="max-w-[900px]">
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5"><div><h1 className="font-display text-2xl font-bold">Notificaciones</h1><p className="text-sm text-muted mt-1">{unread} pendientes · alertas comerciales, operación e inventario.</p></div><div className="flex gap-2"><button onClick={load} className="border border-hair bg-white rounded-lg px-3 py-2 text-xs font-semibold inline-flex gap-2 items-center"><RefreshCcw size={13}/>Actualizar</button><button onClick={all} disabled={!unread||busy} className="bg-graphite text-white rounded-lg px-3 py-2 text-xs font-semibold inline-flex gap-2 items-center disabled:opacity-40"><CheckCheck size={13}/>Marcar todas leídas</button></div></div>
    <div className="bg-white border border-hair rounded-xl overflow-hidden divide-y divide-hair">
      {!items.length&&<div className="p-10 text-center text-sm text-muted">No hay notificaciones todavía.</div>}
      {items.map(n=><button key={n.id} onClick={()=>!n.read&&mark(n.id)} className={"w-full text-left p-4 flex gap-3 hover:bg-paper/60 "+(!n.read?"bg-amber-50/40":"")}>
        <div className={"w-9 h-9 rounded-full flex items-center justify-center shrink-0 "+(!n.read?"bg-copper/10 text-copper":"bg-paper text-muted")}><BellRing size={16}/></div>
        <div className="min-w-0 flex-1"><div className={"text-sm "+(!n.read?"font-semibold":"")}>{n.message}</div><div className="text-[10px] text-muted mt-1">{n.type} · {new Date(n.createdAt).toLocaleString("es-CO")}</div></div>
        {!n.read&&<span className="w-2 h-2 rounded-full bg-copper mt-2 shrink-0"/>}
      </button>)}
    </div>
  </div>
}
