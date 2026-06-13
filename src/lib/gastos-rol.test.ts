import { describe, it, expect } from "vitest";
import { filtrarGastosPorRol } from "./gastos-rol";
import type { Gasto } from "./types";
import type { SesionUsuario } from "./auth";

function gasto(email: string, id: string): Gasto {
  return {
    id,
    fechaRegistro: "",
    usuarioEmail: email,
    usuarioNombre: "",
    fechaDocumento: "",
    comercio: "",
    rutEmisor: "",
    numeroDocumento: "",
    categoria: "Otros",
    monto: 1000,
    direccion: "",
    observacion: "",
    imagenUrl: "",
    imagenDriveId: "",
    estado: "Registrado",
    fechaCreacion: "",
    usuarioArea: "",
  };
}

const gastos: Gasto[] = [
  gasto("maravena@bosca.cl", "g1"),
  gasto("otro@bosca.cl", "g2"),
  gasto("maravena@bosca.cl", "g3"),
];

describe("filtrarGastosPorRol", () => {
  it("un Administrador ve todos los gastos", () => {
    const admin: SesionUsuario = { email: "jefe@bosca.cl", nombre: "Jefe", rol: "Administrador", area: "" };
    expect(filtrarGastosPorRol(gastos, admin)).toHaveLength(3);
  });
  it("un Usuario ve solo sus gastos (match por email, case-insensitive)", () => {
    const usuario: SesionUsuario = { email: "MARAVENA@bosca.cl", nombre: "M", rol: "Usuario", area: "" };
    const r = filtrarGastosPorRol(gastos, usuario);
    expect(r.map((g) => g.id)).toEqual(["g1", "g3"]);
  });
});
