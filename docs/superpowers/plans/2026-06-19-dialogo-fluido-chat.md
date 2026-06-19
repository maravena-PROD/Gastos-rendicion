# Diálogo fluido y congruente en el chat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el bot del chat de gastos interprete y responda de forma fluida y congruente con lo que escribe el usuario, redactando su respuesta con el LLM (no con textos fijos) y reencauzando los mensajes fuera de tema.

**Architecture:** En la misma llamada a Claude que ya extrae los datos del gasto, el modelo también devuelve `mensaje` (la respuesta del bot, ya redactada) e `intencion` (clasificación del turno). El front muestra ese `mensaje` en vez de las preguntas fijas; estas quedan solo como fallback. Una sola llamada, sin costo/latencia extra relevante.

**Tech Stack:** Next.js (App Router) + TypeScript, Anthropic SDK (`@anthropic-ai/sdk`, modelo `claude-haiku-4-5`), Vitest.

## Global Constraints

- Modelo del asistente: `claude-haiku-4-5` (constante `MODELO` en `src/lib/claude.ts`). No cambiar.
- Tono de todo el bot: **profesional y claro** — cordial pero sobrio, frases cortas, casi sin emojis.
- Campos esenciales del gasto (orden de pregunta): `comercio`, `monto`, `categoria`, `fechaDocumento`.
- El path existente de **factura no corresponde** (`rechazo` en `api/extraer`) tiene prioridad y NO debe romperse.
- El bot nunca queda mudo: si el LLM no entrega `mensaje`, se cae a `siguientePregunta` (pregunta fija).
- Idioma de cara al usuario: español (Chile).
- Tests: `npx vitest run <archivo>`. Type-check: `npx tsc --noEmit`. Comandos desde la raíz del repo.

---

### Task 1: Tipo de intención y normalizador (fallback) en `extraccion.ts`

**Files:**
- Modify: `src/lib/extraccion.ts`
- Test: `src/lib/extraccion.test.ts`

**Interfaces:**
- Consumes: `ExtraccionGasto` (ya existe en `src/lib/extraccion.ts`).
- Produces:
  - `type IntencionMensaje = "gasto" | "saludo" | "correccion" | "fuera_de_tema" | "otro"`
  - `const INTENCIONES: readonly IntencionMensaje[]`
  - `function normalizarIntencion(valor: string | null): IntencionMensaje` (desconocido → `"otro"`)
  - `interface RespuestaConversacion { extraccion: ExtraccionGasto; intencion: IntencionMensaje; mensaje: string }`

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `src/lib/extraccion.test.ts`:

```ts
import {
  // ...imports existentes...
  normalizarIntencion,
} from "./extraccion";

describe("normalizarIntencion", () => {
  it("acepta una intención válida exacta", () => {
    expect(normalizarIntencion("fuera_de_tema")).toBe("fuera_de_tema");
    expect(normalizarIntencion("gasto")).toBe("gasto");
  });
  it("es tolerante a mayúsculas y espacios", () => {
    expect(normalizarIntencion("  CORRECCION  ")).toBe("correccion");
  });
  it("devuelve 'otro' para valores desconocidos o null", () => {
    expect(normalizarIntencion("cualquier_cosa")).toBe("otro");
    expect(normalizarIntencion(null)).toBe("otro");
    expect(normalizarIntencion("")).toBe("otro");
  });
});
```

Nota: añadir `normalizarIntencion` a la lista de imports existente al inicio del archivo de test (no crear un segundo `import ... from "./extraccion"`).

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/extraccion.test.ts`
Expected: FAIL — `normalizarIntencion is not a function` / import inexistente.

- [ ] **Step 3: Implementar el tipo y el normalizador**

En `src/lib/extraccion.ts`, justo después del bloque `export interface ExtraccionGasto { ... }` (y antes de `export const RUT_EMPRESA`), agregar:

```ts
/** Intención del turno del usuario, usada para guiar el flujo del chat. */
export const INTENCIONES = ["gasto", "saludo", "correccion", "fuera_de_tema", "otro"] as const;
export type IntencionMensaje = (typeof INTENCIONES)[number];

/** Respuesta conversacional del asistente: datos + respuesta redactada + intención. */
export interface RespuestaConversacion {
  extraccion: ExtraccionGasto;
  intencion: IntencionMensaje;
  mensaje: string;
}

