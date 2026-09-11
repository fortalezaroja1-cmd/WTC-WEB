import { NextRequest, NextResponse } from "next/server";

const TOKEN_NAME = "wt_admin_token";

function fromBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = atob(padded);
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function decodePayload(value: string): Record<string, unknown> | null {
  try {
    const bytes = fromBase64Url(value);
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function isValidAdminToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodePayload(encodedHeader);
  const payload = decodePayload(encodedPayload);
  if (!header || !payload || header.alg !== "HS256") return false;

  const now = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : null;
  if (exp !== null && exp <= now) return false;
  if (nbf !== null && nbf > now) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
  } catch {
    return false;
  }
}

function unauthorized(request: NextRequest, apiRequest: boolean) {
  if (apiRequest) {
    const response = NextResponse.json({ error: "No autorizado" }, { status: 401 });
    response.cookies.delete(TOKEN_NAME);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  response.cookies.delete(TOKEN_NAME);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (isAdminPage || isAdminApi) {
    const token = request.cookies.get(TOKEN_NAME)?.value;
    const valid = await isValidAdminToken(token);
    if (!valid) return unauthorized(request, isAdminApi);
  }

  const response = NextResponse.next();
  if (isAdminPage || isAdminApi) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
  }
  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
