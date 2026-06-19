# Diseño — Diálogo fluido y congruente en el chat

Fecha: 2026-06-19
Estado: Aprobado (pendiente de plan de implementación)

## Problema

El chat de registro de gastos es rígido. Hoy `extraerDeTexto` solo devuelve
datos estructurados (`ExtraccionGasto`) y **todas** las respuestas del bot son
textos fijos (`PREGUNTAS` en `extraccion.ts` y strings literales en
`page.tsx`). Consecuencias:

- El bot no reconoce ni refleja lo que el usuario escribió: no hay congruencia.
- Si el usuario se va de tema (saludo, pregunta no relacionada, comentario), el
  bot igual intenta extraer un gasto, no encuentra campos esenciales y dispara
  la siguiente pregunta fija. El diálogo se siente incoherente.
- No hay manejo natural de correcciones ("no, eran 50 mil").

## Objetivo

Lograr un diálogo fluido y congruente: las respuestas del bot deben ser claras
y acordes a lo que escribe el usuario, y cuando el usuario se sale del contexto
(registrar un gasto) el bot debe reconocerlo brevemente y reencauzarlo al
registro.

## Decisiones de producto (acordadas)

- **Fuera de contexto:** *reconoce y reencauza* — responde breve a lo que dijo y
  de inmediato vuelve a pedir el dato que falta.
- **Eco de lo captado:** *solo si hay duda* — si entendió claro, pasa directo a
  la siguiente pregunta; confirma solo ante corrección o ambigüedad. No repetir
  innecesariamente.
- **Tono:** *profesional y claro* — cordial pero sobrio, casi sin emojis, frases
  cortas. Apto para uso de finanzas/gerencia.

## Enfoque elegido

**Enfoque A — Respuesta conversacional del LLM en la misma llamada.**

En la misma llamada a Claude que ya extrae los datos, el modelo también:
1. redacta el `mensaje` de respuesta del bot (en tono profesional), y
2. clasifica la `intencion` del mensaje del usuario.

Una sola llamada → sin costo ni latencia extra relevante. Se mantiene el modelo
actual `claude-haiku-4-5`; si la calidad del reencauce no convence, se sube a
`claude-sonnet-4-6` cambiando la constante `MODELO`.

Enfoques descartados: B (segunda llamada dedicada → duplica costo/latencia sin
beneficio) y C (plantillas por intención → sigue sonando enlatado, no cumple
"fluido").

## Contrato nuevo

`extraerDeTexto` y `extraerDeImagen` pasan a devolver:

```ts
export type IntencionMensaje =
  | "gasto"          // aporta datos de un gasto
  | "saludo"         // saludo / inicio de conversación
  | "correccion"     // corrige un dato ya capturado
  | "fuera_de_tema"  // pregunta no relacionada / charla
  | "otro";

export interface RespuestaConversacion {
  extraccion: ExtraccionGasto; // igual que hoy
  intencion: IntencionMensaje;
  mensaje: string;             // respuesta del bot ya redactada (tono profesional)
}
```

La `intencion` permite decidir el flujo sin interpretar el texto; el `mensaje`
es lo que se muestra en la burbuja del bot.

## Cambios por archivo

### `src/lib/claude.ts`
- Ampliar `SCHEMA` con `mensaje` (`{ type: "string" }`) e `intencion`
  (`{ type: "string", enum: [...] }`); ambos en `properties` y `required`
  (el schema usa `additionalProperties: false`).
- Reescribir `SYSTEM_EXTRACCION` para incluir:
  - Tono profesional y claro (sobrio, casi sin emojis, frases cortas).
  - Conciencia de los 4 campos esenciales (comercio, monto, categoría, fecha):
    tras combinar con el borrador, si falta alguno, `mensaje` debe pedir el
    siguiente que falte; si están todos, `mensaje` es una breve introducción a
    confirmar el resumen.
  - Regla de reencauce: si el usuario se va de tema, reconocer brevemente y
    volver a pedir el dato que falta (intención `fuera_de_tema`).
  - Eco solo ante corrección/ambigüedad (intención `correccion`).
