import type { Gasto, Usuario } from "./types";
import { porTipoRendicion } from "./dashboard";

export interface CabeceraReporte {
  nombre: string;
  rut: string;
  banco: string;
  cuentaCorriente: string;
  correo: string;
  fechaRendicion: string; // YYYY-MM-DD
  desde: string;
  hasta: string;
}

export interface FilaReporte {
  fechaCompra: string;
  proveedor: string;
  centroCosto: string;
  area: string;
  ubicacion: string;
  tipoDocumento: string;
  numeroDocumento: string;
  descripcion: string;
  neto: number;
  iva: number;
  total: number;
  tipoRendicion: string;
}

export interface TotalesReporte {
  neto: number;
  iva: number;
  total: number;
  rendicion: number;
  devolucion: number;
}

export interface ModeloReporte {
  cabecera: CabeceraReporte;
  filas: FilaReporte[];
  totales: TotalesReporte;
}

/** Arma el modelo del reporte a partir del usuario, sus gastos y el rango. */
export function construirReporte(
  usuario: Usuario,
  gastos: Gasto[],
  opts: { desde: string; hasta: string; fechaRendicion: string },
): ModeloReporte {
  const filas: FilaReporte[] = gastos.map((g) => ({
    fechaCompra: g.fechaDocumento,
    proveedor: g.comercio,
    centroCosto: g.imputacion.centroCostoCodigo,
    area: g.imputacion.areaCodigo,
    ubicacion: g.imputacion.ubicacionCodigo,
    tipoDocumento: g.tipoDocumento,
    numeroDocumento: g.numeroDocumento,
    descripcion: g.observacion,
    neto: g.montoNeto,
    iva: g.iva,
    total: g.monto,
    tipoRendicion: g.tipoRendicion,
  }));

  const tipos = porTipoRendicion(gastos);
  const totales: TotalesReporte = {
    neto: gastos.reduce((a, g) => a + g.montoNeto, 0),
    iva: gastos.reduce((a, g) => a + g.iva, 0),
    total: gastos.reduce((a, g) => a + g.monto, 0),
    rendicion: tipos.rendicion,
    devolucion: tipos.devolucion,
  };

  return {
    cabecera: {
      nombre: usuario.nombre,
      rut: usuario.rut,
      banco: usuario.banco,
      cuentaCorriente: usuario.cuentaCorriente,
      correo: usuario.email,
      fechaRendicion: opts.fechaRendicion,
      desde: opts.desde,
      hasta: opts.hasta,
    },
    filas,
    totales,
  };
}
