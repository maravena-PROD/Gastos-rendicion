# Aprobación de gastos por centro de costo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que perfiles gerenciales aprueben o rechacen gastos según el centro de costo, con el Gerente General y el Administrador con alcance total.

**Architecture:** Alcance por datos: cada usuario lleva en la planilla los centros de costo que puede aprobar (`aprueba_cc`, o `*`). La lógica de permisos vive en un módulo puro (`aprobaciones.ts`), la persistencia en `sheets.ts`, dos rutas API exponen la lista pendiente y la decisión, y una página `/aprobaciones` da la UI. Una decisión (Aprobado/Rechazado) es final.

**Tech Stack:** Next.js 16 (App Router, `params` async), React 19, TypeScript, Google Sheets (googleapis), Vitest. Spanish en código/UI.

## Global Constraints

- Dominio de sesión: `@bosca.cl`; auth por Bearer token (`getBearerToken` + `autenticar`).
- Planilla `Gastos` ya usa columnas A:AA; las nuevas van en **AB:AD**. Planilla `Usuarios` usa A:I; las nuevas en **J:K**.
- El parseo de filas es tolerante: celdas faltantes → `""` (o default). Mantener ese patrón.
- Estados válidos: `Registrado` | `Aprobado` | `Rechazado`. Solo se decide desde `Registrado`.
- Regla de auto-aprobación: alcance `*` puede aprobar gastos propios; alcance acotado NO.
- Commits en español, estilo conventional (ej. `feat(aprobaciones): ...`), terminando con:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Verificación global tras cada tarea: `npm test` y `npx tsc --noEmit` en verde.

---

### Task 1: Modelo de datos y persistencia

Extiende los tipos y la (de)serialización de filas para los campos nuevos. Es un único entregable coherente ("persistir los campos nuevos") porque tipos y serialización están acoplados y los fixtures deben actualizarse juntos para que el árbol quede verde.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/gasto-factory.ts`
- Modify: `src/lib/sheets.ts`
- Test: `src/lib/sheets.test.ts`, `src/lib/gasto-factory.test.ts`
- Fixtures a actualizar para compilar: `src/lib/auth.test.ts`, `src/lib/perfil.test.ts`, `src/lib/reporte.test.ts`, `src/lib/dashboard.test.ts`, `src/lib/gastos-rol.test.ts`

**Interfaces:**
- Produces:
  - `Gasto` gana `aprobadoPor: string`, `fechaDecision: string`, `motivo: string`.
  - `Usuario` gana `apruebaCc: string[]`, `cargo: string`.
  - `gastoToRow(g): string[]` ahora largo 30 (índices 27/28/29 = aprobadoPor/fechaDecision/motivo).
  - `rowToGasto(row)` lee índices 27/28/29.
  - `usuarioRowToUsuario(row)` lee col 9 (`aprueba_cc`) → `apruebaCc`, col 10 (`cargo`) → `cargo`.
  - `getUsuario` lee rango `Usuarios!A2:K`.

- [ ] **Step 1: Escribir tests que fallan (serialización de los campos nuevos)**

En `src/lib/sheets.test.ts`, dentro del `describe("gastoToRow / rowToGasto", ...)`, agrega:

```ts
  it("incluye aprobado_por, fecha_decision y motivo (AB:AD)", () => {
    const decidido: Gasto = {
      ...gasto,
      estado: "Rechazado",
      aprobadoPor: "gerente@bosca.cl",
      fechaDecision: "2026-06-17T10:00:00Z",
      motivo: "Falta boleta",
    };
    const row = gastoToRow(decidido);
    expect(row.length).toBe(30);
    expect(row[27]).toBe("gerente@bosca.cl");
    expect(row[28]).toBe("2026-06-17T10:00:00Z");
    expect(row[29]).toBe("Falta boleta");
    expect(rowToGasto(row)).toEqual(decidido);
  });

  it("filas históricas sin AB:AD defaultean decisión a vacío", () => {
    const row = gastoToRow(gasto).slice(0, 27); // sin las 3 nuevas
    const parsed = rowToGasto(row);
    expect(parsed.aprobadoPor).toBe("");
    expect(parsed.fechaDecision).toBe("");
    expect(parsed.motivo).toBe("");
  });