/** Normaliza el texto de intención del modelo a un IntencionMensaje; desconocido → "otro". */
export function normalizarIntencion(valor: string | null): IntencionMensaje {
  if (!valor) return "otro";
  const limpio = valor.trim().toLowerCase();
  return (INTENCIONES as readonly string[]).includes(limpio)
    ? (limpio as IntencionMensaje)
    : "otro";
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/extraccion.test.ts`
Expected: PASS (todas las pruebas del archivo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/extraccion.ts src/lib/extraccion.test.ts
git commit -m "feat(chat): tipo IntencionMensaje y normalizarIntencion (fallback)"
```

---

### Task 2: `claude.ts` — schema, prompt conversacional y `extraerDeTexto` devuelve `RespuestaConversacion`

**Files:**
- Modify: `src/lib/claude.ts`
- Test: `src/lib/claude.test.ts`

**Interfaces:**
- Consumes: `RespuestaConversacion`, `IntencionMensaje`, `normalizarIntencion` (Task 1); `ExtraccionGasto`, `normalizarCategoria`, `normalizarTipoDocumento` (ya existen).
- Produces:
  - `function parseRespuesta(res): RespuestaConversacion`
  - `extraerDeTexto(texto, contexto?): Promise<RespuestaConversacion>` (antes devolvía `ExtraccionGasto`)
  - `parseExtraccion(res): ExtraccionGasto` se mantiene (refactor interno con helper `aExtraccion`).

- [ ] **Step 1: Reescribir los tests de `extraerDeTexto` para el nuevo contrato**

Reemplazar en `src/lib/claude.test.ts` el bloque `describe("extraerDeTexto", ...)` completo por:

```ts
describe("extraerDeTexto", () => {
  it("mapea la respuesta de Claude a RespuestaConversacion", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Copec",
        monto: 45000,
        fechaDocumento: "2026-06-10",
        categoria: "Combustible",
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        intencion: "gasto",
        mensaje: "Tengo todo lo necesario. Revisa el resumen para confirmar.",
      }),
    );
    const r = await extraerDeTexto("combustible 45000 en Copec");
    expect(r.extraccion.comercio).toBe("Copec");
    expect(r.extraccion.monto).toBe(45000);
    expect(r.extraccion.categoria).toBe("Combustible");
    expect(r.intencion).toBe("gasto");
    expect(r.mensaje).toContain("resumen");
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("clasifica fuera de tema y reencauza sin inventar datos", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: null,
        monto: null,
        fechaDocumento: null,
        categoria: null,
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        intencion: "fuera_de_tema",
        mensaje: "Solo puedo ayudarte a registrar gastos. ¿En qué comercio fue el gasto?",
      }),
    );
    const r = await extraerDeTexto("¿qué hora es?");
    expect(r.intencion).toBe("fuera_de_tema");
    expect(r.extraccion.comercio).toBeNull();
    expect(r.mensaje.length).toBeGreaterThan(0);
  });

  it("normaliza una intención desconocida a 'otro' y deja mensaje vacío si no viene", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Copec",
        monto: 45000,
        fechaDocumento: null,
        categoria: "combustible",
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        intencion: "loquesea",
      }),
    );
    const r = await extraerDeTexto("x");
    expect(r.extraccion.categoria).toBe("Combustible");
    expect(r.intencion).toBe("otro");
    expect(r.mensaje).toBe("");
  });

  it("convierte un monto no numérico a null", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: null,
        monto: "no-numero",
        fechaDocumento: null,
        categoria: null,
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        intencion: "gasto",
        mensaje: "¿Cuál es el monto del gasto?",
      }),
    );
    const r = await extraerDeTexto("x");
    expect(r.extraccion.monto).toBeNull();
  });

  it("lanza si la respuesta no trae bloque de texto", async () => {
    messagesCreate.mockResolvedValue({ content: [] });
    await expect(extraerDeTexto("x")).rejects.toThrow();
  });

  it("lanza si el texto no es JSON válido", async () => {
    messagesCreate.mockResolvedValue({ content: [{ type: "text", text: "no es json" }] });
    await expect(extraerDeTexto("x")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Correr los tests y verificar que fallan**

Run: `npx vitest run src/lib/claude.test.ts`
Expected: FAIL — `r.extraccion` es `undefined` (aún devuelve `ExtraccionGasto` plano).

- [ ] **Step 3: Actualizar el schema y el system prompt**

En `src/lib/claude.ts`, reemplazar la constante `SYSTEM_EXTRACCION` completa por:

```ts
const SYSTEM_EXTRACCION = `Eres el asistente de rendición de gastos de una empresa chilena. Conversas con un colaborador para registrar un gasto.

En CADA turno haces dos cosas:
1) Extraes los datos del gasto a partir del texto o de una foto de boleta/factura.
2) Redactas tu respuesta ("mensaje") y clasificas la intención del usuario ("intencion").

Categorías válidas (elige la más adecuada): ${CATEGORIAS.join(", ")}.

Reglas de extracción:
- "monto" es un entero en pesos chilenos (CLP), sin puntos de miles ni decimales (45000, no "45.000").
- "fechaDocumento" en formato AAAA-MM-DD.
- "rutEmisor" con formato chileno (ej. 76.543.219-7) si aparece.
- "tipoDocumento" debe ser "Boleta" o "Factura" según el documento; null si no se distingue.
- "numeroDocumento" es el folio/número (ej. "N° 12345", "Folio 000123"). Devuelve solo el número, sin la palabra "boleta"/"factura"/"folio". null si no aparece.
- "monto" es el TOTAL a pagar (con IVA incluido).
- "montoNeto" e "iva" son enteros CLP si aparecen desglosados; si no, null.
- "rutEmisor" y "comercio" identifican a QUIEN EMITE la factura (el proveedor/vendedor).
- "rutReceptor" y "razonSocialReceptor" identifican al RECEPTOR: el cliente AL QUE se emite la factura (aparece como "Señor(es):", "Cliente", "Razón Social", con su propio R.U.T.). NO confundas el receptor con el emisor. En boletas normalmente no hay receptor: devuelve null en ambos.
- Si un dato no aparece o no estás seguro, devuelve null. NUNCA inventes datos.

Campos esenciales para registrar un gasto: comercio, monto, categoria, fechaDocumento.

Reglas de conversación ("mensaje" e "intencion"):
- Tono profesional y claro: cordial pero sobrio, frases cortas, casi sin emojis. "mensaje" siempre en español, dirigido al usuario.
- "intencion" es una de: "gasto" (aporta datos del gasto), "saludo" (saluda o inicia la conversación), "correccion" (corrige un dato ya capturado), "fuera_de_tema" (pregunta no relacionada o conversación ajena al registro de gastos), "otro".
- Combina lo que aporta este mensaje con los datos ya capturados. Si aún falta algún campo esencial, "mensaje" pide de forma natural el SIGUIENTE campo que falte, uno a la vez.
- Si ya están los 4 campos esenciales, "mensaje" es una frase breve indicando que mostrarás el resumen para confirmar.
- No repitas de vuelta los datos que entendiste, SALVO que el usuario corrija un dato o haya ambigüedad; en ese caso confirma el cambio en una frase corta.
- Si el usuario se va de tema, reconócelo en una frase breve y de inmediato reencauza pidiendo el dato del gasto que falta. No respondas preguntas ajenas al registro de gastos.`;
```

Luego, en la constante `SCHEMA`, dentro de `properties`, **después** de la línea ya existente `razonSocialReceptor: { type: ["string", "null"] },` agregar SOLO los dos campos nuevos (no redeclarar `rutReceptor`/`razonSocialReceptor`, que ya existen):

```ts
    mensaje: { type: "string" },
    intencion: { type: "string", enum: ["gasto", "saludo", "correccion", "fuera_de_tema", "otro"] },
```

y añadir `"mensaje"` e `"intencion"` al array `required` (al final, tras `"razonSocialReceptor"`):

```ts
    "razonSocialReceptor",
    "mensaje",
    "intencion",
```

- [ ] **Step 4: Refactor del parseo e introducir `parseRespuesta`**

En `src/lib/claude.ts`, actualizar el import superior:

```ts
import {
  normalizarCategoria,
  normalizarTipoDocumento,
  normalizarIntencion,
  type ExtraccionGasto,
  type RespuestaConversacion,
} from "./extraccion";
```

Reemplazar la función `parseExtraccion` completa por estas tres funciones:

```ts
/** Lee el bloque de texto JSON de la respuesta de Claude. Lanza si no hay texto. */
function leerJson(res: { content: Array<{ type: string; text?: string }> }): Record<string, unknown> {
  const bloque = res.content.find((c) => c.type === "text");
  if (!bloque?.text) {
    throw new Error("Claude no devolvió contenido de texto para parsear");
  }
  return JSON.parse(bloque.text);
}

/** Mapea el objeto crudo a ExtraccionGasto (campos del gasto). */
function aExtraccion(datos: Record<string, unknown>): ExtraccionGasto {
  return {
    comercio: (datos.comercio as string) ?? null,
    monto: aMontoEntero(datos.monto),
    fechaDocumento: (datos.fechaDocumento as string) ?? null,
    categoria: normalizarCategoria((datos.categoria as string) ?? null),
    rutEmisor: (datos.rutEmisor as string) ?? null,
    numeroDocumento: (datos.numeroDocumento as string) ?? null,
    direccion: (datos.direccion as string) ?? null,
    tipoDocumento: normalizarTipoDocumento((datos.tipoDocumento as string) ?? null),
    montoNeto: aMontoEntero(datos.montoNeto),
    iva: aMontoEntero(datos.iva),
    rutReceptor: (datos.rutReceptor as string) ?? null,
    razonSocialReceptor: (datos.razonSocialReceptor as string) ?? null,
  };
}

/** Toma la respuesta cruda de Claude y la mapea a ExtraccionGasto (solo datos). */
export function parseExtraccion(res: { content: Array<{ type: string; text?: string }> }): ExtraccionGasto {
  return aExtraccion(leerJson(res));
}

/** Toma la respuesta cruda y la mapea a RespuestaConversacion (datos + mensaje + intención). */
export function parseRespuesta(res: { content: Array<{ type: string; text?: string }> }): RespuestaConversacion {
  const datos = leerJson(res);
  return {
    extraccion: aExtraccion(datos),
    mensaje: typeof datos.mensaje === "string" ? datos.mensaje : "",
    intencion: normalizarIntencion(typeof datos.intencion === "string" ? datos.intencion : null),
  };
}
```

Cambiar la firma y el `return` de `extraerDeTexto`:

```ts
export async function extraerDeTexto(
  texto: string,
  contexto?: ContextoTexto,
): Promise<RespuestaConversacion> {
```

y al final de esa función, reemplazar `return parseExtraccion(res as never);` por:

```ts
  return parseRespuesta(res as never);
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `npx vitest run src/lib/claude.test.ts`
Expected: PASS para todas las pruebas de `extraerDeTexto`. (Las de `extraerDeImagen` aún pueden fallar — se arreglan en Task 3.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/claude.ts src/lib/claude.test.ts
git commit -m "feat(chat): extraerDeTexto devuelve mensaje+intencion del LLM"
```

---

### Task 3: `claude.ts` — `extraerDeImagen` devuelve `RespuestaConversacion` con contexto de borrador

**Files:**
- Modify: `src/lib/claude.ts`
- Test: `src/lib/claude.test.ts`

**Interfaces:**
- Consumes: `parseRespuesta`, `resumenBorrador`, `ContextoTexto` (ya en el archivo), `RespuestaConversacion`.
- Produces: `extraerDeImagen(base64, mediaType, contexto?: ContextoTexto): Promise<RespuestaConversacion>`.

- [ ] **Step 1: Reescribir el test de `extraerDeImagen`**

Reemplazar en `src/lib/claude.test.ts` el bloque `describe("extraerDeImagen", ...)` por:

```ts
describe("extraerDeImagen", () => {
  it("incluye un bloque de imagen y devuelve RespuestaConversacion", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Shell",
        monto: 30000,
        fechaDocumento: "2026-06-09",
        categoria: "Combustible",
        rutEmisor: "76.543.219-7",
        numeroDocumento: "0012345",
        direccion: null,
        intencion: "gasto",
        mensaje: "Leí la boleta. ¿De qué categoría fue el gasto?",
      }),
    );
    const r = await extraerDeImagen("BASE64DATA", "image/jpeg");
    expect(r.extraccion.comercio).toBe("Shell");
    expect(r.extraccion.rutEmisor).toBe("76.543.219-7");
    expect(r.mensaje).toContain("boleta");
    const arg = messagesCreate.mock.calls[0][0] as {
      messages: { content: Array<{ type: string }> }[];
    };
    const tipos = arg.messages[0].content.map((c) => c.type);
    expect(tipos).toContain("image");
  });

  it("incluye los datos ya capturados del borrador en el prompt", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Shell",
        monto: 30000,
        fechaDocumento: "2026-06-09",
        categoria: "Combustible",
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        intencion: "gasto",
        mensaje: "Listo.",
      }),
    );
    await extraerDeImagen("BASE64DATA", "image/jpeg", {
      borrador: {
        comercio: "Shell",
        monto: null,
        fechaDocumento: null,
        categoria: null,
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        tipoDocumento: null,
        montoNeto: null,
        iva: null,
        rutReceptor: null,
        razonSocialReceptor: null,
      },
    });
    const arg = messagesCreate.mock.calls[0][0] as {
      messages: { content: Array<{ type: string; text?: string }> }[];
    };
    const textos = arg.messages[0].content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join(" ");
    expect(textos).toContain("Shell");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/claude.test.ts`
Expected: FAIL — `r.extraccion` undefined y/o el borrador no aparece en el prompt.

- [ ] **Step 3: Implementar `extraerDeImagen` con contexto y `RespuestaConversacion`**

En `src/lib/claude.ts`, reemplazar la función `extraerDeImagen` completa por:

```ts
/** Extrae los datos de un gasto a partir de una imagen de boleta (visión = OCR). */
export async function extraerDeImagen(
  base64: string,
  mediaType: "image/jpeg" | "image/png",
  contexto?: ContextoTexto,
): Promise<RespuestaConversacion> {
  const instruccion = [
    contexto?.borrador
      ? `Datos del gasto ya capturados: ${resumenBorrador(contexto.borrador)}.`
      : null,
    "Extrae los datos de esta boleta o factura y redacta tu respuesta.",
  ]
    .filter(Boolean)
    .join("\n");

  const params = {
    model: MODELO,
    max_tokens: 1024,
    system: SYSTEM_EXTRACCION,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user" as const,
        content: [
          { type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data: base64 } },
          { type: "text" as const, text: instruccion },
        ],
      },
    ],
  };
  // output_config no está en MessageCreateParams base; cast local para la llamada.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await getCliente().messages.create(params as any);
  return parseRespuesta(res as never);
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/claude.test.ts`
Expected: PASS (todo el archivo).

- [ ] **Step 5: Commit**

```bash
git add src/lib/claude.ts src/lib/claude.test.ts
git commit -m "feat(chat): extraerDeImagen conversacional con contexto de borrador"
```

---

### Task 4: Ruta `api/extraer` y `api-client.ts` propagan `mensaje`/`intencion` (y borrador a imagen)

**Files:**
- Modify: `src/app/api/extraer/route.ts`
- Modify: `src/lib/api-client.ts`

**Interfaces:**
- Consumes: `extraerDeTexto`, `extraerDeImagen` (devuelven `RespuestaConversacion`), `validarReceptorFactura`, `camposFaltantes`.
- Produces:
  - Respuesta JSON de `/api/extraer`: `{ extraccion, mensaje, intencion, faltantes }` o `{ extraccion, rechazo: { motivo } }`.
  - `RespuestaExtraccion` (api-client) con `mensaje?: string` e `intencion?: IntencionMensaje`.
  - `extraerDesdeImagen(base64, borrador?): Promise<RespuestaExtraccion>`.

- [ ] **Step 1: Actualizar la ruta `api/extraer`**

En `src/app/api/extraer/route.ts`:

a) El tipo del body ya admite `borrador` para texto; asegurarlo también para imagen. Reemplazar la línea del tipo `body`:

```ts
  let body: { texto?: string; base64?: string; borrador?: ExtraccionGasto };
