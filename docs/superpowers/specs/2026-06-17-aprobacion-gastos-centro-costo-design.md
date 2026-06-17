# Diseño — Aprobación de gastos por centro de costo

**Fecha:** 2026-06-17
**Estado:** Aprobado (pendiente de plan de implementación)

## 1. Problema y objetivo

Hoy los gastos nacen en estado `Registrado` y nunca cambian: no existe ningún flujo,
pantalla ni acción para aprobarlos o rechazarlos. Se necesita que un grupo de
**gerentes** pueda entrar a la app y **aprobar o rechazar** los gastos **según el
centro de costo**, además del rol Administrador que ya existe.

Perfiles aprobadores y su alcance:

| Perfil | Centro(s) de costo que aprueba |
|---|---|
| Gerente de Operaciones | C0100 |
| Gerente Comercial | C0200 |
| Gerente de Adm. y Finanzas | C0300 |
| Gerente de Desarrollo | C0400 |
| Gerente General | **Todos** (`*`), incluido C0500 |
| Administrador (tú) | **Todos** (`*`), super-usuario / supervisión |

Notas del catálogo (`CENTROS DE COSTO 2026.xls`): cada centro de costo **es** una
gerencia (C0100 = Gcia. Operaciones, C0200 = Gcia. Comercial, C0300 = Gcia. Adm y
Fin, C0400 = Gcia. Desarrollo, C0500 = Gcia. Adm. de Instalaciones). **C0500 lo
aprueba solo el Gerente General** (y el Admin).

## 2. Decisiones tomadas (brainstorming)

- **Modelo de roles: alcance por datos** (no enum fijo en código). El "perfil de
  gerente" es un usuario normal con un **alcance de aprobación** definido en la
  planilla. Reasignar centros de costo o sumar un aprobador se hace editando la
  planilla, sin tocar código.
- **Los gerentes también registran** sus propios gastos (son "usuario + aprobador").
- **No hay auto-aprobación**: un gerente no puede aprobar lo que él mismo registró.
  Esos gastos los aprueba quien tenga alcance `*` (Gerente General / Admin).
- **Administrador** = super-usuario (`*`): ve todo y puede aprobar en cualquier CC.
  Su propósito es supervisar el funcionamiento de la app.
- **Un solo nivel** de aprobación: una decisión (Aprobado/Rechazado) es final.
- **Sin notificaciones** por correo (fuera de alcance).

## 3. Modelo de datos

### Planilla `Usuarios` (dos columnas nuevas)

- **`aprueba_cc`** (columna J): códigos de centro de costo que la persona puede
  aprobar, separados por coma (ej. `C0100` o `C0400,C0500`), o `*` para "todos".
  Vacío = no aprueba.
- **`cargo`** (columna K, opcional): etiqueta para mostrar en la UI, ej.
  "Gerente de Operaciones". Solo cosmético; no participa en la lógica de permisos.

### Planilla `Gastos` (tres columnas nuevas, al final)

- **`aprobado_por`**: email de quien tomó la decisión (`""` si pendiente).
- **`fecha_decision`**: timestamp ISO 8601 de la decisión (`""` si pendiente).
- **`motivo`**: texto libre, sobre todo para rechazos (`""` si no aplica).

### Tipos (`src/lib/types.ts`)

- `Usuario` gana `apruebaCc: string[]` (lista de códigos, o `["*"]`) y `cargo: string`.
- `Gasto` gana `aprobadoPor: string`, `fechaDecision: string`, `motivo: string`.
- `SesionUsuario` (`src/lib/auth.ts`) gana `apruebaCc: string[]`. Para el rol
  `Administrador` se resuelve como `["*"]` aunque la planilla traiga otra cosa.

### Parseo / serialización (`src/lib/sheets.ts`)

- `usuarioRowToUsuario`: leer col. J (`aprueba_cc`) → `apruebaCc` (split por coma,
  trim, descartar vacíos; `"*"` se mantiene como `["*"]`) y col. K → `cargo`.
- `gastoToRow` / `rowToGasto`: agregar los tres campos nuevos al final, con defaults
  `""` cuando faltan (re-tolerante, igual que el resto del parseo actual).

## 4. Lógica de permisos — módulo nuevo `src/lib/aprobaciones.ts`

Aislado y testeable, sin dependencias de red.

```ts
// Alcance: la sesión incluye apruebaCc (string[]); "*" = todos.
export function tieneAlcance(apruebaCc: string[], ccCodigo: string): boolean
// true si apruebaCc incluye "*" o incluye ccCodigo

export function puedeAprobar(sesion: SesionUsuario, gasto: Gasto): boolean
// true si:
//   - gasto.estado === "Registrado", y
//   - tieneAlcance(sesion.apruebaCc, gasto.imputacion.centroCostoCodigo), y
//   - no es auto-aprobación: si NO tiene "*", entonces
//     gasto.usuarioEmail.toLowerCase() !== sesion.email.toLowerCase()

export function gastosPorAprobar(gastos: Gasto[], sesion: SesionUsuario): Gasto[]
// gastos.filter(g => puedeAprobar(sesion, g))
```

Regla de auto-aprobación: quien tiene `*` (Gerente General / Admin) **sí** puede
aprobar gastos propios; un gerente con alcance acotado **no**.

