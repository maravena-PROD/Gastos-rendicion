# Plan 4 — UI de chat (registro conversacional) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir la interfaz de chat mobile-first donde el usuario registra gastos por texto o foto: el bot extrae datos (vía las rutas del Plan 3), pide lo que falta, muestra una tarjeta de confirmación editable y guarda el gasto. La landing protegida (`/`) pasa a ser este chat.

**Architecture:** Un cliente de API tipado (`api-client.ts`) adjunta el token de Firebase y llama a `/api/extraer`, `/api/upload`, `/api/gastos` (Plan 3). La página de chat mantiene un "borrador" de `ExtraccionGasto` y reusa las funciones **puras ya testeadas** del Plan 3 (`fusionarExtraccion`, `camposFaltantes`, `siguientePregunta`) para conducir la conversación. Los componentes (burbuja, tarjeta de confirmación, barra de entrada) son presentacionales. La única pieza con pruebas nuevas es `api-client.ts` (fetch + token, con `fetch` mockeado); el resto se verifica con `npm run build` + prueba manual.

**Tech Stack:** Next.js 16 (App Router, client components), TypeScript, Tailwind CSS, Vitest. Reusa Plan 1 (`format.ts`, `types.ts`), Plan 2 (`firebase-client.ts`, `AuthGate`) y Plan 3 (`extraccion.ts`).

---

## Estructura de archivos (Plan 4)

| Archivo | Responsabilidad |
|---|---|
| `src/lib/api-client.ts` | Llamadas tipadas al backend con token: `extraerDesdeTexto`, `extraerDesdeImagen`, `subirBoleta`, `guardarGasto`, `obtenerGastos` |
| `src/lib/api-client.test.ts` | Pruebas con `fetch` y `getIdTokenActual` mockeados |
| `src/lib/imagen.ts` | `fileABase64` (lee un File del navegador a base64 sin prefijo) |
| `src/components/chat/MensajeBurbuja.tsx` | Burbuja de mensaje (bot / usuario) |
| `src/components/chat/TarjetaConfirmacion.tsx` | Tarjeta editable: revisar y confirmar el gasto |
| `src/components/chat/BarraEntrada.tsx` | Input de texto + botón cámara/galería |
| `src/app/page.tsx` | Página de chat (orquesta todo; reemplaza la landing del Plan 2) |

---

## Task 0: Helper de imagen (File → base64)

**Files:**
- Create: `src/lib/imagen.ts`

**Contexto:** Para mandar una foto al backend la convertimos a base64 (sin el prefijo
`data:...;base64,`). Usa `FileReader` del navegador, por lo que no lleva unit test (API de browser);
se verifica en la prueba manual de la Task 6.

- [ ] **Step 1: Implementar el helper**

Create `src/lib/imagen.ts`:

```ts
/**
 * Lee un archivo del navegador y lo devuelve como base64 SIN el prefijo
 * "data:<mime>;base64,". Útil para enviar la imagen al backend.
 */
export function fileABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const coma = result.indexOf(",");
      resolve(coma >= 0 ? result.slice(coma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/imagen.ts
git commit -m "feat: fileABase64 (lee File del navegador a base64)"
```

---

## Task 1: Cliente de API tipado

**Files:**
- Create: `src/lib/api-client.ts`
- Test: `src/lib/api-client.test.ts`

**Contexto:** Centraliza las llamadas al backend: obtiene el token de Firebase
(`getIdTokenActual`), arma el header `Authorization: Bearer`, hace `fetch`, y lanza un `Error` con
el mensaje del backend si la respuesta no es OK. Se prueba con `fetch` y `getIdTokenActual`
mockeados.

- [ ] **Step 1: Escribir las pruebas que fallan**

