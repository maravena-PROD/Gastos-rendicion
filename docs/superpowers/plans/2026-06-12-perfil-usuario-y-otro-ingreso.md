# Perfil de usuario + flujo "¿otro ingreso?" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el bot pida una vez (al abrir el chat) el nombre, RUT y área del usuario, los guarde en la planilla, grabe el área en cada gasto, y tras cada registro pregunte si desea hacer otro.

**Architecture:** El perfil (rut, area) se guarda en la pestaña `Usuarios`; las áreas válidas en una pestaña `Areas` editable por el admin. Lógica pura (`perfilCompleto`) testeable; `sheets.ts` gana lectura de áreas y actualización de perfil; nueva ruta `/api/perfil`; la UI de chat muestra un onboarding si el perfil está incompleto y un paso "¿otro ingreso?" tras guardar.

**Tech Stack:** Next.js 16, TypeScript, Tailwind, Vitest. Reusa Planes 1–5.

---

## Estructura de archivos

| Archivo | Cambio |
|---|---|
| `src/lib/types.ts` | `Usuario` +`rut`/`area`; `Gasto` +`usuarioArea` |
| `src/lib/sheets.ts` | mapeos actualizados; `listarAreas`, `actualizarPerfilUsuario`; rangos `A2:G` (Usuarios) y `A2:Q` (Gastos) |
| `src/lib/gasto-factory.ts` | `NuevoGastoInput` +`usuarioArea`; `crearGasto` lo incluye |
| `src/lib/auth.ts` | `SesionUsuario` +`area`; `decidirAcceso` lo incluye |
| `src/lib/perfil.ts` (nuevo) | `perfilCompleto` (puro) |
| `src/app/api/perfil/route.ts` (nuevo) | GET/POST del perfil |
| `src/app/api/gastos/route.ts` | POST setea `usuarioArea` |
| `src/lib/api-client.ts` | `obtenerPerfil`, `guardarPerfil` |
| `src/components/chat/Onboarding.tsx` (nuevo) | formulario de perfil |
| `src/app/page.tsx` | gate de onboarding + "¿otro ingreso?" |

---

## Task 1: `Gasto` gana `usuarioArea`

**Files:** Modify `src/lib/types.ts`, `src/lib/sheets.ts`, `src/lib/gasto-factory.ts`, `src/lib/sheets.test.ts`, `src/lib/gastos-rol.test.ts`, `src/lib/dashboard.test.ts`

**Contexto:** Agregar el campo `usuarioArea` al modelo `Gasto` (columna `usuario_area`, posición 16 / columna Q). Hay que actualizar el tipo, el mapeo, la factory y TODAS las fixtures de `Gasto` para que la suite siga verde.

- [ ] **Step 1: Actualizar la prueba de mapeo en `src/lib/sheets.test.ts`**

En el objeto `const gasto: Gasto = {...}` agrega al final (después de `fechaCreacion`):
```ts
  usuarioArea: "Operaciones",
```
Y en el test `"convierte un Gasto a fila en el orden correcto"` cambia la aserción de longitud:
```ts
    expect(row.length).toBe(17);
```
Agrega además, en ese mismo test, una aserción:
```ts
    expect(row[16]).toBe("Operaciones");
```

- [ ] **Step 2: Correr para ver el fallo**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL (longitud 16 ≠ 17 y/o tipo `Gasto` incompleto).

- [ ] **Step 3: Actualizar `src/lib/types.ts`**

En la interfaz `Gasto`, agrega al final (después de `fechaCreacion`):
```ts
  usuarioArea: string; // área del usuario que registró (denormalizado para reportes)
```

- [ ] **Step 4: Actualizar `src/lib/sheets.ts`**

En `GASTOS_HEADERS`, agrega al final del array (después de `"fecha_creacion"`):
```ts
  "usuario_area",
```
En `gastoToRow`, agrega al final del array que se devuelve (después de `g.fechaCreacion`):
```ts
    g.usuarioArea,
```
En `rowToGasto`, agrega al final del objeto (después de `fechaCreacion: cell(row, 15),`):
```ts
    usuarioArea: cell(row, 16),
```
Cambia los rangos de Gastos de `A2:P` a `A2:Q` en `listGastos` y `appendGasto`:
```ts
    range: "Gastos!A2:Q",
```

