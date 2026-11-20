import { NextRequest, NextResponse } from "next/server";
import type { DemoPaymentScenario } from "@/lib/demo-payment";

const SCENARIOS = new Set<DemoPaymentScenario>(["APPROVED", "REJECTED", "PENDING"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const scenario = String(body.scenario || "") as DemoPaymentScenario;
    const requestId = String(body.requestId || "").trim().slice(0, 100);
    const orderNumber = String(body.orderNumber || "").trim().slice(0, 50);
    const amount = Math.round(Number(body.amount || 0));

    if (!SCENARIOS.has(scenario) || !requestId || !orderNumber || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Datos de simulación incompletos" }, { status: 400 });
    }

    // Esta ruta no llama proveedores, no recibe datos bancarios y no actualiza pedidos.
    const reference = `DEMO-${Date.now().toString(36).toUpperCase()}-${requestId.slice(-6).toUpperCase()}`;
    console.info("[DEMO_PAYMENT]", JSON.stringify({ reference, orderNumber, scenario, amount }));

    return NextResponse.json({
      reference,
      status: scenario,
      simulation: true,
      processedAt: new Date().toISOString(),
      message:
        scenario === "APPROVED"
          ? "Simulación aprobada. No se realizó ningún cobro."
          : scenario === "REJECTED"
            ? "Simulación rechazada. Puedes intentar otro escenario de prueba."
            : "Simulación pendiente. No se confirmó ningún pago.",
    });
  } catch {
    return NextResponse.json({ error: "No se pudo ejecutar la simulación" }, { status: 500 });
  }
}

