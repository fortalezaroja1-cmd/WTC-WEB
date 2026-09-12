# Estrategia completa · Agente comercial Wired Technology

Última actualización: 2026-09-11
Versión del motor: `WT_RULES_V2`

## 1. Arquitectura real

El agente comercial NO usa un LLM/GPT para decidir respuestas. Es un motor determinístico basado en reglas, catálogo, estado acumulado del lead y eventos del CRM. Esto permite:

- consumo de tokens = 0 para la decisión comercial;
- comportamiento auditable y reproducible;
- reglas de precio, CAP y escalamiento explícitas;
- misma lógica para prueba y WhatsApp real.

El archivo central de reglas es `lib/sales-agent-core.ts`.
El coordinador de WhatsApp es `lib/sales-agent.ts`.
La prueba del panel usa el mismo core mediante `lib/sales-agent-simulator.ts`.

## 2. Tono y formato de respuesta

Reglas obligatorias:

- profesional, cercano, claro, consultivo y natural;
- directo, sin lenguaje interno del CRM;
- máximo aproximado: 60 palabras por respuesta;
- una idea/pregunta principal por mensaje;
- no usar términos internos frente al cliente: lead, funnel, scoring, pipeline, conversión multietapa;
- emojis: 0 por defecto;
- no fingir emociones, tiempos, validaciones ni datos que el sistema no tenga.

## 3. Flujo comercial obligatorio

### Paso 1 · Entrada

1. WhatsApp recibe mensaje.
2. El CRM guarda el mensaje.
3. Si el mismo `metaMessageId` ya fue procesado, no se vuelve a responder.
4. Si el mensaje no es texto, el agente no intenta interpretarlo automáticamente.
5. Si está fuera de horario, actúa el mensaje de ausencia y se bloquea la respuesta normal del agente.

### Paso 2 · Identificar intención

Intenciones actuales:

- GREETING / INFO
- PRICE
- STOCK
- SHIPPING
- BUY
- CONFIRM
- DISCOUNT
- TRUST
- ORIGINALITY
- CLAIM
- HUMAN
- LOST

### Paso 3 · Identificar producto

El agente cruza el mensaje contra catálogo publicado y reconoce familias/sinónimos como:

- alambre / THHN / cable un hilo;
- cable 7 hilos / cable flexible;
- dúplex;
- serie;
- panel LED incrustar / sobreponer;
- bombillos;
- plafones / rosetas;
- tomacorrientes;
- toma + interruptor;
- interruptores;
- breakers / tacos;
- cajas;
- tableros;
- capuchones/conectores;
- cinta aislante;
- curvas PVC;
- medidores.

También interpreta descriptores como calibre, potencia W, amperaje A, circuitos y dimensiones.

REGLA CRÍTICA: si existen varias coincidencias cercanas, no adivina. Pregunta cuál producto exacto necesita el cliente.

Ejemplo: `cable #12` puede ser ambiguo entre alambre #12 y cable 7 hilos #12; debe aclararse antes de cotizar.

### Paso 4 · Calificación comercial

Antes de considerar una oportunidad correctamente calificada, deben conocerse:

1. producto exacto;
2. cantidad;
3. ciudad;
4. urgencia: hoy / mañana / esta semana / sin urgencia.

Datos adicionales detectados cuando aparecen:

- nombre;
- tipo de cliente: reventa/mayorista vs. uso/obra;
- color;
- barrio;
- dirección.

Mientras falta información, CAP debe quedar en A con un siguiente paso explícito.

### Paso 5 · Precio y stock

Fuente única: catálogo publicado del CRM.

Regla de precio:

1. Si existe `promoPrice`, se usa `promoPrice`.
2. Si no existe, se usa `price`.
3. El agente nunca inventa descuentos.
4. Si el cliente pide descuento y no hay promoción cargada, se escala a humano para negociación especial.
5. Si el precio no existe, se escala a humano.
6. Si la cantidad supera el stock, no se promete inventario: se escala para reposición/alternativa.

### Paso 6 · Cotización

La cotización completa requiere:

- producto;
- cantidad;
- precio unitario;
- subtotal de producto;
- envío;
- total;
- condición de contraentrega cuando aplique.

REGLA CRÍTICA: el agente NO debe marcar `COTIZADO` mientras el valor del envío no esté calculado. Hasta tener Skydropx completo, el estado es `COTIZACIÓN PENDIENTE` y la respuesta indica que falta el envío.

### Paso 7 · Datos para cierre

Antes de pedir confirmación final deben estar:

- producto;
- cantidad;
- ciudad;
- dirección;
- barrio;
- color cuando aplica.

En cables/alambres donde el color es relevante, no debe cerrar sin ese dato.

### Paso 8 · Confirmación

El agente resume los datos y pide confirmación expresa.

No basta con intención de compra. El cliente debe confirmar los datos del pedido.

### Paso 9 · CAP

#### C · Cierre

Se usa solo cuando el cliente ya confirmó los datos.

Resultado:

- `POR-CERRAR`;
- validación humana de envío/programación;
- no generar guía antes de la confirmación;
- notificación al equipo.

