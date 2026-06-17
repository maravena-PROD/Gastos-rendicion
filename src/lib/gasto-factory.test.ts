import { describe, it, expect } from "vitest";
import { crearGasto } from "./gasto-factory";
import { IMPUTACION_VACIA } from "./types";

describe("crearGasto", () => {
  const base = {
    usuarioEmail: "maravena@bosca.cl",
    usuarioNombre: "M. Aravena",
    fechaDocumento: "2026-06-10",
    comercio: "Copec",
    categoria: "Combustible" as const,
    monto: 45000,
    imputacion: {
      centroCostoCodigo: "C0100",
      centroCostoDetalle: "Gcia. Operaciones",
      areaCodigo: "A1010",
      areaDetalle: "G.Oper - Gerencia",
      ubicacionCodigo: "T9510",
      ubicacionDetalle: "Casa Matriz",
    },
    tipoRendicion: "Rendicion" as const,
    tipoDocumento: "Boleta" as const,
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

  it("usa neto/iva 0 por defecto", () => {
    const g = crearGasto({ ...base, imputacion: IMPUTACION_VACIA });
    expect(g.montoNeto).toBe(0);
    expect(g.iva).toBe(0);
    expect(g.tipoRendicion).toBe("Rendicion");
  });

  it("propaga neto/iva cuando se entregan", () => {
    const g = crearGasto({ ...base, imputacion: IMPUTACION_VACIA, tipoDocumento: "Factura", montoNeto: 37815, iva: 7185 });
    expect(g.montoNeto).toBe(37815);
    expect(g.iva).toBe(7185);
  });
});