```

En `describe("usuarioRowToUsuario", ...)`, agrega:

```ts
  it("parsea aprueba_cc (lista) y cargo", () => {
    const u = usuarioRowToUsuario([
      "g@bosca.cl", "G", "Usuario", "TRUE", "", "1-9", "Comercial",
      "", "", "C0200", "Gerente Comercial",
    ]);
    expect(u.apruebaCc).toEqual(["C0200"]);
    expect(u.cargo).toBe("Gerente Comercial");
  });

  it("aprueba_cc '*' => ['*'] y vacío => []", () => {
    const general = usuarioRowToUsuario(["g@bosca.cl","G","Usuario","TRUE","","1-9","x","","","*",""]);
    expect(general.apruebaCc).toEqual(["*"]);
    const normal = usuarioRowToUsuario(["n@bosca.cl","N","Usuario","TRUE",""]);
    expect(normal.apruebaCc).toEqual([]);
    expect(normal.cargo).toBe("");
  });
```

- [ ] **Step 2: Correr los tests para verlos fallar**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL (TS: faltan `aprobadoPor`/`cargo` en tipos; `row.length` ≠ 30).

- [ ] **Step 3: Extender los tipos**

En `src/lib/types.ts`, en la interfaz `Gasto`, después de `iva: number;`:

```ts
  aprobadoPor: string; // email de quien decidió; "" si pendiente
  fechaDecision: string; // ISO 8601; "" si pendiente
  motivo: string; // motivo de la decisión (sobre todo rechazos); "" si no aplica
```

En la interfaz `Usuario`, después de `cuentaCorriente: string;`:

```ts
  apruebaCc: string[]; // códigos de CC que puede aprobar; ["*"] = todos; [] = ninguno
  cargo: string; // etiqueta para la UI (ej. "Gerente Comercial"); "" si no aplica
```

- [ ] **Step 4: Defaults en la factory**

En `src/lib/gasto-factory.ts`, dentro del objeto que retorna `crearGasto`, después de `iva: input.iva ?? 0,`:

```ts
    aprobadoPor: "",
    fechaDecision: "",
    motivo: "",
```

- [ ] **Step 5: Extender serialización en `sheets.ts`**

En `gastoToRow`, después de `String(g.iva),`:

```ts
    g.aprobadoPor,
    g.fechaDecision,
    g.motivo,
```

En `rowToGasto`, después de `iva: parseMonto(cell(row, 26)),`:

```ts
    aprobadoPor: cell(row, 27),
    fechaDecision: cell(row, 28),
    motivo: cell(row, 29),
```

Cambia los rangos de `listGastos` y `appendGasto` de `"Gastos!A2:AA"` a `"Gastos!A2:AD"` (dos ocurrencias).

Agrega el helper de parseo (junto a los otros `parse*`):

```ts
function parseApruebaCc(v: string): string[] {
  const s = v.trim();
  if (s === "*") return ["*"];
  return s.split(",").map((x) => x.trim()).filter((x) => x !== "");
}
```

En `usuarioRowToUsuario`, después de `cuentaCorriente: cell(row, 8),`:

```ts
    apruebaCc: parseApruebaCc(cell(row, 9)),
    cargo: cell(row, 10),
```

En `getUsuario`, cambia el rango `"Usuarios!A2:I"` por `"Usuarios!A2:K"`.

- [ ] **Step 6: Actualizar fixtures y aserciones existentes (para compilar y pasar)**

- `src/lib/sheets.test.ts`: en el fixture `gasto`, agrega `aprobadoPor: "", fechaDecision: "", motivo: "",` al final. En el test "convierte un Gasto a fila en el orden correcto" cambia `expect(row.length).toBe(27);` por `expect(row.length).toBe(30);`.
- `src/lib/auth.test.ts`: en `usuarioAdmin` agrega `apruebaCc: [], cargo: "",`. (La aserción de `decidirAcceso` se actualiza en la Task 2, no aquí.)
- `src/lib/perfil.test.ts`: en el helper `usuario(...)` default agrega `apruebaCc: [], cargo: "",`.
- `src/lib/reporte.test.ts`: en el `usuario` agrega `apruebaCc: [], cargo: "",`; en el helper `g(...)` default agrega `aprobadoPor: "", fechaDecision: "", motivo: "",`.
- `src/lib/dashboard.test.ts`: en el helper `g(...)` default agrega `aprobadoPor: "", fechaDecision: "", motivo: "",`.
- `src/lib/gastos-rol.test.ts`: en el helper `gasto(email, id)` default agrega `aprobadoPor: "", fechaDecision: "", motivo: "",`. (Los literales `SesionUsuario` de este archivo se actualizan en la Task 2.)

- [ ] **Step 7: Test de la factory (defaults nuevos)**

En `src/lib/gasto-factory.test.ts` agrega:

```ts
  it("inicializa la decisión vacía (aprobadoPor/fechaDecision/motivo)", () => {
    const g = crearGasto(base);
    expect(g.aprobadoPor).toBe("");
    expect(g.fechaDecision).toBe("");
    expect(g.motivo).toBe("");
  });
