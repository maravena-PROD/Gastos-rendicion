import type { TipoDocumento } from "./types";

const TASA_IVA = 0.19;

/**
 * Decide el desglose Neto/IVA de un gasto.
 * - Si vienen neto e iva del documento, se respetan.
 * - Factura sin desglose: neto = round(total/1.19), iva = total - neto.
 * - Boleta / Otro sin desglose: 0 / 0.
 */
export function calcularNetoIva(
  total: number,
  tipoDocumento: TipoDocumento,
  leido: { neto: number | null; iva: number | null },
): { neto: number; iva: number } {
  if (leido.neto !== null && leido.iva !== null) {
    return { neto: leido.neto, iva: leido.iva };
  }
  if (tipoDocumento === "Factura") {
    const neto = Math.round(total / (1 + TASA_IVA));
    return { neto, iva: total - neto };
  }
  return { neto: 0, iva: 0 };
}
