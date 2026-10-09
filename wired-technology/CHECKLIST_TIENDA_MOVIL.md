# Wired Technology — Checklist de tienda móvil y venta asistida
Actualizado: 2026-10-09
Proyecto: wired-technology (NO modificar wired-crm)
URL: https://catalogo.wtgy.online/

## Convención
- [x] Cambios implementados en código (siempre verificar el despliegue y probar antes de cerrar la fase).
- [ ] Pendiente de implementar o validar.
- No confundir "pedido solicitado por WhatsApp" con "pedido confirmado por Wired".

## 1. Diseño para celulares y facilidad de uso
- [x] Búsqueda visible desde celulares en el encabezado.
- [x] Botones de menú y carrito con mayor zona táctil.
- [x] Portada con mensaje de compra más sencillo y acciones principales grandes.
- [x] Tarjetas de productos con textos legibles y botón "Ver producto y comprar".
- [ ] Auditar tamaños de letra y contraste en todas las pantallas.
- [ ] Probar navegación en pantallas de 320, 375 y 430 px, Android e iPhone.
- [ ] Corregir elementos que se superpongan con Paula o el carrito.
- [ ] Hacer pruebas reales con clientes mayores y con poca experiencia digital.

## 2. Catálogo y productos
- [x] Tarjetas destacadas adaptadas a lectura móvil.
- [x] Ficha de producto: acciones de compra y cantidad con botones grandes.
- [ ] Comprobar buscador por referencia, nombre, marca y términos cotidianos.
- [ ] Revisar variantes, unidades, fotos, precios y estados de inventario.
- [ ] Asegurar mensajes comprensibles en productos agotados.
- [ ] Probar un producto con y sin variantes.

## 3. Carrito
- [x] Confirmación de producto añadido sin abrir automáticamente el carrito.
- [x] Acciones para continuar comprando y consultar el pedido.
- [x] Carrito accesible en móvil, con cantidades editables y botón de quitar.
- [x] Un solo paso siguiente: "Armar mi pedido".
- [ ] Confirmar que el carrito se conserva al cambiar de página y al recargar.
- [ ] Probar productos repetidos, múltiples variantes y cambios de cantidades.
- [ ] Revisar comportamiento del carrito vacío y posible inventario desactualizado.

## 4. Pedidos y WhatsApp
- [x] Constructor con plantillas de pedido, cotización, pedido programado y asesoría.
- [x] Opción de mensaje editado manualmente.
- [x] Fecha solicitada (siempre sujeta a confirmación).
- [x] Vista previa con productos, cantidades y subtotal.
- [x] Salida final a WhatsApp de ventas.
- [ ] Simplificar el formulario en móvil (pedir datos por etapas y solo los indispensables).
- [ ] Añadir identificador de solicitud y registro persistente del pedido, para seguimiento administrativo.
- [ ] Probar apertura de WhatsApp en Android, iOS y ordenador.
- [ ] Comprobar que no se pierdan productos si WhatsApp no abre o el cliente regresa.
- [ ] No marcar automáticamente como confirmado lo que solo se envió por WhatsApp.

## 5. Paula
- [x] Botón flotante con rostro femenino y punto verde visual.
- [x] Chat existente conservado, ayuda opcional y acceso a pedidos.
- [ ] Evitar que Paula tape los botones de compra en pantallas pequeñas.
- [ ] Conectar respuestas a inventario y fichas reales; no inventar referencias.
- [ ] Ofrecer respuestas rápidas por botones y vocabulario simple.
- [ ] Orientar hacia productos y carrito sin repetir preguntas.
- [ ] Pasar a asesor humano cuando la consulta lo requiera.
- [ ] Supervisar precisión, tiempos de respuesta y disponibilidad real del servicio.
- [ ] No equiparar la luz verde decorativa a disponibilidad comprobada del backend.

## 6. Administración
- [ ] Registrar solicitudes originadas en la web con estado y canal.
- [ ] Ver solicitudes pendientes, en atención y confirmadas.
- [ ] Evitar duplicados y preservar trazabilidad.
- [ ] Editar plantillas de mensajes desde panel sin tocar el código.
- [ ] Añadir medidas de privacidad y retención de datos de clientes.

## 7. Calidad y despliegue
- [ ] Confirmar despliegue READY del último commit de esta fase.
- [ ] Probar en entorno publicado inicio, catálogo, búsqueda, carrito y pedido.
- [ ] Probar pantalla móvil y accesibilidad con teclado/lector de pantalla.
- [ ] Validar enlace/estructura de mensaje de WhatsApp y error de conexión.
- [ ] Medir velocidad de carga y corregir bloqueos visuales.
- [ ] Revisar los registros de errores en Vercel.
- [ ] Declarar terminada la fase únicamente con pruebas funcionales.

## Prioridad inmediata
1. Validar el despliegue actual y corregir errores de compilación.
2. Probar desde celular real: buscar > abrir producto > agregar > carrito > WhatsApp.
3. Optimizar constructor de pedido para evitar formularios largos.
4. Conectar Paula a acciones reales sobre el catálogo.
