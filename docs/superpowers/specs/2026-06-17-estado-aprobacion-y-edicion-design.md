# Diseño — Estado de aprobación visible + edición/reenvío de gastos rechazados

**Fecha:** 2026-06-17
**Estado:** Aprobado (pendiente de plan)
**Contexto:** Continúa la feature de aprobación por centro de costo (ya en producción).

## 1. Problema y objetivo

Quien registra gastos necesita ver, en el Dashboard, **qué se le aprobó** (con el monto
total, separando Rendición y Devolución) y **qué se le rechazó** (con el motivo), y poder
**corregir y reenviar** un gasto rechazado para una nueva aprobación. Además, el enlace
"Aprobaciones" debe estar también en el encabezado del Dashboard (hoy solo en el Chat).

## 2. Decisiones (brainstorming)

- **Corregir = editar y reenviar**: al reenviar, el gasto vuelve a `Registrado` y se limpia
  la decisión previa (`aprobadoPor`/`fechaDecision`/`motivo`).
- **Editable solo el dueño y solo gastos `Rechazado`.** Los `Aprobado` quedan firmes; los
  `Registrado` (pendientes) no se editan (fuera de alcance).
- **La edición vive en el Dashboard** (formulario en un modal), **reutilizando** el conjunto
  de campos de la tarjeta de confirmación (no se duplica la lógica).
- **Sin columnas nuevas** en las planillas.
- La sección de estado **respeta el rango Desde/Hasta** del Dashboard (igual que el resto).

## 3. Visibilidad en el Dashboard

Para un `Usuario`, el Dashboard ya filtra a sus propios gastos (`filtrarGastosPorRol`). Se
agrega una sección **"Estado de mis gastos"** calculada sobre `delRango`:

- **Aprobado**: monto total, desglosado en **Rendición** y **Devolución** (solo gastos con
  `estado === "Aprobado"`).
- **Rechazado**: contador + **lista** de cada gasto (fecha, comercio, monto, **motivo**) con
  botón **"Corregir"**.
- **Pendiente**: contador de `estado === "Registrado"`.

Helpers puros nuevos en `src/lib/dashboard.ts` (con tests):
- `aprobadosPorTipo(gastos): { rendicion: number; devolucion: number; total: number }` — suma
  por `tipoRendicion` entre los `Aprobado`.
- `rechazados(gastos): Gasto[]` — los `estado === "Rechazado"`.
- (Pendientes ya lo cubre `contarPendientes`.)

> Nota: para administradores el Dashboard muestra todos los gastos; la sección de estado
> aplica igual sobre lo visible. La sección está pensada para el usuario que registra.

## 4. Edición y reenvío

### UI (Dashboard)
- En la lista de rechazados, **"Corregir"** abre un **modal** con el formulario del gasto
  precargado: comercio, monto, fecha, categoría, **tipo (Rendición/Devolución** + banco y
  cuenta cuando es Devolución**)**, tipo de documento, neto/IVA, **centro de costo → área →
  ubicación**, observación.
- Botón **"Reenviar"** (deshabilitado hasta que el formulario esté completo, misma regla que
  al registrar). **"Cancelar"** cierra el modal.
- Al reenviar con éxito: el gasto sale de la lista de rechazados y aparece confirmación.

### Reutilización del formulario
`TarjetaConfirmacion` (`src/components/chat/TarjetaConfirmacion.tsx`) se parametriza para
servir a creación y edición sin duplicar campos:
- Nuevas props opcionales: `inicial?` (valores iniciales para TODOS los campos, incluidos
  `centroCostoCodigo`/`areaCodigo`/`ubicacionCodigo`, `tipoRendicion`, `observacion`),
  `titulo?` (default "Revisa el gasto"), `textoConfirmar?` (default "Confirmar registro").
- Comportamiento actual (creación desde `borrador`) intacto cuando no se pasa `inicial`.
- El modal del Dashboard renderiza `TarjetaConfirmacion` con `inicial` mapeado desde el
  `Gasto` rechazado, `titulo="Corregir gasto"`, `textoConfirmar="Reenviar"`, y `onConfirmar`
  que llama a la API de edición.

