# Rendición/Devolución, campos tributarios y reporte PDF — Diseño

Fecha: 2026-06-17

## Objetivo

Extender la app de rendición de gastos para que:

1. La foto rellene la mayor cantidad de información posible alineada con las
   columnas del documento de rendición de referencia, agregando los campos que
   faltan: **tipo de documento** (Boleta/Factura) y **desglose Neto/IVA**.
2. Cada gasto se clasifique **al inicio** como **Rendición** (solo justificación
   de gastos) o **Devolución** (exige una cuenta corriente para reembolsar el
   dinero al usuario).
3. Cada usuario vea su propio dashboard filtrado por un **rango de fechas
   desde/hasta** y pueda **descargar un PDF** con el formato del documento de
   referencia para enviarlo manualmente al departamento de finanzas.

## Decisiones tomadas (brainstorming)

- "Devolución vs Rendición" es un **atributo de cada gasto** (no un contenedor
  que agrupa). El PDF agrupa los gastos por rango de fechas.
- Campos nuevos: **tipo de documento** y **monto neto + IVA**. *No* se agregan
  columnas de Cuenta Contable ni de Descripción de ítem dedicada (la
  observación cumple el rol de descripción en el PDF).
- IVA: **auto-calculado al 19% solo en Facturas**; en Boletas queda lo que venga
  del documento o lo que ingrese el usuario.
- La **cuenta corriente vive en el perfil del usuario**; se exige al marcar un
  gasto como Devolución si falta.
- PDF generado en el **servidor con `@react-pdf/renderer`** (horizontal).
- Envío a finanzas: **solo descarga** (el usuario adjunta y envía manualmente).
  No se agrega infraestructura de correo.
- Rango de fechas **desde/hasta** que alimenta tanto el dashboard como el PDF.

## Arquitectura actual (contexto)

- Next.js 16 App Router + React 19 + Tailwind 4, desplegado en Vercel.
- Persistencia en Google Sheets (pestañas `Gastos`, `Usuarios`, `Areas`,
  `CentrosCosto`) vía service account (`src/lib/sheets.ts`).
- Auth Firebase + verificación server-side (`src/lib/auth-server.ts`), roles
  `Administrador` / `Usuario`.
- Extracción OCR con Claude Haiku y `output_config.format` JSON schema
  (`src/lib/claude.ts`, `src/lib/extraccion.ts`).
- Imágenes en Google Drive. Chat con tarjeta de confirmación de imputación en
  cascada (`src/components/chat/TarjetaConfirmacion.tsx`).
- Dashboard con recharts, filtro por mes, visibilidad por rol
  (`src/app/dashboard/page.tsx`, `src/lib/dashboard.ts`,
  `src/lib/gastos-rol.ts`).
- El formulario de perfil es el `Onboarding` (`src/components/chat/Onboarding.tsx`);
  no existe una página de edición de perfil separada.

## Modelo de datos

### `Gasto` (`src/lib/types.ts`)

Se agregan 4 campos. En Sheets se ubican **al final** de las columnas para no
desplazar datos existentes.

```ts
export type TipoRendicion = "Rendicion" | "Devolucion";
export type TipoDocumento = "Boleta" | "Factura" | "Otro";

interface Gasto {
  // ...campos actuales...
  monto: number;          // sigue siendo el TOTAL (CLP entero)
  tipoRendicion: TipoRendicion; // default "Rendicion"
  tipoDocumento: TipoDocumento;
  montoNeto: number;      // CLP entero; 0 si no aplica
  iva: number;            // CLP entero; 0 si no aplica
}
```

### `Usuario` (`src/lib/types.ts`)

```ts
interface Usuario {
  // ...campos actuales...
  banco: string;            // p. ej. "Banco Santander"; "" si no tiene
  cuentaCorriente: string;  // número de cuenta; "" si no tiene
}
```

## Google Sheets (migración aditiva)

