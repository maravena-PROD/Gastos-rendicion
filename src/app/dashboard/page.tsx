"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { getIdTokenActual } from "@/lib/firebase-client";
import { obtenerGastos, obtenerGastoApi, type ResumenGastoApi } from "@/lib/api-client";
import type { Gasto } from "@/lib/types";
import {
  filtrarPorRango,
  porTipoRendicion,
  totalGastos,
  porCategoria,
  porUsuario,
  tendenciaPorDia,
  contarPendientes,
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
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [gastoApi, setGastoApi] = useState<ResumenGastoApi | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        const token = await getIdTokenActual();
        if (token) {
          const meRes = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
          if (meRes.ok) setRol((await meRes.json()).usuario.rol);
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
    }
    cargar();
  }, []);

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
  const esAdmin = rol === "Administrador";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-bosca-carbon bg-bosca-carbon px-4 py-3">
        <span className="font-semibold text-bosca-crema">🔥 Bosca · Dashboard</span>
        <Link
          href="/"
          className="rounded-lg border border-white/25 px-3 py-1 text-xs text-bosca-crema hover:bg-white/10"
        >
          ← Chat
        </Link>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {cargando ? (
          <p className="text-center text-sm text-gray-400">Cargando…</p>
        ) : error ? (
          <p className="text-center text-sm text-red-600">{error}</p>
        ) : fechas.length === 0 ? (
          <p className="text-center text-sm text-gray-400">Aún no hay gastos registrados.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
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
            </div>

            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <p className="text-xs text-gray-500">Total del período</p>
              <p className="text-3xl font-bold text-gray-900">{formatCLP(totalGastos(delRango))}</p>
              <p className="text-sm text-gray-400">{delRango.length} gastos</p>
            </section>

            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Rendiciones vs Devoluciones</h2>
              {(() => {
                const t = porTipoRendicion(delRango);
                return (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Rendición (justificado)</p>
                      <p className="text-xl font-bold text-gray-900">{formatCLP(t.rendicion)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Devolución (a reembolsar)</p>
                      <p className="text-xl font-bold text-bosca-ambar">{formatCLP(t.devolucion)}</p>
                    </div>
                  </div>
                );
              })()}
            </section>

            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Por categoría</h2>
              <GraficoCategorias datos={porCategoria(delRango)} />
            </section>

            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Tendencia</h2>
              <GraficoTendencia datos={tendenciaPorDia(delRango)} />
            </section>

            {esAdmin && (
              <>
                <section className="rounded-2xl border border-bosca-gris bg-white p-4">
                  <h2 className="mb-2 text-sm font-semibold text-gray-700">Por usuario</h2>
                  <ul className="divide-y text-sm">
                    {porUsuario(delRango).map((u) => (
                      <li key={u.usuario} className="flex justify-between py-1.5">
                        <span className="text-gray-700">{u.usuario}</span>
                        <span className="font-medium text-gray-900">{formatCLP(u.total)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-2xl border border-bosca-gris bg-white p-4">
                  <p className="text-xs text-gray-500">Pendientes de aprobación</p>
                  <p className="text-2xl font-bold text-bosca-ambar">{contarPendientes(delRango)}</p>
                </section>
              </>
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
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
