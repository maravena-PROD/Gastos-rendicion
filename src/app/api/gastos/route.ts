import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos, appendGasto, listarCentrosCosto } from "@/lib/sheets";
import { resolverImputacion } from "@/lib/centros-costo";
import { crearGasto } from "@/lib/gasto-factory";
import { filtrarGastosPorRol } from "@/lib/gastos-rol";
import { normalizarCategoria } from "@/lib/extraccion";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const categoria = normalizarCategoria(body.categoria ?? null);
  if (
    !body.comercio ||
    typeof body.monto !== "number" ||
    !Number.isInteger(body.monto) ||
    body.monto <= 0 ||
    !categoria ||
    !body.fechaDocumento
  ) {
    return NextResponse.json(
      { error: "Faltan datos esenciales (comercio, monto, categoría, fecha)" },
      { status: 400 },
    );
  }

  if (!body.centroCostoCodigo || !body.areaCodigo || !body.ubicacionCodigo) {
    return NextResponse.json(
      { error: "Falta la imputación: centro de costo, área y ubicación" },
      { status: 400 },
    );
  }

  let imputacion;
  try {
    const catalogo = await listarCentrosCosto();
    imputacion = resolverImputacion(
      catalogo,
      body.centroCostoCodigo,
      body.areaCodigo,
      body.ubicacionCodigo,
    );
  } catch {
    return NextResponse.json({ error: "No se pudo validar la imputación" }, { status: 502 });
  }
  if (!imputacion) {
    return NextResponse.json(
      { error: "La combinación de centro de costo / área / ubicación no es válida" },
      { status: 400 },
    );
  }

  const gasto = crearGasto({
    usuarioEmail: auth.usuario.email,
    usuarioNombre: auth.usuario.nombre,
    comercio: body.comercio,
    monto: body.monto,
    categoria,
    fechaDocumento: body.fechaDocumento,
    rutEmisor: body.rutEmisor,
    numeroDocumento: body.numeroDocumento,
    direccion: body.direccion,
    observacion: body.observacion,
    imagenUrl: body.imagenUrl,
    imagenDriveId: body.imagenDriveId,
    usuarioArea: auth.usuario.area,
    imputacion,
  });

  try {
    await appendGasto(gasto);
    return NextResponse.json({ gasto }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el gasto" }, { status: 502 });
  }
}
