import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureCrmTables } from "@/lib/crm";
import { ensureSalesTables, syncOpportunitiesFromLeads } from "@/lib/sales-system";

export const dynamic = "force-dynamic";

export async function GET(){
  try{
    await ensureCrmTables();
    await ensureSalesTables();
    await syncOpportunitiesFromLeads();
    const [newOrders,unreadRows,newOppRows,notifications]=await Promise.all([
      prisma.order.count({where:{shipStatus:"PENDING_PAYMENT"}}),
      prisma.$queryRawUnsafe<Array<{count:number}>>('SELECT COALESCE(SUM("unreadCount"),0)::int AS "count" FROM "Lead"'),
      prisma.$queryRawUnsafe<Array<{count:number}>>('SELECT COUNT(*)::int AS "count" FROM "Opportunity" WHERE "stage"=\'NEW\''),
      prisma.notification.count({where:{read:false}}),
    ]);
    return NextResponse.json({
      newOrders,
      unreadConversations:Number(unreadRows[0]?.count||0),
      newOpportunities:Number(newOppRows[0]?.count||0),
      notifications,
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error){
    console.error("[NAV_COUNTS]",error);
    return NextResponse.json({newOrders:0,unreadConversations:0,newOpportunities:0,notifications:0});
  }
}
