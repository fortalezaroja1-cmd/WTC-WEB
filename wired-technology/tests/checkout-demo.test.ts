import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_PAYMENT_OPTIONS } from "../lib/demo-payment";
import { getDiscountPricing } from "../lib/utils";

test("reconstruye el precio anterior desde un precio final con 30 % aplicado", () => {
  assert.deepEqual(getDiscountPricing(295_000), {
    current: 295_000,
    original: 421_429,
    savings: 126_429,
    discountPercent: 30,
  });
});

test("el simulador ofrece aprobado, rechazado y pendiente sin pedir una tarjeta real", () => {
  assert.deepEqual(DEMO_PAYMENT_OPTIONS.map(option => option.scenario), ["APPROVED", "REJECTED", "PENDING"]);
  for (const option of DEMO_PAYMENT_OPTIONS) {
    assert.match(option.label, /prueba/i);
    assert.match(option.last4, /^\d{4}$/);
  }
});

