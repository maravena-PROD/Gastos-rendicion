"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/** Envuelve contenido protegido: redirige a /login si no hay sesión. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, cargando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && !user) {
      router.replace("/login");
    }
  }, [cargando, user, router]);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bosca-crema text-sm text-gray-500">
        Cargando…
      </div>
    );
  }
  if (!user) {
    return null; // redirigiendo
  }
  return <>{children}</>;
}
