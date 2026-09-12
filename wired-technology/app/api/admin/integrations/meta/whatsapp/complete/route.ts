import { NextRequest, NextResponse } from "next/server";
import {
  exchangeWhatsAppEmbeddedCode,
  fetchWhatsAppPhone,
  saveMetaConnection,
  subscribeWhatsAppWaba,
} from "@/lib/meta-integrations";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const code = String(body?.code || "").trim();
    const wabaId = String(body?.wabaId || body?.waba_id || "").trim();
    const phoneNumberId = String(body?.phoneNumberId || body?.phone_number_id || "").trim();
    const businessId = body?.businessId || body?.business_id || null;

    if (!code) return NextResponse.json({ error: "Meta no devolvió el código de autorización" }, { status: 400 });
    if (!wabaId || !phoneNumberId) {
      return NextResponse.json({ error: "Meta no devolvió WABA ID y Phone Number ID. Completa todo el flujo de WhatsApp." }, { status: 400 });
    }

    const tokenData = await exchangeWhatsAppEmbeddedCode(code);
    const token = String(tokenData?.access_token || "");
    if (!token) throw new Error("Meta no devolvió access token para WhatsApp");

    await subscribeWhatsAppWaba(wabaId, token);
    const phone = await fetchWhatsAppPhone(phoneNumberId, token).catch(() => ({}));

    await saveMetaConnection({
      channel: "WHATSAPP",
      externalAccountId: phoneNumberId,
      externalParentId: wabaId,
      accountName: phone?.verified_name ? String(phone.verified_name) : "WhatsApp Business",
      username: phone?.display_phone_number ? String(phone.display_phone_number) : null,
      accessToken: token,
      tokenExpiresAt: tokenData?.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000) : null,
      scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
      metadata: {
        wabaId,
        phoneNumberId,
        businessId,
        displayPhoneNumber: phone?.display_phone_number || null,
        verifiedName: phone?.verified_name || null,
        qualityRating: phone?.quality_rating || null,
        webhookSubscribed: true,
        onboarding: "embedded_signup_coexistence",
      },
    });

    return NextResponse.json({
      ok: true,
      connection: {
        channel: "WHATSAPP",
        phoneNumberId,
        wabaId,
        displayPhoneNumber: phone?.display_phone_number || null,
        verifiedName: phone?.verified_name || null,
      },
    });
  } catch (error: any) {
    console.error("[META_WHATSAPP_COMPLETE]", error);
    return NextResponse.json({ error: error?.message || "No se pudo completar WhatsApp" }, { status: 500 });
  }
}
