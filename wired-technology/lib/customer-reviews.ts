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
  rating: number;
  comment: string;
  publicationApproved: boolean;
  image: string;
  dateLabel?: string;
}

export const customerReviews: CustomerReview[] = [
  { id: "andres", displayName: "Andrés T.", rating: 4.5, comment: "Pedí 3 rollos y 3 rollos me llegaron, en el color y el número que necesitaba", image: "/reviews/review-000.jpg", publicationApproved: true },
  { id: "lisseth", displayName: "Lisseth P.", rating: 4.5, comment: "Volvería a comprar. Todo me llegó a tiempo", image: "/reviews/review-001.jpg", publicationApproved: true },
  { id: "valery", displayName: "Valery H.", rating: 4, comment: "Encontré todo lo que necesitaba para mi casa, una sola compra, en un solo lugar", image: "/reviews/review-002.jpg", publicationApproved: true },
  { id: "esteban", displayName: "Esteban M.", rating: 4, comment: "Buen producto, he comprado dos veces en la página y muy bien", image: "/reviews/review-003.jpg", publicationApproved: true },
  { id: "leonela", displayName: "Leonela C.", rating: 5, comment: "Me enviaron un video antes de enviar mi mercancía, excelente", image: "/reviews/review-004.jpg", publicationApproved: true },
  { id: "duvan", displayName: "Duvan Lozano", rating: 4, comment: "Todo es tal cual la foto de la página, no se demora en llegar", image: "/reviews/review-005.jpg", publicationApproved: true },
  { id: "carolina", displayName: "Carolina G.", rating: 5, comment: "Excelente calidad, es 100% confiable, me llegó todo muy bien", image: "/reviews/review-006.jpg", publicationApproved: true },
  { id: "leider", displayName: "Leider G.", rating: 5, comment: "La página muy práctica y logré hacer mi pedido", image: "/reviews/review-007.jpg", publicationApproved: true },
];
