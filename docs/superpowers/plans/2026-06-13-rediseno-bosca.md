# Rediseño visual marca Bosca + saludo personalizado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolorear la app a la identidad Bosca (carbón + burdeo + calidez de brasa, fondo crema) y personalizar el saludo del bot con el nombre del usuario, sin cambiar lógica.

**Architecture:** Se definen tokens de color Bosca en `@theme` de `globals.css` (Tailwind v4 → genera utilidades `bg-bosca-*`, `text-bosca-*`, etc.). Cada componente reemplaza los colores genéricos (`blue-*`/`gray-*`) por los tokens Bosca. Cero cambios de lógica; los 104 tests existentes deben seguir verdes.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Recharts.

**Verificación de cada tarea:** `npx tsc --noEmit` limpio. Verificación global al final: `npm test` (104 verdes), `npm run build`, despliegue y revisión visual.

---

## Estructura de archivos

| Archivo | Cambio |
|---|---|
| `src/app/globals.css` | Tokens `@theme` Bosca + fondo crema + sans del sistema; quitar dark-mode |
| `src/components/chat/MensajeBurbuja.tsx` | Burbujas burdeo (usuario) / gris cálido (bot) |
| `src/components/chat/BarraEntrada.tsx` | Botón Enviar burdeo; cámara carbón |
| `src/components/chat/TarjetaConfirmacion.tsx` | Botón confirmar burdeo |
| `src/components/chat/Onboarding.tsx` | Botón burdeo |
| `src/app/page.tsx` | Cabecera carbón + marca + saludo con nombre + botón "Sí" burdeo |
| `src/app/login/page.tsx` | Login marca Bosca |
| `src/components/AuthGate.tsx` | Estado de carga en tono Bosca |
| `src/app/dashboard/page.tsx` | Cabecera carbón; pendientes en ámbar |
| `src/components/dashboard/GraficoCategorias.tsx` | Paleta cálida de tierra |
| `src/components/dashboard/GraficoTendencia.tsx` | Barras burdeo |

---

## Task 1: Tokens del tema Bosca

**Files:** Modify `src/app/globals.css`

**Contexto:** Define los colores de marca como tokens de Tailwind v4 y fija el fondo crema. Se quita el flip de dark-mode (la app es de superficie clara) y las fuentes Geist (ya no se usan).

- [ ] **Step 1: Reemplazar el contenido COMPLETO de `src/app/globals.css`**

```css
@import "tailwindcss";

/* Tema Bosca — carbón + burdeo + calidez de brasa */
@theme {
  --color-bosca-crema: #f7f4ef;
  --color-bosca-carbon: #1e1b1a;
  --color-bosca-burdeo: #7a2230;
  --color-bosca-burdeo-h: #8e2a3a;
  --color-bosca-ambar: #c8772e;
  --color-bosca-gris: #ede8e1;
}

body {
  background: #f7f4ef;
  color: #1e1b1a;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(ui): tokens del tema Bosca + fondo crema"
```

---

## Task 2: Burbujas de chat

**Files:** Modify `src/components/chat/MensajeBurbuja.tsx`

**Contexto:** Usuario en burdeo (texto claro), bot en gris cálido (texto carbón).

- [ ] **Step 1: Reemplazar el contenido COMPLETO de `src/components/chat/MensajeBurbuja.tsx`**

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
          esBot ? "bg-bosca-gris text-bosca-carbon" : "bg-bosca-burdeo text-white"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/MensajeBurbuja.tsx
