# Manual de Instalación — App de Rendición de Gastos

Esta guía te lleva paso a paso desde cero hasta tener la aplicación funcionando: crear los
proyectos de Google y Firebase, configurar las credenciales, armar la planilla, y levantar la app
en local y en producción.

> **Tiempo estimado:** 45–60 minutos la primera vez.
> **Conocimiento previo:** ninguno técnico avanzado, pero hay que seguir los pasos con cuidado.

---

## 0. Resumen de lo que vas a configurar

La app usa cuatro servicios externos. Vas a necesitar credenciales de cada uno:

| Servicio | Para qué | Qué obtienes |
|---|---|---|
| **Google Cloud** (Sheets + Drive API) | Base de datos y almacén de imágenes | Una *service account* (correo + clave privada) |
| **Google Sheets** | La planilla donde se guardan los gastos | El ID de la planilla |
| **Google Drive** | Carpeta donde se guardan las fotos de boletas | El ID de la carpeta |
| **Firebase** | Login con Google (identidad de usuarios) | Config web + project ID |
| **Anthropic (Claude)** | El cerebro del bot / OCR | Una API key |

Todas estas se juntan en un archivo `.env.local` al final (sección 8).

---

## 1. Requisitos previos

- **Node.js 20 o superior.** Verifica con: `node --version`. Si no lo tienes, descárgalo de
  [nodejs.org](https://nodejs.org).
- Una cuenta de Google (en esta guía usamos `maravena@bosca.cl`).
- El código del proyecto en tu computador.

Desde la carpeta del proyecto, instala las dependencias:

```bash
npm install
```

Para confirmar que todo está sano antes de configurar nada, corre las pruebas (no requieren
credenciales — usan datos simulados):

```bash
npm test
```

Deberías ver todas las pruebas en verde.

---

## 2. Crear el proyecto de Google Cloud y habilitar las APIs

1. Entra a [Google Cloud Console](https://console.cloud.google.com) con tu cuenta.
2. Arriba, en el selector de proyectos, crea un proyecto nuevo (ej. **rendicion-gastos-bosca**).
   Anota el **ID del proyecto** (algo como `rendicion-gastos-bosca`); lo usarás en Firebase.
3. En el buscador de la consola, busca y **habilita** estas dos APIs (botón "Habilitar"):
   - **Google Sheets API**
   - **Google Drive API**

---

## 3. Crear la *service account* (la "cuenta de robot")

La service account es la identidad con la que el servidor lee/escribe en Sheets y Drive. **Nunca**
toca el navegador.

1. En Google Cloud Console: **IAM y administración → Cuentas de servicio → Crear cuenta de servicio**.
2. Nombre: `rendicion-gastos-sa` (o el que prefieras). Crea.
3. No es necesario asignarle roles de IAM (el acceso se da compartiendo la planilla/carpeta, más
   adelante). Termina.
4. Entra a la cuenta recién creada → pestaña **Claves → Agregar clave → Crear clave nueva → JSON**.
   Se descargará un archivo `.json`. **Guárdalo en un lugar seguro y NO lo subas a git.**

Abre ese JSON con un editor de texto. Vas a necesitar dos campos:

- `client_email` → será `GOOGLE_SERVICE_ACCOUNT_EMAIL` (algo como
  `rendicion-gastos-sa@tu-proyecto.iam.gserviceaccount.com`).
- `private_key` → será `GOOGLE_PRIVATE_KEY` (un texto largo que empieza con
  `-----BEGIN PRIVATE KEY-----`).

---

## 4. Crear la planilla de Google Sheets

1. Crea una planilla nueva en [Google Sheets](https://sheets.google.com). Ponle un nombre
   (ej. **Rendición de Gastos – BD**).
2. El **ID de la planilla** está en su URL:
   `https://docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`. Será `GOOGLE_SHEETS_ID`.

### 4.1 Crear la pestaña `Gastos`

Renombra la primera hoja a exactamente **`Gastos`** (respeta mayúscula inicial). En la **fila 1**,
escribe estos encabezados, **uno por columna, en este orden exacto** (de la columna A a la P):

```
id | fecha_registro | usuario_email | usuario_nombre | fecha_documento | comercio | rut_emisor | numero_documento | categoria | monto | direccion | observacion | imagen_url | imagen_drive_id | estado | fecha_creacion
```

> El orden importa: la app escribe y lee las columnas por posición. Deja la fila 1 con los
> encabezados; los datos empiezan en la fila 2 (la app los inserta solos).

### 4.2 Crear la pestaña `Usuarios`

Agrega una segunda hoja llamada exactamente **`Usuarios`**. En la **fila 1**, estos encabezados
(columnas A a E):

```
email | nombre | rol | activo | fecha_alta
```

En la **fila 2**, agrega tu usuario administrador. Ejemplo:

```
maravena@bosca.cl | M. Aravena | Administrador | TRUE | 2026-06-12
```

Reglas:
- **`rol`**: escribe exactamente `Administrador` o `Usuario`.
- **`activo`**: escribe `TRUE` para habilitar al usuario (cualquier otra cosa lo deja sin acceso).
- Agrega una fila por cada persona que podrá usar la app. **Si un email no está aquí con
  `activo=TRUE`, no podrá entrar**, aunque tenga cuenta de Google del dominio.

### 4.3 Compartir la planilla con la service account

Pulsa **Compartir** (arriba a la derecha) y agrega el correo de la service account
(`GOOGLE_SERVICE_ACCOUNT_EMAIL`, el `client_email` del JSON) con permiso de **Editor**. Esto es lo
que le da acceso a leer y escribir.

---

## 5. Crear la carpeta de Google Drive

1. En [Google Drive](https://drive.google.com), crea una carpeta (ej. **Boletas – Rendición**).
2. El **ID de la carpeta** está en su URL al abrirla:
   `https://drive.google.com/drive/folders/`**`ESTE_ES_EL_ID`**. Será `GOOGLE_DRIVE_FOLDER_ID`.
3. **Compártela** con el correo de la service account como **Editor** (igual que la planilla).

> ⚠️ **Nota de privacidad:** cada imagen que se sube queda con acceso de lectura "cualquiera con el
> link". El link no es adivinable, pero no está protegido por sesión. Si una URL se filtra, esa
> boleta queda visible. Es una decisión de diseño para que la imagen se pueda ver desde la app/planilla.

---

## 6. Crear el proyecto de Firebase (login)

1. Entra a [Firebase Console](https://console.firebase.google.com) → **Agregar proyecto**.
   **Importante:** elige **usar el mismo proyecto de Google Cloud** que creaste en el paso 2 (así la
   service account sirve también para verificar los tokens de login). Cuando pregunte, selecciona el
   proyecto existente.
2. En **Compilación → Authentication → Comenzar**, habilita el proveedor **Google** (Sign-in method →
   Google → Habilitar → guarda).
3. En **Authentication → Settings → Authorized domains**, asegúrate de que estén `localhost` (para
   pruebas) y el dominio donde lo vayas a desplegar.
4. En **Configuración del proyecto (⚙) → General → Tus apps**, crea una **app web** (icono `</>`).
   Firebase te mostrará un objeto de configuración. De ahí saca:
   - `apiKey` → `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `authDomain` → `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` (ej. `tu-proyecto.firebaseapp.com`)
   - `projectId` → `NEXT_PUBLIC_FIREBASE_PROJECT_ID` **y también** `FIREBASE_PROJECT_ID`

> **Sobre el dominio `@bosca.cl`:** la app solo deja entrar correos `@bosca.cl` (validado en el
> servidor) **y** que estén en la pestaña `Usuarios`. Si tu dominio corporativo es otro, cambia la
> constante `DOMINIO_PERMITIDO` en `src/lib/auth.ts`.

---

## 7. Obtener la API key de Anthropic (Claude)

1. Entra a [console.anthropic.com](https://console.anthropic.com), crea una cuenta o inicia sesión.
2. Asegúrate de tener **crédito/facturación** configurada (el OCR y el bot consumen tokens; el costo
   a baja escala es de centavos de dólar por gasto).
3. Ve a **API Keys → Create Key**. Cópiala (empieza con `sk-ant-...`). Será `ANTHROPIC_API_KEY`.

> La app usa el modelo `claude-opus-4-8` con visión para leer las boletas.

---

## 8. Armar el archivo `.env.local`

En la raíz del proyecto hay un archivo de ejemplo: `.env.local.example`. Cópialo a `.env.local`:

```bash
cp .env.local.example .env.local
```

(En Windows PowerShell: `Copy-Item .env.local.example .env.local`)

Edita `.env.local` y reemplaza cada valor con los que conseguiste:

```
# De la service account (JSON del paso 3)
GOOGLE_SERVICE_ACCOUNT_EMAIL=rendicion-gastos-sa@tu-proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...muchas líneas...\n-----END PRIVATE KEY-----\n"

# Del paso 4
GOOGLE_SHEETS_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz

# Del paso 7
ANTHROPIC_API_KEY=sk-ant-...

# Del paso 6 (config web de Firebase)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
FIREBASE_PROJECT_ID=tu-proyecto

# Del paso 5
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
```

### Cómo poner la `GOOGLE_PRIVATE_KEY` correctamente

En el JSON, la clave aparece con saltos de línea reales. En `.env.local` debe ir **toda en una
línea, entre comillas dobles, con los saltos escritos como `\n`**. Si copias el campo `private_key`
tal cual del JSON (ya viene con `\n` escapados), pégalo entre comillas. Debe quedar así:

```
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvg...\n...\n-----END PRIVATE KEY-----\n"
```

> `.env.local` **nunca** se sube a git (ya está en `.gitignore`). Contiene secretos.

---

## 9. Correr la app en local

```bash
npm run dev
```

Abre `http://localhost:3000`. Deberías ser redirigido a `/login`. Inicia sesión con tu cuenta
`@bosca.cl` (la que agregaste a la pestaña `Usuarios`). Si todo está bien, verás el chat con
"Hola \<tu nombre\>".

Prueba rápida:
1. Escribe: `combustible 45000 en Copec`. El bot debería pedirte la fecha (porque falta).
2. Responde la fecha (ej. `2026-06-10`). Aparece la tarjeta de confirmación.
3. Confirma. Debería decir "✅ Registro completado" y aparecer una fila nueva en la pestaña `Gastos`.
4. Abre **Dashboard** (arriba) para ver el total y los gráficos.

---

## 10. Desplegar a producción

> **Importante (corrección al diseño original):** esta app es Next.js con **rutas de servidor**
> (`/api/...`), así que necesita un entorno que ejecute Node, no solo hosting estático. **Firebase
> Hosting clásico (estático) no alcanza por sí solo.** Dos opciones recomendadas:

### Opción A — Vercel (la más simple para Next.js)

1. Sube el repo a GitHub.
2. En [vercel.com](https://vercel.com), importa el repo.
3. En **Settings → Environment Variables**, agrega **todas** las variables de `.env.local` (las
   `NEXT_PUBLIC_*` y las del servidor). Vercel las inyecta en el build y el runtime.
4. Despliega. Vercel te da una URL; agrégala a los **Authorized domains** de Firebase Auth (paso 6.3).

### Opción B — Firebase App Hosting (nativo de Google, ejecuta Next.js SSR)

Es el producto de Firebase que sí corre apps Next.js con servidor (distinto del Hosting clásico).
Sigue la guía de **Firebase App Hosting**, conecta el repo y carga las mismas variables de entorno.
Agrega el dominio resultante a los Authorized domains.

En cualquier caso, antes de desplegar puedes validar el build local:

```bash
npm run build
npm start
```

---

## 11. Solución de problemas comunes

| Síntoma | Causa probable / solución |
|---|---|
| Al entrar dice "Usuario no registrado o inactivo" | Tu email no está en la pestaña `Usuarios` o `activo` no es `TRUE`. Revísalo. |
| "Dominio de correo no autorizado" | Iniciaste sesión con un correo que no es `@bosca.cl`. Usa el corporativo (o cambia `DOMINIO_PERMITIDO` en `src/lib/auth.ts`). |
| El login no abre / error de dominio | Falta agregar `localhost` (o tu dominio de producción) en **Authorized domains** de Firebase Auth. |
| Error al guardar el gasto / leer gastos | La planilla no está compartida con la service account como Editor, o el `GOOGLE_SHEETS_ID` está mal, o los nombres de pestaña no son exactamente `Gastos`/`Usuarios`. |
| "No se pudo subir la imagen" | La carpeta de Drive no está compartida con la service account, o `GOOGLE_DRIVE_FOLDER_ID` está mal. |
| "No se pudo procesar con el asistente" | Falta `ANTHROPIC_API_KEY`, está mal, o la cuenta de Anthropic no tiene crédito. |
| Error de clave privada / autenticación de Google | La `GOOGLE_PRIVATE_KEY` no quedó bien pegada: debe ir entre comillas y con los `\n` literales. |
| Las APIs de Google fallan con permiso | No habilitaste **Google Sheets API** y **Google Drive API** en el proyecto (paso 2). |

Si algo falla, revisa la consola del navegador (F12) y la terminal donde corre `npm run dev` para
ver el mensaje de error específico.
