"use client";

import { useState, useEffect } from "react";
import { CATEGORIAS, TIPOS_DOCUMENTO, type Categoria, type TipoRendicion, type TipoDocumento } from "@/lib/types";
import type { ExtraccionGasto } from "@/lib/extraccion";
import { parseCLP, formatCLP, formatRut } from "@/lib/format";
import type { GuardarGastoInput } from "@/lib/api-client";
import { centrosCosto, areasDe, ubicacionesDe } from "@/lib/centros-costo";
import type { CentroCostoEntry } from "@/lib/types";
import { calcularNetoIva } from "@/lib/montos";

export function TarjetaConfirmacion({
  borrador,
  imagenUrl,
  imagenDriveId,
  catalogo,
  cuentaActual,
  onConfirmar,
  onCancelar,
  deshabilitado,
}: {
  borrador: ExtraccionGasto;
  imagenUrl?: string;
  imagenDriveId?: string;
  catalogo: CentroCostoEntry[];
  cuentaActual: { banco: string; cuentaCorriente: string };
  onConfirmar: (datos: GuardarGastoInput) => void;
  onCancelar: () => void;
  deshabilitado: boolean;
}) {
  const [tipoRendicion, setTipoRendicion] = useState<TipoRendicion>("Rendicion");
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>(
    borrador.tipoDocumento ?? "Boleta",
  );
  const [netoTexto, setNetoTexto] = useState(
    borrador.montoNeto !== null ? String(borrador.montoNeto) : "",
  );
  const [ivaTexto, setIvaTexto] = useState(
    borrador.iva !== null ? String(borrador.iva) : "",
  );
  const [banco, setBanco] = useState(cuentaActual.banco);
  const [cuentaCorriente, setCuentaCorriente] = useState(cuentaActual.cuentaCorriente);

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
  const neto = parseCLP(netoTexto) ?? 0;
  const iva = parseCLP(ivaTexto) ?? 0;

  useEffect(() => {
    if (monto === null) return;
    const r = calcularNetoIva(monto, tipoDocumento, {
      neto: parseCLP(netoTexto),
      iva: parseCLP(ivaTexto),
    });
    // Solo autocompleta cuando los campos están vacíos o el tipo es Factura.
    if (tipoDocumento === "Factura" && netoTexto === "" && ivaTexto === "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNetoTexto(String(r.neto));
      setIvaTexto(String(r.iva));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoDocumento, montoTexto]);

  const requiereCuenta = tipoRendicion === "Devolucion";
  const cuentaCompleta = banco.trim() !== "" && cuentaCorriente.trim() !== "";
  const completo =
    comercio.trim() !== "" && monto !== null && monto > 0 && fecha !== "" &&
    categoria !== "" && cc !== "" && area !== "" && ubicacion !== "" &&
    (!requiereCuenta || cuentaCompleta);

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
      tipoRendicion,
      tipoDocumento,
      montoNeto: neto,
      iva,
      ...(requiereCuenta && (banco !== cuentaActual.banco || cuentaCorriente !== cuentaActual.cuentaCorriente)
        ? { banco: banco.trim(), cuentaCorriente: cuentaCorriente.trim() }
        : {}),
    });
  }

  return (
    <div className="rounded-2xl border border-bosca-gris bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-bosca-carbon">Revisa el gasto</h3>
      <div className="flex flex-col gap-3">
        <label className="text-xs text-gray-500">
          Tipo
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={tipoRendicion}
            onChange={(e) => setTipoRendicion(e.target.value as TipoRendicion)}
          >
            <option value="Rendicion">Rendición (solo justificar)</option>
            <option value="Devolucion">Devolución (me reembolsan)</option>
          </select>
        </label>
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
          Tipo de documento
          <select
            className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
            value={tipoDocumento}
            onChange={(e) => setTipoDocumento(e.target.value as TipoDocumento)}
          >
            {TIPOS_DOCUMENTO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <label className="flex-1 text-xs text-gray-500">
            Neto
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              inputMode="numeric"
              value={netoTexto}
              onChange={(e) => setNetoTexto(e.target.value)}
            />
          </label>
          <label className="flex-1 text-xs text-gray-500">
            IVA
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              inputMode="numeric"
              value={ivaTexto}
              onChange={(e) => setIvaTexto(e.target.value)}
            />
          </label>
        </div>
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
        {requiereCuenta && (
          <div className="rounded-lg border border-bosca-ambar/50 bg-bosca-ambar/5 p-3">
            <p className="mb-2 text-xs font-medium text-bosca-carbon">
              Datos para la devolución
            </p>
            <label className="text-xs text-gray-500">
              Banco
              <input
                className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
                placeholder="Banco Santander"
                value={banco}
                onChange={(e) => setBanco(e.target.value)}
              />
            </label>
            <label className="mt-2 block text-xs text-gray-500">
              N° cuenta corriente
              <input
                className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
                placeholder="66788482"
                value={cuentaCorriente}
                onChange={(e) => setCuentaCorriente(e.target.value)}
              />
            </label>
            {!cuentaCompleta && (
              <p className="mt-1 text-xs text-bosca-burdeo">
                Completa banco y cuenta para registrar la devolución.
              </p>
            )}
          </div>
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
