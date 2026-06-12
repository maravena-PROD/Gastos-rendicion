import { google } from "googleapis";
import { Readable } from "stream";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: getEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
      private_key: getEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    },
    scopes: SCOPES,
  });
  return google.drive({ version: "v3", auth });
}

/**
 * Sube una imagen a la carpeta de Drive configurada, le da permiso de lectura
 * (link compartido) y devuelve el id del archivo y su URL pública.
 */
export async function subirImagen(
  buffer: Buffer,
  mimeType: string,
  nombre: string,
): Promise<{ id: string; url: string }> {
  const drive = getDriveClient();
  const creado = await drive.files.create({
    requestBody: { name: nombre, parents: [getEnv("GOOGLE_DRIVE_FOLDER_ID")] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id",
  });
  const id = creado.data.id;
  if (!id) throw new Error("Drive no devolvió un id de archivo");
  // SEGURIDAD: se da acceso de lectura a "cualquiera con el link". El link no es
  // adivinable, pero NO está protegido por sesión: si la URL se filtra, la imagen
  // de la boleta (que puede contener RUT, dirección y monto) queda expuesta.
  // Exposición intencional para que la boleta sea visible desde la planilla/app.
  await drive.permissions.create({
    fileId: id,
    requestBody: { role: "reader", type: "anyone" },
  });
  return { id, url: `https://drive.google.com/file/d/${id}/view` };
}
