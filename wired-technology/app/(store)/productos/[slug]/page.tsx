import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AddToCart } from "@/components/store/AddToCart";
import { ProductGallery } from "@/components/store/ProductGallery";

export default async function ProductoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      brand: true,
      category: true,
      subcategory: true,
      variants: { orderBy: { order: "asc" } },
      images: { orderBy: { order: "asc" } },
      specs: { orderBy: { order: "asc" } },
    },
  });

  if (!product || product.status !== "PUBLISHED") notFound();

  const settings = await prisma.siteSetting.findMany();
  const cfg: Record<string, string> = {};
  settings.forEach((s) => (cfg[s.key] = s.value));
  const whatsapp = cfg.whatsapp || "573000000000";

  const mainImage = product.images[0]?.url || null;

  return (
    <div className="max-w-[1240px] mx-auto px-5 py-7">
      <Link href={`/categorias/${product.category.slug}`}
        className="font-mono text-xs text-copper font-semibold inline-flex items-center gap-1 mb-4 hover:underline">
        <ArrowLeft size={13} /> {product.category.name}
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-[1.08fr_.92fr] gap-10 lg:gap-14 items-start">
        <ProductGallery
          productName={product.name}
          images={product.images.map((image) => ({ url: image.url, alt: image.alt }))}
        />

        <div className="md:sticky md:top-24">
          <span className="font-mono text-[11px] bg-[#F0EDE8] text-slate-dark px-2 py-0.5 rounded-md font-medium">
            {product.brand.name}
          </span>
          <div className="font-mono text-xs text-muted mt-3 mb-1.5">{product.sku}</div>
          <h1 className="font-display text-[30px] md:text-[34px] font-bold leading-tight mb-3">{product.name}</h1>
          <p className="text-[14.5px] leading-relaxed text-slate-dark mb-5">{product.description}</p>

          <AddToCart
            productId={product.id}
            productName={product.name}
            productSku={product.sku}
            productSlug={product.slug}
            productUnit={product.unit}
            productImage={mainImage}
            price={product.variants.length === 0 ? Number(product.price) || 0 : undefined}
            stock={product.variants.length === 0 ? product.stock : undefined}
            variants={product.variants.length > 0 ? product.variants.map((v) => ({
              id: v.id, name: v.name, sku: v.sku, price: Number(v.price), stock: v.stock, image: v.image,
            })) : undefined}
            whatsapp={whatsapp}
          />

          {product.specs.length > 0 && (
            <div className="mt-8">
              <div className="font-mono text-[11px] tracking-[.16em] uppercase text-copper font-semibold mb-2.5">
                Especificaciones técnicas
              </div>
              <table className="w-full text-sm border border-hair rounded-lg overflow-hidden">
                <tbody>
                  {product.specs.map((s) => (
                    <tr key={s.id} className="border-b border-hair last:border-0">
                      <td className="font-mono text-xs text-muted py-2.5 px-3 w-[150px]">{s.key}</td>
                      <td className="py-2.5 px-3 font-medium">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
