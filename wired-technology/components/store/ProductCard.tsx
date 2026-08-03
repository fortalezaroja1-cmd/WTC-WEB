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
    <Link href={`/productos/${slug}`}
      className="bg-card border border-hair rounded-xl overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="bg-gradient-to-br from-[#F6F1EB] to-[#EDE8E1] h-[140px] flex items-center justify-center relative">
        {image ? (
          <Image src={image} alt={name} fill className="object-contain p-4" sizes="(max-width:768px) 50vw, 25vw" />
        ) : (
          <Package size={56} strokeWidth={1.2} className="text-copper" />
        )}
        <span className="absolute top-2.5 left-2.5 font-mono text-[11px] bg-[#F0EDE8] text-slate-dark px-2 py-0.5 rounded-md font-medium">
          {brand}
        </span>
      </div>
      <div className="p-3.5 flex flex-col gap-1.5 flex-1">
        <div className="font-mono text-[10px] text-muted">{sku}</div>
        <div className="font-display font-semibold text-[14px] leading-snug">{name}</div>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <div className="font-mono text-[10px] text-muted">{hasVariants ? "desde" : `por ${unit}`}</div>
            <div className="font-display font-bold text-[17px]">{formatCOP(price)}</div>
          </div>
          {totalStock <= 0 ? (
            <span className="text-[11px] font-semibold bg-red-50 text-alert px-2 py-0.5 rounded-full">Agotado</span>
          ) : totalStock <= 5 ? (
            <span className="text-[11px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Últimas {totalStock}</span>
          ) : (
            <span className="text-[11px] font-semibold bg-green-50 text-green px-2 py-0.5 rounded-full">Disponible</span>
          )}
        </div>
      </div>
    </Link>
  );
}
