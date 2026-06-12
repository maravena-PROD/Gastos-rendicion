# Plan 3 — Backend: servicios Claude + Drive y rutas API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el backend del registro de gastos: extracción de datos desde texto y desde foto de boleta con Claude (visión nativa como OCR), subida de imágenes a Google Drive, lógica conversacional pura (qué datos faltan y qué preguntar), validación de archivos, y las rutas API protegidas que lo exponen (`/api/upload`, `/api/extraer`, `/api/gastos`).

**Architecture:** La inteligencia (extracción + clasificación) usa la API de Claude (`claude-opus-4-8`) con salida estructurada (JSON schema); la foto va directo a Claude (visión), sin motor de OCR aparte. La lógica conversacional (campos faltantes, siguiente pregunta, fusión de respuestas) y la validación de archivos son **funciones puras testeables**. Los servicios externos (Claude, Drive) son pegamento delgado probado con el SDK mockeado. Las rutas reusan el guard de autenticación del Plan 2 (`autenticar` + `getBearerToken`) y aplican filtrado por rol.

**Tech Stack:** Next.js 16 (App Router), TypeScript, `@anthropic-ai/sdk` (Claude), `googleapis` (Drive), Vitest. Reusa Plan 1 (`types.ts`, `sheets.ts`, `gasto-factory.ts`, `format.ts`) y Plan 2 (`auth.ts`, `auth-server.ts`).

---

## Estructura de archivos (Plan 3)

| Archivo | Responsabilidad |
|---|---|
| `src/lib/extraccion.ts` | Tipo `ExtraccionGasto` + lógica pura: `camposFaltantes`, `extraccionCompleta`, `siguientePregunta`, `fusionarExtraccion`, `normalizarCategoria` |
| `src/lib/extraccion.test.ts` | Pruebas de la lógica conversacional |
| `src/lib/validacion-archivo.ts` | `validarImagen` (magic bytes + tipo permitido + tamaño máx) |
| `src/lib/validacion-archivo.test.ts` | Pruebas de validación |
| `src/lib/claude.ts` | `extraerDeTexto`, `extraerDeImagen` (Claude visión), `parseExtraccion` |
| `src/lib/claude.test.ts` | Pruebas con `@anthropic-ai/sdk` mockeado |
| `src/lib/drive.ts` | `subirImagen` (sube a Drive + permiso de lectura, devuelve url+id) |
| `src/lib/drive.test.ts` | Pruebas con `googleapis` mockeado |
| `src/lib/gastos-rol.ts` | `filtrarGastosPorRol` (admin ve todos, usuario solo los suyos) |
| `src/lib/gastos-rol.test.ts` | Pruebas del filtrado por rol |
| `src/app/api/upload/route.ts` | POST: valida + sube imagen a Drive |
| `src/app/api/extraer/route.ts` | POST: texto o imagen → extracción + campos faltantes |
| `src/app/api/gastos/route.ts` | POST: crea gasto; GET: lista filtrada por rol |
| `.env.local.example` | Agregar `GOOGLE_DRIVE_FOLDER_ID` (modificación) |

---

## Task 0: Dependencias y variable de entorno

**Files:**
- Modify: `package.json` (vía npm install)
- Modify: `.env.local.example`

- [ ] **Step 1: Instalar el SDK de Anthropic**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Agregar la variable de la carpeta de Drive**

Agrega al final de `.env.local.example`:

```
# Google Drive — ID de la carpeta donde se guardan las imágenes de boletas
# (de la URL de la carpeta; compártela con la service account como Editor)
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

(`ANTHROPIC_API_KEY` ya está en la plantilla desde el Plan 1.)

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "chore: dependencia @anthropic-ai/sdk + env GOOGLE_DRIVE_FOLDER_ID"
```

---

## Task 1: Tipo de extracción y normalización de categoría

**Files:**
- Create: `src/lib/extraccion.ts`
- Test: `src/lib/extraccion.test.ts`

**Contexto:** `ExtraccionGasto` representa lo que Claude extrae (de texto o imagen): todos los
campos pueden ser `null` si no se detectaron. `normalizarCategoria` convierte un texto libre de
categoría en una `Categoria` válida o `null`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Create `src/lib/extraccion.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { normalizarCategoria } from "./extraccion";

describe("normalizarCategoria", () => {
  it("acepta una categoría válida exacta", () => {
    expect(normalizarCategoria("Combustible")).toBe("Combustible");
  });
  it("es tolerante a mayúsculas/minúsculas", () => {
    expect(normalizarCategoria("combustible")).toBe("Combustible");
  });
  it("devuelve null para texto no reconocido", () => {
    expect(normalizarCategoria("xyz")).toBeNull();
  });
  it("devuelve null para null o vacío", () => {
    expect(normalizarCategoria(null)).toBeNull();
    expect(normalizarCategoria("")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/extraccion.test.ts`