- `extraerDeTexto` y `extraerDeImagen` devuelven `RespuestaConversacion`.
  `parseExtraccion` se mantiene para mapear los campos del gasto; las funciones
  públicas leen además `mensaje` e `intencion` de la respuesta cruda.
- `extraerDeImagen` acepta un `borrador` opcional como contexto, para que el
  `mensaje` sea congruente con lo ya capturado antes de adjuntar la imagen.

### `src/lib/extraccion.ts`
- Agregar el tipo `IntencionMensaje`.
- `PREGUNTAS` y `siguientePregunta` se conservan como **fallback** (si el LLM no
  entrega `mensaje` o la llamada falla). El bot nunca queda mudo.

### `src/app/api/extraer/route.ts`
- La respuesta incluye `mensaje` e `intencion` además de `extraccion` y
  `faltantes`.
- El path existente de **factura no corresponde** (`rechazo`) queda intacto y
  tiene prioridad: si la factura no está emitida a la empresa, se devuelve
  `rechazo` y no se avanza.

### `src/lib/api-client.ts`
- `RespuestaExtraccion` suma `mensaje?: string` e `intencion?: IntencionMensaje`.

### `src/app/page.tsx`
- `onTexto` y `onArchivo`: en vez de la pregunta fija (`siguientePregunta` vía
  `avanzar`), muestran el `mensaje` del LLM. Si la extracción quedó completa,
  además muestran la `TarjetaConfirmacion`.
- `onArchivo` pasa el `borrador` actual a `extraerDesdeImagen` para contexto.
- `avanzar` se refactoriza para recibir el `mensaje` opcional: completa → tarjeta
  (precedida de breve mensaje); incompleta → muestra `mensaje`; si `mensaje`
  viene vacío → fallback a `siguientePregunta`.
- Ajustar al tono profesional los strings fijos restantes para congruencia:
  saludo inicial, "Gasto registrado", "¿Deseas registrar otro?" y los mensajes
  de error. Cambio cosmético menor.

## Flujo por turno

1. Usuario escribe (o adjunta imagen) → una llamada a Claude que extrae datos,
   redacta `mensaje` y clasifica `intencion`.
2. Si `rechazo` (factura ajena a la empresa) → se muestra ese motivo y no avanza.
3. Se fusiona la extracción con el borrador (`fusionarExtraccion`).
4. Se muestra `mensaje`. Si están los 4 campos esenciales → además la tarjeta de
   confirmación.
5. `fuera_de_tema` → la extracción no aporta esenciales, no se completa ni
   avanza; el `mensaje` reconoce y reencauza.

## Manejo de errores y fallback

- Falla la llamada al asistente → se mantiene el mensaje de error actual
  ("No pude procesar eso. ¿Puedes reformularlo?" / equivalente profesional).
- `mensaje` vacío o ausente → fallback a `siguientePregunta(fusion)`.
- El `rechazo` de factura tiene prioridad sobre el flujo conversacional.

## Pruebas

- `src/lib/claude.test.ts`:
  - Respuestas mockeadas incluyen `mensaje` e `intencion`.
  - Caso gasto normal: extracción mapeada + `mensaje`/`intencion` presentes.
  - Caso fuera de tema: `intencion === "fuera_de_tema"`, extracción en null,
    `mensaje` no vacío (reencauza).
  - Caso corrección: `intencion === "correccion"` y campo actualizado.
- `src/lib/extraccion.test.ts`:
  - El tipo `IntencionMensaje` y el fallback `siguientePregunta` siguen
    funcionando. Las pruebas existentes de `validarReceptorFactura` no se ven
    afectadas (dependen de `tipoDocumento`).

## Costo y rendimiento

La misma llamada (Haiku 4.5), solo con salida algo mayor (texto del `mensaje`).
Impacto de costo/latencia despreciable. Ruta de escalamiento: cambiar `MODELO` a
`claude-sonnet-4-6` si se requiere mejor calidad de reencauce.

## Fuera de alcance

- Persistir la intención o el historial conversacional en la base de datos.
- Cambiar el modelo por defecto (se mantiene Haiku 4.5).
- Rediseño visual del chat.
