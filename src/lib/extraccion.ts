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
