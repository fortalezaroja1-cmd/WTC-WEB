import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";

export async function writeAudit(input: {
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  targetUserId?: string | null;
  meta?: unknown;
}) {
  try {
    await prisma.adminAuditLog.create({
      data: {
        id: randomUUID(),
        actorUserId: input.actorUserId || null,
        actorName: input.actorName || null,
        action: input.action,
        targetUserId: input.targetUserId || null,
        meta: input.meta == null ? undefined : (input.meta as any),
      },
    });
  } catch (error) {
    console.error("[AUDIT_LOG]", error);
  }
}