Expected: FAIL — "normalizarCategoria is not a function".

- [ ] **Step 3: Implementar el tipo y la normalización**

Create `src/lib/extraccion.ts`:

```ts
import type { Categoria } from "./types";
import { CATEGORIAS } from "./types";

/** Datos extraídos de un gasto (texto o imagen). null = no detectado. */
export interface ExtraccionGasto {
  comercio: string | null;
  monto: number | null; // entero CLP
  fechaDocumento: string | null; // YYYY-MM-DD
  categoria: Categoria | null;
  rutEmisor: string | null;
  numeroDocumento: string | null;
  direccion: string | null;
}

/** Convierte un texto de categoría a una Categoria válida, o null. */
export function normalizarCategoria(valor: string | null): Categoria | null {
  if (!valor) return null;
  const limpio = valor.trim().toLowerCase();
  const match = CATEGORIAS.find((c) => c.toLowerCase() === limpio);
  return match ?? null;
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/extraccion.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/extraccion.ts src/lib/extraccion.test.ts
git commit -m "feat: tipo ExtraccionGasto + normalizarCategoria con tests"
```

---

## Task 2: Lógica conversacional pura

**Files:**
- Modify: `src/lib/extraccion.ts`
- Modify: `src/lib/extraccion.test.ts`

**Contexto:** El bot no es de reglas rígidas para extraer, pero sí lo es para **decidir qué falta
y qué preguntar** — eso lo hacemos con funciones puras testeables. Campos esenciales (sin ellos no
se puede registrar): `comercio`, `monto`, `categoria`, `fechaDocumento`. `fusionarExtraccion`
combina una extracción previa con datos nuevos (los nuevos no-null ganan), para ir completando el
gasto a lo largo de la conversación.

- [ ] **Step 1: Agregar las pruebas que fallan**

Agrega al final de `src/lib/extraccion.test.ts`:

```ts
import {
  camposFaltantes,
  extraccionCompleta,
  siguientePregunta,
  fusionarExtraccion,
  type ExtraccionGasto,
} from "./extraccion";

const vacia: ExtraccionGasto = {
  comercio: null,
  monto: null,
  fechaDocumento: null,
  categoria: null,
  rutEmisor: null,
  numeroDocumento: null,
  direccion: null,
};

const completa: ExtraccionGasto = {
  ...vacia,
  comercio: "Copec",
  monto: 45000,
  fechaDocumento: "2026-06-10",
  categoria: "Combustible",
};

describe("camposFaltantes", () => {
  it("lista los 4 esenciales cuando está vacía", () => {
    expect(camposFaltantes(vacia)).toEqual([
      "comercio",
      "monto",
      "categoria",
      "fechaDocumento",
    ]);
  });
  it("no incluye los campos ya presentes", () => {
    expect(camposFaltantes({ ...vacia, monto: 45000 })).toEqual([
      "comercio",
      "categoria",
      "fechaDocumento",
    ]);
  });
  it("devuelve [] cuando están todos los esenciales", () => {
    expect(camposFaltantes(completa)).toEqual([]);
  });
  it("ignora campos opcionales (rut, dirección, etc.)", () => {
    expect(camposFaltantes(completa)).toEqual([]);
  });
});

describe("extraccionCompleta", () => {
  it("true cuando no falta ningún esencial", () => {
    expect(extraccionCompleta(completa)).toBe(true);
  });
  it("false cuando falta alguno", () => {
    expect(extraccionCompleta(vacia)).toBe(false);
  });
});

describe("siguientePregunta", () => {
  it("pregunta por el primer campo faltante", () => {
    expect(siguientePregunta(vacia)).toContain("comercio");
  });
  it("pregunta por el monto si solo falta eso", () => {
    const q = siguientePregunta({ ...completa, monto: null });
    expect(q).toContain("monto");
  });
  it("devuelve null cuando no falta nada", () => {
    expect(siguientePregunta(completa)).toBeNull();
  });
});

describe("fusionarExtraccion", () => {
  it("los datos nuevos no-null sobreescriben a la base", () => {
    const r = fusionarExtraccion({ ...vacia, comercio: "Copec" }, { ...vacia, monto: 45000 });
    expect(r.comercio).toBe("Copec");
    expect(r.monto).toBe(45000);
  });
  it("un null nuevo NO borra un valor existente", () => {
    const r = fusionarExtraccion({ ...vacia, comercio: "Copec" }, vacia);
    expect(r.comercio).toBe("Copec");
  });
  it("un valor nuevo gana sobre uno previo", () => {
    const r = fusionarExtraccion({ ...vacia, comercio: "Copec" }, { ...vacia, comercio: "Shell" });
    expect(r.comercio).toBe("Shell");
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/extraccion.test.ts`
Expected: FAIL — "camposFaltantes is not a function".

