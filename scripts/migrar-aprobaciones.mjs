// Agrega los encabezados nuevos (fila 1) que introdujo la feature de
// aprobaciones/rechazos de gastos por centro de costo:
//   - Usuarios!J1:K1  -> aprueba_cc, cargo
//   - Gastos!AB1:AD1  -> aprobado_por, fecha_decision, motivo
//
// Es ADITIVO y re-ejecutable: solo escribe la fila 1 (encabezados); nunca toca
// las filas de datos. Las filas históricas quedan con esas celdas vacías y el
// backend las default-ea al leerlas.
//
// Uso:
//   node --env-file=.env.local scripts/migrar-aprobaciones.mjs            (escribe)
//   node --env-file=.env.local scripts/migrar-aprobaciones.mjs --dry-run  (solo lee y reporta)

import { google } from "googleapis";

const VERDE = "\x1b[32m";
const ROJO = "\x1b[31m";
const AMBAR = "\x1b[33m";
const GRIS = "\x1b[90m";
const RESET = "\x1b[0m";
const ok = (m) => console.log(`${VERDE}✓${RESET} ${m}`);
const fail = (m) => console.log(`${ROJO}✗${RESET} ${m}`);
const warn = (m) => console.log(`${AMBAR}!${RESET} ${m}`);
const info = (m) => console.log(`${GRIS}·${RESET} ${m}`);

const DRY_RUN = process.argv.includes("--dry-run");

// Cada migración: pestaña, rango de la fila 1 a escribir, y los valores canónicos.
// Los valores DEBEN coincidir con GASTOS_HEADERS de src/lib/sheets.ts y con el
// orden que leen rowToGasto / usuarioRowToUsuario.
const MIGRACIONES = [
  {
    pestana: "Usuarios",
    rango: "Usuarios!J1:K1",
    encabezados: ["aprueba_cc", "cargo"],
  },
  {
    pestana: "Gastos",
    rango: "Gastos!AB1:AD1",
    encabezados: ["aprobado_por", "fecha_decision", "motivo"],
  },
];

function getEnv(n) {
  const v = process.env[n];
  if (!v) throw new Error(`Falta la variable de entorno ${n}`);
  return v;
}

function getSheets() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      private_key: getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

/** Lee la fila 1 actual del rango; devuelve un arreglo del mismo largo que los encabezados. */
async function leerActual(sheets, spreadsheetId, rango, largo) {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: rango });
  const fila = (res.data.values ?? [])[0] ?? [];
  return Array.from({ length: largo }, (_, i) => String(fila[i] ?? "").trim());
}

async function main() {
  const sheets = getSheets();
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");

  // Verifica que las pestañas existan antes de tocar nada.
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const titulos = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));
  for (const m of MIGRACIONES) {
    if (!titulos.has(m.pestana)) {
      throw new Error(`No existe la pestaña "${m.pestana}" en la planilla`);
    }
  }

  if (DRY_RUN) warn("Modo --dry-run: no se escribirá nada.\n");
  let cambios = 0;

  for (const m of MIGRACIONES) {
    const actual = await leerActual(sheets, spreadsheetId, m.rango, m.encabezados.length);
    const yaOk = m.encabezados.every((h, i) => actual[i] === h);

    if (yaOk) {
      ok(`${m.rango} ya tiene los encabezados correctos: ${m.encabezados.join(", ")}`);
      continue;
    }

    // Avisa si alguna celda ya tenía un valor DISTINTO (no vacío) al canónico.
    m.encabezados.forEach((h, i) => {
      if (actual[i] && actual[i] !== h) {
        warn(`${m.pestana}: la columna de "${h}" tenía "${actual[i]}"; se reemplazará por "${h}".`);
      }
    });

    info(`${m.rango}: ${actual.map((v) => v || "∅").join(", ")}  ->  ${m.encabezados.join(", ")}`);

    if (!DRY_RUN) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: m.rango,
        valueInputOption: "RAW",
        requestBody: { values: [m.encabezados] },
      });
      ok(`Encabezados escritos en ${m.rango}`);
    }
    cambios++;
  }

  console.log("");
  if (DRY_RUN) {
    warn(cambios === 0 ? "Nada que migrar." : `${cambios} rango(s) requieren migración. Ejecuta sin --dry-run para aplicar.`);
  } else {
    ok(cambios === 0 ? "Sin cambios: los encabezados ya estaban al día." : `Migración completa: ${cambios} rango(s) actualizado(s).`);
  }
}

main().catch((e) => {
  fail(e?.message ?? String(e));
  process.exitCode = 1;
});