## 5. API

### `GET /api/aprobaciones`
- Autentica (igual que las demás rutas).
- `listGastos()` → `gastosPorAprobar(todos, sesion)` → JSON `{ gastos }`.
- Devuelve solo los pendientes que esa sesión puede decidir.

### `POST /api/gastos/[id]/decision`
- Body: `{ decision: "Aprobado" | "Rechazado", motivo?: string }`.
- Autentica → `getGasto(id)` (o busca en `listGastos`). 404 si no existe.
- Valida `decision` ∈ {Aprobado, Rechazado}; 400 si no.
- `puedeAprobar(sesion, gasto)` → si `false`, **403** (cubre estado ≠ Registrado,
  CC fuera de alcance y auto-aprobación).
- Escribe en la fila: `estado = decision`, `aprobado_por = sesion.email`,
  `fecha_decision = ahora ISO`, `motivo = (motivo ?? "").trim()`.
- Respuesta `{ ok: true, gasto }` (201/200). 502 si falla la escritura en Sheets.
- Necesita un helper en `sheets.ts` para actualizar esos campos de una fila por `id`
  (localizar fila por columna `id`, igual que `actualizarPerfilUsuario` localiza por
  email).

## 6. Interfaz

### Página nueva `/aprobaciones` (protegida con `AuthGate`)
- Carga `GET /api/aprobaciones`.
- Lista cada pendiente: fecha, comercio, monto, usuario que lo registró, centro de
  costo (código + detalle), tipo, y miniatura/enlace de la boleta si hay.
- Por gasto: botón **Aprobar** y botón **Rechazar**. Rechazar abre un campo de
  **motivo** (obligatorio para rechazar; opcional/omitible para aprobar).
- Al decidir: `POST /api/gastos/[id]/decision`, se quita de la lista y se muestra
  confirmación. Manejo de error con reintento.
- Estado vacío: "No tienes gastos pendientes por aprobar."

### Punto de entrada
- En el encabezado (chat y/o dashboard) aparece el enlace **"Aprobaciones"** **solo
  si** `sesion.apruebaCc` no está vacío, con un **contador** de pendientes.
- El dashboard del Administrador mantiene su tarjeta "Pendientes de aprobación".

## 7. Sesión / auth

- `decidirAcceso` (`src/lib/auth.ts`) incorpora `apruebaCc` a la `SesionUsuario`:
  toma `usuario.apruebaCc`, salvo que `usuario.rol === "Administrador"`, en cuyo caso
  fuerza `["*"]`.
- `/api/me` ya devuelve `resultado.usuario`; el cliente usará `apruebaCc` para decidir
  si muestra el enlace "Aprobaciones".

## 8. Comportamiento y casos borde

- Solo se decide desde estado **Registrado**. Un gasto ya `Aprobado`/`Rechazado` no es
  accionable (devuelve 403 vía `puedeAprobar`).
- Tras **rechazo**: el gasto queda `Rechazado` + `motivo`. No se reedita (consistente
  con la app actual, donde las correcciones de gastos guardados las hace el Admin en la
  planilla). El usuario puede registrar uno nuevo.
- Concurrencia: si dos aprobadores actúan casi a la vez, el segundo verá que ya no está
  `Registrado` (relectura antes de escribir) y recibirá 403; aceptable para el volumen
  esperado.
- Sin alcance (`apruebaCc` vacío): no ve el enlace ni la página; `GET /api/aprobaciones`
  devuelve lista vacía.

## 9. Migración de datos

- Script nuevo (patrón de `scripts/migrar-encabezados.mjs`) que escribe los
  encabezados: `Usuarios!J1:K1` = (`aprueba_cc`, `cargo`) y `Gastos!AB1:AD1` =
  (`aprobado_por`, `fecha_decision`, `motivo`). Re-ejecutable.
- Carga manual de los `aprueba_cc` / `cargo` de cada gerente en la planilla `Usuarios`
  (no se hardcodean emails en el código).

> Las columnas de `Gastos` ya llegan hasta **AA** (`Gastos!X1:AA1` =
> tipo_rendicion, tipo_documento, monto_neto, iva, según `migrar-encabezados.mjs`), y
> `Usuarios` hasta **I** (banco, cuenta_corriente). Por eso las nuevas van en
> `Gastos!AB:AD` y `Usuarios!J:K`, respectivamente.

## 10. Pruebas

- `aprobaciones.test.ts`: `tieneAlcance` (incluye `*`), `puedeAprobar` y
  `gastosPorAprobar` cubriendo: alcance directo, `*`, CC fuera de alcance, estado ≠
  Registrado, auto-aprobación bloqueada para alcance acotado y permitida para `*`.
- `sheets.test.ts`: round-trip de las 3 columnas nuevas de `Gastos` y de
  `aprueba_cc`/`cargo` en `Usuarios`, con defaults cuando faltan.
- `auth.test.ts`: `decidirAcceso` arma `apruebaCc` y fuerza `["*"]` para Administrador.

## 11. Fuera de alcance (YAGNI)

- Notificaciones por correo / push.
- Cadenas de aprobación multinivel.
- Re-edición / reenvío de gastos rechazados desde la UI.
- Historial/auditoría más allá de `aprobado_por` + `fecha_decision` + `motivo`.
