"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, LoaderCircle, Package, Plus, Search, SlidersHorizontal, ShoppingCart } from "lucide-react";
import { formatCOP } from "@/lib/utils";
import { useCart } from "@/components/store/CartProvider";
import { trackMetaEvent } from "@/lib/meta-events";

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
  const proxyUrl = `/api/catalog-image?url=${encodeURIComponent(url)}`;
  const optimizedUrl = `/_next/image?url=${encodeURIComponent(url)}&w=900&q=78`;
  let response = await fetch(proxyUrl, { cache: "no-store" });
  if (!response.ok) response = await fetch(optimizedUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo cargar la imagen (${response.status})`);

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("El archivo recibido no es una imagen");
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
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return { data: canvas.toDataURL("image/jpeg", 0.84), width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ProductCatalog({ products, initialQuery = "" }: Props) {
  const { addItem } = useCart();
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) counts.set(product.category, (counts.get(product.category) || 0) + 1);
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [products]);

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return products.filter((product) => {
      if (activeCategory !== "Todos" && product.category !== activeCategory) return false;
      if (!needle) return true;
      return [product.name, product.sku, product.brand, product.category, product.description]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(needle);
    });
  }, [products, query, activeCategory]);

  const quickAdd = (product: CatalogProduct) => {
    if (product.totalStock <= 0 || product.hasVariants) return;
    addItem({
      productId: product.id,
      variantId: null,
      name: product.name,
      sku: product.sku,
      price: product.price,
      qty: 1,
      image: product.image,
      slug: product.slug,
    });
    trackMetaEvent("AddToCart", {
      content_ids: [product.sku],
      content_type: "product",
      content_name: product.name,
      value: product.price,
      currency: "COP",
      num_items: 1,
    });
  };

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
        { x: 12, y: 27 }, { x: 107, y: 27 }, { x: 12, y: 157 }, { x: 107, y: 157 },
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
        const { x, y } = slots[i % 4];
        doc.setDrawColor(228, 231, 235);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, cardWidth, cardHeight, 2.5, 2.5, "FD");
        doc.roundedRect(x + 3, y + 4, cardWidth - 6, 68, 2, 2, "F");

        if (product.image) {
          try {
            const image = await loadImageAsJpeg(product.image);
            const boxWidth = cardWidth - 8;
            const boxHeight = 64;
            const ratio = Math.min(boxWidth / image.width, boxHeight / image.height);
            const drawWidth = image.width * ratio;
            const drawHeight = image.height * ratio;
            doc.addImage(image.data, "JPEG", x + (cardWidth - drawWidth) / 2, y + 6 + (boxHeight - drawHeight) / 2, drawWidth, drawHeight, undefined, "FAST");
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
        doc.text(doc.splitTextToSize(product.category, 30)[0] || product.category, x + 9, y + 79.8);
        doc.setTextColor(22, 27, 34);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        const nameLines = doc.splitTextToSize(product.name, cardWidth - 12).slice(0, 2);
        doc.text(nameLines, x + 6, y + 89);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 116, 128);
        doc.setFontSize(7.2);
        const description = product.description || `${product.brand} · ${product.sku}`;
        doc.text(doc.splitTextToSize(description, cardWidth - 12).slice(0, 2), x + 6, y + 89 + Math.max(1, nameLines.length) * 4.6 + 2.5);
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
        <div className="max-w-[1380px] mx-auto px-4 sm:px-5 py-5 sm:py-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:justify-between mb-5">
            <div>
              <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-2">Catálogo Wired Technology</div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">Productos</h1>
              <p className="text-base text-white/80 mt-2">Busca, elige y agrega los productos que necesitas. Hay {products.length} referencias en el catálogo.</p>
            </div>
            <button type="button" onClick={downloadCatalog} disabled={generating || products.length === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-copper px-5 py-3 font-semibold text-sm text-white hover:bg-copper-bright transition-colors disabled:opacity-60 disabled:cursor-wait">
              {generating ? <LoaderCircle size={17} className="animate-spin" /> : <Download size={17} />}
              {generating ? `Generando ${progress}/${products.length}` : "Descargar catálogo"}
            </button>
          </div>

          <div className="relative mb-4">
            <Search size={19} className="absolute left-4 top-1/2 -translate-y-1/2 text-graphite" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto, calibre, referencia o marca..." aria-label="Buscar por producto, calibre, referencia o marca" type="search" className="w-full rounded-xl border border-slate-dark bg-white pl-12 pr-4 min-h-14 text-base text-ink placeholder:text-muted focus:outline-none focus:border-copper" />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button type="button" onClick={() => setActiveCategory("Todos")} className={`shrink-0 min-h-12 rounded-full border px-4 py-2 font-semibold text-sm transition-colors ${activeCategory === "Todos" ? "border-copper bg-copper text-white" : "border-slate-dark bg-graphite-2 text-muted hover:border-copper hover:text-white"}`}>Todos ({products.length})</button>
            {categoryCounts.map(([category, count]) => (
              <button type="button" key={category} onClick={() => setActiveCategory(category)} className={`shrink-0 min-h-12 rounded-full border px-4 py-2 font-semibold text-sm transition-colors ${activeCategory === category ? "border-copper bg-copper text-white" : "border-slate-dark bg-graphite-2 text-muted hover:border-copper hover:text-white"}`}>{category} ({count})</button>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1380px] mx-auto px-4 sm:px-5 py-6">
        <div className="flex items-center justify-between gap-4 mb-5">
          <p className="font-mono text-xs text-muted">Mostrando {filteredProducts.length} de {products.length} productos</p>
          {(query || activeCategory !== "Todos") && <button type="button" onClick={() => { setQuery(""); setActiveCategory("Todos"); }} className="font-mono text-xs text-copper font-semibold hover:underline">Limpiar filtros</button>}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-hair bg-card py-16 px-4 text-center text-base text-muted">No encontramos productos con esa búsqueda. Intenta escribir un nombre más corto o una referencia.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredProducts.map((product) => (
              <article key={product.id} className="group overflow-hidden rounded-2xl border border-hair bg-card shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <Link href={`/productos/${product.slug}`} className="block">
                  <div className="relative h-[220px] sm:h-[280px] lg:h-[330px] bg-white border-b border-hair overflow-hidden">
                    {product.image ? (
                      <Image src={product.image} alt={product.name} fill className="object-contain group-hover:scale-[1.02] transition-transform duration-300" sizes="(max-width:640px) 100vw, (max-width:1280px) 50vw, 33vw" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#F8F5F0]"><Package size={88} strokeWidth={0.8} className="text-copper/60" /></div>
                    )}
                    <span className="absolute left-4 top-4 rounded-md bg-graphite/90 px-2.5 py-1 font-mono text-[10px] text-white shadow-sm">{product.category}</span>
                    <span className="absolute right-4 top-4 rounded-md border border-hair bg-white/95 px-2.5 py-1 font-mono text-[10px] text-slate-dark shadow-sm">{product.brand}</span>
                  </div>

                  <div className="px-5 pt-5">
                    <div className="text-xs text-muted mb-2">Referencia: {product.sku}</div>
                    <h2 className="font-display text-lg font-semibold leading-snug text-ink">{product.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-muted line-clamp-2">{product.description || `${product.brand} · ${product.unit}`}</p>
                  </div>
                </Link>

                <div className="px-5 pb-5 pt-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <div className="text-xs text-muted mb-1">{product.hasVariants ? "Precio desde" : `Precio por ${product.unit}`}</div>
                      <div className="font-display text-2xl font-bold text-copper">{formatCOP(product.price)}</div>
                    </div>
                    <span className={`text-sm font-semibold ${product.totalStock <= 0 ? "text-alert" : "text-green"}`}>
                      {product.totalStock <= 0 ? "Agotado" : "Disponible"}
                    </span>
                  </div>
                  {product.totalStock <= 0 ? (
                    <Link href={`/productos/${product.slug}`} className="w-full min-h-12 rounded-xl border border-hair font-semibold text-sm flex items-center justify-center">Ver detalles</Link>
                  ) : product.hasVariants ? (
                    <Link href={`/productos/${product.slug}`} className="w-full min-h-14 rounded-xl bg-copper text-white font-bold text-base flex items-center justify-center gap-2">
                      <SlidersHorizontal size={19} aria-hidden="true" /> Elegir opción
                    </Link>
                  ) : (
                    <button type="button" onClick={() => quickAdd(product)} className="w-full min-h-14 rounded-xl bg-copper text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                      <ShoppingCart size={20} aria-hidden="true" /> Agregar al carrito
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
