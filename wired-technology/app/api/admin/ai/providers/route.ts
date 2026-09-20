import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { AI_PROVIDERS, deleteAiApiKey, getProviderStatus, saveAiApiKey, testAiKey, type AiProviderId } from "@/lib/ai-providers";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export const dynamic="force-dynamic";

function validProvider(value:unknown): value is AiProviderId {
  return ["openai","anthropic","gemini"].includes(String(value));
}

async function getDefaultModels(){
  const rows=await prisma.siteSetting.findMany({where:{key:{in:["aiModel_openai","aiModel_anthropic","aiModel_gemini","aiDefaultProvider"]}}});
  return Object.fromEntries(rows.map(r=>[r.key,r.value]));
}

export async function GET(){
  const cfg=await getDefaultModels();
  const providers=await Promise.all((Object.keys(AI_PROVIDERS) as AiProviderId[]).map(async id=>({
    id,
    name:AI_PROVIDERS[id].name,
    defaultModel:cfg["aiModel_"+id]||AI_PROVIDERS[id].defaultModel,
    ...(await getProviderStatus(id)),
  })));
  return NextResponse.json({
    providers,
    defaultProvider:cfg.aiDefaultProvider||"openai",
  },{headers:{"Cache-Control":"no-store"}});
}

export async function PUT(req:NextRequest){
  try{
    const session=await getSession();
    if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
    const body=await req.json().catch(()=>({}));
    const provider=body?.provider;
    if(!validProvider(provider))return NextResponse.json({error:"Proveedor inválido"},{status:400});
    const apiKey=String(body?.apiKey||"").trim();
    const model=String(body?.model||AI_PROVIDERS[provider].defaultModel).trim();
    if(!apiKey)return NextResponse.json({error:"Pega la API key"},{status:400});

    const test=await testAiKey(provider,apiKey,model);
    await saveAiApiKey(provider,apiKey);
    await prisma.siteSetting.upsert({
      where:{key:"aiModel_"+provider},
      update:{value:model},
      create:{key:"aiModel_"+provider,value:model},
    });
    if(body?.makeDefault){
      await prisma.siteSetting.upsert({
        where:{key:"aiDefaultProvider"},
        update:{value:provider},
        create:{key:"aiDefaultProvider",value:provider},
      });
    }
    await writeAudit({
      actorUserId:session.userId,
      actorName:session.name,
      action:"AI_PROVIDER_CONNECTED",
      meta:{provider,model},
    });
    return NextResponse.json({ok:true,provider,model,test:test.text});
  }catch(error:any){
    console.error("[AI_PROVIDER_CONNECT]",error);
    return NextResponse.json({error:error?.message||"No se pudo conectar el proveedor"},{status:400});
  }
}

export async function PATCH(req:NextRequest){
  try{
    const session=await getSession();
    if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
    const body=await req.json().catch(()=>({}));
    const provider=body?.provider;
    if(!validProvider(provider))return NextResponse.json({error:"Proveedor inválido"},{status:400});
    const model=String(body?.model||AI_PROVIDERS[provider].defaultModel).trim();
    await prisma.siteSetting.upsert({
      where:{key:"aiModel_"+provider},
      update:{value:model},
      create:{key:"aiModel_"+provider,value:model},
    });
    if(body?.makeDefault){
      await prisma.siteSetting.upsert({
        where:{key:"aiDefaultProvider"},
        update:{value:provider},
        create:{key:"aiDefaultProvider",value:provider},
      });
    }
    await writeAudit({actorUserId:session.userId,actorName:session.name,action:"AI_PROVIDER_SETTINGS_UPDATED",meta:{provider,model,makeDefault:Boolean(body?.makeDefault)}});
    return NextResponse.json({ok:true});
  }catch(error:any){
    return NextResponse.json({error:error?.message||"No se pudo guardar"},{status:400});
  }
}

export async function DELETE(req:NextRequest){
  try{
    const session=await getSession();
    if(!session)return NextResponse.json({error:"No autorizado"},{status:401});
    const body=await req.json().catch(()=>({}));
    const provider=body?.provider;
    if(!validProvider(provider))return NextResponse.json({error:"Proveedor inválido"},{status:400});
    await deleteAiApiKey(provider);
    await writeAudit({actorUserId:session.userId,actorName:session.name,action:"AI_PROVIDER_DISCONNECTED",meta:{provider}});
    return NextResponse.json({ok:true});
  }catch(error:any){
    return NextResponse.json({error:error?.message||"No se pudo desconectar"},{status:400});
  }
}
