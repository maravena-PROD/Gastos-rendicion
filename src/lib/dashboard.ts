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