```

(se mantiene igual; `borrador` ya está). 

b) Reemplazar el bloque del path de imagen por:

```ts
      const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
      const r = await extraerDeImagen(body.base64, v.mimeType, { borrador: body.borrador, hoy });
      const receptor = validarReceptorFactura(r.extraccion);
      if (!receptor.ok) {
        return NextResponse.json({ extraccion: r.extraccion, rechazo: { motivo: receptor.motivo } });
      }
      return NextResponse.json({
        extraccion: r.extraccion,
        mensaje: r.mensaje,
        intencion: r.intencion,
        faltantes: camposFaltantes(r.extraccion),
      });
```

c) Reemplazar el bloque del path de texto (desde `const extraccion = await extraerDeTexto(...)` hasta su `return`) por:

```ts
      const r = await extraerDeTexto(body.texto, { borrador, campoPreguntado, hoy });
      const receptor = validarReceptorFactura(r.extraccion);
      if (!receptor.ok) {
        return NextResponse.json({ extraccion: r.extraccion, rechazo: { motivo: receptor.motivo } });
      }
      return NextResponse.json({
        extraccion: r.extraccion,
        mensaje: r.mensaje,
        intencion: r.intencion,
        faltantes: camposFaltantes(r.extraccion),
      });
```

Nota: la variable `hoy` del path de texto ya existe; en el path de imagen se agrega su propia declaración (paso b). Verificar que no quede una declaración `hoy` duplicada en el mismo scope — cada path está dentro de su propio `if`, por lo que son scopes distintos y no colisionan.

- [ ] **Step 2: Actualizar `api-client.ts`**

En `src/lib/api-client.ts`:

a) Ampliar el import de tipos:

```ts
import type { ExtraccionGasto, IntencionMensaje } from "./extraccion";
```

b) Reemplazar la interfaz `RespuestaExtraccion`:

```ts
/** Respuesta de las rutas de extracción. */
export interface RespuestaExtraccion {
  extraccion: ExtraccionGasto;
  faltantes?: string[];
  mensaje?: string;
  intencion?: IntencionMensaje;
  /** Presente cuando el documento no se puede rendir (ej. factura no emitida a la empresa). */
  rechazo?: { motivo: string };
}
```

c) Reemplazar `extraerDesdeImagen` para aceptar el borrador:

```ts
/** Extrae datos de un gasto a partir de una imagen (base64 sin prefijo). */
export function extraerDesdeImagen(
  base64: string,
  borrador?: ExtraccionGasto,
): Promise<RespuestaExtraccion> {
  return pedir<RespuestaExtraccion>("/api/extraer", {
    method: "POST",
    body: JSON.stringify({ base64, borrador }),
  });
}
```

- [ ] **Step 3: Verificar tipos y suite completa**

Run: `npx tsc --noEmit`
Expected: Sin errores en `route.ts` ni `api-client.ts`. (Puede reportar error en `src/app/page.tsx` por el cambio de firma de `extraerDesdeImagen`/uso de `mensaje`; se corrige en Task 5.)

Run: `npx vitest run`
Expected: PASS (los tests de `claude` y `extraccion` ya cubiertos; el resto sin cambios).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/extraer/route.ts src/lib/api-client.ts
git commit -m "feat(chat): la ruta de extracción propaga mensaje/intencion"
```

