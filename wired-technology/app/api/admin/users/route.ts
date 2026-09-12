import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hash } from "bcryptjs";
import { randomUUID } from "crypto";
import { ALL_PERMISSIONS, normalizeRole, resolvePermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function requireUserManager() {
  const session = await getSession();
  if (!session) return null;
  if (session.role === "ADMIN" || session.permissions?.includes("users.manage")) return session;
  return null;
}

function cleanPermissions(role: unknown, value: unknown) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "ADMIN") return [...ALL_PERMISSIONS];
  if (!Array.isArray(value)) return resolvePermissions(normalizedRole, []);
  const allowed = new Set(ALL_PERMISSIONS);
  return Array.from(new Set(value.map(String).filter((item) => allowed.has(item as any))));
}

async function audit(actor: any, action: string, targetUserId: string | null, meta: unknown) {
  await prisma.adminAuditLog.create({
    data: {
      id: randomUUID(),
      actorUserId: actor.userId,
      actorName: actor.name,
      action,
      targetUserId,
      meta: (meta ?? {}) as any,
    },
  });
}

export async function GET() {
  const session = await requireUserManager();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const users = await prisma.adminUser.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
      active: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
      failedAttempts: true,
      lockedUntil: true,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(users.map((user) => ({
    ...user,
    permissions: resolvePermissions(user.role, user.permissions),
  })), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const session = await requireUserManager();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await request.json();
  const name = String(body?.name || "").trim();
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  const role = normalizeRole(body?.role);
  const permissions = cleanPermissions(role, body?.permissions);

  if (name.length < 2) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener mínimo 8 caracteres" }, { status: 400 });

  const exists = await prisma.adminUser.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Ya existe un usuario con ese correo" }, { status: 409 });

  const passwordHash = await hash(password, 12);
  const user = await prisma.adminUser.create({
    data: {
      name,
      email,
      passwordHash,
      role,
      permissions,
      active: true,
      mustChangePassword: false,
      passwordUpdatedAt: new Date(),
    },
    select: { id: true, name: true, email: true, role: true, permissions: true, active: true, createdAt: true },
  });

  await audit(session, "USER_CREATED", user.id, { email, role, permissions });
  return NextResponse.json({ ...user, permissions: resolvePermissions(user.role, user.permissions) }, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const session = await requireUserManager();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = await request.json();
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Usuario requerido" }, { status: 400 });

  const current = await prisma.adminUser.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

  const nextRole = body?.role !== undefined ? normalizeRole(body.role) : current.role;
  const nextActive = body?.active !== undefined ? Boolean(body.active) : current.active;

  if (id === session.userId && !nextActive) {
    return NextResponse.json({ error: "No puedes desactivar tu propia cuenta" }, { status: 400 });
  }
  if (id === session.userId && nextRole !== "ADMIN" && current.role === "ADMIN") {
    return NextResponse.json({ error: "No puedes quitarte a ti mismo el rol administrador" }, { status: 400 });
  }

  if (current.role === "ADMIN" && (!nextActive || nextRole !== "ADMIN")) {
    const otherAdmins = await prisma.adminUser.count({
      where: { role: "ADMIN", active: true, id: { not: id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "Debe existir al menos un administrador activo" }, { status: 400 });
    }
  }

  const data: any = {};
  if (body?.name !== undefined) {
    const name = String(body.name || "").trim();
    if (name.length < 2) return NextResponse.json({ error: "Nombre inválido" }, { status: 400 });
    data.name = name;
  }
  if (body?.email !== undefined) {
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Correo inválido" }, { status: 400 });
    const duplicate = await prisma.adminUser.findFirst({ where: { email, id: { not: id } } });
    if (duplicate) return NextResponse.json({ error: "Ese correo ya está en uso" }, { status: 409 });
    data.email = email;
  }
  if (body?.role !== undefined) data.role = nextRole;
  if (body?.permissions !== undefined || body?.role !== undefined) {
    data.permissions = cleanPermissions(nextRole, body?.permissions ?? current.permissions);
  }
  if (body?.active !== undefined) data.active = nextActive;
  if (body?.unlock === true) {
    data.failedAttempts = 0;
    data.lockedUntil = null;
  }
  if (body?.password !== undefined && String(body.password).length > 0) {
    const password = String(body.password);
    if (password.length < 8) return NextResponse.json({ error: "La contraseña debe tener mínimo 8 caracteres" }, { status: 400 });
    data.passwordHash = await hash(password, 12);
    data.passwordUpdatedAt = new Date();
    data.failedAttempts = 0;
    data.lockedUntil = null;
  }

  const updated = await prisma.adminUser.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      permissions: true,
      active: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
      failedAttempts: true,
      lockedUntil: true,
    },
  });

  await audit(session, "USER_UPDATED", id, {
    fields: Object.keys(data).filter((key) => key !== "passwordHash"),
    role: updated.role,
    active: updated.active,
    permissions: resolvePermissions(updated.role, updated.permissions),
    passwordChanged: Boolean(data.passwordHash),
  });

  return NextResponse.json({ ...updated, permissions: resolvePermissions(updated.role, updated.permissions) });
}
