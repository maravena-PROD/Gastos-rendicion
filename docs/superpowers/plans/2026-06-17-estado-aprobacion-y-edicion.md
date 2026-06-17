# Estado de aprobación + edición/reenvío — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el usuario vea en el Dashboard qué se le aprobó (totales por Rendición/Devolución) y qué se le rechazó (con motivo), y pueda editar y reenviar un gasto rechazado; y que el enlace "Aprobaciones" esté también en el Dashboard.

**Architecture:** Capa de datos: un writer de fila ya existente se generaliza (`actualizarGasto`). Lógica pura nueva: `puedeEditar`, helpers de dashboard, y `construirCamposGasto` (validación compartida creación/edición). Una ruta `POST /api/gastos/[id]/editar` reusa todo. UI: `TarjetaConfirmacion` se parametriza para servir creación y edición; el Dashboard gana una sección de estado + modal de corrección + enlace a Aprobaciones.

**Tech Stack:** Next.js 16 (App Router, `params` async), React 19, TypeScript, Google Sheets (googleapis), Vitest. Español en código/UI.

## Global Constraints

- Editable solo por el **dueño** (`gasto.usuarioEmail` == sesión, case-insensitive) y solo gastos **`Rechazado`**.
- Al reenviar: `estado="Registrado"`, y `aprobadoPor`/`fechaDecision`/`motivo` vuelven a `""`.
- Sin columnas nuevas en planillas. La imagen original del gasto se conserva (no se re-sube).
- Devolución exige banco+cuenta (en perfil o payload); si vienen en el payload, se persisten al perfil — misma regla que al crear.
- Auth: Bearer (`getBearerToken`) + `autenticar`; errores como `{ error }`. Spanish en código/UI.
- La sección "Estado de mis gastos" del Dashboard respeta el rango Desde/Hasta (`delRango`).
- Commits en español, conventional, terminando con:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Verificación tras cada tarea: `npm test` y `npx tsc --noEmit` en verde (las tareas con rutas/UI además `npm run build`).

---

### Task 1: `puedeEditar` (permiso de edición)

**Files:**
- Modify: `src/lib/aprobaciones.ts`
- Test: `src/lib/aprobaciones.test.ts`

**Interfaces:**
- Consumes: `SesionUsuario` (`./auth`), `Gasto` (`./types`).
- Produces: `puedeEditar(sesion: SesionUsuario, gasto: Gasto): boolean`.

- [ ] **Step 1: Test que falla**

En `src/lib/aprobaciones.test.ts`, agrega al import `puedeEditar` y al final:

```ts
describe("puedeEditar", () => {
  it("el dueño puede editar su gasto Rechazado", () => {
    expect(puedeEditar(sesion({ email: "u@bosca.cl" }), gasto({ estado: "Rechazado", usuarioEmail: "U@bosca.cl" }))).toBe(true);
  });
  it("no puede si no es Rechazado", () => {
    expect(puedeEditar(sesion({ email: "u@bosca.cl" }), gasto({ estado: "Registrado", usuarioEmail: "u@bosca.cl" }))).toBe(false);
    expect(puedeEditar(sesion({ email: "u@bosca.cl" }), gasto({ estado: "Aprobado", usuarioEmail: "u@bosca.cl" }))).toBe(false);
  });
  it("no puede editar el gasto de otro", () => {
    expect(puedeEditar(sesion({ email: "u@bosca.cl" }), gasto({ estado: "Rechazado", usuarioEmail: "otro@bosca.cl" }))).toBe(false);
  });
});
```

(El archivo ya tiene los helpers `sesion(...)` y `gasto(...)` de la feature anterior.)

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run src/lib/aprobaciones.test.ts`
Expected: FAIL (`puedeEditar` no exportado).

- [ ] **Step 3: Implementar**

En `src/lib/aprobaciones.ts`, al final:

```ts
/** Solo el dueño puede editar/reenviar, y solo si el gasto está Rechazado. */
export function puedeEditar(sesion: SesionUsuario, gasto: Gasto): boolean {
  return (
    gasto.estado === "Rechazado" &&
    gasto.usuarioEmail.toLowerCase() === sesion.email.toLowerCase()
  );
}
```

- [ ] **Step 4: Ver pasar**

Run: `npx vitest run src/lib/aprobaciones.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aprobaciones.ts src/lib/aprobaciones.test.ts
git commit -m "feat(aprobaciones): puedeEditar (dueño + estado Rechazado)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Helpers de estado en el Dashboard