```

- [ ] **Step 8: Correr toda la suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS (todo verde, sin errores de tipos).

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts src/lib/gasto-factory.ts src/lib/sheets.ts src/lib/*.test.ts
git commit -m "feat(aprobaciones): modelo y persistencia de decisión y alcance de aprobación" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Sesión con alcance de aprobación

Incorpora `apruebaCc` a la sesión; el Administrador queda con alcance total.

**Files:**
- Modify: `src/lib/auth.ts`
- Test: `src/lib/auth.test.ts`, `src/lib/gastos-rol.test.ts` (solo fixtures de sesión)

**Interfaces:**
- Consumes: `Usuario.apruebaCc` (Task 1).
- Produces: `SesionUsuario` gana `apruebaCc: string[]`. `decidirAcceso` lo rellena: `Administrador` → `["*"]`; resto → `usuario.apruebaCc`.

- [ ] **Step 1: Escribir tests que fallan**

En `src/lib/auth.test.ts`, reemplaza la aserción del primer test de `decidirAcceso` por una que incluya `apruebaCc`, y agrega dos casos:

```ts
  it("permite a un usuario válido del dominio y devuelve su sesión", () => {
    const r = decidirAcceso({ email: "maravena@bosca.cl", name: "M. Aravena", emailVerified: true }, usuarioAdmin);
    expect(r).toEqual({
      ok: true,
      usuario: {
        email: "maravena@bosca.cl",
        nombre: "M. Aravena",
        rol: "Administrador",
        area: "Operaciones",
        apruebaCc: ["*"], // Administrador => alcance total
      },
    });
  });

  it("un gerente conserva su alcance de aprobación", () => {
    const gerente: Usuario = { ...usuarioAdmin, rol: "Usuario", apruebaCc: ["C0200"] };
    const r = decidirAcceso({ email: "maravena@bosca.cl", name: "M", emailVerified: true }, gerente);
    expect(r.ok && r.usuario.apruebaCc).toEqual(["C0200"]);
  });
```

Además, para que compilen con el nuevo `SesionUsuario`, agrega `apruebaCc: []` a:
- `src/lib/auth.test.ts`: los literales `sesionUsuario` y `sesionAdmin` del `describe("tieneRol", ...)`.
- `src/lib/gastos-rol.test.ts`: los dos literales `SesionUsuario` (`admin` y `usuario`) del `describe("filtrarGastosPorRol", ...)`.

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL (la sesión aún no trae `apruebaCc`).

- [ ] **Step 3: Implementar**

En `src/lib/auth.ts`, en la interfaz `SesionUsuario` agrega `apruebaCc: string[];` después de `area: string;`.

En `decidirAcceso`, reemplaza el `return` de éxito por:

```ts
  return {
    ok: true,
    usuario: {
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      area: usuario.area,
      apruebaCc: usuario.rol === "Administrador" ? ["*"] : usuario.apruebaCc,
    },
  };
```

- [ ] **Step 4: Correr para ver pasar + typecheck**

Run: `npx vitest run src/lib/auth.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts src/lib/gastos-rol.test.ts
git commit -m "feat(aprobaciones): alcance de aprobación en la sesión (admin = todos)" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Lógica de permisos (`aprobaciones.ts`)

Módulo puro y testeable, sin red.

**Files:**
- Create: `src/lib/aprobaciones.ts`
- Test: `src/lib/aprobaciones.test.ts`

**Interfaces:**
- Consumes: `SesionUsuario` (Task 2), `Gasto` (Task 1).
- Produces:
  - `tieneAlcance(apruebaCc: string[], ccCodigo: string): boolean`
  - `puedeAprobar(sesion: SesionUsuario, gasto: Gasto): boolean`
  - `gastosPorAprobar(gastos: Gasto[], sesion: SesionUsuario): Gasto[]`

- [ ] **Step 1: Escribir los tests que fallan**

