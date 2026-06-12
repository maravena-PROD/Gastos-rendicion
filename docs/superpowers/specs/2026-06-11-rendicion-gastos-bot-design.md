# Diseño — App de Rendición de Gastos con Bot Inteligente

**Fecha:** 2026-06-11
**Autor:** M. Aravena (maravena@bosca.cl) + Claude
**Estado:** Diseño aprobado por secciones, pendiente revisión final del documento

---

## Contexto y objetivo

Aplicación web responsive (mobile-first) para que empleados de Bosca registren gastos
corporativos de forma rápida mediante un bot conversacional, usando **texto** o **foto de
boleta/factura**. La información se almacena en **Google Sheets** (base de datos) y las
imágenes en **Google Drive**.

### Decisiones de alcance tomadas en brainstorming

- **Uso:** productivo real (no prototipo).
- **Escala v1:** equipo pequeño (~5–20 personas, decenas de gastos/semana). Google Sheets
  como base de datos es adecuado a esta escala.
- **Infraestructura Google:** se usa la cuenta `maravena@bosca.cl` para crear el proyecto de
  Google Cloud, habilitar APIs (Sheets, Drive) y generar la service account.
- **Cerebro del bot (LLM):** API de Claude, modelo `claude-opus-4-8`.
- **OCR:** **visión nativa de Claude** (la foto va directo a Claude, que lee + extrae +
  clasifica en una sola llamada). **No se usa Google Vision API** — se elimina esa
  dependencia y su costo.

### Alcance v1 (lo que se construye)

1. Registro de gasto por **texto** (lenguaje natural → extracción de campos).
2. Registro de gasto por **foto** (OCR de visión → extracción de campos).
3. **Login multiusuario con roles** (Administrador / Usuario).
4. **Dashboard** con gráficos.

### Fuera de v1 (explícito)

- Registro por **voz** → v2.
- Flujo de **aprobación** admin (aprobar/rechazar) → v2 (el campo `estado` ya queda en el esquema).
- Migración a **Firestore** → solo si el volumen crece; cambio aislado en `sheets.ts`.
- Integración ERP/contable → habilitada por el diseño modular, no construida.

---

## Sección 1 — Arquitectura y stack

**Stack:** Next.js full-stack (React + Next.js + Tailwind CSS para el front; API Routes de
Next.js como backend en Node.js). Se descarta Express separado por redundante. Firebase Auth
para identidad, Firebase Hosting para despliegue.

```
NAVEGADOR (responsive, mobile-first)
  - Chat conversacional   - Captura/subida de foto
  - Dashboard con gráficos - Login
  React + Next.js + Tailwind CSS
        │ HTTPS
BACKEND (Next.js API Routes — Node.js)
  /api/chat    → orquesta el bot (Claude Opus 4.8)
  /api/ocr     → foto → Claude visión → datos estructurados
  /api/gastos  → CRUD, lee/escribe en Sheets
  /api/upload  → sube imagen a Google Drive
  /api/auth    → verifica sesión (Firebase Admin)
  (toda llamada valida sesión + rol antes de actuar)
        │
  ┌─────┴───────┬──────────────┬───────────────┐
Claude API   Google Sheets  Google Drive   Firebase Auth
(opus-4-8)   (base datos)   (imágenes)     (identidad)
```

**Componentes (responsabilidad única):**

| Componente | Qué hace | Depende de |
|---|---|---|
| Cliente web | UI: chat, cámara, dashboard | API del backend |
| Capa de servicios (`/lib`) | Módulos aislados: `claude.ts`, `sheets.ts`, `drive.ts`, `auth.ts` | APIs externas |
| API Routes | Orquestan servicios + validan rol | Capa de servicios |
| Claude | Cerebro del bot + OCR de visión | — |
| Sheets | Base de datos (gastos + usuarios/roles) | — |
| Drive | Almacén de imágenes | — |
| Firebase Auth | Identidad (login Google `@bosca.cl`) | — |

**Puntos de diseño:**

- Roles guardados en Sheets (pestaña `Usuarios`: email → rol). Mantiene "todo en Sheets".
- Service account de Google vive solo en el backend; las claves nunca llegan al navegador.
- Cada módulo de `/lib` es testeable por separado (sin acoplamiento entre servicios).
- Migración futura a Firestore = cambiar solo `sheets.ts`.

---

## Sección 2 — Modelo de datos