**Files:**
- Modify: `src/lib/dashboard.ts`
- Test: `src/lib/dashboard.test.ts`

**Interfaces:**
- Consumes: `Gasto`, `porTipoRendicion` (ya en `dashboard.ts`).
- Produces:
  - `aprobadosPorTipo(gastos: Gasto[]): { rendicion: number; devolucion: number; total: number }`
  - `rechazados(gastos: Gasto[]): Gasto[]`

- [ ] **Step 1: Test que falla**

En `src/lib/dashboard.test.ts`, agrega al import `aprobadosPorTipo, rechazados` y:

```ts
describe("aprobadosPorTipo", () => {
  it("suma solo Aprobados, separando rendición y devolución", () => {
    const datos = [
      g({ estado: "Aprobado", tipoRendicion: "Rendicion", monto: 1000 }),
      g({ estado: "Aprobado", tipoRendicion: "Devolucion", monto: 500 }),
      g({ estado: "Registrado", tipoRendicion: "Rendicion", monto: 999 }), // ignorado
      g({ estado: "Rechazado", tipoRendicion: "Devolucion", monto: 999 }), // ignorado
    ];
    expect(aprobadosPorTipo(datos)).toEqual({ rendicion: 1000, devolucion: 500, total: 1500 });
  });
});

describe("rechazados", () => {
  it("devuelve solo los gastos en estado Rechazado", () => {
    const datos = [g({ id: "a", estado: "Rechazado" }), g({ id: "b", estado: "Aprobado" })];
    expect(rechazados(datos).map((x) => x.id)).toEqual(["a"]);
  });
});
```

(El archivo ya tiene el helper `g(...)`.)

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run src/lib/dashboard.test.ts`
Expected: FAIL (exports faltan).

- [ ] **Step 3: Implementar**

En `src/lib/dashboard.ts`, al final:

```ts
/** Totales de los gastos Aprobados, separados por tipo de rendición. */
export function aprobadosPorTipo(gastos: Gasto[]): { rendicion: number; devolucion: number; total: number } {
  const t = porTipoRendicion(gastos.filter((g) => g.estado === "Aprobado"));
  return { ...t, total: t.rendicion + t.devolucion };
}

/** Gastos en estado Rechazado. */
export function rechazados(gastos: Gasto[]): Gasto[] {
  return gastos.filter((g) => g.estado === "Rechazado");
}
```

- [ ] **Step 4: Ver pasar**

Run: `npx vitest run src/lib/dashboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard.ts src/lib/dashboard.test.ts
git commit -m "feat(dashboard): helpers aprobadosPorTipo y rechazados" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Renombrar `actualizarDecisionGasto` → `actualizarGasto`

**Files:**
- Modify: `src/lib/sheets.ts`, `src/app/api/gastos/[id]/decision/route.ts`
- Test: `src/lib/sheets.test.ts`

**Interfaces:**
- Produces: `actualizarGasto(gasto: Gasto): Promise<void>` (mismo comportamiento que antes: reescribe la fila A:AD localizada por `id`).

- [ ] **Step 1: Renombrar en `sheets.ts`**

En `src/lib/sheets.ts`, cambia el nombre y el comentario de la función `actualizarDecisionGasto`:

```ts
/** Reescribe la fila de un gasto (localizada por id en col A) con sus campos actuales. */
export async function actualizarGasto(gasto: Gasto): Promise<void> {
```
(El cuerpo no cambia.)

- [ ] **Step 2: Actualizar el llamador (ruta de decisión)**

En `src/app/api/gastos/[id]/decision/route.ts`: en el import desde `@/lib/sheets`, reemplaza `actualizarDecisionGasto` por `actualizarGasto`, y la llamada `await actualizarDecisionGasto(decidido)` por `await actualizarGasto(decidido)`.

- [ ] **Step 3: Actualizar el test**

En `src/lib/sheets.test.ts`: reemplaza `actualizarDecisionGasto` por `actualizarGasto` en el import y en el `describe(...)`/llamadas (renombre el título del describe a `"actualizarGasto"`).

- [ ] **Step 4: Verificar**

