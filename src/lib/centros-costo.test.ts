import { describe, it, expect } from "vitest";
import {
  centrosCosto,
  areasDe,
  ubicacionesDe,
  resolverImputacion,
  esCombinacionValida,
} from "./centros-costo";
import type { CentroCostoEntry } from "./types";

const catalogo: CentroCostoEntry[] = [
  { ccCodigo: "C0100", ccDetalle: "Gcia. Operaciones", areaCodigo: "A1010", areaDetalle: "G.Oper - Gerencia", ubicacionCodigo: "T9005", ubicacionDetalle: "Serv. Operaciones" },
  { ccCodigo: "C0100", ccDetalle: "Gcia. Operaciones", areaCodigo: "A1010", areaDetalle: "G.Oper - Gerencia", ubicacionCodigo: "T9510", ubicacionDetalle: "Casa Matriz" },
  { ccCodigo: "C0100", ccDetalle: "Gcia. Operaciones", areaCodigo: "A1030", areaDetalle: "G.Oper - Abastecimiento", ubicacionCodigo: "T9510", ubicacionDetalle: "Casa Matriz" },
  { ccCodigo: "C0200", ccDetalle: "Gcia. Comercial", areaCodigo: "A2010", areaDetalle: "G.Com - Gerencia", ubicacionCodigo: "T9510", ubicacionDetalle: "Casa Matriz" },
];

describe("centrosCosto", () => {
  it("devuelve centros de costo distintos en orden de aparición", () => {
    expect(centrosCosto(catalogo)).toEqual([
      { codigo: "C0100", detalle: "Gcia. Operaciones" },
      { codigo: "C0200", detalle: "Gcia. Comercial" },
    ]);
  });
});

describe("areasDe", () => {
  it("devuelve las áreas distintas de un centro de costo", () => {
    expect(areasDe(catalogo, "C0100")).toEqual([
      { codigo: "A1010", detalle: "G.Oper - Gerencia" },
      { codigo: "A1030", detalle: "G.Oper - Abastecimiento" },
    ]);
  });
  it("devuelve [] para un centro de costo inexistente", () => {
    expect(areasDe(catalogo, "C9999")).toEqual([]);
  });
});

describe("ubicacionesDe", () => {
  it("devuelve las ubicaciones distintas de un (cc, área)", () => {
    expect(ubicacionesDe(catalogo, "C0100", "A1010")).toEqual([
      { codigo: "T9005", detalle: "Serv. Operaciones" },
      { codigo: "T9510", detalle: "Casa Matriz" },
    ]);
  });
});

describe("resolverImputacion", () => {
  it("resuelve los detalles de una combinación válida", () => {
    expect(resolverImputacion(catalogo, "C0100", "A1010", "T9510")).toEqual({
      centroCostoCodigo: "C0100",
      centroCostoDetalle: "Gcia. Operaciones",
      areaCodigo: "A1010",
      areaDetalle: "G.Oper - Gerencia",
      ubicacionCodigo: "T9510",
      ubicacionDetalle: "Casa Matriz",
    });
  });
  it("devuelve null si la combinación no existe", () => {
    expect(resolverImputacion(catalogo, "C0100", "A1010", "T0000")).toBeNull();
    expect(resolverImputacion(catalogo, "C0200", "A1010", "T9510")).toBeNull();
  });
});

describe("esCombinacionValida", () => {
  it("true para válida, false para inválida", () => {
    expect(esCombinacionValida(catalogo, "C0100", "A1030", "T9510")).toBe(true);
    expect(esCombinacionValida(catalogo, "C0100", "A1030", "T9005")).toBe(false);
  });
});
