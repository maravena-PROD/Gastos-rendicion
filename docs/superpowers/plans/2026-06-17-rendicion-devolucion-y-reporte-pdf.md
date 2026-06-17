# Rendición/Devolución, campos tributarios y reporte PDF — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clasificar cada gasto como Rendición o Devolución, capturar tipo de documento y desglose Neto/IVA desde la foto, exigir cuenta corriente en devoluciones, y permitir descargar un PDF tipo el documento de referencia filtrado por rango de fechas.

**Architecture:** Se extienden el modelo `Gasto` y `Usuario`, la persistencia en Google Sheets (columnas aditivas al final), la extracción OCR con Claude, la tarjeta de confirmación del chat, el dashboard (rango desde/hasta) y se agrega una ruta que renderiza un PDF con `@react-pdf/renderer`. La lógica numérica y de armado del reporte vive en módulos puros con tests.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, googleapis (Sheets), `@anthropic-ai/sdk` (Claude Haiku), `@react-pdf/renderer`, vitest.

## Global Constraints

- TypeScript estricto; no introducir `any` salvo el cast local ya usado para `output_config` de Claude.
- Persistencia: Google Sheets. Las columnas nuevas se agregan **al final** de cada pestaña; nunca reordenar columnas existentes.
- Montos: enteros CLP. IVA Chile = 19%. `monto` = Total.
- `rowToGasto`/`usuarioRowToUsuario` deben tolerar filas históricas cortas (celdas faltantes → `""`, parseadas a sus defaults).
- Tests con vitest siguiendo el patrón `src/lib/*.test.ts` existente (mock de `googleapis` como en `sheets.test.ts`).
- Idioma del código y la UI: español, siguiendo la convención del repo (nombres como `crearGasto`, `formatCLP`).
- Commits frecuentes, uno por tarea como mínimo. Mensajes en español, estilo `feat(...)`/`fix(...)` como el historial.

---

### Task 1: Modelo de datos + Sheets + factory

Agrega los campos nuevos a `Gasto` y `Usuario` y actualiza TODOS sus constructores directos (Sheets y factory) en una sola tarea para que el build quede verde.

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/sheets.ts`
- Modify: `src/lib/gasto-factory.ts`
- Modify (tests): `src/lib/sheets.test.ts`, `src/lib/gasto-factory.test.ts`, `src/lib/auth.test.ts`, `src/lib/auth-server.test.ts`, `src/lib/perfil.test.ts`

**Interfaces:**
- Produces:
  - `type TipoRendicion = "Rendicion" | "Devolucion"`
  - `type TipoDocumento = "Boleta" | "Factura" | "Otro"`; `const TIPOS_DOCUMENTO: TipoDocumento[]`
  - `Gasto` con `tipoRendicion: TipoRendicion`, `tipoDocumento: TipoDocumento`, `montoNeto: number`, `iva: number`
  - `Usuario` con `banco: string`, `cuentaCorriente: string`
  - `NuevoGastoInput` con `tipoRendicion`, `tipoDocumento`, `montoNeto?`, `iva?`
  - `actualizarPerfilUsuario(email, { nombre, rut, area, banco?, cuentaCorriente? })`

- [ ] **Step 1: Escribir los tipos nuevos (falla el build de tests hasta completar la tarea)**

En `src/lib/types.ts`, agrega los alias y los campos:

```ts
export type TipoRendicion = "Rendicion" | "Devolucion";
export type TipoDocumento = "Boleta" | "Factura" | "Otro";
export const TIPOS_DOCUMENTO: TipoDocumento[] = ["Boleta", "Factura", "Otro"];
```

Dentro de `interface Gasto`, después de `imputacion: Imputacion;` agrega:

```ts
  tipoRendicion: TipoRendicion; // "Rendicion" (default) o "Devolucion"
  tipoDocumento: TipoDocumento; // Boleta / Factura / Otro
  montoNeto: number; // entero CLP; 0 si no aplica
  iva: number; // entero CLP; 0 si no aplica
```

Dentro de `interface Usuario`, después de `area: string;` agrega:

```ts
  banco: string; // p. ej. "Banco Santander"; "" si no tiene
  cuentaCorriente: string; // número de cuenta; "" si no tiene
```

- [ ] **Step 2: Actualizar `gastoToRow`, `rowToGasto`, headers y rangos en `src/lib/sheets.ts`**

Agrega al final de `GASTOS_HEADERS` (antes del `] as const;`):

```ts
  "tipo_rendicion",
  "tipo_documento",
  "monto_neto",
  "iva",
```

En `gastoToRow`, antes del `];` de cierre agrega:

```ts
    g.tipoRendicion,
    g.tipoDocumento,
    String(g.montoNeto),
    String(g.iva),
```

Agrega estos parsers junto a los existentes:

```ts
function parseTipoRendicion(v: string): TipoRendicion {
  return v === "Devolucion" ? "Devolucion" : "Rendicion";
}

function parseTipoDocumento(v: string): TipoDocumento {
  return v === "Boleta" || v === "Factura" || v === "Otro" ? v : "Otro";
}
```

Actualiza el import del tope del archivo para incluir los tipos nuevos:

```ts
import type {
  Gasto, Categoria, EstadoGasto, Usuario, Rol, CentroCostoEntry,
  TipoRendicion, TipoDocumento,
} from "./types";
```

En `rowToGasto`, después de la propiedad `imputacion: { ... }`, agrega:

```ts
    tipoRendicion: parseTipoRendicion(cell(row, 23)),
    tipoDocumento: parseTipoDocumento(cell(row, 24)),
    montoNeto: parseMonto(cell(row, 25)),
    iva: parseMonto(cell(row, 26)),
```

Cambia los rangos de Gastos de `A2:W` a `A2:AA` en `listGastos` y `appendGasto`.

- [ ] **Step 3: Actualizar Usuarios en `src/lib/sheets.ts` (banco + cuenta corriente)**

En `usuarioRowToUsuario`, después de `area: cell(row, 6),` agrega:

```ts
    banco: cell(row, 7),
    cuentaCorriente: cell(row, 8),
```

En `getUsuario`, cambia el rango `Usuarios!A2:G` por `Usuarios!A2:I`.

Reemplaza la firma y el cuerpo de `actualizarPerfilUsuario` para aceptar y preservar banco/cuenta:

```ts
export async function actualizarPerfilUsuario(
  email: string,
  perfil: { nombre: string; rut: string; area: string; banco?: string; cuentaCorriente?: string },
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Usuarios!A2:I",
  });
  const rows = (res.data.values ?? []) as string[][];
  const idx = rows.findIndex((r) => (r[0] ?? "").toLowerCase() === email.toLowerCase());
  if (idx === -1) throw new Error("Usuario no encontrado");
  const fila = rows[idx];
  const filaActualizada = [
    fila[0] ?? email, // email
    perfil.nombre, // nombre
    fila[2] ?? "Usuario", // rol (preservado)
    fila[3] ?? "TRUE", // activo (preservado)
    fila[4] ?? "", // fecha_alta (preservada)
    perfil.rut, // rut
    perfil.area, // area
    perfil.banco ?? fila[7] ?? "", // banco (preservado si no se envía)
    perfil.cuentaCorriente ?? fila[8] ?? "", // cuenta_corriente (preservado si no se envía)
  ];
  const numeroFila = idx + 2; // fila 1 = encabezados
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Usuarios!A${numeroFila}:I${numeroFila}`,
    valueInputOption: "RAW",
    requestBody: { values: [filaActualizada] },
  });
}
```

