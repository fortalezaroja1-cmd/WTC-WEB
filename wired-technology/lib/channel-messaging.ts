import { getMetaConnectionToken, metaGraphVersion } from "@/lib/meta-integrations";

async function parseMetaResponse(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || `Meta rechazó el mensaje (${response.status})`);
  }
  return payload;
}

export async function sendChannelText(lead: any, text: string) {
  const channel = String(lead?.channel || "WHATSAPP").toUpperCase();
  const recipientId = String(lead?.externalContactId || lead?.whatsappId || "").trim();
  const channelAccountId = lead?.channelAccountId ? String(lead.channelAccountId) : null;
  if (!recipientId) throw new Error("El contacto no tiene identificador de canal");

  if (channel === "WHATSAPP") {
    const phoneNumberId = channelAccountId || process.env.META_WHATSAPP_PHONE_NUMBER_ID || "";
    const token = (phoneNumberId ? await getMetaConnectionToken("WHATSAPP", phoneNumberId).catch(() => null) : null)
      || process.env.META_WHATSAPP_ACCESS_TOKEN
      || "";
    if (!phoneNumberId) throw new Error("No se encontró el Phone Number ID de WhatsApp");
    if (!token) throw new Error("No se encontró token de WhatsApp");

    const response = await fetch(`https://graph.facebook.com/${metaGraphVersion()}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipientId,
        type: "text",
        text: { preview_url: false, body: text.slice(0, 4096) },
      }),
    });
    const payload = await parseMetaResponse(response);
    const messageId = payload?.messages?.[0]?.id;
    if (!messageId) throw new Error("Meta no devolvió ID del mensaje de WhatsApp");
    return { messageId: String(messageId), payload, channel };
  }

  if (channel === "MESSENGER") {
    if (!channelAccountId) throw new Error("No se encontró la página de Facebook asociada");
    const token = await getMetaConnectionToken("MESSENGER", channelAccountId);
    if (!token) throw new Error("La página de Facebook no está conectada o perdió autorización");

    const response = await fetch(`https://graph.facebook.com/${metaGraphVersion()}/${channelAccountId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: text.slice(0, 2000) } }),
    });
    const payload = await parseMetaResponse(response);
    const messageId = payload?.message_id || payload?.messages?.[0]?.id;
    if (!messageId) throw new Error("Meta no devolvió ID del mensaje de Messenger");
    return { messageId: String(messageId), payload, channel };
  }

  if (channel === "INSTAGRAM") {
    if (!channelAccountId) throw new Error("No se encontró la cuenta de Instagram asociada");
    const token = await getMetaConnectionToken("INSTAGRAM", channelAccountId);
    if (!token) throw new Error("La cuenta de Instagram no está conectada o perdió autorización");

    const response = await fetch(`https://graph.instagram.com/${metaGraphVersion()}/${channelAccountId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: recipientId }, message: { text: text.slice(0, 1000) } }),
    });
    const payload = await parseMetaResponse(response);
    const messageId = payload?.message_id || payload?.messages?.[0]?.id;
    if (!messageId) throw new Error("Instagram no devolvió ID del mensaje");
    return { messageId: String(messageId), payload, channel };
  }

  throw new Error(`Canal no soportado: ${channel}`);
}
