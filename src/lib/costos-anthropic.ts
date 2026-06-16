// Gasto de la API de Claude (Anthropic), leído del "Cost Report" de la Admin API.
// Se usa SOLO en el servidor: la Admin key (ANTHROPIC_ADMIN_KEY) es org-wide y
// nunca debe llegar al navegador. El acceso está restringido por email
// (ANTHROPIC_COST_VIEWER_EMAIL) en la ruta /api/costos-api.

const ENDPOINT = "https://api.anthropic.com/v1/organizations/cost_report";

export interface GastoDia {
  /** "YYYY-MM-DD" en UTC (el endpoint trabaja en UTC). */
  fecha: string;
  montoUSD: number;
}

export interface ResumenGastoApi {
  porDia: GastoDia[];
  totalUSD: number;
}

/** Forma mínima del Cost Report que nos interesa. */
interface BucketCosto {
  starting_at: string;
  results: { amount: string }[];
}

/**
 * Agrega los buckets del Cost Report en gasto por día (USD). El campo `amount`
 * viene en la unidad mínima de la moneda (centavos) como string decimal, así
 * que dividimos por 100. Función pura: testeable sin tocar la red.
 */
export function agregarPorDia(buckets: BucketCosto[]): ResumenGastoApi {
  const porFecha = new Map<string, number>();
  for (const bucket of buckets) {
    const fecha = (bucket.starting_at ?? "").slice(0, 10);
    if (!fecha) continue;
    let centavos = 0;
    for (const r of bucket.results ?? []) {
      const c = Number(r.amount);
      if (!Number.isNaN(c)) centavos += c;
    }
    porFecha.set(fecha, (porFecha.get(fecha) ?? 0) + centavos);
  }
  const porDia = [...porFecha.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([fecha, centavos]) => ({ fecha, montoUSD: centavos / 100 }));
  const totalUSD = porDia.reduce((s, d) => s + d.montoUSD, 0);
  return { porDia, totalUSD };
}

/**
 * ¿Este email es el único autorizado a ver el gasto de la API?
 * Se compara contra ANTHROPIC_COST_VIEWER_EMAIL (sin distinguir mayúsculas).
 * Si la variable no está configurada, no se autoriza a nadie.
 */
export function puedeVerCostos(email: string): boolean {
  const autorizado = (process.env.ANTHROPIC_COST_VIEWER_EMAIL ?? "").trim().toLowerCase();
  if (!autorizado) return false;
  return email.trim().toLowerCase() === autorizado;
}

/** Inicio del mes en curso en UTC. */
function inicioDeMesUTC(ref = new Date()): Date {
  return new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
}

/**
 * Llama al Cost Report de la Admin API y devuelve el gasto del mes en curso,
 * desglosado por día. Requiere ANTHROPIC_ADMIN_KEY. Lanza si falta la clave o
 * si la API responde con error.
 */
export async function obtenerGastoApiDelMes(): Promise<ResumenGastoApi> {
  const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
  if (!adminKey) {
    throw new Error("Falta ANTHROPIC_ADMIN_KEY");
  }

  const inicio = inicioDeMesUTC();
  const buckets: BucketCosto[] = [];
  let page: string | null = null;

  do {
    const params = new URLSearchParams({
      starting_at: inicio.toISOString(),
      bucket_width: "1d",
      limit: "31",
    });
    if (page) params.set("page", page);

    const resp = await fetch(`${ENDPOINT}?${params}`, {
      headers: {
        "x-api-key": adminKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!resp.ok) {
      throw new Error(`Cost Report respondió ${resp.status}`);
    }
    const json = (await resp.json()) as {
      data?: BucketCosto[];
      has_more?: boolean;
      next_page?: string;
    };
    buckets.push(...(json.data ?? []));
    page = json.has_more ? (json.next_page ?? null) : null;
  } while (page);

  return agregarPorDia(buckets);
}
