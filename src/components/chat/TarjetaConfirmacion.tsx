"use client";

import { useState } from "react";
import { CATEGORIAS, type Categoria } from "@/lib/types";
import type { ExtraccionGasto } from "@/lib/extraccion";
import { parseCLP, formatCLP, formatRut } from "@/lib/format";
import type { GuardarGastoInput } from "@/lib/api-client";
import { centrosCosto, areasDe, ubicacionesDe } from "@/lib/centros-costo";
import type { CentroCostoEntry } from "@/lib/types";

export function TarjetaConfirmacion({
  borrador,
  imagenUrl,
  imagenDriveId,
  catalogo,
  onConfirmar,
  onCancelar,
  deshabilitado,
}: {
  borrador: ExtraccionGasto;
  imagenUrl?: string;
  imagenDriveId?: string;
  catalogo: CentroCostoEntry[];
  onConfirmar: (datos: GuardarGastoInput) => void;
  onCancelar: () => void;
  deshabilitado: boolean;
}) {
  const [comercio, setComercio] = useState(borrador.comercio ?? "");
  const [montoTexto, setMontoTexto] = useState(
    borrador.monto !== null ? String(borrador.monto) : "",
  );
  const [fecha, setFecha] = useState(borrador.fechaDocumento ?? "");
  const [categoria, setCategoria] = useState<string>(borrador.categoria ?? "");
  const [observacion, setObservacion] = useState("");

  const [cc, setCc] = useState("");
  const [area, setArea] = useState("");
  const [ubicacion, setUbicacion] = useState("");

  const opcionesCc = centrosCosto(catalogo);
  const opcionesArea = cc ? areasDe(catalogo, cc) : [];
  const opcionesUbic = cc && area ? ubicacionesDe(catalogo, cc, area) : [];

  const monto = parseCLP(montoTexto);
  const completo =
    comercio.trim() !== "" && monto !== null && monto > 0 && fecha !== "" && categoria !== "" && cc !== "" && area !== "" && ubicacion !== "";

  function confirmar() {
    if (!completo || categoria === "" || monto === null) return;
    onConfirmar({
      comercio: comercio.trim(),
      monto,
      categoria: categoria as Categoria,
      fechaDocumento: fecha,
      rutEmisor: borrador.rutEmisor ?? undefined,
      numeroDocumento: borrador.numeroDocumento ?? undefined,
      direccion: borrador.direccion ?? undefined,
      observacion: observacion.trim() || undefined,
      imagenUrl,
      imagenDriveId,
      centroCostoCodigo: cc,
      areaCodigo: area,
      ubicacionCodigo: ubicacion,
    });
  }

  return (
    <div className="rounded-2xl border border-bosca-gris bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-bosca-carbon">Revisa el gasto</h3>
      <div className="flex flex-col gap-3">
        <label className="text-xs text-gray-500">
          Comercio
          <input
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={comercio}
            onChange={(e) => setComercio(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Monto {monto !== null && <span className="font-medium text-bosca-ambar">({formatCLP(monto)})</span>}
          <input
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            inputMode="numeric"
            value={montoTexto}
            onChange={(e) => setMontoTexto(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Fecha del documento
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Categoría
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Centro de costo
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={cc}
            onChange={(e) => {
              setCc(e.target.value);
              setArea("");
              setUbicacion("");
            }}
          >
            <option value="">Selecciona…</option>
            {opcionesCc.map((o) => (
              <option key={o.codigo} value={o.codigo}>
                {o.codigo} · {o.detalle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Área
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon disabled:opacity-50"
            value={area}
            disabled={!cc}
            onChange={(e) => {
              setArea(e.target.value);
              setUbicacion("");
            }}
          >
            <option value="">Selecciona…</option>
            {opcionesArea.map((o) => (
              <option key={o.codigo} value={o.codigo}>
                {o.codigo} · {o.detalle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Ubicación
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon disabled:opacity-50"
            value={ubicacion}
            disabled={!area}
            onChange={(e) => setUbicacion(e.target.value)}
          >
            <option value="">Selecciona…</option>
            {opcionesUbic.map((o) => (
              <option key={o.codigo} value={o.codigo}>
                {o.codigo} · {o.detalle}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          Observación (opcional)
          <input
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
          />
        </label>
        {borrador.rutEmisor && (
          <p className="text-xs text-gray-400">RUT emisor: {formatRut(borrador.rutEmisor)}</p>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={confirmar}
          disabled={!completo || deshabilitado}
          className="flex-1 rounded-lg bg-bosca-burdeo px-4 py-2 text-sm font-medium text-white hover:bg-bosca-burdeo-h disabled:opacity-40"
        >
          Confirmar registro
        </button>
        <button
          onClick={onCancelar}
          disabled={deshabilitado}
          className="rounded-lg border border-bosca-gris px-4 py-2 text-sm text-bosca-carbon disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