- [ ] **Step 5: Actualizar `src/lib/gasto-factory.ts`**

En `NuevoGastoInput`, agrega:
```ts
  usuarioArea?: string;
```
En el objeto que devuelve `crearGasto`, agrega (después de `estado: "Registrado",` o donde calce, antes del cierre):
```ts
    usuarioArea: input.usuarioArea ?? "",
```

- [ ] **Step 6: Actualizar fixtures de `Gasto` en otros tests**

En `src/lib/gastos-rol.test.ts`, dentro de la función `gasto(...)` que arma un `Gasto`, agrega al final del objeto:
```ts
    usuarioArea: "",
```
En `src/lib/dashboard.test.ts`, dentro de la función `g(parcial)` en el objeto base, agrega (antes del `...parcial`):
```ts
    usuarioArea: "",
```

- [ ] **Step 7: Correr toda la suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc limpio; toda la suite en verde.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types.ts src/lib/sheets.ts src/lib/gasto-factory.ts src/lib/sheets.test.ts src/lib/gastos-rol.test.ts src/lib/dashboard.test.ts
git commit -m "feat: Gasto gana usuarioArea (columna usuario_area)"
```

---

## Task 2: `Usuario` gana `rut` y `area`

**Files:** Modify `src/lib/types.ts`, `src/lib/sheets.ts`, `src/lib/sheets.test.ts`, `src/lib/auth.test.ts`, `src/lib/auth-server.test.ts`

**Contexto:** Agregar `rut` y `area` al modelo `Usuario` (columnas F y G de `Usuarios`). Actualizar el mapeo, el rango de `getUsuario`, y las fixtures de `Usuario`.

- [ ] **Step 1: Actualizar la prueba de `usuarioRowToUsuario` en `src/lib/sheets.test.ts`**

En el test `"mapea una fila a Usuario y parsea activo"`, la fila de entrada ya tiene 5 columnas; agrégale rut y area:
```ts
    const u = usuarioRowToUsuario([
      "maravena@bosca.cl",
      "M. Aravena",
      "Administrador",
      "TRUE",
      "2026-06-01T00:00:00Z",
      "76.543.219-7",
      "Operaciones",
    ]);
    expect(u.rol).toBe("Administrador");
    expect(u.activo).toBe(true);
    expect(u.rut).toBe("76.543.219-7");
    expect(u.area).toBe("Operaciones");
```

- [ ] **Step 2: Correr para ver el fallo**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL (`u.rut`/`u.area` undefined; tipo `Usuario` incompleto).

- [ ] **Step 3: Actualizar `src/lib/types.ts`**

En la interfaz `Usuario`, agrega al final (después de `fechaAlta`):
```ts
  rut: string;
  area: string;
```

- [ ] **Step 4: Actualizar `src/lib/sheets.ts`**

En `usuarioRowToUsuario`, agrega al objeto (después de `fechaAlta: cell(row, 4),`):
```ts
    rut: cell(row, 5),
    area: cell(row, 6),
```
En `getUsuario`, cambia el rango de `Usuarios!A2:E` a:
```ts
    range: "Usuarios!A2:G",
```

- [ ] **Step 5: Actualizar fixtures de `Usuario`**

En `src/lib/auth.test.ts`, en el objeto `const usuarioAdmin: Usuario = {...}`, agrega al final:
```ts
  rut: "76.543.219-7",
  area: "Operaciones",
```
En `src/lib/auth-server.test.ts`, en `const usuario: Usuario = {...}`, agrega al final:
```ts
  rut: "76.543.219-7",
  area: "Operaciones",
```

- [ ] **Step 6: Correr toda la suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc limpio; suite en verde.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts src/lib/sheets.ts src/lib/sheets.test.ts src/lib/auth.test.ts src/lib/auth-server.test.ts
git commit -m "feat: Usuario gana rut y area (perfil en pestaña Usuarios)"
```

---

## Task 3: `SesionUsuario` gana `area`

**Files:** Modify `src/lib/auth.ts`, `src/lib/auth.test.ts`, `src/lib/gastos-rol.test.ts`

**Contexto:** La sesión que devuelve `decidirAcceso` debe incluir el `area` del usuario, para que `/api/gastos` la grabe en el gasto. Hay que actualizar la función pura y sus fixtures.

