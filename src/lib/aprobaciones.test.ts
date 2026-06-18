import { describe, it, expect } from "vitest";
import { tieneAlcance, puedeAprobar, gastosPorAprobar, puedeEditar, gastosEnAlcance } from "./aprobaciones";
import type { SesionUsuario } from "./auth";
import type { Gasto } from "./types";

function sesion(p: Partial<SesionUsuario>): SesionUsuario {
  return { email: "ger@bosca.cl", nombre: "Ger", rol: "Usuario", area: "", apruebaCc: [], ...p };
}
function gasto(p: Partial<Gasto>): Gasto {
  return {
    id: "g1", fechaRegistro: "", usuarioEmail: "user@bosca.cl", usuarioNombre: "User",
    fechaDocumento: "2026-06-10", comercio: "X", rutEmisor: "", numeroDocumento: "",
    categoria: "Otros", monto: 1000, direccion: "", observacion: "", imagenUrl: "",
    imagenDriveId: "", estado: "Registrado", fechaCreacion: "", usuarioArea: "",
    imputacion: { centroCostoCodigo: "C0100", centroCostoDetalle: "", areaCodigo: "", areaDetalle: "", ubicacionCodigo: "", ubicacionDetalle: "" },
    tipoRendicion: "Rendicion", tipoDocumento: "Otro", montoNeto: 0, iva: 0,
    aprobadoPor: "", fechaDecision: "", motivo: "", ...p,
  };
}

describe("tieneAlcance", () => {
  it("'*' cubre cualquier CC", () => expect(tieneAlcance(["*"], "C0999")).toBe(true));
  it("incluye el CC exacto", () => expect(tieneAlcance(["C0100", "C0200"], "C0200")).toBe(true));
  it("false si el CC no está", () => expect(tieneAlcance(["C0100"], "C0300")).toBe(false));
  it("false si no aprueba nada", () => expect(tieneAlcance([], "C0100")).toBe(false));
});

describe("puedeAprobar", () => {
  it("gerente aprueba un gasto pendiente de su CC (de otro usuario)", () => {
    expect(puedeAprobar(sesion({ apruebaCc: ["C0100"] }), gasto({}))).toBe(true);
  });
  it("no puede si el gasto no está Registrado", () => {
    expect(puedeAprobar(sesion({ apruebaCc: ["C0100"] }), gasto({ estado: "Aprobado" }))).toBe(false);
  });
  it("no puede si el CC está fuera de su alcance", () => {
    expect(puedeAprobar(sesion({ apruebaCc: ["C0200"] }), gasto({}))).toBe(false);
  });
  it("alcance acotado NO puede auto-aprobar", () => {
    expect(puedeAprobar(sesion({ email: "ger@bosca.cl", apruebaCc: ["C0100"] }), gasto({ usuarioEmail: "GER@bosca.cl" }))).toBe(false);
  });
  it("alcance '*' SÍ puede aprobar gastos propios", () => {
    expect(puedeAprobar(sesion({ email: "gg@bosca.cl", apruebaCc: ["*"] }), gasto({ usuarioEmail: "gg@bosca.cl" }))).toBe(true);
  });
});

describe("gastosPorAprobar", () => {
  it("devuelve solo los que la sesión puede decidir", () => {
    const s = sesion({ email: "ger@bosca.cl", apruebaCc: ["C0100"] });
    const lista = [
      gasto({ id: "a" }), // C0100, de otro, Registrado -> sí
      gasto({ id: "b", estado: "Aprobado" }), // ya decidido -> no
      gasto({ id: "c", imputacion: { centroCostoCodigo: "C0200", centroCostoDetalle: "", areaCodigo: "", areaDetalle: "", ubicacionCodigo: "", ubicacionDetalle: "" } }), // otro CC -> no
      gasto({ id: "d", usuarioEmail: "ger@bosca.cl" }), // propio -> no (acotado)
    ];
    expect(gastosPorAprobar(lista, s).map((g) => g.id)).toEqual(["a"]);
  });
});

describe("gastosEnAlcance", () => {
  function gCc(id: string, cc: string): Gasto {
    return gasto({ id, imputacion: { centroCostoCodigo: cc, centroCostoDetalle: "", areaCodigo: "", areaDetalle: "", ubicacionCodigo: "", ubicacionDetalle: "" } });
  }
  const lista = [gCc("a", "C0100"), gCc("b", "C0200"), gCc("c", "C0300")];

  it("incluye solo los gastos cuyo CC está en el alcance", () => {
    expect(gastosEnAlcance(lista, ["C0100", "C0300"]).map((g) => g.id)).toEqual(["a", "c"]);
  });
  it("'*' incluye todos", () => {
    expect(gastosEnAlcance(lista, ["*"]).map((g) => g.id)).toEqual(["a", "b", "c"]);
  });
  it("alcance vacío no incluye ninguno", () => {
    expect(gastosEnAlcance(lista, [])).toEqual([]);
  });
});

describe("puedeEditar", () => {
  it("el dueño puede editar su gasto Rechazado", () => {
    expect(puedeEditar(sesion({ email: "u@bosca.cl" }), gasto({ estado: "Rechazado", usuarioEmail: "U@bosca.cl" }))).toBe(true);
  });
  it("no puede si no es Rechazado", () => {
    expect(puedeEditar(sesion({ email: "u@bosca.cl" }), gasto({ estado: "Registrado", usuarioEmail: "u@bosca.cl" }))).toBe(false);
    expect(puedeEditar(sesion({ email: "u@bosca.cl" }), gasto({ estado: "Aprobado", usuarioEmail: "u@bosca.cl" }))).toBe(false);
  });
  it("no puede editar el gasto de otro", () => {
    expect(puedeEditar(sesion({ email: "u@bosca.cl" }), gasto({ estado: "Rechazado", usuarioEmail: "otro@bosca.cl" }))).toBe(false);
  });
});
