/** Lado largo máximo (px) y calidad JPEG al reducir una imagen antes de subirla. */
const MAX_LADO_DEFECTO = 1500;
const CALIDAD_JPEG = 0.8;

/** Lee un Blob/File como base64 SIN el prefijo "data:<mime>;base64,". */
function blobABase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const coma = result.indexOf(",");
      resolve(coma >= 0 ? result.slice(coma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Lee un archivo del navegador y lo devuelve como base64 SIN el prefijo
 * "data:<mime>;base64,". Útil para enviar el archivo tal cual al backend.
 */
export function fileABase64(file: File): Promise<string> {
  return blobABase64(file);
}

/** Resultado de reducir una imagen: base64 (sin prefijo) y un nombre sugerido. */
export interface ImagenReducida {
  base64: string;
  nombre: string;
}

/** Carga el archivo como bitmap respetando la orientación EXIF, con fallback a <img>. */
async function cargarBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Cae al método con <img>.
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo cargar la imagen"));
    };
    img.src = url;
  });
}

/**
 * Reduce una imagen en el navegador antes de subirla: la escala para que el
 * lado largo no supere `maxLado` (solo reduce, nunca agranda) y la recomprime a
 * JPEG. Baja los tokens de visión (costo del OCR) y el peso que se sube a Drive.
 *
 * Para archivos que no sean imagen raster (p. ej. PDF) o si el canvas no está
 * disponible, devuelve el contenido original sin tocar.
 */
export async function reducirImagen(
  file: File,
  maxLado = MAX_LADO_DEFECTO,
  calidad = CALIDAD_JPEG,
): Promise<ImagenReducida> {
  if (!file.type.startsWith("image/")) {
    return { base64: await fileABase64(file), nombre: file.name };
  }

  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await cargarBitmap(file);
  } catch {
    return { base64: await fileABase64(file), nombre: file.name };
  }

  const w = bitmap instanceof HTMLImageElement ? bitmap.naturalWidth : bitmap.width;
  const h = bitmap instanceof HTMLImageElement ? bitmap.naturalHeight : bitmap.height;
  const escala = Math.min(1, maxLado / Math.max(w, h));
  const ancho = Math.max(1, Math.round(w * escala));
  const alto = Math.max(1, Math.round(h * escala));

  const canvas = document.createElement("canvas");
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if (bitmap instanceof ImageBitmap) bitmap.close();
    return { base64: await fileABase64(file), nombre: file.name };
  }
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  if (bitmap instanceof ImageBitmap) bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", calidad),
  );
  if (!blob) {
    return { base64: await fileABase64(file), nombre: file.name };
  }

  const base64 = await blobABase64(blob);
  const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return { base64, nombre };
}
