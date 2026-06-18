import type { Usuario, Rol } from "./types";

export const DOMINIO_PERMITIDO = "bosca.cl";

/** Sesión mínima de un usuario autenticado (lo que las rutas necesitan saber). */
export interface SesionUsuario {
  email: string;
  nombre: string;
  rol: Rol;
  area: string;
  apruebaCc: string[];
  ingresaCc?: string[]; // CC donde puede ingresar gastos; ["*"] o vacío = todos
}

/** Resultado de decidir acceso: éxito con la sesión, o fallo con código HTTP. */
export type ResultadoAcceso =
  | { ok: true; usuario: SesionUsuario }
  | { ok: false; status: 401 | 403; motivo: string };

/** Claims relevantes que vienen del ID token verificado. */
export interface ClaimsToken {
  email?: string;
  name?: string;
  emailVerified?: boolean;
}

/**
 * Decide si un usuario puede acceder, a partir de los claims del token y el
 * Usuario encontrado en la planilla (o null si no existe / está inactivo).
 */
export function decidirAcceso(
  claims: ClaimsToken,
  usuario: Usuario | null,
): ResultadoAcceso {
  const email = (claims.email ?? "").toLowerCase();
  if (!email) {
    return { ok: false, status: 401, motivo: "El token no contiene email" };
  }
  if (claims.emailVerified !== true) {
    return { ok: false, status: 403, motivo: "Email no verificado" };
  }
  if (!email.endsWith(`@${DOMINIO_PERMITIDO}`)) {
    return { ok: false, status: 403, motivo: "Dominio de correo no autorizado" };
  }
  if (!usuario) {
    return { ok: false, status: 403, motivo: "Usuario no registrado o inactivo" };
  }
  return {
    ok: true,
    usuario: {
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      area: usuario.area,
      apruebaCc: usuario.rol === "Administrador" ? ["*"] : usuario.apruebaCc,
      ingresaCc: usuario.rol === "Administrador" ? ["*"] : (usuario.ingresaCc ?? []),
    },
  };
}

/** Verifica que la sesión cumpla con el rol mínimo requerido. */
export function tieneRol(usuario: SesionUsuario, rolMinimo: Rol): boolean {
  if (rolMinimo === "Usuario") return true; // cualquier autenticado
  return usuario.rol === "Administrador";
}

/** Extrae el token de un header "Authorization: Bearer <token>". null si no hay. */
export function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}
