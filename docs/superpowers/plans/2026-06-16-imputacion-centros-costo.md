# Imputación de gastos por Centro de costo → Área → Ubicación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada gasto quede imputado a un centro de costo → área → ubicación, elegidos en cascada en la tarjeta de confirmación, leyendo el catálogo desde una pestaña nueva en Google Sheets.

**Architecture:** Catálogo plano (una fila por combinación válida) en la pestaña `CentrosCosto`. Lógica de filtrado en cascada pura y testeable en `src/lib/centros-costo.ts`. El cliente pide el catálogo una vez (`GET /api/centros-costo`) y arma los menús; al guardar, el servidor valida la combinación y resuelve los detalles desde el catálogo antes de persistir. El `Gasto` gana 6 columnas denormalizadas.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Google Sheets API (`googleapis`), Vitest, Tailwind. Script de carga en Node `.mjs` con `xlsx` (devDependency).

Spec: `docs/superpowers/specs/2026-06-16-imputacion-centros-costo-design.md`

---

## Estructura de archivos

**Crear:**
- `src/lib/centros-costo.ts` — lógica pura de cascada y validación.
- `src/lib/centros-costo.test.ts` — tests de la lógica.
- `src/app/api/centros-costo/route.ts` — GET del catálogo (autenticado).
- `scripts/cargar-centros-costo.mjs` — carga el `.xls` a la pestaña `CentrosCosto`.

**Modificar:**
- `src/lib/types.ts` — `Imputacion`, `CentroCostoEntry`, `IMPUTACION_VACIA`, campo `imputacion` en `Gasto`.
- `src/lib/sheets.ts` — headers/mapeo del gasto (+6 columnas), rangos `A2:W`, `listarCentrosCosto()`.
- `src/lib/sheets.test.ts` — fixture y aserciones con las columnas nuevas.
- `src/lib/gasto-factory.ts` — `imputacion` en `NuevoGastoInput` y `crearGasto`.
- `src/lib/gasto-factory.test.ts`, `src/lib/gastos-rol.test.ts`, `src/lib/dashboard.test.ts` — fixtures.
- `src/lib/api-client.ts` — `GuardarGastoInput` + `obtenerCentrosCosto()`.
- `src/app/api/gastos/route.ts` — validación de la imputación en el POST.
- `src/components/chat/TarjetaConfirmacion.tsx` — 3 `<select>` en cascada.
- `src/app/page.tsx` — carga del catálogo y prop a la tarjeta.
- `package.json` — devDependency `xlsx` y script `cargar-centros`.

**Setup manual (una vez):** agregar 6 encabezados en `Gastos!R1:W1` (lo hace el script de carga, Task 9).

---

## Task 1: Modelo de datos del gasto (tipos + factory + persistencia)

Agrega el campo `imputacion` al `Gasto` de punta a punta (tipo, factory, mapeo a fila) y actualiza los fixtures para mantener la suite verde.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/sheets.ts`
- Modify: `src/lib/gasto-factory.ts`
- Test: `src/lib/sheets.test.ts`, `src/lib/gasto-factory.test.ts`, `src/lib/gastos-rol.test.ts`, `src/lib/dashboard.test.ts`

- [ ] **Step 1: Agregar tipos en `src/lib/types.ts`**

Agrega después de la interfaz `Usuario` (o al final del archivo):

```ts
export interface Imputacion {
  centroCostoCodigo: string;
  centroCostoDetalle: string;
  areaCodigo: string;
  areaDetalle: string;
  ubicacionCodigo: string;
  ubicacionDetalle: string;
}

export const IMPUTACION_VACIA: Imputacion = {
  centroCostoCodigo: "",
  centroCostoDetalle: "",
  areaCodigo: "",
  areaDetalle: "",
  ubicacionCodigo: "",
  ubicacionDetalle: "",
};

/** Una combinación válida del catálogo de imputación (pestaña CentrosCosto). */
export interface CentroCostoEntry {
  ccCodigo: string;
  ccDetalle: string;
  areaCodigo: string;
  areaDetalle: string;
  ubicacionCodigo: string;
  ubicacionDetalle: string;
}
```

Y agrega el campo a la interfaz `Gasto`, como última propiedad (después de `usuarioArea`):

```ts
  usuarioArea: string; // área del usuario que registró (denormalizado para reportes)
  imputacion: Imputacion; // centro de costo / área / ubicación elegidos en el gasto