- **`Gastos`**: 4 columnas nuevas al final → `tipo_rendicion`, `tipo_documento`,
  `monto_neto`, `iva`. El rango de lectura/escritura pasa de `A2:W` a `A2:AA`.
  Las filas existentes quedan con esas celdas vacías; `rowToGasto` ya tolera
  celdas faltantes (`cell()` devuelve `""`) y las default-ea
  (`tipo_rendicion` vacío → `"Rendicion"`, `tipo_documento` vacío → `"Otro"`,
  `monto_neto`/`iva` vacíos → `0`).
- **`Usuarios`**: 2 columnas nuevas al final → `banco`, `cuenta_corriente`. El
  rango pasa de `A:G` a `A:I`. Se ajustan `usuarioRowToUsuario`, `getUsuario` y
  `actualizarPerfilUsuario` (que reconstruye la fila completa preservando
  rol/activo/fecha_alta).
- **Encabezados**: hay que agregar los nuevos encabezados en la fila 1 de cada
  pestaña. Se hace una vez, manualmente o con un mini-script en `scripts/`
  análogo a `cargar-centros-costo.mjs`.

Se actualizan `GASTOS_HEADERS`, `gastoToRow`, `rowToGasto`, `listGastos`,
`appendGasto` en `src/lib/sheets.ts`.

## Extracción con foto (`src/lib/claude.ts`, `src/lib/extraccion.ts`)

- `ExtraccionGasto` y el JSON schema suman `tipoDocumento`, `montoNeto`, `iva`
  (todos nullable).
- El system prompt instruye a leer de la boleta/factura: el **Total**, el
  **Neto** y el **IVA** si aparecen, y el **tipo** (Boleta/Factura). Mantiene la
  regla de devolver `null` si no aparece y nunca inventar.
- `normalizarTipoDocumento(valor)` mapea texto libre a `TipoDocumento` o `null`.
- `tipoRendicion` **no** se extrae de la imagen: lo elige el usuario.

### Nuevo módulo `src/lib/montos.ts` (puro, con tests)

```ts
calcularNetoIva(
  total: number,
  tipoDocumento: TipoDocumento,
  leido: { neto: number | null; iva: number | null },
): { neto: number; iva: number }
```

Regla:
- Si `neto` e `iva` vienen del documento, se respetan.
- Si es **Factura** y faltan, calcula `neto = round(total / 1.19)`,
  `iva = total - neto`.
