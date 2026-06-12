# Plan 2 — Autenticación y roles (Firebase) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir login con Google restringido a `@bosca.cl`, verificar la identidad en el servidor con Firebase Admin, cruzar el email con la pestaña `Usuarios` para obtener el rol, y exponer un guard reutilizable que las rutas API usan para autorizar por rol.

**Architecture:** El cliente usa el SDK web de Firebase para login con Google y obtiene un ID token. Cada llamada a la API manda ese token en `Authorization: Bearer`. El servidor lo verifica con Firebase Admin, obtiene el email, llama a `getUsuario` (Plan 1) y aplica una **función pura de decisión** (`decidirAcceso`) que valida dominio + existencia + estado activo y resuelve el rol. La lógica de decisión se prueba de forma aislada; la verificación del token (Firebase Admin) y el login (Firebase web) son pegamento delgado verificado manualmente.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Firebase Web SDK (`firebase`), Firebase Admin (`firebase-admin`), Vitest.

---

## Estructura de archivos (Plan 2)

| Archivo | Responsabilidad |
|---|---|
| `src/lib/auth.ts` | Lógica PURA de decisión de acceso: `decidirAcceso`, `tieneRol`, `getBearerToken`, tipos `SesionUsuario`/`ResultadoAcceso` |
| `src/lib/auth.test.ts` | Pruebas de la lógica de decisión |
| `src/lib/firebase-admin.ts` | Init de Firebase Admin + `verificarIdToken` (pegamento, sin unit test) |
| `src/lib/auth-server.ts` | `autenticar(token)`: verifica token → `getUsuario` → `decidirAcceso` |
| `src/lib/auth-server.test.ts` | Pruebas de `autenticar` con `firebase-admin` y `sheets` mockeados |
| `src/app/api/me/route.ts` | Ruta protegida de ejemplo: devuelve la sesión del usuario actual |
| `src/lib/firebase-client.ts` | Init del SDK web + `iniciarSesionGoogle`, `cerrarSesion`, `getIdTokenActual` |
| `src/lib/auth-context.tsx` | `AuthProvider` + `useAuth()` (estado de sesión en el cliente) |
| `src/components/AuthGate.tsx` | Redirige a `/login` si no hay sesión; envuelve contenido protegido |
| `src/app/login/page.tsx` | Pantalla de login con botón de Google |
| `src/app/page.tsx` | Landing protegida: saluda al usuario, muestra rol, botón salir (reemplaza el placeholder de Next) |
| `src/app/layout.tsx` | Envuelve la app con `AuthProvider` (modificación) |
| `.env.local.example` | Agregar variables de Firebase (modificación) |

---

## Task 0: Dependencias y variables de entorno

**Files:**
- Modify: `package.json` (vía npm install)
- Modify: `.env.local.example`

- [ ] **Step 1: Instalar dependencias de Firebase**

```bash
npm install firebase firebase-admin
```

- [ ] **Step 2: Agregar variables de Firebase a la plantilla de entorno**

Agrega al final de `.env.local.example`:

```
# Firebase — cliente (público, se expone al navegador con prefijo NEXT_PUBLIC_)
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto

# Firebase Admin — servidor. Reusa GOOGLE_SERVICE_ACCOUNT_EMAIL y GOOGLE_PRIVATE_KEY
# de arriba (la service account debe pertenecer al mismo proyecto que Firebase Auth).
# project_id de Firebase (normalmente igual al del proyecto de Google Cloud):
FIREBASE_PROJECT_ID=tu-proyecto
```

- [ ] **Step 3: Verificar que el proyecto sigue compilando**

Run: `npx tsc --noEmit`
Expected: sin errores (aún no usamos las librerías nuevas).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "chore: dependencias firebase/firebase-admin + env vars de Firebase"
```

---

## Task 1: Lógica pura de decisión de acceso

**Files:**
- Create: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`

