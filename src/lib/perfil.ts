import type { Usuario } from "./types";

/**
 * El perfil está completo cuando el usuario tiene nombre, RUT y área: los datos
 * que la rendición consume en cada gasto (usuarioNombre) y en la cabecera del
 * PDF (nombre + RUT). Sin ellos, login no debe dejar pasar al chat.
 * Banco y cuenta corriente quedan fuera: solo se exigen al registrar una
 * Devolución, no para iniciar sesión.
 */
export function perfilCompleto(u: Usuario): boolean {
  return u.nombre.trim() !== "" && u.rut.trim() !== "" && u.area.trim() !== "";
}