- [ ] **Step 4: Actualizar `NuevoGastoInput` y `crearGasto` en `src/lib/gasto-factory.ts`**

Cambia el import:

```ts
import type { Gasto, Categoria, Imputacion, TipoRendicion, TipoDocumento } from "./types";
```

En `NuevoGastoInput`, agrega:

```ts
  tipoRendicion: TipoRendicion;
  tipoDocumento: TipoDocumento;
  montoNeto?: number;
  iva?: number;
```

En el objeto que retorna `crearGasto`, después de `imputacion: input.imputacion,` agrega:

```ts
    tipoRendicion: input.tipoRendicion,
    tipoDocumento: input.tipoDocumento,
    montoNeto: input.montoNeto ?? 0,
    iva: input.iva ?? 0,
```

- [ ] **Step 5: Actualizar literales `Usuario` en los tests existentes**

En `src/lib/auth.test.ts`, `src/lib/auth-server.test.ts` y `src/lib/perfil.test.ts`, en cada objeto tipado `Usuario` (los que tienen `fechaAlta:`), agrega dos líneas:

```ts
  banco: "",
  cuentaCorriente: "",
```

Si en alguno de esos archivos hay un objeto `Usuario` parcial sin `fechaAlta` visible, agrégalas igual para que el objeto cumpla la interfaz.

- [ ] **Step 6: Actualizar las aserciones de `gastoToRow`/`rowToGasto` en `src/lib/sheets.test.ts`**

Reemplaza el objeto `gasto` de prueba para incluir los campos nuevos (después de `imputacion: { ... },`):

```ts
  tipoRendicion: "Rendicion",
  tipoDocumento: "Boleta",
  montoNeto: 0,
  iva: 0,
```

En el test "convierte un Gasto a fila en el orden correcto", cambia:

```ts
    expect(row.length).toBe(27);
    expect(row[23]).toBe("Rendicion");
    expect(row[24]).toBe("Boleta");
```

Y reemplaza `expect(row[22]).toBe("Casa Matriz");` por `expect(row[22]).toBe("Casa Matriz");` (sin cambio; sigue siendo la ubicación). El `row[16]` y `row[17]` no cambian.

- [ ] **Step 7: Agregar tests de columnas nuevas y factory**

En `src/lib/sheets.test.ts`, dentro del `describe("gastoToRow / rowToGasto", ...)`, agrega:

```ts
  it("round-trip preserva tipo de rendición, documento, neto e IVA", () => {
    const factura: Gasto = {
      ...gasto,
      tipoRendicion: "Devolucion",
      tipoDocumento: "Factura",
      montoNeto: 37815,
      iva: 7185,
      monto: 45000,
    };
    expect(rowToGasto(gastoToRow(factura))).toEqual(factura);
  });

  it("filas históricas sin las columnas nuevas defaultean a Rendicion/Otro/0", () => {
    const row = gastoToRow(gasto).slice(0, 17); // fila vieja: hasta usuario_area
    const parsed = rowToGasto(row);
    expect(parsed.tipoRendicion).toBe("Rendicion");
    expect(parsed.tipoDocumento).toBe("Otro");
    expect(parsed.montoNeto).toBe(0);
    expect(parsed.iva).toBe(0);
  });
```

En `src/lib/sheets.test.ts`, dentro del `describe("usuarioRowToUsuario", ...)`, agrega:

```ts
  it("mapea banco y cuenta corriente", () => {
    const u = usuarioRowToUsuario([
      "maravena@bosca.cl", "M. Aravena", "Usuario", "TRUE",
      "2026-06-01T00:00:00Z", "76.543.219-7", "Operaciones",
      "Banco Santander", "66788482",
    ]);
    expect(u.banco).toBe("Banco Santander");
    expect(u.cuentaCorriente).toBe("66788482");
  });

  it("usuario sin columnas de banco deja banco/cuenta en vacío", () => {
    const u = usuarioRowToUsuario(["x@bosca.cl", "X", "Usuario", "TRUE", ""]);
    expect(u.banco).toBe("");
    expect(u.cuentaCorriente).toBe("");
  });
```

Crea/extiende `src/lib/gasto-factory.test.ts` con (si el archivo no existe, créalo con el import y un `describe`):

```ts
import { describe, it, expect } from "vitest";
import { crearGasto } from "./gasto-factory";
import { IMPUTACION_VACIA } from "./types";

describe("crearGasto", () => {
  const base = {
    usuarioEmail: "a@bosca.cl",
    usuarioNombre: "A",
    fechaDocumento: "2026-06-10",
    comercio: "Copec",
    categoria: "Combustible" as const,
    monto: 45000,
    imputacion: IMPUTACION_VACIA,
    tipoRendicion: "Rendicion" as const,
    tipoDocumento: "Boleta" as const,
  };

  it("usa neto/iva 0 por defecto", () => {
    const g = crearGasto(base);
    expect(g.montoNeto).toBe(0);
    expect(g.iva).toBe(0);
    expect(g.tipoRendicion).toBe("Rendicion");
  });

  it("propaga neto/iva cuando se entregan", () => {
    const g = crearGasto({ ...base, tipoDocumento: "Factura", montoNeto: 37815, iva: 7185 });
    expect(g.montoNeto).toBe(37815);
    expect(g.iva).toBe(7185);
  });
});
```

- [ ] **Step 8: Correr toda la suite y verificar verde**

Run: `npm test`
Expected: PASS (incluye los tests nuevos y los existentes actualizados).

- [ ] **Step 9: Commit**

```bash
git add src/lib/types.ts src/lib/sheets.ts src/lib/gasto-factory.ts src/lib/sheets.test.ts src/lib/gasto-factory.test.ts src/lib/auth.test.ts src/lib/auth-server.test.ts src/lib/perfil.test.ts
git commit -m "feat(datos): tipo rendicion/documento, neto/IVA y cuenta corriente en modelo y Sheets"
```

---

### Task 2: Cálculo Neto/IVA (`montos.ts`)

Módulo puro que decide neto e IVA según tipo de documento.

**Files:**
- Create: `src/lib/montos.ts`
- Test: `src/lib/montos.test.ts`

**Interfaces:**
- Consumes: `TipoDocumento` de `./types`.
- Produces: `calcularNetoIva(total: number, tipoDocumento: TipoDocumento, leido: { neto: number | null; iva: number | null }): { neto: number; iva: number }`

- [ ] **Step 1: Escribir el test que falla**

