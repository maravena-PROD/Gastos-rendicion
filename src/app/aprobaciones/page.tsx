"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { obtenerAprobaciones, decidirGasto, obtenerPerfil } from "@/lib/api-client";
import type { Gasto } from "@/lib/types";
import { formatCLP } from "@/lib/format";

const ETIQUETA_RENDICION: Record<string, string> = {
  Rendicion: "Rendición",
  Devolucion: "Devolución",
};

/** Un dato del gasto con su etiqueta, para el detalle de la aprobación. */
function Campo({ etiqueta, children, ancho }: { etiqueta: string; children: React.ReactNode; ancho?: boolean }) {
  return (
    <div className={ancho ? "col-span-2 sm:col-span-3" : ""}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm text-bosca-carbon">{children}</dd>
    </div>
  );
}

/** Muestra "código · detalle" con el código en negrita; tolera que falte alguno. */
function CodigoDetalle({ codigo, detalle }: { codigo: string; detalle: string }) {
  if (!codigo) return <>{detalle || "—"}</>;
  return (
    <>
      <span className="font-medium">{codigo}</span>
      {detalle ? ` · ${detalle}` : ""}
    </>
  );
}

function Aprobaciones() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [procesando, setProcesando] = useState<string | null>(null);
  const [usuario, setUsuario] = useState({ nombre: "", area: "", cargo: "", apruebaCc: [] as string[] });

  useEffect(() => {
    obtenerAprobaciones()
      .then((r) => setGastos(r.gastos))
      .catch(() => setError("No se pudieron cargar las aprobaciones."))
      .finally(() => setCargando(false));
    obtenerPerfil()
      .then((p) => setUsuario({ nombre: p.nombre, area: p.area, cargo: p.cargo, apruebaCc: p.apruebaCc }))
      .catch(() => {});
  }, []);

  async function decidir(g: Gasto, decision: "Aprobado" | "Rechazado") {
    const motivo = (motivos[g.id] ?? "").trim();
    if (decision === "Rechazado" && motivo === "") {
      setError("Indica un motivo para rechazar.");
      return;
    }
    setProcesando(g.id);
    setError(null);
    try {
      await decidirGasto(g.id, decision, motivo || undefined);
      setGastos((xs) => xs.filter((x) => x.id !== g.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la decisión.");
    } finally {
      setProcesando(null);
    }
  }

  return (
    <AppShell titulo="Aprobaciones" usuario={usuario} pendientes={gastos.length}>
      <div className="mx-auto h-full w-full max-w-3xl space-y-3 overflow-y-auto p-4 sm:p-6">
        {error && <p className="text-center text-sm text-bosca-burdeo">{error}</p>}
        {cargando ? (
          <p className="text-center text-sm text-gray-400">Cargando…</p>
        ) : gastos.length === 0 ? (
          <p className="text-center text-sm text-gray-400">No tienes gastos pendientes por aprobar.</p>
        ) : (
          gastos.map((g) => (
            <div key={g.id} className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
              {/* Encabezado: comercio + monto */}
              <div className="flex items-start justify-between gap-3 border-b border-bosca-gris pb-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-bosca-carbon">{g.comercio}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{g.categoria}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xl font-bold tabular-nums text-bosca-carbon">{formatCLP(g.monto)}</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      g.tipoRendicion === "Devolucion"
                        ? "bg-bosca-ambar/15 text-bosca-ambar"
                        : "bg-bosca-gris text-gray-600"
                    }`}
                  >
                    {ETIQUETA_RENDICION[g.tipoRendicion] ?? g.tipoRendicion}
                  </span>
                </div>
              </div>

              {/* Detalle etiquetado */}
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 sm:grid-cols-3">
                <Campo etiqueta="Fecha del documento">{g.fechaDocumento}</Campo>
                <Campo etiqueta="Solicitante">
                  {g.usuarioNombre}
                  {g.usuarioArea ? <span className="text-gray-400"> · {g.usuarioArea}</span> : null}
                </Campo>
                <Campo etiqueta="Centro de costo">
                  <CodigoDetalle codigo={g.imputacion.centroCostoCodigo} detalle={g.imputacion.centroCostoDetalle} />
                </Campo>
                {(g.imputacion.areaCodigo || g.imputacion.areaDetalle) && (
                  <Campo etiqueta="Área">
                    <CodigoDetalle codigo={g.imputacion.areaCodigo} detalle={g.imputacion.areaDetalle} />
                  </Campo>
                )}
                {(g.imputacion.ubicacionCodigo || g.imputacion.ubicacionDetalle) && (
                  <Campo etiqueta="Ubicación">
                    <CodigoDetalle codigo={g.imputacion.ubicacionCodigo} detalle={g.imputacion.ubicacionDetalle} />
                  </Campo>
                )}
                <Campo etiqueta="Documento">
                  {g.tipoDocumento}
                  {g.numeroDocumento ? ` N° ${g.numeroDocumento}` : ""}
                </Campo>
                {g.iva > 0 && (
                  <Campo etiqueta="Neto / IVA">
                    {formatCLP(g.montoNeto)} <span className="text-gray-400">/</span> {formatCLP(g.iva)}
                  </Campo>
                )}
                {g.observacion && (
                  <Campo etiqueta="Observación" ancho>
                    {g.observacion}
                  </Campo>
                )}
              </dl>

              {g.imagenUrl && (
                <a
                  href={g.imagenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-bosca-burdeo hover:underline"
                >
                  Ver boleta
                </a>
              )}

              <input
                aria-label="Motivo del rechazo"
                className="mt-4 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
                placeholder="Motivo (obligatorio para rechazar)"
                value={motivos[g.id] ?? ""}
                onChange={(e) => setMotivos((m) => ({ ...m, [g.id]: e.target.value }))}
              />
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => decidir(g, "Aprobado")}
                  disabled={procesando === g.id}
                  className="flex-1 rounded-lg bg-bosca-burdeo px-4 py-2 text-sm font-medium text-white hover:bg-bosca-burdeo-h disabled:opacity-40"
                >
                  Aprobar
                </button>
                <button
                  onClick={() => decidir(g, "Rechazado")}
                  disabled={procesando === g.id}
                  className="flex-1 rounded-lg border border-bosca-gris px-4 py-2 text-sm text-bosca-carbon disabled:opacity-40"
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Aprobaciones />
    </AuthGate>
  );
}