Create `src/lib/api-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getIdTokenActual = vi.fn();
vi.mock("./firebase-client", () => ({
  getIdTokenActual: (...a: unknown[]) => getIdTokenActual(...a),
}));

import { extraerDesdeTexto, guardarGasto, obtenerGastos } from "./api-client";

beforeEach(() => {
  getIdTokenActual.mockReset();
  getIdTokenActual.mockResolvedValue("tok-123");
  vi.stubGlobal("fetch", vi.fn());
});

function mockFetch(ok: boolean, body: unknown) {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok,
    json: async () => body,
  });
}

describe("extraerDesdeTexto", () => {
  it("hace POST a /api/extraer con el texto y el token", async () => {
    mockFetch(true, { extraccion: { comercio: "Copec" }, faltantes: [] });
    const r = await extraerDesdeTexto("combustible en Copec");
    expect(r.extraccion.comercio).toBe("Copec");
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/extraer");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ texto: "combustible en Copec" });
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it("lanza un Error con el mensaje del backend si la respuesta falla", async () => {
    mockFetch(false, { error: "No autorizado" });
    await expect(extraerDesdeTexto("x")).rejects.toThrow("No autorizado");
  });
});

describe("guardarGasto", () => {
  it("hace POST a /api/gastos con el payload", async () => {
    mockFetch(true, { gasto: { id: "g_1" } });
    const r = await guardarGasto({
      comercio: "Copec",
      monto: 45000,
      categoria: "Combustible",
      fechaDocumento: "2026-06-10",
    });
    expect(r.gasto.id).toBe("g_1");
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/gastos");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body).monto).toBe(45000);
  });
});

describe("obtenerGastos", () => {
  it("hace GET a /api/gastos y devuelve la lista", async () => {
    mockFetch(true, { gastos: [{ id: "g_1" }, { id: "g_2" }] });
    const r = await obtenerGastos();
    expect(r.gastos).toHaveLength(2);
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/gastos");
    expect(opts.method).toBe("GET");
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/api-client.test.ts`
Expected: FAIL — "extraerDesdeTexto is not a function".

- [ ] **Step 3: Implementar el cliente**

Create `src/lib/api-client.ts`:

```ts
import { getIdTokenActual } from "./firebase-client";
import type { ExtraccionGasto } from "./extraccion";
import type { Gasto, Categoria } from "./types";

/** Respuesta de las rutas de extracción. */
export interface RespuestaExtraccion {
  extraccion: ExtraccionGasto;
  faltantes: string[];
}

/** Datos para crear un gasto desde el cliente. */
export interface GuardarGastoInput {
  comercio: string;
  monto: number;
  categoria: Categoria;
  fechaDocumento: string;
  rutEmisor?: string;
  numeroDocumento?: string;
  direccion?: string;
  observacion?: string;
  imagenUrl?: string;
  imagenDriveId?: string;
}

/** Hace una petición autenticada y lanza si la respuesta no es OK. */
async function pedir<T>(url: string, opciones: RequestInit): Promise<T> {
  const token = await getIdTokenActual();
  const res = await fetch(url, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
      ...(opciones.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Error de red");
  }
  return data as T;
}

/** Extrae datos de un gasto a partir de texto libre. */
export function extraerDesdeTexto(texto: string): Promise<RespuestaExtraccion> {
  return pedir<RespuestaExtraccion>("/api/extraer", {
    method: "POST",
    body: JSON.stringify({ texto }),
  });
}

/** Extrae datos de un gasto a partir de una imagen (base64 sin prefijo). */
export function extraerDesdeImagen(base64: string): Promise<RespuestaExtraccion> {
  return pedir<RespuestaExtraccion>("/api/extraer", {
    method: "POST",
    body: JSON.stringify({ base64 }),
  });
}

/** Sube una boleta a Drive y devuelve su id y url. */
export function subirBoleta(base64: string, nombre?: string): Promise<{ id: string; url: string }> {
  return pedir<{ id: string; url: string }>("/api/upload", {
    method: "POST",
    body: JSON.stringify({ base64, nombre }),
  });
}

/** Guarda un gasto confirmado. */
export function guardarGasto(payload: GuardarGastoInput): Promise<{ gasto: Gasto }> {
  return pedir<{ gasto: Gasto }>("/api/gastos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Lista los gastos visibles para el usuario actual (filtrados por rol en el servidor). */
export function obtenerGastos(): Promise<{ gastos: Gasto[] }> {
  return pedir<{ gastos: Gasto[] }>("/api/gastos", { method: "GET" });
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/api-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-client.ts src/lib/api-client.test.ts
git commit -m "feat: api-client tipado (extraer, subir, guardar, listar) con tests"
```

