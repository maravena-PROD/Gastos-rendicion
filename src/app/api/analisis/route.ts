import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos } from "@/lib/sheets";
import { gastosEnAlcance } from "@/lib/aprobaciones";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  const alcance = auth.usuario.apruebaCc;
  if (alcance.length === 0) {
    return NextResponse.json({ error: "No administras centros de costo" }, { status: 403 });
  }

  try {
    const todos = await listGastos();
    return NextResponse.json({ gastos: gastosEnAlcance(todos, alcance), alcance });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer los gastos" }, { status: 502 });
  }
}
