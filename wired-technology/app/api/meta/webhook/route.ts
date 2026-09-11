import { NextRequest, NextResponse } from "next/server";
import { saveInboundWhatsAppMessage } from "@/lib/crm";

export const dynamic = "force-dynamic";

const VERIFY_TOKEN =
  process.env.META_WEBHOOK_VERIFY_TOKEN || "wired_sales_meta_verify_2026";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { ok: false, error: "Webhook verification failed" },
    { status: 403 }
  );
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
    const body = await request.json();

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

            await saveInboundWhatsAppMessage({
              metaMessageId: String(message.id),
              whatsappId: String(message.from),
              phone: String(message.from),
              name: contact?.profile?.name ? String(contact.profile.name) : null,
              type: String(message.type || "unknown"),
              text: getMessageText(message),
              sentAt,
              source: isMetaTest ? "META_TEST" : "WHATSAPP",
              payload: { entryId: entry?.id || null, value, message },
            });
          }
        }
      }
    }

    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error) {
    console.error("[META_WEBHOOK] Processing error", error);
    return NextResponse.json(
      { status: "PROCESSING_ERROR" },
      { status: 500 }
    );
  }
}
