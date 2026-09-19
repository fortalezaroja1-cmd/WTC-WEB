import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ensureCrmTables } from "@/lib/crm";
import { ensureSalesTables } from "@/lib/sales-system";
import { writeAudit } from "@/lib/audit";

export const dynamic="force-dynamic";

async function snapshot(){
  await ensureCrmTables();
  await ensureSalesTables();
  await prisma.$queryRawUnsafe("SELECT 1");
  const [products,customers,orders,opportunities,quotes,negativeProducts,negativeVariants,orphanQuotes]=await Promise.all([
    prisma.product.count(),
    prisma.customer.count(),
    prisma.order.count(),
    prisma.$queryRawUnsafe<Array<{count:number}>>('SELECT COUNT(*)::int AS "count" FROM "Opportunity"'),
    prisma.$queryRawUnsafe<Array<{count:number}>>('SELECT COUNT(*)::int AS "count" FROM "Quote"'),
    prisma.product.count({where:{stock:{lt:0}}}),
    prisma.variant.count({where:{stock:{lt:0}}}),
    prisma.$queryRawUnsafe<Array<{count:number}>>('SELECT COUNT(*)::int AS "count" FROM "Quote" q LEFT JOIN "Opportunity" o ON o."id"=q."opportunityId" WHERE o."id" IS NULL'),
  ]);
  const negativeCount=negativeProducts+negativeVariants;
  const orphanCount=Number(orphanQuotes[0]?.count||0);
  const checks=[
    {key:"database",label:"Base de datos",status:"OK",detail:"Conexión y consulta correctas"},
    {key:"crm",label:"Tablas CRM",status:"OK",detail:"Lead, mensajes y actividad disponibles"},
    {key:"sales",label:"Sistema de ventas",status:"OK",detail:"Oportunidades y cotizaciones disponibles"},
    {key:"inventory",label:"Integridad de inventario",status:negativeCount>0?"WARN":"OK",detail:negativeCount>0?String(negativeCount)+" referencias con stock negativo":"Sin stock negativo"},
    {key:"quotes",label:"Integridad de cotizaciones",status:orphanCount>0?"WARN":"OK",detail:orphanCount>0?String(orphanCount)+" cotizaciones sin oportunidad":"Sin cotizaciones huérfanas"},
    {key:"jwt",label:"Seguridad de sesión",status:process.env.JWT_SECRET?.trim()?"OK":"ERROR",detail:process.env.JWT_SECRET?.trim()?"JWT_SECRET configurado":"Falta JWT_SECRET"},
    {key:"db_env",label:"Configuración de base",status:process.env.DATABASE_URL?.trim()?"OK":"ERROR",detail:process.env.DATABASE_URL?.trim()?"DATABASE_URL configurada":"Falta DATABASE_URL"},
  ];
  return {
    ok:checks.every(x=>x.status!=="ERROR"),
    checks,
    counts:{products,customers,orders,opportunities:Number(opportunities[0]?.count||0),quotes:Number(quotes[0]?.count||0)},
    revision:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7)||null,
    environment:process.env.VERCEL_ENV||process.env.NODE_ENV||"unknown",
    checkedAt:new Date().toISOString(),
  };
}

export async function GET(){
  try{return NextResponse.json(await snapshot(),{headers:{"Cache-Control":"no-store"}})}
  catch(error:any){console.error("[SYSTEM_HEALTH]",error);return NextResponse.json({ok:false,error:error?.message||"Fallo de diagnóstico"},{status:500})}
}

export async function POST(req:NextRequest){
  try{
    const session=await getSession();
    if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
    const body=await req.json().catch(()=>({}));
    if(body?.action!=="smoke-test")return NextResponse.json({error:"Acción inválida"},{status:400});
    await ensureSalesTables();
    let rolledBack=false;
    try{
      await prisma.$transaction(async(tx)=>{
        const oppId=randomUUID(), quoteId=randomUUID(), activityId=randomUUID();
        await tx.$executeRawUnsafe("INSERT INTO \"Opportunity\" (\"id\",\"title\",\"stage\",\"source\",\"createdAt\",\"updatedAt\") VALUES ($1,$2,'NEW','SYSTEM_TEST',NOW(),NOW())",oppId,"Prueba transaccional Wired");
        await tx.$executeRawUnsafe("INSERT INTO \"Quote\" (\"id\",\"number\",\"opportunityId\",\"status\",\"subtotal\",\"shipping\",\"total\",\"createdAt\",\"updatedAt\") VALUES ($1,$2,$3,'DRAFT',0,0,0,NOW(),NOW())",quoteId,"TEST-"+randomUUID(),oppId);
        await tx.$executeRawUnsafe("INSERT INTO \"SalesActivity\" (\"id\",\"opportunityId\",\"type\",\"text\",\"createdAt\") VALUES ($1,$2,'SYSTEM_TEST',$3,NOW())",activityId,oppId,"Prueba de escritura y relaciones");
        throw new Error("WIRED_SMOKE_ROLLBACK");
      });
    }catch(error:any){
      if(error?.message==="WIRED_SMOKE_ROLLBACK")rolledBack=true;
      else throw error;
    }
    if(!rolledBack)throw new Error("La prueba no confirmó rollback");
    const state=await snapshot();
    await writeAudit({actorUserId:session.userId,actorName:session.name,action:"SYSTEM_SMOKE_TEST",meta:{result:"OK"}});
    return NextResponse.json({ok:true,message:"Flujo transaccional oportunidad → cotización → actividad validado y revertido sin dejar datos de prueba.",state});
  }catch(error:any){
    console.error("[SYSTEM_SMOKE_TEST]",error);
    return NextResponse.json({ok:false,error:error?.message||"Falló la prueba"},{status:500});
  }
}