Crea `src/lib/montos.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calcularNetoIva } from "./montos";

describe("calcularNetoIva", () => {
  it("respeta neto e IVA cuando vienen del documento", () => {
    expect(calcularNetoIva(45000, "Factura", { neto: 37800, iva: 7200 })).toEqual({
      neto: 37800,
      iva: 7200,
    });
  });

  it("Factura sin desglose: calcula neto = round(total/1.19) e iva = total - neto", () => {
    const r = calcularNetoIva(45000, "Factura", { neto: null, iva: null });
    expect(r.neto).toBe(37815); // round(45000/1.19) = 37815
    expect(r.iva).toBe(7185); // 45000 - 37815
    expect(r.neto + r.iva).toBe(45000);
  });

  it("Boleta sin desglose: neto e iva quedan en 0", () => {
    expect(calcularNetoIva(10000, "Boleta", { neto: null, iva: null })).toEqual({
      neto: 0,
      iva: 0,
    });
  });

  it("Boleta con IVA leído lo respeta", () => {
    expect(calcularNetoIva(11900, "Boleta", { neto: 10000, iva: 1900 })).toEqual({
      neto: 10000,
      iva: 1900,
    });
  });

  it("Otro sin desglose: 0/0", () => {
    expect(calcularNetoIva(5000, "Otro", { neto: null, iva: null })).toEqual({
      neto: 0,
      iva: 0,
    });
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/montos.test.ts`
Expected: FAIL con "Cannot find module './montos'" o "calcularNetoIva is not a function".

- [ ] **Step 3: Implementar `src/lib/montos.ts`**

```ts
import type { TipoDocumento } from "./types";

const TASA_IVA = 0.19;

/**
 * Decide el desglose Neto/IVA de un gasto.
 * - Si vienen neto e iva del documento, se respetan.
 * - Factura sin desglose: neto = round(total/1.19), iva = total - neto.
 * - Boleta / Otro sin desglose: 0 / 0.
 */
export function calcularNetoIva(
  total: number,
  tipoDocumento: TipoDocumento,
  leido: { neto: number | null; iva: number | null },
): { neto: number; iva: number } {
  if (leido.neto !== null && leido.iva !== null) {
    return { neto: leido.neto, iva: leido.iva };
  }
  if (tipoDocumento === "Factura") {
    const neto = Math.round(total / (1 + TASA_IVA));
    return { neto, iva: total - neto };
  }
  return { neto: 0, iva: 0 };
}
```

- [ ] **Step 4: Correr el test y verificar verde**

Run: `npx vitest run src/lib/montos.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/montos.ts src/lib/montos.test.ts
git commit -m "feat(montos): calculo de Neto/IVA por tipo de documento"
```

---

### Task 3: Extracción de tipo de documento y Neto/IVA desde la foto

**Files:**
- Modify: `src/lib/extraccion.ts`
- Modify: `src/lib/claude.ts`
- Modify: `src/app/page.tsx` (constante `EXTRACCION_VACIA`)
- Test: `src/lib/extraccion.test.ts`

**Interfaces:**
- Produces:
  - `ExtraccionGasto` con `tipoDocumento: TipoDocumento | null`, `montoNeto: number | null`, `iva: number | null`
  - `normalizarTipoDocumento(valor: string | null): TipoDocumento | null`

- [ ] **Step 1: Escribir el test que falla (normalización)**

En `src/lib/extraccion.test.ts`, agrega:

```ts
import { normalizarTipoDocumento } from "./extraccion";

describe("normalizarTipoDocumento", () => {
  it("reconoce boleta y factura en cualquier caja", () => {
    expect(normalizarTipoDocumento("BOLETA")).toBe("Boleta");
    expect(normalizarTipoDocumento("factura")).toBe("Factura");
    expect(normalizarTipoDocumento("Boleta electrónica")).toBe("Boleta");
  });

  it("devuelve null cuando no reconoce", () => {
    expect(normalizarTipoDocumento(null)).toBe(null);
    expect(normalizarTipoDocumento("vale vista")).toBe(null);
  });
});
```

(Si `src/lib/extraccion.test.ts` no existe, créalo con `import { describe, it, expect } from "vitest";` arriba.)

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/extraccion.test.ts`
Expected: FAIL ("normalizarTipoDocumento is not a function").

- [ ] **Step 3: Extender `ExtraccionGasto` y agregar `normalizarTipoDocumento` en `src/lib/extraccion.ts`**

Cambia el import del tope:

```ts
import type { Categoria, TipoDocumento } from "./types";
import { CATEGORIAS } from "./types";
```

En `interface ExtraccionGasto`, después de `direccion: string | null;` agrega:

```ts
  tipoDocumento: TipoDocumento | null;
  montoNeto: number | null; // entero CLP
  iva: number | null; // entero CLP
```

Agrega la función de normalización después de `normalizarCategoria`:

```ts
/** Convierte texto libre a un TipoDocumento válido, o null. */
export function normalizarTipoDocumento(valor: string | null): TipoDocumento | null {
  if (!valor) return null;
  const limpio = valor.trim().toLowerCase();
  if (limpio.includes("boleta")) return "Boleta";
  if (limpio.includes("factura")) return "Factura";
  return null;
}
```

(Nota: `camposFaltantes`/`ESENCIALES` NO cambian; tipoDocumento/neto/iva no son esenciales para avanzar el chat. `fusionarExtraccion` ya itera todas las claves, así que cubre los campos nuevos.)

- [ ] **Step 4: Actualizar `src/lib/claude.ts` (schema, prompt y parseo)**

Cambia el import:

```ts
import { normalizarCategoria, normalizarTipoDocumento, type ExtraccionGasto } from "./extraccion";
```

En `SYSTEM_EXTRACCION`, agrega estas reglas antes de la última línea:

```
- "tipoDocumento" debe ser "Boleta" o "Factura" según el documento; null si no se distingue.
- "monto" es el TOTAL a pagar (con IVA incluido).
- "montoNeto" e "iva" son enteros CLP si aparecen desglosados en el documento; si no aparecen, null.
```

En `SCHEMA.properties`, agrega:

```ts
    tipoDocumento: { type: ["string", "null"] },
    montoNeto: { type: ["integer", "null"] },
    iva: { type: ["integer", "null"] },
```

En `SCHEMA.required`, agrega `"tipoDocumento"`, `"montoNeto"`, `"iva"`.

En `parseExtraccion`, en el objeto retornado, después de `direccion: datos.direccion ?? null,` agrega:

```ts
    tipoDocumento: normalizarTipoDocumento(datos.tipoDocumento ?? null),
    montoNeto: aMontoEntero(datos.montoNeto),
    iva: aMontoEntero(datos.iva),
```

- [ ] **Step 5: Actualizar `EXTRACCION_VACIA` en `src/app/page.tsx`**

En la constante `EXTRACCION_VACIA`, después de `direccion: null,` agrega:

```ts
  tipoDocumento: null,
  montoNeto: null,
  iva: null,
