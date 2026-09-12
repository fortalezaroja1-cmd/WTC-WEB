import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureCrmTables, saveOutboundChannelMessage } from "@/lib/crm";
import { getSession } from "@/lib/auth";
import { sendChannelText } from "@/lib/channel-messaging";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await ensureCrmTables();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await request.json();
    const leadId = String(body?.leadId || "");
    const text = String(body?.text || "").trim();

    if (!leadId || !text) {
      return NextResponse.json({ error: "Lead y mensaje son requeridos" }, { status: 400 });
    }
    if (text.length > 4096) {
      return NextResponse.json({ error: "El mensaje supera 4096 caracteres" }, { status: 400 });
    }

    const leads = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "Lead" WHERE "id" = $1 LIMIT 1`,
      leadId
    );
    const lead = leads[0];
    if (!lead) return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    if (lead.source === "META_TEST") {
      return NextResponse.json(
        { error: "Este contacto proviene de un evento simulado de Meta. Usa una conversación real para responder." },
        { status: 409 }
      );
    }

    const sent = await sendChannelText(lead, text);

    await saveOutboundChannelMessage({
      leadId,
      metaMessageId: sent.messageId,
      text,
      payload: sent.payload,
      senderType: "HUMAN",
      senderUserId: session.userId,
      senderUserName: session.name || session.email,
    });

    return NextResponse.json({ ok: true, id: sent.messageId, channel: sent.channel });
  } catch (error: any) {
    console.error("[CRM_CHANNEL_SEND] Error", error);
    return NextResponse.json({ error: error?.message || "No se pudo enviar el mensaje" }, { status: 500 });
  }
}
