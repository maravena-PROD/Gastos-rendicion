import { describe, it, expect } from "vitest";
import { calcularNetoIva } from "./montos";

describe("calcularNetoIva", () => {
  it("respeta neto e IVA cuando vienen del documento", () => {
    expect(calcularNetoIva(45000, "Factura", { neto: 37800, iva: 7200 })).toEqual({
      neto: 37800,
      iva: 7200,
    });
  });

  it("Factura sin desglose: calcula neto = round(total/1.19) e iva = total - neto", () => {
    const r = calcularNetoIva(45000, "Factura", { neto: null, iva: null });
    expect(r.neto).toBe(37815); // round(45000/1.19) = 37815
    expect(r.iva).toBe(7185); // 45000 - 37815
    expect(r.neto + r.iva).toBe(45000);
  });

  it("Boleta sin desglose: neto e iva quedan en 0", () => {
    expect(calcularNetoIva(10000, "Boleta", { neto: null, iva: null })).toEqual({
      neto: 0,
      iva: 0,
    });
  });

  it("Boleta con IVA leído lo respeta", () => {
    expect(calcularNetoIva(11900, "Boleta", { neto: 10000, iva: 1900 })).toEqual({
      neto: 10000,
      iva: 1900,
    });
  });

  it("Otro sin desglose: 0/0", () => {
    expect(calcularNetoIva(5000, "Otro", { neto: null, iva: null })).toEqual({
      neto: 0,
      iva: 0,
    });
  });
});