---

### Task 5: `page.tsx` — usar el `mensaje` del LLM y alinear el tono profesional

**Files:**
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `extraerDesdeTexto`, `extraerDesdeImagen(base64, borrador)`, `RespuestaExtraccion` (`mensaje`, `intencion`, `rechazo`), `camposFaltantes`, `siguientePregunta`, `fusionarExtraccion`.
- Produces: comportamiento del chat (sin API nueva).

- [ ] **Step 1: Refactor de `avanzar` para usar el mensaje del LLM**

En `src/app/page.tsx`, reemplazar la función `avanzar` completa por:

```ts
  function avanzar(
    nuevoBorrador: ExtraccionGasto,
    img: { url: string; id: string } | null,
    mensaje?: string,
    intencion?: string,
  ) {
    // Fuera de tema nunca avanza a la tarjeta, aunque el borrador esté completo.
    const completa =
      camposFaltantes(nuevoBorrador).length === 0 && intencion !== "fuera_de_tema";
    // Respuesta del bot: la redactada por el LLM, o la pregunta fija como fallback.
    const texto = mensaje?.trim() || (completa ? null : siguientePregunta(nuevoBorrador));
    if (texto) agregarBot(texto);
    if (completa) {
      setMensajes((m) => [
        ...m,
        { tipo: "confirmacion", borrador: nuevoBorrador, imagenUrl: img?.url, imagenDriveId: img?.id },
      ]);
    }
  }
```

