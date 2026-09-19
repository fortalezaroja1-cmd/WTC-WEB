import { NextRequest, NextResponse } from "next/server";
import { Permission, resolvePermissions } from "@/lib/permissions";

const TOKEN_NAME = "wt_admin_token";

const LANDING: Array<[Permission, string]> = [
  ["dashboard.view", "/admin"],
  ["inbox.view", "/admin/inbox"],
  ["crm.view", "/admin/crm"],
  ["tasks.view", "/admin/tareas"],
  ["orders.view", "/admin/pedidos"],
  ["inventory.view", "/admin/inventario"],
  ["products.view", "/admin/productos"],
  ["customers.view", "/admin/clientes"],
  ["analytics.view", "/admin/analitica"],
  ["integrations.view", "/admin/integraciones"],
  ["settings.view", "/admin/configuracion"],
  ["users.manage", "/admin/usuarios"],
];

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

async function validateAdminToken(token: string | undefined): Promise<Record<string, unknown> | null> {
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
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    return valid ? payload : null;
  } catch {
    return null;
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

function forbidden(request: NextRequest, apiRequest: boolean, role: string, permissions: Permission[]) {
  if (apiRequest) {
    return NextResponse.json({ error: "No tienes permiso para realizar esta acción" }, { status: 403 });
  }
  const destination = role === "ADMIN"
    ? "/admin"
    : LANDING.find(([permission]) => permissions.includes(permission))?.[1] || "/";
  if (request.nextUrl.pathname === destination) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.redirect(new URL(destination, request.url));
}

function requiredPermission(pathname: string, method: string): Permission | null {
  if (pathname.startsWith("/admin/usuarios")) return "users.manage";
  if (pathname.startsWith("/admin/actividad")) return "dashboard.view";
  if (pathname.startsWith("/admin/notificaciones")) return "dashboard.view";
  if (pathname.startsWith("/admin/inbox")) return "inbox.view";
  if (pathname.startsWith("/admin/crm")) return "crm.view";
  if (pathname.startsWith("/admin/cotizaciones")) return "crm.view";
  if (pathname.startsWith("/admin/agente")) return "agent.use";
  if (pathname.startsWith("/admin/tareas")) return "tasks.view";
  if (pathname.startsWith("/admin/automatizaciones")) return "automations.view";
  if (pathname.startsWith("/admin/productos")) return "products.view";
  if (pathname.startsWith("/admin/pedidos")) return "orders.view";
  if (pathname.startsWith("/admin/inventario")) return "inventory.view";
  if (pathname.startsWith("/admin/clientes")) return "customers.view";
  if (pathname.startsWith("/admin/devoluciones")) return "returns.view";
  if (pathname.startsWith("/admin/analitica")) return "analytics.view";
  if (pathname.startsWith("/admin/integraciones")) return "integrations.view";
  if (pathname.startsWith("/admin/auditoria")) return "settings.view";
  if (pathname.startsWith("/admin/configuracion")) return "settings.view";
  if (pathname === "/admin") return "dashboard.view";

  if (pathname.startsWith("/api/admin/activity")) return "dashboard.view";
  if (pathname.startsWith("/api/admin/audit")) return "settings.view";
  if (pathname.startsWith("/api/admin/notifications")) return "dashboard.view";
  if (pathname.startsWith("/api/admin/users")) return "users.manage";
  if (pathname.startsWith("/api/admin/invitations")) return "users.manage";
  if (pathname.startsWith("/api/admin/analytics")) return method === "GET" ? "analytics.view" : "analytics.export";
  if (pathname.startsWith("/api/admin/agent")) return "agent.use";
  if (pathname.startsWith("/api/admin/opportunities")) return method === "GET" ? "crm.view" : "crm.manage";
  if (pathname.startsWith("/api/admin/quotes")) return method === "GET" ? "crm.view" : "crm.manage";
  if (pathname.startsWith("/api/admin/customers")) return method === "GET" ? "customers.view" : "customers.manage";
  if (pathname.startsWith("/api/admin/crm/messages")) return method === "POST" ? "inbox.reply" : "inbox.view";
  if (pathname.startsWith("/api/admin/crm/leads")) return method === "GET" ? "inbox.view" : "crm.manage";
  if (pathname.startsWith("/api/admin/products")) return method === "GET" ? "products.view" : "products.manage";
  if (pathname.startsWith("/api/admin/orders")) return method === "GET" ? "orders.view" : "orders.manage";
  if (pathname.startsWith("/api/admin/settings")) return method === "GET" ? "settings.view" : "settings.manage";
  if (pathname.startsWith("/api/admin/skydropx")) return "orders.manage";
  if (pathname.startsWith("/api/admin/system")) return "integrations.view";
  if (pathname.startsWith("/api/admin/stats")) return "dashboard.view";
  if (pathname.startsWith("/api/admin/sales-users")) return "crm.view";
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminPage = pathname.startsWith("/admin") && !pathname.startsWith("/admin/login");
  const isAdminApi = pathname.startsWith("/api/admin");

  if (isAdminPage || isAdminApi) {
    const token = request.cookies.get(TOKEN_NAME)?.value;
    const payload = await validateAdminToken(token);
    if (!payload) return unauthorized(request, isAdminApi);

    const permission = requiredPermission(pathname, request.method);
    if (permission) {
      const role = String(payload.role || "SALES");
      const permissions = resolvePermissions(role, payload.permissions);
      if (role !== "ADMIN" && !permissions.includes(permission)) {
        return forbidden(request, isAdminApi, role, permissions);
      }
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
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
