# Imputación de gastos por Centro de costo → Área → Ubicación

Fecha: 2026-06-16
Estado: Aprobado (diseño)

## Problema y objetivo

Hoy un gasto se registra sin imputación contable. Cada gasto debe quedar
asignado a un **centro de costo**, dentro de él a un **área**, y dentro de ella
a una **ubicación**, según la jerarquía del maestro de la empresa
(`CENTROS DE COSTO 2026.xls`, hoja `CCOST - AREA - LOCALES etc`).

El bot debe pedir esos tres datos, en cascada, **en cada gasto** que el usuario
registre, antes de confirmarlo.

## Decisiones tomadas

- **Alcance:** la selección es **por gasto** (no por sesión).
- **Niveles:** solo 3 — Centro de costo → Área → Ubicación.
- **Clientes claves (DIM 5):** fuera de alcance. Las filas de la planilla sin
  código de ubicación (CENCOSUD, FALABELLA, EASY, etc.) se descartan al cargar.
- **Ubicaciones rojas "Ex Casa Matriz Vespucio" (T9505):** obsoletas, se
  excluyen al cargar.
- **UI:** tres menús desplegables en cascada dentro de la tarjeta de
  confirmación del gasto.
- **Guardado:** código + detalle de cada nivel (6 columnas), denormalizado en la
  pestaña `Gastos`, igual que el campo existente `usuario_area`.

Tras aplicar los filtros, el maestro deja **56 combinaciones válidas**: 5
centros de costo (C0100–C0500), 26 áreas y 31 ubicaciones distintas.

## Modelo de datos (Google Sheets)

### Nueva pestaña `CentrosCosto`

Una fila por combinación válida. Nombre elegido para no chocar con la pestaña
`Areas` existente (que define el *área de trabajo del perfil*, un concepto
distinto).

Encabezados (fila 1) y orden de columnas:

| col | encabezado | ejemplo |
|---|---|---|
| A | `cc_codigo` | `C0100` |
| B | `cc_detalle` | `Gcia. Operaciones` |
| C | `area_codigo` | `A1010` |
| D | `area_detalle` | `G.Oper - Gerencia` |
| E | `ubicacion_codigo` | `T9005` |
| F | `ubicacion_detalle` | `Serv. Operaciones` |

### Columnas nuevas en la pestaña `Gastos`

Se agregan **al final** (después de `usuario_area`), columnas R–W:

| col | encabezado |
|---|---|
| R | `centro_costo_codigo` |
| S | `centro_costo` |
| T | `area_codigo` |
| U | `area` |
| V | `ubicacion_codigo` |
| W | `ubicacion` |

Los gastos históricos (anteriores a esta feature) quedan con esas celdas
vacías; al leerlos se interpretan como `""` (el helper `cell()` ya tolera filas
recortadas). La fila 1 de `Gastos` debe actualizarse para incluir los 6
encabezados nuevos.

## Componentes

### 1. Carga de la data — `scripts/cargar-centros-costo.mjs`

Script one-shot, re-ejecutable, al estilo de `scripts/verificar-config.mjs`
(`node --env-file=.env.local`). Pasos:

1. Lee `CENTROS DE COSTO 2026.xls`, hoja `CCOST - AREA - LOCALES etc`.
2. Forward-fill de centro de costo y área (vienen como celdas combinadas: el
   código solo aparece en la primera fila de su bloque).
3. Descarta filas sin `ubicacion_codigo` (clientes claves) y las `T9505`.
4. Escribe la pestaña `CentrosCosto` (encabezados + 56 filas) vía la service
   account (ya tiene scope de escritura sobre la planilla).

Dependencia: `xlsx` como **devDependency** (solo para este script; no entra al
bundle de la app). Para refrescar el catálogo, se reemplaza el `.xls` y se
vuelve a correr.

### 2. Lógica en cascada — `src/lib/centros-costo.ts` (puro, testeable)

```ts
interface CentroCostoEntry {
  ccCodigo: string; ccDetalle: string;
  areaCodigo: string; areaDetalle: string;
  ubicacionCodigo: string; ubicacionDetalle: string;
}

centrosCosto(entries): { codigo, detalle }[]              // distintos CC
areasDe(entries, ccCodigo): { codigo, detalle }[]         // áreas de un CC
ubicacionesDe(entries, ccCodigo, areaCodigo): { codigo, detalle }[]
esCombinacionValida(entries, cc, area, ub): boolean       // validación servidor
resolverDetalles(entries, cc, area, ub): {...} | null     // códigos → detalles
```