- [ ] **Step 1: Actualizar pruebas en `src/lib/auth.test.ts`**

En el test `"permite a un usuario válido del dominio y devuelve su sesión"`, cambia la aserción de la sesión esperada para incluir `area`:
```ts
    expect(r).toEqual({
      ok: true,
      usuario: {
        email: "maravena@bosca.cl",
        nombre: "M. Aravena",
        rol: "Administrador",
        area: "Operaciones",
      },
    });
```
En el bloque `describe("tieneRol", ...)`, a los literales `sesionUsuario` y `sesionAdmin` agrégales `area`:
```ts
  const sesionUsuario = { email: "u@bosca.cl", nombre: "U", rol: "Usuario" as const, area: "" };
  const sesionAdmin = { email: "a@bosca.cl", nombre: "A", rol: "Administrador" as const, area: "" };
```

- [ ] **Step 2: Correr para ver el fallo**

Run: `npx vitest run src/lib/auth.test.ts`
Expected: FAIL (la sesión no trae `area`).

- [ ] **Step 3: Actualizar `src/lib/auth.ts`**

En la interfaz `SesionUsuario`, agrega:
```ts
  area: string;
```
En `decidirAcceso`, en el objeto de éxito, agrega `area`:
```ts
  return {
    ok: true,
    usuario: { email: usuario.email, nombre: usuario.nombre, rol: usuario.rol, area: usuario.area },
  };
```

- [ ] **Step 4: Actualizar `src/lib/gastos-rol.test.ts`**

En los literales `SesionUsuario` (admin y usuario), agrégales `area: ""`:
```ts
    const admin: SesionUsuario = { email: "jefe@bosca.cl", nombre: "Jefe", rol: "Administrador", area: "" };
```
```ts
    const usuario: SesionUsuario = { email: "MARAVENA@bosca.cl", nombre: "M", rol: "Usuario", area: "" };
```

- [ ] **Step 5: Correr toda la suite y tipos**

Run: `npx tsc --noEmit && npm test`
Expected: tsc limpio; suite en verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts src/lib/gastos-rol.test.ts
git commit -m "feat: SesionUsuario incluye area"
```

---

## Task 4: `perfilCompleto` (puro)

**Files:** Create `src/lib/perfil.ts`, `src/lib/perfil.test.ts`

**Contexto:** Helper puro que dice si un usuario ya tiene el perfil completo (rut y area no vacíos). Lo usa la ruta `/api/perfil`.

- [ ] **Step 1: Escribir la prueba que falla**

Create `src/lib/perfil.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { perfilCompleto } from "./perfil";
import type { Usuario } from "./types";

function usuario(parcial: Partial<Usuario>): Usuario {
  return {
    email: "x@bosca.cl",
    nombre: "X",
    rol: "Usuario",
    activo: true,
    fechaAlta: "",
    rut: "",
    area: "",
    ...parcial,
  };
}

describe("perfilCompleto", () => {
  it("true cuando rut y area están presentes", () => {
    expect(perfilCompleto(usuario({ rut: "76.543.219-7", area: "Operaciones" }))).toBe(true);
  });
  it("false si falta el rut", () => {
    expect(perfilCompleto(usuario({ area: "Operaciones" }))).toBe(false);
  });
  it("false si falta el area", () => {
    expect(perfilCompleto(usuario({ rut: "76.543.219-7" }))).toBe(false);
  });
  it("false si están en blanco con espacios", () => {
    expect(perfilCompleto(usuario({ rut: "  ", area: "  " }))).toBe(false);
  });
});
```

- [ ] **Step 2: Correr para ver el fallo**

Run: `npx vitest run src/lib/perfil.test.ts`
Expected: FAIL — "perfilCompleto is not a function".

- [ ] **Step 3: Implementar**

Create `src/lib/perfil.ts`:
```ts
import type { Usuario } from "./types";