```

- [ ] **Step 6: Correr la suite completa y `tsc`**

Run: `npm test`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: sin errores (verifica que `EXTRACCION_VACIA` cumple `ExtraccionGasto`).

- [ ] **Step 7: Commit**

```bash
git add src/lib/extraccion.ts src/lib/extraccion.test.ts src/lib/claude.ts src/app/page.tsx
git commit -m "feat(extraccion): leer tipo de documento, neto e IVA desde texto/imagen"
```

---

### Task 4: Cuenta corriente en perfil (API + Onboarding)

**Files:**
- Modify: `src/app/api/perfil/route.ts`
- Modify: `src/lib/api-client.ts` (`Perfil`, `guardarPerfil`)
- Modify: `src/components/chat/Onboarding.tsx`

**Interfaces:**
- Consumes: `actualizarPerfilUsuario(email, { nombre, rut, area, banco?, cuentaCorriente? })` (Task 1).
- Produces:
  - `Perfil` con `banco: string`, `cuentaCorriente: string`
  - `guardarPerfil({ nombre, rut, area, banco?, cuentaCorriente? })`
  - `GET /api/perfil` devuelve `banco`, `cuentaCorriente`
  - `POST /api/perfil` acepta `banco`, `cuentaCorriente`

- [ ] **Step 1: Extender `GET`/`POST` en `src/app/api/perfil/route.ts`**

En el `GET`, en el objeto JSON de respuesta, después de `area: usuario.area,` agrega:

```ts
      banco: usuario.banco,
      cuentaCorriente: usuario.cuentaCorriente,
```

En el `POST`, amplía el tipo del body:

```ts
  let body: { nombre?: string; rut?: string; area?: string; banco?: string; cuentaCorriente?: string };
```

Y en la llamada a `actualizarPerfilUsuario`, pásale los campos nuevos (saneados a string):

```ts
    await actualizarPerfilUsuario(auth.usuario.email, {
      nombre: body.nombre.trim(),
      rut: formatRut(body.rut),
      area: body.area,
      banco: typeof body.banco === "string" ? body.banco.trim() : undefined,
      cuentaCorriente: typeof body.cuentaCorriente === "string" ? body.cuentaCorriente.trim() : undefined,
    });
```

(No se valida banco/cuenta aquí: son opcionales en el alta. La exigencia para devoluciones se valida en `/api/gastos`, Task 5.)

- [ ] **Step 2: Extender `Perfil` y `guardarPerfil` en `src/lib/api-client.ts`**

En `interface Perfil`, después de `area: string;` agrega:

```ts
  banco: string;
  cuentaCorriente: string;
```

Cambia la firma de `guardarPerfil`:

```ts
export function guardarPerfil(perfil: {
  nombre: string;
  rut: string;
  area: string;
  banco?: string;
  cuentaCorriente?: string;
}): Promise<{ ok: boolean }> {
  return pedir<{ ok: boolean }>("/api/perfil", {
    method: "POST",
    body: JSON.stringify(perfil),
  });
}
```

- [ ] **Step 3: Agregar campos opcionales de banco al `Onboarding`**

En `src/components/chat/Onboarding.tsx`, agrega estado:

```ts
  const [banco, setBanco] = useState("");
  const [cuentaCorriente, setCuentaCorriente] = useState("");
```

En la llamada `guardarPerfil({ ... })` dentro de `enviar`, pasa los campos:

```ts
      await guardarPerfil({
        nombre: nombre.trim(),
        rut,
        area,
        banco: banco.trim() || undefined,
        cuentaCorriente: cuentaCorriente.trim() || undefined,
      });
```

Después del `<label>` del área (antes del cierre del `div` de campos), agrega dos campos opcionales:

```tsx
          <label className="text-xs text-gray-500">
            Banco (opcional, para devoluciones)
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              placeholder="Banco Santander"
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-500">
            N° cuenta corriente (opcional)
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              placeholder="66788482"
              value={cuentaCorriente}
              onChange={(e) => setCuentaCorriente(e.target.value)}
            />
          </label>
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sin errores.

Run: `npm test`
Expected: PASS (las firmas cambiadas no rompen tests; si algún test mockea `obtenerPerfil`/`Perfil`, agrega `banco: ""`, `cuentaCorriente: ""` al mock).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/perfil/route.ts src/lib/api-client.ts src/components/chat/Onboarding.tsx
git commit -m "feat(perfil): banco y cuenta corriente en perfil y onboarding"
```

---

### Task 5: Tarjeta de confirmación + validación en `/api/gastos`

**Files:**
- Modify: `src/lib/api-client.ts` (`GuardarGastoInput`)
- Modify: `src/components/chat/TarjetaConfirmacion.tsx`
- Modify: `src/app/page.tsx` (pasar datos de cuenta corriente del perfil a la tarjeta)
- Modify: `src/app/api/gastos/route.ts`

**Interfaces:**
- Consumes: `calcularNetoIva` (Task 2), `Perfil.banco/cuentaCorriente` (Task 4), `crearGasto` con campos nuevos (Task 1).
- Produces: `GuardarGastoInput` con `tipoRendicion`, `tipoDocumento`, `montoNeto`, `iva`, `banco?`, `cuentaCorriente?`.

- [ ] **Step 1: Extender `GuardarGastoInput` en `src/lib/api-client.ts`**

En `interface GuardarGastoInput`, después de `ubicacionCodigo: string;` agrega:

```ts
  tipoRendicion: import("./types").TipoRendicion;
  tipoDocumento: import("./types").TipoDocumento;
  montoNeto: number;
  iva: number;
  banco?: string; // solo cuando se completa inline en una devolución
  cuentaCorriente?: string;
