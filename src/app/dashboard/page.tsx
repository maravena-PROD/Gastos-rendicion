"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { getIdTokenActual } from "@/lib/firebase-client";
import { obtenerGastos, obtenerGastoApi, obtenerAprobaciones, editarGasto, obtenerCentrosCosto, obtenerPerfil, type ResumenGastoApi, type GuardarGastoInput } from "@/lib/api-client";
import type { Gasto, CentroCostoEntry } from "@/lib/types";
import { TarjetaConfirmacion } from "@/components/chat/TarjetaConfirmacion";
import {
  filtrarPorRango,
  porTipoRendicion,
  totalGastos,
  porCategoria,
  porUsuario,
  tendenciaPorDia,
  contarPendientes,
  aprobadosPorTipo,
  rechazados,
} from "@/lib/dashboard";
import { formatCLP } from "@/lib/format";
import { GraficoCategorias } from "@/components/dashboard/GraficoCategorias";
import { GraficoTendencia } from "@/components/dashboard/GraficoTendencia";
import { GraficoGastoApi } from "@/components/dashboard/GraficoGastoApi";

const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

function Dashboard() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [rol, setRol] = useState<string>("");
  const [apruebaCc, setApruebaCc] = useState<string[]>([]);
  const [pendientesAprob, setPendientesAprob] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [gastoApi, setGastoApi] = useState<ResumenGastoApi | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [catalogoCC, setCatalogoCC] = useState<CentroCostoEntry[]>([]);
  const [cuenta, setCuenta] = useState({ banco: "", cuentaCorriente: "" });
  const [usuario, setUsuario] = useState({ nombre: "", area: "", cargo: "" });
  const [editando, setEditando] = useState<Gasto | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const token = await getIdTokenActual();
        if (token) {
          const meRes = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
          if (meRes.ok) {
            const u = (await meRes.json()).usuario;
            setRol(u.rol);
            setApruebaCc(u.apruebaCc ?? []);
          }
        }
        const { gastos } = await obtenerGastos();
        setGastos(gastos);
      } catch {
        setError("No se pudieron cargar los gastos.");
      } finally {
        setCargando(false);
      }
      // Panel de gasto de la API: solo aparece para el email autorizado.
      // Mejor esfuerzo y aparte: un fallo aquí no debe romper el dashboard.
      obtenerGastoApi()
        .then(setGastoApi)
        .catch(() => {});
      obtenerCentrosCosto().then(({ centros }) => setCatalogoCC(centros)).catch(() => {});
      obtenerPerfil()
        .then((p) => {
          setCuenta({ banco: p.banco, cuentaCorriente: p.cuentaCorriente });
          setUsuario({ nombre: p.nombre, area: p.area, cargo: p.cargo });
        })
        .catch(() => {});
    }
    cargar();
  }, []);

  useEffect(() => {
    if (apruebaCc.length === 0) return;
    obtenerAprobaciones().then(({ gastos }) => setPendientesAprob(gastos.length)).catch(() => {});
  }, [apruebaCc.length]);

  const fechas = useMemo(
    () => gastos.map((g) => g.fechaDocumento).filter(Boolean).sort(),
    [gastos],
  );
  const desdeActivo = desde || fechas[0] || "";
  const hastaActivo = hasta || fechas[fechas.length - 1] || "";
  const delRango = useMemo(
    () => (desdeActivo && hastaActivo ? filtrarPorRango(gastos, desdeActivo, hastaActivo) : []),
    [gastos, desdeActivo, hastaActivo],
  );
  // El PDF solo exporta gastos aprobados; sin aprobados en el rango, no hay nada que descargar.
  const aprobadosEnRango = useMemo(() => delRango.filter((g) => g.estado === "Aprobado").length, [delRango]);
  const esAdmin = rol === "Administrador";

  async function descargarReporte() {
    setDescargando(true);
    try {
      const token = await getIdTokenActual();
      const res = await fetch(`/api/reporte?desde=${desdeActivo}&hasta=${hastaActivo}`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Error al generar el PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rendicion-${desdeActivo}_a_${hastaActivo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar el reporte PDF.");
    } finally {
      setDescargando(false);
    }
  }

  return (
    <AppShell
      titulo="Mis gastos"
      usuario={{ nombre: usuario.nombre, area: usuario.area, cargo: usuario.cargo, apruebaCc }}
      pendientes={pendientesAprob}
    >
      <div className="mx-auto h-full w-full max-w-5xl space-y-5 overflow-y-auto p-4 sm:p-6">
        {cargando ? (
          <p className="text-center text-sm text-gray-400">Cargando…</p>
        ) : error ? (
          <p className="text-center text-sm text-red-600">{error}</p>
        ) : fechas.length === 0 ? (
          <p className="text-center text-sm text-gray-400">Aún no hay gastos registrados.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-bosca-gris bg-white p-3">
              <label className="text-sm text-gray-500">Desde:</label>
              <input
                type="date"
                className="rounded-lg border border-bosca-gris px-3 py-1 text-sm text-gray-900"
                value={desdeActivo}
                onChange={(e) => setDesde(e.target.value)}
              />
              <label className="text-sm text-gray-500">Hasta:</label>
              <input
                type="date"
                className="rounded-lg border border-bosca-gris px-3 py-1 text-sm text-gray-900"
                value={hastaActivo}
                onChange={(e) => setHasta(e.target.value)}
              />
              <button
                onClick={descargarReporte}
                disabled={descargando || aprobadosEnRango === 0}
                title={aprobadosEnRango === 0 ? "No hay gastos aprobados en el período" : "Exporta solo gastos aprobados"}
                className="ml-auto rounded-lg bg-bosca-burdeo px-3 py-1.5 text-sm font-medium text-white hover:bg-bosca-burdeo-h disabled:opacity-40"
              >
                {descargando ? "Generando…" : `Descargar PDF${aprobadosEnRango > 0 ? ` (${aprobadosEnRango})` : ""}`}
              </button>
            </div>

            {/* Banda de KPIs — densa, números prominentes */}
            {(() => {
              const t = porTipoRendicion(delRango);
              return (
                <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-2xl border border-bosca-gris bg-bosca-carbon p-4 sm:p-5">
                    <p className="text-xs text-bosca-crema/60">Total del período</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-bosca-crema sm:text-4xl">
                      {formatCLP(totalGastos(delRango))}
                    </p>
                    <p className="mt-1 text-xs text-bosca-crema/45">{delRango.length} gastos</p>
                  </div>
                  <div className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                    <p className="text-xs text-gray-500">Rendición</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                      {formatCLP(t.rendicion)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">Justificado</p>
                  </div>
                  <div className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                    <p className="text-xs text-gray-500">Devolución</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-bosca-ambar sm:text-3xl">
                      {formatCLP(t.devolucion)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">A reembolsar</p>
                  </div>
                  <div className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                    <p className="text-xs text-gray-500">Pendientes</p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                      {contarPendientes(delRango)}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">Por aprobar</p>
                  </div>
                </section>
              );
            })()}

            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Estado de mis gastos</h2>
              {(() => {
                const aprob = aprobadosPorTipo(delRango);
                const rech = rechazados(delRango);
                const pend = contarPendientes(delRango);
                return (
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-gray-500">Aprobado (Rendición)</p>
                        <p className="text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">{formatCLP(aprob.rendicion)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Aprobado (Devolución)</p>
                        <p className="text-xl font-bold tabular-nums text-bosca-ambar sm:text-2xl">{formatCLP(aprob.devolucion)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Pendientes</p>
                        <p className="text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">{pend}</p>
                      </div>
                    </div>
                    <div>
                      <p className="mb-1 text-gray-500">Rechazados ({rech.length})</p>
                      {rech.length === 0 ? (
                        <p className="text-xs text-gray-400">No tienes gastos rechazados.</p>
                      ) : (
                        <ul className="divide-y">
                          {rech.map((g) => (
                            <li key={g.id} className="flex items-start justify-between gap-2 py-1.5">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-gray-700">
                                  {g.fechaDocumento} · {g.comercio} · {formatCLP(g.monto)}
                                </p>
                                {g.motivo && <p className="text-xs text-bosca-burdeo">Motivo: {g.motivo}</p>}
                              </div>
                              <button
                                onClick={() => setEditando(g)}
                                className="shrink-0 rounded-lg border border-bosca-gris px-3 py-1 text-xs text-bosca-carbon hover:bg-bosca-gris"
                              >
                                Corregir
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })()}
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                <h2 className="mb-3 text-sm font-semibold text-gray-700">Por categoría</h2>
                <GraficoCategorias datos={porCategoria(delRango)} />
              </section>

              <section className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                <h2 className="mb-3 text-sm font-semibold text-gray-700">Tendencia</h2>
                <GraficoTendencia datos={tendenciaPorDia(delRango)} />
              </section>
            </div>

            {esAdmin && (
              <section className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                <h2 className="mb-3 text-sm font-semibold text-gray-700">Por usuario</h2>
                <ul className="divide-y">
                  {porUsuario(delRango).map((u) => (
                    <li key={u.usuario} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm text-gray-600">{u.usuario}</span>
                      <span className="shrink-0 text-base font-semibold tabular-nums text-gray-900">
                        {formatCLP(u.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {!cargando && gastoApi && (
          <section className="rounded-2xl border border-bosca-gris bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-700">Gasto de la API (Claude) · este mes</h2>
            <p className="mt-1 text-3xl font-bold text-gray-900">{usd(gastoApi.totalUSD)}</p>
            <p className="text-xs text-gray-400">Solo tú puedes ver este panel.</p>
            <div className="mt-3">
              <GraficoGastoApi datos={gastoApi.porDia} />
            </div>
          </section>
        )}
      </div>

      {editando && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="w-full max-w-md">
            <TarjetaConfirmacion
              borrador={{
                comercio: editando.comercio,
                monto: editando.monto,
                fechaDocumento: editando.fechaDocumento,
                categoria: editando.categoria,
                rutEmisor: editando.rutEmisor || null,
                numeroDocumento: editando.numeroDocumento || null,
                direccion: editando.direccion || null,
                tipoDocumento: editando.tipoDocumento,
                montoNeto: editando.montoNeto,
                iva: editando.iva,
              }}
              inicial={{
                tipoRendicion: editando.tipoRendicion,
                centroCostoCodigo: editando.imputacion.centroCostoCodigo,
                areaCodigo: editando.imputacion.areaCodigo,
                ubicacionCodigo: editando.imputacion.ubicacionCodigo,
                observacion: editando.observacion,
              }}
              imagenUrl={editando.imagenUrl || undefined}
              imagenDriveId={editando.imagenDriveId || undefined}
              catalogo={catalogoCC}
              cuentaActual={cuenta}
              titulo="Corregir gasto"
              textoConfirmar="Reenviar"
              deshabilitado={false}
              onConfirmar={async (datos: GuardarGastoInput) => {
                try {
                  await editarGasto(editando.id, datos);
                  setGastos((xs) => xs.map((x) => (x.id === editando.id ? { ...x, estado: "Registrado" } : x)));
                  setEditando(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "No se pudo reenviar el gasto.");
                }
              }}
              onCancelar={() => setEditando(null)}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
