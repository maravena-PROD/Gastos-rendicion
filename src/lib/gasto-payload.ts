import type { Categoria, Imputacion, TipoRendicion, TipoDocumento, CentroCostoEntry } from "./types";
import { normalizarCategoria } from "./extraccion";
import { resolverImputacion } from "./centros-costo";
import { calcularNetoIva } from "./montos";

export interface PayloadGasto {
  comercio?: string; monto?: number; categoria?: string; fechaDocumento?: string;
  rutEmisor?: string; numeroDocumento?: string; direccion?: string; observacion?: string;
  centroCostoCodigo?: string; areaCodigo?: string; ubicacionCodigo?: string;
  tipoRendicion?: string; tipoDocumento?: string; montoNeto?: number; iva?: number;
}

export interface CamposGasto {
  comercio: string; monto: number; categoria: Categoria; fechaDocumento: string;
  rutEmisor: string; numeroDocumento: string; direccion: string; observacion: string;
  imputacion: Imputacion; tipoRendicion: TipoRendicion; tipoDocumento: TipoDocumento;
  montoNeto: number; iva: number;
}

export type ResultadoCampos = { ok: true; campos: CamposGasto } | { ok: false; error: string };

/** Valida el payload y arma los campos comunes de un gasto. Errores = 400. */
export function construirCamposGasto(body: PayloadGasto, catalogo: CentroCostoEntry[]): ResultadoCampos {
  const categoria = normalizarCategoria(body.categoria ?? null);
  if (
    !body.comercio ||
    typeof body.monto !== "number" ||
    !Number.isInteger(body.monto) ||
    body.monto <= 0 ||
    !categoria ||
    !body.fechaDocumento
  ) {
    return { ok: false, error: "Faltan datos esenciales (comercio, monto, categoría, fecha)" };
  }
  if (!body.centroCostoCodigo || !body.areaCodigo || !body.ubicacionCodigo) {
    return { ok: false, error: "Falta la imputación: centro de costo, área y ubicación" };
  }
  const imputacion = resolverImputacion(catalogo, body.centroCostoCodigo, body.areaCodigo, body.ubicacionCodigo);
  if (!imputacion) {
    return { ok: false, error: "La combinación de centro de costo / área / ubicación no es válida" };
  }
  const tipoRendicion: TipoRendicion = body.tipoRendicion === "Devolucion" ? "Devolucion" : "Rendicion";
  const tipoDocumento: TipoDocumento =
    body.tipoDocumento === "Boleta" || body.tipoDocumento === "Factura" ? body.tipoDocumento : "Otro";
  const { neto, iva } = calcularNetoIva(body.monto, tipoDocumento, {
    neto: typeof body.montoNeto === "number" && Number.isFinite(body.montoNeto) && body.montoNeto >= 0 ? body.montoNeto : null,
    iva: typeof body.iva === "number" && Number.isFinite(body.iva) && body.iva >= 0 ? body.iva : null,
  });
  return {
    ok: true,
    campos: {
      comercio: body.comercio,
      monto: body.monto,
      categoria,
      fechaDocumento: body.fechaDocumento,
      rutEmisor: body.rutEmisor ?? "",
      numeroDocumento: body.numeroDocumento ?? "",
      direccion: body.direccion ?? "",
      observacion: body.observacion ?? "",
      imputacion,
      tipoRendicion,
      tipoDocumento,
      montoNeto: neto,
      iva,
    },
  };
}
