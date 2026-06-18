import { describe, it, expect } from "vitest";
import { construirCamposGasto } from "./gasto-payload";
import type { CentroCostoEntry } from "./types";

const catalogo: CentroCostoEntry[] = [
  { ccCodigo: "C0100", ccDetalle: "Gcia. Operaciones", areaCodigo: "A1010", areaDetalle: "G.Oper", ubicacionCodigo: "T9510", ubicacionDetalle: "Casa Matriz" },
];
const base = {
  comercio: "Copec", monto: 45000, categoria: "Combustible", fechaDocumento: "2026-06-10",
  centroCostoCodigo: "C0100", areaCodigo: "A1010", ubicacionCodigo: "T9510",
  tipoRendicion: "Rendicion", tipoDocumento: "Boleta",
};

describe("construirCamposGasto", () => {
  it("arma los campos cuando el payload es válido", () => {
    const r = construirCamposGasto(base, catalogo);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.campos.imputacion.centroCostoDetalle).toBe("Gcia. Operaciones");
      expect(r.campos.categoria).toBe("Combustible");
      expect(r.campos.rutEmisor).toBe(""); // opcionales ausentes -> ""
      expect(r.campos.tipoRendicion).toBe("Rendicion");
    }
  });
  it("rechaza si faltan datos esenciales", () => {
    const r = construirCamposGasto({ ...base, monto: 0 }, catalogo);
    expect(r).toEqual({ ok: false, error: "Faltan datos esenciales (comercio, monto, categoría, fecha)" });
  });
  it("rechaza si falta la imputación en el payload", () => {
    const r = construirCamposGasto({ ...base, areaCodigo: "" }, catalogo);
    expect(r.ok).toBe(false);
  });
  it("rechaza si la combinación de imputación no existe en el catálogo", () => {
    const r = construirCamposGasto({ ...base, ubicacionCodigo: "T0000" }, catalogo);
    expect(r).toEqual({ ok: false, error: "La combinación de centro de costo / área / ubicación no es válida" });
  });
});
