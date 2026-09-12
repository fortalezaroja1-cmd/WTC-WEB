import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { metaEnvStatus, publicBaseUrl } from "@/lib/meta-integrations";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin;
  const env = metaEnvStatus(origin);
  if (!env.instagram.ready || !env.instagram.appId) {
    return NextResponse.redirect(`${publicBaseUrl(origin) || origin}/admin/integraciones?error=instagram_not_configured`);
  }

  const state = randomBytes(24).toString("hex");
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", env.instagram.appId);
  url.searchParams.set("redirect_uri", env.instagram.callbackUrl!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "instagram_business_basic,instagram_business_manage_messages");
  url.searchParams.set("state", state);
  url.searchParams.set("enable_fb_login", "0");
  url.searchParams.set("force_authentication", "1");

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("wt_meta_instagram_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
