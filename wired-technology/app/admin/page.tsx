"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CircleDollarSign, ClipboardList, Clock3, TrendingUp, UserRound } from "lucide-react";
import { formatCOP, PAY_LABELS } from "@/lib/utils";

const STAGE_LABELS:any={NEW:"Nuevo",CONTACTED:"Contactado",QUOTED:"Cotizado",NEGOTIATION:"Negociación",WON:"Ganado",LOST:"Perdido"};

export default function AdminDashboard(){
  const [stats,setStats]=useState<any>(null);
  useEffect(()=>{fetch("/api/admin/stats",{cache:"no-store"}).then(r=>r.json()).then(setStats)},[]);
  if(!stats)return <div className="text-muted py-16 text-center">Cargando panel…</div>;

  const kpis=[
    {label:"Ventas hoy",value:formatCOP(stats.salesToday),icon:CircleDollarSign},
    {label:"Ventas 7 días",value:formatCOP(stats.salesWeek),icon:TrendingUp},
    {label:"Pipeline abierto",value:formatCOP(stats.pipelineValue||0),icon:CircleDollarSign},
    {label:"Conversión comercial",value:Number(stats.opportunityConversion||0).toFixed(1)+"%",icon:TrendingUp},
  ];

  return <div className="max-w-[1380px]">
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5"><div><h1 className="font-display text-2xl font-bold">Panel ejecutivo</h1><p className="text-sm text-muted mt-1">Ventas, oportunidades, seguimiento e inventario en un solo lugar.</p></div><div className="text-[10px] text-muted">Datos operativos en tiempo real</div></div>

    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
      {kpis.map(k=><div key={k.label} className="bg-white border border-hair rounded-xl p-4"><div className="flex justify-between items-start gap-2"><span className="text-[10px] tracking-wider uppercase text-muted">{k.label}</span><k.icon size={16} className="text-copper"/></div><div className="font-display text-xl xl:text-2xl font-bold mt-2 break-words">{k.value}</div></div>)}
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      <Mini icon={Clock3} label="Seguimientos vencidos" value={stats.overdueFollowups||0} warn={Number(stats.overdueFollowups)>0} href="/admin/tareas"/>
      <Mini icon={UserRound} label="Oportunidades sin asignar" value={stats.unassignedOpportunities||0} warn={Number(stats.unassignedOpportunities)>0} href="/admin/crm"/>
      <Mini icon={ClipboardList} label="Pedidos nuevos" value={stats.pendingOrders||0} warn={Number(stats.pendingOrders)>0} href="/admin/pedidos"/>
      <Mini icon={AlertTriangle} label="Stock crítico" value={(stats.outOfStock||0)+(stats.lowStock||0)} warn={Number(stats.outOfStock)>0} href="/admin/inventario"/>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_.75fr] gap-5 mb-5">
      <section className="bg-white border border-hair rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-hair flex items-center justify-between gap-3"><div><h2 className="font-semibold text-sm">Pipeline comercial</h2><p className="text-[10px] text-muted mt-0.5">{stats.openOpportunities||0} oportunidades abiertas</p></div><Link href="/admin/crm" className="text-xs text-copper font-semibold">Abrir CRM →</Link></div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
          {(stats.pipelineByStage||[]).map((s:any)=><div key={s.stage} className="rounded-lg bg-paper p-3"><div className="text-[9px] uppercase tracking-wider text-muted">{STAGE_LABELS[s.stage]||s.stage}</div><div className="font-display font-bold text-lg mt-1">{s.count}</div><div className="text-[10px] text-muted mt-1">{formatCOP(Number(s.value||0))}</div></div>)}
        </div>
      </section>

      <section className="bg-white border border-hair rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-hair"><h2 className="font-semibold text-sm">Acción requerida</h2></div>
        <div className="divide-y divide-hair">
          <Action label="Seguimientos vencidos" value={stats.overdueFollowups||0} href="/admin/tareas"/>
          <Action label="Sin responsable" value={stats.unassignedOpportunities||0} href="/admin/crm"/>
          <Action label="Cotizaciones abiertas" value={stats.quotesOpen||0} href="/admin/cotizaciones"/>
          <Action label="Pedidos nuevos" value={stats.pendingOrders||0} href="/admin/pedidos"/>
        </div>
      </section>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-5">
      <section className="bg-white border border-hair rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-hair flex items-center justify-between"><h2 className="font-semibold text-sm">Pedidos recientes</h2><Link href="/admin/pedidos" className="text-xs text-copper font-semibold">Ver todos →</Link></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-b border-hair bg-[#FAFAFA]">{["Pedido","Cliente","Total","Pago"].map(h=><th key={h} className="text-left text-[10px] uppercase tracking-wider text-muted px-4 py-2">{h}</th>)}</tr></thead><tbody>
          {(stats.recentOrders||[]).map((o:any)=><tr key={o.number} className="border-b border-hair"><td className="px-4 py-3 font-mono font-semibold">{o.number}</td><td className="px-4 py-3">{o.customerName}</td><td className="px-4 py-3 font-display font-semibold">{formatCOP(o.total)}</td><td className="px-4 py-3"><span className="text-xs">{PAY_LABELS[o.paymentStatus]||o.paymentStatus}</span></td></tr>)}
        </tbody></table></div>
      </section>

      <section className="bg-white border border-hair rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-hair flex items-center gap-2"><AlertTriangle size={15} className="text-copper"/><h2 className="font-semibold text-sm">Inventario bajo</h2></div>
        <div className="px-4 py-2 max-h-[330px] overflow-y-auto">
          {!(stats.lowStockItems||[]).length&&<div className="text-xs text-muted py-4">Inventario saludable.</div>}
          {(stats.lowStockItems||[]).map((it:any,i:number)=><div key={i} className="flex justify-between gap-3 py-2.5 border-b border-hair last:border-0"><div className="min-w-0"><div className="text-xs font-medium truncate">{it.name}</div><div className="font-mono text-[9px] text-muted">{it.sku}</div></div><span className={"text-xs font-semibold "+(it.out?"text-alert":"text-copper")}>{it.out?"Agotado":it.stock+" und"}</span></div>)}
        </div>
      </section>
    </div>
  </div>
}

function Mini({icon:Icon,label,value,warn,href}:{icon:any;label:string;value:number;warn?:boolean;href:string}){return <Link href={href} className="bg-white border border-hair rounded-xl px-4 py-3 flex items-center gap-3 hover:border-copper"><Icon size={17} className={warn?"text-alert":"text-muted"}/><div className="min-w-0"><div className="text-[10px] text-muted truncate">{label}</div><div className={"font-bold mt-0.5 "+(warn?"text-alert":"")}>{value}</div></div></Link>}
function Action({label,value,href}:{label:string;value:number;href:string}){return <Link href={href} className="px-4 py-3 flex items-center justify-between hover:bg-paper"><span className="text-sm">{label}</span><span className={"min-w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold "+(value?"bg-copper/10 text-copper":"bg-paper text-muted")}>{value}</span></Link>}
