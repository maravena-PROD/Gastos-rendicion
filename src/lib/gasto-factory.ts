import { randomUUID } from "crypto";
import type { Gasto, Categoria, Imputacion, TipoRendicion, TipoDocumento } from "./types";

/** Datos mínimos para crear un gasto; el resto se rellena con defaults. */
export interface NuevoGastoInput {
  usuarioEmail: string;
  usuarioNombre: string;
  fechaDocumento: string;
  comercio: string;
  categoria: Categoria;
  monto: number;
  rutEmisor?: string;
  numeroDocumento?: string;
  direccion?: string;
  observacion?: string;
  imagenUrl?: string;
  imagenDriveId?: string;
  usuarioArea?: string;
  imputacion: Imputacion;
  tipoRendicion: TipoRendicion;
  tipoDocumento: TipoDocumento;
  montoNeto?: number;
  iva?: number;
}

/** Arma un Gasto completo a partir de los datos extraídos, con id y timestamps. */
export function crearGasto(input: NuevoGastoInput): Gasto {
  const ahora = new Date().toISOString();
  return {
    id: `g_${randomUUID().slice(0, 8)}`,
    fechaRegistro: ahora,
    usuarioEmail: input.usuarioEmail,
    usuarioNombre: input.usuarioNombre,
    fechaDocumento: input.fechaDocumento,
    comercio: input.comercio,
    rutEmisor: input.rutEmisor ?? "",
    numeroDocumento: input.numeroDocumento ?? "",
    categoria: input.categoria,
    monto: input.monto,
    direccion: input.direccion ?? "",
    observacion: input.observacion ?? "",
    imagenUrl: input.imagenUrl ?? "",
    imagenDriveId: input.imagenDriveId ?? "",
    estado: "Registrado",
    fechaCreacion: ahora,
    usuarioArea: input.usuarioArea ?? "",
    imputacion: input.imputacion,
    tipoRendicion: input.tipoRendicion,
    tipoDocumento: input.tipoDocumento,
    montoNeto: input.montoNeto ?? 0,
    iva: input.iva ?? 0,
    aprobadoPor: "",
    fechaDecision: "",
    motivo: "",
  };
}
