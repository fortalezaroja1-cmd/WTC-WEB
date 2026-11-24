import test from "node:test";
import assert from "node:assert/strict";
import {
  applyStoreBalances,
  finishInTrefi,
  orderInTrefi,
  reserveInTrefi,
} from "../lib/trefi-stock";

test("La tienda utiliza los saldos de Trefi y bloquea las referencias pendientes o sin conexión", async () => {
  const original = globalThis.fetch;
  const previous = [
    process.env.TREFI_STOCK_MODE,
    process.env.TREFI_INVENTORY_URL,
    process.env.TREFI_INVENTORY_TOKEN,
  ];
  try {
    process.env.TREFI_STOCK_MODE = "central";
    process.env.TREFI_INVENTORY_URL = "https://trefi.test/inventory";
    process.env.TREFI_INVENTORY_TOKEN = "testtoken";
    const products = [
      { id: "simple", stock: 80, variants: [] },
      {
        id: "parent",
        stock: 98,
        variants: [
          { id: "azul", stock: 70 },
          { id: "rojo", stock: 30 },
        ],
      },
    ];
    const events: string[] = [];
    globalThis.fetch = async (_url, init) => {
      assert.equal(init?.cache, "no-store");
      const query = JSON.parse(String(init?.body));
      events.push(query.action);
      if (query.action === "stock")
        return Response.json({
          available: { "p:simple": 0, "v:azul": 1, "v:rojo": null },
        });
      assert.equal(query.order, "WT-TEST");
      if (query.action === "reserve") {
        assert.deepEqual(query.lines, [{ id: "v:azul", quantity: 1 }]);
        return Response.json({ state: "reserved" });
      }
      if (query.action === "status")
        return Response.json({
          order: { state: "reserved", lines: [{ id: "v:azul", quantity: 1 }] },
        });
      return Response.json({ state: "dispatched" });
    };
    assert.equal(await applyStoreBalances(products), "pending");
    assert.equal(products[0].stock, 0);
    assert.deepEqual(
      products[1].variants.map((x) => x.stock),
      [1, 0],
    );
    await reserveInTrefi("WT-TEST", [
      { productId: "parent", variantId: "azul", qty: 1 },
    ]);
    assert.equal((await orderInTrefi("WT-TEST"))?.state, "reserved");
    await finishInTrefi("WT-TEST", "dispatch");
    assert.deepEqual(events, ["stock", "reserve", "status", "dispatch"]);
    globalThis.fetch = async () => {
      throw Error("offline");
    };
    assert.equal(await applyStoreBalances(products), "offline");
    assert.deepEqual(
      products[1].variants.map((x) => x.stock),
      [0, 0],
    );
    await assert.rejects(
      applyStoreBalances(products, true),
      /No se pudo verificar/,
    );
    delete process.env.TREFI_STOCK_MODE;
    products[0].stock = 9;
    assert.equal(await applyStoreBalances(products), "ready");
    assert.equal(products[0].stock, 9);
  } finally {
    globalThis.fetch = original;
    [
      "TREFI_STOCK_MODE",
      "TREFI_INVENTORY_URL",
      "TREFI_INVENTORY_TOKEN",
    ].forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    });
  }
});
