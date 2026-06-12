# Diseño — Perfil de usuario + flujo "¿otro ingreso?"

**Fecha:** 2026-06-12
**Estado:** Diseño aprobado, pendiente revisión del spec

## Contexto

Mejora de la lógica del bot sobre la app de rendición de gastos ya en producción. Dos cambios:

1. **Perfil de usuario:** el bot pide **nombre, RUT y área de trabajo** una sola vez por persona
   (onboarding al abrir el chat), los guarda, y los reutiliza. El área se elige de una lista
   editable por el admin.
2. **Flujo "¿otro ingreso?":** tras registrar un gasto (por foto o texto), el bot pregunta si
   desea registrar otro.

## Decisiones tomadas en brainstorming

- **Frecuencia:** se pregunta el perfil **una sola vez** (cuando el perfil está incompleto). En
  usos posteriores no se vuelve a preguntar.
- **Momento:** el onboarding ocurre **al abrir el chat**, antes de registrar gastos, si falta RUT
  o área.
- **Almacenamiento:** en **Google Sheets** (no en Drive).
  - Pestaña `Usuarios`: nuevas columnas **`rut`** y **`area`** (el nombre ya existe).
  - Cada gasto (`Gastos`): nueva columna **`usuario_area`** (para reportes por área a futuro). El
    RUT del usuario queda solo en el perfil.
- **Áreas:** lista **editable sin redesplegar** → vive en una pestaña nueva **`Areas`** de la
  planilla. El admin agrega/corrige filas ahí. Valores iniciales: **Operaciones, Mantención,
  Comercial, Administración**.
- **Validación de RUT:** el RUT del usuario se valida con módulo 11 (`validarRut`, ya existe); si
  es inválido, el bot lo vuelve a pedir.

## Modelo de datos (cambios)

### Pestaña `Usuarios` (agrega 2 columnas)

| Col | Campo | Notas |
|---|---|---|
| A | `email` | (existente) |
| B | `nombre` | (existente) |
| C | `rol` | (existente) |
| D | `activo` | (existente) |
| E | `fecha_alta` | (existente) |
| **F** | **`rut`** | **nuevo** — RUT del usuario (formato chileno) |
| **G** | **`area`** | **nuevo** — área de trabajo (una de las de `Areas`) |

Rango de lectura/escritura: `Usuarios!A2:G`.

### Pestaña `Areas` (nueva)

| Col | Campo |
|---|---|
| A | `area` (encabezado en A1; valores desde A2) |

Seed inicial (A2:A5): `Operaciones`, `Mantención`, `Comercial`, `Administración`.

### Pestaña `Gastos` (agrega 1 columna)

Se agrega al final (columna **Q**) la columna **`usuario_area`**. El orden queda:
`id, fecha_registro, usuario_email, usuario_nombre, fecha_documento, comercio, rut_emisor,
numero_documento, categoria, monto, direccion, observacion, imagen_url, imagen_drive_id, estado,
fecha_creacion, usuario_area`. Rango: `Gastos!A2:Q`.

## Flujos

### Flujo A — Onboarding del perfil (al abrir el chat)

```
1. Usuario abre el chat (ya logueado).
2. El cliente llama GET /api/perfil → { nombre, rut, area, completo, areas[] }.
3. Si completo === false (falta rut o area):
   a. El chat muestra el onboarding en vez de la conversación normal.
   b. Bot: "Antes de empezar necesito unos datos."
      - Nombre (pre-llenado con el conocido, editable).
      - RUT → validado; si es inválido, se vuelve a pedir.
      - Área → se elige de la lista `areas` (botones/desplegable).
   c. Al enviar → POST /api/perfil { nombre, rut, area }.
      - El servidor valida el RUT y que el área esté en la lista.
      - Escribe rut/area/nombre en la fila del usuario en `Usuarios`.
   d. Bot: "¡Listo! Ahora cuéntame un gasto o adjunta una boleta."
4. Si completo === true: va directo al chat normal (sin preguntar nada).
```

### Flujo B — Registro + "¿otro ingreso?"

Igual que hoy (texto o foto → extracción → tarjeta → confirmar → guardar), pero al guardar:

```
- El gasto se escribe con usuario_area = el área del perfil del usuario.
- Bot: "✅ Gasto registrado. ¿Deseas registrar otro?  [Sí]   [No]"
  - Sí → limpia el borrador; el usuario sigue registrando.
  - No → "Perfecto, ¡gracias! Cuando quieras registrar otro, escríbeme."
```

## Impacto técnico

### Tipos (`src/lib/types.ts`)
- `Usuario` agrega `rut: string` y `area: string`.
- `Gasto` agrega `usuarioArea: string`.

### `src/lib/auth.ts`
- `SesionUsuario` agrega `area: string` (para que la ruta de gastos lo grabe). `decidirAcceso`
  lo incluye en la sesión. (`rut` no se necesita aguas abajo; queda solo en el perfil.)

### `src/lib/sheets.ts`
- `usuarioRowToUsuario` lee también `rut` (col F) y `area` (col G); `getUsuario` usa rango `A2:G`.
- `gastoToRow` / `rowToGasto` / `GASTOS_HEADERS` incluyen `usuario_area` (col Q); rangos `A2:Q`.
- **Nuevo** `listarAreas(): Promise<string[]>` — lee `Areas!A2:A`.
- **Nuevo** `actualizarPerfilUsuario(email, { nombre, rut, area }): Promise<void>` — encuentra la
  fila del usuario y reescribe su fila preservando rol/activo/fecha_alta.
- **Nuevo** `perfilCompleto(u: Usuario): boolean` (puro) — `rut !== "" && area !== ""`.

### `src/lib/gasto-factory.ts`
- `NuevoGastoInput` agrega `usuarioArea?: string`; `crearGasto` lo incluye en el `Gasto`.

### Rutas API
- **Nueva** `src/app/api/perfil/route.ts`:
  - `GET` → autentica, devuelve `{ nombre, rut, area, completo, areas }`.
  - `POST` → autentica, valida RUT y área, llama `actualizarPerfilUsuario`. 400 si el RUT es
    inválido o el área no está en la lista.
- `src/app/api/gastos/route.ts` (POST): setea `usuarioArea: auth.usuario.area` al crear el gasto.

### Cliente / UI
- **Nuevo** `src/lib/api-client.ts`: `obtenerPerfil()`, `guardarPerfil({nombre,rut,area})`.
- **Nuevo** componente de onboarding (`src/components/chat/Onboarding.tsx`): formulario nombre +
  RUT + select de área; valida y llama a `guardarPerfil`.
- `src/app/page.tsx` (chat): al montar, obtiene el perfil; si `!completo`, muestra `Onboarding`
  antes del chat; tras completarlo, muestra el chat.
- El flujo de confirmación de gasto agrega el paso "¿otro ingreso?" (mensaje con botones Sí/No).

## Estrategia de pruebas

- **Puro:** `perfilCompleto`; reuso de `validarRut`.
- **`sheets.ts`** (googleapis mockeado): `getUsuario` ahora devuelve rut/area; `listarAreas`;
  `actualizarPerfilUsuario` (verifica que escribe la fila correcta preservando rol/activo);
  `gastoToRow`/`rowToGasto` con la columna `usuario_area`.
- **`gasto-factory`:** `crearGasto` incluye `usuarioArea`.
- **`auth.ts`:** `decidirAcceso` incluye `area` en la sesión.
- **Rutas y UI:** verificadas por `npm run build` + prueba manual (el onboarding y el "¿otro
  ingreso?" se prueban en vivo).

## Migración de la planilla (pasos para el usuario)

1. En `Usuarios`, agregar encabezados **`rut`** (F1) y **`area`** (G1).
2. Crear pestaña **`Areas`** con encabezado `area` (A1) y las áreas iniciales en A2:A5.
3. En `Gastos`, agregar encabezado **`usuario_area`** (Q1).

(Los gastos existentes quedan con `usuario_area` vacío; no se rompen.)

## Fuera de alcance

- Dashboard "gastos por área" (queda **habilitado** por el dato `usuario_area`, pero se construye
  aparte si se desea).
- El RUT del **emisor** (de la boleta) no cambia; es independiente del RUT del usuario.
- Editar áreas desde la app (se editan directo en la planilla, que era el requisito).
