"use client";

import { useState } from "react";
import { guardarPerfil } from "@/lib/api-client";
import { validarRut, formatRut } from "@/lib/format";

export function Onboarding({
  nombreInicial,
  areas,
  onListo,
}: {
  nombreInicial: string;
  areas: string[];
  onListo: () => void;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [rut, setRut] = useState("");
  const [area, setArea] = useState("");
  const [banco, setBanco] = useState("");
  const [cuentaCorriente, setCuentaCorriente] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rutValido = validarRut(rut);
  const completo = nombre.trim() !== "" && rutValido && area !== "";

  async function enviar() {
    if (!completo) return;
    setGuardando(true);
    setError(null);
    try {
      await guardarPerfil({
        nombre: nombre.trim(),
        rut,
        area,
        banco: banco.trim() || undefined,
        cuentaCorriente: cuentaCorriente.trim() || undefined,
      });
      onListo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bosca-crema p-6">
      <div className="w-full max-w-sm rounded-2xl border border-bosca-gris bg-white p-5">
        <h1 className="mb-1 text-lg font-semibold text-bosca-carbon">Completa tu perfil</h1>
        <p className="mb-4 text-sm text-gray-500">Solo la primera vez.</p>
        <div className="flex flex-col gap-3">
          <label className="text-xs text-gray-500">
            Nombre completo
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-500">
            RUT
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              placeholder="76.543.219-7"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              onBlur={() => rutValido && setRut(formatRut(rut))}
            />
            {rut !== "" && !rutValido && (
              <span className="text-xs text-bosca-burdeo">RUT inválido</span>
            )}
          </label>
          <label className="text-xs text-gray-500">
            Área de trabajo
            <select
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-500">
            Banco (opcional, para devoluciones)
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              placeholder="Banco Santander"
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
            />
          </label>
          <label className="text-xs text-gray-500">
            N° cuenta corriente (opcional)
            <input
              className="mt-1 w-full rounded-lg border border-bosca-gris px-3 py-2 text-sm text-bosca-carbon"
              placeholder="66788482"
              value={cuentaCorriente}
              onChange={(e) => setCuentaCorriente(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-bosca-burdeo">{error}</p>}
        <button
          onClick={enviar}
          disabled={!completo || guardando}
          className="mt-4 w-full rounded-lg bg-bosca-burdeo px-4 py-2 text-sm font-medium text-white hover:bg-bosca-burdeo-h disabled:opacity-40"
        >
          {guardando ? "Guardando…" : "Guardar y empezar"}
        </button>
      </div>
    </div>
  );
}