```

- [ ] **Step 2: Actualizar el test de sheets (rojo) en `src/lib/sheets.test.ts`**

Agrega `imputacion` al fixture `gasto` (después de `usuarioArea: "Operaciones",`):

```ts
  usuarioArea: "Operaciones",
  imputacion: {
    centroCostoCodigo: "C0100",
    centroCostoDetalle: "Gcia. Operaciones",
    areaCodigo: "A1010",
    areaDetalle: "G.Oper - Gerencia",
    ubicacionCodigo: "T9510",
    ubicacionDetalle: "Casa Matriz",
  },
```

Reemplaza la aserción de longitud y agrega las de las columnas nuevas en el test "convierte un Gasto a fila en el orden correcto":

```ts
    expect(row.length).toBe(23);
    expect(row[16]).toBe("Operaciones");
    expect(row[17]).toBe("C0100");
    expect(row[22]).toBe("Casa Matriz");
```

Agrega un test nuevo dentro del `describe("gastoToRow / rowToGasto", ...)`:

```ts
  it("rowToGasto deja imputación vacía en filas históricas (sin esas columnas)", () => {
    const row = gastoToRow(gasto).slice(0, 17); // fila vieja: solo hasta usuario_area
    const parsed = rowToGasto(row);
    expect(parsed.imputacion).toEqual({
      centroCostoCodigo: "",
      centroCostoDetalle: "",
      areaCodigo: "",
      areaDetalle: "",
      ubicacionCodigo: "",
      ubicacionDetalle: "",
    });
  });
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL (compila distinto / `row.length` es 17, falta `imputacion`).

- [ ] **Step 4: Implementar el mapeo en `src/lib/sheets.ts`**

Agrega las 6 columnas al final de `GASTOS_HEADERS` (después de `"usuario_area"`):

```ts
  "usuario_area",
  "centro_costo_codigo",
  "centro_costo",
  "area_codigo",
  "area",
  "ubicacion_codigo",
  "ubicacion",
] as const;
```

En `gastoToRow`, agrega al final del array (después de `g.usuarioArea,`):

```ts
    g.usuarioArea,
    g.imputacion.centroCostoCodigo,
    g.imputacion.centroCostoDetalle,
    g.imputacion.areaCodigo,
    g.imputacion.areaDetalle,
    g.imputacion.ubicacionCodigo,
    g.imputacion.ubicacionDetalle,
  ];
```

En `rowToGasto`, agrega después de `usuarioArea: cell(row, 16),`:

```ts
    usuarioArea: cell(row, 16),
    imputacion: {
      centroCostoCodigo: cell(row, 17),
      centroCostoDetalle: cell(row, 18),
      areaCodigo: cell(row, 19),
      areaDetalle: cell(row, 20),
      ubicacionCodigo: cell(row, 21),
      ubicacionDetalle: cell(row, 22),
    },
  };
```

Cambia los rangos de `A2:Q` a `A2:W` en `listGastos` y en `appendGasto` (dos ocurrencias):

```ts
    range: "Gastos!A2:W",
```

- [ ] **Step 5: Implementar la factory en `src/lib/gasto-factory.ts`**

Agrega el import y el campo requerido. En el import de tipos:

```ts
import type { Gasto, Categoria, Imputacion } from "./types";
```

En `NuevoGastoInput`, agrega (después de `usuarioArea?: string;`):

```ts
  usuarioArea?: string;
  imputacion: Imputacion;
```

En `crearGasto`, agrega antes del cierre del objeto (después de `usuarioArea: input.usuarioArea ?? "",`):

```ts
    usuarioArea: input.usuarioArea ?? "",
    imputacion: input.imputacion,
  };
```

- [ ] **Step 6: Actualizar los fixtures de los otros tests**

En `src/lib/gasto-factory.test.ts`, agrega `imputacion` al objeto `base`:

```ts
  const base = {
    usuarioEmail: "maravena@bosca.cl",
    usuarioNombre: "M. Aravena",
    fechaDocumento: "2026-06-10",
    comercio: "Copec",
    categoria: "Combustible" as const,
    monto: 45000,
    imputacion: {
      centroCostoCodigo: "C0100",
      centroCostoDetalle: "Gcia. Operaciones",
      areaCodigo: "A1010",
      areaDetalle: "G.Oper - Gerencia",
      ubicacionCodigo: "T9510",
      ubicacionDetalle: "Casa Matriz",
    },
  };
```

En `src/lib/gastos-rol.test.ts`, dentro de la función `gasto(...)`, agrega antes del cierre del objeto (después de `usuarioArea: "",`):

```ts
    usuarioArea: "",
    imputacion: {
      centroCostoCodigo: "",
      centroCostoDetalle: "",
      areaCodigo: "",
      areaDetalle: "",
      ubicacionCodigo: "",
      ubicacionDetalle: "",
    },
  };
```

