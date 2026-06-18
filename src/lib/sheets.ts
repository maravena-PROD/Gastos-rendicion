import type {
  Gasto, Categoria, EstadoGasto, Usuario, Rol, CentroCostoEntry,
  TipoRendicion, TipoDocumento,
} from "./types";
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
  "centro_costo_codigo",
  "centro_costo",
  "area_codigo",
  "area",
  "ubicacion_codigo",
  "ubicacion",
  "tipo_rendicion",
  "tipo_documento",
  "monto_neto",
  "iva",
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
    g.imputacion.centroCostoCodigo,
    g.imputacion.centroCostoDetalle,
    g.imputacion.areaCodigo,
    g.imputacion.areaDetalle,
    g.imputacion.ubicacionCodigo,
    g.imputacion.ubicacionDetalle,
    g.tipoRendicion,
    g.tipoDocumento,
    String(g.montoNeto),
    String(g.iva),
    g.aprobadoPor,
    g.fechaDecision,
    g.motivo,
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

function parseTipoRendicion(v: string): TipoRendicion {
  return v === "Devolucion" ? "Devolucion" : "Rendicion";
}

function parseTipoDocumento(v: string): TipoDocumento {
  return v === "Boleta" || v === "Factura" || v === "Otro" ? v : "Otro";
}

function parseApruebaCc(v: string): string[] {
  const s = v.trim();
  if (s === "*") return ["*"];
  return s.split(",").map((x) => x.trim()).filter((x) => x !== "");
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
    imputacion: {
      centroCostoCodigo: cell(row, 17),
      centroCostoDetalle: cell(row, 18),
      areaCodigo: cell(row, 19),
      areaDetalle: cell(row, 20),
      ubicacionCodigo: cell(row, 21),
      ubicacionDetalle: cell(row, 22),
    },
    tipoRendicion: parseTipoRendicion(cell(row, 23)),
    tipoDocumento: parseTipoDocumento(cell(row, 24)),
    montoNeto: parseMonto(cell(row, 25)),
    iva: parseMonto(cell(row, 26)),
    aprobadoPor: cell(row, 27),
    fechaDecision: cell(row, 28),
    motivo: cell(row, 29),
  };
}

/** Lee todos los gastos de la pestaña Gastos (desde la fila 2). */
export async function listGastos(): Promise<Gasto[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Gastos!A2:AD",
  });
  const rows = res.data.values ?? [];
  return rows.map((r) => rowToGasto(r as string[]));
}

/** Agrega un gasto como nueva fila en la pestaña Gastos. */
export async function appendGasto(g: Gasto): Promise<void> {
  const sheets = getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Gastos!A2:AD",
    valueInputOption: "RAW",
    requestBody: { values: [gastoToRow(g)] },
  });
}

/** Reescribe la fila de un gasto (localizada por id en col A) con sus campos actuales. */
export async function actualizarGasto(gasto: Gasto): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Gastos!A2:AD",
  });
  const rows = (res.data.values ?? []) as string[][];
  const idx = rows.findIndex((r) => (r[0] ?? "") === gasto.id);
  if (idx === -1) throw new Error("Gasto no encontrado");
  const numeroFila = idx + 2; // fila 1 = encabezados
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Gastos!A${numeroFila}:AD${numeroFila}`,
    valueInputOption: "RAW",
    requestBody: { values: [gastoToRow(gasto)] },
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
    banco: cell(row, 7),
    cuentaCorriente: cell(row, 8),
    apruebaCc: parseApruebaCc(cell(row, 9)),
    cargo: cell(row, 10),
  };
}

/**
 * Actualiza el perfil (nombre, rut, area) de un usuario en la pestaña Usuarios,
 * preservando rol, activo y fecha_alta. Lanza si el usuario no existe.
 */
export async function actualizarPerfilUsuario(
  email: string,
  perfil: { nombre: string; rut: string; area: string; banco?: string; cuentaCorriente?: string },
): Promise<void> {
  const sheets = getSheetsClient();
  const spreadsheetId = getEnv("GOOGLE_SHEETS_ID");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Usuarios!A2:I",
  });
  const rows = (res.data.values ?? []) as string[][];
  const idx = rows.findIndex((r) => (r[0] ?? "").toLowerCase() === email.toLowerCase());
  if (idx === -1) throw new Error("Usuario no encontrado");
  const fila = rows[idx];
  const filaActualizada = [
    fila[0] ?? email, // email
    perfil.nombre, // nombre
    fila[2] ?? "Usuario", // rol (preservado)
    fila[3] ?? "TRUE", // activo (preservado)
    fila[4] ?? "", // fecha_alta (preservada)
    perfil.rut, // rut
    perfil.area, // area
    perfil.banco ?? fila[7] ?? "", // banco (preservado si no se envía)
    perfil.cuentaCorriente ?? fila[8] ?? "", // cuenta_corriente (preservado si no se envía)
  ];
  const numeroFila = idx + 2; // fila 1 = encabezados
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Usuarios!A${numeroFila}:I${numeroFila}`,
    valueInputOption: "RAW",
    requestBody: { values: [filaActualizada] },
  });
}

/** Lee las áreas de trabajo válidas de la pestaña Areas (columna A, desde fila 2). */
export async function listarAreas(): Promise<string[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Areas!A2:A",
  });
  const rows = (res.data.values ?? []) as string[][];
  return rows.map((r) => (r[0] ?? "").trim()).filter((a) => a !== "");
}

/** Lee el catálogo de imputación de la pestaña CentrosCosto (A2:F, desde fila 2). */
export async function listarCentrosCosto(): Promise<CentroCostoEntry[]> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "CentrosCosto!A2:F",
  });
  const rows = (res.data.values ?? []) as string[][];
  return rows
    .filter((r) => (r[0] ?? "").trim() !== "")
    .map((r) => ({
      ccCodigo: cell(r, 0),
      ccDetalle: cell(r, 1),
      areaCodigo: cell(r, 2),
      areaDetalle: cell(r, 3),
      ubicacionCodigo: cell(r, 4),
      ubicacionDetalle: cell(r, 5),
    }));
}

/**
 * Busca un usuario por email (case-insensitive). Devuelve null si no existe
 * o si está inactivo (activo=FALSE).
 */
export async function getUsuario(email: string): Promise<Usuario | null> {
  const sheets = getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: getEnv("GOOGLE_SHEETS_ID"),
    range: "Usuarios!A2:K",
  });
  const rows = (res.data.values ?? []) as string[][];
  const match = rows
    .map(usuarioRowToUsuario)
    .find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!match || !match.activo) return null;
  return match;
}
