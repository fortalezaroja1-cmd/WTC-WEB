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
