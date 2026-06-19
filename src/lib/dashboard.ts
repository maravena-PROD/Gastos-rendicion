import type { Gasto, Categoria } from "./types";

/** Filtra los gastos cuya fechaDocumento cae en el año-mes dado ("AAAA-MM"). */
export function filtrarPorMes(gastos: Gasto[], anioMes: string): Gasto[] {
  return gastos.filter((g) => g.fechaDocumento.startsWith(anioMes));
}

/** Suma total de los montos. */
export function totalGastos(gastos: Gasto[]): number {
  return gastos.reduce((acc, g) => acc + g.monto, 0);
}

/** Total agrupado por categoría, ordenado de mayor a menor. */
export function porCategoria(gastos: Gasto[]): { categoria: Categoria; total: number }[] {
  const mapa = new Map<Categoria, number>();
  for (const g of gastos) {
    mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + g.monto);
  }
  return [...mapa.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}

/** Total agrupado por usuario (nombre, o email si no hay nombre), de mayor a menor. */
export function porUsuario(gastos: Gasto[]): { usuario: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const g of gastos) {
    const clave = g.usuarioNombre || g.usuarioEmail;
    mapa.set(clave, (mapa.get(clave) ?? 0) + g.monto);
  }
  return [...mapa.entries()]
    .map(([usuario, total]) => ({ usuario, total }))
    .sort((a, b) => b.total - a.total);
}

