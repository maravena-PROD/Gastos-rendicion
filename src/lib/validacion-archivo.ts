/** Tamaño máximo permitido para una imagen/boleta (10 MB). */
export const TAMANO_MAX_BYTES = 10 * 1024 * 1024;

export type ResultadoValidacion =
  | { ok: true; mimeType: "image/jpeg" | "image/png" | "application/pdf" }
  | { ok: false; motivo: string };

/** ¿El buffer empieza con esta firma de bytes? */
function empiezaCon(buf: Buffer, firma: number[]): boolean {
  if (buf.length < firma.length) return false;
  return firma.every((b, i) => buf[i] === b);
}

/**
 * Valida una imagen por sus magic bytes (no por la extensión) y su tamaño.
 * Solo permite JPG, PNG y PDF.
 */
export function validarImagen(buf: Buffer): ResultadoValidacion {
  if (buf.length > TAMANO_MAX_BYTES) {
    return { ok: false, motivo: "El archivo supera el tamaño máximo de 10 MB" };
  }
  if (empiezaCon(buf, [0xff, 0xd8, 0xff])) {
    return { ok: true, mimeType: "image/jpeg" };
  }
  if (empiezaCon(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, mimeType: "image/png" };
  }
  if (empiezaCon(buf, [0x25, 0x50, 0x44, 0x46])) {
    return { ok: true, mimeType: "application/pdf" };
  }
  return { ok: false, motivo: "Tipo de archivo no permitido (solo JPG, PNG o PDF)" };
}
