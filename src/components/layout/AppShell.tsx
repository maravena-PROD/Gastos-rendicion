"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "@/lib/firebase-client";
import { Llama } from "@/components/layout/Llama";

/** Datos mínimos del usuario que muestra la barra lateral. */
export interface UsuarioShell {
  nombre?: string;
  area?: string;
  cargo?: string;
  apruebaCc?: string[];
}

interface AppShellProps {
  /** Título de la página actual, mostrado en la barra superior del contenido. */
  titulo: string;
  /** Datos del usuario para la tarjeta inferior y los permisos de navegación. */
  usuario?: UsuarioShell;
  /** Cantidad de gastos pendientes por aprobar (badge en Aprobaciones). */
  pendientes?: number;
  /** Acciones contextuales a la derecha de la barra superior. */
  acciones?: ReactNode;
  /** Contenido de la página. Controla su propio scroll dentro del área principal. */
  children: ReactNode;
}

interface ItemNav {
  href: string;
  etiqueta: string;
  icono: ReactNode;
  /** Solo visible si el usuario aprueba algún centro de costo. */
  soloAprobadores?: boolean;
}

const TRAZO = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconoRegistrar() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...TRAZO}>
      <path d="M7 4h7l4 4v9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M13 4v4h4" />
      <path d="M9 13h6M9 16h4" />
    </svg>
  );
}

function IconoDashboard() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...TRAZO}>
      <path d="M4 13h5v7H4zM10 4h4v16h-4zM15 9h5v11h-5z" />
    </svg>
  );
}

function IconoAprobar() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" {...TRAZO}>
      <path d="M12 3 4 6v5c0 4.5 3 7.5 8 9 5-1.5 8-4.5 8-9V6l-8-3Z" />
      <path d="m9 11 2.2 2.2L15.5 9" />
    </svg>
  );
}

function IconoSalir() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" {...TRAZO}>
      <path d="M14 4h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2" />
      <path d="M9 16l-4-4 4-4M5 12h10" />
    </svg>
  );
}

const NAV: ItemNav[] = [
  { href: "/", etiqueta: "Registrar gasto", icono: <IconoRegistrar /> },
  { href: "/dashboard", etiqueta: "Dashboard", icono: <IconoDashboard /> },
  { href: "/aprobaciones", etiqueta: "Aprobaciones", icono: <IconoAprobar />, soloAprobadores: true },
];

function iniciales(nombre?: string) {
  if (!nombre) return "··";
  const partes = nombre.trim().split(/\s+/);
  const primera = partes[0]?.[0] ?? "";
  const segunda = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primera + segunda).toUpperCase() || "··";
}

/** Contenido interno de la barra lateral, reutilizado en el riel fijo y en el drawer móvil. */
function ContenidoSidebar({
  usuario,
  pendientes,
  activa,
  onNavegar,
}: {
  usuario?: UsuarioShell;
  pendientes: number;
  activa: string;
  onNavegar?: () => void;
}) {
  const aprueba = (usuario?.apruebaCc?.length ?? 0) > 0;
  const items = NAV.filter((i) => !i.soloAprobadores || aprueba);

  return (
    <div className="flex h-full flex-col">
      {/* Marca */}
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.06] ring-1 ring-white/10">
          <Llama className="h-6 w-6" />
        </span>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-[0.08em] text-bosca-crema">BOSCA</p>
          <p className="text-[11px] tracking-wide text-bosca-crema/45">Rendición de gastos</p>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-bosca-crema/30">
          Menú
        </p>
        <ul className="space-y-1">
          {items.map((item) => {
            const esActiva =
              item.href === "/" ? activa === "/" : activa.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavegar}
                  aria-current={esActiva ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    esActiva
                      ? "bg-white/[0.07] font-medium text-bosca-crema"
                      : "text-bosca-crema/55 hover:bg-white/[0.04] hover:text-bosca-crema/90"
                  }`}
                >
                  {/* Indicador brasa del ítem activo */}
                  <span
                    className={`absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-gradient-to-b from-bosca-ambar to-bosca-burdeo transition-opacity ${
                      esActiva ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span className={esActiva ? "text-bosca-ambar" : "text-bosca-crema/55 group-hover:text-bosca-crema/90"}>
                    {item.icono}
                  </span>
                  <span className="flex-1">{item.etiqueta}</span>
                  {item.href === "/aprobaciones" && pendientes > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-bosca-ambar px-1.5 text-[11px] font-semibold text-bosca-carbon">
                      {pendientes}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Usuario */}
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bosca-burdeo text-xs font-semibold text-bosca-crema ring-1 ring-bosca-ambar/40">
            {iniciales(usuario?.nombre)}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium text-bosca-crema">{usuario?.nombre ?? "Usuario"}</p>
            <p className="truncate text-[11px] text-bosca-crema/45">
              {[usuario?.cargo, usuario?.area].filter(Boolean).join(" · ") || "—"}
            </p>
          </div>
        </div>
        <button
          onClick={() => cerrarSesion()}
          className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-bosca-crema/55 transition-colors hover:bg-white/[0.04] hover:text-bosca-crema"
        >
          <IconoSalir />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export function AppShell({ titulo, usuario, pendientes = 0, acciones, children }: AppShellProps) {
  const activa = usePathname();
  const [abierta, setAbierta] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-bosca-crema">
      {/* Riel fijo (escritorio) */}
      <aside className="hidden w-64 shrink-0 bg-bosca-carbon lg:block">
        <ContenidoSidebar usuario={usuario} pendientes={pendientes} activa={activa} />
      </aside>

      {/* Drawer móvil */}
      <div className={`fixed inset-0 z-40 lg:hidden ${abierta ? "" : "pointer-events-none"}`}>
        <div
          onClick={() => setAbierta(false)}
          className={`absolute inset-0 bg-black/50 transition-opacity ${abierta ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-72 bg-bosca-carbon shadow-2xl transition-transform duration-200 ${
            abierta ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <ContenidoSidebar
            usuario={usuario}
            pendientes={pendientes}
            activa={activa}
            onNavegar={() => setAbierta(false)}
          />
        </aside>
      </div>

      {/* Área principal */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-bosca-gris bg-white/70 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setAbierta(true)}
            aria-label="Abrir menú"
            className="grid h-9 w-9 place-items-center rounded-lg text-bosca-carbon hover:bg-bosca-gris lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" {...TRAZO}>
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <h1 className="flex-1 truncate text-base font-semibold text-bosca-carbon">{titulo}</h1>
          {acciones && <div className="flex items-center gap-2">{acciones}</div>}
        </header>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
