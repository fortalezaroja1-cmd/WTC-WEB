"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, LoaderCircle, Package, Search } from "lucide-react";
import { formatCOP } from "@/lib/utils";

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  sku: string;
  brand: string;
  category: string;
  description: string;
  image: string | null;
  price: number;
  hasVariants: boolean;
  unit: string;
  totalStock: number;
}

interface Props {
  products: CatalogProduct[];
  initialQuery?: string;
}

async function loadImageAsJpeg(url: string) {
  const optimizedUrl = `/_next/image?url=${encodeURIComponent(url)}&w=900&q=78`;
  const response = await fetch(optimizedUrl);
  if (!response.ok) throw new Error("No se pudo cargar la imagen");

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo procesar la imagen"));
      element.src = objectUrl;
    });

    const maxWidth = 900;
    const maxHeight = 700;
    const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la imagen");

    ctx.fillStyle = "#F3F4F6";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return {
      data: canvas.toDataURL("image/jpeg", 0.8),
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ProductCatalog({ products, initialQuery = "" }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      counts.set(product.category, (counts.get(product.category) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");

    return products.filter((product) => {
      const matchesCategory = activeCategory === "Todos" || product.category === activeCategory;
      if (!matchesCategory) return false;
      if (!needle) return true;

      const searchable = [
        product.name,
        product.sku,
        product.brand,
        product.category,
        product.description,
      ]
        .join(" ")
        .toLocaleLowerCase("es");

      return searchable.includes(needle);
    });
  }, [products, query, activeCategory]);

  const downloadCatalog = async () => {
    if (generating || products.length === 0) return;

    setGenerating(true);
    setProgress(0);

    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });

      const pageWidth = 210;
      const cardWidth = 91;
      const cardHeight = 121;
      const slots = [
        { x: 12, y: 27 },
        { x: 107, y: 27 },
        { x: 12, y: 157 },
        { x: 107, y: 157 },
      ];

      const drawPageFrame = (pageNumber: number) => {
        doc.setFillColor(20, 24, 31);
        doc.rect(0, 0, pageWidth, 20, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("WIRED TECHNOLOGY", 12, 12.5);
        doc.setTextColor(198, 123, 66);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text("CATALOGO DE PRODUCTOS", 198, 12.5, { align: "right" });

        doc.setTextColor(107, 116, 128);
        doc.setFontSize(7.5);
        doc.text(`Pagina ${pageNumber}`, 198, 291, { align: "right" });
      };

      drawPageFrame(1);

      for (let i = 0; i < products.length; i++) {
        if (i > 0 && i % 4 === 0) {
          doc.addPage();
          drawPageFrame(Math.floor(i / 4) + 1);
        }

        const product = products[i];
        const slot = slots[i % 4];
        const x = slot.x;
        const y = slot.y;

        doc.setDrawColor(228, 231, 235);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, "FD");

        doc.setFillColor(243, 244, 246);
        doc.roundedRect(x + 5, y + 6, cardWidth - 10, 65, 2, 2, "F");

        if (product.image) {
          try {
            const image = await loadImageAsJpeg(product.image);
            const boxWidth = cardWidth - 16;
            const boxHeight = 57;
            const ratio = Math.min(boxWidth / image.width, boxHeight / image.height);
            const drawWidth = image.width * ratio;
            const drawHeight = image.height * ratio;
            const imageX = x + (cardWidth - drawWidth) / 2;
            const imageY = y + 10 + (boxHeight - drawHeight) / 2;
            doc.addImage(image.data, "JPEG", imageX, imageY, drawWidth, drawHeight, undefined, "FAST");
          } catch {
            doc.setTextColor(107, 116, 128);
            doc.setFontSize(8);
            doc.text("Imagen no disponible", x + cardWidth / 2, y + 39, { align: "center" });
          }
        } else {
          doc.setTextColor(107, 116, 128);
          doc.setFontSize(8);
          doc.text("Sin imagen", x + cardWidth / 2, y + 39, { align: "center" });
        }

        doc.setFillColor(20, 24, 31);
        doc.roundedRect(x + 6, y + 75, 34, 7, 1.5, 1.5, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6.5);
        const categoryText = doc.splitTextToSize(product.category, 30)[0] || product.category;
        doc.text(categoryText, x + 9, y + 79.8);

        doc.setTextColor(22, 27, 34);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        const nameLines = doc.splitTextToSize(product.name, cardWidth - 12).slice(0, 2);
        doc.text(nameLines, x + 6, y + 89);

        const nameHeight = Math.max(1, nameLines.length) * 4.6;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 116, 128);
        doc.setFontSize(7.2);
        const description = product.description || `${product.brand} · ${product.sku}`;
        const descriptionLines = doc.splitTextToSize(description, cardWidth - 12).slice(0, 2);
        doc.text(descriptionLines, x + 6, y + 89 + nameHeight + 2.5);

        doc.setTextColor(198, 123, 66);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text(formatCOP(product.price), x + 6, y + cardHeight - 8);

        doc.setTextColor(107, 116, 128);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.text(product.hasVariants ? "Precio desde" : `Por ${product.unit}`, x + cardWidth - 6, y + cardHeight - 8, { align: "right" });

        setProgress(i + 1);
      }

      doc.save("Catalogo-Wired-Technology.pdf");
    } catch (error) {
      console.error("Error generando catalogo:", error);
      alert("No se pudo generar el catálogo. Intenta nuevamente.");
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  };

  return (
    <>
      <section className="bg-graphite text-white border-b border-slate-dark">
        <div className="max-w-[1380px] mx-auto px-5 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:justify-between mb-6">
            <div>
              <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-2">
                Catálogo Wired Technology
              </div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Productos</h1>
              <p className="text-sm text-muted mt-2">
                {products.length} productos disponibles para consultar.
              </p>
            </div>

            <button
              type="button"
              onClick={downloadCatalog}
              disabled={generating || products.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-copper px-5 py-3 font-semibold text-sm text-white hover:bg-copper-bright transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              {generating ? <LoaderCircle size={17} className="animate-spin" /> : <Download size={17} />}
              {generating ? `Generando ${progress}/${products.length}` : "Descargar catálogo"}
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar producto, calibre, referencia o marca..."
              className="w-full rounded-xl border border-slate-dark bg-graphite-2 pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-copper"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveCategory("Todos")}
              className={`shrink-0 rounded-full border px-4 py-2 font-mono text-xs transition-colors ${
                activeCategory === "Todos"
                  ? "border-copper bg-copper text-white"
                  : "border-slate-dark bg-graphite-2 text-muted hover:border-copper hover:text-white"
              }`}
            >
              Todos ({products.length})
            </button>

            {categoryCounts.map(([category, count]) => (
              <button
                type="button"
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`shrink-0 rounded-full border px-4 py-2 font-mono text-xs transition-colors ${
                  activeCategory === category
                    ? "border-copper bg-copper text-white"
                    : "border-slate-dark bg-graphite-2 text-muted hover:border-copper hover:text-white"
                }`}
              >
                {category} ({count})
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1380px] mx-auto px-5 py-8">
        <div className="flex items-center justify-between gap-4 mb-5">
          <p className="font-mono text-xs text-muted">
            Mostrando {filteredProducts.length} de {products.length} productos
          </p>
          {(query || activeCategory !== "Todos") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveCategory("Todos");
              }}
              className="font-mono text-xs text-copper font-semibold hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-hair bg-card py-20 text-center text-muted">
            No se encontraron productos con esos filtros.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProducts.map((product) => (
              <Link
                href={`/productos/${product.slug}`}
                key={product.id}
                className="group overflow-hidden rounded-2xl border border-hair bg-card shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                <div className="relative h-[300px] md:h-[330px] bg-gradient-to-br from-[#F8F5F0] to-[#ECE7DF] overflow-hidden">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      className="object-contain p-5 md:p-6 group-hover:scale-[1.03] transition-transform duration-300"
                      sizes="(max-width:640px) 100vw, (max-width:1280px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Package size={88} strokeWidth={0.8} className="text-copper/60" />
                    </div>
                  )}

                  <span className="absolute left-4 top-4 rounded-md bg-graphite/90 px-2.5 py-1 font-mono text-[10px] text-white">
                    {product.category}
                  </span>
                  <span className="absolute right-4 top-4 rounded-md border border-white/70 bg-white/90 px-2.5 py-1 font-mono text-[10px] text-slate-dark">
                    {product.brand}
                  </span>
                </div>

                <div className="p-5 min-h-[190px] flex flex-col">
                  <div className="font-mono text-[10px] text-muted mb-2">{product.sku}</div>
                  <h2 className="font-display text-lg font-semibold leading-snug text-ink">{product.name}</h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted line-clamp-2">
                    {product.description || `${product.brand} · ${product.unit}`}
                  </p>

                  <div className="mt-auto pt-5 flex items-end justify-between gap-4">
                    <div>
                      <div className="font-mono text-[10px] text-muted mb-1">
                        {product.hasVariants ? "desde" : `por ${product.unit}`}
                      </div>
                      <div className="font-display text-2xl font-bold text-copper">{formatCOP(product.price)}</div>
                    </div>

                    {product.totalStock <= 0 ? (
                      <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-alert">Agotado</span>
                    ) : product.totalStock <= 5 ? (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Últimas {product.totalStock}</span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green">Disponible</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
