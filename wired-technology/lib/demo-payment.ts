export type DemoPaymentScenario = "APPROVED" | "REJECTED" | "PENDING";

export type DemoPaymentRecord = {
  id: string;
  requestId: string;
  orderNumber: string;
  scenario: DemoPaymentScenario;
  status: DemoPaymentScenario;
  amount: number;
  createdAt: string;
  last4: string;
  label: string;
  simulation: true;
};

export const DEMO_PAYMENT_OPTIONS: Array<{
  scenario: DemoPaymentScenario;
  label: string;
  last4: string;
  description: string;
}> = [
  {
    scenario: "APPROVED",
    label: "Tarjeta de prueba aprobada",
    last4: "4242",
    description: "Muestra una autorización correcta sin efectuar ningún cobro.",
  },
  {
    scenario: "REJECTED",
    label: "Tarjeta de prueba rechazada",
    last4: "0002",
    description: "Permite comprobar el mensaje de rechazo y el reintento.",
  },
  {
    scenario: "PENDING",
    label: "Operación de prueba pendiente",
    last4: "0069",
    description: "Simula una demora o error temporal sin confirmar el pago.",
  },
];

export function saveDemoPayment(record: DemoPaymentRecord) {
  try {
    const existing = JSON.parse(localStorage.getItem("wt_demo_payments") || "[]");
    const records = Array.isArray(existing) ? existing : [];
    const next = [record, ...records.filter(item => item?.id !== record.id)].slice(0, 25);
    localStorage.setItem("wt_demo_payments", JSON.stringify(next));
  } catch {
    // El simulador sigue funcionando si el navegador bloquea el almacenamiento.
  }
}