### 3. Acceso a Sheets — `src/lib/sheets.ts`

- `listarCentrosCosto(): Promise<CentroCostoEntry[]>` lee `CentrosCosto!A2:F`.
- Extender `GASTOS_HEADERS`, `gastoToRow`, `rowToGasto`, y los rangos de
  `listGastos` y `appendGasto` de `A2:Q` a `A2:W`.

### 4. API

- `GET /api/centros-costo` (autenticada con el patrón existente
  `getBearerToken` + `autenticar`): devuelve el catálogo completo. El cliente lo
  pide una vez y arma los menús en cascada en memoria.
- `POST /api/gastos`: además de los campos actuales recibe los **3 códigos**
  (`centroCostoCodigo`, `areaCodigo`, `ubicacionCodigo`). El servidor:
  1. Lee el catálogo.
  2. Valida la combinación con `esCombinacionValida`. Si no existe → `400`.
  3. Resuelve los detalles desde el catálogo (no confía en nombres del cliente)
     y los adjunta al `Gasto`.

### 5. Tipos — `src/lib/types.ts`

`Gasto` gana un objeto `imputacion`:

```ts
imputacion: {
  centroCostoCodigo: string; centroCostoDetalle: string;
  areaCodigo: string;        areaDetalle: string;
  ubicacionCodigo: string;   ubicacionDetalle: string;
}
```

(Se aplana a las columnas R–W en `gastoToRow` / `rowToGasto`.)

### 6. UI — `src/components/chat/TarjetaConfirmacion.tsx`

- Al montar (o vía prop desde `page.tsx`) obtiene el catálogo con
  `obtenerCentrosCosto()` (nuevo en `api-client.ts`).
- Tres `<select>` en cascada:
  - Centro de costo: opciones = `centrosCosto(catalogo)`.
  - Área: opciones = `areasDe(catalogo, ccElegido)`; se limpia si cambia el CC.
  - Ubicación: opciones = `ubicacionesDe(catalogo, ccElegido, areaElegida)`; se
    limpia si cambia el área.
- El botón **Confirmar** queda deshabilitado hasta que los tres estén elegidos.
- `crearGasto` (factory) y `GuardarGastoInput` (api-client) incorporan los 3
  códigos.

## Flujo de datos (registrar un gasto)

```
Usuario sube boleta / escribe texto
        │  (extracción OCR con Haiku, sin cambios)
        ▼
Borrador de gasto completo
        ▼
TarjetaConfirmacion
  ├─ muestra datos extraídos (editables, como hoy)
  └─ 3 selects en cascada (CC → Área → Ubicación) ── catálogo desde /api/centros-costo
        │  (Confirmar habilitado solo con los 3 elegidos)
        ▼
POST /api/gastos { ...datos, centroCostoCodigo, areaCodigo, ubicacionCodigo }
        ├─ valida combinación contra el catálogo (400 si inválida)
        ├─ resuelve detalles desde el catálogo
        ▼
appendGasto → fila en pestaña Gastos (con columnas R–W)
```

## Manejo de errores

- Combinación inválida en el POST → `400` con mensaje claro.
- Catálogo no disponible (falla Sheets) → la tarjeta muestra un aviso y no
  permite confirmar; el `POST` responde `502` como las demás rutas.
- Gastos históricos sin imputación: se leen con campos `""`, no rompen el
  dashboard ni el listado.

## Pruebas

- **Unit (vitest):** `centros-costo.ts` — `centrosCosto`, `areasDe`,
  `ubicacionesDe`, `esCombinacionValida`, `resolverDetalles` (incluye
  combinaciones inválidas y filtrado correcto).
- **Unit:** round-trip `gastoToRow` / `rowToGasto` con las 6 columnas nuevas
  (incluyendo gasto histórico con celdas vacías).
- **Manual:** script de carga (verifica 56 filas en la pestaña) y flujo de UI
  end-to-end (cascada + guardado).

## Fuera de alcance

- 4º nivel "clientes claves".
- Columna `activo` para ocultar combinaciones sin recargar (se eligió excluir
  las rojas directamente; se puede agregar después si se necesita togglear).
- Cortes/filtros por centro de costo en el dashboard (los datos quedan
  guardados; se puede sumar como vista posterior).

## Notas de implementación

- La pestaña `Areas` existente (área de trabajo del perfil) **no se toca** ni se
  renombra; es un concepto distinto del "Área" de esta jerarquía.
- Mantener el patrón de las rutas autenticadas (`getBearerToken` + `autenticar`)
  y el estilo de los scripts (`node --env-file=.env.local`).