**Contexto:** Esta es la pieza testeable del control de acceso. `decidirAcceso` toma los claims
del token (email, nombre) y el `Usuario` que devolvió `getUsuario` (o `null`), y decide:
dominio no `@bosca.cl` → 403; sin email → 401; usuario `null` (no registrado o inactivo) → 403;
caso válido → `ok` con la sesión. `tieneRol` verifica el rol mínimo. `getBearerToken` extrae el
token del header `Authorization`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Create `src/lib/auth.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decidirAcceso, tieneRol, getBearerToken, DOMINIO_PERMITIDO } from "./auth";
import type { Usuario } from "./types";

const usuarioAdmin: Usuario = {
  email: "maravena@bosca.cl",
  nombre: "M. Aravena",
  rol: "Administrador",
  activo: true,
  fechaAlta: "2026-06-01T00:00:00Z",
};

describe("decidirAcceso", () => {
  it("permite a un usuario válido del dominio y devuelve su sesión", () => {
    const r = decidirAcceso({ email: "maravena@bosca.cl", name: "M. Aravena" }, usuarioAdmin);
    expect(r).toEqual({
      ok: true,
      usuario: { email: "maravena@bosca.cl", nombre: "M. Aravena", rol: "Administrador" },
    });
  });

  it("rechaza con 401 si el token no trae email", () => {
    const r = decidirAcceso({ email: undefined, name: "X" }, null);
    expect(r).toEqual({ ok: false, status: 401, motivo: expect.any(String) });
  });

  it("rechaza con 403 si el dominio no es el permitido", () => {
    const r = decidirAcceso({ email: "ajeno@gmail.com", name: "Ajeno" }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("rechaza con 403 si el usuario no está en la planilla o está inactivo", () => {
    const r = decidirAcceso({ email: "maravena@bosca.cl", name: "M. Aravena" }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("normaliza el email del token a minúsculas para el chequeo de dominio", () => {
    const r = decidirAcceso({ email: "MARAVENA@BOSCA.CL", name: "M" }, usuarioAdmin);
    expect(r.ok).toBe(true);
  });
});

describe("tieneRol", () => {
  const sesionUsuario = { email: "u@bosca.cl", nombre: "U", rol: "Usuario" as const };
  const sesionAdmin = { email: "a@bosca.cl", nombre: "A", rol: "Administrador" as const };

  it("cualquier sesión cumple el rol mínimo Usuario", () => {
    expect(tieneRol(sesionUsuario, "Usuario")).toBe(true);
    expect(tieneRol(sesionAdmin, "Usuario")).toBe(true);
  });

  it("solo Administrador cumple el rol mínimo Administrador", () => {
    expect(tieneRol(sesionUsuario, "Administrador")).toBe(false);
    expect(tieneRol(sesionAdmin, "Administrador")).toBe(true);
  });
});

describe("getBearerToken", () => {
  it("extrae el token de un header Bearer", () => {
    const req = new Request("http://x", { headers: { authorization: "Bearer abc.def.ghi" } });
    expect(getBearerToken(req)).toBe("abc.def.ghi");
  });

  it("devuelve null si no hay header", () => {
    expect(getBearerToken(new Request("http://x"))).toBeNull();
  });

  it("devuelve null si el esquema no es Bearer", () => {
    const req = new Request("http://x", { headers: { authorization: "Basic abc" } });
    expect(getBearerToken(req)).toBeNull();
  });
});

describe("DOMINIO_PERMITIDO", () => {
  it("es bosca.cl", () => {
    expect(DOMINIO_PERMITIDO).toBe("bosca.cl");
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL — "decidirAcceso is not a function".

- [ ] **Step 3: Implementar la lógica**

Create `src/lib/auth.ts`:

```ts
import type { Usuario, Rol } from "./types";

export const DOMINIO_PERMITIDO = "bosca.cl";

/** Sesión mínima de un usuario autenticado (lo que las rutas necesitan saber). */
export interface SesionUsuario {
  email: string;
  nombre: string;
  rol: Rol;
}

/** Resultado de decidir acceso: éxito con la sesión, o fallo con código HTTP. */
export type ResultadoAcceso =
  | { ok: true; usuario: SesionUsuario }
  | { ok: false; status: 401 | 403; motivo: string };

