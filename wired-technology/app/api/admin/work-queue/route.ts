import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ensureSalesTables, syncOpportunitiesFromLeads } from "@/lib/sales-system";
import { addSalesActivity } from "@/lib/sales-system";

export const dynamic = "force-dynamic";

async function nextForUser(userId:string){
  const rows=await prisma.$queryRawUnsafe<any[]>(`
    SELECT o.*,
      l."unreadCount", l."lastInboundAt", l."lastOutboundAt", l."lastMessageText",
      COALESCE(q."quoteCount",0)::int AS "quoteCount"
    FROM "Opportunity" o
    LEFT JOIN "Lead" l ON l."id"=o."leadId"
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS "quoteCount" FROM "Quote" WHERE "opportunityId"=o."id"
    ) q ON true
    WHERE o."stage" NOT IN ('WON','LOST')
      AND (o."assignedSellerId"=$1 OR o."assignedSellerId" IS NULL)
    ORDER BY
      CASE WHEN o."assignedSellerId"=$1 THEN 0 ELSE 1 END,
      CASE WHEN COALESCE(l."unreadCount",0)>0 THEN 0 ELSE 1 END,
      CASE WHEN o."nextAt" IS NOT NULL AND o."nextAt"<=NOW() THEN 0 ELSE 1 END,
      CASE o."priority" WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
      COALESCE(o."nextAt", o."createdAt") ASC,
      o."createdAt" ASC
    LIMIT 1
  `,userId);
  return rows[0]||null;
}

export async function GET(){
  try{
    const session=await getSession();
    if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
    await ensureSalesTables();
    await syncOpportunitiesFromLeads();
    const current=await nextForUser(session.userId);
    const [stats]=await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        COUNT(*) FILTER (WHERE "stage" NOT IN ('WON','LOST') AND "assignedSellerId"=$1)::int AS "mine",
        COUNT(*) FILTER (WHERE "stage" NOT IN ('WON','LOST') AND "assignedSellerId" IS NULL)::int AS "unassigned",
        COUNT(*) FILTER (WHERE "stage" NOT IN ('WON','LOST') AND "assignedSellerId"=$1 AND "nextAt"<=NOW())::int AS "overdue"
      FROM "Opportunity"
    `,session.userId);
    return NextResponse.json({current,stats:stats||{mine:0,unassigned:0,overdue:0}});
  }catch(error){
    console.error("[WORK_QUEUE_GET]",error);
    return NextResponse.json({error:"No se pudo cargar la cola de trabajo"},{status:500});
  }
}

export async function POST(req:NextRequest){
  try{
    const session=await getSession();
    if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
    await ensureSalesTables();
    await syncOpportunitiesFromLeads();
    const body=await req.json().catch(()=>({}));
    const action=String(body?.action||"claim-next");

    if(action==="claim-next"){
      const candidate=await nextForUser(session.userId);
      if(!candidate)return NextResponse.json({current:null});
      if(!candidate.assignedSellerId){
        await prisma.$executeRawUnsafe(
          `UPDATE "Opportunity" SET "assignedSellerId"=$2,"assignedSellerName"=$3,"updatedAt"=NOW() WHERE "id"=$1 AND "assignedSellerId" IS NULL`,
          candidate.id,session.userId,session.name
        );
        if(candidate.leadId){
          await prisma.$executeRawUnsafe(
            `UPDATE "Lead" SET "assignedSellerId"=$2,"assignedSellerName"=$3,"updatedAt"=NOW() WHERE "id"=$1`,
            candidate.leadId,session.userId,session.name
          );
        }
        await addSalesActivity({opportunityId:candidate.id,type:"ASSIGNED",text:`Asignada automáticamente por prioridad a ${session.name}`,actorUserId:session.userId,actorName:session.name});
      }
      const rows=await prisma.$queryRawUnsafe<any[]>(`
        SELECT o.*,l."unreadCount",l."lastInboundAt",l."lastOutboundAt",l."lastMessageText",
          COALESCE(q."quoteCount",0)::int AS "quoteCount"
        FROM "Opportunity" o
        LEFT JOIN "Lead" l ON l."id"=o."leadId"
        LEFT JOIN LATERAL (SELECT COUNT(*) AS "quoteCount" FROM "Quote" WHERE "opportunityId"=o."id") q ON true
        WHERE o."id"=$1 LIMIT 1
      `,candidate.id);
      return NextResponse.json({current:rows[0]||candidate});
    }

    if(action==="snooze"){
      const id=String(body?.id||"");
      const minutes=Math.max(15,Math.min(1440,Number(body?.minutes||60)));
      if(!id)return NextResponse.json({error:"Oportunidad requerida"},{status:400});
      await prisma.$executeRawUnsafe(
        `UPDATE "Opportunity" SET "nextAction"=COALESCE("nextAction",'Retomar contacto'),"nextAt"=NOW()+($2::text||' minutes')::interval,"updatedAt"=NOW() WHERE "id"=$1 AND "assignedSellerId"=$3`,
        id,String(minutes),session.userId
      );
      await addSalesActivity({opportunityId:id,type:"SNOOZED",text:`Tarea aplazada ${minutes} minutos`,actorUserId:session.userId,actorName:session.name});
      return NextResponse.json({ok:true});
    }

    return NextResponse.json({error:"Acción inválida"},{status:400});
  }catch(error:any){
    console.error("[WORK_QUEUE_POST]",error);
    return NextResponse.json({error:error?.message||"No se pudo actualizar la cola"},{status:500});
  }
}
