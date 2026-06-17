// Da de alta a los gerentes aprobadores en la pestaña Usuarios y carga su
// alcance de aprobación (aprueba_cc) y cargo.
//   - Si el correo NO existe: agrega una fila nueva (rol Usuario, activo=TRUE,
//     fecha_alta=hoy; rut/área/banco/cuenta vacíos -> los completan en su primer
//     login vía onboarding) con su aprueba_cc y cargo.
//   - Si ya existe: actualiza SOLO sus celdas J:K (aprueba_cc, cargo), sin tocar
//     el resto de la fila.
//
// Es re-ejecutable e idempotente.
//
// Uso:
//   node --env-file=.env.local scripts/cargar-aprobadores.mjs            (escribe)
//   node --env-file=.env.local scripts/cargar-aprobadores.mjs --dry-run  (solo reporta)

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

// Gerentes aprobadores. apruebaCc "*" = todos los centros de costo.
const APROBADORES = [
  { correo: "jclarrain@bosca.cl", nombre: "Juan Carlos Larrain", apruebaCc: "*",     cargo: "Gerente General" },
  { correo: "amoya@bosca.cl",     nombre: "Ana Maria Moya",      apruebaCc: "C0300", cargo: "Gerente Administracion y Finanzas" },
  { correo: "fmartinez@bosca.cl", nombre: "Fernando Martinez",   apruebaCc: "C0200", cargo: "Gerente Comercial" },
  { correo: "mlarrain@bosca.cl",  nombre: "Matias Larrain",      apruebaCc: "C0400", cargo: "Gerente de Desarrollo" },
  { correo: "aulloa@bosca.cl",    nombre: "Alejandro Ulloa",     apruebaCc: "C0100", cargo: "Gerente de Operaciones" },
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

async function main() {
  const sheets = getSheets();
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");

  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: "Usuarios!A2:K" });
  const rows = (res.data.values ?? []);

  if (DRY_RUN) warn("Modo --dry-run: no se escribirá nada.\n");
  const ahora = new Date().toISOString();
  let creados = 0;
  let actualizados = 0;

  for (const a of APROBADORES) {
    const idx = rows.findIndex((r) => (r[0] ?? "").trim().toLowerCase() === a.correo.toLowerCase());

    if (idx === -1) {
      // Usuario nuevo: fila completa A:K. rut/área/banco/cuenta vacíos (onboarding).
      info(`${a.correo}: NUEVO -> rol Usuario, activo, aprueba_cc="${a.apruebaCc}", cargo="${a.cargo}".`);
      if (!DRY_RUN) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Usuarios!A2:K",
          valueInputOption: "RAW",
          requestBody: {
            values: [[a.correo, a.nombre, "Usuario", "TRUE", ahora, "", "", "", "", a.apruebaCc, a.cargo]],
          },
        });
        ok(`${a.correo}: creado.`);
      }
      creados++;
      continue;
    }

    const fila = rows[idx];
    const ccActual = (fila[9] ?? "").trim();
    const cargoActual = (fila[10] ?? "").trim();
    if (ccActual === a.apruebaCc && cargoActual === a.cargo) {
      ok(`${a.correo}: ya tiene aprueba_cc="${a.apruebaCc}", cargo="${a.cargo}".`);
      continue;
    }
    const numeroFila = idx + 2; // fila 1 = encabezados
    info(`${a.correo} (fila ${numeroFila}): J:K "${ccActual || "∅"}", "${cargoActual || "∅"}"  ->  "${a.apruebaCc}", "${a.cargo}"`);
    if (!DRY_RUN) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Usuarios!J${numeroFila}:K${numeroFila}`,
        valueInputOption: "RAW",
        requestBody: { values: [[a.apruebaCc, a.cargo]] },
      });
      ok(`${a.correo}: J:K actualizado.`);
    }
    actualizados++;
  }

  console.log("");
  if (DRY_RUN) {
    warn(`${creados} por crear, ${actualizados} por actualizar. Ejecuta sin --dry-run para aplicar.`);
  } else {
    ok(`Listo: ${creados} creado(s), ${actualizados} actualizado(s).`);
  }
}

main().catch((e) => {
  fail(e?.message ?? String(e));
  process.exitCode = 1;
});
