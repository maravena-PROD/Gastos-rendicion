import { describe, it, expect } from "vitest";
import { formatCLP, parseCLP } from "./format";

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