```

(O agrega `TipoRendicion, TipoDocumento` al import de `./types` del tope del archivo y úsalos sin `import(...)`.)

- [ ] **Step 2: Agregar controles a `TarjetaConfirmacion.tsx`**

Cambia el import de tipos:

```ts
import { CATEGORIAS, TIPOS_DOCUMENTO, type Categoria, type TipoRendicion, type TipoDocumento } from "@/lib/types";
```

Agrega una prop para la cuenta corriente actual del perfil:

```ts
export function TarjetaConfirmacion({
  borrador,
  imagenUrl,
  imagenDriveId,
  catalogo,
  cuentaActual,
  onConfirmar,
  onCancelar,
  deshabilitado,
}: {
  borrador: ExtraccionGasto;
  imagenUrl?: string;
  imagenDriveId?: string;
  catalogo: CentroCostoEntry[];
  cuentaActual: { banco: string; cuentaCorriente: string };
  onConfirmar: (datos: GuardarGastoInput) => void;
  onCancelar: () => void;
  deshabilitado: boolean;
}) {
```

Agrega estado (junto a los `useState` existentes):

```ts
  const [tipoRendicion, setTipoRendicion] = useState<TipoRendicion>("Rendicion");
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>(
    borrador.tipoDocumento ?? "Boleta",
  );
  const [netoTexto, setNetoTexto] = useState(
    borrador.montoNeto !== null ? String(borrador.montoNeto) : "",
  );
  const [ivaTexto, setIvaTexto] = useState(
    borrador.iva !== null ? String(borrador.iva) : "",
  );
  const [banco, setBanco] = useState(cuentaActual.banco);
  const [cuentaCorriente, setCuentaCorriente] = useState(cuentaActual.cuentaCorriente);
```

Importa el cálculo y derivados:

```ts
import { calcularNetoIva } from "@/lib/montos";
```

Agrega un efecto que recalcula neto/IVA al cambiar total o tipo de documento (sin pisar ediciones manuales que dejen valores no vacíos — para simplicidad, recalcula siempre que cambie tipo o total):

```ts
  const neto = parseCLP(netoTexto) ?? 0;
  const iva = parseCLP(ivaTexto) ?? 0;

  useEffect(() => {
    if (monto === null) return;
    const r = calcularNetoIva(monto, tipoDocumento, {
      neto: parseCLP(netoTexto),
      iva: parseCLP(ivaTexto),
    });
    // Solo autocompleta cuando los campos están vacíos o el tipo es Factura.
    if (tipoDocumento === "Factura" && netoTexto === "" && ivaTexto === "") {
      setNetoTexto(String(r.neto));
      setIvaTexto(String(r.iva));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoDocumento, montoTexto]);
```

(Asegúrate de importar `useEffect` desde `react`.)

Calcula si falta cuenta corriente para devolución y ajusta `completo`:

```ts
  const requiereCuenta = tipoRendicion === "Devolucion";
  const cuentaCompleta = banco.trim() !== "" && cuentaCorriente.trim() !== "";
  const completo =
    comercio.trim() !== "" && monto !== null && monto > 0 && fecha !== "" &&
    categoria !== "" && cc !== "" && area !== "" && ubicacion !== "" &&
    (!requiereCuenta || cuentaCompleta);
```

En `confirmar()`, agrega los campos nuevos al objeto pasado a `onConfirmar`:

```ts
      tipoRendicion,
      tipoDocumento,
      montoNeto: neto,
      iva,
      ...(requiereCuenta && (banco !== cuentaActual.banco || cuentaCorriente !== cuentaActual.cuentaCorriente)
        ? { banco: banco.trim(), cuentaCorriente: cuentaCorriente.trim() }
        : {}),
```

En el JSX, **arriba del campo Comercio**, agrega el selector de tipo de rendición:

```tsx
        <label className="text-xs text-gray-500">
          Tipo
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={tipoRendicion}
            onChange={(e) => setTipoRendicion(e.target.value as TipoRendicion)}
          >
            <option value="Rendicion">Rendición (solo justificar)</option>
            <option value="Devolucion">Devolución (me reembolsan)</option>
          </select>
        </label>
```

Después del campo Categoría, agrega tipo de documento + neto + IVA:

```tsx
        <label className="text-xs text-gray-500">
          Tipo de documento
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}
          >
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <label className="flex-1 text-xs text-gray-500">
            Neto
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              inputMode="numeric"
              value={netoTexto}
              onChange={(e) => setNetoTexto(e.target.value)}
            />
          </label>
          <label className="flex-1 text-xs text-gray-500">
            IVA
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              inputMode="numeric"
              value={ivaTexto}
              onChange={(e) => setIvaTexto(e.target.value)}
            />
          </label>
        </div>
```

Y al final de los campos (antes del bloque de botones), agrega los campos de cuenta corriente solo cuando es devolución:

```tsx
        {requiereCuenta && (
          <div className="rounded-lg border border-bosca-ambar/50 bg-bosca-ambar/5 p-3">
            <p className="mb-2 text-xs font-medium text-bosca-carbon">
              Datos para la devolución
            </p>
            <label className="text-xs text-gray-500">
              Banco
              <input
                className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
                placeholder="Banco Santander"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
              />
            </label>
            <label className="mt-2 block text-xs text-gray-500">
              N° cuenta corriente
              <input
                className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
                placeholder="66788482"
                value={cuentaCorriente}
                onChange={(e) => setCuentaCorriente(e.target.value)}
              />
            </label>
            {!cuentaCompleta && (
              <p className="mt-1 text-xs text-bosca-burdeo">
                Completa banco y cuenta para registrar la devolución.
              </p>
            )}
          </div>
        )}
```

- [ ] **Step 3: Pasar `cuentaActual` desde `src/app/page.tsx`**

En el render de `<TarjetaConfirmacion ... />`, agrega la prop:

```tsx
                cuentaActual={{ banco: perfil.banco, cuentaCorriente: perfil.cuentaCorriente }}
```

(`perfil` ya está disponible en el componente `Chat`.)

- [ ] **Step 4: Validar y recalcular en `src/app/api/gastos/route.ts`**

Amplía el tipo `body` del `POST` con:

```ts
    tipoRendicion?: string;
    tipoDocumento?: string;
    montoNeto?: number;
    iva?: number;
    banco?: string;
    cuentaCorriente?: string;
```

Agrega imports:

```ts
import { calcularNetoIva } from "@/lib/montos";
import { getUsuario } from "@/lib/sheets";
import type { TipoRendicion, TipoDocumento } from "@/lib/types";
```

Después de validar la imputación (justo antes de `const gasto = crearGasto({...})`), agrega:

```ts
  const tipoRendicion: TipoRendicion =
    body.tipoRendicion === "Devolucion" ? "Devolucion" : "Rendicion";
  const tipoDocumento: TipoDocumento =
    body.tipoDocumento === "Boleta" || body.tipoDocumento === "Factura"
      ? body.tipoDocumento
      : "Otro";

  // Devolución: exige cuenta corriente en el perfil; si viene en el payload, la persiste.
  if (tipoRendicion === "Devolucion") {
    let usuario;
    try {
      usuario = await getUsuario(auth.usuario.email);
    } catch {
      return NextResponse.json({ error: "No se pudo validar la cuenta corriente" }, { status: 502 });
    }
    const bancoNuevo = typeof body.banco === "string" ? body.banco.trim() : "";
    const cuentaNueva = typeof body.cuentaCorriente === "string" ? body.cuentaCorriente.trim() : "";
    const tienePerfil = !!usuario && usuario.banco.trim() !== "" && usuario.cuentaCorriente.trim() !== "";
    const vieneEnPayload = bancoNuevo !== "" && cuentaNueva !== "";
    if (!tienePerfil && !vieneEnPayload) {
      return NextResponse.json(
        { error: "Una devolución requiere banco y cuenta corriente" },
        { status: 400 },
      );
    }
    if (vieneEnPayload && usuario) {
      try {
        await actualizarPerfilUsuario(auth.usuario.email, {
          nombre: usuario.nombre,
          rut: usuario.rut,
          area: usuario.area,
          banco: bancoNuevo,
          cuentaCorriente: cuentaNueva,
        });
      } catch {
        return NextResponse.json({ error: "No se pudo guardar la cuenta corriente" }, { status: 502 });
      }
    }
  }

  const { neto, iva } = calcularNetoIva(body.monto, tipoDocumento, {
    neto: typeof body.montoNeto === "number" ? body.montoNeto : null,
    iva: typeof body.iva === "number" ? body.iva : null,
  });
```

Agrega `actualizarPerfilUsuario` al import existente de `@/lib/sheets`.

En la llamada a `crearGasto({...})`, agrega:

```ts
    tipoRendicion,
    tipoDocumento,
    montoNeto: neto,
    iva,
```

- [ ] **Step 5: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-client.ts src/components/chat/TarjetaConfirmacion.tsx src/app/page.tsx src/app/api/gastos/route.ts
git commit -m "feat(chat): clasificar rendicion/devolucion, tipo doc y neto/IVA en la confirmacion"
```

---

### Task 6: Dashboard con rango desde/hasta y resumen por tipo

**Files:**
- Modify: `src/lib/dashboard.ts`
- Test: `src/lib/dashboard.test.ts`
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- Produces:
  - `filtrarPorRango(gastos: Gasto[], desde: string, hasta: string): Gasto[]` (inclusivo, sobre `fechaDocumento`)
  - `porTipoRendicion(gastos: Gasto[]): { rendicion: number; devolucion: number }`

- [ ] **Step 1: Escribir tests que fallan en `src/lib/dashboard.test.ts`**

Agrega (usa el patrón de construcción de `Gasto` ya presente en ese archivo; si no hay helper, crea objetos mínimos con los campos usados):

```ts
import { filtrarPorRango, porTipoRendicion } from "./dashboard";

function g(fechaDocumento: string, monto: number, tipoRendicion: "Rendicion" | "Devolucion"): Gasto {
  return {
    id: "x", fechaRegistro: "", usuarioEmail: "", usuarioNombre: "",
    fechaDocumento, comercio: "", rutEmisor: "", numeroDocumento: "",
    categoria: "Otros", monto, direccion: "", observacion: "",
    imagenUrl: "", imagenDriveId: "", estado: "Registrado", fechaCreacion: "",
    usuarioArea: "", imputacion: {
      centroCostoCodigo: "", centroCostoDetalle: "", areaCodigo: "",
      areaDetalle: "", ubicacionCodigo: "", ubicacionDetalle: "",
    },
    tipoRendicion, tipoDocumento: "Boleta", montoNeto: 0, iva: 0,
  };
}

describe("filtrarPorRango", () => {
  const gastos = [g("2026-06-01", 100, "Rendicion"), g("2026-06-15", 200, "Devolucion"), g("2026-07-01", 300, "Rendicion")];

  it("incluye ambos extremos del rango", () => {
    const r = filtrarPorRango(gastos, "2026-06-01", "2026-06-15");
    expect(r.map((x) => x.monto)).toEqual([100, 200]);
  });

  it("excluye fechas fuera del rango", () => {
    expect(filtrarPorRango(gastos, "2026-06-16", "2026-06-30")).toEqual([]);
  });
});

describe("porTipoRendicion", () => {
  it("suma montos por tipo", () => {
    const gastos = [g("2026-06-01", 100, "Rendicion"), g("2026-06-02", 200, "Devolucion"), g("2026-06-03", 50, "Devolucion")];
    expect(porTipoRendicion(gastos)).toEqual({ rendicion: 100, devolucion: 250 });
  });
});
```

(Asegúrate de tener `import type { Gasto } from "./types";` y `import { describe, it, expect } from "vitest";` en el archivo.)

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/dashboard.test.ts`
Expected: FAIL ("filtrarPorRango is not a function").

- [ ] **Step 3: Implementar en `src/lib/dashboard.ts`**

Agrega:

```ts
/** Filtra los gastos cuya fechaDocumento cae en [desde, hasta] inclusivo (YYYY-MM-DD). */
export function filtrarPorRango(gastos: Gasto[], desde: string, hasta: string): Gasto[] {
  return gastos.filter((g) => g.fechaDocumento >= desde && g.fechaDocumento <= hasta);
}

/** Suma de montos separada por tipo de rendición. */
export function porTipoRendicion(gastos: Gasto[]): { rendicion: number; devolucion: number } {
  return gastos.reduce(
    (acc, g) => {
      if (g.tipoRendicion === "Devolucion") acc.devolucion += g.monto;
      else acc.rendicion += g.monto;
      return acc;
    },
    { rendicion: 0, devolucion: 0 },
  );
}
```

- [ ] **Step 4: Correr y verificar verde**

Run: `npx vitest run src/lib/dashboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Reemplazar el selector de mes por rango en `src/app/dashboard/page.tsx`**

Agrega imports:

```ts
import { filtrarPorRango, porTipoRendicion } from "@/lib/dashboard";
```

Reemplaza el estado `mesElegido` por un rango. Después de `const [error, setError] = useState<string | null>(null);` agrega:

```ts
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
```

Tras cargar los gastos, inicializa el rango al primer/último `fechaDocumento` disponible. Reemplaza el bloque `const meses = ...; const mesActivo = ...; const delMes = ...;` por:

```ts
  const fechas = useMemo(
    () => gastos.map((g) => g.fechaDocumento).filter(Boolean).sort(),
    [gastos],
  );
  const desdeActivo = desde || fechas[0] || "";
  const hastaActivo = hasta || fechas[fechas.length - 1] || "";
  const delRango = useMemo(
    () => (desdeActivo && hastaActivo ? filtrarPorRango(gastos, desdeActivo, hastaActivo) : []),
    [gastos, desdeActivo, hastaActivo],
  );
```

Reemplaza el `<select>` de período por dos inputs de fecha:

```tsx
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm text-gray-500">Desde:</label>
              <input
                type="date"
                className="rounded-lg border border-bosca-gris px-3 py-1 text-sm text-gray-900"
                value={desdeActivo}
                onChange={(e) => setDesde(e.target.value)}
              />
              <label className="text-sm text-gray-500">Hasta:</label>
              <input
                type="date"
                className="rounded-lg border border-bosca-gris px-3 py-1 text-sm text-gray-900"
                value={hastaActivo}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
```

Cambia todas las referencias `delMes` por `delRango` y la condición `meses.length === 0` por `fechas.length === 0`.

Después de la tarjeta "Total del período", agrega la tarjeta de tipo:

```tsx
            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Rendiciones vs Devoluciones</h2>
              {(() => {
                const t = porTipoRendicion(delRango);
                return (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Rendición (justificado)</p>
                      <p className="text-xl font-bold text-gray-900">{formatCLP(t.rendicion)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Devolución (a reembolsar)</p>
                      <p className="text-xl font-bold text-bosca-ambar">{formatCLP(t.devolucion)}</p>
                    </div>
                  </div>
                );
              })()}
            </section>
```

- [ ] **Step 6: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores (elimina el import de `mesesDisponibles`/`filtrarPorMes` si quedó sin uso).
Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dashboard.ts src/lib/dashboard.test.ts src/app/dashboard/page.tsx
git commit -m "feat(dashboard): rango desde/hasta y resumen rendicion vs devolucion"
```

---

### Task 7: Reporte PDF (modelo, documento y descarga)

**Files:**
- Modify: `package.json` (dependencia `@react-pdf/renderer`)
- Create: `src/lib/reporte.ts`
- Test: `src/lib/reporte.test.ts`
- Create: `src/lib/reporte-pdf.tsx`
- Create: `src/app/api/reporte/route.ts`
- Modify: `src/app/dashboard/page.tsx` (botón de descarga)

**Interfaces:**
- Consumes: `Gasto`, `Usuario`, `filtrarPorRango` (Task 6), `formatCLP` (`src/lib/format.ts`).
- Produces:
  - `construirReporte(usuario, gastos, { desde, hasta, fechaRendicion }): ModeloReporte`
  - `interface ModeloReporte { cabecera; filas; totales }`
  - `GET /api/reporte?desde=&hasta=` → `application/pdf` (attachment)

- [ ] **Step 1: Instalar la dependencia**

Run: `npm install @react-pdf/renderer`
Expected: se agrega a `package.json` y `package-lock.json`.

- [ ] **Step 2: Escribir el test que falla en `src/lib/reporte.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { construirReporte } from "./reporte";
import type { Gasto, Usuario } from "./types";

const usuario: Usuario = {
  email: "maravena@bosca.cl", nombre: "M. Aravena", rol: "Usuario", activo: true,
  fechaAlta: "", rut: "76.543.219-7", area: "Operaciones",
  banco: "Banco Santander", cuentaCorriente: "66788482",
};

function g(partial: Partial<Gasto>): Gasto {
  return {
    id: "x", fechaRegistro: "", usuarioEmail: usuario.email, usuarioNombre: usuario.nombre,
    fechaDocumento: "2026-06-15", comercio: "Shell", rutEmisor: "", numeroDocumento: "123",
    categoria: "Combustible", monto: 10000, direccion: "", observacion: "Bencina",
    imagenUrl: "", imagenDriveId: "", estado: "Registrado", fechaCreacion: "",
    usuarioArea: "Operaciones", imputacion: {
      centroCostoCodigo: "C500", centroCostoDetalle: "", areaCodigo: "A5020",
      areaDetalle: "", ubicacionCodigo: "T9510", ubicacionDetalle: "",
    },
    tipoRendicion: "Rendicion", tipoDocumento: "Boleta", montoNeto: 0, iva: 0,
    ...partial,
  };
}

describe("construirReporte", () => {
  const gastos = [
    g({ monto: 10000, tipoRendicion: "Rendicion", montoNeto: 0, iva: 0 }),
    g({ monto: 49266, tipoRendicion: "Devolucion", tipoDocumento: "Factura", montoNeto: 41400, iva: 7866 }),
  ];
  const r = construirReporte(usuario, gastos, {
    desde: "2026-06-01", hasta: "2026-06-30", fechaRendicion: "2026-06-17",
  });

  it("arma la cabecera con datos del usuario", () => {
    expect(r.cabecera.nombre).toBe("M. Aravena");
    expect(r.cabecera.rut).toBe("76.543.219-7");
    expect(r.cabecera.banco).toBe("Banco Santander");
    expect(r.cabecera.cuentaCorriente).toBe("66788482");
    expect(r.cabecera.correo).toBe("maravena@bosca.cl");
    expect(r.cabecera.fechaRendicion).toBe("2026-06-17");
  });

  it("crea una fila por gasto con descripción = observación", () => {
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0].descripcion).toBe("Bencina");
  });

  it("calcula totales y subtotales por tipo", () => {
    expect(r.totales.total).toBe(59266);
    expect(r.totales.neto).toBe(41400);
    expect(r.totales.iva).toBe(7866);
    expect(r.totales.rendicion).toBe(10000);
    expect(r.totales.devolucion).toBe(49266);
  });
});
```

- [ ] **Step 3: Correr y verificar que falla**

Run: `npx vitest run src/lib/reporte.test.ts`
Expected: FAIL ("Cannot find module './reporte'").

- [ ] **Step 4: Implementar `src/lib/reporte.ts`**

```ts
import type { Gasto, Usuario } from "./types";
import { porTipoRendicion } from "./dashboard";

