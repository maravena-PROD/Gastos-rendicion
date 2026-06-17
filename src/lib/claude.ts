import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIAS } from "./types";
import { normalizarCategoria, type ExtraccionGasto } from "./extraccion";

// OCR + extracción estructurada de boletas. Haiku 4.5 es ~5x más barato que
// Opus y suficiente para esta tarea; soporta visión y output_config.format.
// Si la precisión baja en boletas difíciles, subir a "claude-sonnet-4-6".
const MODELO = "claude-haiku-4-5";

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
  if (!bloque?.text) {
    throw new Error("Claude no devolvió contenido de texto para parsear");
  }
  const datos = JSON.parse(bloque.text);
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

/** Contexto conversacional para interpretar un mensaje de texto en curso. */
export interface ContextoTexto {
  /** Datos del gasto ya capturados (para combinar con lo nuevo). */
  borrador?: ExtraccionGasto;
  /** Campo que el bot acaba de preguntar (ej. "comercio"), o null. */
  campoPreguntado?: string | null;
  /** Fecha de hoy en formato AAAA-MM-DD (zona Chile), para fechas relativas. */
  hoy?: string;
}

/** Resume los campos ya capturados (no-null) del borrador para el prompt. */
function resumenBorrador(b?: ExtraccionGasto): string {
  if (!b) return "ninguno";
  const pares = Object.entries(b).filter(([, v]) => v !== null && v !== undefined);
  return pares.length ? pares.map(([k, v]) => `${k}: ${v}`).join(", ") : "ninguno";
}

/**
 * Extrae los datos de un gasto a partir de texto libre. Si se entrega contexto
 * (borrador, campo preguntado, fecha de hoy), interpreta el mensaje como parte
 * de una conversación en curso: mapea respuestas cortas al campo preguntado y
 * resuelve fechas relativas. Sin contexto, se comporta como extracción simple.
 */
export async function extraerDeTexto(
  texto: string,
  contexto?: ContextoTexto,
): Promise<ExtraccionGasto> {
  const contenido = contexto
    ? [
        "Contexto de la conversación:",
        contexto.hoy ? `- Hoy es ${contexto.hoy} (zona horaria de Chile).` : null,
        `- Datos del gasto ya capturados: ${resumenBorrador(contexto.borrador)}.`,
        contexto.campoPreguntado
          ? `- Le preguntaste al usuario por el campo: ${contexto.campoPreguntado}.`
          : null,
        "",
        "Mensaje del usuario:",
        texto,
        "",
        "Devuelve el gasto combinando lo ya capturado con lo que aporte este mensaje. Si le preguntaste por un campo, interpreta el mensaje como la respuesta a ese campo (ej. una sola palabra como nombre del comercio, o un número como el monto). Resuelve fechas relativas (ayer, hoy, el lunes pasado) usando la fecha de hoy indicada. No inventes datos que no aparezcan en el mensaje ni en lo ya capturado.",
      ]
        .filter(Boolean)
        .join("\n")
    : texto;

  const params = {
    model: MODELO,
    max_tokens: 1024,
    system: SYSTEM_EXTRACCION,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user" as const, content: contenido }],
  };
  // output_config no está en MessageCreateParams base; cast local para la llamada.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await getCliente().messages.create(params as any);
  return parseExtraccion(res as never);
}

/** Extrae los datos de un gasto a partir de una imagen de boleta (visión = OCR). */
export async function extraerDeImagen(
  base64: string,
  mediaType: "image/jpeg" | "image/png",
): Promise<ExtraccionGasto> {
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
          { type: "text" as const, text: "Extrae los datos de esta boleta o factura." },
        ],
      },
    ],
  };
  // output_config no está en MessageCreateParams base; cast local para la llamada.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await getCliente().messages.create(params as any);
  return parseExtraccion(res as never);
}
