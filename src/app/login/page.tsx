"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { iniciarSesionGoogle } from "@/lib/firebase-client";

export default function LoginPage() {
  const { user, cargando } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cargando && user) router.replace("/");
  }, [cargando, user, router]);

  async function onLogin() {
    setError(null);
    try {
      await iniciarSesionGoogle();
      router.replace("/");
    } catch {
      setError("No se pudo iniciar sesión. Intenta de nuevo.");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bosca-crema p-6">
      <div className="flex flex-col items-center gap-2">
        <span className="text-4xl">🔥</span>
        <h1 className="text-2xl font-semibold text-bosca-carbon">Bosca · Rendición de Gastos</h1>
        <p className="text-sm text-gray-500">Inicia sesión con tu cuenta @bosca.cl</p>
      </div>
      <button
        onClick={onLogin}
        className="rounded-lg bg-bosca-burdeo px-5 py-3 font-medium text-white hover:bg-bosca-burdeo-h"
      >
        Iniciar sesión con Google
      </button>
      {error && <p className="text-sm text-bosca-burdeo">{error}</p>}
    </main>
  );
}
