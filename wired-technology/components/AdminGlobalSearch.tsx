"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

export default function AdminGlobalSearch(){
  const [q,setQ]=useState("");
  const [results,setResults]=useState<any[]>([]);
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(()=>{
    if(timer.current)clearTimeout(timer.current);
    if(q.trim().length<2){setResults([]);setOpen(false);return;}
    timer.current=setTimeout(async()=>{
      setLoading(true);
      try{
        const r=await fetch("/api/admin/search?q="+encodeURIComponent(q.trim()),{cache:"no-store"});
        const d=await r.json();
        setResults(r.ok&&Array.isArray(d)?d:[]);
        setOpen(true);
      }catch{setResults([])}finally{setLoading(false)}
    },250);
    return()=>{if(timer.current)clearTimeout(timer.current)};
  },[q]);

  return <div className="relative max-w-[760px] mb-4">
    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"/>
    <input value={q} onChange={e=>setQ(e.target.value)} onFocus={()=>q.trim().length>=2&&setOpen(true)} placeholder="Buscar en Wired: cliente, pedido, SKU, cotización..." className="w-full bg-white border border-hair rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:border-copper shadow-sm"/>
    {q&&<button onClick={()=>{setQ("");setResults([]);setOpen(false)}} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted"><X size={15}/></button>}
    {open&&<div className="absolute z-[65] left-0 right-0 top-[calc(100%+6px)] bg-white border border-hair rounded-xl shadow-xl overflow-hidden max-h-[420px] overflow-y-auto">
      {loading&&<div className="p-4 text-xs text-muted">Buscando…</div>}
      {!loading&&!results.length&&<div className="p-4 text-xs text-muted">No encontré coincidencias.</div>}
      {!loading&&results.map((r:any,i:number)=><Link key={r.type+"-"+r.title+"-"+i} href={r.href} onClick={()=>{setOpen(false);setQ("")}} className="block px-4 py-3 border-b border-hair last:border-0 hover:bg-paper">
        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold truncate">{r.title}</div><div className="text-[10px] text-muted truncate mt-0.5">{r.subtitle||""}</div></div><span className="text-[9px] uppercase tracking-wider bg-paper rounded-full px-2 py-1 shrink-0">{r.type}</span></div>
      </Link>)}
    </div>}
  </div>
}