#### A · Acuerdo

Se usa cuando hay un siguiente paso claro y todavía falta algo.

Siempre debe guardar:

- qué falta;
- cuál es el próximo paso;
- cuándo debe revisarse.

Ejemplos:

- aclarar producto;
- completar cantidad/ciudad/urgencia;
- calcular envío;
- completar dirección/barrio/color;
- esperar confirmación.

#### P · Plan de seguimiento

Si no hay respuesta, máximo tres intentos:

1. mensaje de seguimiento;
2. llamada humana;
3. último mensaje.

Después del tercer intento no se debe seguir insistiendo automáticamente.

## 4. Horarios

Zona: `America/Bogota`.

- lunes a viernes: 06:00–19:00;
- sábado: 07:00–14:00;
- domingo: cerrado.

Fuera de horario:

- se envía mensaje de ausencia/autoservicio;
- se bloquea el agente normal para evitar dobles respuestas;
- el lead queda con siguiente paso de retomar en jornada laboral.

## 5. Filtros y escalamiento humano

Se escala o bloquea automatización cuando:

- hay reclamo, devolución, garantía o producto defectuoso;
- el cliente pide hablar con una persona;
- falta precio;
- stock insuficiente;
- se solicita descuento no autorizado;
- se pregunta originalidad y el catálogo no tiene una afirmación explícita verificable;
- el mensaje es demasiado largo para procesarlo con seguridad;
- ocurre error enviando a Meta;
- el cliente queda listo para cierre C y requiere validación final.

## 6. Originalidad y marca

La marca del catálogo NO se usa por sí sola como prueba de originalidad.

Para afirmar ORIGINAL o GENÉRICO debe existir un dato explícito en `ProductSpec` (por ejemplo `authenticity`). Si no existe, el agente responde que debe validarlo con un asesor.

Esto evita afirmar falsamente que un producto es original o genérico.

## 7. Promociones

El sistema no contiene una promoción global escondida dentro del agente.

Las promociones salen únicamente de `promoPrice` del producto o variante.

Si `promoPrice` está vacío:

- se usa el precio regular;
- el agente no aplica descuento porcentual automático;
- cualquier negociación adicional requiere humano.

La pantalla `/admin/agente/estrategia` muestra las promociones activas detectadas directamente en el catálogo.

## 8. Contraentrega y envío

Regla actual:

- no prometer contraentrega como universal;
- responder que depende de transportadora/destino;
- no inventar el valor del flete;
- la cotización debe esperar el valor real de Skydropx.

Pendiente para automatización total:

- peso por producto;
- largo/ancho/alto por producto;
- regla de empaquetado para múltiples unidades;
- origen logístico definitivo;
- resolución de código postal/destino;
- llamada automática a Skydropx desde el agente;
- selección de tarifa según política comercial.

## 9. Seguimiento automático

Motor: `lib/sales-followup.ts`.

Secuencia implementada:

- Intento 1: WhatsApp de seguimiento.
- Intento 2: crea tarea/notificación de LLAMADA.
- Intento 3: último mensaje y detiene automatización.

El ejecutor programado está en `/api/cron/sales-followup` y requiere `CRON_SECRET` en Vercel para ejecución segura.
También existe disparador administrativo `/api/admin/agent/followup` para pruebas/control manual.

## 10. Auditoría

Cada respuesta automática registra:

- versión del agente;
- intención;
- confianza;
- acción;
- estado acumulado;
- candidatos de producto;
- datos faltantes;
- actividad en CRM.

Los mensajes también guardan quién los originó:

- CLIENT;
- HUMAN;
- AGENT;
- SYSTEM;
- AWAY;
- LEGACY.

Esto permite separar la calidad de respuesta del agente y de cada vendedor.

## 11. Casos mínimos de QA antes de considerarlo estable

- `Hola` sin producto.
- `Precio cable #12`.
- `5 rollos cable #12 Medellín`.
- aclaración posterior `7 hilos`.
- `5 rollos alambre #12 Medellín hoy`.
- producto fuera de stock.
- cantidad mayor al stock.
- solicitud de descuento.
- pregunta por originalidad.
- cliente desconfiado/estafa.
- pregunta por envío/contraentrega.
- compra con datos incompletos.
- compra con dirección/barrio/color completos.
- confirmación expresa.
- reclamo/garantía.
- solicitud de humano.
- `no me interesa`.
- mismo `metaMessageId` repetido.
- mensaje fuera de horario.
- tres pasos de seguimiento sin respuesta.

## 12. Criterio de “perfecto” para producción

No se considera terminado solo porque responda bien en ejemplos. Debe cumplir simultáneamente:

- 0 respuestas duplicadas;
- 0 precio inventado;
- 0 descuento no autorizado;
- 0 producto ambiguo cotizado sin aclaración;
- 0 promesas de stock por encima de inventario;
- 0 guía sin confirmación;
- trazabilidad completa de cada mensaje;
- CAP coherente en cada interacción;
- seguimiento máximo de tres intentos;
- envío real integrado antes de marcar cotización completa;
- QA sobre conversaciones reales del equipo y corrección continua.
