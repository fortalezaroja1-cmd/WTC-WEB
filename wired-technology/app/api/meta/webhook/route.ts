import { createHmac, timingSafeEqual } from "crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { saveInboundWhatsAppMessage } from "@/lib/crm";
import { processInboundLeadWithAgent } from "@/lib/sales-agent";
import { maybeHandleAwayMessage } from "@/lib/away-message";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function getVerifyToken() {
  return process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() || null;
}

function isValidMetaSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = process.env.META_APP_SECRET?.trim();
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

function randomMs(minSeconds: number, maxSeconds: number) {
  return Math.round((minSeconds + Math.random() * (maxSeconds - minSeconds)) * 1000);
}

function naturalReplyDelay(text: string) {
  const normalized = text.toLowerCase();
  if (text.length > 180 || /\b(confirmo|comprar|lo compro|pedido|programar|direcci[oó]n)\b/.test(normalized)) return randomMs(6, 10);
  if (/\b(precio|cu[aá]nto|stock|disponible|env[ií]o|contraentrega|flete|cable|alambre|breaker|panel)\b/.test(normalized) || /[#\d]/.test(text)) return randomMs(4, 7);
  return randomMs(2, 4);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function latestInboundBundle(leadId: string) {
  const leads = await prisma.$queryRawUnsafe<Array<{ lastOutboundAt: Date | null }>>(
    `SELECT "lastOutboundAt" FROM "Lead" WHERE "id"=$1 LIMIT 1`, leadId,
  );
  const lastOutboundAt = leads[0]?.lastOutboundAt || new Date(0);
  const rows = await prisma.$queryRawUnsafe<Array<{ metaMessageId: string; text: string | null; sentAt: Date }>>(
    `SELECT "metaMessageId", "text", "sentAt"
     FROM "CrmMessage"
     WHERE "leadId"=$1 AND "direction"='INBOUND' AND "sentAt">$2
     ORDER BY "sentAt" ASC, "createdAt" ASC
     LIMIT 20`,
    leadId, lastOutboundAt,
  );
  const latest = rows[rows.length - 1];
  const texts = rows
    .map((row) => String(row.text || "").trim())
    .filter((text) => text && !/^\[[^\]]+\]$/.test(text));
  return {
    latestMetaMessageId: latest?.metaMessageId || null,
    text: texts.join("\n").slice(0, 4000),
  };
}

async function continueConversation(input: {
  leadId: string;
  currentMetaMessageId: string;
  fallbackText: string | null;
  source: string;
  whatsappId: string;
  phoneNumberId: string | null | undefined;
  isMetaTest: boolean;
}) {
  try {
    let handledByAwayMessage = false;
    if (!input.isMetaTest) {
      handledByAwayMessage = await maybeHandleAwayMessage({
        leadId: input.leadId,
        whatsappId: input.whatsappId,
        phoneNumberId: input.phoneNumberId,
      });
    }
    if (handledByAwayMessage) return;

    const beforeDelay = await latestInboundBundle(input.leadId);
    if (beforeDelay.latestMetaMessageId && beforeDelay.latestMetaMessageId !== input.currentMetaMessageId) return;
    const timingText = beforeDelay.text || input.fallbackText;
    if (!timingText) return;

    if (!input.isMetaTest) await wait(naturalReplyDelay(timingText));

    // Se valida de nuevo después de la espera. Si el cliente mandó otro mensaje
    // durante esos segundos, este callback se cancela y responderá el del último
    // mensaje con toda la ráfaga concatenada.
    const finalBundle = await latestInboundBundle(input.leadId);
    if (finalBundle.latestMetaMessageId && finalBundle.latestMetaMessageId !== input.currentMetaMessageId) return;
    const text = finalBundle.text || timingText;

    await processInboundLeadWithAgent({
      leadId: input.leadId,
      metaMessageId: input.currentMetaMessageId,
      text,
      source: input.source,
    });
  } catch (error) {
    console.error("[CRM_AFTER_RESPONSE] Processing error", error);
  }
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
            const sentAt = isMetaTest ? new Date() : Number.isFinite(timestamp) ? new Date(timestamp * 1000) : new Date();
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
              const input = {
                leadId: saved.leadId,
                currentMetaMessageId: String(message.id),
                fallbackText: text,
                source,
                whatsappId: String(message.from),
                phoneNumberId: value?.metadata?.phone_number_id,
                isMetaTest,
              };
              after(() => continueConversation(input));
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
