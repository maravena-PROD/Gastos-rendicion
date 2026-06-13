import type { Usuario } from "./types";

/** El perfil está completo cuando el usuario ya tiene RUT y área. */
export function perfilCompleto(u: Usuario): boolean {
  return u.rut.trim() !== "" && u.area.trim() !== "";
}
