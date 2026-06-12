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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Rendición de Gastos</h1>
      <p className="text-sm text-gray-500">Inicia sesión con tu cuenta @bosca.cl</p>
      <button
        onClick={onLogin}
        className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
      >
        Iniciar sesión con Google
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </main>
  );
}
