import { describe, it, expect } from "vitest";
import { gastoToRow, rowToGasto } from "./sheets";
import type { Gasto } from "./types";

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
};

describe("gastoToRow / rowToGasto", () => {
  it("convierte un Gasto a fila en el orden correcto", () => {
    const row = gastoToRow(gasto);
    expect(row[0]).toBe("g_a1b2c3");
    expect(row[8]).toBe("Combustible");
    expect(row[9]).toBe("45000"); // monto como string
    expect(row.length).toBe(16);
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
});
