import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ALL_PERMISSIONS, normalizeRole, resolvePermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function manager() {
  const session = await getSession();
  if (!session) return null;
  return session.role === "ADMIN" || session.permissions?.includes("users.manage") ? session : null;
}

function permissions(role: unknown, value: unknown) {
  const r = normalizeRole(role);
  if (r === "ADMIN") return [...ALL_PERMISSIONS];
  if (!Array.isArray(value)) return resolvePermissions(r, []);
  const allowed = new Set<string>(ALL_PERMISSIONS);
  return Array.from(new Set(value.map(String).filter((x) => allowed.has(x))));
}

export async function GET() {
  const session = await manager();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const rows = await prisma.adminInvite.findMany({
    select: { id:true,email:true,name:true,role:true,permissions:true,expiresAt:true,usedAt:true,revokedAt:true,createdAt:true },
    orderBy: { createdAt: "desc" }, take: 50
  });
  return NextResponse.json(rows, { headers: { "Cache-Control":"no-store" }});
}

export async function POST(request: NextRequest) {
  const session = await manager();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const body = await request.json();
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const role = normalizeRole(body?.role);
  const selected = permissions(role, body?.permissions);
  if (name.length < 2) return NextResponse.json({ error:"Nombre requerido" }, { status:400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error:"Correo inválido" }, { status:400 });
  const existing = await prisma.adminUser.findUnique({ where:{ email }});
  if (existing) return NextResponse.json({ error:"Ese correo ya tiene una cuenta" }, { status:409 });

  await prisma.adminInvite.updateMany({ where:{ email, usedAt:null, revokedAt:null }, data:{ revokedAt:new Date() }});
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7*24*60*60*1000);
  const invite = await prisma.adminInvite.create({ data:{
    id:randomUUID(), email, name, role, permissions:selected, tokenHash,
    createdByUserId:session.userId, createdByName:session.name, expiresAt
  }});
  const url = new URL("/registro/invitacion", request.nextUrl.origin);
  url.searchParams.set("token", token);
  return NextResponse.json({ id:invite.id, inviteUrl:url.toString(), expiresAt }, { status:201 });
}

export async function DELETE(request: NextRequest) {
  const session = await manager();
  if (!session) return NextResponse.json({ error:"No autorizado" }, { status:403 });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error:"Invitación requerida" }, { status:400 });
  await prisma.adminInvite.update({ where:{ id }, data:{ revokedAt:new Date() }});
  return NextResponse.json({ ok:true });
}
