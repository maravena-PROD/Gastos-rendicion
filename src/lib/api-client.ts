import { getIdTokenActual } from "./firebase-client";
import type { ExtraccionGasto } from "./extraccion";
import type { Gasto, Categoria } from "./types";

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

/** Extrae datos de un gasto a partir de texto libre. */
export function extraerDesdeTexto(texto: string): Promise<RespuestaExtraccion> {
  return pedir<RespuestaExtraccion>("/api/extraer", {
    method: "POST",
    body: JSON.stringify({ texto }),
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

/** Perfil del usuario + áreas disponibles. */
export interface Perfil {
  nombre: string;
  rut: string;
  area: string;
  completo: boolean;
  areas: string[];
}

/** Obtiene el perfil del usuario actual y las áreas válidas. */
export function obtenerPerfil(): Promise<Perfil> {
  return pedir<Perfil>("/api/perfil", { method: "GET" });
}

/** Guarda el perfil (nombre, rut, area) del usuario actual. */
export function guardarPerfil(perfil: {
  nombre: string;
  rut: string;
  area: string;
}): Promise<{ ok: boolean }> {
  return pedir<{ ok: boolean }>("/api/perfil", {
    method: "POST",
    body: JSON.stringify(perfil),
  });
}
