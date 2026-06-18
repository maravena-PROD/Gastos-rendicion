import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos, appendGasto, listarCentrosCosto } from "@/lib/sheets";
import { crearGasto } from "@/lib/gasto-factory";
import { filtrarGastosPorRol } from "@/lib/gastos-rol";
import { construirCamposGasto } from "@/lib/gasto-payload";
import { asegurarCuentaDevolucion } from "@/lib/gasto-cuenta";
import { puedeIngresarEnCc } from "@/lib/centros-costo";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  try {
    const todos = await listGastos();
    const visibles = filtrarGastosPorRol(todos, auth.usuario);
    return NextResponse.json({ gastos: visibles });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer los gastos" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  let body: {
    comercio?: string;
    monto?: number;
    categoria?: string;
    fechaDocumento?: string;
    rutEmisor?: string;
    numeroDocumento?: string;
    direccion?: string;
    observacion?: string;
    imagenUrl?: string;
    imagenDriveId?: string;
    centroCostoCodigo?: string;
    areaCodigo?: string;
    ubicacionCodigo?: string;
    tipoRendicion?: string;
    tipoDocumento?: string;
    montoNeto?: number;
    iva?: number;
    banco?: string;
    cuentaCorriente?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
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

  const gasto = crearGasto({
    usuarioEmail: auth.usuario.email,
    usuarioNombre: auth.usuario.nombre,
    usuarioArea: auth.usuario.area,
    imagenUrl: body.imagenUrl,
    imagenDriveId: body.imagenDriveId,
    ...campos,
  });

  try {
    await appendGasto(gasto);
    return NextResponse.json({ gasto }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el gasto" }, { status: 502 });
  }
}