Dos pestañas en una misma planilla de Google Sheets.

### Pestaña `Gastos`

| Columna | Tipo | Ejemplo | Notas |
|---|---|---|---|
| `id` | texto (UUID) | `g_a1b2c3` | Generado por el backend, único |
| `fecha_registro` | ISO 8601 | `2026-06-11T14:32:00Z` | Cuándo se ingresó al sistema |
| `usuario_email` | texto | `maravena@bosca.cl` | Quién registró (Firebase Auth) |
| `usuario_nombre` | texto | `M. Aravena` | Display name |
| `fecha_documento` | fecha | `2026-06-10` | Fecha de la boleta/factura |
| `comercio` | texto | `Copec` | Nombre del comercio |
| `rut_emisor` | texto | `76.123.456-7` | RUT del emisor (si existe) |
| `numero_documento` | texto | `0012345` | N° boleta/factura (si existe) |
| `categoria` | enum | `Combustible` | Una de las 8 categorías |
| `monto` | entero | `45000` | CLP, sin decimales ni puntos |
| `direccion` | texto | `Av. Principal 123` | Dirección (si existe) |
| `observacion` | texto | `Camioneta flota` | Nota libre del usuario |
| `imagen_url` | texto (URL) | `https://drive...` | Link compartido de Drive |
| `imagen_drive_id` | texto | `1AbC...` | ID del archivo en Drive |
| `estado` | enum | `Registrado` | `Registrado` / `Aprobado` / `Rechazado` |
| `fecha_creacion` | ISO 8601 | `2026-06-11T14:32:05Z` | Timestamp técnico de la fila |

**Categorías (enum):** Combustible, Alimentación, Transporte, Peajes, Hospedaje, Materiales,
Servicios, Otros.

**Decisiones clave:**

- `monto` como **entero en CLP** (45000). Los pesos chilenos no usan decimales. El formato
  "$45.000" se aplica solo al mostrar.
- `estado` incluido desde v1 (default `Registrado`) aunque la aprobación sea v2 — el dashboard
  muestra "pendientes" y la migración a v2 no toca el esquema.
- `rut_emisor`, `numero_documento`, `direccion` son opcionales — no bloquean el registro.

### Pestaña `Usuarios`

| Columna | Tipo | Ejemplo | Notas |
|---|---|---|---|
| `email` | texto | `maravena@bosca.cl` | Llave, coincide con Firebase |
| `nombre` | texto | `M. Aravena` | |
| `rol` | enum | `Administrador` | `Administrador` / `Usuario` |
| `activo` | booleano | `TRUE` | Permite desactivar sin borrar |
| `fecha_alta` | ISO 8601 | `2026-06-01T...` | |

**Decisión:** el control de acceso cruza el email de Firebase con esta pestaña. Si el email no
está o `activo=FALSE`, no entra. El admin agrega usuarios editando la pestaña directamente en v1.

---

## Sección 3 — Flujo de usuario

### Flujo 1 — Registro por foto

1. Usuario (logueado) abre la app en móvil.
2. Toca "Nueva boleta" → cámara o galería.
3. Toma/elige foto (JPG/PNG/PDF).
4. La imagen sube a Drive **y** va a Claude (visión) en paralelo.
5. Claude devuelve datos extraídos + categoría sugerida.
6. Bot muestra tarjeta de confirmación (comercio, monto, fecha, RUT, categoría editable,
   observación).
7. Si falta un dato clave (ej. monto), el bot lo **pide** antes de confirmar.
8. Usuario confirma → fila escrita en Sheets → "Registro completado".

### Flujo 2 — Registro por texto

```
Usuario: "combustible $45.000 en Copec"
  → Claude extrae: categoría=Combustible, monto=45000, comercio=Copec
Bot:    "¿Deseas adjuntar la boleta?"
Usuario: "sí" → cámara (Flujo 1 paso 3) | "no" → confirmar → escribe en Sheets
Bot:    "Registro completado"
```

Si la frase está incompleta, el bot pregunta lo que falta **uno a la vez**.

### Flujo 3 — Consulta

```
Usuario: "¿cuánto llevo gastado este mes?"
  → backend lee Sheets, filtra por usuario_email + mes
Bot:    "Llevas $312.000 en 8 gastos este mes. Combustible $180.000 · ..."
```

### Diferencia por rol

