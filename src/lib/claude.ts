import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIAS } from "./types";
import {
  normalizarCategoria,
  normalizarTipoDocumento,
  normalizarIntencion,
  type ExtraccionGasto,
  type RespuestaConversacion,
} from "./extraccion";

// OCR + extracción estructurada de boletas. Haiku 4.5 es ~5x más barato que
// Opus y suficiente para esta tarea; soporta visión y output_config.format.
// Si la precisión baja en boletas difíciles, subir a "claude-sonnet-4-6".
const MODELO = "claude-haiku-4-5";

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
    tipoDocumento: { type: ["string", "null"] },
    montoNeto: { type: ["integer", "null"] },
    iva: { type: ["integer", "null"] },
    rutReceptor: { type: ["string", "null"] },
    razonSocialReceptor: { type: ["string", "null"] },
    mensaje: { type: "string" },
    intencion: { type: "string", enum: ["gasto", "saludo", "correccion", "fuera_de_tema", "otro"] },
  },
  required: [
    "comercio",
    "monto",
    "fechaDocumento",
    "categoria",
    "rutEmisor",
    "numeroDocumento",
    "direccion",
    "tipoDocumento",
    "montoNeto",
    "iva",
    "rutReceptor",
    "razonSocialReceptor",
    "mensaje",
    "intencion",
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
): Promise<RespuestaConversacion> {
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
  return parseRespuesta(res as never);
}

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
