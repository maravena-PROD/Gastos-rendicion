import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos } from "@/lib/sheets";
import { gastosPorAprobar } from "@/lib/aprobaciones";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  try {
    const todos = await listGastos();
    return NextResponse.json({ gastos: gastosPorAprobar(todos, auth.usuario) });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer las aprobaciones" }, { status: 502 });
  }
}
