// Carga el catálogo de imputación a la pestaña CentrosCosto de Google Sheets,
// leyendo CENTROS DE COSTO 2026.xls (hoja "CCOST - AREA - LOCALES etc").
// Filtra: descarta filas sin código de ubicación (clientes claves) y las T9505
// (Ex Casa Matriz, obsoletas). También escribe los 6 encabezados nuevos de la
// pestaña Gastos (R1:W1). Re-ejecutable.
//
// Uso:
//   node --env-file=.env.local scripts/cargar-centros-costo.mjs

import { google } from "googleapis";
import XLSX from "xlsx";

const VERDE = "\x1b[32m";
const ROJO = "\x1b[31m";
const RESET = "\x1b[0m";
const ok = (m) => console.log(`${VERDE}✓${RESET} ${m}`);
const fail = (m) => console.log(`${ROJO}✗${RESET} ${m}`);

const ARCHIVO = "CENTROS DE COSTO 2026.xls";
const HOJA = "CCOST - AREA - LOCALES etc";
const PESTANA = "CentrosCosto";

function getEnv(n) {
  const v = process.env[n];
  if (!v) throw new Error(`Falta la variable de entorno ${n}`);
  return v;
}

function leerCombinaciones() {
  const wb = XLSX.readFile(ARCHIVO);
  const ws = wb.Sheets[HOJA];
  if (!ws) throw new Error(`No existe la hoja "${HOJA}" en ${ARCHIVO}`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" }).slice(2);
  let cc = "", ccd = "", ar = "", ard = "";
  const out = [];
  for (const r of rows) {
    const ccc = String(r[0]).trim(), ccdet = String(r[1]).trim();
    const arc = String(r[3]).trim(), ardet = String(r[4]).trim();
    const ubc = String(r[6]).trim(), ubdet = String(r[7]).trim();
    if (ccc) { cc = ccc; ccd = ccdet; }
    if (arc) { ar = arc; ard = ardet; }
    if (!ubc) continue;
    if (ubc === "T9505") continue;
    out.push([cc, ccd, ar, ard, ubc, ubdet]);
  }
  return out;
}

async function main() {
  const combos = leerCombinaciones();
  ok(`Leídas ${combos.length} combinaciones válidas del .xls`);

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      private_key: getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existe = (meta.data.sheets ?? []).some((s) => s.properties?.title === PESTANA);
  if (!existe) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: PESTANA } } }] },
    });
    ok(`Pestaña "${PESTANA}" creada`);
  }

  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${PESTANA}!A:F` });
  const valores = [
    ["cc_codigo", "cc_detalle", "area_codigo", "area_detalle", "ubicacion_codigo", "ubicacion_detalle"],
    ...combos,
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${PESTANA}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: valores },
  });
  ok(`Escritas ${combos.length} filas en "${PESTANA}"`);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Gastos!R1:W1",
    valueInputOption: "RAW",
    requestBody: {
      values: [["centro_costo_codigo", "centro_costo", "area_codigo", "area", "ubicacion_codigo", "ubicacion"]],
    },
  });
  ok("Encabezados de imputación agregados en Gastos!R1:W1");
}

main().catch((e) => {
  fail(e?.message ?? String(e));
  process.exitCode = 1;
});
