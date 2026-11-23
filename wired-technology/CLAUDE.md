# Wired Technology — contexto operativo

- Tienda: catálogo público de Wired Technology.
- Moneda: COP.
- Pago principal: Iion Pay, siempre mediante cobro real y confirmación por webhook.
- Medios habilitados actualmente en la cuenta: PSE y transferencia bancaria.
- El código no debe limitar `allowedMethods`; la pasarela decide qué medios mostrar según la cuenta.
- Nunca exponer claves de Iion en cliente, código o repositorio.
- El precio, inventario y total se validan en el servidor antes de crear la orden.
- El envío debe formar parte del total antes de cobrar. Si no hay tarifa definida, se registra el pedido y se espera cotización.
- El checkout es móvil primero, usa una sola acción principal y conserva WhatsApp únicamente como ayuda.
- No usar testimonios, escasez, descuentos o condiciones que no estén respaldados por datos reales.

## Cambios aplicados

- 2026-11-23: Se reemplazó el headline genérico de inicio por una promesa orientada a resultado y se alinearon subtítulo y CTA con la intención de compra.
- 2026-11-23: La portada adapta el primer pantallazo para campañas de cables, iluminación o accesorios mediante `categoria`, `producto`, `utm_campaign` o `utm_content`.
- 2026-11-23: Se retiró del hero la afirmación general de distribución de marcas para evitar promesas no respaldadas.
