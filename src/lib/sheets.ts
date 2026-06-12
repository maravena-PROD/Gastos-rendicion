import type { Gasto, Categoria, EstadoGasto, Usuario, Rol } from "./types";
import { CATEGORIAS } from "./types";
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

/** Construye un cliente de Sheets autenticado con la service account. */
function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      // Las claves en .env usan "\n" literales; los convertimos a saltos reales.
      private_key: getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  });
  return google.sheets({ version: "v4", auth });
}

/** Orden de columnas de la pestaña Gastos (debe coincidir con los encabezados). */
export const GASTOS_HEADERS = [
  "id",
  "fecha_registro",
  "usuario_email",
  "usuario_nombre",
  "fecha_documento",
  "comercio",
  "rut_emisor",
  "numero_documento",
  "categoria",
  "monto",
  "direccion",
  "observacion",
  "imagen_url",
  "imagen_drive_id",
  "estado",
  "fecha_creacion",
  "usuario_area",
] as const;

/** Convierte un Gasto en una fila (string[]) para escribir en Sheets. */
export function gastoToRow(g: Gasto): string[] {
  return [
    g.id,
    g.fechaRegistro,
    g.usuarioEmail,
    g.usuarioNombre,
    g.fechaDocumento,
    g.comercio,
    g.rutEmisor,
    g.numeroDocumento,
    g.categoria,
    String(g.monto),
    g.direccion,
    g.observacion,
    g.imagenUrl,
    g.imagenDriveId,
    g.estado,
    g.fechaCreacion,
    g.usuarioArea,
  ];
}

/** Lee una celda tolerando undefined (filas recortadas por la API de Sheets). */
function cell(row: string[], i: number): string {
  return row[i] ?? "";
}

function parseCategoria(v: string): Categoria {
  return (CATEGORIAS as readonly string[]).includes(v)
    ? (v as Categoria)
    : "Otros";
}

function parseEstado(v: string): EstadoGasto {
  if (v === "Aprobado" || v === "Rechazado") return v;
  return "Registrado";
}

/** Parsea el monto de una celda a entero CLP; 0 si no es un número finito. */
function parseMonto(v: string): number {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

/** Convierte una fila de Sheets en un Gasto. */
export function rowToGasto(row: string[]): Gasto {
  return {
    id: cell(row, 0),
    fechaRegistro: cell(row, 1),
    usuarioEmail: cell(row, 2),
    usuarioNombre: cell(row, 3),
    fechaDocumento: cell(row, 4),
    comercio: cell(row, 5),
    rutEmisor: cell(row, 6),
    numeroDocumento: cell(row, 7),
    categoria: parseCategoria(cell(row, 8)),
    monto: parseMonto(cell(row, 9)),
    direccion: cell(row, 10),
    observacion: cell(row, 11),
    imagenUrl: cell(row, 12),
    imagenDriveId: cell(row, 13),
    estado: parseEstado(cell(row, 14)),
    fechaCreacion: cell(row, 15),
    usuarioArea: cell(row, 16),
  };
}

/** Lee todos los gastos de la pestaña Gastos (desde la fila 2). */
export async function listGastos(): Promise<Gasto[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Gastos!A2:Q",
  });
  const rows = res.data.values ?? [];
  return rows.map((r) => rowToGasto(r as string[]));
}

/** Agrega un gasto como nueva fila en la pestaña Gastos. */
export async function appendGasto(g: Gasto): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Gastos!A2:Q",
    valueInputOption: "RAW",
    requestBody: { values: [gastoToRow(g)] },
  });
}

function parseRol(v: string): Rol {
  return v === "Administrador" ? "Administrador" : "Usuario";
}

/** Convierte una fila de la pestaña Usuarios en un Usuario. */
export function usuarioRowToUsuario(row: string[]): Usuario {
  return {
    email: cell(row, 0),
    nombre: cell(row, 1),
    rol: parseRol(cell(row, 2)),
    activo: cell(row, 3).toUpperCase() === "TRUE",
    fechaAlta: cell(row, 4),
    rut: cell(row, 5),
    area: cell(row, 6),
  };
}

/**
 * Busca un usuario por email (case-insensitive). Devuelve null si no existe
 * o si está inactivo (activo=FALSE).
 */
export async function getUsuario(email: string): Promise<Usuario | null> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Usuarios!A2:G",
  });
  const rows = (res.data.values ?? []) as string[][];
  const match = rows
    .map(usuarioRowToUsuario)
    .find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!match || !match.activo) return null;
  return match;
}
