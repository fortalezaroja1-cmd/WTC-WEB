import { NextRequest, NextResponse } from "next/server";
import {
  exchangeInstagramCode,
  fetchInstagramProfile,
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

    await saveMetaConnection({
      channel: "INSTAGRAM",
      externalAccountId: externalId,
      accountName: profile?.username ? `@${profile.username}` : "Instagram",
      username: profile?.username ? String(profile.username) : null,
      accessToken: token,
      tokenExpiresAt: tokenData?.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000) : null,
      scopes: ["instagram_business_basic", "instagram_business_manage_messages"],
      metadata: { source: "instagram_login", webhookSubscribed: false },
    });

    return redirect("connected=instagram");
  } catch (error: any) {
    console.error("[META_INSTAGRAM_CALLBACK]", error);
    return redirect(`error=instagram_callback&detail=${encodeURIComponent(error?.message || "Error de Instagram")}`);
  }
}
