import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureCrmTables } from "@/lib/crm";
import { ensureSalesTables, syncOpportunitiesFromLeads } from "@/lib/sales-system";
import type { Permission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

const money=(n:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n);
const norm=(v:unknown)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();

function allowed(session:any,p:Permission){return session.role==="ADMIN"||session.permissions?.includes(p);}
function deny(){return {reply:"No tienes permiso para consultar esa información en Wired.",sources:[]};}

export async function POST(req:NextRequest){
 try{
  const session=await getSession(); if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
  const body=await req.json().catch(()=>null); const text=String(body?.text||"").trim(); if(!text)return NextResponse.json({error:"Escribe una consulta"},{status:400});
  const q=norm(text); const sources:string[]=[];
  const settings=await prisma.siteSetting.findMany({where:{key:{in:["agentTeamMission","agentTeamRules","agentTeamPriorities","agentTeamEscalation"]}}});
  const knowledge=Object.fromEntries(settings.map(s=>[s.key,s.value]));

  const phoneMatch=text.replace(/\D/g,"").match(/\d{7,}/)?.[0];
  if(phoneMatch&&allowed(session,"customers.view")){
   const customer=await prisma.customer.findFirst({where:{phone:{contains:phoneMatch}},include:{orders:{orderBy:{createdAt:"desc"},take:5}}});
   if(customer){
    await ensureSalesTables(); await syncOpportunitiesFromLeads();
    const opps=await prisma.$queryRawUnsafe<any[]>('SELECT * FROM "Opportunity" WHERE "phone"=$1 ORDER BY "updatedAt" DESC LIMIT 20',customer.phone);
    sources.push("Clientes","CRM");
    return NextResponse.json({reply:`${customer.name}: ${customer.city||"sin ciudad"}, ${customer.orders.length} pedidos recientes visibles y ${opps.length} oportunidades comerciales. Último pedido: ${customer.orders[0]?`${customer.orders[0].number} · ${customer.orders[0].shipStatus} · ${money(Number(customer.orders[0].total))}`:"sin pedidos registrados"}.`,sources});
   }
  }

  if(/(cotiz|presupuesto|propuesta)/.test(q)){
   if(!allowed(session,"crm.view"))return NextResponse.json(deny());
   await ensureSalesTables(); await syncOpportunitiesFromLeads();
   const quotes=await prisma.$queryRawUnsafe<any[]>('SELECT * FROM "Quote" ORDER BY "createdAt" DESC LIMIT 200');
   const open=quotes.filter(x=>["DRAFT","SENT"].includes(x.status)); const expired=quotes.filter(x=>x.status==="EXPIRED");
   sources.push("Cotizaciones");
   return NextResponse.json({reply:`Hay ${open.length} cotizaciones abiertas y ${expired.length} vencidas entre las últimas ${quotes.length}. Las abiertas más recientes: ${open.slice(0,6).map(x=>`${x.number} · ${x.customerName||"Cliente"} · ${x.status} · ${money(Number(x.total))}`).join("; ")||"ninguna"}.`,sources});
  }

  if(/(stock|inventario|agotad|existencia|producto)/.test(q)){
   if(!allowed(session,"inventory.view")&&!allowed(session,"products.view"))return NextResponse.json(deny());
   const products=await prisma.product.findMany({include:{variants:true},orderBy:{updatedAt:"desc"}});
   const items=products.flatMap(p=>p.variants.length?p.variants.map(v=>({name:`${p.name} · ${v.name}`,sku:v.sku,stock:v.stock,low:p.lowStockAlert})): [{name:p.name,sku:p.sku,stock:p.stock,low:p.lowStockAlert}]);
   const low=items.filter(x=>x.stock<=x.low).sort((a,b)=>a.stock-b.stock).slice(0,8); sources.push("Inventario");
   return NextResponse.json({reply:low.length?`Hay ${items.filter(x=>x.stock<=x.low).length} referencias en nivel bajo o agotadas. Las más urgentes: ${low.map(x=>`${x.name} (${x.sku}): ${x.stock}`).join("; ")}.`:"No encuentro productos en nivel bajo de inventario.",sources});
  }

  if(/(venta|vendid|factur|ingreso)/.test(q)){
   if(!allowed(session,"analytics.view"))return NextResponse.json(deny());
   const orders=await prisma.order.findMany({where:{paymentStatus:"APPROVED"},orderBy:{createdAt:"desc"}});
   const now=Date.now(), day=864e5; const sum=(days:number)=>orders.filter(o=>new Date(o.createdAt).getTime()>=now-days*day).reduce((s,o)=>s+Number(o.total),0);
   sources.push("Ventas"); return NextResponse.json({reply:`Ventas aprobadas: hoy ${money(sum(1))}, últimos 7 días ${money(sum(7))} y acumulado registrado ${money(orders.reduce((s,o)=>s+Number(o.total),0))}. Hay ${orders.length} pedidos pagados registrados.`,sources});
  }

  if(/(pedido|orden|despach|entrega)/.test(q)){
   if(!allowed(session,"orders.view"))return NextResponse.json(deny());
   const orders=await prisma.order.findMany({include:{customer:true},orderBy:{createdAt:"desc"},take:100});
   const pending=orders.filter(o=>!["DELIVERED","CANCELLED","REFUNDED"].includes(o.shipStatus)); sources.push("Pedidos");
   return NextResponse.json({reply:pending.length?`Hay ${pending.length} pedidos abiertos entre los últimos 100. Los más recientes: ${pending.slice(0,6).map(o=>`${o.number} · ${o.customer?.name||"sin cliente"} · ${o.shipStatus} · ${money(Number(o.total))}`).join("; ")}.`:"No encuentro pedidos abiertos entre los últimos registros.",sources});
  }

  if(/(lead|cliente|crm|seguimiento|pendiente|oportunidad)/.test(q)){
   if(!allowed(session,"crm.view")&&!allowed(session,"customers.view"))return NextResponse.json(deny());
   await ensureSalesTables(); await syncOpportunitiesFromLeads();
   const opportunities=await prisma.$queryRawUnsafe<any[]>('SELECT * FROM "Opportunity" ORDER BY "updatedAt" DESC LIMIT 500');
   const open=opportunities.filter(x=>["NEW","CONTACTED","QUOTED","NEGOTIATION"].includes(x.stage));
   const mine=open.filter(x=>x.assignedSellerId===session.userId);
   const overdue=open.filter(x=>x.nextAt&&new Date(x.nextAt).getTime()<=Date.now());
   const unassigned=open.filter(x=>!x.assignedSellerId);
   sources.push("CRM");
   const focus=overdue.length?overdue:mine.length?mine:unassigned.length?unassigned:open;
   return NextResponse.json({reply:`CRM: ${open.length} oportunidades abiertas; ${mine.length} asignadas a ti, ${overdue.length} con seguimiento vencido y ${unassigned.length} sin responsable. Prioridad visible: ${focus.slice(0,6).map(x=>`${x.customerName||x.title} · ${x.stage}${x.nextAction?` · ${x.nextAction}`:""}`).join("; ")||"sin pendientes"}.`,sources});
  }

  if(/(regla|politica|como debo|como trabajo|prioridad del equipo|cuando escalo|escalar)/.test(q)){
   sources.push("Conocimiento del agente");
   return NextResponse.json({reply:`Mi guía interna actual es: ${knowledge.agentTeamMission||"Ayudar al equipo a vender y operar con información real de Wired."} Prioridades: ${knowledge.agentTeamPriorities||"clientes y seguimientos vencidos; pedidos abiertos; inventario crítico."} Reglas: ${knowledge.agentTeamRules||"No inventar datos, precios, stock, descuentos ni estados. Si Wired no tiene el dato, decirlo."} Escalamiento: ${knowledge.agentTeamEscalation||"Ante excepciones, reclamos, descuentos no autorizados o información insuficiente, pedir intervención humana."}`,sources});
  }

  if(/(tarea|que hago|que debo|prioridad|hoy)/.test(q)){
   const parts:string[]=[];
   if(allowed(session,"crm.view")){await ensureSalesTables();await syncOpportunitiesFromLeads();const opps=await prisma.$queryRawUnsafe<any[]>('SELECT * FROM "Opportunity" WHERE "stage" IN (\'NEW\',\'CONTACTED\',\'QUOTED\',\'NEGOTIATION\') ORDER BY "updatedAt" DESC LIMIT 500');const mine=opps.filter(x=>x.assignedSellerId===session.userId);const overdue=opps.filter(x=>x.nextAt&&new Date(x.nextAt).getTime()<=Date.now());parts.push(`${mine.length} oportunidades asignadas a ti y ${overdue.length} seguimientos vencidos`);sources.push("CRM");}
   if(allowed(session,"orders.view")){const n=await prisma.order.count({where:{shipStatus:{in:["PENDING_PAYMENT","READY","APPROVED","PREPARING","SHIPPED"]}}});parts.push(`${n} pedidos abiertos`);sources.push("Pedidos");}
   if(allowed(session,"inventory.view")){const n=await prisma.product.count({where:{stock:{lte:5}}});parts.push(`${n} productos base con stock ≤ 5`);sources.push("Inventario");}
   return NextResponse.json({reply:parts.length?`Tu panorama ahora: ${parts.join(", ")}. ${knowledge.agentTeamPriorities?`Según la guía del equipo, prioriza: ${knowledge.agentTeamPriorities}`:"Prioriza seguimientos vencidos, clientes activos, pedidos abiertos e inventario crítico."}`:"No tienes módulos operativos habilitados para construir un resumen.",sources});
  }

  return NextResponse.json({reply:"Puedo consultar datos reales de Wired sobre CRM, oportunidades, cotizaciones, clientes, pedidos, ventas e inventario. Por ejemplo: “¿qué debo atender hoy?”, “¿qué pedidos están abiertos?”, “¿cómo van las ventas?” o “¿qué tiene stock bajo?”.",sources});
 }catch(e:any){console.error("[ADMIN_ASSISTANT]",e);return NextResponse.json({error:e?.message||"No se pudo consultar Wired"},{status:500});}
}