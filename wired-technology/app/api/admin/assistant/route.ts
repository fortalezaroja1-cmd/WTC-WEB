import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureCrmTables } from "@/lib/crm";
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
   await ensureCrmTables();
   const leads=await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Lead" ORDER BY "updatedAt" DESC LIMIT 200`);
   const open=leads.filter(x=>!["CLOSED","LOST"].includes(x.status)); const mine=open.filter(x=>x.assignedSellerId===session.userId); const overdue=open.filter(x=>x.capNextAt&&new Date(x.capNextAt).getTime()<=Date.now());
   sources.push("CRM"); return NextResponse.json({reply:`CRM: ${open.length} leads abiertos. ${mine.length} están asignados a ti y ${overdue.length} tienen seguimiento vencido. Prioridad: ${(mine.length?mine:overdue.length?overdue:open).slice(0,6).map(x=>`${x.name||x.phone||"Lead"} · ${x.status}${x.capNextStep?` · ${x.capNextStep}`:""}`).join("; ")||"sin pendientes"}.`,sources});
  }

  if(/(tarea|que hago|que debo|prioridad|hoy)/.test(q)){
   const parts:string[]=[];
   if(allowed(session,"crm.view")){await ensureCrmTables();const leads=await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "Lead" WHERE "status" NOT IN ('CLOSED','LOST') ORDER BY "updatedAt" DESC LIMIT 200`);const mine=leads.filter(x=>x.assignedSellerId===session.userId);parts.push(`${mine.length} leads abiertos asignados a ti`);sources.push("CRM");}
   if(allowed(session,"orders.view")){const n=await prisma.order.count({where:{shipStatus:{in:["PENDING_PAYMENT","READY","APPROVED","PREPARING","SHIPPED"]}}});parts.push(`${n} pedidos abiertos`);sources.push("Pedidos");}
   if(allowed(session,"inventory.view")){const n=await prisma.product.count({where:{stock:{lte:5}}});parts.push(`${n} productos base con stock ≤ 5`);sources.push("Inventario");}
   return NextResponse.json({reply:parts.length?`Tu panorama ahora: ${parts.join(", ")}. Puedes preguntarme por CRM, pedidos, ventas o inventario para ver el detalle.`:"No tienes módulos operativos habilitados para construir un resumen.",sources});
  }

  return NextResponse.json({reply:"Puedo consultar datos reales de Wired sobre CRM y seguimientos, pedidos, ventas e inventario. Por ejemplo: “¿qué debo atender hoy?”, “¿qué pedidos están abiertos?”, “¿cómo van las ventas?” o “¿qué tiene stock bajo?”.",sources});
 }catch(e:any){console.error("[ADMIN_ASSISTANT]",e);return NextResponse.json({error:e?.message||"No se pudo consultar Wired"},{status:500});}
}