git commit -m "feat(ui): burbujas de chat con colores Bosca"
```

---

## Task 3: Barra de entrada

**Files:** Modify `src/components/chat/BarraEntrada.tsx`

**Contexto:** Botón Enviar en burdeo; ícono de cámara en carbón. Mantiene el ícono SVG y la lógica.

- [ ] **Step 1: Reemplazar el contenido COMPLETO de `src/components/chat/BarraEntrada.tsx`**

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
    <div className="flex items-center gap-2 border-t border-bosca-gris bg-bosca-crema p-3">
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
        className="flex items-center justify-center rounded-full border border-bosca-gris bg-white p-2.5 text-bosca-carbon hover:bg-bosca-gris disabled:opacity-40"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.6}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
          />
        </svg>
      </button>
      <input
        className="flex-1 rounded-full border border-bosca-gris bg-white px-4 py-2 text-sm text-bosca-carbon"
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
        className="rounded-full bg-bosca-burdeo px-4 py-2 text-sm font-medium text-white hover:bg-bosca-burdeo-h disabled:opacity-40"
      >
        Enviar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/BarraEntrada.tsx
git commit -m "feat(ui): barra de entrada con botón Enviar burdeo"
```

---

## Task 4: Tarjeta de confirmación

**Files:** Modify `src/components/chat/TarjetaConfirmacion.tsx`

**Contexto:** Solo cambian colores (botón confirmar burdeo, monto en ámbar). La lógica (estado, props `imagenUrl`/`imagenDriveId`, validación) NO cambia.

