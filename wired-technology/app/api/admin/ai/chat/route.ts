import { NextRequest, NextResponse } from "next/server";
import { AI_PROVIDERS, runAiChat, type AiProviderId, type AiChatMessage } from "@/lib/ai-providers";
import { prisma } from "@/lib/db";

export const dynamic="force-dynamic";

function validProvider(value:unknown): value is AiProviderId {
  return ["openai","anthropic","gemini"].includes(String(value));
}

export async function POST(req:NextRequest){
  try{
    const body=await req.json().catch(()=>({}));
    const provider=body?.provider;
    if(!validProvider(provider))return NextResponse.json({error:"Proveedor inválido"},{status:400});
    const cfg=await prisma.siteSetting.findUnique({where:{key:"aiModel_"+provider}});
    const model=String(body?.model||cfg?.value||AI_PROVIDERS[provider].defaultModel).trim();
    const messages=Array.isArray(body?.messages)?body.messages as AiChatMessage[]:[];
    if(!messages.length)return NextResponse.json({error:"Escribe un mensaje"},{status:400});

    const result=await runAiChat({provider,model,messages});
    return NextResponse.json({
      ok:true,
      provider,
      model:result.model||model,
      reply:result.text,
      usage:result.usage||null,
    },{headers:{"Cache-Control":"no-store"}});
  }catch(error:any){
    console.error("[AI_TEST_CHAT]",error);
    return NextResponse.json({error:error?.message||"No se pudo obtener respuesta"},{status:400});
  }
}
