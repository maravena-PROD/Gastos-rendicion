import { describe, it, expect } from "vitest";
import { validarImagen, TAMANO_MAX_BYTES } from "./validacion-archivo";

// Magic bytes mínimos de cada formato
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]); // %PDF-1
const BASURA = Buffer.from([0x00, 0x01, 0x02, 0x03]);

describe("validarImagen", () => {
  it("acepta JPG y devuelve image/jpeg", () => {
    expect(validarImagen(JPG)).toEqual({ ok: true, mimeType: "image/jpeg" });
  });
  it("acepta PNG y devuelve image/png", () => {
    expect(validarImagen(PNG)).toEqual({ ok: true, mimeType: "image/png" });
  });
  it("acepta PDF y devuelve application/pdf", () => {
    expect(validarImagen(PDF)).toEqual({ ok: true, mimeType: "application/pdf" });
  });
  it("rechaza un tipo no permitido (magic bytes desconocidos)", () => {
    const r = validarImagen(BASURA);
    expect(r.ok).toBe(false);
  });
  it("rechaza un archivo que excede el tamaño máximo", () => {
    const grande = Buffer.concat([JPG, Buffer.alloc(TAMANO_MAX_BYTES)]);
    const r = validarImagen(grande);
    expect(r.ok).toBe(false);
  });
  it("rechaza un buffer más corto que la firma del formato", () => {
    const r = validarImagen(Buffer.from([0xff, 0xd8])); // JPEG truncado
    expect(r.ok).toBe(false);
  });
});