- [ ] **Step 1: Reemplazar el contenido COMPLETO de `src/components/chat/TarjetaConfirmacion.tsx`**

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
  imagenDriveId,
  onConfirmar,
  onCancelar,
  deshabilitado,
}: {
  borrador: ExtraccionGasto;
  imagenUrl?: string;
  imagenDriveId?: string;
  onConfirmar: (datos: GuardarGastoInput) => void;
  onCancelar: () => void;
  deshabilitado: boolean;
}) {
  const [comercio, setComercio] = useState(borrador.comercio ?? "");
  const [montoTexto, setMontoTexto] = useState(
    borrador.monto !== null ? String(borrador.monto) : "",
  );
  const [fecha, setFecha] = useState(borrador.fechaDocumento ?? "");
  const [categoria, setCategoria] = useState<string>(borrador.categoria ?? "");
  const [observacion, setObservacion] = useState("");

  const monto = parseCLP(montoTexto);
  const completo =
    comercio.trim() !== "" && monto !== null && monto > 0 && fecha !== "" && categoria !== "";

  function confirmar() {
    if (!completo || categoria === "" || monto === null) return;
    onConfirmar({
      comercio: comercio.trim(),
      monto,
      categoria: categoria as Categoria,
      fechaDocumento: fecha,
      rutEmisor: borrador.rutEmisor ?? undefined,
      numeroDocumento: borrador.numeroDocumento ?? undefined,
      direccion: borrador.direccion ?? undefined,
      observacion: observacion.trim() || undefined,
      imagenUrl,
      imagenDriveId,
    });
  }

  return (
    <div className="rounded-2xl border border-bosca-gris bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-bosca-carbon">Revisa el gasto</h3>
      <div className="flex flex-col gap-3">
        <label className="text-xs text-gray-500">
          Comercio
          <input
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={comercio}
            onChange={(e) => setComercio(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Monto {monto !== null && <span className="font-medium text-bosca-ambar">({formatCLP(monto)})</span>}
          <input
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            inputMode="numeric"
            value={montoTexto}
            onChange={(e) => setMontoTexto(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Fecha del documento
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Categoría
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
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
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
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
          className="flex-1 rounded-lg bg-bosca-burdeo px-4 py-2 text-sm font-medium text-white hover:bg-bosca-burdeo-h disabled:opacity-40"
        >
          Confirmar registro
        </button>
        <button
          onClick={onCancelar}
          disabled={deshabilitado}
          className="rounded-lg border border-bosca-gris px-4 py-2 text-sm text-bosca-carbon disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/TarjetaConfirmacion.tsx
git commit -m "feat(ui): tarjeta de confirmación con colores Bosca"
```

---

## Task 5: Onboarding

**Files:** Modify `src/components/chat/Onboarding.tsx`

**Contexto:** Solo colores (botón burdeo, bordes cálidos). La lógica NO cambia.

- [ ] **Step 1: Reemplazar el contenido COMPLETO de `src/components/chat/Onboarding.tsx`**

```tsx
"use client";

import { useState } from "react";
import { guardarPerfil } from "@/lib/api-client";
import { validarRut, formatRut } from "@/lib/format";

export function Onboarding({
  nombreInicial,
  areas,
  onListo,
}: {
  nombreInicial: string;
  areas: string[];
  onListo: () => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [rut, setRut] = useState("");
  const [area, setArea] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rutValido = validarRut(rut);
  const completo = nombre.trim() !== "" && rutValido && area !== "";

  async function enviar() {
    if (!completo) return;
    setGuardando(true);
    setError(null);
    try {
      await guardarPerfil({ nombre: nombre.trim(), rut, area });
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bosca-crema p-6">
      <div className="w-full max-w-sm rounded-2xl border border-bosca-gris bg-white p-5">
        <h1 className="mb-1 text-lg font-semibold text-bosca-carbon">Completa tu perfil</h1>
        <p className="mb-4 text-sm text-gray-500">Solo la primera vez.</p>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-gray-500">
            Nombre completo
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-500">
            RUT
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              placeholder="76.543.219-7"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              onBlur={() => rutValido && setRut(formatRut(rut))}
            />
            {rut !== "" && !rutValido && (
              <span className="text-xs text-bosca-burdeo">RUT inválido</span>
            )}
          </label>
          <label className="text-xs text-gray-500">
            Área de trabajo
            <select
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-bosca-burdeo">{error}</p>}
        <button
          onClick={enviar}
          disabled={!completo || guardando}
          className="mt-4 w-full rounded-lg bg-bosca-burdeo px-4 py-2 text-sm font-medium text-white hover:bg-bosca-burdeo-h disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar y empezar"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/Onboarding.tsx
git commit -m "feat(ui): onboarding con colores Bosca"
```

---

## Task 6: Página de chat (cabecera + saludo)

**Files:** Modify `src/app/page.tsx`

**Contexto:** Cabecera carbón con marca "🔥 Bosca · Rendición de Gastos"; **saludo con el nombre**; botón "Sí" burdeo. La lógica (onboarding gate, flujos) NO cambia — solo el saludo y los colores. Aplica estas ediciones puntuales (NO reescribas la lógica).

- [ ] **Step 1: Saludo personalizado**

En `src/app/page.tsx`, en `function Chat({ perfil }: { perfil: Perfil })`, el estado inicial de mensajes tiene:
```tsx
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { tipo: "texto", autor: "bot", texto: "Hola 👋 Cuéntame un gasto o adjunta una boleta." },
  ]);
```
Reemplázalo por:
```tsx
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    {
      tipo: "texto",
      autor: "bot",
      texto: `Hola ${perfil.nombre} 👋 ¿Qué gasto registramos hoy?`,
    },
  ]);
```

- [ ] **Step 2: Cabecera con marca Bosca (carbón)**

En el `<header>` del componente `Chat`, reemplaza TODO el bloque del header por:
```tsx
      <header className="flex items-center justify-between border-b border-bosca-carbon bg-bosca-carbon px-4 py-3">
        <span className="font-semibold text-bosca-crema">🔥 Bosca · Rendición de Gastos</span>
        <div className="flex items-center gap-3 text-sm text-bosca-crema/70">
          <span>
            {perfil.nombre} · {perfil.area}
          </span>
          <Link
            href="/dashboard"
            className="rounded-lg border border-white/25 px-3 py-1 text-xs text-bosca-crema hover:bg-white/10"
          >
            Dashboard
          </Link>
          <button
            onClick={() => cerrarSesion()}
            className="rounded-lg border border-white/25 px-3 py-1 text-xs text-bosca-crema hover:bg-white/10"
          >
            Salir
          </button>
        </div>
      </header>
```

- [ ] **Step 3: Botón "Sí" del paso "¿otro ingreso?"**

En el render del mensaje `tipo "otro"`, el botón "Sí" tiene `className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"`. Cámbialo a:
```tsx
                  className="rounded-lg bg-bosca-burdeo px-4 py-2 text-sm font-medium text-white hover:bg-bosca-burdeo-h"
```
Y el botón "No" tiene `className="rounded-lg border px-4 py-2 text-sm"`. Cámbialo a:
```tsx
                <button onClick={onOtroNo} className="rounded-lg border border-bosca-gris px-4 py-2 text-sm text-bosca-carbon">
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): cabecera Bosca + saludo personalizado en el chat"
```

---

## Task 7: Login

**Files:** Modify `src/app/login/page.tsx`

**Contexto:** Login con marca Bosca (fondo crema, título, botón burdeo).

- [ ] **Step 1: Reemplazar el contenido COMPLETO de `src/app/login/page.tsx`**

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bosca-crema p-6">
      <div className="flex flex-col items-center gap-2">
        <span className="text-4xl">🔥</span>
        <h1 className="text-2xl font-semibold text-bosca-carbon">Bosca · Rendición de Gastos</h1>
        <p className="text-sm text-gray-500">Inicia sesión con tu cuenta @bosca.cl</p>
      </div>
      <button
        onClick={onLogin}
        className="rounded-lg bg-bosca-burdeo px-5 py-3 font-medium text-white hover:bg-bosca-burdeo-h"
      >
        Iniciar sesión con Google
      </button>
      {error && <p className="text-sm text-bosca-burdeo">{error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat(ui): login con marca Bosca"
```

---

## Task 8: AuthGate (estado de carga)

**Files:** Modify `src/components/AuthGate.tsx`

**Contexto:** El "Cargando…" en tono Bosca sobre crema.

- [ ] **Step 1: Editar el estado de carga**

En `src/components/AuthGate.tsx`, el bloque de carga es:
```tsx
  if (cargando) {
    return <div className="flex min-h-screen items-center justify-center">Cargando…</div>;
  }
```
Reemplázalo por:
```tsx
  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bosca-crema text-sm text-gray-500">
        Cargando…
      </div>
    );
  }
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/AuthGate.tsx
git commit -m "feat(ui): estado de carga de AuthGate en tono Bosca"
```

---

## Task 9: Gráficos del dashboard

**Files:** Modify `src/components/dashboard/GraficoCategorias.tsx`, `src/components/dashboard/GraficoTendencia.tsx`

**Contexto:** Paleta cálida de tierra para la dona; barras de tendencia en burdeo.

- [ ] **Step 1: Reemplazar el contenido COMPLETO de `src/components/dashboard/GraficoCategorias.tsx`**

```tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCLP } from "@/lib/format";

// Paleta cálida de tierra (Bosca): burdeo, ámbar, terracota, oliva, carbón, gris cálido…
const COLORES = [
  "#7a2230",
  "#c8772e",
  "#a8553a",
  "#6b7a3a",
  "#1e1b1a",
  "#9c8b7a",
  "#5a2e3a",
  "#d9a05b",
];

export function GraficoCategorias({
  datos,
}: {
  datos: { categoria: string; total: number }[];
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-gray-400">Sin datos en este período.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={datos} dataKey="total" nameKey="categoria" innerRadius={55} outerRadius={85}>
          {datos.map((_, i) => (
            <Cell key={i} fill={COLORES[i % COLORES.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatCLP(v as number)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Reemplazar el contenido COMPLETO de `src/components/dashboard/GraficoTendencia.tsx`**

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatCLP } from "@/lib/format";

export function GraficoTendencia({
  datos,
}: {
  datos: { fecha: string; total: number }[];
}) {
  if (datos.length === 0) {
    return <p className="text-sm text-gray-400">Sin datos en este período.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={datos}>
        <XAxis
          dataKey="fecha"
          tick={{ fontSize: 10 }}
          tickFormatter={(v: string) => v.slice(8)}
        />
        <YAxis tickFormatter={(v: number) => formatCLP(v)} width={72} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v) => formatCLP(v as number)} />
        <Bar dataKey="total" fill="#7a2230" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/GraficoCategorias.tsx src/components/dashboard/GraficoTendencia.tsx
git commit -m "feat(ui): gráficos del dashboard con paleta cálida Bosca"
```

---

## Task 10: Página del dashboard

**Files:** Modify `src/app/dashboard/page.tsx`

**Contexto:** Cabecera carbón con marca; pendientes en ámbar. Solo colores; la lógica NO cambia. Ediciones puntuales.

- [ ] **Step 1: Cabecera carbón**

En `src/app/dashboard/page.tsx`, reemplaza el `<header>` completo por:
```tsx
      <header className="flex items-center justify-between border-b border-bosca-carbon bg-bosca-carbon px-4 py-3">
        <span className="font-semibold text-bosca-crema">🔥 Bosca · Dashboard</span>
        <Link
          href="/"
          className="rounded-lg border border-white/25 px-3 py-1 text-xs text-bosca-crema hover:bg-white/10"
        >
          ← Chat
        </Link>
      </header>
```

- [ ] **Step 2: Tarjetas y acentos**

En la sección "Total del período", el número usa `text-gray-900`. Déjalo, pero cambia los contenedores de sección de `rounded-2xl border bg-white p-4` a `rounded-2xl border border-bosca-gris bg-white p-4` (aplica a las 4–5 `<section>` que existen; el borde cálido en vez del gris por defecto).

En la sección "Pendientes de aprobación", el número usa `text-2xl font-bold text-amber-600`. Cámbialo a:
```tsx
                  <p className="text-2xl font-bold text-bosca-ambar">{contarPendientes(delMes)}</p>
```

En el `<select>` del período, cambia `border` por `border border-bosca-gris`.

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: sin errores; build compila.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(ui): cabecera y acentos Bosca en el dashboard"
```

---

## Task 11: Verificación global

**Files:** ninguno (verificación)

- [ ] **Step 1: Suite completa, tipos y build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc limpio; **104 tests en verde** (la lógica no cambió); `npm run build` compila.

- [ ] **Step 2: Nota de verificación en vivo (tras desplegar)**

Tras `vercel --prod`, abrir en incógnito (para evitar caché):
- Login con look Bosca (🔥, burdeo).
- Chat: cabecera carbón, saludo "Hola {nombre} 👋", burbujas burdeo/gris, Enviar burdeo.
- Onboarding (si aplica) con botón burdeo.
- Dashboard: cabecera carbón, gráficos en tonos tierra, pendientes en ámbar.

---

## Self-Review (cobertura del spec)

- **Tokens del tema Bosca (spec §Paleta):** Task 1. ✅
- **Cabeceras carbón + marca (spec §Cambios):** Task 6 (chat), Task 10 (dashboard). ✅
- **Saludo con nombre (spec §Saludo):** Task 6 Step 1. ✅
- **Burbujas burdeo/gris (spec):** Task 2. ✅
- **Botones primarios burdeo (spec):** Tasks 3, 4, 5, 6, 7. ✅
- **Barra de entrada (spec):** Task 3. ✅
- **Tarjeta de confirmación / onboarding (spec):** Tasks 4, 5. ✅
- **Login marca Bosca (spec):** Task 7. ✅
- **Dashboard + gráficos paleta cálida + pendientes ámbar (spec):** Tasks 9, 10. ✅
- **AuthGate / carga (spec):** Task 8. ✅
- **Sin cambios de lógica; 104 tests verdes (spec §Verificación):** Task 11 lo verifica. ✅

**Sin placeholders:** todo el código/ediciones están completas. **Consistencia:** todos los
componentes usan los mismos tokens `bosca-*` definidos en Task 1; el saludo usa `perfil.nombre` que
ya existe en `Chat`.

**Nota:** es un rediseño visual; no hay unidades nuevas testeables. La verificación es build +
revisión visual + despliegue (Task 11). Los 104 tests existentes son la red de seguridad de que la
lógica no se rompió.