En `src/lib/dashboard.test.ts`, dentro de la función `g(parcial)`, agrega antes del spread `...parcial` (después de `usuarioArea: "",`):

```ts
    usuarioArea: "",
    imputacion: {
      centroCostoCodigo: "",
      centroCostoDetalle: "",
      areaCodigo: "",
      areaDetalle: "",
      ubicacionCodigo: "",
      ubicacionDetalle: "",
    },
    ...parcial,
  };
```

- [ ] **Step 7: Correr toda la suite y typecheck**

Run: `npx vitest run && npx tsc --noEmit`
Expected: PASS (todos los tests verdes, sin errores de tipos).

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/sheets.ts src/lib/sheets.test.ts src/lib/gasto-factory.ts src/lib/gasto-factory.test.ts src/lib/gastos-rol.test.ts src/lib/dashboard.test.ts
git commit -m "feat(gastos): agregar campo imputacion (centro de costo/area/ubicacion) al modelo"
```

---

## Task 2: Lógica de cascada y validación (`centros-costo.ts`)

**Files:**
- Create: `src/lib/centros-costo.ts`
- Test: `src/lib/centros-costo.test.ts`

- [ ] **Step 1: Escribir el test (rojo)**

Crea `src/lib/centros-costo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  centrosCosto,
  areasDe,
  ubicacionesDe,
  resolverImputacion,
  esCombinacionValida,
} from "./centros-costo";
import type { CentroCostoEntry } from "./types";

const catalogo: CentroCostoEntry[] = [
  { ccCodigo: "C0100", ccDetalle: "Gcia. Operaciones", areaCodigo: "A1010", areaDetalle: "G.Oper - Gerencia", ubicacionCodigo: "T9005", ubicacionDetalle: "Serv. Operaciones" },
  { ccCodigo: "C0100", ccDetalle: "Gcia. Operaciones", areaCodigo: "A1010", areaDetalle: "G.Oper - Gerencia", ubicacionCodigo: "T9510", ubicacionDetalle: "Casa Matriz" },
  { ccCodigo: "C0100", ccDetalle: "Gcia. Operaciones", areaCodigo: "A1030", areaDetalle: "G.Oper - Abastecimiento", ubicacionCodigo: "T9510", ubicacionDetalle: "Casa Matriz" },
  { ccCodigo: "C0200", ccDetalle: "Gcia. Comercial", areaCodigo: "A2010", areaDetalle: "G.Com - Gerencia", ubicacionCodigo: "T9510", ubicacionDetalle: "Casa Matriz" },
];

describe("centrosCosto", () => {
  it("devuelve centros de costo distintos en orden de aparición", () => {
    expect(centrosCosto(catalogo)).toEqual([
      { codigo: "C0100", detalle: "Gcia. Operaciones" },
      { codigo: "C0200", detalle: "Gcia. Comercial" },
    ]);
  });
});

describe("areasDe", () => {
  it("devuelve las áreas distintas de un centro de costo", () => {
    expect(areasDe(catalogo, "C0100")).toEqual([
      { codigo: "A1010", detalle: "G.Oper - Gerencia" },
      { codigo: "A1030", detalle: "G.Oper - Abastecimiento" },
    ]);
  });
  it("devuelve [] para un centro de costo inexistente", () => {
    expect(areasDe(catalogo, "C9999")).toEqual([]);
  });
});

describe("ubicacionesDe", () => {
  it("devuelve las ubicaciones distintas de un (cc, área)", () => {
    expect(ubicacionesDe(catalogo, "C0100", "A1010")).toEqual([
      { codigo: "T9005", detalle: "Serv. Operaciones" },
      { codigo: "T9510", detalle: "Casa Matriz" },
    ]);
  });
});

describe("resolverImputacion", () => {
  it("resuelve los detalles de una combinación válida", () => {
    expect(resolverImputacion(catalogo, "C0100", "A1010", "T9510")).toEqual({
      centroCostoCodigo: "C0100",
      centroCostoDetalle: "Gcia. Operaciones",
      areaCodigo: "A1010",
      areaDetalle: "G.Oper - Gerencia",
      ubicacionCodigo: "T9510",
      ubicacionDetalle: "Casa Matriz",
    });
  });
  it("devuelve null si la combinación no existe", () => {
    expect(resolverImputacion(catalogo, "C0100", "A1010", "T0000")).toBeNull();
    expect(resolverImputacion(catalogo, "C0200", "A1010", "T9510")).toBeNull(); // área de otro CC
  });
});