- [ ] **Step 2: Actualizar `onTexto`**

Reemplazar el cuerpo del `try` de `onTexto` por:

```ts
    try {
      const { extraccion, mensaje, intencion, rechazo } = await extraerDesdeTexto(texto, borrador);
      if (rechazo) {
        agregarBot(rechazo.motivo);
        return;
      }
      const fusion = fusionarExtraccion(borrador, extraccion);
      setBorrador(fusion);
      avanzar(fusion, imagen, mensaje, intencion);
    } catch {
      agregarBot("No pude procesar tu mensaje. ¿Puedes reformularlo?");
    } finally {
      setProcesando(false);
    }
```

- [ ] **Step 3: Actualizar `onArchivo`**

Reemplazar el cuerpo del `try` de `onArchivo` por:

```ts
    try {
      const { base64, nombre } = await reducirImagen(file);
      const [sub, ext] = await Promise.all([
        subirBoleta(base64, nombre),
        extraerDesdeImagen(base64, borrador),
      ]);
      if (ext.rechazo) {
        agregarBot(ext.rechazo.motivo);
        return;
      }
      const img = { url: sub.url, id: sub.id };
      setImagen(img);
      const fusion = fusionarExtraccion(borrador, ext.extraccion);
      setBorrador(fusion);
      avanzar(fusion, img, ext.mensaje, ext.intencion);
    } catch {
      agregarBot("No pude leer la boleta. Intenta con otra foto o cuéntame los datos.");
    } finally {
      setProcesando(false);
    }
```

