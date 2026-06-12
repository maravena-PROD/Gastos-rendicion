import { verificarIdToken } from "./firebase-admin";
import { getUsuario } from "./sheets";
import { decidirAcceso, type ResultadoAcceso } from "./auth";

/**
 * Autentica una petición a partir de su ID token: verifica el token, busca el
 * usuario en la planilla y decide el acceso. Token inválido => 401.
 */
export async function autenticar(token: string): Promise<ResultadoAcceso> {
  let claims;
  try {
    claims = await verificarIdToken(token);
  } catch {
    return { ok: false, status: 401, motivo: "Token inválido o expirado" };
  }
  const usuario = claims.email ? await getUsuario(claims.email) : null;
  return decidirAcceso({ email: claims.email, name: claims.name }, usuario);
}
