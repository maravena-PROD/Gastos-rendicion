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
