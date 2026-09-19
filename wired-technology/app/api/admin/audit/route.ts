import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = String(req.nextUrl.searchParams.get("q") || "").trim();
  const take = Math.min(500, Math.max(20, Number(req.nextUrl.searchParams.get("take") || 200)));
  const rows = await prisma.adminAuditLog.findMany({
    where: q ? {
      OR: [
        { action: { contains: q, mode: "insensitive" } },
        { actorName: { contains: q, mode: "insensitive" } },
      ],
    } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });
  return NextResponse.json(rows, { headers: { "Cache-Control": "no-store" } });
}
