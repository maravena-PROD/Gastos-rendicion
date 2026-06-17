import { describe, it, expect, vi } from "vitest";
import { asegurarCuentaDevolucion } from "./gasto-cuenta";
import type { Usuario } from "./types";

function usuario(p: Partial<Usuario>): Usuario {
  return { email: "u@bosca.cl", nombre: "U", rol: "Usuario", activo: true, fechaAlta: "", rut: "1-9", area: "Op", banco: "", cuentaCorriente: "", apruebaCc: [], cargo: "", ...p };
}

describe("asegurarCuentaDevolucion", () => {
  it("ok si el perfil ya tiene banco y cuenta (no escribe)", async () => {
    const actualizar = vi.fn();
    const r = await asegurarCuentaDevolucion("u@bosca.cl", {}, {
      getUsuario: async () => usuario({ banco: "Santander", cuentaCorriente: "123" }),
      actualizarPerfilUsuario: actualizar,
    });
    expect(r).toEqual({ ok: true });
    expect(actualizar).not.toHaveBeenCalled();
  });
  it("400 si no hay cuenta ni en perfil ni en payload", async () => {
    const r = await asegurarCuentaDevolucion("u@bosca.cl", {}, {
      getUsuario: async () => usuario({}),
      actualizarPerfilUsuario: vi.fn(),
    });
    expect(r).toEqual({ ok: false, status: 400, error: "Una devolución requiere banco y cuenta corriente" });
  });
  it("persiste y queda ok si vienen en el payload", async () => {
    const actualizar = vi.fn(async () => {});
    const r = await asegurarCuentaDevolucion("u@bosca.cl", { banco: " BCI ", cuentaCorriente: " 999 " }, {
      getUsuario: async () => usuario({}),
      actualizarPerfilUsuario: actualizar,
    });
    expect(r).toEqual({ ok: true });
    expect(actualizar).toHaveBeenCalledWith("u@bosca.cl", expect.objectContaining({ banco: "BCI", cuentaCorriente: "999" }));
  });
});
