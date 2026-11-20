# Plan de finalización de la tienda

| Cambio | Hipótesis | Impacto esperado | Riesgo | Cómo se deshace | Estado |
|---|---|---|---|---|---|
| Checkout en pasos | Menos carga mental y errores en móvil | Alto | El flujo puede alargarse si los pasos no son claros | Restaurar respaldo de checkout | Implementado en rama |
| Pago con tarjeta de demostración | Permite validar la experiencia sin dinero real | Alto | Confusión con un cobro real | Etiquetas DEMO permanentes y eliminar el módulo | Implementado sin escrituras reales |
| Recalcular pedido en servidor | Evita manipulación de precios desde el navegador | Alto | Diferencias si el catálogo cambia mientras se compra | Mostrar error y pedir actualizar carrito | Implementado en rama |
| Paleta accesible azul/naranja/verde | Mejora jerarquía y confianza | Medio | Cambio visual demasiado amplio | Restaurar variables CSS | Implementado en rama |
| Inventario de imágenes | Reduce fichas engañosas o incompletas | Alto | Fuentes sin autorización | Mantener marcador neutro y lista pendiente | Pendiente |

## Pruebas previstas

- Escritorio y vistas móviles de 320, 375 y 430 px.
- Producto simple y con variante.
- Varios productos, cambios de cantidad, eliminación y persistencia.
- Descuento del 30 % en catálogo, carrito, revisión y mensaje.
- Entrega y recogida, campos incompletos y navegación atrás/adelante.
- Tarjeta de prueba aprobada, rechazada y pendiente/error.
- Reintento sin duplicar la solicitud.
- Confirmación sin evento de compra ni estado de pago aprobado.

## Contraste de la paleta

WCAG 2.2 AA exige al menos 4,5:1 para texto normal y 3:1 para texto grande. Cálculos sin redondear en los umbrales:

| Combinación | Relación |
|---|---:|
| Blanco sobre azul profundo `#12344D` | 12,93:1 |
| Blanco sobre naranja `#B7470B` | 5,36:1 |
| Blanco sobre verde `#0F766E` | 5,47:1 |
| Texto `#243746` sobre `#F7FAFC` | 11,72:1 |
| Texto secundario `#5B6872` sobre blanco | 5,73:1 |

Fuente: W3C, *Understanding Success Criterion 1.4.3: Contrast (Minimum)*.

## Dependencias

- Se actualizó `jspdf` a 4.2.1 para eliminar el aviso crítico.
- Se retiró `mercadopago`: no existían importaciones ni una integración activa en el código.
- Quedan 6 avisos (`Next.js`, `Prisma` y transitivos) que requieren actualizaciones mayores y una fase separada de compatibilidad; no deben forzarse dentro de este cambio.

