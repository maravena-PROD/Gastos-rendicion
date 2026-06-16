import { describe, it, expect, afterEach } from "vitest";
import { agregarPorDia, puedeVerCostos } from "./costos-anthropic";

describe("agregarPorDia", () => {
  it("suma los centavos de cada día y los pasa a USD", () => {
    const r = agregarPorDia([
      { starting_at: "2026-06-01T00:00:00Z", results: [{ amount: "150" }, { amount: "50" }] },
      { starting_at: "2026-06-02T00:00:00Z", results: [{ amount: "200" }] },
    ]);
    expect(r.porDia).toEqual([
      { fecha: "2026-06-01", montoUSD: 2 }, // 200 centavos
      { fecha: "2026-06-02", montoUSD: 2 },
    ]);
    expect(r.totalUSD).toBe(4);
  });

  it("convierte centavos fraccionarios a USD", () => {
    const r = agregarPorDia([
      { starting_at: "2026-06-01T00:00:00Z", results: [{ amount: "123.45" }] },
    ]);
    expect(r.porDia[0].montoUSD).toBeCloseTo(1.2345, 6);
  });

  it("ignora montos no numéricos y buckets sin fecha", () => {
    const r = agregarPorDia([
      { starting_at: "", results: [{ amount: "100" }] },
      { starting_at: "2026-06-03T00:00:00Z", results: [{ amount: "abc" }, { amount: "100" }] },
    ]);
    expect(r.porDia).toEqual([{ fecha: "2026-06-03", montoUSD: 1 }]);
  });

  it("ordena los días cronológicamente", () => {
    const r = agregarPorDia([
      { starting_at: "2026-06-10T00:00:00Z", results: [{ amount: "100" }] },
      { starting_at: "2026-06-02T00:00:00Z", results: [{ amount: "100" }] },
    ]);
    expect(r.porDia.map((d) => d.fecha)).toEqual(["2026-06-02", "2026-06-10"]);
  });
});

describe("puedeVerCostos", () => {
  const original = process.env.ANTHROPIC_COST_VIEWER_EMAIL;
  afterEach(() => {
    if (original === undefined) delete process.env.ANTHROPIC_COST_VIEWER_EMAIL;
    else process.env.ANTHROPIC_COST_VIEWER_EMAIL = original;
  });

  it("autoriza solo al email configurado (sin distinguir mayúsculas ni espacios)", () => {
    process.env.ANTHROPIC_COST_VIEWER_EMAIL = "maravena@bosca.cl";
    expect(puedeVerCostos("maravena@bosca.cl")).toBe(true);
    expect(puedeVerCostos("  MARAVENA@bosca.cl ")).toBe(true);
    expect(puedeVerCostos("otro@bosca.cl")).toBe(false);
  });

  it("no autoriza a nadie si la variable no está configurada", () => {
    delete process.env.ANTHROPIC_COST_VIEWER_EMAIL;
    expect(puedeVerCostos("maravena@bosca.cl")).toBe(false);
  });
});
