import { describe, it, expect, vi, beforeEach } from "vitest";
import { gastoToRow, rowToGasto } from "./sheets";
import type { Gasto } from "./types";

// Mock de googleapis: capturamos las llamadas a spreadsheets.values
const valuesGet = vi.fn();
const valuesAppend = vi.fn();

vi.mock("googleapis", () => {
  return {
    google: {
      auth: {
        GoogleAuth: class {
          constructor(_opts: unknown) {}
        },
      },
      sheets: () => ({
        spreadsheets: {
          values: {
            get: (...args: unknown[]) => valuesGet(...args),
            append: (...args: unknown[]) => valuesAppend(...args),
          },
        },
      }),
    },
  };
});

const gasto: Gasto = {
  id: "g_a1b2c3",
  fechaRegistro: "2026-06-11T14:32:00Z",
  usuarioEmail: "maravena@bosca.cl",
  usuarioNombre: "M. Aravena",
  fechaDocumento: "2026-06-10",
  comercio: "Copec",
  rutEmisor: "76.123.456-7",
  numeroDocumento: "0012345",
  categoria: "Combustible",
  monto: 45000,
  direccion: "Av. Principal 123",
  observacion: "Camioneta flota",
  imagenUrl: "https://drive.google.com/file/d/abc/view",
  imagenDriveId: "abc",
  estado: "Registrado",
  fechaCreacion: "2026-06-11T14:32:05Z",
  usuarioArea: "Operaciones",
};

describe("gastoToRow / rowToGasto", () => {
  it("convierte un Gasto a fila en el orden correcto", () => {
    const row = gastoToRow(gasto);
    expect(row[0]).toBe("g_a1b2c3");
    expect(row[8]).toBe("Combustible");
    expect(row[9]).toBe("45000"); // monto como string
    expect(row.length).toBe(17);
    expect(row[16]).toBe("Operaciones");
  });

  it("es ida y vuelta (round-trip)", () => {
    const row = gastoToRow(gasto);
    expect(rowToGasto(row)).toEqual(gasto);
  });

  it("rowToGasto parsea monto a entero", () => {
    const row = gastoToRow(gasto);
    expect(rowToGasto(row).monto).toBe(45000);
  });

  it("rowToGasto tolera celdas faltantes al final como string vacío", () => {
    const row = gastoToRow(gasto).slice(0, 13); // recorta imagen_drive_id, estado, fecha_creacion
    const parsed = rowToGasto(row);
    expect(parsed.imagenDriveId).toBe("");
    expect(parsed.estado).toBe("Registrado"); // default cuando falta
  });

  it("rowToGasto convierte monto no numérico a 0", () => {
    const row = gastoToRow(gasto);
    row[9] = "no-es-numero";
    expect(rowToGasto(row).monto).toBe(0);
  });
});

import { listGastos, appendGasto } from "./sheets";

beforeEach(() => {
  valuesGet.mockReset();
  valuesAppend.mockReset();
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@test.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = "fake-key";
  process.env.GOOGLE_SHEETS_ID = "sheet-123";
});

describe("listGastos", () => {
  it("devuelve los gastos mapeados, sin la fila de encabezados", async () => {
    valuesGet.mockResolvedValue({
      data: { values: [gastoToRow(gasto)] }, // la API recibe range desde la fila 2
    });
    const result = await listGastos();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(gasto);
  });

  it("devuelve [] cuando no hay filas", async () => {
    valuesGet.mockResolvedValue({ data: {} });
    expect(await listGastos()).toEqual([]);
  });
});

describe("appendGasto", () => {
  it("llama a append con la fila del gasto", async () => {
    valuesAppend.mockResolvedValue({});
    await appendGasto(gasto);
    expect(valuesAppend).toHaveBeenCalledTimes(1);
    const arg = valuesAppend.mock.calls[0][0] as {
      requestBody: { values: string[][] };
    };
    expect(arg.requestBody.values[0]).toEqual(gastoToRow(gasto));
  });
});

import { getUsuario, usuarioRowToUsuario } from "./sheets";

describe("usuarioRowToUsuario", () => {
  it("mapea una fila a Usuario y parsea activo", () => {
    const u = usuarioRowToUsuario([
      "maravena@bosca.cl",
      "M. Aravena",
      "Administrador",
      "TRUE",
      "2026-06-01T00:00:00Z",
    ]);
    expect(u.rol).toBe("Administrador");
    expect(u.activo).toBe(true);
  });

  it("rol desconocido cae a Usuario", () => {
    const u = usuarioRowToUsuario(["x@bosca.cl", "X", "jefe", "TRUE", ""]);
    expect(u.rol).toBe("Usuario");
  });
});

describe("getUsuario", () => {
  it("encuentra un usuario activo (case-insensitive en email)", async () => {
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ["otro@bosca.cl", "Otro", "Usuario", "TRUE", ""],
          ["maravena@bosca.cl", "M. Aravena", "Administrador", "TRUE", ""],
        ],
      },
    });
    const u = await getUsuario("MARAVENA@bosca.cl");
    expect(u?.nombre).toBe("M. Aravena");
    expect(u?.rol).toBe("Administrador");
  });

  it("devuelve null si el usuario está inactivo", async () => {
    valuesGet.mockResolvedValue({
      data: { values: [["x@bosca.cl", "X", "Usuario", "FALSE", ""]] },
    });
    expect(await getUsuario("x@bosca.cl")).toBeNull();
  });

  it("devuelve null si el usuario no existe", async () => {
    valuesGet.mockResolvedValue({ data: { values: [] } });
    expect(await getUsuario("nadie@bosca.cl")).toBeNull();
  });
});
