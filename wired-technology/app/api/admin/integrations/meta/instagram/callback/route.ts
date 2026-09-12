import { NextRequest, NextResponse } from "next/server";
import {
  exchangeInstagramCode,
  fetchInstagramProfile,
  metaGraphVersion,
  publicBaseUrl,
  saveMetaConnection,
} from "@/lib/meta-integrations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const base = publicBaseUrl(url.origin) || url.origin;
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("wt_meta_instagram_state")?.value;
  const code = url.searchParams.get("code");
  const denied = url.searchParams.get("error");

  const redirect = (params: string) => {
    const response = NextResponse.redirect(`${base}/admin/integraciones?${params}`);
    response.cookies.delete("wt_meta_instagram_state");
    return response;
  };

  if (denied) return redirect("error=instagram_cancelled");
  if (!state || !expectedState || state !== expectedState) return redirect("error=instagram_state");
  if (!code) return redirect("error=instagram_no_code");

  try {
    const redirectUri = `${base}/api/admin/integrations/meta/instagram/callback`;
    const tokenData = await exchangeInstagramCode(code, redirectUri);
    const token = String(tokenData?.access_token || "");
    if (!token) throw new Error("Instagram no devolvió access token");

    const profile = await fetchInstagramProfile(token);
    const externalId = String(profile?.id || tokenData?.user_id || "");
    if (!externalId) throw new Error("No se pudo identificar la cuenta de Instagram");

    let webhookSubscribed = false;
    let webhookError: string | null = null;
    try {
      const subscribeUrl = new URL(`https://graph.instagram.com/${metaGraphVersion()}/${externalId}/subscribed_apps`);
      subscribeUrl.searchParams.set("subscribed_fields", "messages,messaging_postbacks,message_reactions");
      subscribeUrl.searchParams.set("access_token", token);
      const response = await fetch(subscribeUrl.toString(), { method: "POST", cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      webhookSubscribed = response.ok && !payload?.error;
      if (!webhookSubscribed) webhookError = payload?.error?.message || `HTTP ${response.status}`;
    } catch (error: any) {
      webhookError = error?.message || "No se pudo suscribir el webhook";
    }

    await saveMetaConnection({
      channel: "INSTAGRAM",
      externalAccountId: externalId,
      accountName: profile?.username ? `@${profile.username}` : "Instagram",
      username: profile?.username ? String(profile.username) : null,
      accessToken: token,
      tokenExpiresAt: tokenData?.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000) : null,
      scopes: ["instagram_business_basic", "instagram_business_manage_messages"],
      metadata: { source: "instagram_login", webhookSubscribed, webhookError },
    });

    return redirect(webhookSubscribed ? "connected=instagram" : `connected=instagram&warning=${encodeURIComponent(webhookError || "webhook_pending")}`);
  } catch (error: any) {
    console.error("[META_INSTAGRAM_CALLBACK]", error);
    return redirect(`error=instagram_callback&detail=${encodeURIComponent(error?.message || "Error de Instagram")}`);
  }
}
