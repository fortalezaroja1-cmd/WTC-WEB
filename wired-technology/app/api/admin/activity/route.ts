import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ensureCrmTables } from "@/lib/crm";
import { ensureSalesTables } from "@/lib/sales-system";

export const dynamic="force-dynamic";

export async function GET(){
  try{
    const session=await getSession();
    if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
    const can=(p:string)=>session.role==="ADMIN"||session.permissions?.includes(p as any);
    const rows:any[]=[];

    if(can("crm.view")){
      await ensureCrmTables();
      await ensureSalesTables();
      const [sales,crm]=await Promise.all([
        prisma.$queryRawUnsafe<any[]>('SELECT "id","opportunityId","type","text","actorName","createdAt","meta" FROM "SalesActivity" ORDER BY "createdAt" DESC LIMIT 150'),
        prisma.$queryRawUnsafe<any[]>('SELECT a."id",a."leadId",a."type",a."text",a."createdAt",l."name",l."phone" FROM "CrmActivity" a JOIN "Lead" l ON l."id"=a."leadId" ORDER BY a."createdAt" DESC LIMIT 150'),
      ]);
      rows.push(...sales.map(a=>({id:"sales-"+a.id,kind:"SALES",type:a.type,text:a.text,actor:a.actorName||"Sistema",createdAt:a.createdAt,href:"/admin/crm?opportunityId="+a.opportunityId})));
      rows.push(...crm.map(a=>({id:"crm-"+a.id,kind:"CRM",type:a.type,text:a.text,actor:a.name||a.phone||"CRM",createdAt:a.createdAt,href:"/admin/inbox"})));
    }

    if(can("orders.view")){
      const history=await prisma.orderHistory.findMany({include:{order:{select:{id:true,number:true}}},orderBy:{createdAt:"desc"},take:150});
      rows.push(...history.map(h=>({id:"order-"+h.id,kind:"ORDER",type:"ORDER",text:h.order.number+" · "+h.action,actor:h.actor||"Sistema",createdAt:h.createdAt,href:"/admin/pedidos?orderId="+h.order.id})));
    }

    const sorted=rows.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,250);
    return NextResponse.json(sorted,{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("[ACTIVITY_FEED]",error);
    return NextResponse.json({error:"No se pudo cargar la actividad"},{status:500});
  }
}
