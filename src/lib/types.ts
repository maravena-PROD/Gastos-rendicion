export const CATEGORIAS = [
  "Combustible",
  "Alimentación",
  "Transporte",
  "Peajes",
  "Hospedaje",
  "Materiales",
  "Servicios",
  "Otros",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export type EstadoGasto = "Registrado" | "Aprobado" | "Rechazado";

export type TipoRendicion = "Rendicion" | "Devolucion";
export type TipoDocumento = "Boleta" | "Factura" | "Otro";
export const TIPOS_DOCUMENTO: TipoDocumento[] = ["Boleta", "Factura", "Otro"];

export interface Gasto {
  id: string;
  fechaRegistro: string; // ISO 8601
  usuarioEmail: string;
  usuarioNombre: string;
  fechaDocumento: string; // YYYY-MM-DD
  comercio: string;
  rutEmisor: string; // puede ser ""
  numeroDocumento: string; // puede ser ""
  categoria: Categoria;
  monto: number; // entero CLP
  direccion: string; // puede ser ""
  observacion: string; // puede ser ""
  imagenUrl: string; // puede ser ""
  imagenDriveId: string; // puede ser ""
  estado: EstadoGasto;
  fechaCreacion: string; // ISO 8601
  usuarioArea: string; // área del usuario que registró (denormalizado para reportes)
  imputacion: Imputacion; // centro de costo / área / ubicación elegidos en el gasto
  tipoRendicion: TipoRendicion; // "Rendicion" (default) o "Devolucion"
  tipoDocumento: TipoDocumento; // Boleta / Factura / Otro
  montoNeto: number; // entero CLP; 0 si no aplica
  iva: number; // entero CLP; 0 si no aplica
}

export type Rol = "Administrador" | "Usuario";

export interface Usuario {
  email: string;
  nombre: string;
  rol: Rol;
  activo: boolean;
  fechaAlta: string; // ISO 8601
  rut: string;
  area: string;
  banco: string; // p. ej. "Banco Santander"; "" si no tiene
  cuentaCorriente: string; // número de cuenta; "" si no tiene
}

export interface Imputacion {
  centroCostoCodigo: string;
  centroCostoDetalle: string;
  areaCodigo: string;
  areaDetalle: string;
  ubicacionCodigo: string;
  ubicacionDetalle: string;
}

export const IMPUTACION_VACIA: Imputacion = {
  centroCostoCodigo: "",
  centroCostoDetalle: "",
  areaCodigo: "",
  areaDetalle: "",
  ubicacionCodigo: "",
  ubicacionDetalle: "",
};

/** Una combinación válida del catálogo de imputación (pestaña CentrosCosto). */
export interface CentroCostoEntry {
  ccCodigo: string;
  ccDetalle: string;
  areaCodigo: string;
  areaDetalle: string;
  ubicacionCodigo: string;
  ubicacionDetalle: string;
}
