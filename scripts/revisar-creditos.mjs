// Revisor de gasto de la API de Claude (Anthropic).
//
// Consulta el "Cost Report" de la Admin API y suma el gasto del mes en curso.
// Si defines un presupuesto (ANTHROPIC_BUDGET_USD), avisa cuando lo superas y
// sale con código de error, para poder engancharlo a un cron o a CI.
//
// Uso (Node 20.6+):
//   node --env-file=.env.local scripts/revisar-creditos.mjs
// o con el atajo:
//   npm run creditos
//
// Necesita una Admin key (distinta de la ANTHROPIC_API_KEY normal). Se genera en
// la consola de Anthropic: Settings -> Admin keys. Empieza con "sk-ant-admin...".
// Solo lee datos: no modifica nada.
//
// Variables de entorno:
//   ANTHROPIC_ADMIN_KEY   (requerida) clave de admin "sk-ant-admin..."
//   ANTHROPIC_BUDGET_USD  (opcional)  presupuesto mensual en USD, ej: 20

const VERDE = "\x1b[32m";
const ROJO = "\x1b[31m";
const AMARILLO = "\x1b[33m";
const GRIS = "\x1b[90m";
const RESET = "\x1b[0m";

const ok = (m) => console.log(`${VERDE}✓${RESET} ${m}`);
const fail = (m) => console.log(`${ROJO}✗${RESET} ${m}`);
const warn = (m) => console.log(`${AMARILLO}!${RESET} ${m}`);

const ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY;
const PRESUPUESTO = process.env.ANTHROPIC_BUDGET_USD
  ? Number(process.env.ANTHROPIC_BUDGET_USD)
  : null;

const dinero = (usd) =>
  usd.toLocaleString("es-CL", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

// --- Validaciones previas ---
if (!ADMIN_KEY || ADMIN_KEY.includes("...")) {
  fail("Falta ANTHROPIC_ADMIN_KEY (la clave de admin 'sk-ant-admin...').");
  warn("Genérala en la consola de Anthropic: Settings -> Admin keys.");
  warn("Ojo: NO sirve la ANTHROPIC_API_KEY normal del bot; debe ser una Admin key.");
  process.exitCode = 1;
} else if (PRESUPUESTO !== null && (Number.isNaN(PRESUPUESTO) || PRESUPUESTO < 0)) {
  fail(`ANTHROPIC_BUDGET_USD no es un número válido: "${process.env.ANTHROPIC_BUDGET_USD}"`);
  process.exitCode = 1;
} else {
  await revisar();
}

async function revisar() {
  // Inicio del mes en curso, en UTC (el endpoint trabaja en UTC).
  const ahora = new Date();
  const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));

  const nombreMes = inicioMes.toLocaleDateString("es-CL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  console.log(`\nGasto de la API de Claude — ${nombreMes}\n${"─".repeat(50)}`);

  let resultados;
  try {
    resultados = await obtenerCostos(inicioMes);
  } catch (e) {
    fail(`No se pudo consultar el Cost Report: ${e?.message ?? e}`);
    warn("Revisa que la Admin key sea válida y que tu organización tenga permisos de admin.");
    process.exitCode = 1;
    return;
  }

  // El campo `amount` viene en la unidad mínima de la moneda (centavos): hay
  // que dividir por 100 para obtener dólares. Agrupamos por modelo para el desglose.
  const porModelo = new Map();
  let totalCentavos = 0;

  for (const r of resultados) {
    const centavos = Number(r.amount);
    if (Number.isNaN(centavos)) continue;
    totalCentavos += centavos;
    const clave = r.model || r.description || r.cost_type || "otros";
    porModelo.set(clave, (porModelo.get(clave) ?? 0) + centavos);
  }

  const totalUSD = totalCentavos / 100;

  if (resultados.length === 0) {
    console.log(`${GRIS}Aún no hay gasto registrado este mes.${RESET}`);
  } else {
    const filas = [...porModelo.entries()].sort((a, b) => b[1] - a[1]);
    for (const [clave, centavos] of filas) {
      console.log(`  ${clave.padEnd(34)} ${dinero(centavos / 100).padStart(12)}`);
    }
    console.log("─".repeat(50));
  }

  console.log(`  ${"TOTAL del mes".padEnd(34)} ${dinero(totalUSD).padStart(12)}\n`);

  // --- Alerta de presupuesto ---
  if (PRESUPUESTO === null) {
    warn("No definiste ANTHROPIC_BUDGET_USD, así que solo informo el total (sin alerta).");
    process.exitCode = 0;
    return;
  }

  const pct = PRESUPUESTO > 0 ? (totalUSD / PRESUPUESTO) * 100 : 100;
  const resumen = `${dinero(totalUSD)} de ${dinero(PRESUPUESTO)} (${pct.toFixed(0)}%)`;

  if (totalUSD >= PRESUPUESTO) {
    fail(`Presupuesto SUPERADO: ${resumen}`);
    process.exitCode = 1;
  } else if (pct >= 80) {
    warn(`Cerca del límite: ${resumen}`);
    process.exitCode = 0;
  } else {
    ok(`Dentro del presupuesto: ${resumen}`);
    process.exitCode = 0;
  }
}

// Consulta el Cost Report paginando hasta traer todos los buckets del periodo.
async function obtenerCostos(inicioMes) {
  const resultados = [];
  let page = null;

  do {
    const params = new URLSearchParams({
      starting_at: inicioMes.toISOString(),
      bucket_width: "1d",
      group_by: "description",
      limit: "31",
    });
    if (page) params.set("page", page);

    const resp = await fetch(
      `https://api.anthropic.com/v1/organizations/cost_report?${params}`,
      {
        headers: {
          "x-api-key": ADMIN_KEY,
          "anthropic-version": "2023-06-01",
        },
      },
    );

    if (!resp.ok) {
      const cuerpo = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} ${resp.statusText} ${cuerpo}`.trim());
    }

    const json = await resp.json();
    for (const bucket of json.data ?? []) {
      resultados.push(...(bucket.results ?? []));
    }
    page = json.has_more ? json.next_page : null;
  } while (page);

  return resultados;
}
