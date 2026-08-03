import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🔌 Sembrando base de datos Wired Technology...");

  // ─── Marcas ───────────────────────────────────────────
  const centelsa = await prisma.brand.upsert({
    where: { slug: "centelsa" },
    update: {},
    create: { name: "Centelsa", slug: "centelsa" },
  });
  const mercury = await prisma.brand.upsert({
    where: { slug: "mercury" },
    update: {},
    create: { name: "Mercury", slug: "mercury" },
  });

  // ─── Categorías y subcategorías ───────────────────────
  const cables = await prisma.category.upsert({
    where: { slug: "cables" },
    update: {},
    create: { name: "Cables y alambres Centelsa", slug: "cables", icon: "Cable", order: 1 },
  });
  const iluminacion = await prisma.category.upsert({
    where: { slug: "iluminacion" },
    update: {},
    create: { name: "Iluminación Mercury", slug: "iluminacion", icon: "Lightbulb", order: 2 },
  });
  const accesorios = await prisma.category.upsert({
    where: { slug: "accesorios" },
    update: {},
    create: { name: "Accesorios eléctricos Mercury", slug: "accesorios", icon: "Zap", order: 3 },
  });

  const subs: Record<string, { name: string; slug: string; categoryId: string }[]> = {
    cables: [
      { name: "Alambres THHN", slug: "alambres-thhn", categoryId: cables.id },
      { name: "Cables 7 hilos", slug: "cables-7-hilos", categoryId: cables.id },
      { name: "Dúplex", slug: "duplex", categoryId: cables.id },
      { name: "Desnudo", slug: "desnudo", categoryId: cables.id },
      { name: "Aluminio / ACSR", slug: "aluminio-acsr", categoryId: cables.id },
    ],
    iluminacion: [
      { name: "Paneles LED", slug: "paneles-led", categoryId: iluminacion.id },
      { name: "Bombillos", slug: "bombillos", categoryId: iluminacion.id },
      { name: "Plafones", slug: "plafones", categoryId: iluminacion.id },
    ],
    accesorios: [
      { name: "Tomacorrientes", slug: "tomacorrientes", categoryId: accesorios.id },
      { name: "Interruptores", slug: "interruptores", categoryId: accesorios.id },
      { name: "Breakers", slug: "breakers", categoryId: accesorios.id },
      { name: "Cajas", slug: "cajas", categoryId: accesorios.id },
      { name: "Tableros", slug: "tableros", categoryId: accesorios.id },
    ],
  };

  const subMap: Record<string, string> = {};
  for (const group of Object.values(subs)) {
    for (const s of group) {
      const sub = await prisma.subcategory.upsert({
        where: { slug: s.slug },
        update: {},
        create: s,
      });
      subMap[s.slug] = sub.id;
    }
  }

  // ─── Productos con variantes ──────────────────────────
  const products = [
    {
      name: "Alambre THHN Centelsa", sku: "WT-CBL-THHN", slug: "alambre-thhn-centelsa",
      description: "Alambre de cobre THHN 90°C para instalaciones residenciales y comerciales. Aislamiento PVC y cubierta nylon.",
      unit: "metro", featured: true, status: "PUBLISHED" as const,
      categoryId: cables.id, subcategoryId: subMap["alambres-thhn"], brandId: centelsa.id,
      specs: [["Material", "Cobre electrolítico"], ["Temperatura", "90 °C"], ["Tensión", "600 V"], ["Norma", "NTC 2050 / RETIE"]],
      variants: [
        { name: "Calibre #10", sku: "WT-CBL-THHN-10", price: 4200, stock: 320 },
        { name: "Calibre #12", sku: "WT-CBL-THHN-12", price: 2900, stock: 540 },
        { name: "Calibre #14", sku: "WT-CBL-THHN-14", price: 1950, stock: 3 },
      ],
    },
    {
      name: "Cable dúplex Centelsa", sku: "WT-CBL-DUP", slug: "cable-duplex-centelsa",
      description: "Cable dúplex de cobre para acometidas y circuitos ramales. Dos conductores aislados.",
      unit: "metro", featured: true, status: "PUBLISHED" as const,
      categoryId: cables.id, subcategoryId: subMap["duplex"], brandId: centelsa.id,
      specs: [["Material", "Cobre"], ["Conductores", "2"], ["Tensión", "600 V"]],
      variants: [
        { name: "2 x 12 AWG", sku: "WT-CBL-DUP-212", price: 6800, stock: 180 },
        { name: "2 x 14 AWG", sku: "WT-CBL-DUP-214", price: 5200, stock: 210 },
      ],
    },
    {
      name: "Cable 7 hilos Centelsa", sku: "WT-CBL-7H", slug: "cable-7-hilos-centelsa",
      description: "Cable de cobre de 7 hilos, alta flexibilidad para tableros y conexiones.",
      unit: "metro", featured: false, status: "PUBLISHED" as const,
      categoryId: cables.id, subcategoryId: subMap["cables-7-hilos"], brandId: centelsa.id,
      specs: [["Hilos", "7"], ["Material", "Cobre"], ["Tensión", "600 V"]],
      variants: [
        { name: "Calibre #8", sku: "WT-CBL-7H-8", price: 7900, stock: 90 },
        { name: "Calibre #10", sku: "WT-CBL-7H-10", price: 5400, stock: 120 },
      ],
    },
    {
      name: "Alambre desnudo de cobre", sku: "WT-CBL-DES", slug: "alambre-desnudo-cobre",
      description: "Conductor de cobre desnudo para puestas a tierra y sistemas de apantallamiento.",
      unit: "metro", featured: false, status: "PUBLISHED" as const,
      categoryId: cables.id, subcategoryId: subMap["desnudo"], brandId: centelsa.id,
      specs: [["Material", "Cobre desnudo"], ["Uso", "Puesta a tierra"]],
      price: 3600, stock: 260, variants: [],
    },
    {
      name: "Cable ACSR aluminio", sku: "WT-CBL-ACSR", slug: "cable-acsr-aluminio",
      description: "Cable de aluminio reforzado con acero (ACSR) para redes aéreas de distribución.",
      unit: "metro", featured: false, status: "PUBLISHED" as const,
      categoryId: cables.id, subcategoryId: subMap["aluminio-acsr"], brandId: centelsa.id,
      specs: [["Material", "Aluminio + acero"], ["Uso", "Redes aéreas"]],
      price: 4100, stock: 0, variants: [],
    },
    {
      name: "Panel LED Mercury", sku: "WT-LED-PNL", slug: "panel-led-mercury",
      description: "Panel LED de sobreponer/empotrar, luz blanca. Alta eficiencia y bajo consumo.",
      unit: "unidad", featured: true, status: "PUBLISHED" as const,
      categoryId: iluminacion.id, subcategoryId: subMap["paneles-led"], brandId: mercury.id,
      specs: [["Color", "6500 K"], ["Vida útil", "30.000 h"], ["Tensión", "100–240 V"]],
      variants: [
        { name: "18 W redondo", sku: "WT-LED-PNL-18", price: 18900, stock: 64 },
        { name: "24 W cuadrado", sku: "WT-LED-PNL-24", price: 24500, stock: 40 },
        { name: "36 W cuadrado", sku: "WT-LED-PNL-36", price: 33900, stock: 4 },
      ],
    },
    {
      name: "Bombillo LED Mercury", sku: "WT-LED-BOM", slug: "bombillo-led-mercury",
      description: "Bombillo LED tipo A60, rosca E27. Luz cálida o blanca.",
      unit: "unidad", featured: true, status: "PUBLISHED" as const,
      categoryId: iluminacion.id, subcategoryId: subMap["bombillos"], brandId: mercury.id,
      specs: [["Rosca", "E27"], ["Color", "3000 K / 6500 K"], ["Equivalencia", "≈ 60 W"]],
      variants: [
        { name: "9 W", sku: "WT-LED-BOM-9", price: 7900, stock: 200 },
        { name: "12 W", sku: "WT-LED-BOM-12", price: 9900, stock: 150 },
        { name: "15 W", sku: "WT-LED-BOM-15", price: 12900, stock: 80 },
      ],
    },
    {
      name: "Plafón LED Mercury", sku: "WT-LED-PLA", slug: "plafon-led-mercury",
      description: "Plafón LED de superficie para techos, acabado en aluminio.",
      unit: "unidad", featured: false, status: "PUBLISHED" as const,
      categoryId: iluminacion.id, subcategoryId: subMap["plafones"], brandId: mercury.id,
      specs: [["Potencia", "24 W"], ["Color", "6500 K"], ["Diámetro", "30 cm"]],
      price: 39900, stock: 22, variants: [],
    },
    {
      name: "Tomacorriente doble Mercury", sku: "WT-ACC-TOM", slug: "tomacorriente-doble-mercury",
      description: "Tomacorriente doble polo a tierra, línea residencial. Placa incluida.",
      unit: "unidad", featured: false, status: "PUBLISHED" as const,
      categoryId: accesorios.id, subcategoryId: subMap["tomacorrientes"], brandId: mercury.id,
      specs: [["Amperaje", "15 A"], ["Tensión", "125 V"], ["Polo a tierra", "Sí"]],
      price: 8500, stock: 140, variants: [],
    },
    {
      name: "Interruptor Mercury", sku: "WT-ACC-INT", slug: "interruptor-mercury",
      description: "Interruptor de pared línea residencial con placa.",
      unit: "unidad", featured: false, status: "PUBLISHED" as const,
      categoryId: accesorios.id, subcategoryId: subMap["interruptores"], brandId: mercury.id,
      specs: [["Amperaje", "10 A"], ["Tensión", "125 V"]],
      variants: [
        { name: "Sencillo", sku: "WT-ACC-INT-1", price: 6900, stock: 160 },
        { name: "Doble", sku: "WT-ACC-INT-2", price: 9900, stock: 110 },
      ],
    },
    {
      name: "Breaker enchufable Mercury", sku: "WT-ACC-BRK", slug: "breaker-enchufable-mercury",
      description: "Interruptor termomagnético enchufable, 1 polo. Curva C.",
      unit: "unidad", featured: true, status: "PUBLISHED" as const,
      categoryId: accesorios.id, subcategoryId: subMap["breakers"], brandId: mercury.id,
      specs: [["Polos", "1"], ["Curva", "C"], ["Tensión", "120 V"]],
      variants: [
        { name: "15 A", sku: "WT-ACC-BRK-15", price: 11900, stock: 90 },
        { name: "20 A", sku: "WT-ACC-BRK-20", price: 12900, stock: 75 },
        { name: "30 A", sku: "WT-ACC-BRK-30", price: 14900, stock: 2 },
        { name: "40 A", sku: "WT-ACC-BRK-40", price: 16900, stock: 0 },
      ],
    },
    {
      name: "Caja PVC Mercury", sku: "WT-ACC-CAJ", slug: "caja-pvc-mercury",
      description: "Caja de PVC para instalación empotrada de tomas e interruptores.",
      unit: "unidad", featured: false, status: "PUBLISHED" as const,
      categoryId: accesorios.id, subcategoryId: subMap["cajas"], brandId: mercury.id,
      specs: [["Material", "PVC"], ["Tipo", "Rectangular"]],
      price: 2200, stock: 300, variants: [],
    },
    {
      name: "Tablero de circuitos Mercury", sku: "WT-ACC-TAB", slug: "tablero-circuitos-mercury",
      description: "Tablero de distribución para breakers enchufables, puerta metálica.",
      unit: "unidad", featured: false, status: "PUBLISHED" as const,
      categoryId: accesorios.id, subcategoryId: subMap["tableros"], brandId: mercury.id,
      specs: [["Material", "Metálico"], ["Uso", "Distribución"]],
      variants: [
        { name: "4 circuitos", sku: "WT-ACC-TAB-4", price: 34900, stock: 30 },
        { name: "6 circuitos", sku: "WT-ACC-TAB-6", price: 45900, stock: 18 },
        { name: "8 circuitos", sku: "WT-ACC-TAB-8", price: 58900, stock: 9 },
      ],
    },
  ];

  for (const p of products) {
    const existing = await prisma.product.findUnique({ where: { sku: p.sku } });
    if (existing) continue;

    const { specs, variants, ...productData } = p;
    const created = await prisma.product.create({
      data: {
        ...productData,
        price: productData.price ?? null,
        stock: productData.stock ?? 0,
        specs: { create: specs.map(([key, value], i) => ({ key, value, order: i })) },
        variants: {
          create: variants.map((v, i) => ({ ...v, order: i })),
        },
      },
    });
    console.log(`  ✓ ${created.name}`);
  }

  // ─── Admin user ───────────────────────────────────────
  const adminExists = await prisma.adminUser.findUnique({ where: { email: "admin@wiredtech.co" } });
  if (!adminExists) {
    await prisma.adminUser.create({
      data: {
        email: "admin@wiredtech.co",
        passwordHash: await hash("admin123", 10),
        name: "Administrador",
        role: "ADMIN",
      },
    });
    console.log("  ✓ Usuario admin creado (admin@wiredtech.co / admin123)");
  }

  // ─── Settings iniciales ───────────────────────────────
  const defaults: Record<string, string> = {
    storeName: "Wired Technology",
    tagline: "Materiales eléctricos e iluminación",
    whatsapp: "573000000000",
    city: "Bogotá, Colombia",
    freeShipFrom: "250000",
    shippingCost: "12000",
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  console.log("✅ Seed completado.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
