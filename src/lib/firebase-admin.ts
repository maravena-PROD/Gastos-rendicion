import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

/** Inicializa (una sola vez) la app de Firebase Admin con la service account. */
function getAdminApp(): App {
  const existentes = getApps();
  if (existentes.length > 0) return existentes[0];
  return initializeApp({
    credential: cert({
      projectId: getEnv("FIREBASE_PROJECT_ID"),
      clientEmail: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      // Las claves en .env usan "\n" literales; los convertimos a saltos reales.
      privateKey: getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

/** Claims que nos interesan de un ID token verificado. */
export interface ClaimsVerificados {
  email?: string;
  name?: string;
  emailVerified: boolean;
  uid: string;
}

/** Verifica un ID token de Firebase y devuelve sus claims. Lanza si es inválido. */
export async function verificarIdToken(token: string): Promise<ClaimsVerificados> {
  const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
  return {
    email: decoded.email,
    name: decoded.name as string | undefined,
    emailVerified: decoded.email_verified ?? false,
    uid: decoded.uid,
  };
}
