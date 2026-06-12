# Plan 5 — Dashboard (gráficos y resúmenes) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el dashboard: total de gastos del período, desglose por categoría (donut), tendencia por día (barras), y —solo para Administrador— total por usuario y conteo de pendientes. La página `/dashboard` filtra por mes y respeta el rol (el backend ya filtra los gastos que el usuario puede ver).

**Architecture:** Las agregaciones (filtrar por mes, totales, por categoría, por usuario, tendencia, pendientes) son **funciones puras testeables** en `dashboard.ts`. Los gráficos son componentes finos sobre Recharts. La página `/dashboard` obtiene los gastos con `obtenerGastos` (Plan 4, ya filtrados por rol en el servidor) y el rol con `/api/me`, calcula las agregaciones del mes seleccionado y las renderiza. Solo las agregaciones llevan pruebas; los gráficos y la página se verifican con `npm run build`.

**Tech Stack:** Next.js 16 (App Router, client components), TypeScript, Tailwind CSS, Recharts, Vitest. Reusa Plan 1 (`types.ts`, `format.ts`), Plan 2 (`AuthGate`, `firebase-client`), Plan 4 (`api-client`).

---

## Estructura de archivos (Plan 5)

| Archivo | Responsabilidad |
|---|---|
| `src/lib/dashboard.ts` | Agregaciones puras: `filtrarPorMes`, `totalGastos`, `porCategoria`, `porUsuario`, `tendenciaPorDia`, `contarPendientes`, `mesesDisponibles` |
| `src/lib/dashboard.test.ts` | Pruebas de las agregaciones |
| `src/components/dashboard/GraficoCategorias.tsx` | Donut por categoría (Recharts) |
| `src/components/dashboard/GraficoTendencia.tsx` | Barras de tendencia por día (Recharts) |
| `src/app/dashboard/page.tsx` | Página del dashboard (filtro de mes, totales, gráficos, vista admin) |
| `src/app/page.tsx` | Agregar enlace a `/dashboard` en la cabecera del chat (modificación) |

---

## Task 0: Dependencia de gráficos

**Files:**
- Modify: `package.json` (vía npm install)

- [ ] **Step 1: Instalar Recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: dependencia recharts para gráficos del dashboard"
```

---

## Task 1: Agregaciones puras del dashboard

**Files:**
- Create: `src/lib/dashboard.ts`
- Test: `src/lib/dashboard.test.ts`

**Contexto:** Toda la lógica de cálculo del dashboard, aislada y testeable. El filtro por mes usa
`fechaDocumento` (la fecha del gasto, formato `AAAA-MM-DD`); un mes es `AAAA-MM`. Los desgloses se
ordenan de mayor a menor; la tendencia, cronológicamente. "Pendiente" = `estado === "Registrado"`.

- [ ] **Step 1: Escribir las pruebas que fallan**

Create `src/lib/dashboard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  filtrarPorMes,
  totalGastos,
  porCategoria,
  porUsuario,
  tendenciaPorDia,
  contarPendientes,
  mesesDisponibles,
} from "./dashboard";
import type { Gasto } from "./types";

function g(parcial: Partial<Gasto>): Gasto {
  return {
    id: "",
    fechaRegistro: "",
    usuarioEmail: "",
    usuarioNombre: "",
    fechaDocumento: "2026-06-10",
    comercio: "",
    rutEmisor: "",
    numeroDocumento: "",
    categoria: "Otros",
    monto: 0,
    direccion: "",
    observacion: "",
    imagenUrl: "",
    imagenDriveId: "",
    estado: "Registrado",
    fechaCreacion: "",
    ...parcial,
  };
}

const gastos: Gasto[] = [
  g({ id: "a", fechaDocumento: "2026-06-05", categoria: "Combustible", monto: 30000, usuarioNombre: "Ana", estado: "Registrado" }),
  g({ id: "b", fechaDocumento: "2026-06-10", categoria: "Combustible", monto: 20000, usuarioNombre: "Beto", estado: "Aprobado" }),
  g({ id: "c", fechaDocumento: "2026-06-10", categoria: "Alimentación", monto: 15000, usuarioNombre: "Ana", estado: "Registrado" }),
  g({ id: "d", fechaDocumento: "2026-05-20", categoria: "Peajes", monto: 5000, usuarioNombre: "Ana", estado: "Registrado" }),
];

