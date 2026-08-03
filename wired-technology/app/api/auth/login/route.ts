import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compare } from "bcryptjs";
import { signToken, TOKEN_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  const user = await prisma.adminUser.findUnique({ where: { email } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  // Verificar bloqueo
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    return NextResponse.json({ error: "Cuenta bloqueada. Intenta más tarde." }, { status: 423 });
  }

  const valid = await compare(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedAttempts + 1;
    const lockData = attempts >= 5 ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } : {};
    await prisma.adminUser.update({ where: { id: user.id }, data: { failedAttempts: attempts, ...lockData } });
    return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
  }

  // Login exitoso
  await prisma.adminUser.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, lastLogin: new Date() } });

  const token = signToken({ userId: user.id, email: user.email, role: user.role, name: user.name });

  const res = NextResponse.json({ ok: true, name: user.name, role: user.role });
  res.cookies.set(TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 86400,
  });
  return res;
}
