import { describe, it, expect } from "vitest";
import { formatCLP, parseCLP, formatMes } from "./format";

describe("formatMes", () => {
  it("formatea AAAA-MM como nombre de mes y año", () => {
    expect(formatMes("2026-06")).toBe("Junio 2026");
  });
  it("acepta una fecha completa AAAA-MM-DD", () => {
    expect(formatMes("2026-01-15")).toBe("Enero 2026");
  });
  it("devuelve el input si el mes es inválido", () => {
    expect(formatMes("2026-13")).toBe("2026-13");
  });
});

describe("formatCLP", () => {
  it("formatea entero a pesos con separador de miles", () => {
    expect(formatCLP(45000)).toBe("$45.000");
  });
  it("formatea cero", () => {
    expect(formatCLP(0)).toBe("$0");
  });
  it("formatea millones", () => {
    expect(formatCLP(1234567)).toBe("$1.234.567");
  });
});

describe("parseCLP", () => {
  it("parsea string con símbolo y puntos", () => {
    expect(parseCLP("$45.000")).toBe(45000);
  });
  it("parsea solo dígitos", () => {
    expect(parseCLP("45000")).toBe(45000);
  });
  it("parsea con 'pesos' y espacios", () => {
    expect(parseCLP("45.000 pesos")).toBe(45000);
  });
  it("ignora decimales escritos como ,00", () => {
    expect(parseCLP("$45.000,00")).toBe(45000);
  });
  it("devuelve null si no hay dígitos", () => {
    expect(parseCLP("nada")).toBeNull();
  });
});

import { formatRut, validarRut } from "./format";

describe("formatRut", () => {
  it("formatea RUT con puntos y guión", () => {
    expect(formatRut("765432197")).toBe("76.543.219-7");
  });
  it("acepta dígito verificador K", () => {
    expect(formatRut("10000013K")).toBe("10.000.013-K");
  });
  it("normaliza un RUT que ya viene con formato", () => {
    expect(formatRut("76.543.219-7")).toBe("76.543.219-7");
  });
});

describe("validarRut", () => {
  it("valida un RUT correcto (módulo 11)", () => {
    expect(validarRut("76.543.219-7")).toBe(true);
  });
  it("rechaza un RUT con dígito verificador incorrecto", () => {
    expect(validarRut("76.543.219-8")).toBe(false);
  });
  it("rechaza basura", () => {
    expect(validarRut("hola")).toBe(false);
  });
});
