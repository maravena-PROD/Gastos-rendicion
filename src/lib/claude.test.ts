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
  it("mapea la respuesta de Claude a RespuestaConversacion", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Copec",
        monto: 45000,
        fechaDocumento: "2026-06-10",
        categoria: "Combustible",
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        intencion: "gasto",
        mensaje: "Tengo todo lo necesario. Revisa el resumen para confirmar.",
      }),
    );
    const r = await extraerDeTexto("combustible 45000 en Copec");
    expect(r.extraccion.comercio).toBe("Copec");
    expect(r.extraccion.monto).toBe(45000);
    expect(r.extraccion.categoria).toBe("Combustible");
    expect(r.intencion).toBe("gasto");
    expect(r.mensaje).toContain("resumen");
    expect(messagesCreate).toHaveBeenCalledTimes(1);
  });

  it("clasifica fuera de tema y reencauza sin inventar datos", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: null,
        monto: null,
        fechaDocumento: null,
        categoria: null,
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        intencion: "fuera_de_tema",
        mensaje: "Solo puedo ayudarte a registrar gastos. ¿En qué comercio fue el gasto?",
      }),
    );
    const r = await extraerDeTexto("¿qué hora es?");
    expect(r.intencion).toBe("fuera_de_tema");
    expect(r.extraccion.comercio).toBeNull();
    expect(r.mensaje.length).toBeGreaterThan(0);
  });

  it("normaliza una intención desconocida a 'otro' y deja mensaje vacío si no viene", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Copec",
        monto: 45000,
        fechaDocumento: null,
        categoria: "combustible",
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        intencion: "loquesea",
      }),
    );
    const r = await extraerDeTexto("x");
    expect(r.extraccion.categoria).toBe("Combustible");
    expect(r.intencion).toBe("otro");
    expect(r.mensaje).toBe("");
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
        intencion: "gasto",
        mensaje: "¿Cuál es el monto del gasto?",
      }),
    );
    const r = await extraerDeTexto("x");
    expect(r.extraccion.monto).toBeNull();
  });

  it("lanza si la respuesta no trae bloque de texto", async () => {
    messagesCreate.mockResolvedValue({ content: [] });
    await expect(extraerDeTexto("x")).rejects.toThrow();
  });

  it("lanza si el texto no es JSON válido", async () => {
    messagesCreate.mockResolvedValue({ content: [{ type: "text", text: "no es json" }] });
    await expect(extraerDeTexto("x")).rejects.toThrow();
  });
});

describe("extraerDeImagen", () => {
  it("incluye un bloque de imagen y devuelve RespuestaConversacion", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Shell",
        monto: 30000,
        fechaDocumento: "2026-06-09",
        categoria: "Combustible",
        rutEmisor: "76.543.219-7",
        numeroDocumento: "0012345",
        direccion: null,
        intencion: "gasto",
        mensaje: "Leí la boleta. ¿De qué categoría fue el gasto?",
      }),
    );
    const r = await extraerDeImagen("BASE64DATA", "image/jpeg");
    expect(r.extraccion.comercio).toBe("Shell");
    expect(r.extraccion.rutEmisor).toBe("76.543.219-7");
    expect(r.mensaje).toContain("boleta");
    const arg = messagesCreate.mock.calls[0][0] as {
      messages: { content: Array<{ type: string }> }[];
    };
    const tipos = arg.messages[0].content.map((c) => c.type);
    expect(tipos).toContain("image");
  });

  it("incluye los datos ya capturados del borrador en el prompt", async () => {
    messagesCreate.mockResolvedValue(
      respuestaConJson({
        comercio: "Shell",
        monto: 30000,
        fechaDocumento: "2026-06-09",
        categoria: "Combustible",
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        intencion: "gasto",
        mensaje: "Listo.",
      }),
    );
    await extraerDeImagen("BASE64DATA", "image/jpeg", {
      borrador: {
        comercio: "Shell",
        monto: null,
        fechaDocumento: null,
        categoria: null,
        rutEmisor: null,
        numeroDocumento: null,
        direccion: null,
        tipoDocumento: null,
        montoNeto: null,
        iva: null,
        rutReceptor: null,
        razonSocialReceptor: null,
      },
    });
    const arg = messagesCreate.mock.calls[0][0] as {
      messages: { content: Array<{ type: string; text?: string }> }[];
    };
    const textos = arg.messages[0].content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join(" ");
    expect(textos).toContain("Shell");
  });
});
