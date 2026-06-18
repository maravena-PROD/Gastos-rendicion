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
  porCentroCosto,
  porCategoria,
  porUsuario,
  tendenciaPorDia,
  totalGastos,
} from "@/lib/dashboard";
import { GraficoCategorias } from "@/components/dashboard/GraficoCategorias";
import { GraficoTendencia } from "@/components/dashboard/GraficoTendencia";

type Modo = "mes" | "anio";

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

function Analisis() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [usuario, setUsuario] = useState({ nombre: "", area: "", cargo: "", apruebaCc: [] as string[] });
  const [pendientes, setPendientes] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modo, setModo] = useState<Modo>("mes");
  const [periodo, setPeriodo] = useState<string>("");

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

  // Mantiene el período seleccionado válido para el modo actual (default: el más reciente).
  const periodoActivo = periodos.includes(periodo) ? periodo : periodos[0] ?? "";

  const delPeriodo = useMemo(
    () => (modo === "mes" ? filtrarPorMes(gastos, periodoActivo) : filtrarPorAnio(gastos, periodoActivo)),
    [gastos, modo, periodoActivo],
  );
  // Los totales y desgloses cuentan el gasto real: todo menos lo Rechazado.
  const reales = useMemo(() => delPeriodo.filter((g) => g.estado !== "Rechazado"), [delPeriodo]);

  const aprobado = reales.filter((g) => g.estado === "Aprobado");
  const pendiente = reales.filter((g) => g.estado === "Registrado");
  const rechazado = delPeriodo.filter((g) => g.estado === "Rechazado");

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setPeriodo(""); // fuerza el default (más reciente) del nuevo modo
  }

  return (
    <AppShell titulo="Análisis de centros de costo" usuario={usuario} pendientes={pendientes}>
      <div className="mx-auto h-full w-full max-w-5xl space-y-5 overflow-y-auto p-4 sm:p-6">
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
            {/* Selector de período */}
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
                onChange={(e) => setPeriodo(e.target.value)}
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

            {/* Total del período */}
            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <p className="text-xs text-gray-500">Gasto del período (sin rechazados)</p>
              <p className="text-3xl font-bold text-gray-900">{formatCLP(totalGastos(reales))}</p>
              <p className="text-sm text-gray-400">{reales.length} gastos</p>
            </section>

            {/* Por centro de costo */}
            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Por centro de costo</h2>
              <ul className="divide-y text-sm">
                {porCentroCosto(reales).map((cc) => (
                  <li key={cc.codigo} className="flex items-center justify-between gap-3 py-2">
                    <span className="min-w-0 truncate text-gray-700">
                      <span className="font-medium text-bosca-carbon">{cc.codigo}</span>
                      {cc.detalle ? ` · ${cc.detalle}` : ""}
                    </span>
                    <span className="shrink-0 font-semibold text-gray-900">{formatCLP(cc.total)}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Estado */}
            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Estado</h2>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Aprobado ({aprobado.length})</p>
                  <p className="text-lg font-bold text-gray-900">{formatCLP(totalGastos(aprobado))}</p>
                </div>
                <div>
                  <p className="text-gray-500">Pendiente ({pendiente.length})</p>
                  <p className="text-lg font-bold text-bosca-ambar">{formatCLP(totalGastos(pendiente))}</p>
                </div>
                <div>
                  <p className="text-gray-500">Rechazado ({rechazado.length})</p>
                  <p className="text-lg font-bold text-bosca-burdeo">{formatCLP(totalGastos(rechazado))}</p>
                </div>
              </div>
            </section>

            {/* Por categoría */}
            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Por categoría</h2>
              <GraficoCategorias datos={porCategoria(reales)} />
            </section>

            {/* Por usuario */}
            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Por usuario</h2>
              <ul className="divide-y text-sm">
                {porUsuario(reales).map((u) => (
                  <li key={u.usuario} className="flex justify-between py-2">
                    <span className="text-gray-700">{u.usuario}</span>
                    <span className="font-medium text-gray-900">{formatCLP(u.total)}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Tendencia */}
            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Tendencia</h2>
              <GraficoTendencia datos={tendenciaPorDia(reales)} />
            </section>
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
