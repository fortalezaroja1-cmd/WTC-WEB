import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { formatCOP } from "@/lib/utils";

interface Props {
  slug: string;
  name: string;
  sku: string;
  brand: string;
  image: string | null;
  price: number;
  hasVariants: boolean;
  unit: string;
  totalStock: number;
}

export function ProductCard({ slug, name, sku, brand, image, price, hasVariants, unit, totalStock }: Props) {
  return (
    <Link
      href={`/productos/${slug}`}
      className="group overflow-hidden rounded-2xl border border-hair bg-card shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="relative h-[205px] sm:h-[260px] lg:h-[310px] bg-white border-b border-hair overflow-hidden">
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            className="object-contain group-hover:scale-[1.02] transition-transform duration-300"
            sizes="(max-width:640px) 100vw, (max-width:1280px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[#F8F5F0]">
            <Package size={88} strokeWidth={0.8} className="text-copper/60" />
          </div>
        )}
        <span className="absolute right-4 top-4 rounded-md border border-hair bg-white/95 px-2.5 py-1 font-mono text-[10px] text-slate-dark shadow-sm">
          {brand}
        </span>
      </div>

      <div className="p-4 sm:p-5 flex flex-col min-h-[200px]">
        <div className="text-xs text-muted mb-2">Referencia: {sku}</div>
        <h2 className="font-display text-lg sm:text-xl font-semibold leading-snug text-ink">{name}</h2>

        <div className="mt-auto pt-4 flex items-end justify-between gap-2 flex-wrap">
          <div>
            <div className="text-xs text-muted mb-1">{hasVariants ? "desde" : `por ${unit}`}</div>
            <div className="font-display text-xl sm:text-2xl font-bold text-copper">{formatCOP(price)}</div>
          </div>
          {totalStock <= 0 ? (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-alert">Agotado</span>
          ) : totalStock <= 5 ? (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">Últimas {totalStock}</span>
          ) : (
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-semibold text-green">Disponible</span>
          )}
        </div>
        <div className="mt-4 min-h-12 w-full rounded-xl flex items-center justify-center font-bold text-base bg-copper text-white group-hover:bg-copper-bright transition-colors">
          {totalStock <= 0 ? "Ver detalles" : "Ver producto y comprar"} <span aria-hidden="true" className="ml-2">→</span>
        </div>
      </div>
    </Link>
  );
}