- [ ] **Step 3: Implementar la lógica conversacional**

Agrega al final de `src/lib/extraccion.ts`:

```ts
/** Campos esenciales para poder registrar un gasto, en orden de pregunta. */
const ESENCIALES = ["comercio", "monto", "categoria", "fechaDocumento"] as const;
type CampoEsencial = (typeof ESENCIALES)[number];

const PREGUNTAS: Record<CampoEsencial, string> = {
  comercio: "¿En qué comercio fue el gasto?",
  monto: "¿Cuál es el monto del gasto?",
  categoria:
    "¿Qué categoría es? (Combustible, Alimentación, Transporte, Peajes, Hospedaje, Materiales, Servicios, Otros)",
  fechaDocumento: "¿Cuál es la fecha del documento? (formato AAAA-MM-DD)",
};

/** Lista los campos esenciales que faltan (están en null), en orden. */
export function camposFaltantes(e: ExtraccionGasto): CampoEsencial[] {
  return ESENCIALES.filter((campo) => e[campo] === null);
}

/** true si no falta ningún campo esencial. */
export function extraccionCompleta(e: ExtraccionGasto): boolean {
  return camposFaltantes(e).length === 0;
}

/** Devuelve la pregunta por el primer campo faltante, o null si está completa. */
export function siguientePregunta(e: ExtraccionGasto): string | null {
  const faltantes = camposFaltantes(e);
  return faltantes.length > 0 ? PREGUNTAS[faltantes[0]] : null;
}

/**
 * Combina una extracción base con datos nuevos. Los valores no-null de `nueva`
 * sobreescriben a `base`; un null en `nueva` conserva el valor de `base`.
 */
export function fusionarExtraccion(
  base: ExtraccionGasto,
  nueva: ExtraccionGasto,
): ExtraccionGasto {
  const claves = Object.keys(base) as (keyof ExtraccionGasto)[];
  const resultado = { ...base };
  for (const k of claves) {
    if (nueva[k] !== null && nueva[k] !== undefined) {
      // @ts-expect-error asignación campo a campo entre uniones compatibles
      resultado[k] = nueva[k];
    }
  }
  return resultado;
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/extraccion.test.ts`
Expected: PASS — todas las pruebas de extracción pasan.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/extraccion.ts src/lib/extraccion.test.ts
git commit -m "feat: lógica conversacional pura (camposFaltantes, siguientePregunta, fusionar)"
```

---

## Task 3: Validación de archivos (magic bytes)

**Files:**
- Create: `src/lib/validacion-archivo.ts`
- Test: `src/lib/validacion-archivo.test.ts`

**Contexto:** Seguridad (Sección 5 del spec): validar el **tipo real** del archivo por sus magic
bytes (no por la extensión), solo permitir JPG/PNG/PDF, y limitar el tamaño. `validarImagen` recibe
el buffer y devuelve el tipo MIME real detectado o un error.

- [ ] **Step 1: Escribir las pruebas que fallan**

Create `src/lib/validacion-archivo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { validarImagen, TAMANO_MAX_BYTES } from "./validacion-archivo";

// Magic bytes mínimos de cada formato
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
const BASURA = Buffer.from([0x00, 0x01, 0x02, 0x03]);

