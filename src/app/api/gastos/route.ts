import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos, appendGasto, listarCentrosCosto, actualizarPerfilUsuario, getUsuario } from "@/lib/sheets";
import { resolverImputacion } from "@/lib/centros-costo";
import { crearGasto } from "@/lib/gasto-factory";
import { filtrarGastosPorRol } from "@/lib/gastos-rol";
import { normalizarCategoria } from "@/lib/extraccion";
import { calcularNetoIva } from "@/lib/montos";
import type { TipoRendicion, TipoDocumento } from "@/lib/types";

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

  const tipoRendicion: TipoRendicion =
    body.tipoRendicion === "Devolucion" ? "Devolucion" : "Rendicion";
  const tipoDocumento: TipoDocumento =
    body.tipoDocumento === "Boleta" || body.tipoDocumento === "Factura"
      ? body.tipoDocumento
      : "Otro";

  // Devolución: exige cuenta corriente en el perfil; si viene en el payload, la persiste.
  if (tipoRendicion === "Devolucion") {
    let usuario;
    try {
      usuario = await getUsuario(auth.usuario.email);
    } catch {
      return NextResponse.json({ error: "No se pudo validar la cuenta corriente" }, { status: 502 });
    }
    const bancoNuevo = typeof body.banco === "string" ? body.banco.trim() : "";
    const cuentaNueva = typeof body.cuentaCorriente === "string" ? body.cuentaCorriente.trim() : "";
    const tienePerfil = !!usuario && usuario.banco.trim() !== "" && usuario.cuentaCorriente.trim() !== "";
    const vieneEnPayload = bancoNuevo !== "" && cuentaNueva !== "";
    if (!tienePerfil && !vieneEnPayload) {
      return NextResponse.json(
        { error: "Una devolución requiere banco y cuenta corriente" },
        { status: 400 },
      );
    }
    if (vieneEnPayload && usuario) {
      try {
        await actualizarPerfilUsuario(auth.usuario.email, {
          nombre: usuario.nombre,
          rut: usuario.rut,
          area: usuario.area,
          banco: bancoNuevo,
          cuentaCorriente: cuentaNueva,
        });
      } catch {
        return NextResponse.json({ error: "No se pudo guardar la cuenta corriente" }, { status: 502 });
      }
    }
  }

  const { neto, iva } = calcularNetoIva(body.monto, tipoDocumento, {
    neto: typeof body.montoNeto === "number" ? body.montoNeto : null,
    iva: typeof body.iva === "number" ? body.iva : null,
  });

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
    tipoRendicion,
    tipoDocumento,
    montoNeto: neto,
    iva,
  });

  try {
    await appendGasto(gasto);
    return NextResponse.json({ gasto }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el gasto" }, { status: 502 });
  }
}
