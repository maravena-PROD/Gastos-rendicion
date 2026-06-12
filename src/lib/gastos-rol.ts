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
