import { describe, it, expect } from "vitest";
import {
  centrosCosto,
  areasDe,
  ubicacionesDe,
  resolverImputacion,
  esCombinacionValida,
  puedeIngresarEnCc,
  centrosPermitidos,
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
  it("devuelve [] para un (cc, área) inexistente", () => {
    expect(ubicacionesDe(catalogo, "C9999", "A1010")).toEqual([]);
    expect(ubicacionesDe(catalogo, "C0100", "A9999")).toEqual([]);
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

describe("puedeIngresarEnCc", () => {
  it("permite cualquier CC si el alcance está vacío (compatibilidad: todos)", () => {
    expect(puedeIngresarEnCc([], "C0100")).toBe(true);
  });
  it("permite cualquier CC si el alcance es '*'", () => {
    expect(puedeIngresarEnCc(["*"], "C0999")).toBe(true);
  });
  it("permite solo los CC del alcance acotado", () => {
    expect(puedeIngresarEnCc(["C0200"], "C0200")).toBe(true);
    expect(puedeIngresarEnCc(["C0200"], "C0100")).toBe(false);
  });
  it("trata un alcance indefinido como todos", () => {
    expect(puedeIngresarEnCc(undefined, "C0100")).toBe(true);
  });
});

describe("centrosPermitidos", () => {
  it("filtra el catálogo a los CC permitidos", () => {
    const r = centrosPermitidos(catalogo, ["C0200"]);
    expect(r.every((e) => e.ccCodigo === "C0200")).toBe(true);
    expect(r).toHaveLength(1);
  });
  it("devuelve todo el catálogo si el alcance es vacío o '*'", () => {
    expect(centrosPermitidos(catalogo, [])).toHaveLength(catalogo.length);
    expect(centrosPermitidos(catalogo, ["*"])).toHaveLength(catalogo.length);
  });
});

describe("distintos (guard de código vacío)", () => {
  it("ignora entradas con código vacío", () => {
    const conVacios: CentroCostoEntry[] = [
      { ccCodigo: "", ccDetalle: "sin codigo", areaCodigo: "", areaDetalle: "", ubicacionCodigo: "", ubicacionDetalle: "" },
      { ccCodigo: "C0100", ccDetalle: "Gcia. Operaciones", areaCodigo: "A1010", areaDetalle: "G.Oper - Gerencia", ubicacionCodigo: "T9510", ubicacionDetalle: "Casa Matriz" },
    ];
    expect(centrosCosto(conVacios)).toEqual([{ codigo: "C0100", detalle: "Gcia. Operaciones" }]);
  });
});
