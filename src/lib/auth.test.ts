import { describe, it, expect } from "vitest";
import { decidirAcceso, tieneRol, getBearerToken, DOMINIO_PERMITIDO } from "./auth";
import type { Usuario } from "./types";

const usuarioAdmin: Usuario = {
  email: "maravena@bosca.cl",
  nombre: "M. Aravena",
  rol: "Administrador",
  activo: true,
  fechaAlta: "2026-06-01T00:00:00Z",
  rut: "76.543.219-7",
  area: "Operaciones",
  banco: "",
  cuentaCorriente: "",
  apruebaCc: [],
  cargo: "",
};

describe("decidirAcceso", () => {
  it("permite a un usuario válido del dominio y devuelve su sesión", () => {
    const r = decidirAcceso({ email: "maravena@bosca.cl", name: "M. Aravena", emailVerified: true }, usuarioAdmin);
    expect(r).toEqual({
      ok: true,
      usuario: {
        email: "maravena@bosca.cl",
        nombre: "M. Aravena",
        rol: "Administrador",
        area: "Operaciones",
        apruebaCc: ["*"], // Administrador => alcance total
        ingresaCc: ["*"], // Administrador => ingresa en todos
      },
    });
  });

  it("un gerente conserva su alcance de aprobación", () => {
    const gerente: Usuario = { ...usuarioAdmin, rol: "Usuario", apruebaCc: ["C0200"] };
    const r = decidirAcceso({ email: "maravena@bosca.cl", name: "M", emailVerified: true }, gerente);
    expect(r.ok && r.usuario.apruebaCc).toEqual(["C0200"]);
  });

  it("rechaza con 401 si el token no trae email", () => {
    const r = decidirAcceso({ email: undefined, name: "X" }, null);
    expect(r).toEqual({ ok: false, status: 401, motivo: expect.any(String) });
  });

  it("rechaza con 403 si el dominio no es el permitido", () => {
    const r = decidirAcceso({ email: "ajeno@gmail.com", name: "Ajeno" }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("rechaza con 403 si el usuario no está en la planilla o está inactivo", () => {
    const r = decidirAcceso({ email: "maravena@bosca.cl", name: "M. Aravena", emailVerified: true }, null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("normaliza el email del token a minúsculas para el chequeo de dominio", () => {
    const r = decidirAcceso({ email: "MARAVENA@BOSCA.CL", name: "M", emailVerified: true }, usuarioAdmin);
    expect(r.ok).toBe(true);
  });

  it("rechaza con 403 si el email no está verificado", () => {
    const r = decidirAcceso({ email: "maravena@bosca.cl", name: "M. Aravena", emailVerified: false }, usuarioAdmin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });

  it("rechaza un email que solo aparenta ser del dominio (sufijo malicioso)", () => {
    const r = decidirAcceso(
      { email: "evil@bosca.cl.attacker.com", name: "Evil", emailVerified: true },
      usuarioAdmin,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(403);
  });
});

describe("tieneRol", () => {
  const sesionUsuario = { email: "u@bosca.cl", nombre: "U", rol: "Usuario" as const, area: "", apruebaCc: [] };
  const sesionAdmin = { email: "a@bosca.cl", nombre: "A", rol: "Administrador" as const, area: "", apruebaCc: [] };

  it("cualquier sesión cumple el rol mínimo Usuario", () => {
    expect(tieneRol(sesionUsuario, "Usuario")).toBe(true);
    expect(tieneRol(sesionAdmin, "Usuario")).toBe(true);
  });

  it("solo Administrador cumple el rol mínimo Administrador", () => {
    expect(tieneRol(sesionUsuario, "Administrador")).toBe(false);
    expect(tieneRol(sesionAdmin, "Administrador")).toBe(true);
  });
});

describe("getBearerToken", () => {
  it("extrae el token de un header Bearer", () => {
    const req = new Request("http://x", { headers: { authorization: "Bearer abc.def.ghi" } });
    expect(getBearerToken(req)).toBe("abc.def.ghi");
  });

  it("devuelve null si no hay header", () => {
    expect(getBearerToken(new Request("http://x"))).toBeNull();
  });

  it("devuelve null si el esquema no es Bearer", () => {
    const req = new Request("http://x", { headers: { authorization: "Basic abc" } });
    expect(getBearerToken(req)).toBeNull();
  });
});

describe("DOMINIO_PERMITIDO", () => {
  it("es bosca.cl", () => {
    expect(DOMINIO_PERMITIDO).toBe("bosca.cl");
  });
});
