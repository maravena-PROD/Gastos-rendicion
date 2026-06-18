"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { AppShell } from "@/components/layout/AppShell";
import { obtenerAnalisisCc, obtenerAprobaciones, obtenerPerfil } from "@/lib/api-client";
import type { Gasto } from "@/lib/types";
import { formatCLP } from "@/lib/format";
import {
  filtrarPorMes,
  filtrarPorAnio,
  mesesDisponibles,
  aniosDisponibles,
  porDimension,
  arbolPorImputacion,
  porCategoria,
  porUsuario,
  tendenciaPorDia,
  totalGastos,
  type DimensionImputacion,
  type GrupoImputacion,
  type NodoImputacion,
} from "@/lib/dashboard";
import { GraficoCategorias } from "@/components/dashboard/GraficoCategorias";
import { GraficoTendencia } from "@/components/dashboard/GraficoTendencia";

type Modo = "mes" | "anio";

const DIMENSIONES: { clave: DimensionImputacion; etiqueta: string }[] = [
  { clave: "centroCosto", etiqueta: "Centro de costo" },
  { clave: "area", etiqueta: "Área" },
  { clave: "ubicacion", etiqueta: "Ubicación" },
];

/** Etiqueta legible de un período "AAAA-MM" → "junio 2026". */
function etiquetaMes(anioMes: string): string {
  const [anio, mes] = anioMes.split("-");
  const nombres = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const i = Number(mes) - 1;
  return nombres[i] ? `${nombres[i]} ${anio}` : anioMes;
}

/** Etiqueta "código · detalle" (o solo uno si falta el otro). */
function etiquetaGrupo(codigo: string, detalle: string): string {
  if (codigo && detalle) return `${codigo} · ${detalle}`;
  return codigo || detalle || "—";
}

