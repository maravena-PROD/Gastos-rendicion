"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { getClientAuth } from "./firebase-client";

interface AuthState {
  user: User | null;
  cargando: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, cargando: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, cargando: true });

  useEffect(() => {
    const unsub = onAuthStateChanged(getClientAuth(), (user) => {
      setState({ user, cargando: false });
    });
    return () => unsub();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/** Acceso al estado de autenticación del cliente. */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}