describe("filtrarPorMes", () => {
  it("filtra por fechaDocumento del año-mes dado", () => {
    const r = filtrarPorMes(gastos, "2026-06");
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("devuelve [] si no hay gastos en el mes", () => {
    expect(filtrarPorMes(gastos, "2026-01")).toEqual([]);
  });
});

describe("totalGastos", () => {
  it("suma los montos", () => {
    expect(totalGastos(gastos)).toBe(70000);
  });
  it("0 para lista vacía", () => {
    expect(totalGastos([])).toBe(0);
  });
});

describe("porCategoria", () => {
  it("agrupa por categoría y ordena de mayor a menor", () => {
    const r = porCategoria(filtrarPorMes(gastos, "2026-06"));
    expect(r).toEqual([
      { categoria: "Combustible", total: 50000 },
      { categoria: "Alimentación", total: 15000 },
    ]);
  });
});

describe("porUsuario", () => {
  it("agrupa por usuario y ordena de mayor a menor", () => {
    const r = porUsuario(filtrarPorMes(gastos, "2026-06"));
    expect(r).toEqual([
      { usuario: "Ana", total: 45000 },
      { usuario: "Beto", total: 20000 },
    ]);
  });
});

describe("tendenciaPorDia", () => {
  it("agrupa por día y ordena cronológicamente", () => {
    const r = tendenciaPorDia(filtrarPorMes(gastos, "2026-06"));
    expect(r).toEqual([
      { fecha: "2026-06-05", total: 30000 },
      { fecha: "2026-06-10", total: 35000 },
    ]);
  });
});

describe("contarPendientes", () => {
  it("cuenta los gastos en estado Registrado", () => {
    expect(contarPendientes(gastos)).toBe(3);
  });
});

describe("mesesDisponibles", () => {
  it("devuelve los año-meses presentes, de más reciente a más antiguo", () => {
    expect(mesesDisponibles(gastos)).toEqual(["2026-06", "2026-05"]);
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/dashboard.test.ts`
Expected: FAIL — "filtrarPorMes is not a function".

- [ ] **Step 3: Implementar las agregaciones**

Create `src/lib/dashboard.ts`:

```ts
import type { Gasto, Categoria } from "./types";

/** Filtra los gastos cuya fechaDocumento cae en el año-mes dado ("AAAA-MM"). */
export function filtrarPorMes(gastos: Gasto[], anioMes: string): Gasto[] {
  return gastos.filter((g) => g.fechaDocumento.startsWith(anioMes));
}

/** Suma total de los montos. */
export function totalGastos(gastos: Gasto[]): number {
  return gastos.reduce((acc, g) => acc + g.monto, 0);
}

/** Total agrupado por categoría, ordenado de mayor a menor. */
export function porCategoria(gastos: Gasto[]): { categoria: Categoria; total: number }[] {
  const mapa = new Map<Categoria, number>();
  for (const g of gastos) {
    mapa.set(g.categoria, (mapa.get(g.categoria) ?? 0) + g.monto);
  }
  return [...mapa.entries()]
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total);
}

/** Total agrupado por usuario (nombre, o email si no hay nombre), de mayor a menor. */
export function porUsuario(gastos: Gasto[]): { usuario: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const g of gastos) {
    const clave = g.usuarioNombre || g.usuarioEmail;
    mapa.set(clave, (mapa.get(clave) ?? 0) + g.monto);
  }
  return [...mapa.entries()]
    .map(([usuario, total]) => ({ usuario, total }))
    .sort((a, b) => b.total - a.total);
}

/** Total por día (fechaDocumento), ordenado cronológicamente. */
export function tendenciaPorDia(gastos: Gasto[]): { fecha: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const g of gastos) {
    mapa.set(g.fechaDocumento, (mapa.get(g.fechaDocumento) ?? 0) + g.monto);
  }
  return [...mapa.entries()]
    .map(([fecha, total]) => ({ fecha, total }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Cuenta los gastos pendientes de aprobación (estado Registrado). */
export function contarPendientes(gastos: Gasto[]): number {
  return gastos.filter((g) => g.estado === "Registrado").length;
}

/** Año-meses presentes en los gastos (de fechaDocumento), de más reciente a más antiguo. */
export function mesesDisponibles(gastos: Gasto[]): string[] {
  const set = new Set<string>();
  for (const g of gastos) {
    if (g.fechaDocumento.length >= 7) set.add(g.fechaDocumento.slice(0, 7));
  }
  return [...set].sort((a, b) => b.localeCompare(a));
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/dashboard.test.ts`
Expected: PASS — todas las pruebas pasan.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dashboard.ts src/lib/dashboard.test.ts
git commit -m "feat: agregaciones puras del dashboard con tests"
```

---

## Task 2: Componentes de gráficos (Recharts)

**Files:**
- Create: `src/components/dashboard/GraficoCategorias.tsx`
- Create: `src/components/dashboard/GraficoTendencia.tsx`

**Contexto:** Dos gráficos finos: un donut por categoría y barras de tendencia. Reciben datos ya
agregados (Task 1) y formatean los montos con `formatCLP` (Plan 1). Si no hay datos, muestran un
texto neutro.

- [ ] **Step 1: Implementar el donut por categoría**

Create `src/components/dashboard/GraficoCategorias.tsx`:

```tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatCLP } from "@/lib/format";

const COLORES = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
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
        <Tooltip formatter={(v: number) => formatCLP(v)} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Implementar las barras de tendencia**

Create `src/components/dashboard/GraficoTendencia.tsx`:

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
        <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={(v: number) => formatCLP(v)} width={72} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v: number) => formatCLP(v)} />
        <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/GraficoCategorias.tsx src/components/dashboard/GraficoTendencia.tsx
git commit -m "feat: gráficos de categorías (donut) y tendencia (barras) con Recharts"
```

---

## Task 3: Página del dashboard

**Files:**
- Create: `src/app/dashboard/page.tsx`

**Contexto:** Página protegida que obtiene los gastos (ya filtrados por rol en el servidor) y el rol
del usuario, ofrece un selector de mes, y muestra: total del mes, donut por categoría, tendencia por
día. Si es Administrador, además muestra total por usuario y el conteo de pendientes. Enlace de
vuelta al chat.

- [ ] **Step 1: Implementar la página**

Create `src/app/dashboard/page.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { getIdTokenActual } from "@/lib/firebase-client";
import { obtenerGastos } from "@/lib/api-client";
import type { Gasto } from "@/lib/types";
import {
  filtrarPorMes,
  totalGastos,
  porCategoria,
  porUsuario,
  tendenciaPorDia,
  contarPendientes,
  mesesDisponibles,
} from "@/lib/dashboard";
import { formatCLP } from "@/lib/format";
import { GraficoCategorias } from "@/components/dashboard/GraficoCategorias";
import { GraficoTendencia } from "@/components/dashboard/GraficoTendencia";

function Dashboard() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [rol, setRol] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mesElegido, setMesElegido] = useState<string>("");

  useEffect(() => {
    async function cargar() {
      try {
        const token = await getIdTokenActual();
        if (token) {
          const meRes = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
          if (meRes.ok) setRol((await meRes.json()).usuario.rol);
        }
        const { gastos } = await obtenerGastos();
        setGastos(gastos);
      } catch {
        setError("No se pudieron cargar los gastos.");
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, []);

  const meses = useMemo(() => mesesDisponibles(gastos), [gastos]);
  const mesActivo = mesElegido || meses[0] || "";
  const delMes = useMemo(
    () => (mesActivo ? filtrarPorMes(gastos, mesActivo) : []),
    [gastos, mesActivo],
  );
  const esAdmin = rol === "Administrador";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3">
        <span className="font-semibold text-gray-800">Dashboard</span>
        <Link href="/" className="rounded-lg border px-3 py-1 text-xs">
          ← Chat
        </Link>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {cargando ? (
          <p className="text-center text-sm text-gray-400">Cargando…</p>
        ) : error ? (
          <p className="text-center text-sm text-red-600">{error}</p>
        ) : meses.length === 0 ? (
          <p className="text-center text-sm text-gray-400">Aún no hay gastos registrados.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Período:</label>
              <select
                className="rounded-lg border px-3 py-1 text-sm text-gray-900"
                value={mesActivo}
                onChange={(e) => setMesElegido(e.target.value)}
              >
                {meses.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <section className="rounded-2xl border bg-white p-4">
              <p className="text-xs text-gray-500">Total del período</p>
              <p className="text-3xl font-bold text-gray-900">{formatCLP(totalGastos(delMes))}</p>
              <p className="text-sm text-gray-400">{delMes.length} gastos</p>
            </section>

            <section className="rounded-2xl border bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Por categoría</h2>
              <GraficoCategorias datos={porCategoria(delMes)} />
            </section>

            <section className="rounded-2xl border bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Tendencia</h2>
              <GraficoTendencia datos={tendenciaPorDia(delMes)} />
            </section>

            {esAdmin && (
              <>
                <section className="rounded-2xl border bg-white p-4">
                  <h2 className="mb-2 text-sm font-semibold text-gray-700">Por usuario</h2>
                  <ul className="divide-y text-sm">
                    {porUsuario(delMes).map((u) => (
                      <li key={u.usuario} className="flex justify-between py-1.5">
                        <span className="text-gray-700">{u.usuario}</span>
                        <span className="font-medium text-gray-900">{formatCLP(u.total)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-2xl border bg-white p-4">
                  <p className="text-xs text-gray-500">Pendientes de aprobación</p>
                  <p className="text-2xl font-bold text-amber-600">{contarPendientes(delMes)}</p>
                </section>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
```

- [ ] **Step 2: Verificar tipos y build**

Run: `npx tsc --noEmit && npm run build`
Expected: tsc sin errores; `npm run build` compila. La página es client component; Recharts solo
se usa en el cliente. Si el build falla por Recharts/prerender, reporta el error exacto.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat: página de dashboard (total, categorías, tendencia, vista admin)"
```

---

## Task 4: Enlace al dashboard desde el chat

**Files:**
- Modify: `src/app/page.tsx`

**Contexto:** Agregar un enlace "Dashboard" en la cabecera del chat para navegar entre ambas vistas.

- [ ] **Step 1: Agregar el import de Link**

En `src/app/page.tsx`, agrega cerca de los otros imports (después de `"use client";` y los imports
de React):

```tsx
import Link from "next/link";
```

- [ ] **Step 2: Agregar el enlace en la cabecera**

En la cabecera del chat (`<header>`), dentro del `<div className="flex items-center gap-3 ...">`
que contiene el nombre/rol y el botón "Salir", agrega un enlace ANTES del botón "Salir":

```tsx
          <Link href="/dashboard" className="rounded-lg border px-3 py-1 text-xs">
            Dashboard
          </Link>
```

El bloque de la cabecera debe quedar así:

```tsx
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {sesion && (
            <span>
              {sesion.nombre} · {sesion.rol}
            </span>
          )}
          <Link href="/dashboard" className="rounded-lg border px-3 py-1 text-xs">
            Dashboard
          </Link>
          <button onClick={() => cerrarSesion()} className="rounded-lg border px-3 py-1 text-xs">
            Salir
          </button>
        </div>
```

- [ ] **Step 3: Verificar tipos, suite y build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc sin errores; toda la suite (Planes 1–5) en verde; `npm run build` compila.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: enlace a /dashboard desde la cabecera del chat"
```

- [ ] **Step 5: Nota de verificación manual (requiere infraestructura real)**

Con Firebase + planilla + datos reales: `npm run dev`, inicia sesión, registra un par de gastos en
el chat, abre "Dashboard" → debe mostrar el total del mes, el donut por categoría y la tendencia.
Como Administrador, además aparecen "Por usuario" y "Pendientes".

---

## Self-Review (cobertura del Plan 5 vs spec)

- **Dashboard: total por período (Sección 8):** Task 1 (`totalGastos`/`filtrarPorMes`), Task 3
  (tarjeta de total + selector de mes). ✅
- **Gastos por categoría con gráfico interactivo (Sección 8):** Task 1 (`porCategoria`), Task 2
  (`GraficoCategorias` donut). ✅
- **Gastos por usuario (Sección 8):** Task 1 (`porUsuario`), Task 3 (solo Administrador). ✅
- **Gastos pendientes de aprobación (Sección 8):** Task 1 (`contarPendientes`), Task 3 (solo
  Administrador). ✅
- **Gráficos interactivos (Sección 8):** Recharts con tooltips (Task 2). ✅
- **Vista por rol (Sección 7):** la lista de gastos ya viene filtrada por rol del backend (Plan 3);
  el bloque admin (por usuario + pendientes) se muestra solo si `rol === "Administrador"`. ✅
- **Lo que NO cubre el Plan 5 (correcto):** la **acción** de aprobar/rechazar (v2; aquí solo se
  cuentan pendientes); voz (v2). Pendiente del proyecto: Manual de Instalación y Manual de Usuario.

**Sin placeholders:** todo el código está completo. **Consistencia de tipos:** `Gasto`, `Categoria`
usados consistentemente; la página reusa `obtenerGastos` (Plan 4) y `AuthGate` (Plan 2); los
gráficos reciben exactamente la forma que producen las agregaciones de Task 1.

**Pruebas:** `dashboard.ts` tiene pruebas exhaustivas de las agregaciones. Los gráficos y la página
son UI verificada por `npm run build` + la prueba manual de la Task 4.
