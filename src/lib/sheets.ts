import type { Gasto, Categoria, EstadoGasto } from "./types";
import { CATEGORIAS } from "./types";

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
    monto: parseInt(cell(row, 9) || "0", 10),
    direccion: cell(row, 10),
    observacion: cell(row, 11),
    imagenUrl: cell(row, 12),
    imagenDriveId: cell(row, 13),
    estado: parseEstado(cell(row, 14)),
    fechaCreacion: cell(row, 15),
  };
}
