import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) {
    return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  }
  const resultado = await autenticar(token);
  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.motivo }, { status: resultado.status });
  }
  return NextResponse.json({ usuario: resultado.usuario });
}
