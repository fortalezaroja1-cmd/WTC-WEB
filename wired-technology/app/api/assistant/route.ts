import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureCrmTables } from "@/lib/crm";
import { simulateSalesAgent, type SalesAgentSimulationState } from "@/lib/sales-agent-simulator";

export const dynamic = "force-dynamic";

async function saveWebLead(state:any, text:string, reply:string) {
  const interest=state?.productName || state?.sku || state?.product || null;
  const buying=Boolean(state?.awaitingConfirmation || state?.qty || state?.city || state?.customerName || state?.address);
  if(!buying || !interest) return null;
  await ensureCrmTables();
  const sessionId=String(state?.webLeadId || randomUUID());
  const identity=`WEB:${sessionId}`;
  const rows=await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "Lead" ("id","whatsappId","externalContactId","channel","source","status","name","lastMessageText","lastMessageAt","lastInboundAt","createdAt","updatedAt")
     VALUES ($1,$2,$2,'WEB','WEB_ASSISTANT','NEW',$3,$4,NOW(),NOW(),NOW(),NOW())
     ON CONFLICT ("whatsappId") DO UPDATE SET "name"=COALESCE(EXCLUDED."name","Lead"."name"),"lastMessageText"=EXCLUDED."lastMessageText","lastMessageAt"=NOW(),"lastInboundAt"=NOW(),"updatedAt"=NOW()
     RETURNING "id"`,
    sessionId,identity,state?.customerName||null,text
  );
  const leadId=rows[0]?.id; if(!leadId)return null;
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CrmActivity" ("id","leadId","type","text","meta","createdAt") VALUES ($1,$2,'WEB_AGENT',$3,$4::jsonb,NOW())`,
    randomUUID(),leadId,`Interés detectado por asistente: ${interest}`,JSON.stringify({interest,qty:state?.qty||null,city:state?.city||null,reply})
  );
  return {leadId,webLeadId:sessionId};
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const state = body?.state && typeof body.state === "object" ? body.state as SalesAgentSimulationState : undefined;
    if (!text) return NextResponse.json({ error: "Escribe un mensaje" }, { status: 400 });

    const result = await simulateSalesAgent({ text, state });
    const next:any={...(result.decision.state||{})};
    const captured=await saveWebLead(next,text,result.decision.reply);
    if(captured) next.webLeadId=captured.webLeadId;

    return NextResponse.json({
      ok:true,
      reply:result.decision.reply,
      state:next,
      decision:result.decision,
      leadId:captured?.leadId||null
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("[WIRED_ASSISTANT]", error);
    return NextResponse.json({ error: error?.message || "No se pudo ejecutar el asistente" }, { status: 500 });
  }
}