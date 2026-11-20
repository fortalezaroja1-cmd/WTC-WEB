"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquareQuote } from "lucide-react";
import { customerReviews } from "@/lib/customer-reviews";

const reviews = customerReviews.filter(review => review.publicationApproved && review.image && review.comment);

export function CustomerReviews() {
  const rail = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const move = (direction: number) => rail.current?.scrollBy({ left: direction * 350, behavior: "smooth" });
  if (!reviews.length) return null;
  return <section id="opiniones" aria-labelledby="customer-reviews-title" className="mx-auto max-w-[1180px] px-5 pt-14">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-copper"><MessageSquareQuote size={17} /> Opiniones de clientes</p>
        <h2 id="customer-reviews-title" className="mt-2 font-display text-3xl font-bold">Lo que dicen nuestros clientes</h2>
        <p className="mt-2 text-sm text-muted">Desliza para conocer sus experiencias. El recorrido se detiene al poner el cursor sobre una reseña.</p>
      </div>
      <div className="flex gap-2">
        <button type="button" aria-label="Ver reseñas anteriores" onClick={() => move(-1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-hair bg-white"><ChevronLeft /></button>
        <button type="button" aria-label="Ver más reseñas" onClick={() => move(1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-hair bg-white"><ChevronRight /></button>
      </div>
    </div>
    <div ref={rail} aria-label="Reseñas de clientes" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }} onTouchStart={() => setPaused(true)} className="overflow-x-auto rounded-2xl pb-3 [scrollbar-width:thin]" tabIndex={0}>
      <div className={`reviews-track flex w-max gap-4 ${paused ? "reviews-paused" : ""}`}>
        {[...reviews, ...reviews].map((review, index) => <article key={`${review.id}-${index}`} aria-hidden={index >= reviews.length} className="w-[min(83vw,350px)] shrink-0 overflow-hidden rounded-2xl border border-hair bg-white shadow-sm">
          <img src={review.image} alt={`${review.displayName}, ${review.rating} de 5 estrellas: «${review.comment}»`} loading="lazy" className="block h-auto w-full" />
        </article>)}
      </div>
    </div>
  </section>;
}
