import { getUsuario as getUsuarioReal, actualizarPerfilUsuario as actualizarReal } from "./sheets";
import type { Usuario } from "./types";

export type ResultadoCuenta = { ok: true } | { ok: false; status: 400 | 502; error: string };

export interface DepsCuenta {
  getUsuario: (email: string) => Promise<Usuario | null>;
  actualizarPerfilUsuario: (
    email: string,
    perfil: { nombre: string; rut: string; area: string; banco?: string; cuentaCorriente?: string },
  ) => Promise<void>;
}

/**
 * Para una Devolución: exige banco+cuenta (en el perfil o en el payload). Si vienen
 * en el payload, los persiste al perfil. Devuelve el código HTTP de error si falla.
 */
export async function asegurarCuentaDevolucion(
  email: string,
  body: { banco?: string; cuentaCorriente?: string },
  deps: DepsCuenta = { getUsuario: getUsuarioReal, actualizarPerfilUsuario: actualizarReal },
): Promise<ResultadoCuenta> {
  let usuario;
  try {
    usuario = await deps.getUsuario(email);
  } catch {
    return { ok: false, status: 502, error: "No se pudo validar la cuenta corriente" };
  }
  const bancoNuevo = typeof body.banco === "string" ? body.banco.trim() : "";
  const cuentaNueva = typeof body.cuentaCorriente === "string" ? body.cuentaCorriente.trim() : "";
  const tienePerfil = !!usuario && usuario.banco.trim() !== "" && usuario.cuentaCorriente.trim() !== "";
  const vieneEnPayload = bancoNuevo !== "" && cuentaNueva !== "";
  if (!tienePerfil && !vieneEnPayload) {
    return { ok: false, status: 400, error: "Una devolución requiere banco y cuenta corriente" };
  }
  if (vieneEnPayload && usuario) {
    try {
      await deps.actualizarPerfilUsuario(email, {
        nombre: usuario.nombre,
        rut: usuario.rut,
        area: usuario.area,
        banco: bancoNuevo,
        cuentaCorriente: cuentaNueva,
      });
    } catch {
      return { ok: false, status: 502, error: "No se pudo guardar la cuenta corriente" };
    }
  }
  return { ok: true };
}
