import { NextRequest, NextResponse } from "next/server";
import {
  exchangeFacebookCode,
  fetchFacebookPages,
  publicBaseUrl,
  saveMetaConnection,
  subscribeFacebookPage,
} from "@/lib/meta-integrations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const base = publicBaseUrl(url.origin) || url.origin;
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("wt_meta_facebook_state")?.value;
  const code = url.searchParams.get("code");
  const denied = url.searchParams.get("error");

  const redirect = (params: string) => {
    const response = NextResponse.redirect(`${base}/admin/integraciones?${params}`);
    response.cookies.delete("wt_meta_facebook_state");
    return response;
  };

  if (denied) return redirect("error=facebook_cancelled");
  if (!state || !expectedState || state !== expectedState) return redirect("error=facebook_state");
  if (!code) return redirect("error=facebook_no_code");

  try {
    const redirectUri = `${base}/api/admin/integrations/meta/facebook/callback`;
    const tokenData = await exchangeFacebookCode(code, redirectUri);
    const token = String(tokenData?.access_token || "");
    if (!token) throw new Error("Meta no devolvió access token");

    const pages = await fetchFacebookPages(token);
    let connected = 0;
    const errors: string[] = [];

    for (const page of pages) {
      const pageId = String(page?.id || "");
      const pageToken = String(page?.access_token || "");
      if (!pageId || !pageToken) continue;

      try {
        await subscribeFacebookPage(pageId, pageToken);
        await saveMetaConnection({
          channel: "MESSENGER",
          externalAccountId: pageId,
          accountName: page?.name ? String(page.name) : null,
          accessToken: pageToken,
          scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_metadata", "pages_messaging"],
          metadata: {
            tasks: Array.isArray(page?.tasks) ? page.tasks : [],
            instagramBusinessAccount: page?.instagram_business_account || null,
            webhookSubscribed: true,
          },
        });
        connected += 1;
      } catch (error: any) {
        errors.push(`${page?.name || pageId}: ${error?.message || "error"}`);
      }
    }

    if (!connected) {
      const detail = encodeURIComponent(errors[0] || "No se encontró una página con permisos de mensajería");
      return redirect(`error=facebook_no_pages&detail=${detail}`);
    }
    return redirect(`connected=facebook&count=${connected}`);
  } catch (error: any) {
    console.error("[META_FACEBOOK_CALLBACK]", error);
    return redirect(`error=facebook_callback&detail=${encodeURIComponent(error?.message || "Error de Meta")}`);
  }
}
