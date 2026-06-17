import { describe, it, expect, vi, beforeEach } from "vitest";
import { gastoToRow, rowToGasto } from "./sheets";
import type { Gasto } from "./types";

// Mock de googleapis: capturamos las llamadas a spreadsheets.values
const valuesGet = vi.fn();
const valuesAppend = vi.fn();
const valuesUpdate = vi.fn();

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
            update: (...args: unknown[]) => valuesUpdate(...args),
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
  imputacion: {
    centroCostoCodigo: "C0100",
    centroCostoDetalle: "Gcia. Operaciones",
    areaCodigo: "A1010",
    areaDetalle: "G.Oper - Gerencia",
    ubicacionCodigo: "T9510",
    ubicacionDetalle: "Casa Matriz",
  },
  tipoRendicion: "Rendicion",
  tipoDocumento: "Boleta",
  montoNeto: 0,
  iva: 0,
  aprobadoPor: "",
  fechaDecision: "",
  motivo: "",
};

describe("gastoToRow / rowToGasto", () => {
  it("convierte un Gasto a fila en el orden correcto", () => {
    const row = gastoToRow(gasto);
    expect(row[0]).toBe("g_a1b2c3");
    expect(row[8]).toBe("Combustible");
    expect(row[9]).toBe("45000"); // monto como string
    expect(row.length).toBe(30);
    expect(row[16]).toBe("Operaciones");
    expect(row[17]).toBe("C0100");
    expect(row[22]).toBe("Casa Matriz");
    expect(row[23]).toBe("Rendicion");
    expect(row[24]).toBe("Boleta");
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

  it("rowToGasto deja imputación vacía en filas históricas (sin esas columnas)", () => {
    const row = gastoToRow(gasto).slice(0, 17); // fila vieja: solo hasta usuario_area
    const parsed = rowToGasto(row);
    expect(parsed.imputacion).toEqual({
      centroCostoCodigo: "",
      centroCostoDetalle: "",
      areaCodigo: "",
      areaDetalle: "",
      ubicacionCodigo: "",
      ubicacionDetalle: "",
    });
  });

  it("round-trip preserva tipo de rendición, documento, neto e IVA", () => {
    const factura: Gasto = {
      ...gasto,
      tipoRendicion: "Devolucion",
      tipoDocumento: "Factura",
      montoNeto: 37815,
      iva: 7185,
      monto: 45000,
    };
    expect(rowToGasto(gastoToRow(factura))).toEqual(factura);
  });

  it("filas históricas sin las columnas nuevas defaultean a Rendicion/Otro/0", () => {
    const row = gastoToRow(gasto).slice(0, 17); // fila vieja: hasta usuario_area
    const parsed = rowToGasto(row);
    expect(parsed.tipoRendicion).toBe("Rendicion");
    expect(parsed.tipoDocumento).toBe("Otro");
    expect(parsed.montoNeto).toBe(0);
    expect(parsed.iva).toBe(0);
  });

  it("incluye aprobado_por, fecha_decision y motivo (AB:AD)", () => {
    const decidido: Gasto = {
      ...gasto,
      estado: "Rechazado",
      aprobadoPor: "gerente@bosca.cl",
      fechaDecision: "2026-06-17T10:00:00Z",
      motivo: "Falta boleta",
    };
    const row = gastoToRow(decidido);
    expect(row.length).toBe(30);
    expect(row[27]).toBe("gerente@bosca.cl");
    expect(row[28]).toBe("2026-06-17T10:00:00Z");
    expect(row[29]).toBe("Falta boleta");
    expect(rowToGasto(row)).toEqual(decidido);
  });

  it("filas históricas sin AB:AD defaultean decisión a vacío", () => {
    const row = gastoToRow(gasto).slice(0, 27); // sin las 3 nuevas
    const parsed = rowToGasto(row);
    expect(parsed.aprobadoPor).toBe("");
    expect(parsed.fechaDecision).toBe("");
    expect(parsed.motivo).toBe("");
  });
});

import { listGastos, appendGasto, actualizarGasto } from "./sheets";

beforeEach(() => {
  valuesGet.mockReset();
  valuesAppend.mockReset();
  valuesUpdate.mockReset();
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

describe("actualizarGasto", () => {
  it("localiza por id y reescribe la fila A:AD", async () => {
    valuesGet.mockResolvedValue({
      data: { values: [gastoToRow({ ...gasto, id: "otro" }), gastoToRow(gasto)] },
    });
    valuesUpdate.mockResolvedValue({});
    const decidido: Gasto = {
      ...gasto, estado: "Aprobado", aprobadoPor: "gg@bosca.cl",
      fechaDecision: "2026-06-17T12:00:00Z", motivo: "",
    };
    await actualizarGasto(decidido);
    const arg = valuesUpdate.mock.calls[0][0] as { range: string; requestBody: { values: string[][] } };
    expect(arg.range).toBe("Gastos!A3:AD3"); // 2ª fila de datos => fila 3
    expect(arg.requestBody.values[0]).toEqual(gastoToRow(decidido));
  });

  it("lanza si el gasto no existe", async () => {
    valuesGet.mockResolvedValue({ data: { values: [] } });
    await expect(actualizarGasto(gasto)).rejects.toThrow();
  });
});

import { getUsuario, usuarioRowToUsuario, listarAreas, actualizarPerfilUsuario, listarCentrosCosto } from "./sheets";

describe("usuarioRowToUsuario", () => {
  it("mapea una fila a Usuario y parsea activo", () => {
    const u = usuarioRowToUsuario([
      "maravena@bosca.cl",
      "M. Aravena",
      "Administrador",
      "TRUE",
      "2026-06-01T00:00:00Z",
      "76.543.219-7",
      "Operaciones",
    ]);
    expect(u.rol).toBe("Administrador");
    expect(u.activo).toBe(true);
    expect(u.rut).toBe("76.543.219-7");
    expect(u.area).toBe("Operaciones");
  });

  it("rol desconocido cae a Usuario", () => {
    const u = usuarioRowToUsuario(["x@bosca.cl", "X", "jefe", "TRUE", ""]);
    expect(u.rol).toBe("Usuario");
  });

  it("mapea banco y cuenta corriente", () => {
    const u = usuarioRowToUsuario([
      "maravena@bosca.cl", "M. Aravena", "Usuario", "TRUE",
      "2026-06-01T00:00:00Z", "76.543.219-7", "Operaciones",
      "Banco Santander", "66788482",
    ]);
    expect(u.banco).toBe("Banco Santander");
    expect(u.cuentaCorriente).toBe("66788482");
  });

  it("usuario sin columnas de banco deja banco/cuenta en vacío", () => {
    const u = usuarioRowToUsuario(["x@bosca.cl", "X", "Usuario", "TRUE", ""]);
    expect(u.banco).toBe("");
    expect(u.cuentaCorriente).toBe("");
  });

  it("parsea aprueba_cc (lista) y cargo", () => {
    const u = usuarioRowToUsuario([
      "g@bosca.cl", "G", "Usuario", "TRUE", "", "1-9", "Comercial",
      "", "", "C0200", "Gerente Comercial",
    ]);
    expect(u.apruebaCc).toEqual(["C0200"]);
    expect(u.cargo).toBe("Gerente Comercial");
  });

  it("aprueba_cc '*' => ['*'] y vacío => []", () => {
    const general = usuarioRowToUsuario(["g@bosca.cl","G","Usuario","TRUE","","1-9","x","","","*",""]);
    expect(general.apruebaCc).toEqual(["*"]);
    const normal = usuarioRowToUsuario(["n@bosca.cl","N","Usuario","TRUE",""]);
    expect(normal.apruebaCc).toEqual([]);
    expect(normal.cargo).toBe("");
  });

  it("aprueba_cc CSV con espacios se parsea recortado", () => {
    const u = usuarioRowToUsuario([
      "g@bosca.cl", "G", "Usuario", "TRUE", "", "1-9", "Desarrollo",
      "", "", " C0400 , C0500 ", "Gerente de Desarrollo",
    ]);
    expect(u.apruebaCc).toEqual(["C0400", "C0500"]);
  });
});

describe("listarAreas", () => {
  it("devuelve las áreas no vacías de la pestaña Areas", async () => {
    valuesGet.mockResolvedValue({
      data: { values: [["Operaciones"], ["Mantención"], [""], ["Comercial"]] },
    });
    expect(await listarAreas()).toEqual(["Operaciones", "Mantención", "Comercial"]);
  });
  it("devuelve [] si no hay áreas", async () => {
    valuesGet.mockResolvedValue({ data: {} });
    expect(await listarAreas()).toEqual([]);
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

describe("actualizarPerfilUsuario", () => {
  it("reescribe la fila del usuario preservando rol/activo/fecha_alta", async () => {
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ["otro@bosca.cl", "Otro", "Usuario", "TRUE", "2026-01-01", "", ""],
          ["maravena@bosca.cl", "Viejo Nombre", "Administrador", "TRUE", "2026-06-01", "", ""],
        ],
      },
    });
    valuesUpdate.mockResolvedValue({});
    await actualizarPerfilUsuario("maravena@bosca.cl", {
      nombre: "M. Aravena",
      rut: "76.543.219-7",
      area: "Operaciones",
    });
    expect(valuesUpdate).toHaveBeenCalledTimes(1);
    const arg = valuesUpdate.mock.calls[0][0] as {
      range: string;
      requestBody: { values: string[][] };
    };
    // el usuario está en la 2ª fila de datos => fila 3 de la hoja
    expect(arg.range).toBe("Usuarios!A3:I3");
    expect(arg.requestBody.values[0]).toEqual([
      "maravena@bosca.cl",
      "M. Aravena",
      "Administrador", // rol preservado
      "TRUE", // activo preservado
      "2026-06-01", // fecha_alta preservada
      "76.543.219-7",
      "Operaciones",
      "", // banco (vacío en la fila original)
      "", // cuenta_corriente (vacío en la fila original)
    ]);
  });

  it("lanza si el usuario no existe", async () => {
    valuesGet.mockResolvedValue({ data: { values: [] } });
    await expect(
      actualizarPerfilUsuario("nadie@bosca.cl", { nombre: "N", rut: "1-9", area: "x" }),
    ).rejects.toThrow();
  });
});

describe("listarCentrosCosto", () => {
  it("mapea las filas de CentrosCosto a CentroCostoEntry", async () => {
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ["C0100", "Gcia. Operaciones", "A1010", "G.Oper - Gerencia", "T9510", "Casa Matriz"],
          ["", "", "", "", "", ""],
        ],
      },
    });
    const r = await listarCentrosCosto();
    expect(r).toEqual([
      {
        ccCodigo: "C0100",
        ccDetalle: "Gcia. Operaciones",
        areaCodigo: "A1010",
        areaDetalle: "G.Oper - Gerencia",
        ubicacionCodigo: "T9510",
        ubicacionDetalle: "Casa Matriz",
      },
    ]);
  });

  it("devuelve [] si no hay filas", async () => {
    valuesGet.mockResolvedValue({ data: {} });
    expect(await listarCentrosCosto()).toEqual([]);
  });
});
