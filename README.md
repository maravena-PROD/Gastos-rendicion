# Rendición de Gastos — Bot Inteligente

Aplicación web responsive (mobile-first) para registrar gastos corporativos mediante un bot
conversacional, usando **texto** o **foto de boleta** (OCR con visión de Claude). Los datos se
guardan en **Google Sheets** y las imágenes en **Google Drive**.

## Funcionalidad (v1)

- 🤖 **Bot conversacional**: registra gastos por texto, pide los datos que falten, valida y confirma.
- 📷 **OCR de boletas**: la foto va directo a Claude (visión), que extrae monto, comercio, fecha, RUT
  y número de documento — sin motor de OCR aparte.
- 🔐 **Login con roles**: Firebase Auth (Google, restringido a `@bosca.cl`); Administrador vs Usuario.
- 📊 **Dashboard**: total por período, gráfico por categoría (dona) y tendencia por día; vista global
  para administradores.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Firebase Auth · Google Sheets/Drive
(`googleapis`) · Claude (`@anthropic-ai/sdk`, modelo `claude-opus-4-8`) · Recharts · Vitest.

## Arquitectura

```
Navegador (chat + dashboard)  ──HTTPS──►  Rutas API (Next.js, Node)
  React · Tailwind                          /api/chat-extraer/upload/gastos/me
                                            (cada una valida sesión + rol)
                                                 │
                  ┌──────────────┬───────────────┼───────────────┐
               Claude API     Google Sheets   Google Drive    Firebase Auth
              (bot + OCR)      (base datos)    (imágenes)      (identidad)
```

La lógica externa vive en `src/lib/` como módulos aislados y testeables; las rutas en
`src/app/api/`; la UI en `src/app/` y `src/components/`. Diseño detallado en
[`docs/superpowers/specs/`](docs/superpowers/specs/) y los planes de implementación en
[`docs/superpowers/plans/`](docs/superpowers/plans/).

## Quick start (desarrollo)

```bash
npm install
npm test            # toda la suite (no requiere credenciales — APIs externas mockeadas)
cp .env.local.example .env.local   # luego edita con tus credenciales (ver Manual de Instalación)
npm run dev         # http://localhost:3000
```

Para correr de verdad (login, OCR, guardado) necesitas configurar Google Cloud, Firebase y la API
key de Anthropic. **Sigue el [Manual de Instalación](docs/MANUAL-INSTALACION.md) paso a paso.**

## Documentación

- 📦 **[Manual de Instalación](docs/MANUAL-INSTALACION.md)** — configurar Google, Firebase, Anthropic
  y el `.env.local` desde cero, y desplegar.
- 👤 **[Manual de Usuario](docs/MANUAL-USUARIO.md)** — cómo registrar y consultar gastos.
- 🏗️ **[Diseño](docs/superpowers/specs/)** y **[Planes](docs/superpowers/plans/)** — arquitectura,
  modelo de datos y plan de implementación por hitos.

## Estructura del código

| Carpeta | Contenido |
|---|---|
| `src/lib/` | Servicios y lógica: `types`, `format` (CLP/RUT), `sheets`, `drive`, `claude`, `auth`, `extraccion`, `dashboard`, `api-client`, … (cada uno con sus tests) |
| `src/app/api/` | Rutas protegidas: `me`, `extraer`, `upload`, `gastos` |
| `src/app/` | Páginas: chat (`page.tsx`), `login`, `dashboard` |
| `src/components/` | UI: `AuthGate`, `chat/*`, `dashboard/*` |

## Pruebas

```bash
npm test          # una vez
npm run test:watch
```

Las APIs externas (Google, Claude, Firebase Admin) están mockeadas, así que la suite corre sin
credenciales. La verificación funcional en vivo se documenta al final de cada plan y en el Manual de
Instalación.

## Despliegue

Producción en **Vercel** (`bosca-gastos.vercel.app`). El repositorio está conectado a Vercel:
cada `push` a `master` despliega automáticamente a producción; las demás ramas generan
*preview deployments*.

## Roadmap (fuera de v1)

- Registro por **voz** (audio → texto).
- Flujo de **aprobación** de gastos por administrador (el campo `estado` ya existe en el esquema).
- Migración de Sheets a **Firestore** si crece el volumen (aislada en `src/lib/sheets.ts`).
- Integración con **ERP / sistemas contables**.
