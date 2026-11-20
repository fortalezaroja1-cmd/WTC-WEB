# Wired Technology — plan vivo de la tienda

- Cliente: Wired Technology.
- Dueña que aprueba: Sommer.
- Tienda pública: https://catalogo.wtgy.online
- Moneda: COP.
- Repositorio: `fortalezaroja1-cmd/WTC-WEB`, aplicación `wired-technology`.
- Fuentes de verdad: PostgreSQL/Supabase para catálogo y pedidos; Vercel para despliegues; GitHub para código.
- Regla de alcance: no mezclar la tienda con el CRM ni alterar datos de inventario durante pruebas.
- Regla de pagos: las pruebas de tarjeta son demostraciones sin cobro, sin datos bancarios reales y sin marcar pedidos como pagados.
- Regla de precios: el valor almacenado es el precio final con 30 % ya aplicado; el precio anterior se calcula como `actual / 0.70`.

## Estado actual — 2026-11-20

- Producción muestra 60 referencias, carrito persistente, productos relacionados, precios antes/ahora y espacio de reseñas autorizadas.
- El checkout publicado termina únicamente en WhatsApp y no ofrece aún un recorrido por pasos ni simulación integral de tarjeta.
- Existe integración administrativa con iion pay y webhook; no se usará para cobros durante las pruebas.
- La compilación local llega a recopilación de páginas, pero falla porque el cliente de Supabase se crea al importar sin variables de entorno. Se corregirá para fallar de forma controlada solo al intentar subir.
- El README incluía credenciales de ejemplo del administrador. Deben retirarse.

## Orden de ejecución

1. Checkout guiado mobile-first con carrito, entrega, pago, revisión y resultado.
2. Simulador de tarjeta aislado con escenarios aprobado, rechazado y pendiente/error.
3. Registro local de pruebas, sin eventos `Purchase` ni cambios a `paymentStatus`.
4. Validación de precios e inventario en servidor al crear una solicitud.
5. Correcciones de seguridad y compilación, pruebas y vista previa de Vercel.
6. Inventario de imágenes y fuentes verificables; no usar imágenes aproximadas.
7. Revisión final y producción solo después de validar la vista previa.

## Cambios aplicados

| Fecha | Cambio | Verificación | Estado |
|---|---|---|---|
| 2026-11-20 | Rama `work/tienda-guiada-pagos-demo` y respaldo previo | Git | En curso |
| 2026-11-20 | Checkout guiado de cuatro pasos y datos persistentes | TypeScript | Implementado en rama |
| 2026-11-20 | Simulador aislado: aprobado, rechazado y pendiente | Pruebas unitarias | Implementado en rama |
| 2026-11-20 | Solicitud demo sin escrituras en pedidos, CRM o notificaciones | Revisión de API | Implementado en rama |
| 2026-11-20 | Precio e inventario recalculados en servidor | TypeScript | Implementado en rama |
| 2026-11-20 | Inventario visual: 52/60 con imagen; 8 pendientes | Catálogo publicado | Auditada |
| 2026-11-20 | Actualizado jsPDF y retirado Mercado Pago sin uso | `npm audit` | Crítico eliminado; 6 avisos pendientes |

