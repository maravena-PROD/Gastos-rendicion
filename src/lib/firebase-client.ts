import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { DOMINIO_PERMITIDO } from "./auth";

function getClientApp(): FirebaseApp {
  const existentes = getApps();
  if (existentes.length > 0) return existentes[0];
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

/** Auth del cliente. */
export function getClientAuth() {
  return getAuth(getClientApp());
}

/** Inicia sesión con Google, sugiriendo el dominio corporativo. */
export async function iniciarSesionGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: DOMINIO_PERMITIDO }); // pista de dominio (no es enforcement)
  const cred = await signInWithPopup(getClientAuth(), provider);
  return cred.user;
}

/** Cierra la sesión actual. */
export async function cerrarSesion(): Promise<void> {
  await signOut(getClientAuth());
}

/** Devuelve el ID token del usuario actual, o null si no hay sesión. */
export async function getIdTokenActual(): Promise<string | null> {
  const user = getClientAuth().currentUser;
  return user ? user.getIdToken() : null;
}
