import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { puedeVerCostos, obtenerGastoApiDelMes } from "@/lib/costos-anthropic";

/**
 * Gasto de la API de Claude (este mes, por día). Restringido a un único email
 * (ANTHROPIC_COST_VIEWER_EMAIL); para cualquier otro usuario responde 403 y el
 * dashboard simplemente no muestra el panel.
 */
export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  if (!puedeVerCostos(auth.usuario.email)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const resumen = await obtenerGastoApiDelMes();
    return NextResponse.json(resumen);
  } catch (e) {
    const faltaClave = e instanceof Error && e.message.includes("ANTHROPIC_ADMIN_KEY");
    return NextResponse.json(
      { error: faltaClave ? "Falta configurar ANTHROPIC_ADMIN_KEY en el servidor" : "No se pudo obtener el gasto de la API" },
      { status: 502 },
    );
  }
}
