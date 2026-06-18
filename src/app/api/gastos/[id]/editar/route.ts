import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos, listarCentrosCosto, actualizarGasto } from "@/lib/sheets";
import { puedeEditar } from "@/lib/aprobaciones";
import { construirCamposGasto } from "@/lib/gasto-payload";
import { asegurarCuentaDevolucion } from "@/lib/gasto-cuenta";
import { puedeIngresarEnCc } from "@/lib/centros-costo";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  let gasto;
  try {
    gasto = (await listGastos()).find((g) => g.id === id);
  } catch {
    return NextResponse.json({ error: "No se pudo leer el gasto" }, { status: 502 });
  }
  if (!gasto) return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 });
  if (!puedeEditar(auth.usuario, gasto)) {
    return NextResponse.json({ error: "No puedes editar este gasto" }, { status: 403 });
  }

  let catalogo;
  try {
    catalogo = await listarCentrosCosto();
  } catch {
    return NextResponse.json({ error: "No se pudo validar la imputación" }, { status: 502 });
  }
  const r = construirCamposGasto(body, catalogo);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  const campos = r.campos;

  if (!puedeIngresarEnCc(auth.usuario.ingresaCc, campos.imputacion.centroCostoCodigo)) {
    return NextResponse.json(
      { error: "No tienes permiso para ingresar gastos en ese centro de costo" },
      { status: 403 },
    );
  }

  if (campos.tipoRendicion === "Devolucion") {
    const cuenta = await asegurarCuentaDevolucion(auth.usuario.email, body);
    if (!cuenta.ok) return NextResponse.json({ error: cuenta.error }, { status: cuenta.status });
  }

  // Reenvío: vuelve a Registrado y limpia la decisión previa. Conserva id, imagen, usuario, etc.
  const actualizado = {
    ...gasto,
    ...campos,
    estado: "Registrado" as const,
    aprobadoPor: "",
    fechaDecision: "",
    motivo: "",
  };
  try {
    await actualizarGasto(actualizado);
  } catch {
    return NextResponse.json({ error: "No se pudo guardar la edición" }, { status: 502 });
  }
  return NextResponse.json({ gasto: actualizado });
}
