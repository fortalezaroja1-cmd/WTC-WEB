"use client";
import { useEffect, useMemo, useState } from "react";
import { formatCOP } from "@/lib/utils";

export default function AnaliticaPage() {
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(()=>{ fetch("/api/admin/orders", { cache:"no-store" }).then(r=>r.json()).then(d=>setOrders(Array.isArray(d)?d:[])); },[]);
  const data = useMemo(()=>{
    const total = orders.length;
    const delivered = orders.filter(o=>o.shipStatus==="DELIVERED");
    const closed = delivered.reduce((s,o)=>s+Number(o.total||0),0);
    const avg = delivered.length ? closed/delivered.length : 0;
    const bySeller:Record<string,{count:number,value:number}> = {};
    const byOrigin:Record<string,{count:number,value:number}> = {};
    const byProduct:Record<string,{qty:number,value:number}> = {};
    for (const o of orders) {
      const seller = o.workflow?.assignedSellerName || "Sin asignar";
      bySeller[seller] ||= {count:0,value:0}; bySeller[seller].count++; bySeller[seller].value += Number(o.total||0);
      const origin = o.workflow?.origin || "Web";
      byOrigin[origin] ||= {count:0,value:0}; byOrigin[origin].count++; byOrigin[origin].value += Number(o.total||0);
      for (const it of o.items||[]) { byProduct[it.name] ||= {qty:0,value:0}; byProduct[it.name].qty += Number(it.qty||0); byProduct[it.name].value += Number(it.total||0); }
    }
    return { total, delivered:delivered.length, closed, avg, rate: total ? delivered.length/total*100 : 0, bySeller, byOrigin, byProduct };
  },[orders]);
  const sellers = Object.entries(data.bySeller).sort((a,b)=>b[1].value-a[1].value);
  const origins = Object.entries(data.byOrigin).sort((a,b)=>b[1].count-a[1].count);
  const products = Object.entries(data.byProduct).sort((a,b)=>b[1].qty-a[1].qty).slice(0,8);
  const maxSeller = Math.max(1,...sellers.map(x=>x[1].value));
  return <div className="max-w-[1180px]">
    <div className="mb-5"><h1 className="font-display text-2xl font-bold">Analítica</h1><p className="text-sm text-muted mt-1">Ventas, conversión, responsables, orígenes y productos sobre datos reales del sistema.</p></div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
      <Metric label="Pedidos" value={String(data.total)} />
      <Metric label="Entregados" value={String(data.delivered)} />
      <Metric label="Tasa de cierre" value={`${data.rate.toFixed(1)}%`} />
      <Metric label="Ticket promedio" value={formatCOP(data.avg)} />
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      <section className="bg-white border border-hair rounded-xl p-5"><h2 className="font-semibold mb-4">Ventas por vendedor</h2>{sellers.length===0?<Empty/>:<div className="space-y-4">{sellers.map(([name,v])=><div key={name}><div className="flex justify-between text-xs mb-1"><span className="font-semibold">{name}</span><span>{formatCOP(v.value)} · {v.count} pedidos</span></div><div className="h-2 bg-paper rounded-full overflow-hidden"><div className="h-full bg-copper rounded-full" style={{width:`${Math.max(4,v.value/maxSeller*100)}%`}} /></div></div>)}</div>}</section>
      <section className="bg-white border border-hair rounded-xl p-5"><h2 className="font-semibold mb-4">Origen de oportunidades</h2>{origins.length===0?<Empty/>:<div className="space-y-3">{origins.map(([name,v])=><div key={name} className="flex items-center justify-between border-b border-hair pb-3"><div><div className="text-sm font-semibold">{name}</div><div className="text-[10px] text-muted">{v.count} pedidos</div></div><div className="font-display font-bold text-sm">{formatCOP(v.value)}</div></div>)}</div>}</section>
      <section className="bg-white border border-hair rounded-xl p-5 xl:col-span-2"><h2 className="font-semibold mb-4">Productos más pedidos</h2>{products.length===0?<Empty/>:<div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">{products.map(([name,v],i)=><div key={name} className="flex items-center justify-between border-b border-hair py-3"><div className="flex items-center gap-3"><span className="font-mono text-[10px] text-muted">#{i+1}</span><span className="text-sm font-medium">{name}</span></div><div className="text-right"><div className="text-sm font-semibold">{v.qty} und.</div><div className="text-[10px] text-muted">{formatCOP(v.value)}</div></div></div>)}</div>}</section>
    </div>
  </div>;
}
function Metric({label,value}:{label:string,value:string}) { return <div className="bg-white border border-hair rounded-xl p-4"><div className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</div><div className="font-display text-2xl font-bold mt-2">{value}</div></div>; }
function Empty(){ return <div className="text-sm text-muted py-8 text-center">Todavía no hay datos suficientes.</div>; }
