"use client";

import { useState } from "react";
import { CATEGORIAS, type Categoria } from "@/lib/types";
import type { ExtraccionGasto } from "@/lib/extraccion";
import { parseCLP, formatCLP, formatRut } from "@/lib/format";
import type { GuardarGastoInput } from "@/lib/api-client";

export function TarjetaConfirmacion({
  borrador,
  imagenUrl,
  imagenDriveId,
  onConfirmar,
  onCancelar,
  deshabilitado,
}: {
  borrador: ExtraccionGasto;
  imagenUrl?: string;
  imagenDriveId?: string;
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

  const monto = parseCLP(montoTexto);
  const completo = comercio.trim() !== "" && monto !== null && monto > 0 && fecha !== "" && categoria !== "";

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
    });
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Revisa el gasto</h3>
      <div className="flex flex-col gap-3">
        <label className="text-xs text-gray-500">
          Comercio
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            value={comercio}
            onChange={(e) => setComercio(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Monto {monto !== null && <span className="text-gray-400">({formatCLP(monto)})</span>}
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            inputMode="numeric"
            value={montoTexto}
            onChange={(e) => setMontoTexto(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Fecha del documento
          <input
            type="date"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        <label className="text-xs text-gray-500">
          Categoría
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
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
          Observación (opcional)
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-gray-900"
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
          className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Confirmar registro
        </button>
        <button
          onClick={onCancelar}
          disabled={deshabilitado}
          className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