- [ ] **Step 4: Alinear el tono profesional de los textos fijos**

En `src/app/page.tsx`, aplicar estos reemplazos exactos de strings:

1. Saludo inicial:
   - De: `` texto: `Hola ${perfil.nombre} 👋 ¿Qué gasto registramos hoy?`, ``
   - A: `` texto: `Hola ${perfil.nombre}. ¿Qué gasto vas a registrar?`, ``

2. Confirmación de guardado (dentro de `onConfirmar`):
   - De: `texto: "✅ Gasto registrado." `
   - A: `texto: "Gasto registrado correctamente."`

3. Cancelación (`onCancelar`):
   - De: `agregarBot("Listo, lo descarté. ¿Registramos otro?");`
   - A: `agregarBot("Gasto descartado. ¿Registramos otro?");`

4. "Otro sí" (`onOtroSi`):
   - De: `texto: "Dale 👍 Cuéntame el siguiente o adjunta la boleta."`
   - A: `texto: "Perfecto. Indícame el siguiente gasto o adjunta la boleta."`

5. "Otro no" (`onOtroNo`):
   - De: `texto: "Perfecto, ¡gracias! Cuando quieras registrar otro, escríbeme."`
   - A: `texto: "Listo. Cuando necesites registrar otro gasto, escríbeme."`