export interface CabeceraReporte {
  nombre: string;
  rut: string;
  banco: string;
  cuentaCorriente: string;
  correo: string;
  fechaRendicion: string; // YYYY-MM-DD
  desde: string;
  hasta: string;
}

export interface FilaReporte {
  fechaCompra: string;
  proveedor: string;
  centroCosto: string;
  area: string;
  ubicacion: string;
  tipoDocumento: string;
  numeroDocumento: string;
  descripcion: string;
  neto: number;
  iva: number;
  total: number;
  tipoRendicion: string;
}

export interface TotalesReporte {
  neto: number;
  iva: number;
  total: number;
  rendicion: number;
  devolucion: number;
}

export interface ModeloReporte {
  cabecera: CabeceraReporte;
  filas: FilaReporte[];
  totales: TotalesReporte;
}

/** Arma el modelo del reporte a partir del usuario, sus gastos y el rango. */
export function construirReporte(
  usuario: Usuario,
  gastos: Gasto[],
  opts: { desde: string; hasta: string; fechaRendicion: string },
): ModeloReporte {
  const filas: FilaReporte[] = gastos.map((g) => ({
    fechaCompra: g.fechaDocumento,
    proveedor: g.comercio,
    centroCosto: g.imputacion.centroCostoCodigo,
    area: g.imputacion.areaCodigo,
    ubicacion: g.imputacion.ubicacionCodigo,
    tipoDocumento: g.tipoDocumento,
    numeroDocumento: g.numeroDocumento,
    descripcion: g.observacion,
    neto: g.montoNeto,
    iva: g.iva,
    total: g.monto,
    tipoRendicion: g.tipoRendicion,
  }));

  const tipos = porTipoRendicion(gastos);
  const totales: TotalesReporte = {
    neto: gastos.reduce((a, g) => a + g.montoNeto, 0),
    iva: gastos.reduce((a, g) => a + g.iva, 0),
    total: gastos.reduce((a, g) => a + g.monto, 0),
    rendicion: tipos.rendicion,
    devolucion: tipos.devolucion,
  };

  return {
    cabecera: {
      nombre: usuario.nombre,
      rut: usuario.rut,
      banco: usuario.banco,
      cuentaCorriente: usuario.cuentaCorriente,
      correo: usuario.email,
      fechaRendicion: opts.fechaRendicion,
      desde: opts.desde,
      hasta: opts.hasta,
    },
    filas,
    totales,
  };
}
```

- [ ] **Step 5: Correr y verificar verde**

Run: `npx vitest run src/lib/reporte.test.ts`
Expected: PASS.

- [ ] **Step 6: Implementar el documento PDF `src/lib/reporte-pdf.tsx`**

```tsx
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import type { ModeloReporte } from "./reporte";
import { formatCLP } from "./format";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica" },
  titulo: { fontSize: 13, fontWeight: "bold", marginBottom: 8 },
  cab: { marginBottom: 10 },
  cabLinea: { flexDirection: "row", marginBottom: 2 },
  cabEtq: { width: 90, fontWeight: "bold" },
  fila: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999" },
  filaCab: { flexDirection: "row", backgroundColor: "#eee", borderBottomWidth: 1, borderBottomColor: "#333" },
  celda: { padding: 3, borderRightWidth: 0.5, borderRightColor: "#ccc" },
  num: { textAlign: "right" },
});

