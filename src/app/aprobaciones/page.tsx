"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { obtenerAprobaciones, decidirGasto } from "@/lib/api-client";
import type { Gasto } from "@/lib/types";
import { formatCLP } from "@/lib/format";

function Aprobaciones() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [procesando, setProcesando] = useState<string | null>(null);

  useEffect(() => {
    obtenerAprobaciones()
      .then((r) => setGastos(r.gastos))
      .catch(() => setError("No se pudieron cargar las aprobaciones."))
      .finally(() => setCargando(false));
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
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-bosca-carbon bg-bosca-carbon px-4 py-3">
        <span className="font-semibold text-bosca-crema">🔥 Bosca · Aprobaciones</span>
        <Link href="/" className="rounded-lg border border-white/25 px-3 py-1 text-xs text-bosca-crema hover:bg-white/10">
          ← Chat
        </Link>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {error && <p className="text-center text-sm text-bosca-burdeo">{error}</p>}
        {cargando ? (
          <p className="text-center text-sm text-gray-400">Cargando…</p>
        ) : gastos.length === 0 ? (
          <p className="text-center text-sm text-gray-400">No tienes gastos pendientes por aprobar.</p>
        ) : (
          gastos.map((g) => (
            <div key={g.id} className="rounded-2xl border border-bosca-gris bg-white p-4">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-bosca-carbon">{g.comercio}</span>
                <span className="font-semibold text-bosca-carbon">{formatCLP(g.monto)}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {g.fechaDocumento} · {g.usuarioNombre} · CC {g.imputacion.centroCostoCodigo}
                {g.imputacion.centroCostoDetalle ? ` (${g.imputacion.centroCostoDetalle})` : ""} · {g.tipoRendicion}
              </p>
              {g.observacion && <p className="mt-1 text-xs text-gray-500">{g.observacion}</p>}
              {g.imagenUrl && (
                <a href={g.imagenUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-bosca-burdeo underline">
                  Ver boleta
                </a>
              )}
              <input
                className="mt-2 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
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
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Aprobaciones />
    </AuthGate>
  );
}