- En **Boleta**/**Otro**, si faltan, `neto = 0`, `iva = 0`.

Se usa para prellenar la tarjeta de confirmación y como **fuente de verdad en el
backend** (no se confía ciegamente en lo que envíe el cliente).

## Tarjeta de confirmación (`src/components/chat/TarjetaConfirmacion.tsx`)

- **Primer control (arriba del todo):** selector **Rendición / Devolución**
  (default Rendición).
- Selector **Tipo de documento** (Boleta/Factura/Otro).
- Campos **Neto** e **IVA**, prellenados con `calcularNetoIva` y editables. Al
  cambiar Total o Tipo de documento se recalculan (salvo edición manual).
- Si el usuario marca **Devolución** y su perfil **no tiene cuenta corriente**,
  la tarjeta despliega inline los campos **Banco** y **N° de cuenta**; el botón
  de confirmar queda deshabilitado hasta completarlos. Al confirmar, esos datos
  se guardan en el perfil del usuario (vía `POST /api/perfil` o un campo en el
  payload de `POST /api/gastos`; ver API). Esto evita crear una página de
  edición de perfil separada.

`GuardarGastoInput` (en `src/lib/api-client.ts`) suma `tipoRendicion`,
`tipoDocumento`, `montoNeto`, `iva`, y opcionalmente `banco`/`cuentaCorriente`
cuando se completan inline.

## API

### `POST /api/gastos` (`src/app/api/gastos/route.ts`)
- Acepta `tipoRendicion`, `tipoDocumento`, `montoNeto`, `iva`.
- Valida `tipoRendicion` ∈ {Rendicion, Devolucion}; `tipoDocumento` ∈
  {Boleta, Factura, Otro} (default Boleta si falta).
- Si `tipoRendicion === "Devolucion"`: exige cuenta corriente. Si el usuario no
  la tiene en su perfil y no viene en el payload, responde 400. Si viene en el
  payload, la persiste en el perfil antes de guardar el gasto.
- Recalcula `montoNeto`/`iva` con `montos.ts` como fuente de verdad.
- `crearGasto` (`src/lib/gasto-factory.ts`) y `NuevoGastoInput` suman los campos
  nuevos.

### `POST /api/perfil` y `Onboarding`
- Aceptan `banco` y `cuentaCorriente` (opcionales en el alta inicial).
- `actualizarPerfilUsuario` persiste los dos campos nuevos.

## Dashboard (`src/app/dashboard/page.tsx`, `src/lib/dashboard.ts`)

- Se reemplaza el selector de mes por un **rango desde/hasta** (dos `input
  type="date"`). Nueva función pura `filtrarPorRango(gastos, desde, hasta)` en
  `dashboard.ts` (inclusiva en ambos extremos, sobre `fechaDocumento`).
- Nueva tarjeta de resumen: **total Devoluciones vs total Rendiciones** del
  rango (función `porTipoRendicion(gastos)`), para ver cuánto debe reembolsarse.
- Botón **"Descargar reporte PDF"** que llama a `GET /api/reporte?desde=&hasta=`
  con el rango activo y dispara la descarga.
- Cada usuario ve solo sus gastos (ya se filtra por rol con
  `filtrarGastosPorRol`).

## Reporte PDF

- Dependencia nueva: **`@react-pdf/renderer`** (JS puro, compatible con el
  runtime Node de Vercel; render con `renderToBuffer`).
- `src/lib/reporte.ts` (puro, con tests): a partir de un `Usuario`, una lista de
  `Gasto` y el rango, arma un `ModeloReporte`:
  - Cabecera: Rendición de (nombre), RUT, C. Corriente (banco + número), Correo,
    Fecha rendición (hoy), rango del período.
  - Filas: Fecha compra, Proveedor (comercio), C. Costo, Área, Ubicación, Tipo
    documento, N° documento, Descripción (observación), Neto, IVA, Total, Tipo
    rendición.
  - Totales: suma de Neto, IVA y Total, **más subtotales separados de Devolución
    y Rendición**.
- `src/lib/reporte-pdf.tsx`: define el `<Document>` horizontal (landscape) con la
  cabecera y la tabla, en estilo del documento de referencia.
- `GET /api/reporte?desde=&hasta=` (`src/app/api/reporte/route.ts`): autentica,
  lee el usuario y sus gastos (filtrados por rol), aplica `filtrarPorRango`,
  arma el modelo, renderiza el PDF y lo devuelve con
  `Content-Type: application/pdf` y `Content-Disposition: attachment`.

## Tests (vitest, siguiendo el patrón `*.test.ts` existente)

- `montos.test.ts`: cálculo Neto/IVA para Factura (auto), Boleta (respeta/0), y
  cuando vienen valores del documento.
- `reporte.test.ts`: armado de cabecera, filas y subtotales por tipo.
- `dashboard.test.ts`: `filtrarPorRango` (límites inclusivos) y
  `porTipoRendicion`.
- `sheets.test.ts`: round-trip `gastoToRow`/`rowToGasto` con las 4 columnas
  nuevas y filas viejas (cortas) que defaultean.
- `extraccion.test.ts`: `normalizarTipoDocumento`.

## Fuera de alcance

- Columna Cuenta Contable y campo Descripción de ítem dedicado (se descartaron;
  la observación cumple de descripción en el PDF).
- Envío automático de correo a finanzas (solo descarga del PDF).
- Página de edición de perfil completa (la cuenta corriente se completa en el
  onboarding o inline en la tarjeta al hacer una devolución).

## Plan de implementación sugerido (fases)

1. Modelo de datos + Sheets (types, sheets, encabezados, factory).
2. Extracción (tipo doc, neto, iva) + `montos.ts`.
3. Tarjeta de confirmación + perfil/cuenta corriente + validación en API gastos.
4. Dashboard con rango desde/hasta + resumen por tipo.
5. Reporte PDF (modelo, documento, ruta, botón de descarga).
