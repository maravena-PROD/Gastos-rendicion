import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/auth";
import { autenticar } from "@/lib/auth-server";
import { validarImagen } from "@/lib/validacion-archivo";
import { subirImagen } from "@/lib/drive";

export async function POST(req: Request) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Falta el token" }, { status: 401 });
  const auth = await autenticar(token);
  if (!auth.ok) return NextResponse.json({ error: auth.motivo }, { status: auth.status });

  let body: { base64?: string; nombre?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!body.base64) {
    return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
  }

  const buffer = Buffer.from(body.base64, "base64");
  const validacion = validarImagen(buffer);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.motivo }, { status: 400 });
  }

  const ext = validacion.mimeType === "application/pdf" ? "pdf" : validacion.mimeType.split("/")[1];
  const nombre = body.nombre ?? `boleta-${Date.now()}.${ext}`;
  try {
    const { id, url } = await subirImagen(buffer, validacion.mimeType, nombre);
    return NextResponse.json({ id, url });
  } catch {
    return NextResponse.json({ error: "No se pudo subir la imagen" }, { status: 502 });
  }
}
