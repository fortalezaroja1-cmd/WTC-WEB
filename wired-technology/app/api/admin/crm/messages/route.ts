import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureCrmTables, saveOutboundWhatsAppMessage } from "@/lib/crm";
import { getSession } from "@/lib/auth";

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
        { error: "Este contacto proviene del evento simulado de Meta. Usa una conversación real del número de prueba para responder." },
        { status: 409 }
      );
    }

    const token = process.env.META_WHATSAPP_ACCESS_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "Falta configurar META_WHATSAPP_ACCESS_TOKEN en Vercel" },
        { status: 503 }
      );
    }

    const metadataRows = await prisma.$queryRawUnsafe<Array<{ phoneNumberId: string | null }>>(
      `
        SELECT "payload"->'value'->'metadata'->>'phone_number_id' AS "phoneNumberId"
        FROM "CrmMessage"
        WHERE "leadId" = $1 AND "direction" = 'INBOUND'
        ORDER BY "sentAt" DESC, "createdAt" DESC
        LIMIT 1
      `,
      leadId
    );

    const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID || metadataRows[0]?.phoneNumberId;
    if (!phoneNumberId) {
      return NextResponse.json({ error: "No se encontró el Phone Number ID de WhatsApp" }, { status: 409 });
    }

    const graphVersion = process.env.META_GRAPH_VERSION || "v26.0";
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: lead.whatsappId,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("[CRM_WHATSAPP_SEND] Meta error", payload);
      return NextResponse.json(
        { error: payload?.error?.message || "Meta rechazó el mensaje", meta: payload?.error || null },
        { status: 502 }
      );
    }

    const metaMessageId = payload?.messages?.[0]?.id;
    if (!metaMessageId) {
      return NextResponse.json({ error: "Meta no devolvió identificador del mensaje" }, { status: 502 });
    }

    await saveOutboundWhatsAppMessage({
      leadId,
      metaMessageId: String(metaMessageId),
      text,
      payload,
    });

    // Attribution is stored on the message itself so future reassignment of the lead
    // does not rewrite the seller history.
    await prisma.$executeRawUnsafe(
      `UPDATE "CrmMessage"
       SET "senderType" = 'HUMAN', "senderUserId" = $2, "senderUserName" = $3
       WHERE "metaMessageId" = $1`,
      String(metaMessageId),
      session.userId,
      session.name || session.email,
    );

    return NextResponse.json({ ok: true, id: metaMessageId });
  } catch (error) {
    console.error("[CRM_WHATSAPP_SEND] Error", error);
    return NextResponse.json({ error: "No se pudo enviar el mensaje" }, { status: 500 });
  }
}
