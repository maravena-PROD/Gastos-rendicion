import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { getUsuario, listarAreas, actualizarPerfilUsuario } from "@/lib/sheets";
import { perfilCompleto } from "@/lib/perfil";
import { validarRut, formatRut } from "@/lib/format";

export async function GET(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  try {
    const [usuario, areas] = await Promise.all([
      getUsuario(auth.usuario.email),
      listarAreas(),
    ]);
    if (!usuario) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }
    return NextResponse.json({
      nombre: usuario.nombre,
      rut: usuario.rut,
      area: usuario.area,
      banco: usuario.banco,
      cuentaCorriente: usuario.cuentaCorriente,
      completo: perfilCompleto(usuario),
      // Alcance EFECTIVO (el de la sesión): incluye el "*" que decidirAcceso
      // fuerza para el Administrador, que no está en su fila de la planilla.
      apruebaCc: auth.usuario.apruebaCc,
      cargo: usuario.cargo,
      areas,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo leer el perfil" }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  let body: { nombre?: string; rut?: string; area?: string; banco?: string; cuentaCorriente?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body.nombre || !body.nombre.trim()) {
    return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  }
  if (!body.rut || !validarRut(body.rut)) {
    return NextResponse.json({ error: "RUT inválido" }, { status: 400 });
  }
  if (!body.area) {
    return NextResponse.json({ error: "Falta el área" }, { status: 400 });
  }

  try {
    const areas = await listarAreas();
    if (!areas.includes(body.area)) {
      return NextResponse.json({ error: "Área no válida" }, { status: 400 });
    }
    await actualizarPerfilUsuario(auth.usuario.email, {
      nombre: body.nombre.trim(),
      rut: formatRut(body.rut),
      area: body.area,
      banco: typeof body.banco === "string" ? body.banco.trim() : undefined,
      cuentaCorriente: typeof body.cuentaCorriente === "string" ? body.cuentaCorriente.trim() : undefined,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el perfil" }, { status: 502 });
  }
}
