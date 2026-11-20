/**
 * Opiniones autorizadas para publicación en la tienda.
 *
 * Esta lista queda vacía hasta recibir las reseñas y la confirmación del
 * permiso para publicar cada comentario y el nombre que debe mostrarse.
 * No incluir teléfonos, correos, identificaciones ni datos internos.
 */
export interface CustomerReview {
  id: string;
  displayName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  publicationApproved: boolean;
  dateLabel?: string;
}

export const customerReviews: CustomerReview[] = [];
