import { NextRequest, NextResponse } from "next/server";
import { TOKEN_NAME } from "@/lib/auth";
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin)
    return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(TOKEN_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
