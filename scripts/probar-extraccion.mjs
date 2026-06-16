// Prueba rápida de la extracción con el modelo configurado (Haiku 4.5).
// Verifica, contra la API real, que el modelo es válido, que acepta el schema
// (output_config.format) y que devuelve un JSON parseable. No necesita imagen:
// usa el camino de texto, que ejerce el mismo modelo + structured output.
//
// Uso:
//   node --env-file=.env.local scripts/probar-extraccion.mjs

import Anthropic from "@anthropic-ai/sdk";

const VERDE = "\x1b[32m";
const ROJO = "\x1b[31m";
const RESET = "\x1b[0m";
const ok = (m) => console.log(`${VERDE}✓${RESET} ${m}`);
const fail = (m) => console.log(`${ROJO}✗${RESET} ${m}`);

const MODELO = "claude-haiku-4-5";

const SYSTEM = `Eres un asistente de rendición de gastos para una empresa chilena.
Extrae los datos de un gasto a partir del texto.
Reglas:
- "monto" es un entero en pesos chilenos (CLP), sin puntos de miles (12500, no "12.500").
- "fechaDocumento" en formato AAAA-MM-DD.
- "rutEmisor" con formato chileno (ej. 76.543.219-7) si aparece.
- Si un dato no aparece, devuelve null. NUNCA inventes datos.`;

const SCHEMA = {
  type: "object",
  properties: {
    comercio: { type: ["string", "null"] },
    monto: { type: ["integer", "null"] },
    fechaDocumento: { type: ["string", "null"] },
    rutEmisor: { type: ["string", "null"] },
  },
  required: ["comercio", "monto", "fechaDocumento", "rutEmisor"],
  additionalProperties: false,
};

const TEXTO =
  "Almuerzo en Restaurant Don José por $12.500 el 10 de junio de 2026, RUT 76.543.219-7.";

const client = new Anthropic();

console.log(`\nProbando extracción con ${MODELO}…\n`);

try {
  const params = {
    model: MODELO,
    max_tokens: 1024,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: TEXTO }],
  };
  const res = await client.messages.create(params);

  const texto = res.content.find((c) => c.type === "text")?.text;
  if (!texto) throw new Error("La respuesta no trae bloque de texto");
  const datos = JSON.parse(texto);

  ok(`Modelo válido y structured output aceptado (modelo real: ${res.model})`);
  console.log(`  Texto de prueba: "${TEXTO}"`);
  console.log(`  Extracción:`, datos);

  const correcto =
    datos.monto === 12500 && datos.fechaDocumento === "2026-06-10" && !!datos.comercio;
  if (correcto) {
    ok("Los campos clave (monto, fecha, comercio) salieron correctos.");
  } else {
    fail("La conexión funciona, pero revisa los campos: no salieron como se esperaba.");
  }

  const u = res.usage;
  console.log(
    `  Tokens — entrada: ${u.input_tokens}, salida: ${u.output_tokens}`,
  );
  process.exitCode = correcto ? 0 : 1;
} catch (e) {
  fail(`Falló la extracción: ${e?.message ?? e}`);
  if (String(e?.message ?? e).includes("model")) {
    fail("Parece un problema con el ID del modelo. Revisa el valor de MODELO en src/lib/claude.ts.");
  }
  process.exitCode = 1;
}
