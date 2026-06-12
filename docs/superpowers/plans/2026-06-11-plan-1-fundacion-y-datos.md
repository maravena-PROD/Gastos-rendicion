# Plan 1 — Fundación y capa de datos (Sheets) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levantar el proyecto Next.js con TypeScript y Tailwind, definir los tipos del dominio, los helpers de formato chileno (RUT/CLP), y un módulo `sheets.ts` testeado que lee y escribe gastos y usuarios en Google Sheets.

**Architecture:** Next.js App Router (full-stack). La lógica externa vive en `src/lib/` como módulos aislados y testeables. `sheets.ts` encapsula toda interacción con Google Sheets vía la librería `googleapis` con autenticación por service account (JWT). Las funciones de mapeo fila↔objeto son puras y se prueban sin tocar Google; las llamadas a la API se prueban con `googleapis` mockeado.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Vitest (tests), googleapis (cliente de Sheets/Drive).

---

## Estructura de archivos (Plan 1)

| Archivo | Responsabilidad |
|---|---|
| `package.json`, `tsconfig.json`, config Next/Tailwind | Scaffold del proyecto |
| `vitest.config.ts` | Configuración de pruebas |
| `src/lib/types.ts` | Tipos del dominio: `Categoria`, `Gasto`, `Usuario`, `Rol` |
| `src/lib/format.ts` | Helpers puros: formatear/parsear CLP, formatear/validar RUT |
| `src/lib/format.test.ts` | Pruebas de los helpers |
| `src/lib/sheets.ts` | Cliente de Google Sheets + mapeo fila↔objeto + lectura/escritura |
| `src/lib/sheets.test.ts` | Pruebas de mapeo (puras) y de lectura/escritura (googleapis mockeado) |
| `.env.local.example` | Plantilla de variables de entorno |

---

## Task 0: Scaffold del proyecto

**Files:**
- Create: todo el esqueleto Next.js en la raíz del proyecto

- [ ] **Step 1: Crear la app Next.js**

Desde la raíz del proyecto (`Chat bot de gastos`), ejecuta:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-turbopack --use-npm
```

Cuando pregunte si sobrescribe archivos existentes (hay un `docs/` y `.git`), acepta continuar (no toca `docs/` ni `.git`).

- [ ] **Step 2: Verificar que la app arranca**

Run: `npm run dev`
Expected: servidor en `http://localhost:3000` sin errores. Detén con Ctrl+C.

- [ ] **Step 3: Instalar dependencias del proyecto**