Crea `src/lib/aprobaciones.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tieneAlcance, puedeAprobar, gastosPorAprobar } from "./aprobaciones";
import type { SesionUsuario } from "./auth";
import type { Gasto } from "./types";

function sesion(p: Partial<SesionUsuario>): SesionUsuario {
  return { email: "ger@bosca.cl", nombre: "Ger", rol: "Usuario", area: "", apruebaCc: [], ...p };
}
function gasto(p: Partial<Gasto>): Gasto {
  return {
    id: "g1", fechaRegistro: "", usuarioEmail: "user@bosca.cl", usuarioNombre: "User",
    fechaDocumento: "2026-06-10", comercio: "X", rutEmisor: "", numeroDocumento: "",
    categoria: "Otros", monto: 1000, direccion: "", observacion: "", imagenUrl: "",
    imagenDriveId: "", estado: "Registrado", fechaCreacion: "", usuarioArea: "",
    imputacion: { centroCostoCodigo: "C0100", centroCostoDetalle: "", areaCodigo: "", areaDetalle: "", ubicacionCodigo: "", ubicacionDetalle: "" },
    tipoRendicion: "Rendicion", tipoDocumento: "Otro", montoNeto: 0, iva: 0,
    aprobadoPor: "", fechaDecision: "", motivo: "", ...p,
  };
}

describe("tieneAlcance", () => {
  it("'*' cubre cualquier CC", () => expect(tieneAlcance(["*"], "C0999")).toBe(true));
  it("incluye el CC exacto", () => expect(tieneAlcance(["C0100", "C0200"], "C0200")).toBe(true));
  it("false si el CC no está", () => expect(tieneAlcance(["C0100"], "C0300")).toBe(false));
  it("false si no aprueba nada", () => expect(tieneAlcance([], "C0100")).toBe(false));
});

describe("puedeAprobar", () => {
  it("gerente aprueba un gasto pendiente de su CC (de otro usuario)", () => {
    expect(puedeAprobar(sesion({ apruebaCc: ["C0100"] }), gasto({}))).toBe(true);
  });
  it("no puede si el gasto no está Registrado", () => {
    expect(puedeAprobar(sesion({ apruebaCc: ["C0100"] }), gasto({ estado: "Aprobado" }))).toBe(false);
  });
  it("no puede si el CC está fuera de su alcance", () => {
    expect(puedeAprobar(sesion({ apruebaCc: ["C0200"] }), gasto({}))).toBe(false);
  });
  it("alcance acotado NO puede auto-aprobar", () => {
    expect(puedeAprobar(sesion({ email: "ger@bosca.cl", apruebaCc: ["C0100"] }), gasto({ usuarioEmail: "GER@bosca.cl" }))).toBe(false);
  });
  it("alcance '*' SÍ puede aprobar gastos propios", () => {
    expect(puedeAprobar(sesion({ email: "gg@bosca.cl", apruebaCc: ["*"] }), gasto({ usuarioEmail: "gg@bosca.cl" }))).toBe(true);
  });
});

describe("gastosPorAprobar", () => {
  it("devuelve solo los que la sesión puede decidir", () => {
    const s = sesion({ email: "ger@bosca.cl", apruebaCc: ["C0100"] });
    const lista = [
      gasto({ id: "a" }), // C0100, de otro, Registrado -> sí
      gasto({ id: "b", estado: "Aprobado" }), // ya decidido -> no
      gasto({ id: "c", imputacion: { centroCostoCodigo: "C0200", centroCostoDetalle: "", areaCodigo: "", areaDetalle: "", ubicacionCodigo: "", ubicacionDetalle: "" } }), // otro CC -> no
      gasto({ id: "d", usuarioEmail: "ger@bosca.cl" }), // propio -> no (acotado)
    ];
    expect(gastosPorAprobar(lista, s).map((g) => g.id)).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/lib/aprobaciones.test.ts`
Expected: FAIL ("does not provide an export named ...").

- [ ] **Step 3: Implementar**

Crea `src/lib/aprobaciones.ts`:

```ts
import type { SesionUsuario } from "./auth";
import type { Gasto } from "./types";

/** true si el alcance incluye "*" (todos) o el código de centro de costo dado. */
export function tieneAlcance(apruebaCc: string[], ccCodigo: string): boolean {
  return apruebaCc.includes("*") || apruebaCc.includes(ccCodigo);
}

/**
 * Una sesión puede decidir un gasto si: está Registrado, su centro de costo cae
 * en el alcance, y no es auto-aprobación (salvo alcance total "*").
 */
export function puedeAprobar(sesion: SesionUsuario, gasto: Gasto): boolean {
  if (gasto.estado !== "Registrado") return false;
  if (!tieneAlcance(sesion.apruebaCc, gasto.imputacion.centroCostoCodigo)) return false;
  const total = sesion.apruebaCc.includes("*");
  const esPropio = gasto.usuarioEmail.toLowerCase() === sesion.email.toLowerCase();
  if (esPropio && !total) return false;
  return true;
}

/** Filtra los gastos que la sesión puede aprobar/rechazar. */
export function gastosPorAprobar(gastos: Gasto[], sesion: SesionUsuario): Gasto[] {
  return gastos.filter((g) => puedeAprobar(sesion, g));
}
```

