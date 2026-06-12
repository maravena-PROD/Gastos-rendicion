/**
 * Lee un archivo del navegador y lo devuelve como base64 SIN el prefijo
 * "data:<mime>;base64,". Útil para enviar la imagen al backend.
 */
export function fileABase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const coma = result.indexOf(",");
      resolve(coma >= 0 ? result.slice(coma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}