```bash
npm install googleapis
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 4: Agregar script de test a package.json**

En `package.json`, dentro de `"scripts"`, agrega:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Crear vitest.config.ts**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: Crear un test de humo para validar el setup**

Create `src/lib/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("setup", () => {
  it("ejecuta vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 7: Correr la prueba de humo**

Run: `npm test`
Expected: PASS — 1 test pasa.

- [ ] **Step 8: Borrar el test de humo**

```bash
rm src/lib/smoke.test.ts
```

- [ ] **Step 9: Crear plantilla de variables de entorno**

Create `.env.local.example`:

```
# Google Service Account (crear en Google Cloud Console)
GOOGLE_SERVICE_ACCOUNT_EMAIL=tu-sa@tu-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"

# ID de la planilla de Google Sheets (de la URL de la planilla)
GOOGLE_SHEETS_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz

# API key de Anthropic (Plan 3)
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 10: Asegurar que .env.local está en .gitignore**

Verifica que `.gitignore` (creado por create-next-app) contiene `.env*.local`. Si no, agrégalo.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Tailwind + Vitest, plantilla env"
```

---

## Task 1: Tipos del dominio

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Definir los tipos**

Create `src/lib/types.ts`:

```ts
export const CATEGORIAS = [
  "Combustible",
  "Alimentación",
  "Transporte",
  "Peajes",
  "Hospedaje",
  "Materiales",
  "Servicios",
  "Otros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export type EstadoGasto = "Registrado" | "Aprobado" | "Rechazado";

export interface Gasto {
  id: string;
  fechaRegistro: string; // ISO 8601
  usuarioEmail: string;
  usuarioNombre: string;
  fechaDocumento: string; // YYYY-MM-DD
  comercio: string;
  rutEmisor: string; // puede ser ""
  numeroDocumento: string; // puede ser ""
  categoria: Categoria;
  monto: number; // entero CLP
  direccion: string; // puede ser ""
  observacion: string; // puede ser ""
  imagenUrl: string; // puede ser ""
  imagenDriveId: string; // puede ser ""
  estado: EstadoGasto;
  fechaCreacion: string; // ISO 8601
}

export type Rol = "Administrador" | "Usuario";

export interface Usuario {
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  fechaAlta: string; // ISO 8601
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: tipos del dominio (Gasto, Usuario, Categoria, Rol)"
```

---

## Task 2: Helpers de formato CLP

**Files:**
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`

- [ ] **Step 1: Escribir las pruebas que fallan (CLP)**

Create `src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatCLP, parseCLP } from "./format";

describe("formatCLP", () => {
  it("formatea entero a pesos con separador de miles", () => {
    expect(formatCLP(45000)).toBe("$45.000");
  });
  it("formatea cero", () => {
    expect(formatCLP(0)).toBe("$0");
  });
  it("formatea millones", () => {
    expect(formatCLP(1234567)).toBe("$1.234.567");
  });
});

describe("parseCLP", () => {
  it("parsea string con símbolo y puntos", () => {
    expect(parseCLP("$45.000")).toBe(45000);
  });
  it("parsea solo dígitos", () => {
    expect(parseCLP("45000")).toBe(45000);
  });
  it("parsea con 'pesos' y espacios", () => {
    expect(parseCLP("45.000 pesos")).toBe(45000);
  });
  it("ignora decimales escritos como ,00", () => {
    expect(parseCLP("$45.000,00")).toBe(45000);
  });
  it("devuelve null si no hay dígitos", () => {
    expect(parseCLP("nada")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — "formatCLP is not a function" (el módulo aún no existe).

- [ ] **Step 3: Implementar los helpers CLP**

Create `src/lib/format.ts`:

```ts
/** Formatea un entero de pesos chilenos como "$45.000". */
export function formatCLP(monto: number): string {
  const entero = Math.round(monto);
  const conPuntos = entero
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${conPuntos}`;
}

/**
 * Parsea un texto de monto en CLP a entero.
 * Ignora símbolo, separadores de miles y decimales tipo ",00".
 * Devuelve null si no hay dígitos.
 */
export function parseCLP(texto: string): number | null {
  // Elimina parte decimal ",dd" al final antes de quitar separadores.
  const sinDecimales = texto.replace(/,\d{1,2}\b/g, "");
  const soloDigitos = sinDecimales.replace(/[^\d]/g, "");
  if (soloDigitos.length === 0) return null;
  return parseInt(soloDigitos, 10);
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS — todas las pruebas de CLP pasan.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: helpers de formato CLP (formatCLP, parseCLP) con tests"
```

---

## Task 3: Helpers de RUT chileno

**Files:**
- Modify: `src/lib/format.ts`
- Modify: `src/lib/format.test.ts`

- [ ] **Step 1: Agregar pruebas que fallan (RUT)**

Agrega al final de `src/lib/format.test.ts`:

```ts
import { formatRut, validarRut } from "./format";

describe("formatRut", () => {
  it("formatea RUT con puntos y guión", () => {
    expect(formatRut("761234567")).toBe("76.123.456-7");
  });
  it("acepta dígito verificador K", () => {
    expect(formatRut("12345678K")).toBe("12.345.678-K");
  });
  it("normaliza un RUT que ya viene con formato", () => {
    expect(formatRut("76.123.456-7")).toBe("76.123.456-7");
  });
});

describe("validarRut", () => {
  it("valida un RUT correcto (módulo 11)", () => {
    expect(validarRut("76.123.456-7")).toBe(true);
  });
  it("rechaza un RUT con dígito verificador incorrecto", () => {
    expect(validarRut("76.123.456-8")).toBe(false);
  });
  it("rechaza basura", () => {
    expect(validarRut("hola")).toBe(false);
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/format.test.ts`
Expected: FAIL — "formatRut is not a function".

- [ ] **Step 3: Implementar los helpers de RUT**

Agrega al final de `src/lib/format.ts`:

```ts
/** Quita puntos, guión y espacios; deja cuerpo + dígito verificador en mayúscula. */
function limpiarRut(rut: string): string {
  return rut.replace(/[.\-\s]/g, "").toUpperCase();
}

/** Formatea un RUT como "76.123.456-7". Devuelve el input limpio si es muy corto. */
export function formatRut(rut: string): string {
  const limpio = limpiarRut(rut);
  if (limpio.length < 2) return limpio;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  const cuerpoConPuntos = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${cuerpoConPuntos}-${dv}`;
}

/** Calcula el dígito verificador (módulo 11) de un cuerpo numérico. */
function calcularDv(cuerpo: string): string {
  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const resto = 11 - (suma % 11);
  if (resto === 11) return "0";
  if (resto === 10) return "K";
  return resto.toString();
}

/** Valida un RUT chileno con su dígito verificador (módulo 11). */
export function validarRut(rut: string): boolean {
  const limpio = limpiarRut(rut);
  if (!/^\d+[\dK]$/.test(limpio) || limpio.length < 2) return false;
  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  return calcularDv(cuerpo) === dv;
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/format.test.ts`
Expected: PASS — todas las pruebas (CLP + RUT) pasan.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: helpers de RUT (formatRut, validarRut módulo 11) con tests"
```

---

## Task 4: Mapeo fila ↔ Gasto

**Files:**
- Create: `src/lib/sheets.ts`
- Create: `src/lib/sheets.test.ts`

**Contexto:** En la planilla, la pestaña `Gastos` tiene encabezados en la fila 1 y los datos
desde la fila 2. El orden de columnas es el del modelo de datos (Sección 2 del spec):
`id, fecha_registro, usuario_email, usuario_nombre, fecha_documento, comercio, rut_emisor,
numero_documento, categoria, monto, direccion, observacion, imagen_url, imagen_drive_id,
estado, fecha_creacion`. Una "fila" de la API de Sheets es `string[]`.

- [ ] **Step 1: Escribir las pruebas de mapeo que fallan**

Create `src/lib/sheets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { gastoToRow, rowToGasto } from "./sheets";
import type { Gasto } from "./types";

const gasto: Gasto = {
  id: "g_a1b2c3",
  fechaRegistro: "2026-06-11T14:32:00Z",
  usuarioEmail: "maravena@bosca.cl",
  usuarioNombre: "M. Aravena",
  fechaDocumento: "2026-06-10",
  comercio: "Copec",
  rutEmisor: "76.123.456-7",
  numeroDocumento: "0012345",
  categoria: "Combustible",
  monto: 45000,
  direccion: "Av. Principal 123",
  observacion: "Camioneta flota",
  imagenUrl: "https://drive.google.com/file/d/abc/view",
  imagenDriveId: "abc",
  estado: "Registrado",
  fechaCreacion: "2026-06-11T14:32:05Z",
};

describe("gastoToRow / rowToGasto", () => {
  it("convierte un Gasto a fila en el orden correcto", () => {
    const row = gastoToRow(gasto);
    expect(row[0]).toBe("g_a1b2c3");
    expect(row[8]).toBe("Combustible");
    expect(row[9]).toBe("45000"); // monto como string
    expect(row.length).toBe(16);
  });

  it("es ida y vuelta (round-trip)", () => {
    const row = gastoToRow(gasto);
    expect(rowToGasto(row)).toEqual(gasto);
  });

  it("rowToGasto parsea monto a entero", () => {
    const row = gastoToRow(gasto);
    expect(rowToGasto(row).monto).toBe(45000);
  });

  it("rowToGasto tolera celdas faltantes al final como string vacío", () => {
    const row = gastoToRow(gasto).slice(0, 13); // recorta imagen_drive_id, estado, fecha_creacion
    const parsed = rowToGasto(row);
    expect(parsed.imagenDriveId).toBe("");
    expect(parsed.estado).toBe("Registrado"); // default cuando falta
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL — "gastoToRow is not a function".

- [ ] **Step 3: Implementar el mapeo**

Create `src/lib/sheets.ts`:

```ts
import type { Gasto, Categoria, EstadoGasto } from "./types";
import { CATEGORIAS } from "./types";

/** Orden de columnas de la pestaña Gastos (debe coincidir con los encabezados). */
export const GASTOS_HEADERS = [
  "id",
  "fecha_registro",
  "usuario_email",
  "usuario_nombre",
  "fecha_documento",
  "comercio",
  "rut_emisor",
  "numero_documento",
  "categoria",
  "monto",
  "direccion",
  "observacion",
  "imagen_url",
  "imagen_drive_id",
  "estado",
  "fecha_creacion",
] as const;

/** Convierte un Gasto en una fila (string[]) para escribir en Sheets. */
export function gastoToRow(g: Gasto): string[] {
  return [
    g.id,
    g.fechaRegistro,
    g.usuarioEmail,
    g.usuarioNombre,
    g.fechaDocumento,
    g.comercio,
    g.rutEmisor,
    g.numeroDocumento,
    g.categoria,
    String(g.monto),
    g.direccion,
    g.observacion,
    g.imagenUrl,
    g.imagenDriveId,
    g.estado,
    g.fechaCreacion,
  ];
}

/** Lee una celda tolerando undefined (filas recortadas por la API de Sheets). */
function cell(row: string[], i: number): string {
  return row[i] ?? "";
}

function parseCategoria(v: string): Categoria {
  return (CATEGORIAS as readonly string[]).includes(v)
    ? (v as Categoria)
    : "Otros";
}

function parseEstado(v: string): EstadoGasto {
  if (v === "Aprobado" || v === "Rechazado") return v;
  return "Registrado";
}

/** Convierte una fila de Sheets en un Gasto. */
export function rowToGasto(row: string[]): Gasto {
  return {
    id: cell(row, 0),
    fechaRegistro: cell(row, 1),
    usuarioEmail: cell(row, 2),
    usuarioNombre: cell(row, 3),
    fechaDocumento: cell(row, 4),
    comercio: cell(row, 5),
    rutEmisor: cell(row, 6),
    numeroDocumento: cell(row, 7),
    categoria: parseCategoria(cell(row, 8)),
    monto: parseInt(cell(row, 9) || "0", 10),
    direccion: cell(row, 10),
    observacion: cell(row, 11),
    imagenUrl: cell(row, 12),
    imagenDriveId: cell(row, 13),
    estado: parseEstado(cell(row, 14)),
    fechaCreacion: cell(row, 15),
  };
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: PASS — las 4 pruebas de mapeo pasan.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets.ts src/lib/sheets.test.ts
git commit -m "feat: mapeo fila<->Gasto en sheets.ts con tests"
```

---

## Task 5: Cliente de Sheets y lectura/escritura de gastos

**Files:**
- Modify: `src/lib/sheets.ts`
- Modify: `src/lib/sheets.test.ts`

**Contexto:** `getSheetsClient()` arma un cliente autenticado con la service account desde
variables de entorno. `listGastos()` lee la pestaña `Gastos` (sin la fila de encabezados).
`appendGasto()` agrega una fila. En las pruebas mockeamos `googleapis` para no llamar a la red.

- [ ] **Step 1: Agregar pruebas que fallan (lectura/escritura con mock)**

Agrega al inicio de `src/lib/sheets.test.ts` (después de los imports existentes):

```ts
import { vi, beforeEach } from "vitest";

// Mock de googleapis: capturamos las llamadas a spreadsheets.values
const valuesGet = vi.fn();
const valuesAppend = vi.fn();

vi.mock("googleapis", () => {
  return {
    google: {
      auth: {
        GoogleAuth: class {
          constructor(_opts: unknown) {}
        },
      },
      sheets: () => ({
        spreadsheets: {
          values: {
            get: (...args: unknown[]) => valuesGet(...args),
            append: (...args: unknown[]) => valuesAppend(...args),
          },
        },
      }),
    },
  };
});
```

Y agrega este bloque de pruebas al final del archivo:

```ts
import { listGastos, appendGasto } from "./sheets";

beforeEach(() => {
  valuesGet.mockReset();
  valuesAppend.mockReset();
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@test.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = "fake-key";
  process.env.GOOGLE_SHEETS_ID = "sheet-123";
});

describe("listGastos", () => {
  it("devuelve los gastos mapeados, sin la fila de encabezados", async () => {
    valuesGet.mockResolvedValue({
      data: { values: [gastoToRow(gasto)] }, // la API recibe range desde la fila 2
    });
    const result = await listGastos();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(gasto);
  });

  it("devuelve [] cuando no hay filas", async () => {
    valuesGet.mockResolvedValue({ data: {} });
    expect(await listGastos()).toEqual([]);
  });
});

describe("appendGasto", () => {
  it("llama a append con la fila del gasto", async () => {
    valuesAppend.mockResolvedValue({});
    await appendGasto(gasto);
    expect(valuesAppend).toHaveBeenCalledTimes(1);
    const arg = valuesAppend.mock.calls[0][0] as {
      requestBody: { values: string[][] };
    };
    expect(arg.requestBody.values[0]).toEqual(gastoToRow(gasto));
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL — "listGastos is not a function".

- [ ] **Step 3: Implementar el cliente y las operaciones**

Agrega al inicio de `src/lib/sheets.ts` (después de los imports de tipos):

```ts
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

/** Construye un cliente de Sheets autenticado con la service account. */
function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      // Las claves en .env usan "\n" literales; los convertimos a saltos reales.
      private_key: getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}
```

Y agrega al final de `src/lib/sheets.ts`:

```ts
/** Lee todos los gastos de la pestaña Gastos (desde la fila 2). */
export async function listGastos(): Promise<Gasto[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Gastos!A2:P",
  });
  const rows = res.data.values ?? [];
  return rows.map((r) => rowToGasto(r as string[]));
}

/** Agrega un gasto como nueva fila en la pestaña Gastos. */
export async function appendGasto(g: Gasto): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Gastos!A2:P",
    valueInputOption: "RAW",
    requestBody: { values: [gastoToRow(g)] },
  });
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: PASS — pruebas de mapeo + lectura + escritura pasan.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sheets.ts src/lib/sheets.test.ts
git commit -m "feat: cliente de Sheets + listGastos/appendGasto con tests (googleapis mockeado)"
```

---

## Task 6: Lectura de usuarios y verificación de rol

**Files:**
- Modify: `src/lib/sheets.ts`
- Modify: `src/lib/sheets.test.ts`

**Contexto:** La pestaña `Usuarios` tiene columnas `email, nombre, rol, activo, fecha_alta`
(encabezados en fila 1, datos desde fila 2). `getUsuario(email)` busca por email (case-insensitive)
y devuelve el `Usuario` o `null` si no existe o está inactivo. Esto es la base del control de
acceso del Plan 2.

- [ ] **Step 1: Agregar pruebas que fallan (usuarios)**

Agrega al final de `src/lib/sheets.test.ts`:

```ts
import { getUsuario, usuarioRowToUsuario } from "./sheets";

describe("usuarioRowToUsuario", () => {
  it("mapea una fila a Usuario y parsea activo", () => {
    const u = usuarioRowToUsuario([
      "maravena@bosca.cl",
      "M. Aravena",
      "Administrador",
      "TRUE",
      "2026-06-01T00:00:00Z",
    ]);
    expect(u.rol).toBe("Administrador");
    expect(u.activo).toBe(true);
  });

  it("rol desconocido cae a Usuario", () => {
    const u = usuarioRowToUsuario(["x@bosca.cl", "X", "jefe", "TRUE", ""]);
    expect(u.rol).toBe("Usuario");
  });
});

describe("getUsuario", () => {
  it("encuentra un usuario activo (case-insensitive en email)", async () => {
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ["otro@bosca.cl", "Otro", "Usuario", "TRUE", ""],
          ["maravena@bosca.cl", "M. Aravena", "Administrador", "TRUE", ""],
        ],
      },
    });
    const u = await getUsuario("MARAVENA@bosca.cl");
    expect(u?.nombre).toBe("M. Aravena");
    expect(u?.rol).toBe("Administrador");
  });

  it("devuelve null si el usuario está inactivo", async () => {
    valuesGet.mockResolvedValue({
      data: { values: [["x@bosca.cl", "X", "Usuario", "FALSE", ""]] },
    });
    expect(await getUsuario("x@bosca.cl")).toBeNull();
  });

  it("devuelve null si el usuario no existe", async () => {
    valuesGet.mockResolvedValue({ data: { values: [] } });
    expect(await getUsuario("nadie@bosca.cl")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL — "getUsuario is not a function".

- [ ] **Step 3: Implementar lectura de usuarios**

Agrega al final de `src/lib/sheets.ts` (e importa `Usuario` y `Rol` en el import de tipos del tope del archivo: cámbialo a `import type { Gasto, Categoria, EstadoGasto, Usuario, Rol } from "./types";`):

```ts
function parseRol(v: string): Rol {
  return v === "Administrador" ? "Administrador" : "Usuario";
}

/** Convierte una fila de la pestaña Usuarios en un Usuario. */
export function usuarioRowToUsuario(row: string[]): Usuario {
  return {
    email: cell(row, 0),
    nombre: cell(row, 1),
    rol: parseRol(cell(row, 2)),
    activo: cell(row, 3).toUpperCase() === "TRUE",
    fechaAlta: cell(row, 4),
  };
}

/**
 * Busca un usuario por email (case-insensitive). Devuelve null si no existe
 * o si está inactivo (activo=FALSE).
 */
export async function getUsuario(email: string): Promise<Usuario | null> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Usuarios!A2:E",
  });
  const rows = (res.data.values ?? []) as string[][];
  const match = rows
    .map(usuarioRowToUsuario)
    .find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!match || !match.activo) return null;
  return match;
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: PASS — todas las pruebas de sheets pasan.

- [ ] **Step 5: Verificar tipos y suite completa**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores de tipos; toda la suite (format + sheets) en verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sheets.ts src/lib/sheets.test.ts
git commit -m "feat: getUsuario + mapeo de usuarios para control de acceso (con tests)"
```

---

## Task 7: Helper de creación de gastos (IDs y timestamps)

**Files:**
- Create: `src/lib/gasto-factory.ts`
- Create: `src/lib/gasto-factory.test.ts`

**Contexto:** Necesitamos una función que arme un `Gasto` completo a partir de los datos
extraídos por el bot/OCR (Plan 3), rellenando `id`, `fechaRegistro`, `fechaCreacion` y los
defaults. Aislarla aquí la hace testeable y evita repetir lógica en las rutas.

- [ ] **Step 1: Escribir las pruebas que fallan**

Create `src/lib/gasto-factory.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { crearGasto } from "./gasto-factory";

describe("crearGasto", () => {
  const base = {
    usuarioEmail: "maravena@bosca.cl",
    usuarioNombre: "M. Aravena",
    fechaDocumento: "2026-06-10",
    comercio: "Copec",
    categoria: "Combustible" as const,
    monto: 45000,
  };

  it("genera un id con prefijo g_", () => {
    const g = crearGasto(base);
    expect(g.id).toMatch(/^g_/);
  });

  it("pone estado Registrado por defecto", () => {
    expect(crearGasto(base).estado).toBe("Registrado");
  });

  it("rellena campos opcionales como string vacío", () => {
    const g = crearGasto(base);
    expect(g.rutEmisor).toBe("");
    expect(g.observacion).toBe("");
    expect(g.imagenUrl).toBe("");
  });

  it("respeta campos opcionales cuando se entregan", () => {
    const g = crearGasto({ ...base, rutEmisor: "76.123.456-7", observacion: "flota" });
    expect(g.rutEmisor).toBe("76.123.456-7");
    expect(g.observacion).toBe("flota");
  });

  it("fechaRegistro y fechaCreacion son ISO 8601", () => {
    const g = crearGasto(base);
    expect(() => new Date(g.fechaRegistro).toISOString()).not.toThrow();
    expect(g.fechaCreacion).toContain("T");
  });

  it("genera ids distintos en llamadas sucesivas", () => {
    expect(crearGasto(base).id).not.toBe(crearGasto(base).id);
  });
});
```

- [ ] **Step 2: Correr para verificar que falla**

Run: `npx vitest run src/lib/gasto-factory.test.ts`
Expected: FAIL — "crearGasto is not a function".

- [ ] **Step 3: Implementar la factory**

Create `src/lib/gasto-factory.ts`:

```ts
import { randomUUID } from "crypto";
import type { Gasto, Categoria } from "./types";

/** Datos mínimos para crear un gasto; el resto se rellena con defaults. */
export interface NuevoGastoInput {
  usuarioEmail: string;
  usuarioNombre: string;
  fechaDocumento: string;
  comercio: string;
  categoria: Categoria;
  monto: number;
  rutEmisor?: string;
  numeroDocumento?: string;
  direccion?: string;
  observacion?: string;
  imagenUrl?: string;
  imagenDriveId?: string;
}

/** Arma un Gasto completo a partir de los datos extraídos, con id y timestamps. */
export function crearGasto(input: NuevoGastoInput): Gasto {
  const ahora = new Date().toISOString();
  return {
    id: `g_${randomUUID().slice(0, 8)}`,
    fechaRegistro: ahora,
    usuarioEmail: input.usuarioEmail,
    usuarioNombre: input.usuarioNombre,
    fechaDocumento: input.fechaDocumento,
    comercio: input.comercio,
    rutEmisor: input.rutEmisor ?? "",
    numeroDocumento: input.numeroDocumento ?? "",
    categoria: input.categoria,
    monto: input.monto,
    direccion: input.direccion ?? "",
    observacion: input.observacion ?? "",
    imagenUrl: input.imagenUrl ?? "",
    imagenDriveId: input.imagenDriveId ?? "",
    estado: "Registrado",
    fechaCreacion: ahora,
  };
}
```

- [ ] **Step 4: Correr para verificar que pasa**

Run: `npx vitest run src/lib/gasto-factory.test.ts`
Expected: PASS — las 6 pruebas pasan.

- [ ] **Step 5: Verificar suite completa y tipos**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores; toda la suite en verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/gasto-factory.ts src/lib/gasto-factory.test.ts
git commit -m "feat: crearGasto (factory con id y timestamps) con tests"
```

---

## Self-Review (cobertura del Plan 1 vs spec)

- **Stack y estructura (Sección 1):** Task 0 levanta Next.js + Tailwind + Vitest; `src/lib/`
  queda como capa de servicios aislada. ✅
- **Modelo de datos (Sección 2):** Task 1 (tipos), Tasks 4–6 (mapeo y orden de columnas exacto
  de ambas pestañas). ✅
- **Formato chileno (Sección 2: CLP entero, RUT):** Tasks 2–3. ✅
- **Base del control de acceso por rol (Sección 5):** Task 6 (`getUsuario` con activo). El
  enforcement HTTP va en el Plan 2. ✅
- **Lo que NO cubre el Plan 1 (correcto, va en planes siguientes):** Firebase Auth y rutas API
  (Plan 2); Drive, Claude, chat, OCR (Plan 3); dashboard (Plan 4).

**Sin placeholders:** todos los pasos de código incluyen el código real. **Consistencia de
tipos:** `Gasto`, `Usuario`, `Categoria`, `Rol`, `EstadoGasto` usados igual en types/sheets/
factory; `gastoToRow`/`rowToGasto`/`crearGasto`/`getUsuario` con firmas consistentes.

**Dependencia externa para correr de verdad (no para los tests):** `listGastos`/`appendGasto`/
`getUsuario` necesitan la planilla creada y las variables de entorno (Google Cloud). Los tests
no lo requieren (googleapis mockeado). La creación de la planilla y el seteo de columnas se
documentará en el Manual de Instalación (Plan 3/4).
