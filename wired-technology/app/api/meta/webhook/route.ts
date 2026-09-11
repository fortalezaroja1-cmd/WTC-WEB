import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { saveInboundWhatsAppMessage } from "@/lib/crm";
import { processInboundLeadWithAgent } from "@/lib/sales-agent";
import { maybeHandleAwayMessage } from "@/lib/away-message";

export const dynamic = "force-dynamic";

function getVerifyToken() {
  return process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || null;
}

function isValidMetaSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.META_APP_SECRET?.trim();

  // La verificación criptográfica queda activa automáticamente en cuanto
  // META_APP_SECRET esté configurado. Mientras no exista, el diagnóstico
  // de /api/admin/system/health marcará la integración como incompleta.
  if (!appSecret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const received = signatureHeader.slice("sha256=".length);
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");

  try {
    const receivedBuffer = Buffer.from(received, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    if (receivedBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(receivedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const verifyToken = getVerifyToken();
  if (!verifyToken) {
    console.error("[META_WEBHOOK] META_WEBHOOK_VERIFY_TOKEN no está configurado");
    return NextResponse.json({ ok: false, error: "Webhook no configurado" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ ok: false, error: "Webhook verification failed" }, { status: 403 });
}

function getMessageText(message: any) {
  if (message?.text?.body) return String(message.text.body);
  if (message?.button?.text) return String(message.button.text);
  if (message?.interactive?.button_reply?.title) return String(message.interactive.button_reply.title);
  if (message?.interactive?.list_reply?.title) return String(message.interactive.list_reply.title);
  if (message?.image?.caption) return String(message.image.caption);
  if (message?.document?.caption) return String(message.document.caption);
  return message?.type ? `[${message.type}]` : null;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (!isValidMetaSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
      console.warn("[META_WEBHOOK] Firma inválida");
      return NextResponse.json({ status: "INVALID_SIGNATURE" }, { status: 401 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ status: "INVALID_JSON" }, { status: 400 });
    }

    console.log("[META_WEBHOOK] Event received", JSON.stringify(body));

    if (body?.object === "whatsapp_business_account" && Array.isArray(body?.entry)) {
      for (const entry of body.entry) {
        for (const change of entry?.changes || []) {
          if (change?.field !== "messages") continue;

          const value = change?.value || {};
          const contacts = Array.isArray(value.contacts) ? value.contacts : [];
          const messages = Array.isArray(value.messages) ? value.messages : [];
          const isMetaTest = value?.metadata?.phone_number_id === "123456123";

          for (const message of messages) {
            if (!message?.id || !message?.from) continue;
            const contact = contacts.find((item: any) => item?.wa_id === message.from) || contacts[0];
            const timestamp = Number(message.timestamp);
            const sentAt = isMetaTest
              ? new Date()
              : Number.isFinite(timestamp)
                ? new Date(timestamp * 1000)
                : new Date();
            const text = getMessageText(message);
            const source = isMetaTest ? "META_TEST" : "WHATSAPP";

            const saved = await saveInboundWhatsAppMessage({
              metaMessageId: String(message.id),
              whatsappId: String(message.from),
              phone: String(message.from),
              name: contact?.profile?.name ? String(contact.profile.name) : null,
              type: String(message.type || "unknown"),
              text,
              sentAt,
              source,
              payload: { entryId: entry?.id || null, value, message },
            });

            if (saved.inserted) {
              let handledByAwayMessage = false;

              if (!isMetaTest) {
                try {
                  handledByAwayMessage = await maybeHandleAwayMessage({
                    leadId: saved.leadId,
                    whatsappId: String(message.from),
                    phoneNumberId: value?.metadata?.phone_number_id,
                  });
                } catch (awayError) {
                  // Si la evaluación de ausencia falla por un error inesperado,
                  // dejamos que el agente normal intente responder para no perder el lead.
                  console.error("[AWAY_MESSAGE] Processing error", awayError);
                }
              }

              if (!handledByAwayMessage) {
                try {
                  await processInboundLeadWithAgent({
                    leadId: saved.leadId,
                    metaMessageId: String(message.id),
                    text,
                    source,
                  });
                } catch (agentError) {
                  // El webhook debe seguir respondiendo 200 a Meta aunque el agente falle.
                  // El motor registra el error y crea una notificación para intervención humana.
                  console.error("[SALES_AGENT] Processing error", agentError);
                }
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error) {
    console.error("[META_WEBHOOK] Processing error", error);
    return NextResponse.json({ status: "PROCESSING_ERROR" }, { status: 500 });
  }
}
