import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VERIFY_TOKEN =
  process.env.META_WEBHOOK_VERIFY_TOKEN || "wired_sales_meta_verify_2026";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json(
    { ok: false, error: "Webhook verification failed" },
    { status: 403 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log("[META_WEBHOOK] Event received", JSON.stringify(body));

    return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
  } catch (error) {
    console.error("[META_WEBHOOK] Invalid payload", error);

    return NextResponse.json(
      { status: "INVALID_PAYLOAD" },
      { status: 400 }
    );
  }
}