// Anchos relativos (suman ~100) por columna.
const cols = [
  { k: "fechaCompra", t: "Fecha", w: 42 },
  { k: "proveedor", t: "Proveedor", w: 70 },
  { k: "centroCosto", t: "C.Costo", w: 38 },
  { k: "area", t: "Área", w: 38 },
  { k: "ubicacion", t: "Ubic.", w: 38 },
  { k: "tipoDocumento", t: "Tipo", w: 40 },
  { k: "numeroDocumento", t: "N° Doc", w: 45 },
  { k: "descripcion", t: "Descripción", w: 90 },
  { k: "neto", t: "Neto", w: 45, num: true },
  { k: "iva", t: "IVA", w: 40, num: true },
  { k: "total", t: "Total", w: 50, num: true },
  { k: "tipoRendicion", t: "Tipo rend.", w: 50 },
] as const;

export function ReporteDocument({ modelo }: { modelo: ModeloReporte }) {
  const { cabecera, filas, totales } = modelo;
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.titulo}>Rendición de Gastos</Text>
        <View style={styles.cab}>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>Rendición de:</Text><Text>{cabecera.nombre}</Text></View>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>RUT:</Text><Text>{cabecera.rut}</Text></View>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>Correo:</Text><Text>{cabecera.correo}</Text></View>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>C. Corriente:</Text><Text>{cabecera.cuentaCorriente} — {cabecera.banco}</Text></View>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>Período:</Text><Text>{cabecera.desde} a {cabecera.hasta}</Text></View>
          <View style={styles.cabLinea}><Text style={styles.cabEtq}>Fecha rendición:</Text><Text>{cabecera.fechaRendicion}</Text></View>
        </View>

        <View style={styles.filaCab}>
          {cols.map((c) => (
            <Text key={c.k} style={[styles.celda, { width: c.w }, c.num ? styles.num : {}]}>{c.t}</Text>
          ))}
        </View>
        {filas.map((f, i) => (
          <View key={i} style={styles.fila}>
            {cols.map((c) => {
              const raw = f[c.k as keyof typeof f];
              const val = c.num ? formatCLP(Number(raw)) : String(raw);
              return (
                <Text key={c.k} style={[styles.celda, { width: c.w }, c.num ? styles.num : {}]}>{val}</Text>
              );
            })}
          </View>
        ))}

        <View style={{ marginTop: 10 }}>
          <Text>Total Neto: {formatCLP(totales.neto)}    IVA: {formatCLP(totales.iva)}    Total: {formatCLP(totales.total)}</Text>
          <Text style={{ marginTop: 4 }}>Rendición (justificado): {formatCLP(totales.rendicion)}    Devolución (a reembolsar): {formatCLP(totales.devolucion)}</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 7: Crear la ruta `src/app/api/reporte/route.ts`**

