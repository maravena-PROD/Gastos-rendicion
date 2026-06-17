import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { extraerDeTexto, extraerDeImagen } from "@/lib/claude";
import { camposFaltantes, hayDatosEsenciales, type ExtraccionGasto } from "@/lib/extraccion";
import { validarImagen } from "@/lib/validacion-archivo";

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  let body: { texto?: string; base64?: string; borrador?: ExtraccionGasto };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  try {
    if (body.base64) {
      const buffer = Buffer.from(body.base64, "base64");
      const v = validarImagen(buffer);
      if (!v.ok) return NextResponse.json({ error: v.motivo }, { status: 400 });
      if (v.mimeType === "application/pdf") {
        return NextResponse.json(
          { error: "Para extracción por imagen usa JPG o PNG" },
          { status: 400 },
        );
      }
      const extraccion = await extraerDeImagen(body.base64, v.mimeType);
      return NextResponse.json({ extraccion, faltantes: camposFaltantes(extraccion) });
    }
    if (body.texto) {
      const borrador = body.borrador;
      // Solo hay "campo preguntado" si ya estamos a mitad de un gasto. En un
      // mensaje inicial o saludo (borrador vacío) no se fuerza ningún mapeo.
      const campoPreguntado =
        borrador && hayDatosEsenciales(borrador) ? (camposFaltantes(borrador)[0] ?? null) : null;
      // Fecha de hoy en zona Chile (en-CA da formato AAAA-MM-DD) para fechas relativas.
      const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
      const extraccion = await extraerDeTexto(body.texto, { borrador, campoPreguntado, hoy });
      return NextResponse.json({ extraccion, faltantes: camposFaltantes(extraccion) });
    }
    return NextResponse.json({ error: "Envía texto o imagen" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "No se pudo procesar con el asistente" }, { status: 502 });
  }
}