/** Claims relevantes que vienen del ID token verificado. */
export interface ClaimsToken {
  email?: string;
  name?: string;
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
  if (!email.endsWith(`@${DOMINIO_PERMITIDO}`)) {
    return { ok: false, status: 403, motivo: "Dominio de correo no autorizado" };
  }
  if (!usuario) {
    return { ok: false, status: 403, motivo: "Usuario no registrado o inactivo" };
  }
  return {
    ok: true,
    usuario: { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol },
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
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: PASS — todas las pruebas pasan.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: lógica pura de decisión de acceso (decidirAcceso, tieneRol, getBearerToken)"
```

---

## Task 2: Firebase Admin y verificación de token

**Files:**
- Create: `src/lib/firebase-admin.ts`

**Contexto:** Pegamento delgado con `firebase-admin`. Inicializa la app Admin una sola vez
(evita reinicializar en hot-reload de Next) usando la misma service account de Google. Expone
`verificarIdToken(token)` que devuelve los claims decodificados. No tiene unit test (depende de
la red de Google y de un proyecto Firebase real); se verifica de extremo a extremo en la Task 7.

- [ ] **Step 1: Implementar el módulo Admin**

Create `src/lib/firebase-admin.ts`:

```ts
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
  uid: string;
}

/** Verifica un ID token de Firebase y devuelve sus claims. Lanza si es inválido. */
export async function verificarIdToken(token: string): Promise<ClaimsVerificados> {
  const decoded = await getAuth(getAdminApp()).verifyIdToken(token);
  return { email: decoded.email, name: decoded.name as string | undefined, uid: decoded.uid };
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase-admin.ts
git commit -m "feat: firebase-admin init + verificarIdToken"
```

---

## Task 3: Glue de autenticación (`autenticar`)

**Files:**
- Create: `src/lib/auth-server.ts`
- Test: `src/lib/auth-server.test.ts`

**Contexto:** `autenticar(token)` une las piezas: verifica el token (Firebase Admin), busca el
usuario en la planilla (`getUsuario`, Plan 1) y aplica `decidirAcceso`. Si el token es inválido,
devuelve 401. Se prueba con `firebase-admin` y `sheets` mockeados.

- [ ] **Step 1: Escribir las pruebas que fallan**

Create `src/lib/auth-server.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Usuario } from "./types";

const verificarIdToken = vi.fn();
const getUsuario = vi.fn();

vi.mock("./firebase-admin", () => ({
  verificarIdToken: (...a: unknown[]) => verificarIdToken(...a),
}));
vi.mock("./sheets", () => ({
  getUsuario: (...a: unknown[]) => getUsuario(...a),
}));

import { autenticar } from "./auth-server";

const usuario: Usuario = {
  email: "maravena@bosca.cl",
  nombre: "M. Aravena",
  rol: "Administrador",
  activo: true,
  fechaAlta: "",
};

beforeEach(() => {
  verificarIdToken.mockReset();
  getUsuario.mockReset();
});

describe("autenticar", () => {
  it("devuelve 401 si el token es inválido (verifyIdToken lanza)", async () => {
    verificarIdToken.mockRejectedValue(new Error("token inválido"));
    const r = await autenticar("malo");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
    expect(getUsuario).not.toHaveBeenCalled();
  });

  it("autentica a un usuario válido y devuelve su sesión", async () => {
    verificarIdToken.mockResolvedValue({ email: "maravena@bosca.cl", name: "M. Aravena", uid: "u1" });
    getUsuario.mockResolvedValue(usuario);
    const r = await autenticar("bueno");
    expect(r).toEqual({
      ok: true,
      usuario: { email: "maravena@bosca.cl", nombre: "M. Aravena", rol: "Administrador" },
    });
    expect(getUsuario).toHaveBeenCalledWith("maravena@bosca.cl");
  });

  it("devuelve 403 si el usuario no está en la planilla", async () => {
    verificarIdToken.mockResolvedValue({ email: "nuevo@bosca.cl", name: "Nuevo", uid: "u2" });
    getUsuario.mockResolvedValue(null);
    const r = await autenticar("bueno");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/auth-server.test.ts`
Expected: FAIL — "autenticar is not a function".

- [ ] **Step 3: Implementar el glue**

Create `src/lib/auth-server.ts`:

```ts
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
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/auth-server.test.ts`
Expected: PASS — las 3 pruebas pasan.

- [ ] **Step 5: Verificar tipos y suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores; toda la suite (Plan 1 + Plan 2) en verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth-server.ts src/lib/auth-server.test.ts
git commit -m "feat: autenticar() une verificación de token + getUsuario + decidirAcceso (con tests)"
```

---

## Task 4: Ruta protegida `/api/me`

**Files:**
- Create: `src/app/api/me/route.ts`

**Contexto:** Ruta de ejemplo que valida el guard de extremo a extremo. Extrae el Bearer token,
llama a `autenticar`, y devuelve la sesión (200) o el error correspondiente (401/403). Esta es la
plantilla que reusarán todas las rutas de Planes 3/4.

- [ ] **Step 1: Implementar la ruta**

Create `src/app/api/me/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  }
  const resultado = await autenticar(token);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.motivo }, { status: resultado.status });
  }
  return NextResponse.json({ usuario: resultado.usuario });
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/me/route.ts
git commit -m "feat: ruta protegida /api/me (plantilla de guard por token)"
```

---

## Task 5: Cliente de Firebase (login con Google)

**Files:**
- Create: `src/lib/firebase-client.ts`

**Contexto:** Inicializa el SDK web de Firebase (una sola vez) y expone helpers para iniciar
sesión con Google (sugiriendo el dominio `bosca.cl`), cerrar sesión y obtener el ID token actual.
Se verifica manualmente en la Task 7 (requiere un proyecto Firebase real).

- [ ] **Step 1: Implementar el cliente**

Create `src/lib/firebase-client.ts`:

```ts
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
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/firebase-client.ts
git commit -m "feat: cliente Firebase (iniciarSesionGoogle, cerrarSesion, getIdTokenActual)"
```

---

## Task 6: Contexto de autenticación y AuthGate

**Files:**
- Create: `src/lib/auth-context.tsx`
- Create: `src/components/AuthGate.tsx`
- Modify: `src/app/layout.tsx`

**Contexto:** `AuthProvider` escucha el estado de sesión de Firebase (`onAuthStateChanged`) y
expone `{ user, cargando }` vía `useAuth()`. `AuthGate` redirige a `/login` si no hay sesión una
vez que terminó de cargar. El layout envuelve toda la app con `AuthProvider`.

- [ ] **Step 1: Crear el contexto**

Create `src/lib/auth-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getClientAuth } from "./firebase-client";

interface AuthState {
  user: User | null;
  cargando: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, cargando: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, cargando: true });

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), (user) => {
      setState({ user, cargando: false });
    });
    return () => unsub();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/** Acceso al estado de autenticación del cliente. */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: Crear AuthGate**

Create `src/components/AuthGate.tsx`:

```tsx
"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/** Envuelve contenido protegido: redirige a /login si no hay sesión. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && !user) {
      router.replace("/login");
    }
  }, [cargando, user, router]);

  if (cargando) {
    return <div className="flex min-h-screen items-center justify-center">Cargando…</div>;
  }
  if (!user) {
    return null; // redirigiendo
  }
  return <>{children}</>;
}
```

- [ ] **Step 3: Envolver la app con AuthProvider en el layout**

Reemplaza el contenido de `src/app/layout.tsx` por:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Rendición de Gastos",
  description: "Registro de gastos corporativos con bot inteligente",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-context.tsx src/components/AuthGate.tsx src/app/layout.tsx
git commit -m "feat: AuthProvider/useAuth + AuthGate + layout envuelto en AuthProvider"
```

---

## Task 7: Pantalla de login y landing protegida

**Files:**
- Create: `src/app/login/page.tsx`
- Modify: `src/app/page.tsx`

**Contexto:** `/login` muestra el botón de Google y, si ya hay sesión, redirige a `/`. La landing
(`/`) queda protegida por `AuthGate`, llama a `/api/me` con el token para obtener nombre + rol del
servidor (probando el guard completo), y ofrece cerrar sesión. Esta es la prueba de extremo a
extremo de toda la autenticación.

- [ ] **Step 1: Crear la pantalla de login**

Create `src/app/login/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { iniciarSesionGoogle } from "@/lib/firebase-client";

export default function LoginPage() {
  const { user, cargando } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cargando && user) router.replace("/");
  }, [cargando, user, router]);

  async function onLogin() {
    setError(null);
    try {
      await iniciarSesionGoogle();
      router.replace("/");
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Rendición de Gastos</h1>
      <p className="text-sm text-gray-500">Inicia sesión con tu cuenta @bosca.cl</p>
      <button
        onClick={onLogin}
        className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
      >
        Iniciar sesión con Google
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Reemplazar la landing por una versión protegida**

Reemplaza el contenido de `src/app/page.tsx` por:

```tsx
"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { cerrarSesion, getIdTokenActual } from "@/lib/firebase-client";

interface SesionApi {
  email: string;
  nombre: string;
  rol: string;
}

function Home() {
  const [sesion, setSesion] = useState<SesionApi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const token = await getIdTokenActual();
      if (!token) return;
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No autorizado");
        return;
      }
      const data = await res.json();
      setSesion(data.usuario);
    }
    cargar();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Rendición de Gastos</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sesion ? (
        <p className="text-lg">
          Hola <strong>{sesion.nombre}</strong> ({sesion.rol})
        </p>
      ) : (
        !error && <p className="text-sm text-gray-500">Cargando tu sesión…</p>
      )}
      <button
        onClick={() => cerrarSesion()}
        className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
      >
        Cerrar sesión
      </button>
    </main>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Home />
    </AuthGate>
  );
}
```

- [ ] **Step 3: Verificar tipos, suite y build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc sin errores; suite completa en verde; `npm run build` compila sin errores
(el build valida que las páginas y rutas server/client son válidas).

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx src/app/page.tsx
git commit -m "feat: login con Google + landing protegida que consume /api/me"
```