describe("esCombinacionValida", () => {
  it("true para válida, false para inválida", () => {
    expect(esCombinacionValida(catalogo, "C0100", "A1030", "T9510")).toBe(true);
    expect(esCombinacionValida(catalogo, "C0100", "A1030", "T9005")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/centros-costo.test.ts`
Expected: FAIL ("Failed to resolve import './centros-costo'").

- [ ] **Step 3: Implementar `src/lib/centros-costo.ts`**

```ts
import type { CentroCostoEntry, Imputacion } from "./types";

export interface Opcion {
  codigo: string;
  detalle: string;
}

/** Quita repetidos por código, preservando el orden de aparición. */
function distintos(pares: Opcion[]): Opcion[] {
  const vistos = new Set<string>();
  const out: Opcion[] = [];
  for (const p of pares) {
    if (p.codigo && !vistos.has(p.codigo)) {
      vistos.add(p.codigo);
      out.push(p);
    }
  }
  return out;
}

export function centrosCosto(entries: CentroCostoEntry[]): Opcion[] {
  return distintos(entries.map((e) => ({ codigo: e.ccCodigo, detalle: e.ccDetalle })));
}

export function areasDe(entries: CentroCostoEntry[], ccCodigo: string): Opcion[] {
  return distintos(
    entries
      .filter((e) => e.ccCodigo === ccCodigo)
      .map((e) => ({ codigo: e.areaCodigo, detalle: e.areaDetalle })),
  );
}

export function ubicacionesDe(
  entries: CentroCostoEntry[],
  ccCodigo: string,
  areaCodigo: string,
): Opcion[] {
  return distintos(
    entries
      .filter((e) => e.ccCodigo === ccCodigo && e.areaCodigo === areaCodigo)
      .map((e) => ({ codigo: e.ubicacionCodigo, detalle: e.ubicacionDetalle })),
  );
}

export function resolverImputacion(
  entries: CentroCostoEntry[],
  ccCodigo: string,
  areaCodigo: string,
  ubicacionCodigo: string,
): Imputacion | null {
  const m = entries.find(
    (e) =>
      e.ccCodigo === ccCodigo &&
      e.areaCodigo === areaCodigo &&
      e.ubicacionCodigo === ubicacionCodigo,
  );
  if (!m) return null;
  return {
    centroCostoCodigo: m.ccCodigo,
    centroCostoDetalle: m.ccDetalle,
    areaCodigo: m.areaCodigo,
    areaDetalle: m.areaDetalle,
    ubicacionCodigo: m.ubicacionCodigo,
    ubicacionDetalle: m.ubicacionDetalle,
  };
}

export function esCombinacionValida(
  entries: CentroCostoEntry[],
  ccCodigo: string,
  areaCodigo: string,
  ubicacionCodigo: string,
): boolean {
  return resolverImputacion(entries, ccCodigo, areaCodigo, ubicacionCodigo) !== null;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/centros-costo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/centros-costo.ts src/lib/centros-costo.test.ts
git commit -m "feat(centros-costo): logica de cascada y validacion de imputacion"
```

---

## Task 3: Leer el catálogo desde Sheets (`listarCentrosCosto`)

**Files:**
- Modify: `src/lib/sheets.ts`
- Test: `src/lib/sheets.test.ts`

- [ ] **Step 1: Escribir el test (rojo)**

Agrega al final de `src/lib/sheets.test.ts` (los mocks `valuesGet` y `getEnv` ya están configurados en `beforeEach`):

```ts
import { listarCentrosCosto } from "./sheets";

describe("listarCentrosCosto", () => {
  it("mapea las filas de CentrosCosto a CentroCostoEntry", async () => {
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ["C0100", "Gcia. Operaciones", "A1010", "G.Oper - Gerencia", "T9510", "Casa Matriz"],
          ["", "", "", "", "", ""], // fila vacía: se ignora
        ],
      },
    });
    const r = await listarCentrosCosto();
    expect(r).toEqual([
      {
        ccCodigo: "C0100",
        ccDetalle: "Gcia. Operaciones",
        areaCodigo: "A1010",
        areaDetalle: "G.Oper - Gerencia",
        ubicacionCodigo: "T9510",
        ubicacionDetalle: "Casa Matriz",
      },
    ]);
  });

  it("devuelve [] si no hay filas", async () => {
    valuesGet.mockResolvedValue({ data: {} });
    expect(await listarCentrosCosto()).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/sheets.test.ts -t listarCentrosCosto`
Expected: FAIL ("listarCentrosCosto is not a function" / import).

- [ ] **Step 3: Implementar en `src/lib/sheets.ts`**

Agrega el import del tipo arriba (junto a los demás de `./types`):

```ts
import type { Gasto, Categoria, EstadoGasto, Usuario, Rol, CentroCostoEntry } from "./types";
```

Agrega la función (por ejemplo después de `listarAreas`):

```ts
/** Lee el catálogo de imputación de la pestaña CentrosCosto (A2:F, desde fila 2). */
export async function listarCentrosCosto(): Promise<CentroCostoEntry[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "CentrosCosto!A2:F",
  });
  const rows = (res.data.values ?? []) as string[][];
  return rows
    .filter((r) => (r[0] ?? "").trim() !== "")
    .map((r) => ({
      ccCodigo: cell(r, 0),
      ccDetalle: cell(r, 1),
      areaCodigo: cell(r, 2),
      areaDetalle: cell(r, 3),
      ubicacionCodigo: cell(r, 4),
      ubicacionDetalle: cell(r, 5),
    }));
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets.ts src/lib/sheets.test.ts
git commit -m "feat(sheets): listarCentrosCosto lee el catalogo de imputacion"
```

---

## Task 4: Ruta `GET /api/centros-costo`

Las rutas no tienen tests unitarios en este repo; se verifica por typecheck/lint y manualmente.

**Files:**
- Create: `src/app/api/centros-costo/route.ts`

- [ ] **Step 1: Implementar la ruta**

```ts
import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listarCentrosCosto } from "@/lib/sheets";

/** Devuelve el catálogo de imputación (centro de costo / área / ubicación). */
export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  try {
    const centros = await listarCentrosCosto();
    return NextResponse.json({ centros });
  } catch {
    return NextResponse.json({ error: "No se pudo leer los centros de costo" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Typecheck y lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/centros-costo/route.ts`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/centros-costo/route.ts
git commit -m "feat(api): GET /api/centros-costo devuelve el catalogo de imputacion"
```

---

## Task 5: Cliente — `GuardarGastoInput` + `obtenerCentrosCosto`

**Files:**
- Modify: `src/lib/api-client.ts`

- [ ] **Step 1: Extender `GuardarGastoInput`**

En `src/lib/api-client.ts`, agrega los 3 códigos a la interfaz `GuardarGastoInput` (después de `imagenDriveId?: string;`):

```ts
  imagenDriveId?: string;
  centroCostoCodigo: string;
  areaCodigo: string;
  ubicacionCodigo: string;
```

- [ ] **Step 2: Agregar el import del tipo y la función `obtenerCentrosCosto`**

En el import de tipos (arriba del archivo):

```ts
import type { Gasto, Categoria, CentroCostoEntry } from "./types";
```

Agrega la función (por ejemplo después de `obtenerGastos`):

```ts
/** Catálogo de imputación (centro de costo / área / ubicación). */
export function obtenerCentrosCosto(): Promise<{ centros: CentroCostoEntry[] }> {
  return pedir<{ centros: CentroCostoEntry[] }>("/api/centros-costo", { method: "GET" });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: aparecerán errores SOLO en `TarjetaConfirmacion.tsx` (aún no envía los 3 códigos) — se resuelven en Task 7. `api-client.ts` debe compilar.

- [ ] **Step 4: Commit**

```bash
git add src/lib/api-client.ts
git commit -m "feat(api-client): obtenerCentrosCosto y codigos de imputacion en GuardarGastoInput"
```

---

## Task 6: Validación de la imputación en `POST /api/gastos`

**Files:**
- Modify: `src/app/api/gastos/route.ts`

- [ ] **Step 1: Agregar imports**

En `src/app/api/gastos/route.ts`, junto a los imports existentes:

```ts
import { listGastos, appendGasto, listarCentrosCosto } from "@/lib/sheets";
import { resolverImputacion } from "@/lib/centros-costo";
```

(Reemplaza la línea de import de `@/lib/sheets` para incluir `listarCentrosCosto`.)

- [ ] **Step 2: Extender el tipo del body y validar**

En el `POST`, agrega los 3 campos al tipo del `body` (junto a `imagenDriveId?: string;`):

```ts
    imagenDriveId?: string;
    centroCostoCodigo?: string;
    areaCodigo?: string;
    ubicacionCodigo?: string;
```

Después del bloque que valida `comercio/monto/categoria/fechaDocumento` (justo antes de `const gasto = crearGasto({...})`), agrega:

```ts
  if (!body.centroCostoCodigo || !body.areaCodigo || !body.ubicacionCodigo) {
    return NextResponse.json(
      { error: "Falta la imputación: centro de costo, área y ubicación" },
      { status: 400 },
    );
  }

  let imputacion;
  try {
    const catalogo = await listarCentrosCosto();
    imputacion = resolverImputacion(
      catalogo,
      body.centroCostoCodigo,
      body.areaCodigo,
      body.ubicacionCodigo,
    );
  } catch {
    return NextResponse.json({ error: "No se pudo validar la imputación" }, { status: 502 });
  }
  if (!imputacion) {
    return NextResponse.json(
      { error: "La combinación de centro de costo / área / ubicación no es válida" },
      { status: 400 },
    );
  }
```

- [ ] **Step 3: Pasar `imputacion` a `crearGasto`**

Dentro del objeto que se pasa a `crearGasto({...})`, agrega (después de `usuarioArea: auth.usuario.area,`):

```ts
    usuarioArea: auth.usuario.area,
    imputacion,
```

- [ ] **Step 4: Typecheck y lint**

Run: `npx tsc --noEmit && npx eslint src/app/api/gastos/route.ts`
Expected: sin errores en este archivo.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/gastos/route.ts
git commit -m "feat(api): validar y resolver imputacion al guardar un gasto"
```

---

## Task 7: UI — menús en cascada en `TarjetaConfirmacion`

**Files:**
- Modify: `src/components/chat/TarjetaConfirmacion.tsx`

- [ ] **Step 1: Agregar imports y la prop `catalogo`**

En `src/components/chat/TarjetaConfirmacion.tsx`, agrega imports:

```ts
import { centrosCosto, areasDe, ubicacionesDe } from "@/lib/centros-costo";
import type { CentroCostoEntry } from "@/lib/types";
```

Agrega `catalogo` a las props (en el destructuring y en el tipo):

```ts
export function TarjetaConfirmacion({
  borrador,
  imagenUrl,
  imagenDriveId,
  catalogo,
  onConfirmar,
  onCancelar,
  deshabilitado,
}: {
  borrador: ExtraccionGasto;
  imagenUrl?: string;
  imagenDriveId?: string;
  catalogo: CentroCostoEntry[];
  onConfirmar: (datos: GuardarGastoInput) => void;
  onCancelar: () => void;
  deshabilitado: boolean;
}) {
```

- [ ] **Step 2: Estado en cascada y `completo`**

Después de `const [observacion, setObservacion] = useState("");`, agrega:

```ts
  const [cc, setCc] = useState("");
  const [area, setArea] = useState("");
  const [ubicacion, setUbicacion] = useState("");

  const opcionesCc = centrosCosto(catalogo);
  const opcionesArea = cc ? areasDe(catalogo, cc) : [];
  const opcionesUbic = cc && area ? ubicacionesDe(catalogo, cc, area) : [];
```

Reemplaza la línea de `completo` para exigir también la imputación:

```ts
  const monto = parseCLP(montoTexto);
  const completo =
    comercio.trim() !== "" &&
    monto !== null &&
    monto > 0 &&
    fecha !== "" &&
    categoria !== "" &&
    cc !== "" &&
    area !== "" &&
    ubicacion !== "";
```

- [ ] **Step 3: Enviar los códigos en `confirmar`**

En la función `confirmar`, agrega los 3 códigos al objeto de `onConfirmar` (después de `imagenDriveId,`):

```ts
      imagenUrl,
      imagenDriveId,
      centroCostoCodigo: cc,
      areaCodigo: area,
      ubicacionCodigo: ubicacion,
    });
```

- [ ] **Step 4: Render de los 3 `<select>` en cascada**

Inmediatamente después del `<label>` de Categoría (el bloque que termina en `</label>` tras el `select` de `CATEGORIAS`), agrega:

```tsx
        <label className="text-xs text-gray-500">
          Centro de costo
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={cc}
            onChange={(e) => {
              setCc(e.target.value);
              setArea("");
              setUbicacion("");
            }}
          >
            <option value="">Selecciona…</option>
            {opcionesCc.map((o) => (
              <option key={o.codigo} value={o.codigo}>
                {o.codigo} · {o.detalle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Área
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon disabled:opacity-50"
            value={area}
            disabled={!cc}
            onChange={(e) => {
              setArea(e.target.value);
              setUbicacion("");
            }}
          >
            <option value="">Selecciona…</option>
            {opcionesArea.map((o) => (
              <option key={o.codigo} value={o.codigo}>
                {o.codigo} · {o.detalle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Ubicación
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon disabled:opacity-50"
            value={ubicacion}
            disabled={!area}
            onChange={(e) => setUbicacion(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {opcionesUbic.map((o) => (
              <option key={o.codigo} value={o.codigo}>
                {o.codigo} · {o.detalle}
              </option>
            ))}
          </select>
        </label>
```

- [ ] **Step 5: Typecheck y lint**

Run: `npx tsc --noEmit && npx eslint src/components/chat/TarjetaConfirmacion.tsx`
Expected: aparecerá un error SOLO en `src/app/page.tsx` (falta pasar la prop `catalogo`) — se resuelve en Task 8.

- [ ] **Step 6: Commit**

```bash
git add src/components/chat/TarjetaConfirmacion.tsx
git commit -m "feat(ui): menus en cascada de imputacion en la tarjeta de confirmacion"
```

---

## Task 8: Cargar el catálogo en `page.tsx` y pasarlo a la tarjeta

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Imports**

En `src/app/page.tsx`, agrega `obtenerCentrosCosto` al import de `@/lib/api-client` y el tipo:

```ts
import {
  extraerDesdeTexto,
  extraerDesdeImagen,
  subirBoleta,
  guardarGasto,
  obtenerPerfil,
  obtenerCentrosCosto,
  type GuardarGastoInput,
  type Perfil,
} from "@/lib/api-client";
import type { CentroCostoEntry } from "@/lib/types";
```

- [ ] **Step 2: Estado y carga del catálogo**

Dentro de `function Chat(...)`, junto a los demás `useState`, agrega:

```ts
  const [catalogoCC, setCatalogoCC] = useState<CentroCostoEntry[]>([]);
```

Agrega un `useEffect` para cargarlo una vez (después del `useEffect` del scroll):

```ts
  useEffect(() => {
    obtenerCentrosCosto()
      .then(({ centros }) => setCatalogoCC(centros))
      .catch(() => {});
  }, []);
```

- [ ] **Step 3: Pasar la prop `catalogo` a `TarjetaConfirmacion`**

En el render, en la rama `if (m.tipo === "confirmacion")`, agrega la prop:

```tsx
            <TarjetaConfirmacion
              key={i}
              borrador={m.borrador}
              imagenUrl={m.imagenUrl}
              imagenDriveId={m.imagenDriveId}
              catalogo={catalogoCC}
              onConfirmar={onConfirmar}
              onCancelar={onCancelar}
              deshabilitado={procesando}
            />
```

- [ ] **Step 4: Typecheck y lint del proyecto**

Run: `npx tsc --noEmit && npx eslint src/app/page.tsx`
Expected: sin errores nuevos (el lint preexistente de `set-state-in-effect` en `cargarPerfil` puede seguir; no agregar otros).

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): cargar catalogo de imputacion y pasarlo a la tarjeta de confirmacion"
```

---

## Task 9: Script de carga del catálogo + setup de la planilla

Carga las 56 combinaciones a la pestaña `CentrosCosto` y escribe los 6 encabezados nuevos en `Gastos!R1:W1`.

**Files:**
- Create: `scripts/cargar-centros-costo.mjs`
- Modify: `package.json`

- [ ] **Step 1: Agregar `xlsx` como devDependency y el script**

Run: `npm install --save-dev xlsx`

En `package.json`, agrega el script (después de `"creditos": ...`):

```json
    "creditos": "node --env-file=.env.local scripts/revisar-creditos.mjs",
    "cargar-centros": "node --env-file=.env.local scripts/cargar-centros-costo.mjs"
```

- [ ] **Step 2: Crear `scripts/cargar-centros-costo.mjs`**

```js
// Carga el catálogo de imputación a la pestaña CentrosCosto de Google Sheets,
// leyendo CENTROS DE COSTO 2026.xls (hoja "CCOST - AREA - LOCALES etc").
// Filtra: descarta filas sin código de ubicación (clientes claves) y las T9505
// (Ex Casa Matriz, obsoletas). También escribe los 6 encabezados nuevos de la
// pestaña Gastos (R1:W1). Re-ejecutable.
//
// Uso:
//   node --env-file=.env.local scripts/cargar-centros-costo.mjs

import { google } from "googleapis";
import XLSX from "xlsx";

const VERDE = "\x1b[32m";
const ROJO = "\x1b[31m";
const RESET = "\x1b[0m";
const ok = (m) => console.log(`${VERDE}✓${RESET} ${m}`);
const fail = (m) => console.log(`${ROJO}✗${RESET} ${m}`);

const ARCHIVO = "CENTROS DE COSTO 2026.xls";
const HOJA = "CCOST - AREA - LOCALES etc";
const PESTANA = "CentrosCosto";

function getEnv(n) {
  const v = process.env[n];
  if (!v) throw new Error(`Falta la variable de entorno ${n}`);
  return v;
}

function leerCombinaciones() {
  const wb = XLSX.readFile(ARCHIVO);
  const ws = wb.Sheets[HOJA];
  if (!ws) throw new Error(`No existe la hoja "${HOJA}" en ${ARCHIVO}`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" }).slice(2);
  let cc = "", ccd = "", ar = "", ard = "";
  const out = [];
  for (const r of rows) {
    const ccc = String(r[0]).trim(), ccdet = String(r[1]).trim();
    const arc = String(r[3]).trim(), ardet = String(r[4]).trim();
    const ubc = String(r[6]).trim(), ubdet = String(r[7]).trim();
    if (ccc) { cc = ccc; ccd = ccdet; }
    if (arc) { ar = arc; ard = ardet; }
    if (!ubc) continue;          // clientes claves (sin código): descartar
    if (ubc === "T9505") continue; // Ex Casa Matriz (obsoleta): excluir
    out.push([cc, ccd, ar, ard, ubc, ubdet]);
  }
  return out;
}

async function main() {
  const combos = leerCombinaciones();
  ok(`Leídas ${combos.length} combinaciones válidas del .xls`);

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      private_key: getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");

  // Crear la pestaña CentrosCosto si no existe.
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existe = (meta.data.sheets ?? []).some((s) => s.properties?.title === PESTANA);
  if (!existe) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: PESTANA } } }] },
    });
    ok(`Pestaña "${PESTANA}" creada`);
  }

  // Limpiar y escribir encabezados + filas.
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${PESTANA}!A:F` });
  const valores = [
    ["cc_codigo", "cc_detalle", "area_codigo", "area_detalle", "ubicacion_codigo", "ubicacion_detalle"],
    ...combos,
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${PESTANA}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: valores },
  });
  ok(`Escritas ${combos.length} filas en "${PESTANA}"`);

  // Encabezados nuevos de la pestaña Gastos (R1:W1).
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Gastos!R1:W1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["centro_costo_codigo", "centro_costo", "area_codigo", "area", "ubicacion_codigo", "ubicacion"]],
    },
  });
  ok("Encabezados de imputación agregados en Gastos!R1:W1");
}

main().catch((e) => {
  fail(e?.message ?? String(e));
  process.exitCode = 1;
});
```

