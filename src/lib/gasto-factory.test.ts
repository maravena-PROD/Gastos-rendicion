import { describe, it, expect } from "vitest";
import { crearGasto } from "./gasto-factory";

describe("crearGasto", () => {
  const base = {
    usuarioEmail: "maravena@bosca.cl",
    usuarioNombre: "M. Aravena",
    fechaDocumento: "2026-06-10",
    comercio: "Copec",
    categoria: "Combustible" as const,
    monto: 45000,
  };

  it("genera un id con prefijo g_", () => {
    const g = crearGasto(base);
    expect(g.id).toMatch(/^g_/);
  });

  it("pone estado Registrado por defecto", () => {
    expect(crearGasto(base).estado).toBe("Registrado");
  });

  it("rellena campos opcionales como string vacío", () => {
    const g = crearGasto(base);
    expect(g.rutEmisor).toBe("");
    expect(g.observacion).toBe("");
    expect(g.imagenUrl).toBe("");
  });

  it("respeta campos opcionales cuando se entregan", () => {
    const g = crearGasto({ ...base, rutEmisor: "76.123.456-7", observacion: "flota" });
    expect(g.rutEmisor).toBe("76.123.456-7");
    expect(g.observacion).toBe("flota");
  });

  it("fechaRegistro y fechaCreacion son ISO 8601", () => {
    const g = crearGasto(base);
    expect(() => new Date(g.fechaRegistro).toISOString()).not.toThrow();
    expect(g.fechaCreacion).toContain("T");
  });

  it("genera ids distintos en llamadas sucesivas", () => {
    expect(crearGasto(base).id).not.toBe(crearGasto(base).id);
  });
});
