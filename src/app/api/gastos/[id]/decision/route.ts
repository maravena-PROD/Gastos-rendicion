import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos, actualizarDecisionGasto } from "@/lib/sheets";
import { puedeAprobar } from "@/lib/aprobaciones";
import type { EstadoGasto } from "@/lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  const { id } = await params;
  let body: { decision?: string; motivo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (body.decision !== "Aprobado" && body.decision !== "Rechazado") {
    return NextResponse.json({ error: "decision debe ser Aprobado o Rechazado" }, { status: 400 });
  }

  let gasto;
  try {
    const todos = await listGastos();
    gasto = todos.find((g) => g.id === id);
  } catch {
    return NextResponse.json({ error: "No se pudo leer el gasto" }, { status: 502 });
  }
  if (!gasto) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });

  if (!puedeAprobar(auth.usuario, gasto)) {
    return NextResponse.json({ error: "No puedes decidir este gasto" }, { status: 403 });
  }

  const decidido = {
    ...gasto,
    estado: body.decision as EstadoGasto,
    aprobadoPor: auth.usuario.email,
    fechaDecision: new Date().toISOString(),
    motivo: typeof body.motivo === "string" ? body.motivo.trim() : "",
  };
  try {
    await actualizarDecisionGasto(decidido);
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la decisión" }, { status: 502 });
  }
  return NextResponse.json({ gasto: decidido });
}