(Los demás textos como "¿Deseas registrar otro?" y los mensajes de error ya están en tono adecuado.)

- [ ] **Step 5: Verificar tipos y build de tests**

Run: `npx tsc --noEmit`
Expected: Sin errores.

Run: `npx vitest run`
Expected: PASS (213+ tests, incluyendo los nuevos de `claude`/`extraccion`).

- [ ] **Step 6: Verificación manual (smoke test)**

Run: `npm run dev` y abrir el chat. Verificar manualmente:
- Escribir "hola" → el bot responde cordial y pide el primer dato del gasto (intención saludo/fuera_de_tema, reencauza).
- Escribir "¿qué hora es?" → reconoce brevemente y reencauza al gasto.
- "gasté 45 mil en bencina en Copec hoy" → captura datos, pide lo que falte o muestra la tarjeta; sin eco repetitivo.
- Corregir ("no, eran 50 mil") → confirma el cambio en una frase corta.
- Adjuntar una factura emitida a otra empresa → "La factura no corresponde…" (path `rechazo` intacto).

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(chat): el chat usa el mensaje del LLM y tono profesional"
```

---

## Notas de verificación final

- Suite completa: `npx vitest run` (todo verde).
- Tipos: `npx tsc --noEmit` (sin errores).
- El path de **factura no corresponde** sigue funcionando (probado en Task 5, Step 6).
- Si la calidad del reencauce no convence en uso real, subir `MODELO` a `claude-sonnet-4-6` en `src/lib/claude.ts` (única línea).
