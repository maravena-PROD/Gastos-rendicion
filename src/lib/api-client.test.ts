import { describe, it, expect, vi, beforeEach } from "vitest";

const getIdTokenActual = vi.fn();
vi.mock("./firebase-client", () => ({
  getIdTokenActual: (...a: unknown[]) => getIdTokenActual(...a),
}));

import { extraerDesdeTexto, guardarGasto, obtenerGastos } from "./api-client";

beforeEach(() => {
  getIdTokenActual.mockReset();
  getIdTokenActual.mockResolvedValue("tok-123");
  vi.stubGlobal("fetch", vi.fn());
});

function mockFetch(ok: boolean, body: unknown) {
  (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok,
    json: async () => body,
  });
}

describe("extraerDesdeTexto", () => {
  it("hace POST a /api/extraer con el texto y el token", async () => {
    mockFetch(true, { extraccion: { comercio: "Copec" }, faltantes: [] });
    const r = await extraerDesdeTexto("combustible en Copec");
    expect(r.extraccion.comercio).toBe("Copec");
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/extraer");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ texto: "combustible en Copec" });
    expect((opts.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it("lanza un Error con el mensaje del backend si la respuesta falla", async () => {
    mockFetch(false, { error: "No autorizado" });
    await expect(extraerDesdeTexto("x")).rejects.toThrow("No autorizado");
  });
});

describe("guardarGasto", () => {
  it("hace POST a /api/gastos con el payload", async () => {
    mockFetch(true, { gasto: { id: "g_1" } });
    const r = await guardarGasto({
      comercio: "Copec",
      monto: 45000,
      categoria: "Combustible",
      fechaDocumento: "2026-06-10",
      centroCostoCodigo: "CC01",
      areaCodigo: "A01",
      ubicacionCodigo: "U01",
      tipoRendicion: "Rendicion",
      tipoDocumento: "Boleta",
      montoNeto: 0,
      iva: 0,
    });
    expect(r.gasto.id).toBe("g_1");
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/gastos");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body).monto).toBe(45000);
  });
});

describe("obtenerGastos", () => {
  it("hace GET a /api/gastos y devuelve la lista", async () => {
    mockFetch(true, { gastos: [{ id: "g_1" }, { id: "g_2" }] });
    const r = await obtenerGastos();
    expect(r.gastos).toHaveLength(2);
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/gastos");
    expect(opts.method).toBe("GET");
  });
});

import { obtenerPerfil, guardarPerfil } from "./api-client";

describe("obtenerPerfil", () => {
  it("hace GET a /api/perfil", async () => {
    mockFetch(true, { nombre: "M", rut: "", area: "", completo: false, areas: ["Operaciones"] });
    const r = await obtenerPerfil();
    expect(r.completo).toBe(false);
    expect(r.areas).toEqual(["Operaciones"]);
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/perfil");
    expect(opts.method).toBe("GET");
  });
});

describe("guardarPerfil", () => {
  it("hace POST a /api/perfil con el perfil", async () => {
    mockFetch(true, { ok: true });
    await guardarPerfil({ nombre: "M. Aravena", rut: "76.543.219-7", area: "Operaciones" });
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/perfil");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body).area).toBe("Operaciones");
  });

  it("lanza con el mensaje del backend si falla", async () => {
    mockFetch(false, { error: "RUT inválido" });
    await expect(
      guardarPerfil({ nombre: "M", rut: "1-1", area: "x" }),
    ).rejects.toThrow("RUT inválido");
  });
});
