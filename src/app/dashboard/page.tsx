"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { getIdTokenActual } from "@/lib/firebase-client";
import { obtenerGastos } from "@/lib/api-client";
import type { Gasto } from "@/lib/types";
import {
  filtrarPorMes,
  totalGastos,
  porCategoria,
  porUsuario,
  tendenciaPorDia,
  contarPendientes,
  mesesDisponibles,
} from "@/lib/dashboard";
import { formatCLP } from "@/lib/format";
import { GraficoCategorias } from "@/components/dashboard/GraficoCategorias";
import { GraficoTendencia } from "@/components/dashboard/GraficoTendencia";

function Dashboard() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [rol, setRol] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mesElegido, setMesElegido] = useState<string>("");

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
    }
    cargar();
  }, []);

  const meses = useMemo(() => mesesDisponibles(gastos), [gastos]);
  const mesActivo = mesElegido || meses[0] || "";
  const delMes = useMemo(
    () => (mesActivo ? filtrarPorMes(gastos, mesActivo) : []),
    [gastos, mesActivo],
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
        ) : meses.length === 0 ? (
          <p className="text-center text-sm text-gray-400">Aún no hay gastos registrados.</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Período:</label>
              <select
                className="rounded-lg border border-bosca-gris px-3 py-1 text-sm text-gray-900"
                value={mesActivo}
                onChange={(e) => setMesElegido(e.target.value)}
              >
                {meses.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <p className="text-xs text-gray-500">Total del período</p>
              <p className="text-3xl font-bold text-gray-900">{formatCLP(totalGastos(delMes))}</p>
              <p className="text-sm text-gray-400">{delMes.length} gastos</p>
            </section>

            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Por categoría</h2>
              <GraficoCategorias datos={porCategoria(delMes)} />
            </section>

            <section className="rounded-2xl border border-bosca-gris bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Tendencia</h2>
              <GraficoTendencia datos={tendenciaPorDia(delMes)} />
            </section>

            {esAdmin && (
              <>
                <section className="rounded-2xl border border-bosca-gris bg-white p-4">
                  <h2 className="mb-2 text-sm font-semibold text-gray-700">Por usuario</h2>
                  <ul className="divide-y text-sm">
                    {porUsuario(delMes).map((u) => (
                      <li key={u.usuario} className="flex justify-between py-1.5">
                        <span className="text-gray-700">{u.usuario}</span>
                        <span className="font-medium text-gray-900">{formatCLP(u.total)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="rounded-2xl border border-bosca-gris bg-white p-4">
                  <p className="text-xs text-gray-500">Pendientes de aprobación</p>
                  <p className="text-2xl font-bold text-bosca-ambar">{contarPendientes(delMes)}</p>
                </section>
              </>
            )}
          </>
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