Run: `npm test && npx tsc --noEmit`
Expected: PASS (sin referencias colgando a `actualizarDecisionGasto`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets.ts "src/app/api/gastos/[id]/decision/route.ts" src/lib/sheets.test.ts
git commit -m "refactor(sheets): actualizarDecisionGasto -> actualizarGasto (writer genérico)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Extraer la lógica compartida de creación de gasto

Extrae la validación/armado de campos y el manejo de cuenta para devolución a helpers reutilizables, y refactoriza el `POST /api/gastos` para usarlos (comportamiento idéntico). Es un solo entregable porque el refactor de la ruta debe quedar verde junto con los helpers.

**Files:**
- Create: `src/lib/gasto-payload.ts`, `src/lib/gasto-cuenta.ts`
- Modify: `src/app/api/gastos/route.ts`
- Test: `src/lib/gasto-payload.test.ts`, `src/lib/gasto-cuenta.test.ts`

**Interfaces:**
- Produces:
  - `construirCamposGasto(body: PayloadGasto, catalogo: CentroCostoEntry[]): { ok: true; campos: CamposGasto } | { ok: false; error: string }`
  - `CamposGasto = { comercio: string; monto: number; categoria: Categoria; fechaDocumento: string; rutEmisor: string; numeroDocumento: string; direccion: string; observacion: string; imputacion: Imputacion; tipoRendicion: TipoRendicion; tipoDocumento: TipoDocumento; montoNeto: number; iva: number }`
  - `asegurarCuentaDevolucion(email: string, body: { banco?: string; cuentaCorriente?: string }, deps?): Promise<{ ok: true } | { ok: false; status: 400 | 502; error: string }>`

- [ ] **Step 1: Tests de `construirCamposGasto`**

Crea `src/lib/gasto-payload.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { construirCamposGasto } from "./gasto-payload";
import type { CentroCostoEntry } from "./types";

const catalogo: CentroCostoEntry[] = [
  { ccCodigo: "C0100", ccDetalle: "Gcia. Operaciones", areaCodigo: "A1010", areaDetalle: "G.Oper", ubicacionCodigo: "T9510", ubicacionDetalle: "Casa Matriz" },
];
const base = {
  comercio: "Copec", monto: 45000, categoria: "Combustible", fechaDocumento: "2026-06-10",
  centroCostoCodigo: "C0100", areaCodigo: "A1010", ubicacionCodigo: "T9510",
  tipoRendicion: "Rendicion", tipoDocumento: "Boleta",
};

describe("construirCamposGasto", () => {
  it("arma los campos cuando el payload es válido", () => {
    const r = construirCamposGasto(base, catalogo);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.campos.imputacion.centroCostoDetalle).toBe("Gcia. Operaciones");
      expect(r.campos.categoria).toBe("Combustible");
      expect(r.campos.rutEmisor).toBe(""); // opcionales ausentes -> ""
      expect(r.campos.tipoRendicion).toBe("Rendicion");
    }
  });
  it("rechaza si faltan datos esenciales", () => {
    const r = construirCamposGasto({ ...base, monto: 0 }, catalogo);
    expect(r).toEqual({ ok: false, error: "Faltan datos esenciales (comercio, monto, categoría, fecha)" });
  });
  it("rechaza si falta la imputación en el payload", () => {
    const r = construirCamposGasto({ ...base, areaCodigo: "" }, catalogo);
    expect(r.ok).toBe(false);
  });
  it("rechaza si la combinación de imputación no existe en el catálogo", () => {
    const r = construirCamposGasto({ ...base, ubicacionCodigo: "T0000" }, catalogo);
    expect(r).toEqual({ ok: false, error: "La combinación de centro de costo / área / ubicación no es válida" });
  });
});
```

- [ ] **Step 2: Ver fallar**

Run: `npx vitest run src/lib/gasto-payload.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 3: Implementar `gasto-payload.ts`**

Crea `src/lib/gasto-payload.ts`:

```ts
import type { Categoria, Imputacion, TipoRendicion, TipoDocumento, CentroCostoEntry } from "./types";
import { normalizarCategoria } from "./extraccion";
import { resolverImputacion } from "./centros-costo";
import { calcularNetoIva } from "./montos";

export interface PayloadGasto {
  comercio?: string; monto?: number; categoria?: string; fechaDocumento?: string;
  rutEmisor?: string; numeroDocumento?: string; direccion?: string; observacion?: string;
  centroCostoCodigo?: string; areaCodigo?: string; ubicacionCodigo?: string;
  tipoRendicion?: string; tipoDocumento?: string; montoNeto?: number; iva?: number;
}

export interface CamposGasto {
  comercio: string; monto: number; categoria: Categoria; fechaDocumento: string;
  rutEmisor: string; numeroDocumento: string; direccion: string; observacion: string;
  imputacion: Imputacion; tipoRendicion: TipoRendicion; tipoDocumento: TipoDocumento;
  montoNeto: number; iva: number;
}

export type ResultadoCampos = { ok: true; campos: CamposGasto } | { ok: false; error: string };

/** Valida el payload y arma los campos comunes de un gasto. Errores = 400. */
export function construirCamposGasto(body: PayloadGasto, catalogo: CentroCostoEntry[]): ResultadoCampos {
  const categoria = normalizarCategoria(body.categoria ?? null);
  if (
    !body.comercio ||
    typeof body.monto !== "number" ||
    !Number.isInteger(body.monto) ||
    body.monto <= 0 ||
    !categoria ||
    !body.fechaDocumento
  ) {
    return { ok: false, error: "Faltan datos esenciales (comercio, monto, categoría, fecha)" };
  }
  if (!body.centroCostoCodigo || !body.areaCodigo || !body.ubicacionCodigo) {
    return { ok: false, error: "Falta la imputación: centro de costo, área y ubicación" };
  }
  const imputacion = resolverImputacion(catalogo, body.centroCostoCodigo, body.areaCodigo, body.ubicacionCodigo);
  if (!imputacion) {
    return { ok: false, error: "La combinación de centro de costo / área / ubicación no es válida" };
  }
  const tipoRendicion: TipoRendicion = body.tipoRendicion === "Devolucion" ? "Devolucion" : "Rendicion";
  const tipoDocumento: TipoDocumento =
    body.tipoDocumento === "Boleta" || body.tipoDocumento === "Factura" ? body.tipoDocumento : "Otro";
  const { neto, iva } = calcularNetoIva(body.monto, tipoDocumento, {
    neto: typeof body.montoNeto === "number" && Number.isFinite(body.montoNeto) && body.montoNeto >= 0 ? body.montoNeto : null,
    iva: typeof body.iva === "number" && Number.isFinite(body.iva) && body.iva >= 0 ? body.iva : null,
  });
  return {
    ok: true,
    campos: {
      comercio: body.comercio,
      monto: body.monto,
      categoria,
      fechaDocumento: body.fechaDocumento,
      rutEmisor: body.rutEmisor ?? "",
      numeroDocumento: body.numeroDocumento ?? "",
      direccion: body.direccion ?? "",
      observacion: body.observacion ?? "",
      imputacion,
      tipoRendicion,
      tipoDocumento,
      montoNeto: neto,
      iva,
    },
  };
}
```

- [ ] **Step 4: Ver pasar `gasto-payload`**

Run: `npx vitest run src/lib/gasto-payload.test.ts`
Expected: PASS.

- [ ] **Step 5: Tests de `asegurarCuentaDevolucion` (con deps inyectadas)**

Crea `src/lib/gasto-cuenta.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { asegurarCuentaDevolucion } from "./gasto-cuenta";
import type { Usuario } from "./types";

function usuario(p: Partial<Usuario>): Usuario {
  return { email: "u@bosca.cl", nombre: "U", rol: "Usuario", activo: true, fechaAlta: "", rut: "1-9", area: "Op", banco: "", cuentaCorriente: "", apruebaCc: [], cargo: "", ...p };
}

describe("asegurarCuentaDevolucion", () => {
  it("ok si el perfil ya tiene banco y cuenta (no escribe)", async () => {
    const actualizar = vi.fn();
    const r = await asegurarCuentaDevolucion("u@bosca.cl", {}, {
      getUsuario: async () => usuario({ banco: "Santander", cuentaCorriente: "123" }),
      actualizarPerfilUsuario: actualizar,
    });
    expect(r).toEqual({ ok: true });
    expect(actualizar).not.toHaveBeenCalled();
  });
  it("400 si no hay cuenta ni en perfil ni en payload", async () => {
    const r = await asegurarCuentaDevolucion("u@bosca.cl", {}, {
      getUsuario: async () => usuario({}),
      actualizarPerfilUsuario: vi.fn(),
    });
    expect(r).toEqual({ ok: false, status: 400, error: "Una devolución requiere banco y cuenta corriente" });
  });
  it("persiste y queda ok si vienen en el payload", async () => {
    const actualizar = vi.fn(async () => {});
    const r = await asegurarCuentaDevolucion("u@bosca.cl", { banco: " BCI ", cuentaCorriente: " 999 " }, {
      getUsuario: async () => usuario({}),
      actualizarPerfilUsuario: actualizar,
    });
    expect(r).toEqual({ ok: true });
    expect(actualizar).toHaveBeenCalledWith("u@bosca.cl", expect.objectContaining({ banco: "BCI", cuentaCorriente: "999" }));
  });
});
```

- [ ] **Step 6: Ver fallar**

Run: `npx vitest run src/lib/gasto-cuenta.test.ts`
Expected: FAIL (módulo no existe).

- [ ] **Step 7: Implementar `gasto-cuenta.ts`**

Crea `src/lib/gasto-cuenta.ts`:

```ts
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
```

- [ ] **Step 8: Ver pasar `gasto-cuenta`**

Run: `npx vitest run src/lib/gasto-cuenta.test.ts`
Expected: PASS.

- [ ] **Step 9: Refactorizar `POST /api/gastos` para usar los helpers**

En `src/app/api/gastos/route.ts`:
1. Imports: quita `normalizarCategoria`, `resolverImputacion` (si solo se usaba aquí), `calcularNetoIva`, `getUsuario`, `actualizarPerfilUsuario`, y los tipos `TipoRendicion`/`TipoDocumento` si quedan sin uso. Agrega:
   ```ts
   import { construirCamposGasto } from "@/lib/gasto-payload";
   import { asegurarCuentaDevolucion } from "@/lib/gasto-cuenta";
   ```
   Mantén `listarCentrosCosto`, `appendGasto`, `crearGasto`, `listGastos`, `filtrarGastosPorRol`.
2. Reemplaza todo el bloque desde `const categoria = normalizarCategoria(...)` hasta el `const gasto = crearGasto({...})` (líneas ~60-165) por:

```ts
  let catalogo;
  try {
    catalogo = await listarCentrosCosto();
  } catch {
    return NextResponse.json({ error: "No se pudo validar la imputación" }, { status: 502 });
  }
  const r = construirCamposGasto(body, catalogo);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  const campos = r.campos;

  if (campos.tipoRendicion === "Devolucion") {
    const cuenta = await asegurarCuentaDevolucion(auth.usuario.email, body);
    if (!cuenta.ok) return NextResponse.json({ error: cuenta.error }, { status: cuenta.status });
  }

  const gasto = crearGasto({
    usuarioEmail: auth.usuario.email,
    usuarioNombre: auth.usuario.nombre,
    usuarioArea: auth.usuario.area,
    imagenUrl: body.imagenUrl,
    imagenDriveId: body.imagenDriveId,
    ...campos,
  });
```

(El `try { await appendGasto(gasto); ... }` final queda igual.)

- [ ] **Step 10: Verificar (build incluido, la ruta cambió)**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: PASS; el build lista `/api/gastos`.

- [ ] **Step 11: Commit**

```bash
git add src/lib/gasto-payload.ts src/lib/gasto-cuenta.ts src/lib/gasto-payload.test.ts src/lib/gasto-cuenta.test.ts src/app/api/gastos/route.ts
git commit -m "refactor(gastos): extraer construirCamposGasto y asegurarCuentaDevolucion" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Ruta `POST /api/gastos/[id]/editar` + cliente

**Files:**
- Create: `src/app/api/gastos/[id]/editar/route.ts`
- Modify: `src/lib/api-client.ts`

**Interfaces:**
- Consumes: `puedeEditar` (T1), `construirCamposGasto` (T4), `asegurarCuentaDevolucion` (T4), `actualizarGasto` (T3), `listGastos`, `listarCentrosCosto`.
- Produces: `editarGasto(id: string, payload: GuardarGastoInput): Promise<{ gasto: Gasto }>`.

- [ ] **Step 1: Crear la ruta**

Crea `src/app/api/gastos/[id]/editar/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos, listarCentrosCosto, actualizarGasto } from "@/lib/sheets";
import { puedeEditar } from "@/lib/aprobaciones";
import { construirCamposGasto } from "@/lib/gasto-payload";
import { asegurarCuentaDevolucion } from "@/lib/gasto-cuenta";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  let gasto;
  try {
    gasto = (await listGastos()).find((g) => g.id === id);
  } catch {
    return NextResponse.json({ error: "No se pudo leer el gasto" }, { status: 502 });
  }
  if (!gasto) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
  if (!puedeEditar(auth.usuario, gasto)) {
    return NextResponse.json({ error: "No puedes editar este gasto" }, { status: 403 });
  }

  let catalogo;
  try {
    catalogo = await listarCentrosCosto();
  } catch {
    return NextResponse.json({ error: "No se pudo validar la imputación" }, { status: 502 });
  }
  const r = construirCamposGasto(body, catalogo);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  const campos = r.campos;

  if (campos.tipoRendicion === "Devolucion") {
    const cuenta = await asegurarCuentaDevolucion(auth.usuario.email, body);
    if (!cuenta.ok) return NextResponse.json({ error: cuenta.error }, { status: cuenta.status });
  }

  // Reenvío: vuelve a Registrado y limpia la decisión previa. Conserva id, imagen, usuario, etc.
  const actualizado = {
    ...gasto,
    ...campos,
    estado: "Registrado" as const,
    aprobadoPor: "",
    fechaDecision: "",
    motivo: "",
  };
  try {
    await actualizarGasto(actualizado);
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la edición" }, { status: 502 });
  }
  return NextResponse.json({ gasto: actualizado });
}
```

- [ ] **Step 2: Cliente `editarGasto`**

En `src/lib/api-client.ts`, al final:

```ts
/** Edita un gasto rechazado y lo reenvía (vuelve a Registrado). */
export function editarGasto(id: string, payload: GuardarGastoInput): Promise<{ gasto: Gasto }> {
  return pedir<{ gasto: Gasto }>(`/api/gastos/${id}/editar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: PASS; el build lista `/api/gastos/[id]/editar`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/gastos/[id]/editar/route.ts" src/lib/api-client.ts
git commit -m "feat(gastos): ruta y cliente para editar/reenviar gasto rechazado" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Parametrizar `TarjetaConfirmacion` (creación + edición)

**Files:**
- Modify: `src/components/chat/TarjetaConfirmacion.tsx`

**Interfaces:**
- Produces: nuevas props opcionales en `TarjetaConfirmacion`:
  - `inicial?: { tipoRendicion?: TipoRendicion; centroCostoCodigo?: string; areaCodigo?: string; ubicacionCodigo?: string; observacion?: string }`
  - `titulo?: string` (default `"Revisa el gasto"`)
  - `textoConfirmar?: string` (default `"Confirmar registro"`)
- Comportamiento de creación (sin `inicial`) **idéntico** al actual.

- [ ] **Step 1: Agregar las props y usarlas en los inicializadores**

En `src/components/chat/TarjetaConfirmacion.tsx`:

1. En el objeto de props (la desestructuración del componente), agrega `inicial`, `titulo`, `textoConfirmar`. En el tipo de props añade:
   ```ts
   inicial?: {
     tipoRendicion?: TipoRendicion;
     centroCostoCodigo?: string;
     areaCodigo?: string;
     ubicacionCodigo?: string;
     observacion?: string;
   };
   titulo?: string;
   textoConfirmar?: string;
   ```
2. Cambia los `useState` que hoy arrancan vacíos/por defecto para que tomen `inicial` cuando exista:
   ```ts
   const [tipoRendicion, setTipoRendicion] = useState<TipoRendicion>(inicial?.tipoRendicion ?? "Rendicion");
   const [observacion, setObservacion] = useState(inicial?.observacion ?? "");
   const [cc, setCc] = useState(inicial?.centroCostoCodigo ?? "");
   const [area, setArea] = useState(inicial?.areaCodigo ?? "");
   const [ubicacion, setUbicacion] = useState(inicial?.ubicacionCodigo ?? "");
   ```
   (Los demás campos —comercio, monto, fecha, categoría, tipoDocumento, neto, iva— ya se inicializan desde `borrador`; el modal de edición construye un `borrador` con esos valores, ver Task 8.)
3. Usa `titulo`/`textoConfirmar` en el render:
   ```tsx
   <h3 className="mb-3 text-sm font-semibold text-bosca-carbon">{titulo ?? "Revisa el gasto"}</h3>
   ```
   y en el botón de confirmar:
   ```tsx
   {textoConfirmar ?? "Confirmar registro"}
   ```

- [ ] **Step 2: Verificar (no rompe la creación)**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS. (La página de chat sigue usando la tarjeta sin `inicial` → comportamiento por defecto.)

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/TarjetaConfirmacion.tsx
git commit -m "feat(ui): TarjetaConfirmacion parametrizable (inicial/titulo/textoConfirmar)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Dashboard — sección "Estado de mis gastos" + enlace "Aprobaciones"

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `aprobadosPorTipo`, `rechazados`, `contarPendientes` (dashboard.ts), `formatCLP`, `obtenerAprobaciones` (api-client), la respuesta de `/api/me` (`usuario.apruebaCc`).
- Produces: estado `apruebaCc`, `pendientesAprob`, y la lista de rechazados disponible para Task 8 (se renderiza aquí).

- [ ] **Step 1: Capturar `apruebaCc` y el contador; agregar el enlace en el header**

En `src/app/dashboard/page.tsx`:
1. Importa lo necesario: agrega `aprobadosPorTipo, rechazados` al import de `@/lib/dashboard`, y `obtenerAprobaciones` al import de `@/lib/api-client`.
2. Agrega estado:
   ```tsx
   const [apruebaCc, setApruebaCc] = useState<string[]>([]);
   const [pendientesAprob, setPendientesAprob] = useState(0);
   ```
3. En el `cargar()` donde ya se hace `setRol(...)`, captura también el alcance:
   ```tsx
   if (meRes.ok) {
     const u = (await meRes.json()).usuario;
     setRol(u.rol);
     setApruebaCc(u.apruebaCc ?? []);
   }
   ```
4. Tras cargar, si hay alcance, trae el contador:
   ```tsx
   useEffect(() => {
     if (apruebaCc.length === 0) return;
     obtenerAprobaciones().then(({ gastos }) => setPendientesAprob(gastos.length)).catch(() => {});
   }, [apruebaCc.length]);
   ```
5. En el `<header>`, junto al enlace "← Chat", antes de él, agrega:
   ```tsx
   {apruebaCc.length > 0 && (
     <Link href="/aprobaciones" className="rounded-lg border border-white/25 px-3 py-1 text-xs text-bosca-crema hover:bg-white/10">
       Aprobaciones{pendientesAprob > 0 ? ` (${pendientesAprob})` : ""}
     </Link>
   )}
   ```
   (Ajusta el contenedor del header a un `div` con `flex items-center gap-3` si hace falta para alinear ambos enlaces, como en la cabecera del chat.)

- [ ] **Step 2: Sección "Estado de mis gastos"**

Dentro del bloque que se muestra cuando hay datos (`fechas.length > 0`), agrega una `section` (después de "Rendiciones vs Devoluciones"):

```tsx
<section className="rounded-2xl border border-bosca-gris bg-white p-4">
  <h2 className="mb-2 text-sm font-semibold text-gray-700">Estado de mis gastos</h2>
  {(() => {
    const aprob = aprobadosPorTipo(delRango);
    const rech = rechazados(delRango);
    const pend = contarPendientes(delRango);
    return (
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-gray-500">Aprobado (Rendición)</p>
            <p className="text-lg font-bold text-gray-900">{formatCLP(aprob.rendicion)}</p>
          </div>
          <div>
            <p className="text-gray-500">Aprobado (Devolución)</p>
            <p className="text-lg font-bold text-bosca-ambar">{formatCLP(aprob.devolucion)}</p>
          </div>
          <div>
            <p className="text-gray-500">Pendientes</p>
            <p className="text-lg font-bold text-gray-900">{pend}</p>
          </div>
        </div>
        <div>
          <p className="mb-1 text-gray-500">Rechazados ({rech.length})</p>
          {rech.length === 0 ? (
            <p className="text-xs text-gray-400">No tienes gastos rechazados.</p>
          ) : (
            <ul className="divide-y">
              {rech.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-gray-700">
                    {g.fechaDocumento} · {g.comercio} · {formatCLP(g.monto)}
                    {g.motivo ? ` — ${g.motivo}` : ""}
                  </span>
                  {/* El botón "Corregir" se conecta en la Task 8 */}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  })()}
</section>
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS; el build compila `/dashboard`.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): sección Estado de mis gastos y enlace Aprobaciones" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Dashboard — modal "Corregir" (editar y reenviar)

**Files:**
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Consumes: `TarjetaConfirmacion` (T6, con `inicial`/`titulo`/`textoConfirmar`), `editarGasto` (T5), `obtenerCentrosCosto`, `obtenerPerfil` (para `cuentaActual`), `Gasto`, `GuardarGastoInput`.

- [ ] **Step 1: Cargar catálogo y cuenta; estado del modal**

En `src/app/dashboard/page.tsx`:
1. Imports: `TarjetaConfirmacion` desde `@/components/chat/TarjetaConfirmacion`; `editarGasto, obtenerCentrosCosto, obtenerPerfil, type GuardarGastoInput` desde `@/lib/api-client`; `type CentroCostoEntry` desde `@/lib/types`.
2. Estado:
   ```tsx
   const [catalogoCC, setCatalogoCC] = useState<CentroCostoEntry[]>([]);
   const [cuenta, setCuenta] = useState({ banco: "", cuentaCorriente: "" });
   const [editando, setEditando] = useState<Gasto | null>(null);
   ```
3. En `useEffect` de carga inicial (mejor esfuerzo, no rompe el dashboard):
   ```tsx
   obtenerCentrosCosto().then(({ centros }) => setCatalogoCC(centros)).catch(() => {});
   obtenerPerfil().then((p) => setCuenta({ banco: p.banco, cuentaCorriente: p.cuentaCorriente })).catch(() => {});
   ```

- [ ] **Step 2: Botón "Corregir" en cada rechazado**

En la `<li>` de cada rechazado (Task 7, donde está el comentario), agrega el botón:

```tsx
<button
  onClick={() => setEditando(g)}
  className="shrink-0 rounded-lg border border-bosca-gris px-3 py-1 text-xs text-bosca-carbon hover:bg-bosca-gris"
>
  Corregir
</button>
```

- [ ] **Step 3: Render del modal con la tarjeta precargada**

Al final del contenedor principal (antes de cerrar el `<div>` raíz del dashboard), agrega:

```tsx
{editando && (
  <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
    <div className="w-full max-w-md">
      <TarjetaConfirmacion
        borrador={{
          comercio: editando.comercio,
          monto: editando.monto,
          fechaDocumento: editando.fechaDocumento,
          categoria: editando.categoria,
          rutEmisor: editando.rutEmisor || null,
          numeroDocumento: editando.numeroDocumento || null,
          direccion: editando.direccion || null,
          tipoDocumento: editando.tipoDocumento,
          montoNeto: editando.montoNeto,
          iva: editando.iva,
        }}
        inicial={{
          tipoRendicion: editando.tipoRendicion,
          centroCostoCodigo: editando.imputacion.centroCostoCodigo,
          areaCodigo: editando.imputacion.areaCodigo,
          ubicacionCodigo: editando.imputacion.ubicacionCodigo,
          observacion: editando.observacion,
        }}
        imagenUrl={editando.imagenUrl || undefined}
        imagenDriveId={editando.imagenDriveId || undefined}
        catalogo={catalogoCC}
        cuentaActual={cuenta}
        titulo="Corregir gasto"
        textoConfirmar="Reenviar"
        deshabilitado={false}
        onConfirmar={async (datos: GuardarGastoInput) => {
          try {
            await editarGasto(editando.id, datos);
            setGastos((xs) => xs.map((x) => (x.id === editando.id ? { ...x, estado: "Registrado" } : x)));
            setEditando(null);
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo reenviar el gasto.");
          }
        }}
        onCancelar={() => setEditando(null)}
      />
    </div>
  </div>
)}
```

(Al reenviar, el gasto pasa a `Registrado` localmente, por lo que sale de la lista de "Rechazados" y suma a "Pendientes" sin recargar.)

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run build && npm test`
Expected: PASS; build compila `/dashboard`.

- [ ] **Step 5: Verificación manual (dev server)**

Run: `npm run dev`; entra como un usuario con un gasto Rechazado, abre Dashboard → "Estado de mis gastos" → "Corregir" → edita y "Reenviar"; el gasto sale de Rechazados. (Si no hay datos Rechazados, este paso se valida en la prueba end-to-end.)

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): modal Corregir para editar y reenviar gastos rechazados" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación final

- [ ] `npm test` — toda la suite verde (nuevos: aprobaciones.puedeEditar, dashboard helpers, gasto-payload, gasto-cuenta).
- [ ] `npx tsc --noEmit` — sin errores.
- [ ] `npm run build` — compila con `/api/gastos/[id]/editar` y `/dashboard`.
- [ ] Prueba manual: un usuario ve sus aprobados (totales), pendientes y rechazados (con motivo); "Corregir" edita y reenvía; el gasto vuelve a Registrado y reaparece en la bandeja del gerente correspondiente.
