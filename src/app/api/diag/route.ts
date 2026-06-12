import { NextResponse } from "next/server";

// Ruta TEMPORAL de diagnóstico de despliegue. Eliminar tras depurar.
export async function GET() {
  const out: Record<string, unknown> = {};
  out.node = process.version;

  const vars = [
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_SHEETS_ID",
    "GOOGLE_DRIVE_FOLDER_ID",
    "ANTHROPIC_API_KEY",
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "FIREBASE_PROJECT_ID",
  ];
  out.envPresentes = Object.fromEntries(vars.map((v) => [v, Boolean(process.env[v])]));

  try {
    await import("firebase-admin/app");
    await import("firebase-admin/auth");
    out.firebaseAdmin = "ok";
  } catch (e) {
    out.firebaseAdmin = String((e as Error)?.stack ?? e);
  }

  try {
    await import("googleapis");
    out.googleapis = "ok";
  } catch (e) {
    out.googleapis = String((e as Error)?.stack ?? e);
  }

  try {
    await import("@anthropic-ai/sdk");
    out.anthropic = "ok";
  } catch (e) {
    out.anthropic = String((e as Error)?.stack ?? e);
  }

  return NextResponse.json(out);
}