/** Selector de filtro por dimensión, con opción "Todas". */
function FiltroSelect({
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  valor: string;
  opciones: GrupoImputacion[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-bosca-gris px-3 py-1.5 text-sm text-gray-900"
      >
        <option value="">Todas</option>
        {opciones.map((o) => (
          <option key={o.codigo} value={o.codigo}>
            {etiquetaGrupo(o.codigo, o.detalle)}
          </option>
        ))}
      </select>
    </label>
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

/** Fila recursiva del árbol de imputación (CC ▸ Área ▸ Ubicación). */
function FilaNodo({
  nodo,
  nivel,
  ruta,
  expandidos,
  onToggle,
}: {
  nodo: NodoImputacion;
  nivel: number;
  ruta: string;
  expandidos: Set<string>;
  onToggle: (ruta: string) => void;
}) {
  const tieneHijos = !!nodo.hijos?.length;
  const abierto = expandidos.has(ruta);
  return (
    <>
      <div
        onClick={tieneHijos ? () => onToggle(ruta) : undefined}
        role={tieneHijos ? "button" : undefined}
        tabIndex={tieneHijos ? 0 : undefined}
        onKeyDown={tieneHijos ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onToggle(ruta)) : undefined}
        className={`flex items-center justify-between gap-3 border-b border-bosca-gris/50 py-2 ${
          tieneHijos ? "cursor-pointer hover:bg-bosca-crema/60" : ""
        }`}
        style={{ paddingLeft: 8 + nivel * 22 }}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {tieneHijos ? <Chevron abierto={abierto} /> : <span className="w-4 shrink-0" />}
          <span className="min-w-0 truncate text-sm text-gray-600">
            <span className={nivel === 0 ? "font-semibold text-bosca-carbon" : "font-medium text-bosca-carbon"}>
              {nodo.codigo || "—"}
            </span>
            {nodo.detalle ? ` · ${nodo.detalle}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-4 pr-2">
          <span className="text-xs text-gray-400">{nodo.cantidad}</span>
          <span className="w-28 text-right text-sm font-semibold tabular-nums text-gray-900">
            {formatCLP(nodo.total)}
          </span>
        </span>
      </div>
      {abierto &&
        nodo.hijos?.map((h) => (
          <FilaNodo
            key={h.codigo}
            nodo={h}
            nivel={nivel + 1}
            ruta={`${ruta}/${h.codigo}`}
            expandidos={expandidos}
            onToggle={onToggle}
          />
        ))}
    </>
  );
}

function Analisis() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [usuario, setUsuario] = useState({ nombre: "", area: "", cargo: "", apruebaCc: [] as string[] });
  const [pendientes, setPendientes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>("mes");
  const [periodo, setPeriodo] = useState<string>("");
  const [dim, setDim] = useState<DimensionImputacion>("centroCosto");
  const [fCc, setFCc] = useState("");
  const [fArea, setFArea] = useState("");
  const [fUbic, setFUbic] = useState("");
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());

  useEffect(() => {
    obtenerPerfil()
      .then((p) => setUsuario({ nombre: p.nombre, area: p.area, cargo: p.cargo, apruebaCc: p.apruebaCc }))
      .catch(() => {});
    obtenerAprobaciones().then(({ gastos }) => setPendientes(gastos.length)).catch(() => {});
    obtenerAnalisisCc()
      .then(({ gastos }) => setGastos(gastos))
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el análisis."))
      .finally(() => setCargando(false));
  }, []);

  const meses = useMemo(() => mesesDisponibles(gastos), [gastos]);
  const anios = useMemo(() => aniosDisponibles(gastos), [gastos]);
  const periodos = modo === "mes" ? meses : anios;
  const periodoActivo = periodos.includes(periodo) ? periodo : periodos[0] ?? "";

  const delPeriodo = useMemo(
    () => (modo === "mes" ? filtrarPorMes(gastos, periodoActivo) : filtrarPorAnio(gastos, periodoActivo)),
    [gastos, modo, periodoActivo],
  );
  // Gasto real del período: todo menos lo rechazado.
  const reales = useMemo(() => delPeriodo.filter((g) => g.estado !== "Rechazado"), [delPeriodo]);

  // Opciones de los filtros, derivadas del período (no de lo ya filtrado).
  const opcionesCc = useMemo(() => porDimension(reales, "centroCosto"), [reales]);
  const opcionesArea = useMemo(() => porDimension(reales, "area"), [reales]);
  const opcionesUbic = useMemo(() => porDimension(reales, "ubicacion"), [reales]);

  // Subconjunto tras aplicar los filtros de imputación.
  const filtrados = useMemo(
    () =>
      reales.filter(
        (g) =>
          (!fCc || g.imputacion.centroCostoCodigo === fCc) &&
          (!fArea || g.imputacion.areaCodigo === fArea) &&
          (!fUbic || g.imputacion.ubicacionCodigo === fUbic),
      ),
    [reales, fCc, fArea, fUbic],
  );

  const hayFiltro = fCc || fArea || fUbic;
  const arbol = useMemo(() => arbolPorImputacion(filtrados), [filtrados]);
  const torta = porDimension(filtrados, dim).map((x) => ({
    categoria: x.detalle || x.codigo || "—",
    total: x.total,
  }));

  function resetFiltros() {
    setFCc("");
    setFArea("");
    setFUbic("");
    setExpandidos(new Set());
  }
  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setPeriodo("");
    resetFiltros();
  }
  function toggleNodo(ruta: string) {
    setExpandidos((prev) => {
      const sig = new Set(prev);
      if (sig.has(ruta)) sig.delete(ruta);
      else sig.add(ruta);
      return sig;
    });
  }

  return (
    <AppShell titulo="Análisis de centros de costo" usuario={usuario} pendientes={pendientes}>
      <div className="mx-auto h-full w-full max-w-6xl space-y-4 overflow-y-auto p-4 sm:p-6">
        {cargando ? (
          <p className="text-center text-sm text-gray-400">Cargando…</p>
        ) : error ? (
          <p className="text-center text-sm text-bosca-burdeo">{error}</p>
        ) : gastos.length === 0 ? (
          <p className="text-center text-sm text-gray-400">
            Aún no hay gastos en los centros de costo que administras.
          </p>
        ) : (
          <>
            {/* Período */}
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-bosca-gris bg-white p-3">
              <div className="inline-flex rounded-lg border border-bosca-gris p-0.5">
                {(["mes", "anio"] as Modo[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => cambiarModo(m)}
                    className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                      modo === m ? "bg-bosca-burdeo text-white" : "text-bosca-carbon hover:bg-bosca-gris"
                    }`}
                  >
                    {m === "mes" ? "Mes" : "Año"}
                  </button>
                ))}
              </div>
              <select
                aria-label="Período"
                className="rounded-lg border border-bosca-gris px-3 py-1.5 text-sm text-gray-900"
                value={periodoActivo}
                onChange={(e) => {
                  setPeriodo(e.target.value);
                  resetFiltros();
                }}
              >
                {periodos.map((p) => (
                  <option key={p} value={p}>
                    {modo === "mes" ? etiquetaMes(p) : p}
                  </option>
                ))}
              </select>
              <span className="ml-auto text-xs text-gray-400">
                {usuario.apruebaCc.includes("*")
                  ? "Todos los centros de costo"
                  : `${usuario.apruebaCc.length} centro(s) de costo`}
              </span>
            </div>

            {/* Filtros de imputación */}
            <div className="rounded-2xl border border-bosca-gris bg-white p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <FiltroSelect etiqueta="Centro de costo" valor={fCc} opciones={opcionesCc} onChange={setFCc} />
                <FiltroSelect etiqueta="Área" valor={fArea} opciones={opcionesArea} onChange={setFArea} />
                <FiltroSelect etiqueta="Ubicación" valor={fUbic} opciones={opcionesUbic} onChange={setFUbic} />
                {hayFiltro && (
                  <button
                    onClick={resetFiltros}
                    className="shrink-0 rounded-lg border border-bosca-gris px-3 py-1.5 text-sm text-bosca-carbon hover:bg-bosca-gris"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            {/* KPIs (sobre lo filtrado) */}
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-bosca-gris bg-bosca-carbon p-4 sm:p-5">
                <p className="text-xs text-bosca-crema/60">Gasto filtrado</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-bosca-crema sm:text-4xl">
                  {formatCLP(totalGastos(filtrados))}
                </p>
                <p className="mt-1 text-xs text-bosca-crema/45">{filtrados.length} gastos · sin rechazados</p>
              </div>
              <div className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                <p className="text-xs text-gray-500">Aprobado</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  {formatCLP(totalGastos(filtrados.filter((g) => g.estado === "Aprobado")))}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {filtrados.filter((g) => g.estado === "Aprobado").length} gastos
                </p>
              </div>
              <div className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                <p className="text-xs text-gray-500">Pendiente</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-bosca-ambar sm:text-3xl">
                  {formatCLP(totalGastos(filtrados.filter((g) => g.estado === "Registrado")))}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {filtrados.filter((g) => g.estado === "Registrado").length} gastos
                </p>
              </div>
              <div className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                <p className="text-xs text-gray-500">Centros de costo</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                  {new Set(filtrados.map((g) => g.imputacion.centroCostoCodigo)).size}
                </p>
                <p className="mt-1 text-xs text-gray-400">con gasto</p>
              </div>
            </section>

            {/* Gráfico por dimensión + tabla jerárquica */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">Distribución</h2>
                  <div className="inline-flex rounded-lg border border-bosca-gris p-0.5">
                    {DIMENSIONES.map((d) => (
                      <button
                        key={d.clave}
                        onClick={() => setDim(d.clave)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          dim === d.clave ? "bg-bosca-burdeo text-white" : "text-bosca-carbon hover:bg-bosca-gris"
                        }`}
                      >
                        {d.etiqueta}
                      </button>
                    ))}
                  </div>
                </div>
                <GraficoCategorias datos={torta} />
              </section>

              <section className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-700">Tabla por imputación</h2>
                  <p className="text-xs text-gray-400">CC ▸ Área ▸ Ubicación</p>
                </div>
                <div className="flex items-center justify-between border-b border-bosca-gris pb-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                  <span className="pl-2">Imputación</span>
                  <span className="flex items-center gap-4 pr-2">
                    <span>Gastos</span>
                    <span className="w-28 text-right">Monto</span>
                  </span>
                </div>
                {arbol.length === 0 ? (
                  <p className="py-4 text-sm text-gray-400">Sin datos para los filtros aplicados.</p>
                ) : (
                  <div>
                    {arbol.map((n) => (
                      <FilaNodo
                        key={n.codigo}
                        nodo={n}
                        nivel={0}
                        ruta={n.codigo}
                        expandidos={expandidos}
                        onToggle={toggleNodo}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Tendencia */}
            <section className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
              <h2 className="mb-3 text-sm font-semibold text-gray-700">Tendencia</h2>
              <GraficoTendencia datos={tendenciaPorDia(filtrados)} />
            </section>

            {/* Categoría y usuarios */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                <h2 className="mb-3 text-sm font-semibold text-gray-700">Por categoría</h2>
                <GraficoCategorias datos={porCategoria(filtrados)} />
              </section>

              <section className="rounded-2xl border border-bosca-gris bg-white p-4 sm:p-5">
                <h2 className="mb-3 text-sm font-semibold text-gray-700">Por usuario</h2>
                <ul className="divide-y">
                  {porUsuario(filtrados).map((u) => (
                    <li key={u.usuario} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm text-gray-600">{u.usuario}</span>
                      <span className="shrink-0 text-base font-semibold tabular-nums text-gray-900">
                        {formatCLP(u.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Analisis />
    </AuthGate>
  );
}
