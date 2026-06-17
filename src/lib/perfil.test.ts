import { describe, it, expect } from "vitest";
import { perfilCompleto } from "./perfil";
import type { Usuario } from "./types";

function usuario(parcial: Partial<Usuario>): Usuario {
  return {
    email: "x@bosca.cl",
    nombre: "X",
    rol: "Usuario",
    activo: true,
    fechaAlta: "",
    rut: "",
    area: "",
    banco: "",
    cuentaCorriente: "",
    ...parcial,
  };
}

describe("perfilCompleto", () => {
  it("true cuando nombre, rut y area están presentes", () => {
    expect(
      perfilCompleto(usuario({ nombre: "Ana", rut: "76.543.219-7", area: "Operaciones" })),
    ).toBe(true);
  });
  it("false si falta el nombre", () => {
    expect(perfilCompleto(usuario({ nombre: "", rut: "76.543.219-7", area: "Operaciones" }))).toBe(
      false,
    );
  });
  it("false si el nombre es solo espacios", () => {
    expect(
      perfilCompleto(usuario({ nombre: "   ", rut: "76.543.219-7", area: "Operaciones" })),
    ).toBe(false);
  });
  it("false si falta el rut", () => {
    expect(perfilCompleto(usuario({ area: "Operaciones" }))).toBe(false);
  });
  it("false si falta el area", () => {
    expect(perfilCompleto(usuario({ rut: "76.543.219-7" }))).toBe(false);
  });
  it("false si están en blanco con espacios", () => {
    expect(perfilCompleto(usuario({ rut: "  ", area: "  " }))).toBe(false);
  });
});
