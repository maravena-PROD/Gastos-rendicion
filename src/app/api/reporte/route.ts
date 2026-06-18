import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { listGastos, getUsuario, listUsuarios } from "@/lib/sheets";
import { filtrarGastosPorRol } from "@/lib/gastos-rol";
import { filtrarPorRango } from "@/lib/dashboard";
import { construirReporte } from "@/lib/reporte";
import { renderReportePdf } from "@/lib/reporte-pdf";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  const url = new URL(req.url);
  const desde = url.searchParams.get("desde") ?? "";
  const hasta = url.searchParams.get("hasta") ?? "";
  if (!desde || !hasta) {
    return NextResponse.json({ error: "Faltan los parámetros desde/hasta" }, { status: 400 });
  }

  try {
    const [todos, usuario, usuarios] = await Promise.all([
      listGastos(),
      getUsuario(auth.usuario.email),
      listUsuarios(),
    ]);
    if (!usuario) return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });

    const nombres = new Map(usuarios.map((u) => [u.email.toLowerCase(), u.nombre]));
    const visibles = filtrarGastosPorRol(todos, auth.usuario);
    const delRango = filtrarPorRango(visibles, desde, hasta);
    const hoy = new Date().toISOString().slice(0, 10);
    const modelo = construirReporte(usuario, delRango, {
      desde,
      hasta,
      fechaRendicion: hoy,
      nombrePorEmail: (email) => nombres.get(email.toLowerCase()) ?? email,
    });

    const buffer = await renderReportePdf(modelo);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="rendicion-${desde}_a_${hasta}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el reporte" }, { status: 502 });
  }
}
