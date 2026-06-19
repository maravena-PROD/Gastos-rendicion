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
  aprobadosPorTipo,
  rechazados,
  filtrarPorAnio,
  aniosDisponibles,
  porCentroCosto,
  porDimension,
  arbolPorImputacion,
  gastosPorMes,
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

describe("gastosPorMes", () => {
  it("agrupa por mes, de más reciente a más antiguo, con total y gastos por fecha desc", () => {
    const r = gastosPorMes(gastos);
    expect(r.map((m) => [m.anioMes, m.total])).toEqual([
      ["2026-06", 65000],
      ["2026-05", 5000],
    ]);
    // Dentro de junio, el más reciente (2026-06-10) va primero.
    expect(r[0].gastos.map((g) => g.id)).toEqual(["b", "c", "a"]);
  });
  it("devuelve [] para lista vacía", () => {
    expect(gastosPorMes([])).toEqual([]);
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

describe("aprobadosPorTipo", () => {
  it("suma solo Aprobados, separando rendición y devolución", () => {
    const datos = [
      g({ estado: "Aprobado", tipoRendicion: "Rendicion", monto: 1000 }),
      g({ estado: "Aprobado", tipoRendicion: "Devolucion", monto: 500 }),
      g({ estado: "Registrado", tipoRendicion: "Rendicion", monto: 999 }), // ignorado
      g({ estado: "Rechazado", tipoRendicion: "Devolucion", monto: 999 }), // ignorado
    ];
    expect(aprobadosPorTipo(datos)).toEqual({ rendicion: 1000, devolucion: 500, total: 1500 });
  });
});

describe("rechazados", () => {
  it("devuelve solo los gastos en estado Rechazado", () => {
    const datos = [g({ id: "a", estado: "Rechazado" }), g({ id: "b", estado: "Aprobado" })];
    expect(rechazados(datos).map((x) => x.id)).toEqual(["a"]);
  });
});

describe("filtrarPorAnio", () => {
  it("filtra por el año de fechaDocumento", () => {
    const datos = [
      g({ id: "a", fechaDocumento: "2026-06-05" }),
      g({ id: "b", fechaDocumento: "2026-01-31" }),
      g({ id: "c", fechaDocumento: "2025-12-30" }),
    ];
    expect(filtrarPorAnio(datos, "2026").map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("devuelve [] si no hay gastos en el año", () => {
    expect(filtrarPorAnio(gastos, "2020")).toEqual([]);
  });
});

describe("aniosDisponibles", () => {
  it("devuelve los años presentes, de más reciente a más antiguo, sin repetir", () => {
    const datos = [
      g({ fechaDocumento: "2026-06-05" }),
      g({ fechaDocumento: "2026-01-10" }),
      g({ fechaDocumento: "2025-11-20" }),
    ];
    expect(aniosDisponibles(datos)).toEqual(["2026", "2025"]);
  });
});

describe("porCentroCosto", () => {
  function gcc(codigo: string, detalle: string, monto: number, id = ""): Gasto {
    return g({
      id,
      monto,
      imputacion: { ...IMPUTACION_VACIA, centroCostoCodigo: codigo, centroCostoDetalle: detalle },
    });
  }
  it("agrupa por código de CC, conserva el detalle y ordena de mayor a menor", () => {
    const datos = [
      gcc("C0100", "Ventas", 30000),
      gcc("C0200", "Bodega", 60000),
      gcc("C0100", "Ventas", 20000),
    ];
    expect(porCentroCosto(datos)).toEqual([
      { codigo: "C0200", detalle: "Bodega", total: 60000 },
      { codigo: "C0100", detalle: "Ventas", total: 50000 },
    ]);
  });
});

function gImp(monto: number, cc: [string, string], area: [string, string], ubic: [string, string]): Gasto {
  return g({
    monto,
    imputacion: {
      centroCostoCodigo: cc[0], centroCostoDetalle: cc[1],
      areaCodigo: area[0], areaDetalle: area[1],
      ubicacionCodigo: ubic[0], ubicacionDetalle: ubic[1],
    },
  });
}

const imputados = [
  gImp(30000, ["C0200", "Comercial"], ["A1", "Ventas"], ["U1", "Santiago"]),
  gImp(20000, ["C0200", "Comercial"], ["A1", "Ventas"], ["U2", "Talca"]),
  gImp(10000, ["C0200", "Comercial"], ["A2", "Marketing"], ["U1", "Santiago"]),
  gImp(5000, ["C0100", "Bodega"], ["A3", "Logística"], ["U2", "Talca"]),
];

describe("porDimension", () => {
  it("agrupa por área, de mayor a menor", () => {
    expect(porDimension(imputados, "area")).toEqual([
      { codigo: "A1", detalle: "Ventas", total: 50000 },
      { codigo: "A2", detalle: "Marketing", total: 10000 },
      { codigo: "A3", detalle: "Logística", total: 5000 },
    ]);
  });
  it("agrupa por ubicación", () => {
    expect(porDimension(imputados, "ubicacion")).toEqual([
      { codigo: "U1", detalle: "Santiago", total: 40000 },
      { codigo: "U2", detalle: "Talca", total: 25000 },
    ]);
  });
});

describe("arbolPorImputacion", () => {
  it("construye el árbol CC → área → ubicación con total y cantidad, ordenado por total", () => {
    const arbol = arbolPorImputacion(imputados);
    expect(arbol.map((n) => [n.codigo, n.total, n.cantidad])).toEqual([
      ["C0200", 60000, 3],
      ["C0100", 5000, 1],
    ]);
    const comercial = arbol[0];
    expect(comercial.detalle).toBe("Comercial");
    expect(comercial.hijos?.map((n) => [n.codigo, n.total, n.cantidad])).toEqual([
      ["A1", 50000, 2],
      ["A2", 10000, 1],
    ]);
    const a1 = comercial.hijos?.[0];
    expect(a1?.hijos?.map((n) => [n.codigo, n.total, n.cantidad])).toEqual([
      ["U1", 30000, 1],
      ["U2", 20000, 1],
    ]);
  });
});
