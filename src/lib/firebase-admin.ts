import { jwtVerify, createRemoteJWKSet } from "jose";

// Verificación de ID tokens de Firebase SIN el SDK firebase-admin.
// Un ID token de Firebase es un JWT RS256 estándar firmado por Google; lo
// verificamos directamente con `jose` contra el JWKS público de Google.
// (firebase-admin arrastra jwks-rsa→jose y rompía en el runtime serverless.)

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

// JWKS público de Google para los "secure tokens" de Firebase (formato JWK).
// jose cachea las claves y las refresca según los headers de la respuesta.
const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

/** Claims que nos interesan de un ID token verificado. */
export interface ClaimsVerificados {
  email?: string;
  name?: string;
  emailVerified: boolean;
  uid: string;
}

/**
 * Verifica un ID token de Firebase (firma, emisor, audiencia y expiración) y
 * devuelve sus claims. Lanza si el token es inválido o expiró.
 */
export async function verificarIdToken(token: string): Promise<ClaimsVerificados> {
  const projectId = getEnv("FIREBASE_PROJECT_ID");
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
    algorithms: ["RS256"],
  });
  return {
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    emailVerified: payload.email_verified === true,
    uid: typeof payload.sub === "string" ? payload.sub : "",
  };
}