- [ ] **Step 4: Correr para ver pasar**

Run: `npx vitest run src/lib/aprobaciones.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/aprobaciones.ts src/lib/aprobaciones.test.ts
git commit -m "feat(aprobaciones): lógica de permisos por centro de costo" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Persistir la decisión (writer en `sheets.ts`)

**Files:**
- Modify: `src/lib/sheets.ts`
- Test: `src/lib/sheets.test.ts`

**Interfaces:**
- Consumes: `gastoToRow` (Task 1).
- Produces: `actualizarDecisionGasto(gasto: Gasto): Promise<void>` — localiza la fila por `id` (col A) en `Gastos!A2:AD` y reescribe `Gastos!A{n}:AD{n}` con `gastoToRow(gasto)`. Lanza si no existe.

- [ ] **Step 1: Escribir el test que falla**

En `src/lib/sheets.test.ts`, junto a los imports de funciones de Sheets agrega `actualizarDecisionGasto` al import de `"./sheets"` y añade:

```ts
describe("actualizarDecisionGasto", () => {
  it("localiza por id y reescribe la fila A:AD", async () => {
    valuesGet.mockResolvedValue({
      data: { values: [gastoToRow({ ...gasto, id: "otro" }), gastoToRow(gasto)] },
    });
    valuesUpdate.mockResolvedValue({});
    const decidido: Gasto = {
      ...gasto, estado: "Aprobado", aprobadoPor: "gg@bosca.cl",
      fechaDecision: "2026-06-17T12:00:00Z", motivo: "",
    };
    await actualizarDecisionGasto(decidido);
    const arg = valuesUpdate.mock.calls[0][0] as { range: string; requestBody: { values: string[][] } };
    expect(arg.range).toBe("Gastos!A3:AD3"); // 2ª fila de datos => fila 3
    expect(arg.requestBody.values[0]).toEqual(gastoToRow(decidido));
  });

  it("lanza si el gasto no existe", async () => {
    valuesGet.mockResolvedValue({ data: { values: [] } });
    await expect(actualizarDecisionGasto(gasto)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Correr para ver fallar**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL ("actualizarDecisionGasto is not a function" / sin export).

- [ ] **Step 3: Implementar**

En `src/lib/sheets.ts`, después de `appendGasto`:

```ts
/** Reescribe la fila de un gasto (localizada por id en col A) con su estado y decisión. */
export async function actualizarDecisionGasto(gasto: Gasto): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Gastos!A2:AD",
  });
  const rows = (res.data.values ?? []) as string[][];
  const idx = rows.findIndex((r) => (r[0] ?? "") === gasto.id);
  if (idx === -1) throw new Error("Gasto no encontrado");
  const numeroFila = idx + 2; // fila 1 = encabezados
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Gastos!A${numeroFila}:AD${numeroFila}`,
    valueInputOption: "RAW",
    requestBody: { values: [gastoToRow(gasto)] },
  });
}
```

- [ ] **Step 4: Correr para ver pasar**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets.ts src/lib/sheets.test.ts
git commit -m "feat(aprobaciones): writer para persistir la decisión del gasto" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rutas API (lista pendiente y decisión)

No hay tests de rutas en el repo (la lógica está cubierta en `aprobaciones.ts`/`sheets.ts`); verificación por typecheck + build.

**Files:**
- Create: `src/app/api/aprobaciones/route.ts`
- Create: `src/app/api/gastos/[id]/decision/route.ts`

**Interfaces:**
- Consumes: `getBearerToken`, `autenticar`, `listGastos`, `actualizarDecisionGasto`, `gastosPorAprobar`, `puedeAprobar`.
- Produces:
  - `GET /api/aprobaciones` → `{ gastos: Gasto[] }` (pendientes que la sesión puede decidir).
  - `POST /api/gastos/[id]/decision` body `{ decision: "Aprobado"|"Rechazado", motivo?: string }` → `{ gasto }` o error.

- [ ] **Step 1: Crear `GET /api/aprobaciones`**

Crea `src/app/api/aprobaciones/route.ts` (sigue el patrón de `src/app/api/gastos/route.ts`):

```ts
import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos } from "@/lib/sheets";
import { gastosPorAprobar } from "@/lib/aprobaciones";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  try {
    const todos = await listGastos();
    return NextResponse.json({ gastos: gastosPorAprobar(todos, auth.usuario) });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer las aprobaciones" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Crear `POST /api/gastos/[id]/decision`**

Crea `src/app/api/gastos/[id]/decision/route.ts` (Next 16: `params` es Promise):

```ts
import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos, actualizarDecisionGasto } from "@/lib/sheets";
import { puedeAprobar } from "@/lib/aprobaciones";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  const { id } = await params;
  let body: { decision?: string; motivo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (body.decision !== "Aprobado" && body.decision !== "Rechazado") {
    return NextResponse.json({ error: "decision debe ser Aprobado o Rechazado" }, { status: 400 });
  }

  let gasto;
  try {
    const todos = await listGastos();
    gasto = todos.find((g) => g.id === id);
  } catch {
    return NextResponse.json({ error: "No se pudo leer el gasto" }, { status: 502 });
  }
  if (!gasto) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });

  if (!puedeAprobar(auth.usuario, gasto)) {
    return NextResponse.json({ error: "No puedes decidir este gasto" }, { status: 403 });
  }

  const decidido = {
    ...gasto,
    estado: body.decision,
    aprobadoPor: auth.usuario.email,
    fechaDecision: new Date().toISOString(),
    motivo: typeof body.motivo === "string" ? body.motivo.trim() : "",
  };
  try {
    await actualizarDecisionGasto(decidido);
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la decisión" }, { status: 502 });
  }
  return NextResponse.json({ gasto: decidido });
}
```

- [ ] **Step 3: Typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS (compila; las rutas aparecen en el output del build).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/aprobaciones/route.ts "src/app/api/gastos/[id]/decision/route.ts"
git commit -m "feat(aprobaciones): rutas API de lista pendiente y decisión" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Cliente y perfil (exponer alcance + llamadas)

**Files:**
- Modify: `src/app/api/perfil/route.ts`
- Modify: `src/lib/api-client.ts`

**Interfaces:**
- Consumes: `autenticar` (la sesión ya trae `apruebaCc`), `gastosPorAprobar` no aquí.
- Produces:
  - `GET /api/perfil` agrega `apruebaCc: string[]` y `cargo: string` a su respuesta.
  - `Perfil` (api-client) gana `apruebaCc: string[]` y `cargo: string`.
  - `obtenerAprobaciones(): Promise<{ gastos: Gasto[] }>`
  - `decidirGasto(id: string, decision: "Aprobado"|"Rechazado", motivo?: string): Promise<{ gasto: Gasto }>`

- [ ] **Step 1: `GET /api/perfil` devuelve el alcance**

En `src/app/api/perfil/route.ts`, en el objeto JSON del `GET` (junto a `nombre`, `rut`, ...), agrega:

```ts
      apruebaCc: usuario.apruebaCc,
      cargo: usuario.cargo,
```

- [ ] **Step 2: Extender `Perfil` y agregar llamadas en `api-client.ts`**

En `src/lib/api-client.ts`, en la interfaz `Perfil` agrega:

```ts
  apruebaCc: string[];
  cargo: string;
```

Al final del archivo agrega:

```ts
/** Lista los gastos pendientes que el usuario actual puede aprobar/rechazar. */
export function obtenerAprobaciones(): Promise<{ gastos: Gasto[] }> {
  return pedir<{ gastos: Gasto[] }>("/api/aprobaciones", { method: "GET" });
}

/** Registra la decisión (Aprobado/Rechazado) sobre un gasto. */
export function decidirGasto(
  id: string,
  decision: "Aprobado" | "Rechazado",
  motivo?: string,
): Promise<{ gasto: Gasto }> {
  return pedir<{ gasto: Gasto }>(`/api/gastos/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, motivo }),
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/perfil/route.ts src/lib/api-client.ts
git commit -m "feat(aprobaciones): exponer alcance en perfil y llamadas de cliente" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: UI — página `/aprobaciones` y enlace en el chat

