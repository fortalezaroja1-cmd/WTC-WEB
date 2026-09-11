import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const users = await prisma.adminUser.findMany({
      where: {
        active: true,
        role: { in: ["ADMIN", "SALES"] },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(users);
  } catch (error) {
    console.error("Error cargando vendedores:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