| Acción | Usuario | Administrador |
|---|---|---|
| Registrar gasto | propios | sí |
| Ver gastos | solo los suyos | **todos** |
| Dashboard | filtrado a sí mismo | vista global |
| Editar/exportar | no | sí |

**Diseño del bot:** no es un bot de reglas. Cada mensaje (texto o foto) se manda a Claude con
(a) historial corto de la conversación y (b) un *system prompt* que define categorías, formato
chileno (RUT, CLP) y cuándo pedir datos faltantes. Claude decide la respuesta y qué campo falta.

---

## Sección 4 — Diseño UI/UX

Mobile-first; escritorio reusa el layout con más ancho.

**Pantallas:**

- **Chat (home):** burbujas usuario/bot, input de texto + botón cámara siempre visibles abajo,
  menú a Dashboard / Mis gastos / Salir.
- **Tarjeta de confirmación** (dentro del chat): campos editables (comercio, monto, fecha, RUT,
  categoría), botón grande "Confirmar registro" + "Cancelar".
- **Dashboard:** total del mes (número grande), donut por categoría, barras de tendencia, y
  (solo admin) contador de pendientes.

**Principios visuales:**

- Pulgar primero: acciones principales en zona baja, alcanzables con una mano.
- Tarjetas, no formularios largos.
- Colores + íconos por categoría para reconocimiento rápido.
- Paleta sobria/profesional; verde/rojo solo para estados.
- Feedback inmediato (spinner al leer boleta, check al guardar).
- Gráficos con Recharts (donut + barras).

Al construir la UI se usará el skill **frontend-design** para evitar estética genérica de IA.

---

## Sección 5 — Seguridad y manejo de errores

### Seguridad

| Capa | Medida |
|---|---|
| Autenticación | Firebase Auth + Google login, restringido a `@bosca.cl` + cruce con pestaña `Usuarios` (`activo=TRUE`). Sin registro abierto. |
| Autorización por rol | Cada API route verifica token de Firebase y consulta el rol **en el servidor** antes de actuar. Acceso ajeno → 403. |
| Secretos | Service account de Google y API key de Claude solo en variables de entorno del servidor. Nunca en el navegador. |
| Validación de archivos | Solo JPG/PNG/PDF; tamaño máx (10 MB); validación por magic bytes, no extensión. Renombrado con UUID al subir. |
| Protección de subida | Rechazo de ejecutables disfrazados; el backend nunca ejecuta el contenido, solo lo reenvía a Drive y Claude. |
| Auditoría | Cada gasto registra `usuario_email` + `fecha_creacion`. Cambios de estado trazados (v2). |
| Transporte | HTTPS (Firebase Hosting por defecto). |

### Manejo de errores

- **Claude no lee la boleta:** el bot pide los datos a mano, uno a la vez. Nunca inventa montos.
- **Sheets/Drive caído:** el bot avisa "no pude guardar, reintenta" y mantiene los datos en
  pantalla para reintentar.
- **Dato faltante esencial:** el bot **siempre** pregunta antes de guardar.
- **Imagen sube pero el registro falla:** se reintenta el registro; imagen huérfana se limpia
  después (no bloquea al usuario).

---

## Estrategia de pruebas

- **Módulos `/lib` aislados:** `sheets.ts`, `drive.ts`, `claude.ts`, `auth.ts` se prueban por
  separado con mocks de las APIs externas.
- **Extracción de Claude:** pruebas con boletas chilenas de ejemplo, verificando que monto/RUT/
  fecha se parsean correctamente (formato CLP y dígito verificador de RUT).
- **Autorización:** pruebas de que un `Usuario` no puede leer gastos ajenos (espera 403).
- **Validación de archivos:** pruebas de rechazo de archivos no permitidos / disfrazados.

---

## Entregables (mapeo a la solicitud original)

1. Arquitectura — Sección 1.
2. Modelo de datos — Sección 2.
3. Flujo de usuario — Sección 3.
4. Diseño UI/UX — Sección 4.
5. Código fuente modular — `/lib` + `/app` + `/api`.
6. Integración Google Sheets — módulo `sheets.ts`.
7. Integración Google Drive — módulo `drive.ts`.
8. OCR funcional — módulo `claude.ts` (visión).
9. Bot conversacional — `/api/chat` + system prompt.
10. Documentación técnica — `README.md` + comentarios.
11. Manual de instalación — paso a paso (Google Cloud, service account, Firebase, env vars).
12. Manual de usuario — registrar, consultar, (admin) aprobar.
