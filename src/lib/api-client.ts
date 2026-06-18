import { getIdTokenActual } from "./firebase-client";
import type { ExtraccionGasto } from "./extraccion";
import type { Gasto, Categoria, CentroCostoEntry, TipoRendicion, TipoDocumento } from "./types";

/** Respuesta de las rutas de extracción. */
export interface RespuestaExtraccion {
  extraccion: ExtraccionGasto;
  faltantes: string[];
}

/** Datos para crear un gasto desde el cliente. */
export interface GuardarGastoInput {
  comercio: string;
  monto: number;
  categoria: Categoria;
  fechaDocumento: string;
  rutEmisor?: string;
  numeroDocumento?: string;
  direccion?: string;
  observacion?: string;
  imagenUrl?: string;
  imagenDriveId?: string;
  centroCostoCodigo: string;
  areaCodigo: string;
  ubicacionCodigo: string;
  tipoRendicion: TipoRendicion;
  tipoDocumento: TipoDocumento;
  montoNeto: number;
  iva: number;
  banco?: string; // solo cuando se completa inline en una devolución
  cuentaCorriente?: string;
}

/** Hace una petición autenticada y lanza si la respuesta no es OK. */
async function pedir<T>(url: string, opciones: RequestInit): Promise<T> {
  const token = await getIdTokenActual();
  const res = await fetch(url, {
    ...opciones,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
      ...(opciones.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? "Error de red");
  }
  return data as T;
}

/** Extrae datos de un gasto a partir de texto libre, con el borrador en curso como contexto. */
export function extraerDesdeTexto(
  texto: string,
  borrador?: ExtraccionGasto,
): Promise<RespuestaExtraccion> {
  return pedir<RespuestaExtraccion>("/api/extraer", {
    method: "POST",
    body: JSON.stringify({ texto, borrador }),
  });
}

/** Extrae datos de un gasto a partir de una imagen (base64 sin prefijo). */
export function extraerDesdeImagen(base64: string): Promise<RespuestaExtraccion> {
  return pedir<RespuestaExtraccion>("/api/extraer", {
    method: "POST",
    body: JSON.stringify({ base64 }),
  });
}

/** Sube una boleta a Drive y devuelve su id y url. */
export function subirBoleta(base64: string, nombre?: string): Promise<{ id: string; url: string }> {
  return pedir<{ id: string; url: string }>("/api/upload", {
    method: "POST",
    body: JSON.stringify({ base64, nombre }),
  });
}

/** Guarda un gasto confirmado. */
export function guardarGasto(payload: GuardarGastoInput): Promise<{ gasto: Gasto }> {
  return pedir<{ gasto: Gasto }>("/api/gastos", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Lista los gastos visibles para el usuario actual (filtrados por rol en el servidor). */
export function obtenerGastos(): Promise<{ gastos: Gasto[] }> {
  return pedir<{ gastos: Gasto[] }>("/api/gastos", { method: "GET" });
}

/** Catálogo de imputación (centro de costo / área / ubicación). */
export function obtenerCentrosCosto(): Promise<{ centros: CentroCostoEntry[] }> {
  return pedir<{ centros: CentroCostoEntry[] }>("/api/centros-costo", { method: "GET" });
}

/** Perfil del usuario + áreas disponibles. */
export interface Perfil {
  nombre: string;
  rut: string;
  area: string;
  banco: string;
  cuentaCorriente: string;
  completo: boolean;
  apruebaCc: string[];
  cargo: string;
  areas: string[];
}

/** Obtiene el perfil del usuario actual y las áreas válidas. */
export function obtenerPerfil(): Promise<Perfil> {
  return pedir<Perfil>("/api/perfil", { method: "GET" });
}

/** Gasto de la API de Claude por día (este mes), en USD. */
export interface ResumenGastoApi {
  porDia: { fecha: string; montoUSD: number }[];
  totalUSD: number;
}

/**
 * Obtiene el gasto de la API de Claude del mes en curso. Devuelve null si no
 * estás autorizado (403) o si no está configurado en el servidor — así el panel
 * simplemente no se muestra, sin filtrar quién es el usuario autorizado.
 */
export async function obtenerGastoApi(): Promise<ResumenGastoApi | null> {
  const token = await getIdTokenActual();
  const res = await fetch("/api/costos-api", {
    headers: { Authorization: `Bearer ${token ?? ""}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as ResumenGastoApi;
}

/** Guarda el perfil (nombre, rut, area y, opcionalmente, banco y cuenta corriente) del usuario actual. */
export function guardarPerfil(perfil: {
  nombre: string;
  rut: string;
  area: string;
  banco?: string;
  cuentaCorriente?: string;
}): Promise<{ ok: boolean }> {
  return pedir<{ ok: boolean }>("/api/perfil", {
    method: "POST",
    body: JSON.stringify(perfil),
  });
}

/** Lista los gastos pendientes que el usuario actual puede aprobar/rechazar. */
export function obtenerAprobaciones(): Promise<{ gastos: Gasto[] }> {
  return pedir<{ gastos: Gasto[] }>("/api/aprobaciones", { method: "GET" });
}

/** Registra la decisión (Aprobado/Rechazado) sobre un gasto. */
export function decidirGasto(
  id: string,
  decision: "Aprobado" | "Rechazado",
  motivo?: string,
): Promise<{ gasto: Gasto }> {
  return pedir<{ gasto: Gasto }>(`/api/gastos/${id}/decision`, {
    method: "POST",
    body: JSON.stringify({ decision, motivo }),
  });
}

/** Edita un gasto rechazado y lo reenvía (vuelve a Registrado). */
export function editarGasto(id: string, payload: GuardarGastoInput): Promise<{ gasto: Gasto }> {
  return pedir<{ gasto: Gasto }>(`/api/gastos/${id}/editar`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
