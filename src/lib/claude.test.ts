import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock del SDK de Anthropic: capturamos messages.create
const messagesCreate = vi.fn();

vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class {
      messages = { create: (...a: unknown[]) => messagesCreate(...a) };
    },
  };
});

import { extraerDeTexto, extraerDeImagen } from "./claude";

function respuestaConJson(obj: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(obj) }] };
}

beforeEach(() => {
  messagesCreate.mockReset();
  process.env.ANTHROPIC_API_KEY = "sk-test";
});

describe("extraerDeTexto", () => {
  it("mapea la respuesta de Claude a ExtraccionGasto", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Copec",
        monto: 45000,
        fechaDocumento: "2026-06-10",
        categoria: "Combustible",
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
      }),
    );
    const r = await extraerDeTexto("combustible 45000 en Copec");
    expect(r.comercio).toBe("Copec");
    expect(r.monto).toBe(45000);
    expect(r.categoria).toBe("Combustible");
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("normaliza una categoría no canónica y deja null lo no detectado", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Copec",
        monto: 45000,
        fechaDocumento: null,
        categoria: "combustible", // minúscula
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
      }),
    );
    const r = await extraerDeTexto("x");
    expect(r.categoria).toBe("Combustible");
    expect(r.fechaDocumento).toBeNull();
  });

  it("convierte un monto no numérico a null", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: null,
        monto: "no-numero",
        fechaDocumento: null,
        categoria: null,
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
      }),
    );
    const r = await extraerDeTexto("x");
    expect(r.monto).toBeNull();
  });
});

describe("extraerDeImagen", () => {
  it("incluye un bloque de imagen en el mensaje y mapea la respuesta", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Shell",
        monto: 30000,
        fechaDocumento: "2026-06-09",
        categoria: "Combustible",
        rutEmisor: "76.543.219-7",
        numeroDocumento: "0012345",
        direccion: null,
      }),
    );
    const r = await extraerDeImagen("BASE64DATA", "image/jpeg");
    expect(r.comercio).toBe("Shell");
    expect(r.rutEmisor).toBe("76.543.219-7");
    // verifica que se mandó un bloque de imagen
    const arg = messagesCreate.mock.calls[0][0] as {
      messages: { content: Array<{ type: string }> }[];
    };
    const tipos = arg.messages[0].content.map((c) => c.type);
    expect(tipos).toContain("image");
  });
});
