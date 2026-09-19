"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileText, Plus, RefreshCcw, ShoppingCart } from "lucide-react";
import { formatCOP } from "@/lib/utils";

export default function CotizacionesPage(){
  const [quotes,setQuotes]=useState<any[]>([]);
  const [opps,setOpps]=useState<any[]>([]);
  const [products,setProducts]=useState<any[]>([]);
  const [opportunityId,setOpportunityId]=useState("");
  const [choice,setChoice]=useState("");
  const [qty,setQty]=useState(1);
  const [items,setItems]=useState<any[]>([]);
  const [shipping,setShipping]=useState("0");
  const [notes,setNotes]=useState("");
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");

  const load=async()=>{
    const [q,o,p]=await Promise.all([
      fetch("/api/admin/quotes",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/admin/opportunities",{cache:"no-store"}).then(r=>r.json()),
      fetch("/api/admin/products",{cache:"no-store"}).then(r=>r.json()),
    ]);
    setQuotes(Array.isArray(q)?q:[]);setOpps(Array.isArray(o)?o:[]);setProducts(Array.isArray(p)?p:[]);
  };
  useEffect(()=>{load().then(()=>{const q=new URLSearchParams(window.location.search).get("opportunityId");if(q)setOpportunityId(q);});},[]);

  const options=useMemo(()=>products.flatMap((p:any)=>{
    if(p.variants?.length)return p.variants.filter((v:any)=>v.active!==false).map((v:any)=>({key:"v:"+v.id,productId:p.id,variantId:v.id,name:p.name+" · "+v.name,sku:v.sku,price:Number(v.promoPrice??v.price),stock:v.stock}));
    if(p.price==null)return [];
    return [{key:"p:"+p.id,productId:p.id,variantId:null,name:p.name,sku:p.sku,price:Number(p.promoPrice??p.price),stock:p.stock}];
  }),[products]);

  const add=()=>{
    const op=options.find((x:any)=>x.key===choice);if(!op)return;
    const existing=items.find((x:any)=>x.key===op.key);
    if(existing)setItems(items.map((x:any)=>x.key===op.key?{...x,qty:x.qty+qty}:x));
    else setItems([...items,{...op,qty}]);
    setChoice("");setQty(1);
  };
  const subtotal=items.reduce((s:number,x:any)=>s+x.price*x.qty,0);
  const total=subtotal+Number(shipping||0);

  const create=async()=>{
    if(!opportunityId||!items.length)return;
    setBusy("create");setError("");
    try{
      const r=await fetch("/api/admin/quotes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({opportunityId,shipping:Number(shipping||0),notes,items:items.map((x:any)=>({productId:x.productId,variantId:x.variantId,qty:x.qty}))})});
      const d=await r.json();if(!r.ok)throw new Error(d.error||"No se pudo crear");
      setItems([]);setShipping("0");setNotes("");await load();
    }catch(e:any){setError(e.message);}finally{setBusy("");}
  };
  const setStatus=async(id:string,status:string)=>{
    setBusy(id);setError("");
    try{const r=await fetch("/api/admin/quotes",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();}catch(e:any){setError(e.message)}finally{setBusy("");}
  };
  const convert=async(id:string)=>{
    setBusy(id);setError("");
    try{const r=await fetch("/api/admin/quotes",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action:"convert-to-order"})});const d=await r.json();if(!r.ok)throw new Error(d.error);await load();window.alert("Pedido "+d.orderNumber+" creado correctamente.");}catch(e:any){setError(e.message)}finally{setBusy("");}
  };

  return <div className="max-w-[1280px]">
    <div className="flex items-end justify-between gap-4 mb-5"><div><h1 className="font-display text-2xl font-bold">Cotizaciones</h1><p className="text-sm text-muted mt-1">Crea propuestas con precios reales del catálogo y conviértelas en pedidos.</p></div><button onClick={load} className="border border-hair bg-white rounded-lg px-3 py-2 text-xs font-semibold inline-flex gap-2 items-center"><RefreshCcw size={14}/> Actualizar</button></div>
    {error&&<div className="mb-4 border border-red-100 bg-red-50 text-alert rounded-lg px-4 py-3 text-sm">{error}</div>}

    <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
      <section className="bg-white border border-hair rounded-xl p-5 h-fit">
        <div className="flex items-center gap-2 mb-4"><FileText size={18} className="text-copper"/><h2 className="font-semibold">Nueva cotización</h2></div>
        <label className="text-xs font-semibold block mb-1">Oportunidad</label>
        <select value={opportunityId} onChange={e=>setOpportunityId(e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm mb-4"><option value="">Selecciona...</option>{opps.filter((o:any)=>!["WON","LOST"].includes(o.stage)).map((o:any)=><option key={o.id} value={o.id}>{o.customerName||o.title} · {o.stage}</option>)}</select>

        <div className="grid grid-cols-[1fr_72px_auto] gap-2 items-end mb-3">
          <div><label className="text-xs font-semibold block mb-1">Producto / referencia</label><select value={choice} onChange={e=>setChoice(e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm"><option value="">Selecciona...</option>{options.map((o:any)=><option key={o.key} value={o.key}>{o.name} · {formatCOP(o.price)} · stock {o.stock}</option>)}</select></div>
          <div><label className="text-xs font-semibold block mb-1">Cant.</label><input type="number" min={1} value={qty} onChange={e=>setQty(Math.max(1,Number(e.target.value)||1))} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm"/></div>
          <button onClick={add} disabled={!choice} className="h-[42px] w-11 bg-graphite text-white rounded-lg flex items-center justify-center disabled:opacity-40"><Plus size={16}/></button>
        </div>

        <div className="border border-hair rounded-lg overflow-hidden mb-4">
          {!items.length&&<div className="p-4 text-xs text-muted">Añade productos del catálogo.</div>}
          {items.map((x:any)=><div key={x.key} className="px-3 py-2.5 border-b border-hair last:border-0"><div className="flex justify-between gap-3 text-sm"><div className="min-w-0"><div className="font-medium truncate">{x.name}</div><div className="text-[10px] text-muted">{x.sku} · {x.qty} × {formatCOP(x.price)}</div></div><div className="font-semibold whitespace-nowrap">{formatCOP(x.price*x.qty)}</div></div><button onClick={()=>setItems(items.filter((y:any)=>y.key!==x.key))} className="text-[10px] text-alert mt-1">Quitar</button></div>)}
        </div>

        <label className="text-xs font-semibold block mb-1">Envío</label><input type="number" min={0} value={shipping} onChange={e=>setShipping(e.target.value)} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm mb-3"/>
        <label className="text-xs font-semibold block mb-1">Notas</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={3} className="w-full border border-hair rounded-lg px-3 py-2.5 text-sm resize-none mb-4"/>
        <div className="bg-paper rounded-lg p-3 mb-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><b>{formatCOP(subtotal)}</b></div><div className="flex justify-between mt-1"><span>Total</span><b className="text-copper">{formatCOP(total)}</b></div></div>
        <button onClick={create} disabled={!opportunityId||!items.length||busy==="create"} className="w-full bg-copper text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40">{busy==="create"?"Creando...":"Crear cotización"}</button>
      </section>

      <section className="bg-white border border-hair rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-hair"><h2 className="font-semibold">Historial de cotizaciones</h2><p className="text-xs text-muted mt-0.5">{quotes.length} registradas</p></div>
        <div className="divide-y divide-hair">
          {!quotes.length&&<div className="p-8 text-sm text-muted text-center">Todavía no hay cotizaciones.</div>}
          {quotes.map((q:any)=><div key={q.id} className="p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div><div className="flex items-center gap-2"><b className="font-mono text-sm">{q.number}</b><span className="text-[9px] rounded-full bg-paper px-2 py-1">{q.status}</span></div><div className="text-sm font-semibold mt-1">{q.customerName||q.opportunityTitle}</div><div className="text-[10px] text-muted mt-1">{new Date(q.createdAt).toLocaleString("es-CO")} · válida hasta {q.validUntil?new Date(q.validUntil).toLocaleDateString("es-CO"):"—"}</div></div>
              <div className="md:text-right"><div className="font-display text-lg font-bold">{formatCOP(Number(q.total))}</div><div className="flex flex-wrap gap-1.5 mt-2 md:justify-end">
                {q.status==="DRAFT"&&<button onClick={()=>setStatus(q.id,"SENT")} disabled={busy===q.id} className="border border-hair rounded-lg px-2.5 py-1.5 text-[10px] font-semibold">Marcar enviada</button>}
                {["DRAFT","SENT"].includes(q.status)&&<button onClick={()=>setStatus(q.id,"REJECTED")} disabled={busy===q.id} className="border border-hair rounded-lg px-2.5 py-1.5 text-[10px] font-semibold">Rechazada</button>}
                {q.status!=="ACCEPTED"&&<button onClick={()=>convert(q.id)} disabled={busy===q.id} className="bg-graphite text-white rounded-lg px-2.5 py-1.5 text-[10px] font-semibold inline-flex items-center gap-1"><ShoppingCart size={12}/> Convertir a pedido</button>}
                {q.status==="ACCEPTED"&&<span className="text-[10px] text-green font-semibold inline-flex gap-1 items-center"><CheckCircle2 size={12}/> Convertida</span>}
              </div></div>
            </div>
          </div>)}
        </div>
      </section>
    </div>
  </div>
}
