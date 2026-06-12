import { NextResponse } from "next/server";

// Ruta TEMPORAL de diagnóstico de despliegue. Eliminar tras depurar.
export async function GET() {
  const out: Record<string, unknown> = {};
  out.node = process.version;

  try {
    await import("jose");
    out.jose = "ok";
  } catch (e) {
    out.jose = String((e as Error)?.stack ?? e);
  }

  try {
    const m = await import("@/lib/firebase-admin");
    out.verificador = typeof m.verificarIdToken;
  } catch (e) {
    out.verificador = String((e as Error)?.stack ?? e);
  }

  try {
    await import("googleapis");
    out.googleapis = "ok";
  } catch (e) {
    out.googleapis = String((e as Error)?.stack ?? e);
  }

  return NextResponse.json(out);
}
