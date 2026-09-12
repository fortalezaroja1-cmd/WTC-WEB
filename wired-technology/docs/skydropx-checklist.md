# Checklist Skydropx · CRM Wired Technology

Última actualización: 2026-09-11

## 1. Conexión base

- [x] Aplicación API creada/conectada en Skydropx.
- [x] Funciones disponibles en Skydropx: cotización, generación de guías y listado de guías.
- [x] `SKYDROPX_CLIENT_ID` guardado como secreto en Supabase `wtc`.
- [x] `SKYDROPX_CLIENT_SECRET` guardado como secreto en Supabase `wtc`.
- [x] Acceso al proyecto Supabase `wtc` confirmado (`klfomayggscumxevsfgp`).
- [x] Edge Function `skydropx-quote` desplegada en Supabase.
- [x] Flujo de autenticación Client ID + Client Secret conectado.
- [x] Prueba real de autenticación realizada desde Wired: conexión Skydropx OK.
- [x] Endpoint protegido del CRM creado para consultar Skydropx: `/api/admin/skydropx`.
- [x] El secreto de Skydropx permanece fuera del navegador y fuera de GitHub.

## 2. Datos logísticos de productos

- [ ] Definir peso real por unidad/rollo para los productos que se venden con envío.
- [ ] Definir largo del paquete por producto.
- [ ] Definir ancho del paquete por producto.
- [ ] Definir alto del paquete por producto.
- [ ] Definir regla para pedidos con varias unidades: un solo bulto vs. varios paquetes.
- [ ] Definir peso y dimensiones especiales cuando se mezclan productos distintos.
- [ ] Cargar primero los productos de mayor rotación antes de completar los 57 productos.

Campos mínimos requeridos por producto:

- `weight_kg`
- `length_cm`
- `width_cm`
- `height_cm`

## 3. Dirección y datos del cliente

- [ ] Confirmar dirección/origen que se usará siempre para despachos.
- [ ] Guardar ciudad de destino en formato consistente.
- [ ] Guardar departamento/estado de destino.
- [ ] Obtener o resolver código postal cuando Skydropx lo requiera.
- [ ] Confirmar barrio y dirección antes del cierre.
- [ ] Validar que el agente solicite únicamente los datos faltantes y no repita preguntas.

## 4. Cotización automática dentro del CRM

- [ ] Conectar el motor del agente con `/api/admin/skydropx`.
- [ ] Cuando existan producto + cantidad + destino + paquete, solicitar cotización automáticamente.
- [ ] Esperar y consultar las tarifas generadas por Skydropx.
- [ ] Ordenar tarifas según regla comercial definida.
- [ ] Mostrar transportadora, servicio, tiempo estimado y valor.
- [ ] Definir si se ofrece la tarifa más barata, la más rápida o varias opciones.
- [ ] Definir si Wired cobra exactamente el valor de Skydropx o aplica recargo/redondeo.
- [ ] Incluir el costo del envío en el total presentado al cliente.
- [ ] Guardar la cotización y la tarifa elegida en el lead/pedido para no recalcular sin necesidad.
- [ ] Respetar la vigencia de la cotización y volver a calcular cuando expire.

## 5. Cierre, pedido y guía

- [ ] No generar guía mientras el cliente solo esté cotizando.
- [ ] Generar guía únicamente cuando el pedido esté confirmado según CAP.
- [ ] Enlazar la guía de Skydropx con el pedido de Wired.
- [ ] Guardar número de guía, transportadora y tracking.
- [ ] Mostrar esos datos en el CRM.
- [ ] Enviar información de despacho al cliente por WhatsApp.
- [ ] Evitar generar guías duplicadas ante reintentos.

## 6. Contraentrega

- [ ] Validar qué transportadoras/tarifas disponibles soportan contraentrega para cada destino.
- [ ] Definir monto máximo permitido de recaudo.
- [ ] Enviar a Skydropx el valor correcto a recaudar cuando aplique.
- [ ] No prometer contraentrega si la tarifa/transportadora elegida no la admite.
- [ ] Registrar en el CRM si el pedido es contraentrega o prepago.

## 7. Tracking y postventa

- [ ] Crear/configurar webhook de eventos de envío si Skydropx lo soporta para el flujo requerido.
- [ ] Actualizar automáticamente estados: generado, recolectado, en tránsito, entregado, incidencia.
- [ ] Sincronizar esos estados con el pipeline del CRM.
- [ ] Alertar al vendedor cuando haya novedad o intento fallido.
- [ ] Marcar entregado únicamente con confirmación del transportador.

## 8. Seguridad y estabilidad

- [x] Credenciales de Skydropx almacenadas como secretos en Supabase.
- [x] Endpoint administrativo de Wired protegido por sesión admin.
- [ ] Definir logs de errores de cotización sin exponer secretos.
- [ ] Implementar reintentos controlados frente a timeout/API temporalmente caída.
- [ ] Implementar manejo de token vencido y renovación automática.
- [ ] Revisar límites/rate limits de Skydropx.
- [ ] Activar RLS con políticas correctas en `Lead`, `CrmMessage` y `CrmActivity` antes de producción pública. Actualmente estas 3 tablas tienen RLS desactivado.

## 9. Pruebas antes de producción

- [ ] Cotización Bogotá → Medellín con un rollo.
- [ ] Cotización Bogotá → Medellín con varios rollos.
- [ ] Cotización a ciudad intermedia/municipio.
- [ ] Pedido con dos productos diferentes.
- [ ] Dirección incompleta.
- [ ] Código postal inválido.
- [ ] Producto sin peso/dimensiones.
- [ ] Skydropx sin tarifas disponibles.
- [ ] Skydropx temporalmente caído.
- [ ] Confirmación CAP y generación de guía.
- [ ] Reintento sin duplicar guía.
- [ ] Seguimiento hasta entrega.

## Estado actual resumido

La conexión técnica con Skydropx está operativa. El principal bloqueo para cotizaciones automáticas reales es completar los datos logísticos de los productos y conectar esos datos con el estado del agente/lead. Después se implementa selección de tarifa, cierre, generación de guía y tracking.
