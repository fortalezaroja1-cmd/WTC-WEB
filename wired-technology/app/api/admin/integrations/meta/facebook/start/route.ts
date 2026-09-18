import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { fetchFacebookPageProfile, metaEnvStatus, metaGraphVersion, publicBaseUrl, saveMetaConnection, subscribeFacebookPage } from "@/lib/meta-integrations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const base = publicBaseUrl(origin) || origin;
  const pageToken = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  if (pageToken) {
    try {
      const page = await fetchFacebookPageProfile(pageToken);
      const pageId = String(page?.id || "");
      if (!pageId) throw new Error("Meta no devolvió el ID de la página");
      await subscribeFacebookPage(pageId, pageToken);
      await saveMetaConnection({ channel: "MESSENGER", externalAccountId: pageId, accountName: page?.name ? String(page.name) : null, accessToken: pageToken, scopes: ["pages_show_list","pages_manage_metadata","pages_messaging"], metadata: { webhookSubscribed: true, source: "META_PAGE_ACCESS_TOKEN" } });
      return NextResponse.redirect(`${base}/admin/integraciones?connected=facebook&count=1`);
    } catch (error: any) {
      console.error("[META_FACEBOOK_PAGE_TOKEN]", error);
      return NextResponse.redirect(`${base}/admin/integraciones?error=facebook_page_token&detail=${encodeURIComponent(error?.message || "Error de Meta")}`);
    }
  }
  const env = metaEnvStatus(origin);
  if (!env.facebook.ready || !env.facebook.appId) {
    return NextResponse.redirect(`${publicBaseUrl(origin) || origin}/admin/integraciones?error=facebook_not_configured`);
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = env.facebook.callbackUrl!;
  const url = new URL(`https://www.facebook.com/${metaGraphVersion()}/dialog/oauth`);
  url.searchParams.set("client_id", env.facebook.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging");

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("wt_meta_facebook_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