/** Total por día (fechaDocumento), ordenado cronológicamente. */
export function tendenciaPorDia(gastos: Gasto[]): { fecha: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const g of gastos) {
    mapa.set(g.fechaDocumento, (mapa.get(g.fechaDocumento) ?? 0) + g.monto);
  }
  return [...mapa.entries()]
    .map(([fecha, total]) => ({ fecha, total }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Cuenta los gastos pendientes de aprobación (estado Registrado). */
export function contarPendientes(gastos: Gasto[]): number {
  return gastos.filter((g) => g.estado === "Registrado").length;
}

/** Año-meses presentes en los gastos (de fechaDocumento), de más reciente a más antiguo. */
export function mesesDisponibles(gastos: Gasto[]): string[] {
  const set = new Set<string>();
  for (const g of gastos) {
    if (g.fechaDocumento.length >= 7) set.add(g.fechaDocumento.slice(0, 7));
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}

/** Filtra los gastos cuya fechaDocumento cae en [desde, hasta] inclusivo (YYYY-MM-DD). */
export function filtrarPorRango(gastos: Gasto[], desde: string, hasta: string): Gasto[] {
  return gastos.filter((g) => g.fechaDocumento >= desde && g.fechaDocumento <= hasta);
}

/** Filtra los gastos cuya fechaDocumento cae en el año dado ("AAAA"). */
export function filtrarPorAnio(gastos: Gasto[], anio: string): Gasto[] {
  return gastos.filter((g) => g.fechaDocumento.startsWith(anio));
}

/** Años presentes en los gastos (de fechaDocumento), de más reciente a más antiguo. */
export function aniosDisponibles(gastos: Gasto[]): string[] {
  const set = new Set<string>();
  for (const g of gastos) {
    if (g.fechaDocumento.length >= 4) set.add(g.fechaDocumento.slice(0, 4));
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}

/** Un grupo de imputación (centro de costo, área o ubicación) con su total. */
export interface GrupoImputacion {
  codigo: string;
  detalle: string;
  total: number;
}

/** Las tres dimensiones de imputación por las que se puede agrupar o filtrar. */
export type DimensionImputacion = "centroCosto" | "area" | "ubicacion";

/** Selector de código y detalle de una dimensión de imputación. */
function selectorDimension(dim: DimensionImputacion): {
  codigoDe: (g: Gasto) => string;
  detalleDe: (g: Gasto) => string;
} {
  switch (dim) {
    case "area":
      return { codigoDe: (g) => g.imputacion.areaCodigo, detalleDe: (g) => g.imputacion.areaDetalle };
    case "ubicacion":
      return { codigoDe: (g) => g.imputacion.ubicacionCodigo, detalleDe: (g) => g.imputacion.ubicacionDetalle };
    default:
      return { codigoDe: (g) => g.imputacion.centroCostoCodigo, detalleDe: (g) => g.imputacion.centroCostoDetalle };
  }
}

/** Agrupa montos por un campo de imputación (código + detalle), de mayor a menor. */
function agrupar(
  gastos: Gasto[],
  codigoDe: (g: Gasto) => string,
  detalleDe: (g: Gasto) => string,
): GrupoImputacion[] {
  const mapa = new Map<string, { detalle: string; total: number }>();
  for (const g of gastos) {
    const codigo = codigoDe(g);
    const previo = mapa.get(codigo);
    mapa.set(codigo, {
      detalle: previo?.detalle || detalleDe(g),
      total: (previo?.total ?? 0) + g.monto,
    });
  }
  return [...mapa.entries()]
    .map(([codigo, { detalle, total }]) => ({ codigo, detalle, total }))
    .sort((a, b) => b.total - a.total);
}

/** Total agrupado por una dimensión de imputación (CC, área o ubicación), de mayor a menor. */
export function porDimension(gastos: Gasto[], dim: DimensionImputacion): GrupoImputacion[] {
  const { codigoDe, detalleDe } = selectorDimension(dim);
  return agrupar(gastos, codigoDe, detalleDe);
}

/** Total agrupado por centro de costo (código + detalle), de mayor a menor. */
export function porCentroCosto(gastos: Gasto[]): GrupoImputacion[] {
  return porDimension(gastos, "centroCosto");
}

/** Un nodo del árbol de imputación, con su total, cantidad de gastos e hijos. */
export interface NodoImputacion {
  codigo: string;
  detalle: string;
  total: number;
  cantidad: number;
  hijos?: NodoImputacion[];
}

/** Construye un nivel del árbol agrupando por la primera dimensión y recurriendo en el resto. */
function construirNivel(gastos: Gasto[], dims: DimensionImputacion[]): NodoImputacion[] {
  if (dims.length === 0) return [];
  const [dim, ...resto] = dims;
  const { codigoDe, detalleDe } = selectorDimension(dim);
  const grupos = new Map<string, Gasto[]>();
  for (const g of gastos) {
    const codigo = codigoDe(g);
    const lista = grupos.get(codigo);
    if (lista) lista.push(g);
    else grupos.set(codigo, [g]);
  }
  return [...grupos.values()]
    .map((lista) => ({
      codigo: codigoDe(lista[0]),
      detalle: lista.map(detalleDe).find(Boolean) ?? "",
      total: lista.reduce((acc, g) => acc + g.monto, 0),
      cantidad: lista.length,
      hijos: resto.length ? construirNivel(lista, resto) : undefined,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Árbol jerárquico Centro de costo → Área → Ubicación. Cada nodo lleva su total
 * y la cantidad de gastos. Pensado para una tabla dinámica expandible.
 */
export function arbolPorImputacion(gastos: Gasto[]): NodoImputacion[] {
  return construirNivel(gastos, ["centroCosto", "area", "ubicacion"]);
}

/** Suma de montos separada por tipo de rendición. */
export function porTipoRendicion(gastos: Gasto[]): { rendicion: number; devolucion: number } {
  return gastos.reduce(
    (acc, g) => {
      if (g.tipoRendicion === "Devolucion") acc.devolucion += g.monto;
      else acc.rendicion += g.monto;
      return acc;
    },
    { rendicion: 0, devolucion: 0 },
  );
}

/** Totales de los gastos Aprobados, separados por tipo de rendición. */
export function aprobadosPorTipo(gastos: Gasto[]): { rendicion: number; devolucion: number; total: number } {
  const t = porTipoRendicion(gastos.filter((g) => g.estado === "Aprobado"));
  return { ...t, total: t.rendicion + t.devolucion };
}

/** Gastos en estado Rechazado. */
export function rechazados(gastos: Gasto[]): Gasto[] {
  return gastos.filter((g) => g.estado === "Rechazado");
}

/** Un mes con sus gastos y el total, para el detalle agrupado. */
export interface MesConGastos {
  anioMes: string; // "AAAA-MM"
  total: number;
  gastos: Gasto[]; // ordenados por fechaDocumento, de más reciente a más antiguo
}

/**
 * Agrupa los gastos por mes (de fechaDocumento), de más reciente a más antiguo.
 * Dentro de cada mes los gastos quedan ordenados por fecha descendente.
 */
export function gastosPorMes(gastos: Gasto[]): MesConGastos[] {
  const mapa = new Map<string, Gasto[]>();
  for (const g of gastos) {
    const mes = g.fechaDocumento.slice(0, 7);
    const lista = mapa.get(mes);
    if (lista) lista.push(g);
    else mapa.set(mes, [g]);
  }
  return [...mapa.entries()]
    .map(([anioMes, lista]) => ({
      anioMes,
      total: lista.reduce((acc, g) => acc + g.monto, 0),
      gastos: [...lista].sort((a, b) => b.fechaDocumento.localeCompare(a.fechaDocumento)),
    }))
    .sort((a, b) => b.anioMes.localeCompare(a.anioMes));
}
