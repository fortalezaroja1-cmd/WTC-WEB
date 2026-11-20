import { MessageSquareQuote, Star } from "lucide-react";
import { customerReviews } from "@/lib/customer-reviews";

const reviews = customerReviews.filter(
  (review) =>
    review.publicationApproved &&
    review.rating >= 1 &&
    review.rating <= 5 &&
    review.displayName.trim().length > 0 &&
    review.comment.trim().length > 0,
);

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`Calificación: ${rating} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          size={19}
          aria-hidden="true"
          className={index < rating ? "fill-amber-400 text-amber-500" : "text-slate-300"}
        />
      ))}
    </div>
  );
}

export function CustomerReviews() {
  return (
    <section id="opiniones" aria-labelledby="customer-reviews-title" className="mx-auto max-w-[1180px] px-5 pt-14">
      <div className="mb-6">
        <div className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[.16em] text-copper">
          <MessageSquareQuote size={17} aria-hidden="true" /> Opiniones de clientes
        </div>
        <h2 id="customer-reviews-title" className="mt-2 font-display text-3xl font-bold tracking-tight">
          Lo que dicen nuestros clientes
        </h2>
        <p className="mt-2 max-w-[670px] text-sm leading-relaxed text-muted">
          Este espacio reúne comentarios y calificaciones de personas que han compartido su experiencia con Wired Technology.
        </p>
      </div>

      {reviews.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reviews.map((review) => (
            <article key={review.id} className="flex h-full flex-col rounded-2xl border border-hair bg-white p-5 shadow-sm">
              <RatingStars rating={review.rating} />
              <blockquote className="mt-4 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-dark">
                “{review.comment}”
              </blockquote>
              <div className="mt-5 border-t border-hair pt-3">
                <p className="text-sm font-bold text-ink">{review.displayName}</p>
                {review.dateLabel && <p className="mt-1 text-xs text-muted">{review.dateLabel}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-hair bg-card px-5 py-9 text-center sm:px-9">
          <MessageSquareQuote size={30} className="mx-auto text-copper" aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">Espacio reservado para las opiniones de nuestros clientes</p>
          <p className="mx-auto mt-2 max-w-[480px] text-sm leading-relaxed text-muted">
            Próximamente compartiremos aquí los comentarios y las calificaciones que cuenten con autorización para publicarse.
          </p>
        </div>
      )}
    </section>
  );
}
