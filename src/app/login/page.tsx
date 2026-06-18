"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { iniciarSesionGoogle } from "@/lib/firebase-client";
import { Llama } from "@/components/layout/Llama";

function IconoGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
      <path fill="#4285F4" d="M23 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.16a5.27 5.27 0 0 1-2.28 3.46v2.88h3.69C21.7 18.92 23 15.92 23 12.27Z" />
      <path fill="#34A853" d="M12 24c3.08 0 5.66-1.02 7.55-2.76l-3.69-2.88c-1.02.69-2.33 1.1-3.86 1.1-2.97 0-5.48-2-6.38-4.69H1.78v2.97A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.62 14.27a7.2 7.2 0 0 1 0-4.54V6.76H1.78a12 12 0 0 0 0 10.48l3.84-2.97Z" />
      <path fill="#EA4335" d="M12 4.77c1.68 0 3.18.58 4.36 1.71l3.27-3.27C17.66 1.2 15.08 0 12 0A11.99 11.99 0 0 0 1.78 6.76l3.84 2.97C6.52 6.77 9.03 4.77 12 4.77Z" />
    </svg>
  );
}

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bosca-crema p-6">
      {/* Halo de brasa ambiental */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-bosca-ambar/15 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        {/* Marca, igual que la barra lateral */}
        <div className="mb-6 flex items-center justify-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-bosca-carbon ring-1 ring-white/10">
            <Llama className="h-6 w-6" id="brasa-login" />
          </span>
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-[0.08em] text-bosca-carbon">BOSCA</p>
            <p className="text-[11px] tracking-wide text-bosca-carbon/45">Rendición de gastos</p>
          </div>
        </div>

        {/* Tarjeta de acceso */}
        <div className="rounded-2xl border border-bosca-gris bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-bosca-carbon">Inicia sesión</h1>
          <p className="mt-1 text-sm text-gray-500">
            Usa tu cuenta corporativa <span className="font-medium text-bosca-carbon">@bosca.cl</span>.
          </p>

          <button
            onClick={onLogin}
            className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-bosca-gris bg-white px-5 py-3 text-sm font-medium text-bosca-carbon transition-colors hover:bg-bosca-gris"
          >
            <IconoGoogle />
            Continuar con Google
          </button>

          {error && <p className="mt-3 text-sm text-bosca-burdeo">{error}</p>}
        </div>

        <p className="mt-4 text-center text-[11px] text-bosca-carbon/40">
          Acceso restringido al personal de Bosca.
        </p>
      </div>
    </main>
  );
}
