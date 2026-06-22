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
  arbolMisGastos,
  type NodoDetalle,
} from "@/lib/dashboard";
import { formatCLP, formatMes } from "@/lib/format";
import { GraficoCategorias } from "@/components/dashboard/GraficoCategorias";
import { GraficoTendencia } from "@/components/dashboard/GraficoTendencia";
import { GraficoGastoApi } from "@/components/dashboard/GraficoGastoApi";

const usd = (v: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

const ESTILO_ESTADO: Record<string, string> = {
  Aprobado: "bg-green-100 text-green-700",
  Rechazado: "bg-red-100 text-bosca-burdeo",
  Registrado: "bg-amber-100 text-amber-700",
};

/** Píldora de color con el estado del gasto. "Registrado" se muestra como "Pendiente". */
function EstadoBadge({ estado }: { estado: string }) {
  const etiqueta = estado === "Registrado" ? "Pendiente" : estado;
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTILO_ESTADO[estado] ?? "bg-gray-100 text-gray-600"}`}>
      {etiqueta}
    </span>
  );
}

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${abierto ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/**
 * Fila recursiva de la tabla dinámica de Mis gastos (Mes ▸ Categoría ▸ gasto).
 * Las hojas (registros individuales) muestran el badge de estado; las rechazadas
 * son accionables para corregir.
 */
function FilaDetalle({
  nodo,
  nivel,
  expandidos,
  onToggle,
  onCorregir,
}: {
  nodo: NodoDetalle;
  nivel: number;
  expandidos: Set<string>;
  onToggle: (clave: string) => void;
  onCorregir: (g: Gasto) => void;
}) {
  const tieneHijos = !!nodo.hijos?.length;
  const abierto = expandidos.has(nodo.clave);
  const gasto = nodo.gasto;
  const rechazado = gasto?.estado === "Rechazado";
  const accionable = tieneHijos || rechazado;
  const sangria = 8 + nivel * 16;

  function activar() {
    if (tieneHijos) onToggle(nodo.clave);
    else if (rechazado && gasto) onCorregir(gasto);
  }

  return (
    <>
      <div
        onClick={accionable ? activar : undefined}
        role={accionable ? "button" : undefined}
        tabIndex={accionable ? 0 : undefined}
        onKeyDown={accionable ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), activar()) : undefined}
        title={rechazado ? "Corregir gasto rechazado" : undefined}
        className={`flex items-center justify-between gap-2 border-b border-bosca-gris/50 py-2 ${
          accionable ? "cursor-pointer hover:bg-bosca-crema/60" : ""
        }`}
        style={{ paddingLeft: sangria }}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {tieneHijos ? <Chevron abierto={abierto} /> : <span className="w-4 shrink-0" />}
          <span className="min-w-0 truncate">
            {gasto ? (
              <span className="text-sm text-gray-700">
                <span className="tabular-nums text-gray-400">{gasto.fechaDocumento.slice(8, 10) || "—"} · </span>
                <span className="font-medium text-bosca-carbon">{nodo.etiqueta}</span>
                {gasto.tipoRendicion === "Devolucion" && <span className="text-bosca-ambar"> · Devolución</span>}
              </span>
            ) : (
              <span className="text-sm">
                <span className={nivel === 0 ? "font-semibold capitalize text-bosca-carbon" : "font-medium text-bosca-carbon"}>
                  {nivel === 0 ? formatMes(nodo.etiqueta) : nodo.etiqueta}
                </span>
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pr-2 sm:gap-3">
          {gasto ? (
            <EstadoBadge estado={gasto.estado} />
          ) : (
            <span className="text-xs text-gray-400">{nodo.cantidad}</span>
          )}
          <span className="w-20 text-right text-sm font-semibold tabular-nums text-gray-900 sm:w-28">
            {formatCLP(nodo.total)}
          </span>
        </span>
      </div>
      {abierto &&
        nodo.hijos?.map((h) => (
          <FilaDetalle
            key={h.clave}
            nodo={h}
            nivel={nivel + 1}
            expandidos={expandidos}
            onToggle={onToggle}
            onCorregir={onCorregir}
          />
        ))}
    </>
  );
}

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
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [tocado, setTocado] = useState(false);

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
  const arbol = useMemo(() => arbolMisGastos(delRango), [delRango]);
  const esAdmin = rol === "Administrador";

  // Mientras el usuario no toque nada, el mes más reciente aparece abierto.
  const primerMes = arbol[0]?.clave;
  const expandidosEfectivos = tocado ? expandidos : new Set(primerMes ? [primerMes] : []);

  function alternarNodo(clave: string) {
    setExpandidos(() => {
      const sig = new Set(expandidosEfectivos);
      if (sig.has(clave)) sig.delete(clave);
      else sig.add(clave);
      return sig;
    });
    if (!tocado) setTocado(true);
  }

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
            <div className="flex flex-col gap-3 rounded-2xl border border-bosca-gris bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
              <div className="flex items-center gap-2">
                <label className="w-12 shrink-0 text-sm text-gray-500 sm:w-auto">Desde:</label>
                <input
                  type="date"
                  className="min-w-0 flex-1 rounded-lg border border-bosca-gris px-3 py-1 text-sm text-gray-900 sm:flex-none"
                  value={desdeActivo}
                  onChange={(e) => setDesde(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="w-12 shrink-0 text-sm text-gray-500 sm:w-auto">Hasta:</label>
                <input
                  type="date"
                  className="min-w-0 flex-1 rounded-lg border border-bosca-gris px-3 py-1 text-sm text-gray-900 sm:flex-none"
                  value={hastaActivo}
                  onChange={(e) => setHasta(e.target.value)}
                />
              </div>
              <button
                onClick={descargarReporte}
                disabled={descargando || aprobadosEnRango === 0}
                title={aprobadosEnRango === 0 ? "No hay gastos aprobados en el período" : "Exporta solo gastos aprobados"}
                className="w-full rounded-lg bg-bosca-burdeo px-3 py-1.5 text-sm font-medium text-white hover:bg-bosca-burdeo-h disabled:opacity-40 sm:ml-auto sm:w-auto"
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
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      <div className="min-w-0">
                        <p className="text-gray-500">Aprobado (Rendición)</p>
                        <p className="text-lg font-bold tabular-nums text-gray-900 sm:text-2xl">{formatCLP(aprob.rendicion)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-500">Aprobado (Devolución)</p>
                        <p className="text-lg font-bold tabular-nums text-bosca-ambar sm:text-2xl">{formatCLP(aprob.devolucion)}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-500">Pendientes</p>
                        <p className="text-lg font-bold tabular-nums text-gray-900 sm:text-2xl">{pend}</p>
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

            <section className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-700">Detalle de gastos por mes</h2>
                <p className="text-xs text-gray-400">Mes ▸ Categoría ▸ Gasto</p>
              </div>
              {arbol.length === 0 ? (
                <p className="py-4 text-sm text-gray-400">No hay gastos en el período seleccionado.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-bosca-gris pb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                    <span className="pl-2">Detalle</span>
                    <span className="flex items-center gap-3 pr-2">
                      <span>Estado / N°</span>
                      <span className="w-24 text-right sm:w-28">Monto</span>
                    </span>
                  </div>
                  <div>
                    {arbol.map((n) => (
                      <FilaDetalle
                        key={n.clave}
                        nodo={n}
                        nivel={0}
                        expandidos={expandidosEfectivos}
                        onToggle={alternarNodo}
                        onCorregir={setEditando}
                      />
                    ))}
                  </div>
                </>
              )}
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
                rutReceptor: null,
                razonSocialReceptor: null,
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