---

## Task 2: Componente MensajeBurbuja

**Files:**
- Create: `src/components/chat/MensajeBurbuja.tsx`

**Contexto:** Burbuja de chat. Mensajes del bot a la izquierda (fondo claro), del usuario a la
derecha (fondo de acento). Presentacional puro.

- [ ] **Step 1: Implementar el componente**

Create `src/components/chat/MensajeBurbuja.tsx`:

```tsx
import type { ReactNode } from "react";

export function MensajeBurbuja({
  autor,
  children,
}: {
  autor: "bot" | "usuario";
  children: ReactNode;
}) {
  const esBot = autor === "bot";
  return (
    <div className={`flex ${esBot ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          esBot ? "bg-gray-100 text-gray-800" : "bg-blue-600 text-white"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/MensajeBurbuja.tsx
git commit -m "feat: componente MensajeBurbuja (chat)"
```

---

## Task 3: Componente TarjetaConfirmacion

**Files:**
- Create: `src/components/chat/TarjetaConfirmacion.tsx`

**Contexto:** Tarjeta que muestra el gasto extraído para revisar y confirmar. Campos editables:
comercio, monto, fecha, categoría (select de las 8 categorías) y observación. RUT y número de
documento se muestran de referencia. El monto se ingresa como texto y se parsea con `parseCLP`
(Plan 1), tolerando "$45.000" o "45000". El botón Confirmar se deshabilita si falta un esencial.

- [ ] **Step 1: Implementar el componente**

Create `src/components/chat/TarjetaConfirmacion.tsx`:

```tsx
"use client";

import { useState } from "react";
import { CATEGORIAS, type Categoria } from "@/lib/types";
import type { ExtraccionGasto } from "@/lib/extraccion";
import { parseCLP, formatCLP, formatRut } from "@/lib/format";
import type { GuardarGastoInput } from "@/lib/api-client";

export function TarjetaConfirmacion({
  borrador,
  imagenUrl,
  onConfirmar,
  onCancelar,
  deshabilitado,
}: {
  borrador: ExtraccionGasto;
  imagenUrl?: string;
  onConfirmar: (datos: GuardarGastoInput) => void;
  onCancelar: () => void;
  deshabilitado: boolean;
}) {
  const [comercio, setComercio] = useState(borrador.comercio ?? "");
  const [montoTexto, setMontoTexto] = useState(
    borrador.monto !== null ? String(borrador.monto) : "",
  );
  const [fecha, setFecha] = useState(borrador.fechaDocumento ?? "");
  const [categoria, setCategoria] = useState<Categoria | "">(borrador.categoria ?? "");
  const [observacion, setObservacion] = useState("");

  const monto = parseCLP(montoTexto);
  const completo = comercio.trim() !== "" && monto !== null && monto > 0 && fecha !== "" && categoria !== "";

  function confirmar() {
    if (!completo || categoria === "" || monto === null) return;
    onConfirmar({
      comercio: comercio.trim(),
      monto,
      categoria,
      fechaDocumento: fecha,
      rutEmisor: borrador.rutEmisor ?? undefined,
      numeroDocumento: borrador.numeroDocumento ?? undefined,
      direccion: borrador.direccion ?? undefined,
      observacion: observacion.trim() || undefined,
      imagenUrl,
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Revisa el gasto</h3>
      <div className="flex flex-col gap-3">
        <label className="text-xs text-gray-500">
          Comercio
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            value={comercio}
            onChange={(e) => setComercio(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Monto {monto !== null && <span className="text-gray-400">({formatCLP(monto)})</span>}
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            inputMode="numeric"
            value={montoTexto}
            onChange={(e) => setMontoTexto(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Fecha del documento
          <input
            type="date"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Categoría
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as Categoria | "")}
          >
            <option value="">Selecciona…</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Observación (opcional)
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
          />
        </label>
        {borrador.rutEmisor && (
          <p className="text-xs text-gray-400">RUT emisor: {formatRut(borrador.rutEmisor)}</p>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={confirmar}
          disabled={!completo || deshabilitado}
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Confirmar registro
        </button>
        <button
          onClick={onCancelar}
          disabled={deshabilitado}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/TarjetaConfirmacion.tsx
git commit -m "feat: TarjetaConfirmacion editable (chat)"
```

---

## Task 4: Componente BarraEntrada

**Files:**
- Create: `src/components/chat/BarraEntrada.tsx`

**Contexto:** Barra inferior fija con input de texto + botón de cámara/galería. El input de
archivo acepta imágenes y usa `capture` para sugerir la cámara en móvil. Llama a `onTexto` al
enviar y a `onArchivo` al elegir un archivo.

- [ ] **Step 1: Implementar el componente**

Create `src/components/chat/BarraEntrada.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";

export function BarraEntrada({
  onTexto,
  onArchivo,
  deshabilitado,
}: {
  onTexto: (texto: string) => void;
  onArchivo: (file: File) => void;
  deshabilitado: boolean;
}) {
  const [texto, setTexto] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function enviar() {
    const limpio = texto.trim();
    if (!limpio || deshabilitado) return;
    onTexto(limpio);
    setTexto("");
  }

  return (
    <div className="flex items-center gap-2 border-t bg-white p-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onArchivo(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={deshabilitado}
        aria-label="Adjuntar boleta"
        className="rounded-full border px-3 py-2 text-lg disabled:opacity-40"
      >
        📷
      </button>
      <input
        className="flex-1 rounded-full border px-4 py-2 text-sm text-gray-900"
        placeholder="Escribe un gasto…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") enviar();
        }}
        disabled={deshabilitado}
      />
      <button
        onClick={enviar}
        disabled={deshabilitado}
        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        Enviar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/BarraEntrada.tsx
git commit -m "feat: BarraEntrada (texto + cámara/galería)"
```

---

## Task 5: Página de chat (orquestación)

**Files:**
- Modify: `src/app/page.tsx`

**Contexto:** Reemplaza la landing del Plan 2 por la experiencia de chat completa. Mantiene
`AuthGate`. Cabecera con nombre/rol (de `/api/me`) y botón salir. Mantiene un `borrador` de
`ExtraccionGasto` y la imagen subida; reusa `fusionarExtraccion` / `camposFaltantes` /
`siguientePregunta` (Plan 3) para conducir la conversación. Al completarse, muestra la
`TarjetaConfirmacion`; al confirmar, llama a `guardarGasto`.

- [ ] **Step 1: Reescribir la página**

Reemplaza el contenido COMPLETO de `src/app/page.tsx` por:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { cerrarSesion, getIdTokenActual } from "@/lib/firebase-client";
import {
  extraerDesdeTexto,
  extraerDesdeImagen,
  subirBoleta,
  guardarGasto,
  type GuardarGastoInput,
} from "@/lib/api-client";
import { fileABase64 } from "@/lib/imagen";
import {
  fusionarExtraccion,
  camposFaltantes,
  siguientePregunta,
  type ExtraccionGasto,
} from "@/lib/extraccion";
import { MensajeBurbuja } from "@/components/chat/MensajeBurbuja";
import { TarjetaConfirmacion } from "@/components/chat/TarjetaConfirmacion";
import { BarraEntrada } from "@/components/chat/BarraEntrada";

const EXTRACCION_VACIA: ExtraccionGasto = {
  comercio: null,
  monto: null,
  fechaDocumento: null,
  categoria: null,
  rutEmisor: null,
  numeroDocumento: null,
  direccion: null,
};

type Mensaje =
  | { tipo: "texto"; autor: "bot" | "usuario"; texto: string }
  | { tipo: "confirmacion"; borrador: ExtraccionGasto; imagenUrl?: string };

interface Sesion {
  nombre: string;
  rol: string;
}

function Chat() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { tipo: "texto", autor: "bot", texto: "Hola 👋 Cuéntame un gasto o adjunta una boleta 📷" },
  ]);
  const [borrador, setBorrador] = useState<ExtraccionGasto>(EXTRACCION_VACIA);
  const [imagen, setImagen] = useState<{ url: string; id: string } | null>(null);
  const [procesando, setProcesando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  useEffect(() => {
    async function cargarSesion() {
      const token = await getIdTokenActual();
      if (!token) return;
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setSesion({ nombre: data.usuario.nombre, rol: data.usuario.rol });
      }
    }
    cargarSesion();
  }, []);

  function agregarBot(texto: string) {
    setMensajes((m) => [...m, { tipo: "texto", autor: "bot", texto }]);
  }
  function agregarUsuario(texto: string) {
    setMensajes((m) => [...m, { tipo: "texto", autor: "usuario", texto }]);
  }

  function avanzar(nuevoBorrador: ExtraccionGasto, img: { url: string; id: string } | null) {
    if (camposFaltantes(nuevoBorrador).length === 0) {
      setMensajes((m) => [
        ...m,
        { tipo: "confirmacion", borrador: nuevoBorrador, imagenUrl: img?.url },
      ]);
    } else {
      const pregunta = siguientePregunta(nuevoBorrador);
      if (pregunta) agregarBot(pregunta);
    }
  }

  async function onTexto(texto: string) {
    agregarUsuario(texto);
    setProcesando(true);
    try {
      const { extraccion } = await extraerDesdeTexto(texto);
      const fusion = fusionarExtraccion(borrador, extraccion);
      setBorrador(fusion);
      avanzar(fusion, imagen);
    } catch {
      agregarBot("No pude procesar eso. ¿Puedes reformularlo?");
    } finally {
      setProcesando(false);
    }
  }

  async function onArchivo(file: File) {
    agregarUsuario("📷 (boleta adjunta)");
    setProcesando(true);
    try {
      const base64 = await fileABase64(file);
      const [sub, ext] = await Promise.all([
        subirBoleta(base64, file.name),
        extraerDesdeImagen(base64),
      ]);
      const img = { url: sub.url, id: sub.id };
      setImagen(img);
      const fusion = fusionarExtraccion(borrador, ext.extraccion);
      setBorrador(fusion);
      avanzar(fusion, img);
    } catch {
      agregarBot("No pude leer la boleta. Intenta con otra foto o cuéntame los datos.");
    } finally {
      setProcesando(false);
    }
  }

  async function onConfirmar(datos: GuardarGastoInput) {
    setProcesando(true);
    try {
      await guardarGasto({ ...datos, imagenDriveId: imagen?.id });
      setMensajes((m) => m.filter((x) => x.tipo !== "confirmacion"));
      agregarBot("✅ Registro completado.");
      setBorrador(EXTRACCION_VACIA);
      setImagen(null);
    } catch {
      agregarBot("No pude guardar el gasto. Reintenta en un momento.");
    } finally {
      setProcesando(false);
    }
  }

  function onCancelar() {
    setMensajes((m) => m.filter((x) => x.tipo !== "confirmacion"));
    setBorrador(EXTRACCION_VACIA);
    setImagen(null);
    agregarBot("Listo, lo descarté. ¿Registramos otro?");
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3">
        <span className="font-semibold text-gray-800">Rendición de Gastos</span>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {sesion && (
            <span>
              {sesion.nombre} · {sesion.rol}
            </span>
          )}
          <button onClick={() => cerrarSesion()} className="rounded-lg border px-3 py-1 text-xs">
            Salir
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {mensajes.map((m, i) =>
          m.tipo === "texto" ? (
            <MensajeBurbuja key={i} autor={m.autor}>
              {m.texto}
            </MensajeBurbuja>
          ) : (
            <TarjetaConfirmacion
              key={i}
              borrador={m.borrador}
              imagenUrl={m.imagenUrl}
              onConfirmar={onConfirmar}
              onCancelar={onCancelar}
              deshabilitado={procesando}
            />
          ),
        )}
        {procesando && <p className="text-center text-xs text-gray-400">Procesando…</p>}
        <div ref={finRef} />
      </div>

      <BarraEntrada onTexto={onTexto} onArchivo={onArchivo} deshabilitado={procesando} />
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Chat />
    </AuthGate>
  );
}
```

- [ ] **Step 2: Verificar tipos, suite y build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc sin errores; toda la suite (Planes 1–4) en verde; `npm run build` compila
(la página es client component; Firebase se inicializa solo dentro de efectos/handlers, no en
build). Si el build falla por intentar prerenderizar con Firebase, reporta el error exacto.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: página de chat (registro conversacional de gastos)"
```

- [ ] **Step 4: Nota de verificación manual (requiere infraestructura real)**

La prueba funcional completa requiere Firebase + planilla + Drive + ANTHROPIC_API_KEY configurados
(Manual de Instalación). Cuando esté disponible:
1. `npm run dev`, inicia sesión.
2. Escribe "combustible 45000 en Copec" → el bot debe pedir la fecha (falta) → respóndela →
   aparece la tarjeta de confirmación → confirma → "✅ Registro completado" y una fila nueva en
   la planilla.
3. Toca 📷, sube una foto de boleta → el bot extrae los datos → confirma → fila + imagen en Drive.

---

## Self-Review (cobertura del Plan 4 vs spec)

- **Bot conversacional: registrar, pedir info faltante, validar, confirmar (Sección 1):** Task 5
  usa `camposFaltantes`/`siguientePregunta`/`fusionarExtraccion`; `TarjetaConfirmacion` valida y
  confirma. ✅
- **Captura de fotografías: cámara/galería, JPG/PNG (Secciones 2):** Task 4 (`capture="environment"`,
  `accept="image/*"`), Task 0 (`fileABase64`), Task 5 (`onArchivo` → upload + extracción). ✅
- **Corrección manual de categoría (Sección 4):** `TarjetaConfirmacion` con select de categorías. ✅
- **Almacenamiento + imagen (Secciones 5/6):** Task 5 `onConfirmar` → `guardarGasto` con
  `imagenUrl`/`imagenDriveId`. ✅
- **Responsive/mobile-first (Sección 10):** layout de columna a pantalla completa, barra inferior
  fija, burbujas, botones grandes. ✅
- **Lo que NO cubre el Plan 4 (correcto):** dashboard con gráficos (Plan 5); consulta de gastos
  por chat ("¿cuánto llevo este mes?") podría sumarse luego; aprobación y voz (v2). El cliente
  `obtenerGastos` queda listo para el dashboard del Plan 5.

**Sin placeholders:** todo el código está completo. **Consistencia de tipos:** `ExtraccionGasto`,
`GuardarGastoInput`, `Categoria`, `Gasto` usados consistentemente; `api-client` reusa
`getIdTokenActual` (Plan 2) y los tipos de Planes 1/3; la página reusa las funciones puras del
Plan 3.

**Pruebas:** `api-client.ts` tiene tests (fetch + token mockeados). Los componentes y la página son
UI verificada por `npm run build` + la prueba manual de la Task 5 (la lógica conversacional que
usan ya está testeada en el Plan 3).