### API: `POST /api/gastos/[id]/editar`
- Autentica (Bearer + `autenticar`).
- Body: igual forma que el POST de creación (`GuardarGastoInput` sin imagen; la imagen
  existente se conserva).
- Busca el gasto (`listGastos` + find). 404 si no existe.
- **`puedeEditar(sesion, gasto)`** → si `false`, **403** (cubre: no es el dueño, o no está
  `Rechazado`).
- Valida y construye los campos con el helper compartido (ver §5), re-resuelve imputación,
  recalcula neto/IVA. Para Devolución exige banco+cuenta (en perfil o payload), igual que al
  crear; si vienen en el payload, se persisten al perfil.
- Construye el gasto actualizado: `{ ...gasto, ...camposEditados, estado: "Registrado",
  aprobadoPor: "", fechaDecision: "", motivo: "" }` y lo guarda con `actualizarGasto`.
- Responde `{ gasto }`. 502 si falla la escritura.

## 5. Refactors de soporte (DRY)

- **`sheets.ts`**: renombrar `actualizarDecisionGasto(gasto)` → **`actualizarGasto(gasto)`**
  (ya reescribe la fila completa A:AD por `id`; el nombre genérico refleja su uso por
  decisión y edición). Actualizar su único llamador (ruta de decisión) y su test.
- **`gastos` (creación)**: extraer la validación + resolución de imputación + cálculo de
  neto/IVA del `POST /api/gastos` a un helper reutilizable, p. ej.
  `construirCamposGasto(body, catalogo): { ok: true, campos } | { ok: false, status, error }`,
  usado por la ruta de creación y por la de edición. Evita duplicar reglas no triviales.
  La validación/persistencia de **banco+cuenta para Devolución** (hoy inline en el POST de
  creación, usa `getUsuario`/`actualizarPerfilUsuario`) también se reutiliza en ambas rutas
  como paso compartido; su factorización exacta (dentro del helper o como paso aparte) la
  define el plan.
- **`aprobaciones.ts`**: agregar `puedeEditar(sesion, gasto): boolean` =
  `gasto.estado === "Rechazado"` && `gasto.usuarioEmail.toLowerCase() === sesion.email.toLowerCase()`.

## 6. Cliente

- `src/lib/api-client.ts`: `editarGasto(id, payload: GuardarGastoInput): Promise<{ gasto: Gasto }>`
  → `POST /api/gastos/${id}/editar`.

## 7. Enlace "Aprobaciones" en el Dashboard

- El Dashboard ya pide `/api/me` (para el rol); de ahí toma también `apruebaCc`. Si
  `apruebaCc.length > 0`, muestra el enlace **"Aprobaciones"** en su encabezado (junto a
  "← Chat"), con contador de pendientes vía `obtenerAprobaciones` (igual patrón que el Chat).

## 8. Permisos y bordes

- Editar: solo dueño + `Rechazado`. Reenviar lo devuelve a `Registrado` (vuelve a la bandeja
  del gerente correspondiente / Gerente General).
- Tras reenviar, el gasto deja de estar rechazado: sale de la lista de "Rechazado" y suma a
  "Pendiente".
- Concurrencia: si el estado cambió entre la carga y el reenvío, `puedeEditar` re-evaluado en
  el servidor (relectura) devuelve 403; aceptable.
- La imagen de la boleta original se conserva (no se re-sube en la edición).

## 9. Pruebas

- `aprobaciones.test.ts`: `puedeEditar` (dueño+Rechazado ok; no dueño; estado ≠ Rechazado;
  email case-insensitive).
- `dashboard.test.ts`: `aprobadosPorTipo` (suma solo Aprobados, separa rendición/devolución) y
  `rechazados`.
- `sheets.test.ts`: ajustar al rename `actualizarGasto` (mismo comportamiento).
- `gastos`/helper: tests del helper `construirCamposGasto` (válido, faltantes, imputación
  inválida, devolución sin cuenta).

## 10. Fuera de alcance (YAGNI)

- Editar gastos `Registrado` (pendientes) o `Aprobado`.
- Historial de versiones/ediciones (más allá de limpiar la decisión).
- Notificaciones al gerente cuando se reenvía.
- Re-subir/cambiar la imagen de la boleta en la edición.
