import { describe, it, expect } from "vitest";
import { construirReporte } from "./reporte";
import type { Gasto, Usuario } from "./types";

const usuario: Usuario = {
  email: "maravena@bosca.cl", nombre: "M. Aravena", rol: "Usuario", activo: true,
  fechaAlta: "", rut: "76.543.219-7", area: "Operaciones",
  banco: "Banco Santander", cuentaCorriente: "66788482",
  apruebaCc: [], cargo: "",
};

function g(partial: Partial<Gasto>): Gasto {
  return {
    id: "x", fechaRegistro: "", usuarioEmail: usuario.email, usuarioNombre: usuario.nombre,
    fechaDocumento: "2026-06-15", comercio: "Shell", rutEmisor: "", numeroDocumento: "123",
    categoria: "Combustible", monto: 10000, direccion: "", observacion: "Bencina",
    imagenUrl: "", imagenDriveId: "", estado: "Registrado", fechaCreacion: "",
    usuarioArea: "Operaciones", imputacion: {
      centroCostoCodigo: "C500", centroCostoDetalle: "", areaCodigo: "A5020",
      areaDetalle: "", ubicacionCodigo: "T9510", ubicacionDetalle: "",
    },
    tipoRendicion: "Rendicion", tipoDocumento: "Boleta", montoNeto: 0, iva: 0,
    aprobadoPor: "", fechaDecision: "", motivo: "",
    ...partial,
  };
}

describe("construirReporte", () => {
  const gastos = [
    g({ monto: 10000, tipoRendicion: "Rendicion", montoNeto: 0, iva: 0, estado: "Aprobado", aprobadoPor: "jefe@bosca.cl" }),
    g({ monto: 49266, tipoRendicion: "Devolucion", tipoDocumento: "Factura", montoNeto: 41400, iva: 7866, estado: "Aprobado", aprobadoPor: "gerente@bosca.cl" }),
    g({ monto: 99999, estado: "Registrado" }), // pendiente -> excluido del PDF
    g({ monto: 88888, estado: "Rechazado" }), // rechazado -> excluido del PDF
  ];
  const nombres: Record<string, string> = {
    "jefe@bosca.cl": "Juan Jefe",
    "gerente@bosca.cl": "Ana Gerente",
  };
  const r = construirReporte(usuario, gastos, {
    desde: "2026-06-01", hasta: "2026-06-30", fechaRendicion: "2026-06-17",
    nombrePorEmail: (e) => nombres[e.toLowerCase()] ?? e,
  });

  it("arma la cabecera con datos del usuario", () => {
    expect(r.cabecera.nombre).toBe("M. Aravena");
    expect(r.cabecera.rut).toBe("76.543.219-7");
    expect(r.cabecera.banco).toBe("Banco Santander");
    expect(r.cabecera.cuentaCorriente).toBe("66788482");
    expect(r.cabecera.correo).toBe("maravena@bosca.cl");
    expect(r.cabecera.fechaRendicion).toBe("2026-06-17");
  });

  it("solo incluye aprobados, con su descripción y el NOMBRE de quien aprobó", () => {
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0].descripcion).toBe("Bencina");
    expect(r.filas[0].aprobadoPor).toBe("Juan Jefe");
    expect(r.filas[1].aprobadoPor).toBe("Ana Gerente");
  });

  it("usa el correo como respaldo si no se conoce el nombre del aprobador", () => {
    const sinResolver = construirReporte(usuario, gastos, {
      desde: "2026-06-01", hasta: "2026-06-30", fechaRendicion: "2026-06-17",
    });
    expect(sinResolver.filas[0].aprobadoPor).toBe("jefe@bosca.cl");
  });

  it("calcula totales y subtotales solo sobre los aprobados", () => {
    expect(r.totales.total).toBe(59266);
    expect(r.totales.neto).toBe(41400);
    expect(r.totales.iva).toBe(7866);
    expect(r.totales.rendicion).toBe(10000);
    expect(r.totales.devolucion).toBe(49266);
  });
});
