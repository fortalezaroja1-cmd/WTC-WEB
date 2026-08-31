"use client";

import Image from "next/image";
import { useState } from "react";
import { Package } from "lucide-react";

type GalleryImage = {
  url: string;
  alt?: string | null;
};

export function ProductGallery({ images, productName }: { images: GalleryImage[]; productName: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = images[activeIndex];

  return (
    <div>
      <div className="relative w-full aspect-square max-h-[610px] rounded-2xl border border-hair bg-white overflow-hidden flex items-center justify-center">
        {active ? (
          <Image
            src={active.url}
            alt={active.alt || productName}
            fill
            priority
            className="object-contain"
            sizes="(max-width:768px) 100vw, 50vw"
          />
        ) : (
          <Package size={150} strokeWidth={0.8} className="text-copper/70" />
        )}
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 mt-3">
          {images.map((image, index) => (
            <button
              type="button"
              key={`${image.url}-${index}`}
              onClick={() => setActiveIndex(index)}
              className={`relative aspect-square rounded-lg overflow-hidden bg-white border transition-all ${
                index === activeIndex ? "border-copper ring-2 ring-copper/20" : "border-hair hover:border-copper/60"
              }`}
              aria-label={`Ver imagen ${index + 1} de ${productName}`}
            >
              <Image
                src={image.url}
                alt={image.alt || `${productName} ${index + 1}`}
                fill
                className="object-contain"
                sizes="100px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
