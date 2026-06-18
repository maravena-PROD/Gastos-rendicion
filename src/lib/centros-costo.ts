import type { CentroCostoEntry, Imputacion } from "./types";

export interface Opcion {
  codigo: string;
  detalle: string;
}

/** Quita repetidos por código, preservando el orden de aparición. */
function distintos(pares: Opcion[]): Opcion[] {
  const vistos = new Set<string>();
  const out: Opcion[] = [];
  for (const p of pares) {
    if (p.codigo && !vistos.has(p.codigo)) {
      vistos.add(p.codigo);
      out.push(p);
    }
  }
  return out;
}

export function centrosCosto(entries: CentroCostoEntry[]): Opcion[] {
  return distintos(entries.map((e) => ({ codigo: e.ccCodigo, detalle: e.ccDetalle })));
}

export function areasDe(entries: CentroCostoEntry[], ccCodigo: string): Opcion[] {
  return distintos(
    entries
      .filter((e) => e.ccCodigo === ccCodigo)
      .map((e) => ({ codigo: e.areaCodigo, detalle: e.areaDetalle })),
  );
}

export function ubicacionesDe(
  entries: CentroCostoEntry[],
  ccCodigo: string,
  areaCodigo: string,
): Opcion[] {
  return distintos(
    entries
      .filter((e) => e.ccCodigo === ccCodigo && e.areaCodigo === areaCodigo)
      .map((e) => ({ codigo: e.ubicacionCodigo, detalle: e.ubicacionDetalle })),
  );
}

export function resolverImputacion(
  entries: CentroCostoEntry[],
  ccCodigo: string,
  areaCodigo: string,
  ubicacionCodigo: string,
): Imputacion | null {
  const m = entries.find(
    (e) =>
      e.ccCodigo === ccCodigo &&
      e.areaCodigo === areaCodigo &&
      e.ubicacionCodigo === ubicacionCodigo,
  );
  if (!m) return null;
  return {
    centroCostoCodigo: m.ccCodigo,
    centroCostoDetalle: m.ccDetalle,
    areaCodigo: m.areaCodigo,
    areaDetalle: m.areaDetalle,
    ubicacionCodigo: m.ubicacionCodigo,
    ubicacionDetalle: m.ubicacionDetalle,
  };
}

/**
 * true si el usuario puede INGRESAR gastos en el centro de costo dado. El alcance
 * vacío o indefinido significa "todos" (compatibilidad con usuarios sin restricción);
 * "*" también es todos; en otro caso, debe estar el código exacto.
 */
export function puedeIngresarEnCc(ingresaCc: string[] | undefined, ccCodigo: string): boolean {
  if (!ingresaCc || ingresaCc.length === 0 || ingresaCc.includes("*")) return true;
  return ingresaCc.includes(ccCodigo);
}

/** Filtra el catálogo a los centros de costo donde el usuario puede ingresar. */
export function centrosPermitidos(
  entries: CentroCostoEntry[],
  ingresaCc: string[] | undefined,
): CentroCostoEntry[] {
  return entries.filter((e) => puedeIngresarEnCc(ingresaCc, e.ccCodigo));
}

export function esCombinacionValida(
  entries: CentroCostoEntry[],
  ccCodigo: string,
  areaCodigo: string,
  ubicacionCodigo: string,
): boolean {
  return resolverImputacion(entries, ccCodigo, areaCodigo, ubicacionCodigo) !== null;
}
