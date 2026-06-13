import { describe, it, expect } from "vitest";
import {
  filtrarPorMes,
  totalGastos,
  porCategoria,
  porUsuario,
  tendenciaPorDia,
  contarPendientes,
  mesesDisponibles,
} from "./dashboard";
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