describe("validarImagen", () => {
  it("acepta JPG y devuelve image/jpeg", () => {
    expect(validarImagen(JPG)).toEqual({ ok: true, mimeType: "image/jpeg" });
  });
  it("acepta PNG y devuelve image/png", () => {
    expect(validarImagen(PNG)).toEqual({ ok: true, mimeType: "image/png" });
  });
  it("acepta PDF y devuelve application/pdf", () => {
    expect(validarImagen(PDF)).toEqual({ ok: true, mimeType: "application/pdf" });
  });
  it("rechaza un tipo no permitido (magic bytes desconocidos)", () => {
    const r = validarImagen(BASURA);
    expect(r.ok).toBe(false);
  });
  it("rechaza un archivo que excede el tamaño máximo", () => {
    const grande = Buffer.concat([JPG, Buffer.alloc(TAMANO_MAX_BYTES)]);
    const r = validarImagen(grande);
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/validacion-archivo.test.ts`
Expected: FAIL — "validarImagen is not a function".

- [ ] **Step 3: Implementar la validación**

Create `src/lib/validacion-archivo.ts`:

```ts
/** Tamaño máximo permitido para una imagen/boleta (10 MB). */
export const TAMANO_MAX_BYTES = 10 * 1024 * 1024;

export type ResultadoValidacion =
  | { ok: true; mimeType: "image/jpeg" | "image/png" | "application/pdf" }
  | { ok: false; motivo: string };

/** ¿El buffer empieza con esta firma de bytes? */
function empiezaCon(buf: Buffer, firma: number[]): boolean {
  if (buf.length < firma.length) return false;
  return firma.every((b, i) => buf[i] === b);
}

/**
 * Valida una imagen por sus magic bytes (no por la extensión) y su tamaño.
 * Solo permite JPG, PNG y PDF.
 */
export function validarImagen(buf: Buffer): ResultadoValidacion {
  if (buf.length > TAMANO_MAX_BYTES) {
    return { ok: false, motivo: "El archivo supera el tamaño máximo de 10 MB" };
  }
  if (empiezaCon(buf, [0xff, 0xd8, 0xff])) {
    return { ok: true, mimeType: "image/jpeg" };
  }
  if (empiezaCon(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, mimeType: "image/png" };
  }
  if (empiezaCon(buf, [0x25, 0x50, 0x44, 0x46])) {
    return { ok: true, mimeType: "application/pdf" };
  }
  return { ok: false, motivo: "Tipo de archivo no permitido (solo JPG, PNG o PDF)" };
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/validacion-archivo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validacion-archivo.ts src/lib/validacion-archivo.test.ts
git commit -m "feat: validarImagen por magic bytes + límite de tamaño con tests"
```

---

## Task 4: Servicio Claude (extracción texto + visión)

**Files:**
- Create: `src/lib/claude.ts`
- Test: `src/lib/claude.test.ts`

**Contexto:** El cerebro del bot. `extraerDeTexto` y `extraerDeImagen` mandan el contenido a
Claude (`claude-opus-4-8`) con un system prompt chileno y salida estructurada (JSON schema), y
devuelven un `ExtraccionGasto`. La foto va directo a Claude (visión nativa = OCR). `parseExtraccion`
toma la respuesta cruda y la mapea (normaliza categoría, coacciona monto a entero o null). En las
pruebas se mockea `@anthropic-ai/sdk`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Create `src/lib/claude.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del SDK de Anthropic: capturamos messages.create
const messagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = { create: (...a: unknown[]) => messagesCreate(...a) };
    },
  };
});

import { extraerDeTexto, extraerDeImagen } from "./claude";

function respuestaConJson(obj: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(obj) }] };
}

beforeEach(() => {
  messagesCreate.mockReset();
  process.env.ANTHROPIC_API_KEY = "sk-test";
});

describe("extraerDeTexto", () => {
  it("mapea la respuesta de Claude a ExtraccionGasto", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Copec",
        monto: 45000,
        fechaDocumento: "2026-06-10",
        categoria: "Combustible",
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
      }),
    );
    const r = await extraerDeTexto("combustible 45000 en Copec");
    expect(r.comercio).toBe("Copec");
    expect(r.monto).toBe(45000);
    expect(r.categoria).toBe("Combustible");
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("normaliza una categoría no canónica y deja null lo no detectado", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Copec",
        monto: 45000,
        fechaDocumento: null,
        categoria: "combustible", // minúscula
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
      }),
    );
    const r = await extraerDeTexto("x");
    expect(r.categoria).toBe("Combustible");
    expect(r.fechaDocumento).toBeNull();
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
      }),
    );
    const r = await extraerDeTexto("x");
    expect(r.monto).toBeNull();
  });
});

describe("extraerDeImagen", () => {
  it("incluye un bloque de imagen en el mensaje y mapea la respuesta", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Shell",
        monto: 30000,
        fechaDocumento: "2026-06-09",
        categoria: "Combustible",
        rutEmisor: "76.543.219-7",
        numeroDocumento: "0012345",
        direccion: null,
      }),
    );
    const r = await extraerDeImagen("BASE64DATA", "image/jpeg");
    expect(r.comercio).toBe("Shell");
    expect(r.rutEmisor).toBe("76.543.219-7");
    // verifica que se mandó un bloque de imagen
    const arg = messagesCreate.mock.calls[0][0] as {
      messages: { content: Array<{ type: string }> }[];
    };
    const tipos = arg.messages[0].content.map((c) => c.type);
    expect(tipos).toContain("image");
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/claude.test.ts`
Expected: FAIL — "extraerDeTexto is not a function".

- [ ] **Step 3: Implementar el servicio Claude**

Create `src/lib/claude.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIAS } from "./types";
import { normalizarCategoria, type ExtraccionGasto } from "./extraccion";