```ts
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos, getUsuario } from "@/lib/sheets";
import { filtrarGastosPorRol } from "@/lib/gastos-rol";
import { filtrarPorRango } from "@/lib/dashboard";
import { construirReporte } from "@/lib/reporte";
import { ReporteDocument } from "@/lib/reporte-pdf";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  const url = new URL(req.url);
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hasta") ?? "";
  if (!desde || !hasta) {
    return NextResponse.json({ error: "Faltan los parámetros desde/hasta" }, { status: 400 });
  }

  try {
    const [todos, usuario] = await Promise.all([
      listGastos(),
      getUsuario(auth.usuario.email),
    ]);
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const visibles = filtrarGastosPorRol(todos, auth.usuario);
    const delRango = filtrarPorRango(visibles, desde, hasta);
    const hoy = new Date().toISOString().slice(0, 10);
    const modelo = construirReporte(usuario, delRango, { desde, hasta, fechaRendicion: hoy });

    const buffer = await renderToBuffer(<ReporteDocument modelo={modelo} />);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rendicion-${desde}_a_${hasta}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el reporte" }, { status: 502 });
  }
}
```

(El archivo usa JSX, por lo que debe ser `.tsx`. Renómbralo a `src/app/api/reporte/route.tsx` si Next lo requiere; en Next 16 las rutas `route` aceptan `.tsx`. Si el linter objeta, extrae el `renderToBuffer(<.../>)` está bien con extensión `.tsx`.)

- [ ] **Step 8: Agregar el botón de descarga en `src/app/dashboard/page.tsx`**

Agrega una función que pide el PDF autenticado y dispara la descarga. Dentro del componente `Dashboard`:

```ts
  const [descargando, setDescargando] = useState(false);

  async function descargarReporte() {
    setDescargando(true);
    try {
      const token = await getIdTokenActual();
      const res = await fetch(`/api/reporte?desde=${desdeActivo}&hasta=${hastaActivo}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Error al generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rendicion-${desdeActivo}_a_${hastaActivo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar el reporte PDF.");
    } finally {
      setDescargando(false);
    }
  }
```

Junto a los inputs de fecha (dentro del mismo `div` del rango), agrega el botón:

```tsx
              <button
                onClick={descargarReporte}
                disabled={descargando || delRango.length === 0}
                className="rounded-lg bg-bosca-burdeo px-3 py-1 text-sm font-medium text-white hover:bg-bosca-burdeo-h disabled:opacity-40"
              >
                {descargando ? "Generando…" : "Descargar PDF"}
              </button>
```

- [ ] **Step 9: Verificar tipos, tests y build de producción**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm test`
Expected: PASS.
Run: `npm run build`
Expected: build exitoso (verifica que `@react-pdf/renderer` compila en la ruta del servidor).

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/lib/reporte.ts src/lib/reporte.test.ts src/lib/reporte-pdf.tsx "src/app/api/reporte/route.tsx" src/app/dashboard/page.tsx
git commit -m "feat(reporte): PDF de rendicion por rango de fechas con descarga"
```

---

## Migración manual de Sheets (una vez, antes de probar en producción)

No es código, pero es **requisito de despliegue**: agregar los encabezados nuevos en la fila 1 de cada pestaña, en este orden exacto al final de las columnas existentes:

- Pestaña `Gastos`, columnas X–AA: `tipo_rendicion`, `tipo_documento`, `monto_neto`, `iva`.
- Pestaña `Usuarios`, columnas H–I: `banco`, `cuenta_corriente`.

Se puede hacer a mano o con un mini-script en `scripts/` análogo a `cargar-centros-costo.mjs` que escriba esos encabezados. Las filas históricas no requieren backfill: se leen con defaults.

---

## Self-Review (cobertura del spec)

- §Modelo de datos → Task 1. ✓
- §Google Sheets (migración aditiva) → Task 1 + sección de migración manual. ✓
- §Extracción + `montos.ts` → Tasks 2 y 3. ✓
- §Tarjeta de confirmación → Task 5. ✓
- §API (gastos, perfil) → Tasks 4 y 5. ✓
- §Dashboard rango + resumen → Task 6. ✓
- §Reporte PDF → Task 7. ✓
- §Tests (montos, reporte, dashboard, sheets, extracción) → distribuidos en Tasks 1,2,3,6,7. ✓

Sin placeholders; firmas de tipos consistentes entre tareas (`calcularNetoIva`, `construirReporte`, `filtrarPorRango`, `actualizarPerfilUsuario`).
