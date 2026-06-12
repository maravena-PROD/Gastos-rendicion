import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Usuario } from "./types";

const verificarIdToken = vi.fn();
const getUsuario = vi.fn();

vi.mock("./firebase-admin", () => ({
  verificarIdToken: (...a: unknown[]) => verificarIdToken(...a),
}));
vi.mock("./sheets", () => ({
  getUsuario: (...a: unknown[]) => getUsuario(...a),
}));

import { autenticar } from "./auth-server";

const usuario: Usuario = {
  email: "maravena@bosca.cl",
  nombre: "M. Aravena",
  rol: "Administrador",
  activo: true,
  fechaAlta: "",
  rut: "76.543.219-7",
  area: "Operaciones",
};

beforeEach(() => {
  verificarIdToken.mockReset();
  getUsuario.mockReset();
});

describe("autenticar", () => {
  it("devuelve 401 si el token es inválido (verifyIdToken lanza)", async () => {
    verificarIdToken.mockRejectedValue(new Error("token inválido"));
    const r = await autenticar("malo");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(401);
    expect(getUsuario).not.toHaveBeenCalled();
  });

  it("autentica a un usuario válido y devuelve su sesión", async () => {
    verificarIdToken.mockResolvedValue({ email: "maravena@bosca.cl", name: "M. Aravena", emailVerified: true, uid: "u1" });
    getUsuario.mockResolvedValue(usuario);
    const r = await autenticar("bueno");
    expect(r).toEqual({
      ok: true,
      usuario: { email: "maravena@bosca.cl", nombre: "M. Aravena", rol: "Administrador", area: "Operaciones" },
    });
    expect(getUsuario).toHaveBeenCalledWith("maravena@bosca.cl");
  });

  it("devuelve 403 si el usuario no está en la planilla", async () => {
    verificarIdToken.mockResolvedValue({ email: "nuevo@bosca.cl", name: "Nuevo", emailVerified: true, uid: "u2" });
    getUsuario.mockResolvedValue(null);
    const r = await autenticar("bueno");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});
