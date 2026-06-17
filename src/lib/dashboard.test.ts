import { describe, it, expect } from "vitest";
import {
  filtrarPorMes,
  totalGastos,
  porCategoria,
  porUsuario,
  tendenciaPorDia,
  contarPendientes,
  mesesDisponibles,
  filtrarPorRango,
  porTipoRendicion,
} from "./dashboard";
import { IMPUTACION_VACIA } from "./types";
import type { Gasto } from "./types";

function g(parcial: Partial<Gasto>): Gasto {
  return {
    id: "",
    fechaRegistro: "",
    usuarioEmail: "",
    usuarioNombre: "",
    fechaDocumento: "2026-06-10",
    comercio: "",
    rutEmisor: "",
    numeroDocumento: "",
    categoria: "Otros",
    monto: 0,
    direccion: "",
    observacion: "",
    imagenUrl: "",
    imagenDriveId: "",
    estado: "Registrado",
    fechaCreacion: "",
    usuarioArea: "",
    imputacion: IMPUTACION_VACIA,
    tipoRendicion: "Rendicion",
    tipoDocumento: "Boleta",
    montoNeto: 0,
    iva: 0,
    aprobadoPor: "",
    fechaDecision: "",
    motivo: "",
    ...parcial,
  };
}

const gastos: Gasto[] = [
  g({ id: "a", fechaDocumento: "2026-06-05", categoria: "Combustible", monto: 30000, usuarioNombre: "Ana", estado: "Registrado" }),
  g({ id: "b", fechaDocumento: "2026-06-10", categoria: "Combustible", monto: 20000, usuarioNombre: "Beto", estado: "Aprobado" }),
  g({ id: "c", fechaDocumento: "2026-06-10", categoria: "Alimentación", monto: 15000, usuarioNombre: "Ana", estado: "Registrado" }),
  g({ id: "d", fechaDocumento: "2026-05-20", categoria: "Peajes", monto: 5000, usuarioNombre: "Ana", estado: "Registrado" }),
];

describe("filtrarPorMes", () => {
  it("filtra por fechaDocumento del año-mes dado", () => {
    const r = filtrarPorMes(gastos, "2026-06");
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("devuelve [] si no hay gastos en el mes", () => {
    expect(filtrarPorMes(gastos, "2026-01")).toEqual([]);
  });
});

describe("totalGastos", () => {
  it("suma los montos", () => {
    expect(totalGastos(gastos)).toBe(70000);
  });
  it("0 para lista vacía", () => {
    expect(totalGastos([])).toBe(0);
  });
});

describe("porCategoria", () => {
  it("agrupa por categoría y ordena de mayor a menor", () => {
    const r = porCategoria(filtrarPorMes(gastos, "2026-06"));
    expect(r).toEqual([
      { categoria: "Combustible", total: 50000 },
      { categoria: "Alimentación", total: 15000 },
    ]);
  });
});

describe("porUsuario", () => {
  it("agrupa por usuario y ordena de mayor a menor", () => {
    const r = porUsuario(filtrarPorMes(gastos, "2026-06"));
    expect(r).toEqual([
      { usuario: "Ana", total: 45000 },
      { usuario: "Beto", total: 20000 },
    ]);
  });
});

describe("tendenciaPorDia", () => {
  it("agrupa por día y ordena cronológicamente", () => {
    const r = tendenciaPorDia(filtrarPorMes(gastos, "2026-06"));
    expect(r).toEqual([
      { fecha: "2026-06-05", total: 30000 },
      { fecha: "2026-06-10", total: 35000 },
    ]);
  });
});

describe("contarPendientes", () => {
  it("cuenta los gastos en estado Registrado", () => {
    expect(contarPendientes(gastos)).toBe(3);
  });
});

describe("mesesDisponibles", () => {
  it("devuelve los año-meses presentes, de más reciente a más antiguo", () => {
    expect(mesesDisponibles(gastos)).toEqual(["2026-06", "2026-05"]);
  });
});

function gR(fechaDocumento: string, monto: number, tipoRendicion: "Rendicion" | "Devolucion"): Gasto {
  return {
    id: "x", fechaRegistro: "", usuarioEmail: "", usuarioNombre: "",
    fechaDocumento, comercio: "", rutEmisor: "", numeroDocumento: "",
    categoria: "Otros", monto, direccion: "", observacion: "",
    imagenUrl: "", imagenDriveId: "", estado: "Registrado", fechaCreacion: "",
    usuarioArea: "", imputacion: {
      centroCostoCodigo: "", centroCostoDetalle: "", areaCodigo: "",
      areaDetalle: "", ubicacionCodigo: "", ubicacionDetalle: "",
    },
    tipoRendicion, tipoDocumento: "Boleta", montoNeto: 0, iva: 0,
    aprobadoPor: "", fechaDecision: "", motivo: "",
  };
}

describe("filtrarPorRango", () => {
  const gastosRango = [gR("2026-06-01", 100, "Rendicion"), gR("2026-06-15", 200, "Devolucion"), gR("2026-07-01", 300, "Rendicion")];

  it("incluye ambos extremos del rango", () => {
    const r = filtrarPorRango(gastosRango, "2026-06-01", "2026-06-15");
    expect(r.map((x) => x.monto)).toEqual([100, 200]);
  });

  it("excluye fechas fuera del rango", () => {
    expect(filtrarPorRango(gastosRango, "2026-06-16", "2026-06-30")).toEqual([]);
  });
});

describe("porTipoRendicion", () => {
  it("suma montos por tipo", () => {
    const gastosT = [gR("2026-06-01", 100, "Rendicion"), gR("2026-06-02", 200, "Devolucion"), gR("2026-06-03", 50, "Devolucion")];
    expect(porTipoRendicion(gastosT)).toEqual({ rendicion: 100, devolucion: 250 });
  });
});
