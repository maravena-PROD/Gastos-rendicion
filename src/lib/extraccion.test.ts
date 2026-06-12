import { describe, it, expect } from "vitest";
import { normalizarCategoria } from "./extraccion";

describe("normalizarCategoria", () => {
  it("acepta una categoría válida exacta", () => {
    expect(normalizarCategoria("Combustible")).toBe("Combustible");
  });
  it("es tolerante a mayúsculas/minúsculas", () => {
    expect(normalizarCategoria("combustible")).toBe("Combustible");
  });
  it("devuelve null para texto no reconocido", () => {
    expect(normalizarCategoria("xyz")).toBeNull();
  });
  it("devuelve null para null o vacío", () => {
    expect(normalizarCategoria(null)).toBeNull();
    expect(normalizarCategoria("")).toBeNull();
  });
});