const MODELO = "claude-opus-4-8";

const SYSTEM_EXTRACCION = `Eres un asistente de rendición de gastos para una empresa chilena.
Tu tarea es extraer los datos de un gasto a partir de texto o de una foto de boleta/factura.

Categorías válidas (elige la más adecuada): ${CATEGORIAS.join(", ")}.

Reglas:
- "monto" es un entero en pesos chilenos (CLP), sin puntos de miles ni decimales (45000, no "45.000").
- "fechaDocumento" en formato AAAA-MM-DD.
- "rutEmisor" con formato chileno (ej. 76.543.219-7) si aparece.
- Si un dato no aparece o no estás seguro, devuelve null. NUNCA inventes datos.`;

/** JSON schema de la extracción (todos los campos nullable). */
const SCHEMA = {
  type: "object",
  properties: {
    comercio: { type: ["string", "null"] },
    monto: { type: ["integer", "null"] },
    fechaDocumento: { type: ["string", "null"] },
    categoria: { type: ["string", "null"] },
    rutEmisor: { type: ["string", "null"] },
    numeroDocumento: { type: ["string", "null"] },
    direccion: { type: ["string", "null"] },
  },
  required: [
    "comercio",
    "monto",
    "fechaDocumento",
    "categoria",
    "rutEmisor",
    "numeroDocumento",
    "direccion",
  ],
  additionalProperties: false,
} as const;

let clienteCache: Anthropic | null = null;
function getCliente(): Anthropic {
  if (!clienteCache) clienteCache = new Anthropic();
  return clienteCache;
}

/** Coacciona un valor a entero CLP, o null si no es un número finito. */
function aMontoEntero(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Toma la respuesta cruda de Claude y la mapea a ExtraccionGasto. */
export function parseExtraccion(res: { content: Array<{ type: string; text?: string }> }): ExtraccionGasto {
  const bloque = res.content.find((c) => c.type === "text");
  const datos = bloque?.text ? JSON.parse(bloque.text) : {};
  return {
    comercio: datos.comercio ?? null,
    monto: aMontoEntero(datos.monto),
    fechaDocumento: datos.fechaDocumento ?? null,
    categoria: normalizarCategoria(datos.categoria ?? null),
    rutEmisor: datos.rutEmisor ?? null,
    numeroDocumento: datos.numeroDocumento ?? null,
    direccion: datos.direccion ?? null,
  };
}

/** Extrae los datos de un gasto a partir de texto libre. */
export async function extraerDeTexto(texto: string): Promise<ExtraccionGasto> {
  const res = await getCliente().messages.create({
    model: MODELO,
    max_tokens: 1024,
    system: SYSTEM_EXTRACCION,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: texto }],
  });
  return parseExtraccion(res as never);
}

/** Extrae los datos de un gasto a partir de una imagen de boleta (visión = OCR). */
export async function extraerDeImagen(
  base64: string,
  mediaType: "image/jpeg" | "image/png",
): Promise<ExtraccionGasto> {
  const res = await getCliente().messages.create({
    model: MODELO,
    max_tokens: 1024,
    system: SYSTEM_EXTRACCION,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Extrae los datos de esta boleta o factura." },
        ],
      },
    ],
  });
  return parseExtraccion(res as never);
}
```

NOTE para el implementador: si TypeScript se queja del tipo de `output_config` o del retorno de
`messages.create` contra el SDK, NO lo fuerces con `any` de forma amplia. El `as never` puntual en
`parseExtraccion(res as never)` es aceptable para desacoplar del tipo exacto del SDK en estas dos
llamadas. Si `output_config` no existe en los tipos del SDK instalado, repórtalo (puede requerir
pasarlo vía un cast del objeto de parámetros) en vez de inventar otra API.

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/claude.test.ts`
Expected: PASS — las pruebas de extracción (texto + imagen) pasan.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/claude.ts src/lib/claude.test.ts
git commit -m "feat: claude.ts extracción texto + visión con salida estructurada (tests mockeados)"
```

---

## Task 5: Servicio Drive (subida de imágenes)

**Files:**
- Create: `src/lib/drive.ts`
- Test: `src/lib/drive.test.ts`

**Contexto:** `subirImagen` sube un buffer a la carpeta de Drive configurada, le da permiso de
lectura pública (link compartido) y devuelve `{ id, url }`. Reusa la service account (mismas env
vars que Sheets). Se prueba con `googleapis` mockeado.

- [ ] **Step 1: Escribir las pruebas que fallan**

Create `src/lib/drive.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const filesCreate = vi.fn();
const permissionsCreate = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: class { constructor(_o: unknown) {} } },
    drive: () => ({
      files: { create: (...a: unknown[]) => filesCreate(...a) },
      permissions: { create: (...a: unknown[]) => permissionsCreate(...a) },
    }),
  },
}));

