import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req:NextRequest){
  const unread=req.nextUrl.searchParams.get("unread")==="1";
  const items=await prisma.notification.findMany({
    where:unread?{read:false}:undefined,
    orderBy:{createdAt:"desc"},
    take:200,
  });
  return NextResponse.json(items,{headers:{"Cache-Control":"no-store"}});
}

export async function PUT(req:NextRequest){
  const body=await req.json().catch(()=>({}));
  if(body?.all){
    await prisma.notification.updateMany({where:{read:false},data:{read:true}});
    return NextResponse.json({ok:true});
  }
  const id=String(body?.id||"");
  if(!id)return NextResponse.json({error:"Notificación requerida"},{status:400});
  await prisma.notification.update({where:{id},data:{read:body?.read===false?false:true}});
  return NextResponse.json({ok:true});
}