**Files:**
- Create: `src/app/aprobaciones/page.tsx`
- Modify: `src/app/page.tsx` (enlace + contador en el encabezado del chat)

**Interfaces:**
- Consumes: `obtenerAprobaciones`, `decidirGasto` (Task 6), `Perfil.apruebaCc` (Task 6), `AuthGate`, `formatCLP`.
- Produces: ruta `/aprobaciones`; enlace "Aprobaciones" visible solo si `perfil.apruebaCc.length > 0`.

- [ ] **Step 1: Crear la página `/aprobaciones`**

Crea `src/app/aprobaciones/page.tsx` (patrón de `src/app/dashboard/page.tsx`: `AuthGate` + componente cliente):

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { obtenerAprobaciones, decidirGasto } from "@/lib/api-client";
import type { Gasto } from "@/lib/types";
import { formatCLP } from "@/lib/format";

function Aprobaciones() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    obtenerAprobaciones()
      .then((r) => setGastos(r.gastos))
      .catch(() => setError("No se pudieron cargar las aprobaciones."))
      .finally(() => setCargando(false));
  }, []);

  async function decidir(g: Gasto, decision: "Aprobado" | "Rechazado") {
    const motivo = (motivos[g.id] ?? "").trim();
    if (decision === "Rechazado" && motivo === "") {
      setError("Indica un motivo para rechazar.");
      return;
    }
    setProcesando(g.id);
    setError(null);
    try {
      await decidirGasto(g.id, decision, motivo || undefined);
      setGastos((xs) => xs.filter((x) => x.id !== g.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la decisión.");
    } finally {
      setProcesando(null);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-bosca-carbon bg-bosca-carbon px-4 py-3">
        <span className="font-semibold text-bosca-crema">🔥 Bosca · Aprobaciones</span>
        <Link href="/" className="rounded-lg border border-white/25 px-3 py-1 text-xs text-bosca-crema hover:bg-white/10">
          ← Chat
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {error && <p className="text-center text-sm text-bosca-burdeo">{error}</p>}
        {cargando ? (
          <p className="text-center text-sm text-gray-400">Cargando…</p>
        ) : gastos.length === 0 ? (
          <p className="text-center text-sm text-gray-400">No tienes gastos pendientes por aprobar.</p>
        ) : (
          gastos.map((g) => (
            <div key={g.id} className="rounded-2xl border border-bosca-gris bg-white p-4">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-bosca-carbon">{g.comercio}</span>
                <span className="font-semibold text-bosca-carbon">{formatCLP(g.monto)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {g.fechaDocumento} · {g.usuarioNombre} · CC {g.imputacion.centroCostoCodigo}
                {g.imputacion.centroCostoDetalle ? ` (${g.imputacion.centroCostoDetalle})` : ""} · {g.tipoRendicion}
              </p>
              {g.observacion && <p className="mt-1 text-xs text-gray-500">{g.observacion}</p>}
              {g.imagenUrl && (
                <a href={g.imagenUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-bosca-burdeo underline">
                  Ver boleta
                </a>
              )}
              <input
                className="mt-2 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
                placeholder="Motivo (obligatorio para rechazar)"
                value={motivos[g.id] ?? ""}
                onChange={(e) => setMotivos((m) => ({ ...m, [g.id]: e.target.value }))}
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => decidir(g, "Aprobado")}
                  disabled={procesando === g.id}
                  className="flex-1 rounded-lg bg-bosca-burdeo px-4 py-2 text-sm font-medium text-white hover:bg-bosca-burdeo-h disabled:opacity-40"
                >
                  Aprobar
                </button>
                <button
                  onClick={() => decidir(g, "Rechazado")}
                  disabled={procesando === g.id}
                  className="flex-1 rounded-lg border border-bosca-gris px-4 py-2 text-sm text-bosca-carbon disabled:opacity-40"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Aprobaciones />
    </AuthGate>
  );
}
```

- [ ] **Step 2: Enlace + contador en el encabezado del chat**

En `src/app/page.tsx`, dentro del componente `Chat` (que recibe `perfil`):

1. En los imports de `api-client`, agrega `obtenerAprobaciones` a la lista existente.
2. Dentro de `Chat`, agrega estado y carga del contador:

```tsx
  const [pendientes, setPendientes] = useState(0);

  useEffect(() => {
    if (perfil.apruebaCc.length === 0) return;
    obtenerAprobaciones()
      .then(({ gastos }) => setPendientes(gastos.length))
      .catch(() => {});
  }, [perfil.apruebaCc.length]);
```

3. En el `<header>`, dentro del `div` de la derecha (junto al enlace "Dashboard"), agrega antes del enlace Dashboard:

```tsx
          {perfil.apruebaCc.length > 0 && (
            <Link
              href="/aprobaciones"
              className="rounded-lg border border-white/25 px-3 py-1 text-xs text-bosca-crema hover:bg-white/10"
            >
              Aprobaciones{pendientes > 0 ? ` (${pendientes})` : ""}
            </Link>
          )}
```

- [ ] **Step 3: Typecheck y build**

Run: `npx tsc --noEmit && npm run build`
Expected: PASS (la ruta `/aprobaciones` aparece en el build).

- [ ] **Step 4: Verificación manual (dev server)**

Run: `npm run dev` y, autenticado con un usuario cuyo `aprueba_cc` esté cargado, abre `/aprobaciones`. Verifica: lista de pendientes de su(s) CC, que Aprobar quita el gasto, y que Rechazar exige motivo. (Si aún no hay datos cargados, este chequeo se completa tras la Task 8.)

- [ ] **Step 5: Commit**

```bash
git add src/app/aprobaciones/page.tsx src/app/page.tsx
git commit -m "feat(aprobaciones): página de aprobaciones y enlace en el chat" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Migración de encabezados y documentación

**Files:**
- Create: `scripts/migrar-aprobaciones.mjs`
- Modify: `package.json` (script npm)
- Modify: `docs/MANUAL-USUARIO.md`

**Interfaces:**
- Produces: encabezados `Usuarios!J1:K1` = `aprueba_cc`, `cargo`; `Gastos!AB1:AD1` = `aprobado_por`, `fecha_decision`, `motivo`.

- [ ] **Step 1: Crear el script de migración**

Crea `scripts/migrar-aprobaciones.mjs` (calcado de `scripts/migrar-encabezados.mjs`, cambiando solo `MIGRACIONES`):

```js
const MIGRACIONES = [
  {
    pestana: "Usuarios",
    rango: "Usuarios!J1:K1",
    encabezados: ["aprueba_cc", "cargo"],
  },
  {
    pestana: "Gastos",
    rango: "Gastos!AB1:AD1",
    encabezados: ["aprobado_por", "fecha_decision", "motivo"],
  },
];
```

(El resto del archivo —imports, `getEnv`, `getSheets`, `leerActual`, `main`, `--dry-run`— es idéntico a `migrar-encabezados.mjs`.)

- [ ] **Step 2: Agregar el script npm**

En `package.json`, en `scripts`, agrega:

```json
    "migrar-aprobaciones": "node --env-file=.env.local scripts/migrar-aprobaciones.mjs",
```

- [ ] **Step 3: Dry-run de la migración**

Run: `npm run migrar-aprobaciones -- --dry-run`
Expected: reporta que `Usuarios!J1:K1` y `Gastos!AB1:AD1` requieren migración (o que ya están al día). No escribe nada.

- [ ] **Step 4: Aplicar la migración**

Run: `npm run migrar-aprobaciones`
Expected: "Encabezados escritos en Usuarios!J1:K1" y "... Gastos!AB1:AD1".

> Luego, manualmente en la planilla `Usuarios`, carga `aprueba_cc`/`cargo` de cada gerente:
> Operaciones→`C0100`, Comercial→`C0200`, Adm. y Finanzas→`C0300`, Desarrollo→`C0400`,
> Gerente General→`*`. (El Administrador no necesita `aprueba_cc`: la sesión le da `*`.)

- [ ] **Step 5: Documentar en el manual de usuario**

En `docs/MANUAL-USUARIO.md`, agrega una sección nueva tras la 6 (roles):

```markdown
## 6.1. Aprobar o rechazar gastos (gerentes)

Si tu perfil tiene asignado uno o más centros de costo (o "todos", para el Gerente
General), verás el enlace **"Aprobaciones"** en el encabezado, con el número de gastos
pendientes.

1. Toca **"Aprobaciones"**.
2. Verás los gastos **pendientes** de tu(s) centro(s) de costo, con su detalle y la
   boleta.
3. **Aprobar**: el gasto queda aprobado y sale de la lista.
4. **Rechazar**: escribe el **motivo** (obligatorio) y confirma.

Notas:
- No puedes aprobar **tus propios** gastos: esos los revisa el Gerente General.
- El **Gerente General** puede aprobar en cualquier centro de costo.
- Una vez decidido, el gasto no vuelve a la lista (la decisión es final).
```

- [ ] **Step 6: Commit**

```bash
git add scripts/migrar-aprobaciones.mjs package.json docs/MANUAL-USUARIO.md
git commit -m "feat(aprobaciones): script de migración de encabezados y manual" -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verificación final

- [ ] `npm test` — toda la suite en verde.
- [ ] `npx tsc --noEmit` — sin errores de tipos.
- [ ] `npm run build` — build de Next OK con las rutas `/aprobaciones`, `/api/aprobaciones` y `/api/gastos/[id]/decision`.
- [ ] Migración aplicada y `aprueba_cc` cargados en la planilla.
- [ ] Prueba manual end-to-end: un gerente aprueba/rechaza gastos de su CC; no ve los propios ni los de otros CC; el Gerente General ve todos los pendientes.
