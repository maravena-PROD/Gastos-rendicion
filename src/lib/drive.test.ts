import { describe, it, expect, vi, beforeEach } from "vitest";

const filesCreate = vi.fn();
const permissionsCreate = vi.fn();

vi.mock("googleapis", () => ({
  google: {
    auth: { GoogleAuth: class { constructor(_o: unknown) {} } },
    drive: () => ({
      files: { create: (...a: unknown[]) => filesCreate(...a) },
      permissions: { create: (...a: unknown[]) => permissionsCreate(...a) },
    }),
  },
}));

import { subirImagen } from "./drive";

beforeEach(() => {
  filesCreate.mockReset();
  permissionsCreate.mockReset();
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "sa@test.iam.gserviceaccount.com";
  process.env.GOOGLE_PRIVATE_KEY = "fake";
  process.env.GOOGLE_DRIVE_FOLDER_ID = "folder-123";
});

describe("subirImagen", () => {
  it("sube el archivo, lo hace legible y devuelve id + url", async () => {
    filesCreate.mockResolvedValue({ data: { id: "file-abc" } });
    permissionsCreate.mockResolvedValue({});
    const r = await subirImagen(Buffer.from("x"), "image/jpeg", "boleta.jpg");
    expect(r.id).toBe("file-abc");
    expect(r.url).toContain("file-abc");
    expect(filesCreate).toHaveBeenCalledTimes(1);
    expect(permissionsCreate).toHaveBeenCalledTimes(1);
    // se subió a la carpeta configurada
    const arg = filesCreate.mock.calls[0][0] as {
      requestBody: { parents: string[]; name: string };
    };
    expect(arg.requestBody.parents).toEqual(["folder-123"]);
    expect(arg.requestBody.name).toBe("boleta.jpg");
  });
});
