import { describe, it, expect } from "vitest";
import {
  normalizarCategoria,
  normalizarTipoDocumento,
  camposFaltantes,
  extraccionCompleta,
  hayDatosEsenciales,
  siguientePregunta,
  fusionarExtraccion,
  type ExtraccionGasto,
} from "./extraccion";

describe("normalizarCategoria", () => {
  it("acepta una categoría válida exacta", () => {
    expect(normalizarCategoria("Combustible")).toBe("Combustible");
  });
  it("es tolerante a mayúsculas/minúsculas", () => {
    expect(normalizarCategoria("combustible")).toBe("Combustible");
  });
  it("devuelve null para texto no reconocido", () => {
    expect(normalizarCategoria("xyz")).toBeNull();
  });
  it("devuelve null para null o vacío", () => {
    expect(normalizarCategoria(null)).toBeNull();
    expect(normalizarCategoria("")).toBeNull();
  });
});

const vacia: ExtraccionGasto = {
  comercio: null,
  monto: null,
  fechaDocumento: null,
  categoria: null,
  rutEmisor: null,
  numeroDocumento: null,
  direccion: null,
  tipoDocumento: null,
  montoNeto: null,
  iva: null,
};

const completa: ExtraccionGasto = {
  ...vacia,
  comercio: "Copec",
  monto: 45000,
  fechaDocumento: "2026-06-10",
  categoria: "Combustible",
};

describe("camposFaltantes", () => {
  it("lista los 4 esenciales cuando está vacía", () => {
    expect(camposFaltantes(vacia)).toEqual([
      "comercio",
      "monto",
      "categoria",
      "fechaDocumento",
    ]);
  });
  it("no incluye los campos ya presentes", () => {
    expect(camposFaltantes({ ...vacia, monto: 45000 })).toEqual([
      "comercio",
      "categoria",
      "fechaDocumento",
    ]);
  });
  it("devuelve [] cuando están todos los esenciales", () => {
    expect(camposFaltantes(completa)).toEqual([]);
  });
  it("ignora campos opcionales (rut, dirección, etc.)", () => {
    expect(camposFaltantes(completa)).toEqual([]);
  });
});

describe("extraccionCompleta", () => {
  it("true cuando no falta ningún esencial", () => {
    expect(extraccionCompleta(completa)).toBe(true);
  });
  it("false cuando falta alguno", () => {
    expect(extraccionCompleta(vacia)).toBe(false);
  });
});

describe("hayDatosEsenciales", () => {
  it("false cuando el borrador está vacío (mensaje inicial / saludo)", () => {
    expect(hayDatosEsenciales(vacia)).toBe(false);
  });
  it("true cuando ya hay al menos un campo esencial (gasto en curso)", () => {
    expect(hayDatosEsenciales({ ...vacia, monto: 45000 })).toBe(true);
    expect(hayDatosEsenciales(completa)).toBe(true);
  });
  it("ignora campos opcionales (solo cuentan los esenciales)", () => {
    expect(hayDatosEsenciales({ ...vacia, rutEmisor: "76.543.219-7" })).toBe(false);
  });
});

describe("siguientePregunta", () => {
  it("pregunta por el primer campo faltante", () => {
    expect(siguientePregunta(vacia)).toContain("comercio");
  });
  it("pregunta por el monto si solo falta eso", () => {
    const q = siguientePregunta({ ...completa, monto: null });
    expect(q).toContain("monto");
  });
  it("devuelve null cuando no falta nada", () => {
    expect(siguientePregunta(completa)).toBeNull();
  });
});

describe("fusionarExtraccion", () => {
  it("los datos nuevos no-null sobreescriben a la base", () => {
    const r = fusionarExtraccion({ ...vacia, comercio: "Copec" }, { ...vacia, monto: 45000 });
    expect(r.comercio).toBe("Copec");
    expect(r.monto).toBe(45000);
  });
  it("un null nuevo NO borra un valor existente", () => {
    const r = fusionarExtraccion({ ...vacia, comercio: "Copec" }, vacia);
    expect(r.comercio).toBe("Copec");
  });
  it("un valor nuevo gana sobre uno previo", () => {
    const r = fusionarExtraccion({ ...vacia, comercio: "Copec" }, { ...vacia, comercio: "Shell" });
    expect(r.comercio).toBe("Shell");
  });
});

describe("normalizarTipoDocumento", () => {
  it("reconoce boleta y factura en cualquier caja", () => {
    expect(normalizarTipoDocumento("BOLETA")).toBe("Boleta");
    expect(normalizarTipoDocumento("factura")).toBe("Factura");
    expect(normalizarTipoDocumento("Boleta electrónica")).toBe("Boleta");
  });

  it("devuelve null cuando no reconoce", () => {
    expect(normalizarTipoDocumento(null)).toBe(null);
    expect(normalizarTipoDocumento("vale vista")).toBe(null);
  });
});
