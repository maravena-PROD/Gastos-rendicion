// Verificador de configuración de la app de Rendición de Gastos.
//
// Comprueba que las variables de entorno estén presentes y que las credenciales
// realmente funcionen contra Google Sheets, Google Drive y la API de Claude.
//
// Uso (Node 20.6+):
//   node --env-file=.env.local scripts/verificar-config.mjs
// o con el atajo:
//   npm run verificar
//
// No modifica nada permanente: para Drive crea un archivo de prueba y lo borra.

import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { Readable } from "stream";

const VERDE = "\x1b[32m";
const ROJO = "\x1b[31m";
const AMARILLO = "\x1b[33m";
const RESET = "\x1b[0m";

const ok = (m) => console.log(`${VERDE}✓${RESET} ${m}`);
const fail = (m) => console.log(`${ROJO}✗${RESET} ${m}`);
const warn = (m) => console.log(`${AMARILLO}!${RESET} ${m}`);

let errores = 0;

// --- 1. Variables de entorno presentes ---
console.log("\n1) Variables de entorno");
const REQUERIDAS = [
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SHEETS_ID",
  "GOOGLE_DRIVE_FOLDER_ID",
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "FIREBASE_PROJECT_ID",
];

const faltantes = REQUERIDAS.filter((v) => !process.env[v] || process.env[v].includes("..."));
if (faltantes.length === 0) {
  ok("Todas las variables están definidas");
} else {
  errores++;
  fail(`Faltan o están sin completar: ${faltantes.join(", ")}`);
  warn("¿Estás corriendo con `npm run verificar` (que carga .env.local)?");
}

// --- 2. Formato de la clave privada ---
console.log("\n2) Clave privada de la service account");
const privateKey = (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
if (privateKey.includes("BEGIN PRIVATE KEY") && privateKey.includes("END PRIVATE KEY")) {
  ok("La clave privada tiene el formato esperado");
} else {
  errores++;
  fail("La GOOGLE_PRIVATE_KEY no parece válida (debe ir entre comillas y con los \\n)");
}

const credentials = {
  client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  private_key: privateKey,
};

// --- 3. Google Sheets ---
console.log("\n3) Google Sheets (lectura de la pestaña Usuarios)");
try {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: "Usuarios!A2:E",
  });
  const filas = res.data.values ?? [];
  ok(`Conectado a la planilla. Usuarios activos encontrados: ${filas.length}`);
  if (filas.length === 0) {
    warn("La pestaña Usuarios no tiene filas: agrega tu usuario (email, nombre, rol, activo, fecha_alta) o no podrás entrar.");
  }
} catch (e) {
  errores++;
  fail(`No se pudo leer la planilla: ${e?.message ?? e}`);
  warn("Revisa: GOOGLE_SHEETS_ID correcto, planilla compartida con la service account como Editor, pestaña llamada exactamente 'Usuarios', y la Google Sheets API habilitada.");
}

// --- 4. Google Drive (crear y borrar un archivo de prueba) ---
console.log("\n4) Google Drive (escritura en la carpeta de boletas)");
try {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  const drive = google.drive({ version: "v3", auth });
  const creado = await drive.files.create({
    requestBody: {
      name: "verificacion-config.txt",
      parents: [process.env.GOOGLE_DRIVE_FOLDER_ID],
    },
    media: { mimeType: "text/plain", body: Readable.from(Buffer.from("ok")) },
    fields: "id",
  });
  const id = creado.data.id;
  ok("Se pudo crear un archivo de prueba en la carpeta de Drive");
  await drive.files.delete({ fileId: id });
  ok("Archivo de prueba eliminado (limpieza correcta)");
} catch (e) {
  errores++;
  fail(`No se pudo escribir en Drive: ${e?.message ?? e}`);
  warn("Revisa: GOOGLE_DRIVE_FOLDER_ID correcto, carpeta compartida con la service account como Editor, y la Google Drive API habilitada.");
}

// --- 5. Claude (API de Anthropic) ---
console.log("\n5) Claude (API de Anthropic)");
try {
  const client = new Anthropic();
  const res = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4,
    messages: [{ role: "user", content: "Responde solo: ok" }],
  });
  const texto = res.content.find((c) => c.type === "text")?.text ?? "";
  ok(`Conectado a Claude (modelo claude-opus-4-8). Respondió: "${texto.trim()}"`);
} catch (e) {
  errores++;
  fail(`No se pudo llamar a Claude: ${e?.message ?? e}`);
  warn("Revisa: ANTHROPIC_API_KEY correcta y que la cuenta de Anthropic tenga crédito/facturación.");
}

// --- Resumen ---
console.log("\n" + "─".repeat(50));
if (errores === 0) {
  console.log(`${VERDE}¡Todo listo!${RESET} La configuración funciona. Ya puedes correr 'npm run dev'.`);
} else {
  console.log(`${ROJO}Hay ${errores} problema(s).${RESET} Revisa los mensajes de arriba y el Manual de Instalación.`);
}
// Salida limpia: fijamos el código y dejamos que Node drene los handles de red
// (evita una aserción de libuv en Windows al forzar process.exit con sockets abiertos).
process.exitCode = errores === 0 ? 0 : 1;
