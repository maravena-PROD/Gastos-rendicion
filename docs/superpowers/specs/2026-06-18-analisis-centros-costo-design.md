# Análisis de gastos por centro de costo (vista de gerentes)

Fecha: 2026-06-18

## Problema

Hoy el dashboard llama a `GET /api/gastos`, que filtra por rol: un Administrador ve
todo, pero un usuario "Gerente" (rol `Usuario` con centros de costo en `apruebaCc`)
solo ve **sus propios** gastos. No existe una vista que le permita analizar el gasto
**de los centros de costo que administra**, agregando lo registrado por todo su equipo.

## Objetivo

Una página de **Análisis** donde un gerente vea el gasto de los centros de costo
bajo su alcance (`apruebaCc`), filtrable por **mes o año**.

## Acceso

- El alcance es `apruebaCc` (los CC que el usuario puede aprobar). `["*"]` = todos
  (Administradores). `[]` = ninguno → sin acceso a la vista.
- Reutiliza `tieneAlcance(apruebaCc, ccCodigo)` de `aprobaciones.ts`.
- El filtrado por alcance ocurre **en el servidor**. La API nunca devuelve gastos
  fuera del alcance del solicitante.

## Componentes

### API — `GET /api/analisis`
- Autentica (igual que las demás rutas).
- Si `auth.usuario.apruebaCc` está vacío → `403`.
- Lee todos los gastos (`listGastos`) y devuelve los que caen en el alcance.
- Respuesta: `{ gastos: Gasto[], alcance: string[] }`.

### Lib — `aprobaciones.ts`
- `gastosEnAlcance(gastos: Gasto[], apruebaCc: string[]): Gasto[]` — filtra por
  `tieneAlcance` sobre `imputacion.centroCostoCodigo`.

### Lib — `dashboard.ts` (helpers nuevos)
- `filtrarPorAnio(gastos, anio: "AAAA"): Gasto[]` — `fechaDocumento` empieza con el año.
- `aniosDisponibles(gastos): string[]` — años presentes, de más reciente a más antiguo.
- `porCentroCosto(gastos): { codigo, detalle, total }[]` — total por CC, de mayor a menor.

Se reutilizan: `filtrarPorMes`, `mesesDisponibles`, `porCategoria`, `porUsuario`,
`tendenciaPorDia`, `aprobadosPorTipo`, `contarPendientes`, `rechazados`, `totalGastos`.

### API client — `api-client.ts`
- `obtenerAnalisisCc(): Promise<{ gastos: Gasto[]; alcance: string[] }>`.

### Página — `/analisis/page.tsx`
- Dentro de `AppShell` (título "Análisis"), protegida por `AuthGate`.
- Carga perfil (para la sidebar y el badge de pendientes) y `obtenerAnalisisCc()`.
- Si la respuesta es `403` / alcance vacío: mensaje "No administras centros de costo".
- **Selector de período**: toggle `Mes / Año` + dropdown de períodos disponibles
  (más reciente primero). Default: el mes más reciente con gastos.
- Paneles:
  1. **Total del período** (excluye Rechazados) + cantidad de gastos.
  2. **Por centro de costo** — desglose central, de mayor a menor.
  3. **Estado** — Aprobado / Pendiente / Rechazado (monto y conteo).
  4. **Por categoría** — reutiliza `GraficoCategorias`.
  5. **Por usuario** — quién gastó dentro de sus CC.
  6. **Tendencia** del período — reutiliza `GraficoTendencia`.

### Sidebar — `AppShell.tsx`
- Nuevo ítem "Análisis" con icono, `soloAprobadores: true` (mismo gating que
  Aprobaciones). Ubicado entre Dashboard y Aprobaciones.

## Regla de "gasto real"

Los totales y desgloses (CC, categoría, usuario, tendencia, total) consideran gastos
**no Rechazados** (Registrado + Aprobado). El panel **Estado** muestra el desglose
completo, incluidos los Rechazados, con monto y conteo.

## Pruebas (vitest, TDD)

- `gastosEnAlcance`: incluye CC en alcance, excluye fuera de alcance, `["*"]` incluye todo.
- `filtrarPorAnio`: filtra por año correctamente; ignora otras fechas.
- `aniosDisponibles`: años únicos, orden descendente.
- `porCentroCosto`: agrega por código, ordena de mayor a menor, conserva el detalle.

## Fuera de alcance (YAGNI)

- Exportar el análisis a PDF (el dashboard ya tiene su propio reporte).
- Comparación entre períodos / variación mes a mes.
- Presupuesto por CC.