/** El perfil está completo cuando el usuario ya tiene RUT y área. */
export function perfilCompleto(u: Usuario): boolean {
  return u.rut.trim() !== "" && u.area.trim() !== "";
}
```

- [ ] **Step 4: Correr para ver el éxito**

Run: `npx vitest run src/lib/perfil.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/perfil.ts src/lib/perfil.test.ts
git commit -m "feat: perfilCompleto (puro) con tests"
```

---

## Task 5: `listarAreas` en `sheets.ts`

**Files:** Modify `src/lib/sheets.ts`, `src/lib/sheets.test.ts`

**Contexto:** Lee las áreas válidas de la pestaña `Areas` (columna A, desde la fila 2), descartando vacíos.

- [ ] **Step 1: Agregar la prueba que falla**

Al final de `src/lib/sheets.test.ts`, agrega:
```ts
import { listarAreas } from "./sheets";

describe("listarAreas", () => {
  it("devuelve las áreas no vacías de la pestaña Areas", async () => {
    valuesGet.mockResolvedValue({
      data: { values: [["Operaciones"], ["Mantención"], [""], ["Comercial"]] },
    });
    expect(await listarAreas()).toEqual(["Operaciones", "Mantención", "Comercial"]);
  });
  it("devuelve [] si no hay áreas", async () => {
    valuesGet.mockResolvedValue({ data: {} });
    expect(await listarAreas()).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr para ver el fallo**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL — "listarAreas is not a function".

- [ ] **Step 3: Implementar en `src/lib/sheets.ts`**

Agrega al final:
```ts
/** Lee las áreas de trabajo válidas de la pestaña Areas (columna A, desde fila 2). */
export async function listarAreas(): Promise<string[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Areas!A2:A",
  });
  const rows = (res.data.values ?? []) as string[][];
  return rows.map((r) => (r[0] ?? "").trim()).filter((a) => a !== "");
}
```

- [ ] **Step 4: Correr para ver el éxito**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sheets.ts src/lib/sheets.test.ts
git commit -m "feat: listarAreas (lee pestaña Areas) con tests"
```

---

## Task 6: `actualizarPerfilUsuario` en `sheets.ts`

**Files:** Modify `src/lib/sheets.ts`, `src/lib/sheets.test.ts`

**Contexto:** Encuentra la fila del usuario en `Usuarios` (por email) y reescribe su fila con el nuevo nombre/rut/area, **preservando** rol, activo y fecha_alta. Necesita una operación `update` de Sheets, que hay que agregar al mock.

- [ ] **Step 1: Agregar `update` al mock de googleapis**

En `src/lib/sheets.test.ts`, en el bloque `vi.mock("googleapis", ...)`, agrega un `valuesUpdate` junto a `valuesGet`/`valuesAppend`. Primero, declara el spy cerca de los otros (`const valuesGet = vi.fn();` …):
```ts
const valuesUpdate = vi.fn();
```
Luego, dentro del objeto `values:` del mock, agrega:
```ts
            update: (...args: unknown[]) => valuesUpdate(...args),
```
Y en el `beforeEach`, agrega:
```ts
  valuesUpdate.mockReset();
```

- [ ] **Step 2: Agregar la prueba que falla**

Al final de `src/lib/sheets.test.ts`:
```ts
import { actualizarPerfilUsuario } from "./sheets";

describe("actualizarPerfilUsuario", () => {
  it("reescribe la fila del usuario preservando rol/activo/fecha_alta", async () => {
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ["otro@bosca.cl", "Otro", "Usuario", "TRUE", "2026-01-01", "", ""],
          ["maravena@bosca.cl", "Viejo Nombre", "Administrador", "TRUE", "2026-06-01", "", ""],
        ],
      },
    });
    valuesUpdate.mockResolvedValue({});
    await actualizarPerfilUsuario("maravena@bosca.cl", {
      nombre: "M. Aravena",
      rut: "76.543.219-7",
      area: "Operaciones",
    });
    expect(valuesUpdate).toHaveBeenCalledTimes(1);
    const arg = valuesUpdate.mock.calls[0][0] as {
      range: string;
      requestBody: { values: string[][] };
    };
    // el usuario está en la 2ª fila de datos => fila 3 de la hoja
    expect(arg.range).toBe("Usuarios!A3:G3");
    expect(arg.requestBody.values[0]).toEqual([
      "maravena@bosca.cl",
      "M. Aravena",
      "Administrador", // rol preservado
      "TRUE", // activo preservado
      "2026-06-01", // fecha_alta preservada
      "76.543.219-7",
      "Operaciones",
    ]);
  });

  it("lanza si el usuario no existe", async () => {
    valuesGet.mockResolvedValue({ data: { values: [] } });
    await expect(
      actualizarPerfilUsuario("nadie@bosca.cl", { nombre: "N", rut: "1-9", area: "x" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Correr para ver el fallo**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: FAIL — "actualizarPerfilUsuario is not a function".

- [ ] **Step 4: Implementar en `src/lib/sheets.ts`**

Agrega al final:
```ts
/**
 * Actualiza el perfil (nombre, rut, area) de un usuario en la pestaña Usuarios,
 * preservando rol, activo y fecha_alta. Lanza si el usuario no existe.
 */
export async function actualizarPerfilUsuario(
  email: string,
  perfil: { nombre: string; rut: string; area: string },
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Usuarios!A2:G",
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
  ];
  const numeroFila = idx + 2; // fila 1 = encabezados
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Usuarios!A${numeroFila}:G${numeroFila}`,
    valueInputOption: "RAW",
    requestBody: { values: [filaActualizada] },
  });
}
```

- [ ] **Step 5: Correr para ver el éxito**

Run: `npx vitest run src/lib/sheets.test.ts`
Expected: PASS.

- [ ] **Step 6: Tipos + suite**

Run: `npx tsc --noEmit && npm test`
Expected: limpio y verde.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sheets.ts src/lib/sheets.test.ts
git commit -m "feat: actualizarPerfilUsuario (escribe perfil en Usuarios) con tests"
```

---

## Task 7: Ruta `/api/perfil`

**Files:** Create `src/app/api/perfil/route.ts`

**Contexto:** `GET` devuelve el perfil + si está completo + las áreas. `POST` valida (RUT módulo 11, área en la lista) y guarda. El RUT se normaliza con `formatRut` antes de guardar.

- [ ] **Step 1: Implementar la ruta**

Create `src/app/api/perfil/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { getUsuario, listarAreas, actualizarPerfilUsuario } from "@/lib/sheets";
import { perfilCompleto } from "@/lib/perfil";
import { validarRut, formatRut } from "@/lib/format";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  try {
    const [usuario, areas] = await Promise.all([
      getUsuario(auth.usuario.email),
      listarAreas(),
    ]);
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json({
      nombre: usuario.nombre,
      rut: usuario.rut,
      area: usuario.area,
      completo: perfilCompleto(usuario),
      areas,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo leer el perfil" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  let body: { nombre?: string; rut?: string; area?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body.nombre || !body.nombre.trim()) {
    return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  }
  if (!body.rut || !validarRut(body.rut)) {
    return NextResponse.json({ error: "RUT inválido" }, { status: 400 });
  }
  if (!body.area) {
    return NextResponse.json({ error: "Falta el área" }, { status: 400 });
  }

  try {
    const areas = await listarAreas();
    if (!areas.includes(body.area)) {
      return NextResponse.json({ error: "Área no válida" }, { status: 400 });
    }
    await actualizarPerfilUsuario(auth.usuario.email, {
      nombre: body.nombre.trim(),
      rut: formatRut(body.rut),
      area: body.area,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el perfil" }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/perfil/route.ts
git commit -m "feat: ruta /api/perfil (GET perfil+áreas, POST guardar perfil validado)"
```

---

## Task 8: `/api/gastos` POST graba `usuarioArea`

**Files:** Modify `src/app/api/gastos/route.ts`

**Contexto:** Al crear el gasto, setear `usuarioArea` con el área del perfil del usuario (que viene en la sesión).

- [ ] **Step 1: Editar la llamada a `crearGasto`**

En `src/app/api/gastos/route.ts`, dentro del `POST`, en el objeto que se pasa a `crearGasto({...})`, agrega:
```ts
    usuarioArea: auth.usuario.area,
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/gastos/route.ts
git commit -m "feat: /api/gastos graba el área del usuario en el gasto"
```

---

## Task 9: Cliente — `obtenerPerfil` / `guardarPerfil`

**Files:** Modify `src/lib/api-client.ts`, `src/lib/api-client.test.ts`

**Contexto:** Wrappers tipados para la ruta `/api/perfil`.

- [ ] **Step 1: Agregar pruebas que fallan**

Al final de `src/lib/api-client.test.ts` (dentro del archivo, reusa el mock de fetch/token existente), agrega:
```ts
import { obtenerPerfil, guardarPerfil } from "./api-client";

describe("obtenerPerfil", () => {
  it("hace GET a /api/perfil", async () => {
    mockFetch(true, { nombre: "M", rut: "", area: "", completo: false, areas: ["Operaciones"] });
    const r = await obtenerPerfil();
    expect(r.completo).toBe(false);
    expect(r.areas).toEqual(["Operaciones"]);
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/perfil");
    expect(opts.method).toBe("GET");
  });
});

describe("guardarPerfil", () => {
  it("hace POST a /api/perfil con el perfil", async () => {
    mockFetch(true, { ok: true });
    await guardarPerfil({ nombre: "M. Aravena", rut: "76.543.219-7", area: "Operaciones" });
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/perfil");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body).area).toBe("Operaciones");
  });

  it("lanza con el mensaje del backend si falla", async () => {
    mockFetch(false, { error: "RUT inválido" });
    await expect(
      guardarPerfil({ nombre: "M", rut: "1-1", area: "x" }),
    ).rejects.toThrow("RUT inválido");
  });
});
```

- [ ] **Step 2: Correr para ver el fallo**

Run: `npx vitest run src/lib/api-client.test.ts`
Expected: FAIL — "obtenerPerfil is not a function".

- [ ] **Step 3: Implementar en `src/lib/api-client.ts`**

Agrega al final:
```ts
/** Perfil del usuario + áreas disponibles. */
export interface Perfil {
  nombre: string;
  rut: string;
  area: string;
  completo: boolean;
  areas: string[];
}

/** Obtiene el perfil del usuario actual y las áreas válidas. */
export function obtenerPerfil(): Promise<Perfil> {
  return pedir<Perfil>("/api/perfil", { method: "GET" });
}

/** Guarda el perfil (nombre, rut, area) del usuario actual. */
export function guardarPerfil(perfil: {
  nombre: string;
  rut: string;
  area: string;
}): Promise<{ ok: boolean }> {
  return pedir<{ ok: boolean }>("/api/perfil", {
    method: "POST",
    body: JSON.stringify(perfil),
  });
}
```

- [ ] **Step 4: Correr para ver el éxito**

Run: `npx vitest run src/lib/api-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Tipos + suite**

Run: `npx tsc --noEmit && npm test`
Expected: limpio y verde.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api-client.ts src/lib/api-client.test.ts
git commit -m "feat: api-client obtenerPerfil/guardarPerfil con tests"
```

---

## Task 10: Componente Onboarding

**Files:** Create `src/components/chat/Onboarding.tsx`

**Contexto:** Formulario que pide nombre, RUT (validado en vivo con `validarRut`) y área (select de la lista). Al enviar llama a `guardarPerfil` y, si todo OK, avisa al padre con `onListo`. Muestra errores.

- [ ] **Step 1: Implementar el componente**

Create `src/components/chat/Onboarding.tsx`:
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-5">
        <h1 className="mb-1 text-lg font-semibold text-gray-800">Completa tu perfil</h1>
        <p className="mb-4 text-sm text-gray-500">Solo la primera vez.</p>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-gray-500">
            Nombre completo
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-500">
            RUT
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
              placeholder="76.543.219-7"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              onBlur={() => rutValido && setRut(formatRut(rut))}
            />
            {rut !== "" && !rutValido && (
              <span className="text-xs text-red-600">RUT inválido</span>
            )}
          </label>
          <label className="text-xs text-gray-500">
            Área de trabajo
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
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
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={enviar}
          disabled={!completo || guardando}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar y empezar"}
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
git add src/components/chat/Onboarding.tsx
git commit -m "feat: componente Onboarding (nombre + RUT validado + área)"
```

---

## Task 11: Integración en la página de chat

**Files:** Modify `src/app/page.tsx`

**Contexto:** Al montar, obtener el perfil. Si está incompleto, mostrar `Onboarding` antes del chat. Tras guardar un gasto, mostrar el paso "¿otro ingreso?" con botones Sí/No.

- [ ] **Step 1: Reemplazar el contenido de `src/app/page.tsx`**

Reemplaza el archivo COMPLETO por:
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { cerrarSesion, getIdTokenActual } from "@/lib/firebase-client";
import {
  extraerDesdeTexto,
  extraerDesdeImagen,
  subirBoleta,
  guardarGasto,
  obtenerPerfil,
  type GuardarGastoInput,
  type Perfil,
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
import { Onboarding } from "@/components/chat/Onboarding";

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
  | { tipo: "confirmacion"; borrador: ExtraccionGasto; imagenUrl?: string; imagenDriveId?: string }
  | { tipo: "otro" };

function Chat({ perfil }: { perfil: Perfil }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { tipo: "texto", autor: "bot", texto: "Hola 👋 Cuéntame un gasto o adjunta una boleta." },
  ]);
  const [borrador, setBorrador] = useState<ExtraccionGasto>(EXTRACCION_VACIA);
  const [imagen, setImagen] = useState<{ url: string; id: string } | null>(null);
  const [procesando, setProcesando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  function agregarBot(texto: string) {
    setMensajes((m) => [...m, { tipo: "texto", autor: "bot", texto }]);
  }
  function agregarUsuario(texto: string) {
    setMensajes((m) => [...m, { tipo: "texto", autor: "usuario", texto }]);
  }
  function quitarTransitorios(m: Mensaje[]) {
    return m.filter((x) => x.tipo !== "confirmacion" && x.tipo !== "otro");
  }

  function avanzar(nuevoBorrador: ExtraccionGasto, img: { url: string; id: string } | null) {
    if (camposFaltantes(nuevoBorrador).length === 0) {
      setMensajes((m) => [
        ...m,
        { tipo: "confirmacion", borrador: nuevoBorrador, imagenUrl: img?.url, imagenDriveId: img?.id },
      ]);
    } else {
      const pregunta = siguientePregunta(nuevoBorrador);
      if (pregunta) agregarBot(pregunta);
    }
  }

  async function onTexto(texto: string) {
    setMensajes((m) => quitarTransitorios(m));
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
    setMensajes((m) => quitarTransitorios(m));
    agregarUsuario("📎 (boleta adjunta)");
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
      await guardarGasto(datos);
      setMensajes((m) => [
        ...quitarTransitorios(m),
        { tipo: "texto", autor: "bot", texto: "✅ Gasto registrado." },
        { tipo: "otro" },
      ]);
      setBorrador(EXTRACCION_VACIA);
      setImagen(null);
    } catch {
      agregarBot("No pude guardar el gasto. Reintenta en un momento.");
    } finally {
      setProcesando(false);
    }
  }

  function onCancelar() {
    setMensajes((m) => quitarTransitorios(m));
    setBorrador(EXTRACCION_VACIA);
    setImagen(null);
    agregarBot("Listo, lo descarté. ¿Registramos otro?");
  }

  function onOtroSi() {
    setMensajes((m) => [
      ...quitarTransitorios(m),
      { tipo: "texto", autor: "bot", texto: "Dale 👍 Cuéntame el siguiente o adjunta la boleta." },
    ]);
  }
  function onOtroNo() {
    setMensajes((m) => [
      ...quitarTransitorios(m),
      { tipo: "texto", autor: "bot", texto: "Perfecto, ¡gracias! Cuando quieras registrar otro, escríbeme." },
    ]);
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3">
        <span className="font-semibold text-gray-800">Rendición de Gastos</span>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>
            {perfil.nombre} · {perfil.area}
          </span>
          <Link href="/dashboard" className="rounded-lg border px-3 py-1 text-xs">
            Dashboard
          </Link>
          <button onClick={() => cerrarSesion()} className="rounded-lg border px-3 py-1 text-xs">
            Salir
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {mensajes.map((m, i) => {
          if (m.tipo === "texto") {
            return (
              <MensajeBurbuja key={i} autor={m.autor}>
                {m.texto}
              </MensajeBurbuja>
            );
          }
          if (m.tipo === "confirmacion") {
            return (
              <TarjetaConfirmacion
                key={i}
                borrador={m.borrador}
                imagenUrl={m.imagenUrl}
                imagenDriveId={m.imagenDriveId}
                onConfirmar={onConfirmar}
                onCancelar={onCancelar}
                deshabilitado={procesando}
              />
            );
          }
          // tipo "otro"
          return (
            <div key={i} className="flex flex-col items-start gap-2">
              <MensajeBurbuja autor="bot">¿Deseas registrar otro?</MensajeBurbuja>
              <div className="flex gap-2">
                <button
                  onClick={onOtroSi}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Sí
                </button>
                <button onClick={onOtroNo} className="rounded-lg border px-4 py-2 text-sm">
                  No
                </button>
              </div>
            </div>
          );
        })}
        {procesando && <p className="text-center text-xs text-gray-400">Procesando…</p>}
        <div ref={finRef} />
      </div>

      <BarraEntrada onTexto={onTexto} onArchivo={onArchivo} deshabilitado={procesando} />
    </div>
  );
}

function PaginaProtegida() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargarPerfil() {
    try {
      const token = await getIdTokenActual();
      if (!token) return;
      const p = await obtenerPerfil();
      setPerfil(p);
    } catch {
      setError("No se pudo cargar tu perfil.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarPerfil();
  }, []);

  if (cargando) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">Cargando…</div>;
  }
  if (error || !perfil) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-red-600">
        {error ?? "Error"}
      </div>
    );
  }
  if (!perfil.completo) {
    return (
      <Onboarding
        nombreInicial={perfil.nombre}
        areas={perfil.areas}
        onListo={() => {
          setCargando(true);
          cargarPerfil();
        }}
      />
    );
  }
  return <Chat perfil={perfil} />;
}

export default function Page() {
  return (
    <AuthGate>
      <PaginaProtegida />
    </AuthGate>
  );
}
```

- [ ] **Step 2: Verificar tipos, suite y build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: tsc limpio; suite en verde; build compila.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: onboarding de perfil al abrir el chat + paso ¿otro ingreso?"
```

- [ ] **Step 4: Nota de migración de la planilla (manual, requiere infra real)**

Antes de probar en vivo hay que preparar la planilla:
1. En `Usuarios`: agregar encabezados `rut` (F1) y `area` (G1).
2. Crear pestaña `Areas`: encabezado `area` (A1) y en A2:A5 → `Operaciones`, `Mantención`, `Comercial`, `Administración`.
3. En `Gastos`: agregar encabezado `usuario_area` (Q1).

Luego desplegar (`vercel --prod --yes`) y probar: abrir el chat → completar perfil → registrar un gasto → ver "¿otro ingreso?" y la columna `usuario_area` poblada.

---

## Self-Review (cobertura del spec)

- **Perfil una vez, onboarding al abrir el chat (spec §Flujo A):** Task 11 (`PaginaProtegida` →
  `Onboarding` si `!completo`), Task 10 (componente), Task 7 (`/api/perfil`). ✅
- **Guardar en `Usuarios` (rut, area) + nombre (spec §Modelo):** Task 2 (tipo/mapeo), Task 6
  (`actualizarPerfilUsuario`), Task 7 (POST). ✅
- **Áreas editables en pestaña `Areas` (spec §Áreas):** Task 5 (`listarAreas`), Task 7 (GET las
  devuelve, POST valida contra ellas), Task 10 (select). ✅
- **RUT validado módulo 11 (spec):** Task 7 (POST valida con `validarRut`), Task 10 (validación en
  vivo). ✅
- **`usuario_area` en cada gasto (spec §Modelo):** Task 1 (tipo/mapeo/factory), Task 8 (POST lo
  setea desde la sesión), Task 3 (area en la sesión). ✅
- **"¿otro ingreso?" tras guardar (spec §Flujo B):** Task 11 (`onConfirmar` agrega mensaje `otro`
  con botones Sí/No). ✅
- **Migración de planilla (spec §Migración):** Task 11 Step 4 documenta los pasos. ✅
- **Fuera de alcance (dashboard por área, RUT emisor):** respetado — no se construye dashboard por
  área; el rut_emisor no se toca. ✅

**Sin placeholders:** todo el código está completo. **Consistencia de tipos:** `Usuario`
(+rut/area), `Gasto` (+usuarioArea), `SesionUsuario` (+area), `Perfil`, `NuevoGastoInput`
(+usuarioArea) usados consistentemente entre tareas; rangos `A2:G`/`A2:Q` aplicados en lectura y
escritura.

**Dependencia externa (no para tests):** la prueba en vivo requiere la migración de la planilla
(Task 11 Step 4). Los tests no la requieren (googleapis mockeado).