- [ ] **Step 3: Correr el script (carga real)**

Run: `npm run cargar-centros`
Expected: imprime "Leídas 56 combinaciones…", crea/llena la pestaña `CentrosCosto` y escribe los encabezados en Gastos. Verificar en la planilla que `CentrosCosto` tenga 56 filas + encabezado.

- [ ] **Step 4: Commit**

```bash
git add scripts/cargar-centros-costo.mjs package.json package-lock.json
git commit -m "feat(scripts): carga del catalogo de centros de costo a Sheets"
```

---

## Task 10: Verificación end-to-end

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Suite, typecheck y lint completos**

Run: `npx vitest run && npx tsc --noEmit && npx eslint src`
Expected: tests verdes, sin errores de tipos; en lint solo el preexistente `set-state-in-effect` de `page.tsx` (no nuevos).

- [ ] **Step 2: Prueba manual end-to-end**

Run: `npm run dev`, abrir http://localhost:3000, iniciar sesión, registrar un gasto (texto o boleta). En la tarjeta de confirmación:
- Verificar que "Centro de costo" lista los 5 centros.
- Al elegir uno, "Área" se habilita y muestra solo las áreas de ese centro.
- Al elegir un área, "Ubicación" se habilita y muestra solo sus ubicaciones.
- "Confirmar registro" permanece deshabilitado hasta elegir los tres.
- Confirmar y verificar en la pestaña `Gastos` que las columnas R–W quedaron con código y detalle correctos.

- [ ] **Step 3: Caso de error (opcional, vía API)**

Verificar que un POST a `/api/gastos` con una combinación inválida responde 400 (por ejemplo, cambiando temporalmente un código en las herramientas del navegador). Confirmar que el gasto no se guarda.

---

## Notas

- **No tocar** la pestaña `Areas` (área de trabajo del perfil): es un concepto distinto del "Área" de esta jerarquía.
- Gastos históricos quedan con R–W vacías; se leen como `""` y no rompen dashboard ni listado.
- Para refrescar el catálogo cuando cambie el maestro: reemplazar `CENTROS DE COSTO 2026.xls` y volver a correr `npm run cargar-centros`.
- El `.xls` no está versionado en el repo; debe estar en la raíz del proyecto al correr el script.