- [ ] **Step 5: Nota de verificación manual (no automatizable sin Firebase real)**

La verificación funcional completa requiere un proyecto Firebase real y la planilla configurada
(va en el Manual de Instalación, Plan 3/4). Cuando esté disponible:
1. Configura `.env.local` con las variables de Firebase + Google.
2. Agrega tu email a la pestaña `Usuarios` con rol y `activo=TRUE`.
3. `npm run dev`, entra a `http://localhost:3000` → debe redirigir a `/login`.
4. Inicia sesión con tu cuenta `@bosca.cl` → debe volver a `/` y mostrar "Hola <nombre> (<rol>)".
5. Un email fuera de la planilla o de otro dominio debe ver el mensaje de no autorizado.

---

## Self-Review (cobertura del Plan 2 vs spec)

- **Autenticación con Firebase + Google, restringida a `@bosca.cl` (Sección 5):** Task 5
  (login), Task 1 (`decidirAcceso` valida dominio), Task 2/3 (verificación server). ✅
- **Cruce con pestaña `Usuarios` + estado activo (Sección 5):** Task 3 usa `getUsuario` (Plan 1,
  que ya filtra inactivos); Task 1 rechaza `null`. ✅
- **Autorización por rol verificada en el servidor (Sección 5):** Task 1 (`tieneRol`), Task 3/4
  (guard server-side; `/api/me` devuelve 401/403). El uso de `tieneRol` para rutas solo-admin se
  aplicará en las rutas concretas de Planes 3/4 (ej. editar/exportar). ✅
- **Secretos solo en el servidor (Sección 5):** `firebase-admin.ts` y la service account viven en
  el server; el cliente solo usa las claves públicas `NEXT_PUBLIC_*` de Firebase. ✅
- **Flujo de login → landing (Secciones 3/4):** Tasks 6–7 (AuthGate + login + landing). ✅
- **Lo que NO cubre el Plan 2 (correcto):** Drive, Claude, chat, OCR (Plan 3); dashboard (Plan 4).
  La UI de la landing es mínima (saludo + rol + logout) — solo para probar el guard; la UI real de
  chat/dashboard viene después.

**Sin placeholders:** todo el código está completo. **Consistencia de tipos:** `SesionUsuario`,
`ResultadoAcceso`, `ClaimsToken`, `ClaimsVerificados` usados consistentemente; `decidirAcceso`/
`tieneRol`/`getBearerToken`/`autenticar`/`verificarIdToken` con firmas estables entre tareas.

**Dependencia externa para correr de verdad (no para los tests):** login real requiere proyecto
Firebase + planilla; los tests unitarios no lo requieren (firebase-admin y sheets mockeados). La
verificación manual está documentada en la Task 7.
