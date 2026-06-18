import type { SesionUsuario } from "./auth";
import type { Gasto } from "./types";

/** true si el alcance incluye "*" (todos) o el código de centro de costo dado. */
export function tieneAlcance(apruebaCc: string[], ccCodigo: string): boolean {
  return apruebaCc.includes("*") || apruebaCc.includes(ccCodigo);
}

/**
 * Una sesión puede decidir un gasto si: está Registrado, su centro de costo cae
 * en el alcance, y no es auto-aprobación (salvo alcance total "*").
 */
export function puedeAprobar(sesion: SesionUsuario, gasto: Gasto): boolean {
  if (gasto.estado !== "Registrado") return false;
  if (!tieneAlcance(sesion.apruebaCc, gasto.imputacion.centroCostoCodigo)) return false;
  const total = sesion.apruebaCc.includes("*");
  const esPropio = gasto.usuarioEmail.toLowerCase() === sesion.email.toLowerCase();
  if (esPropio && !total) return false;
  return true;
}

/** Filtra los gastos que la sesión puede aprobar/rechazar. */
export function gastosPorAprobar(gastos: Gasto[], sesion: SesionUsuario): Gasto[] {
  return gastos.filter((g) => puedeAprobar(sesion, g));
}

/**
 * Filtra los gastos cuyo centro de costo cae dentro del alcance dado. Pensado
 * para la vista de análisis del gerente: ve todo el gasto de sus CC, sin importar
 * quién lo registró ni el estado.
 */
export function gastosEnAlcance(gastos: Gasto[], apruebaCc: string[]): Gasto[] {
  return gastos.filter((g) => tieneAlcance(apruebaCc, g.imputacion.centroCostoCodigo));
}

/** Solo el dueño puede editar/reenviar, y solo si el gasto está Rechazado. */
export function puedeEditar(sesion: SesionUsuario, gasto: Gasto): boolean {
  return (
    gasto.estado === "Rechazado" &&
    gasto.usuarioEmail.toLowerCase() === sesion.email.toLowerCase()
  );
}
