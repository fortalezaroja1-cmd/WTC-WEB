import { NextRequest, NextResponse } from "next/server";
import { Permission, resolvePermissions } from "@/lib/permissions";

const TOKEN_NAME = "wt_admin_token";

const LANDING: Array<[Permission, string]> = [
  ["products.view", "/admin/productos"],
  ["orders.view", "/admin/pedidos"],
  ["inventory.view", "/admin/inventario"],
];
const CRM_URL = "https://www.wtgy.online/workspace";
const CATALOG_PAGES = new Set([
  "/admin",
  "/admin/login",
  "/admin/productos",
  "/admin/pedidos",
  "/admin/inventario",
]);
const CATALOG_APIS = new Set([
  "/api/admin/products",
  "/api/admin/orders",
  "/api/admin/sales-users",
  "/api/admin/session",
  "/api/admin/search",
  "/api/admin/nav-counts",
]);

function fromBase64Url(value: string): ArrayBuffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded = atob(padded);
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function decodePayload(value: string): Record<string, unknown> | null {
  try {
    const bytes = fromBase64Url(value);
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

async function validateAdminToken(
  token: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodePayload(encodedHeader);
  const payload = decodePayload(encodedPayload);
  if (!header || !payload || header.alg !== "HS256") return null;

  const now = Math.floor(Date.now() / 1000);
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : null;
  if (exp !== null && exp <= now) return null;
  if (nbf !== null && nbf > now) return null;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    return valid ? payload : null;
  } catch {
    return null;
  }
}

function unauthorized(request: NextRequest, apiRequest: boolean) {
  if (apiRequest) {
    const response = NextResponse.json(
      { error: "No autorizado" },
      { status: 401 },
    );
    response.cookies.delete(TOKEN_NAME);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  const response = NextResponse.redirect(new URL("/admin/login", request.url));
  response.cookies.delete(TOKEN_NAME);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function forbidden(
  request: NextRequest,
  apiRequest: boolean,
  role: string,
  permissions: Permission[],
) {
  if (apiRequest) {
    return NextResponse.json(
      { error: "No tienes permiso para realizar esta acción" },
      { status: 403 },
    );
  }
  const destination =
    role === "ADMIN"
      ? "/admin"
      : LANDING.find(([permission]) => permissions.includes(permission))?.[1] ||
        "/";
  if (request.nextUrl.pathname === destination) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.redirect(new URL(destination, request.url));
}

function requiredPermission(
  pathname: string,
  method: string,
): Permission | null {
  if (pathname === "/admin/productos" || pathname === "/api/admin/products")
    return method === "GET" ? "products.view" : "products.manage";
  if (pathname === "/admin/inventario") return "inventory.view";
  if (pathname === "/admin/pedidos" || pathname === "/api/admin/orders")
    return method === "GET" ? "orders.view" : "orders.manage";
  if (pathname === "/api/admin/sales-users") return "orders.view";
  if (pathname === "/api/upload") return "products.manage";
  return null;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/, "") || "/";
  if (pathname.startsWith("/admin") && !CATALOG_PAGES.has(pathname)) {
    return NextResponse.redirect(CRM_URL, 307);
  }
  if (
    (pathname.startsWith("/api/admin") && !CATALOG_APIS.has(pathname)) ||
    pathname.startsWith("/api/invitations") ||
    pathname.startsWith("/registro/invitacion")
  ) {
    return NextResponse.json(
      { error: "El CRM se administra en www.wtgy.online", crmUrl: CRM_URL },
      { status: 410, headers: { "Cache-Control": "no-store" } },
    );
  }
  const isAdminPage =
    pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  const isAdminApi =
    pathname.startsWith("/api/admin") || pathname === "/api/upload";

  if (isAdminPage || isAdminApi) {
    const token = request.cookies.get(TOKEN_NAME)?.value;
    const payload = await validateAdminToken(token);
    if (!payload) return unauthorized(request, isAdminApi);

    const role = String(payload.role || "SALES");
    const permissions = resolvePermissions(role, payload.permissions);

    if (role === "SALES") {
      if (isAdminApi) {
        return NextResponse.json(
          { error: "El perfil de ventas opera en www.wtgy.online" },
          { status: 403 },
        );
      }
      return NextResponse.redirect(CRM_URL, 307);
    }

    if (pathname === "/admin") {
      const destination =
        role === "ADMIN"
          ? "/admin/productos"
          : LANDING.find(([permission]) =>
              permissions.includes(permission),
            )?.[1] || "/";
      return NextResponse.redirect(new URL(destination, request.url));
    }
    const permission = requiredPermission(pathname, request.method);
    if (permission && role !== "ADMIN" && !permissions.includes(permission)) {
      return forbidden(request, isAdminApi, role, permissions);
    }
  }

  const response = NextResponse.next();
  if (isAdminPage || isAdminApi) {
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("Pragma", "no-cache");
  }
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/upload",
    "/api/invitations/:path*",
    "/registro/invitacion/:path*",
  ],
};
