"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { cerrarSesion, getIdTokenActual } from "@/lib/firebase-client";

interface SesionApi {
  email: string;
  nombre: string;
  rol: string;
}

function Home() {
  const [sesion, setSesion] = useState<SesionApi | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      const token = await getIdTokenActual();
      if (!token) return;
      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "No autorizado");
        return;
      }
      const data = await res.json();
      setSesion(data.usuario);
    }
    cargar();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Rendición de Gastos</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {sesion ? (
        <p className="text-lg">
          Hola <strong>{sesion.nombre}</strong> ({sesion.rol})
        </p>
      ) : (
        !error && <p className="text-sm text-gray-500">Cargando tu sesión…</p>
      )}
      <button
        onClick={() => cerrarSesion()}
        className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100"
      >
        Cerrar sesión
      </button>
    </main>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Home />
    </AuthGate>
  );
}
