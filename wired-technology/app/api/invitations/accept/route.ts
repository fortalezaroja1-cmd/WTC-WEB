import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
const digest=(token:string)=>createHash("sha256").update(token).digest("hex");

export async function GET(request: NextRequest) {
  const token=request.nextUrl.searchParams.get("token") || "";
  if (!token) return NextResponse.json({ error:"Invitación inválida" }, { status:400 });
  const invite=await prisma.adminInvite.findUnique({ where:{ tokenHash:digest(token) }});
  if (!invite || invite.revokedAt || invite.usedAt || invite.expiresAt <= new Date())
    return NextResponse.json({ error:"Esta invitación ya no es válida" }, { status:410 });
  return NextResponse.json({ name:invite.name,email:invite.email,role:invite.role,expiresAt:invite.expiresAt });
}

export async function POST(request: NextRequest) {
  const body=await request.json();
  const token=String(body?.token || "");
  const password=String(body?.password || "");
  if (password.length < 8) return NextResponse.json({ error:"La contraseña debe tener mínimo 8 caracteres" }, { status:400 });
  const tokenHash=digest(token);
  const invite=await prisma.adminInvite.findUnique({ where:{ tokenHash }});
  if (!invite || invite.revokedAt || invite.usedAt || invite.expiresAt <= new Date())
    return NextResponse.json({ error:"Esta invitación ya no es válida" }, { status:410 });
  const existing=await prisma.adminUser.findUnique({ where:{ email:invite.email }});
  if (existing) return NextResponse.json({ error:"Ya existe una cuenta con este correo" }, { status:409 });
  const passwordHash=await hash(password,12);
  await prisma.$transaction([
    prisma.adminUser.create({ data:{ name:invite.name,email:invite.email,passwordHash,role:invite.role,permissions:invite.permissions,active:true,mustChangePassword:false,passwordUpdatedAt:new Date() }}),
    prisma.adminInvite.update({ where:{ id:invite.id }, data:{ usedAt:new Date() }})
  ]);
  return NextResponse.json({ ok:true });
}
