import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listarCentrosCosto } from "@/lib/sheets";
import { centrosPermitidos } from "@/lib/centros-costo";

/**
 * Devuelve el catálogo de imputación (centro de costo / área / ubicación),
 * acotado a los centros de costo donde el usuario puede ingresar gastos.
 */
export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  try {
    const centros = await listarCentrosCosto();
    return NextResponse.json({ centros: centrosPermitidos(centros, auth.usuario.ingresaCc) });
  } catch {
    return NextResponse.json({ error: "No se pudo leer los centros de costo" }, { status: 502 });
  }
}