import { subirImagen } from "./drive";

beforeEach(() => {
  filesCreate.mockReset();
  permissionsCreate.mockReset();
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@test.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = "fake";
  process.env.GOOGLE_DRIVE_FOLDER_ID = "folder-123";
});

describe("subirImagen", () => {
  it("sube el archivo, lo hace legible y devuelve id + url", async () => {
    filesCreate.mockResolvedValue({ data: { id: "file-abc" } });
    permissionsCreate.mockResolvedValue({});
    const r = await subirImagen(Buffer.from("x"), "image/jpeg", "boleta.jpg");
    expect(r.id).toBe("file-abc");
    expect(r.url).toContain("file-abc");
    expect(filesCreate).toHaveBeenCalledTimes(1);
    expect(permissionsCreate).toHaveBeenCalledTimes(1);
    // se subió a la carpeta configurada
    const arg = filesCreate.mock.calls[0][0] as {
      requestBody: { parents: string[]; name: string };
    };
    expect(arg.requestBody.parents).toEqual(["folder-123"]);
    expect(arg.requestBody.name).toBe("boleta.jpg");
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/drive.test.ts`
Expected: FAIL — "subirImagen is not a function".

- [ ] **Step 3: Implementar el servicio Drive**

Create `src/lib/drive.ts`:

```ts
import { google } from "googleapis";
import { Readable } from "stream";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      private_key: getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  });
  return google.drive({ version: "v3", auth });
}

/**
 * Sube una imagen a la carpeta de Drive configurada, le da permiso de lectura
 * (link compartido) y devuelve el id del archivo y su URL pública.
 */
export async function subirImagen(
  buffer: Buffer,
  mimeType: string,
  nombre: string,
): Promise<{ id: string; url: string }> {
  const drive = getDriveClient();
  const creado = await drive.files.create({
    requestBody: { name: nombre, parents: [getEnv("GOOGLE_DRIVE_FOLDER_ID")] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id",
  });
  const id = creado.data.id;
  if (!id) throw new Error("Drive no devolvió un id de archivo");
  await drive.permissions.create({
    fileId: id,
    requestBody: { role: "reader", type: "anyone" },
  });
  return { id, url: `https://drive.google.com/file/d/${id}/view` };
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/drive.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/drive.ts src/lib/drive.test.ts
git commit -m "feat: drive.ts subirImagen (Drive + permiso de lectura) con tests"
```

---

## Task 6: Filtrado de gastos por rol

**Files:**
- Create: `src/lib/gastos-rol.ts`
- Test: `src/lib/gastos-rol.test.ts`

**Contexto:** Regla de negocio del Plan 2/spec: un `Administrador` ve todos los gastos; un
`Usuario` solo los suyos. Función pura testeable que usará la ruta GET `/api/gastos`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Create `src/lib/gastos-rol.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filtrarGastosPorRol } from "./gastos-rol";
import type { Gasto } from "./types";
import type { SesionUsuario } from "./auth";

function gasto(email: string, id: string): Gasto {
  return {
    id,
    fechaRegistro: "",
    usuarioEmail: email,
    usuarioNombre: "",
    fechaDocumento: "",
    comercio: "",
    rutEmisor: "",
    numeroDocumento: "",
    categoria: "Otros",
    monto: 1000,
    direccion: "",
    observacion: "",
    imagenUrl: "",
    imagenDriveId: "",
    estado: "Registrado",
    fechaCreacion: "",
  };
}

const gastos: Gasto[] = [
  gasto("maravena@bosca.cl", "g1"),
  gasto("otro@bosca.cl", "g2"),
  gasto("maravena@bosca.cl", "g3"),
];

describe("filtrarGastosPorRol", () => {
  it("un Administrador ve todos los gastos", () => {
    const admin: SesionUsuario = { email: "jefe@bosca.cl", nombre: "Jefe", rol: "Administrador" };
    expect(filtrarGastosPorRol(gastos, admin)).toHaveLength(3);
  });
  it("un Usuario ve solo sus gastos (match por email, case-insensitive)", () => {
    const usuario: SesionUsuario = { email: "MARAVENA@bosca.cl", nombre: "M", rol: "Usuario" };
    const r = filtrarGastosPorRol(gastos, usuario);
    expect(r.map((g) => g.id)).toEqual(["g1", "g3"]);
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/gastos-rol.test.ts`
Expected: FAIL — "filtrarGastosPorRol is not a function".

- [ ] **Step 3: Implementar el filtrado**

Create `src/lib/gastos-rol.ts`:

```ts
import type { Gasto } from "./types";
import type { SesionUsuario } from "./auth";

/**
 * Filtra los gastos según el rol: Administrador ve todos; Usuario solo los
 * suyos (comparación de email case-insensitive).
 */
export function filtrarGastosPorRol(gastos: Gasto[], sesion: SesionUsuario): Gasto[] {
  if (sesion.rol === "Administrador") return gastos;
  const email = sesion.email.toLowerCase();
  return gastos.filter((g) => g.usuarioEmail.toLowerCase() === email);
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/gastos-rol.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gastos-rol.ts src/lib/gastos-rol.test.ts
git commit -m "feat: filtrarGastosPorRol (admin ve todo, usuario solo lo suyo) con tests"
```

---

## Task 7: Ruta `/api/upload`

**Files:**
- Create: `src/app/api/upload/route.ts`

**Contexto:** Recibe una imagen (base64) de una boleta, autentica, valida por magic bytes y la sube
a Drive. Devuelve `{ id, url }`. Es el primer endpoint que combina el guard de auth (Plan 2) con un
servicio del Plan 3.

- [ ] **Step 1: Implementar la ruta**

Create `src/app/api/upload/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { validarImagen } from "@/lib/validacion-archivo";
import { subirImagen } from "@/lib/drive";

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  let body: { base64?: string; nombre?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body.base64) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  }

  const buffer = Buffer.from(body.base64, "base64");
  const validacion = validarImagen(buffer);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.motivo }, { status: 400 });
  }

  const ext = validacion.mimeType === "application/pdf" ? "pdf" : validacion.mimeType.split("/")[1];
  const nombre = body.nombre ?? `boleta-${Date.now()}.${ext}`;
  try {
    const { id, url } = await subirImagen(buffer, validacion.mimeType, nombre);
    return NextResponse.json({ id, url });
  } catch {
    return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "feat: ruta /api/upload (auth + validación magic bytes + Drive)"
```

---

## Task 8: Ruta `/api/extraer`

**Files:**
- Create: `src/app/api/extraer/route.ts`

**Contexto:** Recibe texto **o** imagen, autentica, llama a Claude (`extraerDeTexto` o
`extraerDeImagen`) y devuelve la extracción + los campos esenciales que faltan (para que el bot
sepa qué preguntar). Para imagen valida primero por magic bytes (solo JPG/PNG van a visión).

- [ ] **Step 1: Implementar la ruta**

Create `src/app/api/extraer/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { extraerDeTexto, extraerDeImagen } from "@/lib/claude";
import { camposFaltantes } from "@/lib/extraccion";
import { validarImagen } from "@/lib/validacion-archivo";

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  let body: { texto?: string; base64?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  try {
    if (body.base64) {
      const buffer = Buffer.from(body.base64, "base64");
      const v = validarImagen(buffer);
      if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 });
      if (v.mimeType === "application/pdf") {
        return NextResponse.json(
          { error: "Para extracción por imagen usa JPG o PNG" },
          { status: 400 },
        );
      }
      const extraccion = await extraerDeImagen(body.base64, v.mimeType);
      return NextResponse.json({ extraccion, faltantes: camposFaltantes(extraccion) });
    }
    if (body.texto) {
      const extraccion = await extraerDeTexto(body.texto);
      return NextResponse.json({ extraccion, faltantes: camposFaltantes(extraccion) });
    }
    return NextResponse.json({ error: "Envía texto o imagen" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar con el asistente" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/extraer/route.ts
git commit -m "feat: ruta /api/extraer (texto o imagen → extracción + campos faltantes)"
```

---

## Task 9: Ruta `/api/gastos` (crear + listar)

**Files:**
- Create: `src/app/api/gastos/route.ts`

**Contexto:** `POST` crea un gasto (autentica, arma el `Gasto` con `crearGasto` usando los datos de
la sesión + el cuerpo, y lo escribe con `appendGasto`). `GET` lista los gastos filtrados por rol
(`filtrarGastosPorRol`). El cuerpo del POST trae los campos confirmados por el usuario (comercio,
monto, categoría, fecha, y opcionales rut/numero/dirección/observación/imagen).

- [ ] **Step 1: Implementar la ruta**

Create `src/app/api/gastos/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos, appendGasto } from "@/lib/sheets";
import { crearGasto } from "@/lib/gasto-factory";
import { filtrarGastosPorRol } from "@/lib/gastos-rol";
import { normalizarCategoria } from "@/lib/extraccion";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  try {
    const todos = await listGastos();
    const visibles = filtrarGastosPorRol(todos, auth.usuario);
    return NextResponse.json({ gastos: visibles });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer los gastos" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  let body: {
    comercio?: string;
    monto?: number;
    categoria?: string;
    fechaDocumento?: string;
    rutEmisor?: string;
    numeroDocumento?: string;
    direccion?: string;
    observacion?: string;
    imagenUrl?: string;
    imagenDriveId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const categoria = normalizarCategoria(body.categoria ?? null);
  if (!body.comercio || typeof body.monto !== "number" || !categoria || !body.fechaDocumento) {
    return NextResponse.json(
      { error: "Faltan datos esenciales (comercio, monto, categoría, fecha)" },
      { status: 400 },
    );
  }

  const gasto = crearGasto({
    usuarioEmail: auth.usuario.email,
    usuarioNombre: auth.usuario.nombre,
    comercio: body.comercio,
    monto: body.monto,
    categoria,
    fechaDocumento: body.fechaDocumento,
    rutEmisor: body.rutEmisor,
    numeroDocumento: body.numeroDocumento,
    direccion: body.direccion,
    observacion: body.observacion,
    imagenUrl: body.imagenUrl,
    imagenDriveId: body.imagenDriveId,
  });

  try {
    await appendGasto(gasto);
    return NextResponse.json({ gasto }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el gasto" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verificar tipos, suite y build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc sin errores; toda la suite (Planes 1+2+3) en verde; `npm run build` compila.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/gastos/route.ts
git commit -m "feat: ruta /api/gastos (POST crea, GET lista filtrado por rol)"
```

---

## Self-Review (cobertura del Plan 3 vs spec)

- **OCR inteligente con visión de Claude (Secciones 3/10):** Task 4 (`extraerDeImagen`), Task 8
  (`/api/extraer`). Extrae monto, comercio, fecha, número de documento, dirección, RUT. ✅
- **Bot conversacional: pedir datos faltantes, validar antes de guardar (Sección 1):** Task 2
  (`camposFaltantes`/`siguientePregunta`), Task 8 devuelve `faltantes`; Task 9 valida esenciales
  antes de escribir. ✅ (La UI conversacional que usa esto es Plan 4.)
- **Clasificación automática en 8 categorías con corrección (Sección 4):** Task 1
  (`normalizarCategoria`), Task 4 (Claude clasifica; `/api/gastos` permite corregir la categoría
  en el cuerpo). ✅
- **Almacenamiento en Sheets en tiempo real (Sección 5):** Task 9 (`appendGasto` del Plan 1). ✅
- **Gestión de imágenes en Drive con URL + id (Sección 6):** Task 5 (`subirImagen`), Task 7
  (`/api/upload`); el id/url se guardan en el gasto (Task 9, campos `imagenUrl`/`imagenDriveId`). ✅
- **Seguridad: validación y protección de archivos (Sección 9):** Task 3 (magic bytes + tamaño),
  Task 7/8 (validan antes de subir/procesar); todas las rutas pasan por el guard de auth. ✅
- **Control de acceso por rol (Sección 7):** Task 6 (`filtrarGastosPorRol`), Task 9 GET. ✅
- **Lo que NO cubre el Plan 3 (correcto):** UI de chat/cámara/tarjeta de confirmación (Plan 4);
  dashboard (Plan 5); aprobación admin y voz (v2).

**Sin placeholders:** todo el código está completo. **Consistencia de tipos:** `ExtraccionGasto`,
`Categoria`, `SesionUsuario`, `Gasto` usados consistentemente; `crearGasto` (Plan 1) recibe el
`NuevoGastoInput` con los campos correctos; las rutas reusan `autenticar`/`getBearerToken` (Plan 2).

**Dependencia externa para correr de verdad (no para los tests):** las rutas necesitan
`ANTHROPIC_API_KEY`, la service account con acceso a Sheets+Drive, y `GOOGLE_DRIVE_FOLDER_ID`. Los
tests no lo requieren (SDK de Anthropic y googleapis mockeados). La configuración va en el Manual de
Instalación.
