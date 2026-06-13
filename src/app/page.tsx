"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { cerrarSesion, getIdTokenActual } from "@/lib/firebase-client";
import {
  extraerDesdeTexto,
  extraerDesdeImagen,
  subirBoleta,
  guardarGasto,
  obtenerPerfil,
  type GuardarGastoInput,
  type Perfil,
} from "@/lib/api-client";
import { fileABase64 } from "@/lib/imagen";
import {
  fusionarExtraccion,
  camposFaltantes,
  siguientePregunta,
  type ExtraccionGasto,
} from "@/lib/extraccion";
import { MensajeBurbuja } from "@/components/chat/MensajeBurbuja";
import { TarjetaConfirmacion } from "@/components/chat/TarjetaConfirmacion";
import { BarraEntrada } from "@/components/chat/BarraEntrada";
import { Onboarding } from "@/components/chat/Onboarding";

const EXTRACCION_VACIA: ExtraccionGasto = {
  comercio: null,
  monto: null,
  fechaDocumento: null,
  categoria: null,
  rutEmisor: null,
  numeroDocumento: null,
  direccion: null,
};

type Mensaje =
  | { tipo: "texto"; autor: "bot" | "usuario"; texto: string }
  | { tipo: "confirmacion"; borrador: ExtraccionGasto; imagenUrl?: string; imagenDriveId?: string }
  | { tipo: "otro" };

function Chat({ perfil }: { perfil: Perfil }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { tipo: "texto", autor: "bot", texto: "Hola 👋 Cuéntame un gasto o adjunta una boleta." },
  ]);
  const [borrador, setBorrador] = useState<ExtraccionGasto>(EXTRACCION_VACIA);
  const [imagen, setImagen] = useState<{ url: string; id: string } | null>(null);
  const [procesando, setProcesando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  function agregarBot(texto: string) {
    setMensajes((m) => [...m, { tipo: "texto", autor: "bot", texto }]);
  }
  function agregarUsuario(texto: string) {
    setMensajes((m) => [...m, { tipo: "texto", autor: "usuario", texto }]);
  }
  function quitarTransitorios(m: Mensaje[]) {
    return m.filter((x) => x.tipo !== "confirmacion" && x.tipo !== "otro");
  }

  function avanzar(nuevoBorrador: ExtraccionGasto, img: { url: string; id: string } | null) {
    if (camposFaltantes(nuevoBorrador).length === 0) {
      setMensajes((m) => [
        ...m,
        { tipo: "confirmacion", borrador: nuevoBorrador, imagenUrl: img?.url, imagenDriveId: img?.id },
      ]);
    } else {
      const pregunta = siguientePregunta(nuevoBorrador);
      if (pregunta) agregarBot(pregunta);
    }
  }

  async function onTexto(texto: string) {
    setMensajes((m) => quitarTransitorios(m));
    agregarUsuario(texto);
    setProcesando(true);
    try {
      const { extraccion } = await extraerDesdeTexto(texto);
      const fusion = fusionarExtraccion(borrador, extraccion);
      setBorrador(fusion);
      avanzar(fusion, imagen);
    } catch {
      agregarBot("No pude procesar eso. ¿Puedes reformularlo?");
    } finally {
      setProcesando(false);
    }
  }

  async function onArchivo(file: File) {
    setMensajes((m) => quitarTransitorios(m));
    agregarUsuario("📎 (boleta adjunta)");
    setProcesando(true);
    try {
      const base64 = await fileABase64(file);
      const [sub, ext] = await Promise.all([
        subirBoleta(base64, file.name),
        extraerDesdeImagen(base64),
      ]);
      const img = { url: sub.url, id: sub.id };
      setImagen(img);
      const fusion = fusionarExtraccion(borrador, ext.extraccion);
      setBorrador(fusion);
      avanzar(fusion, img);
    } catch {
      agregarBot("No pude leer la boleta. Intenta con otra foto o cuéntame los datos.");
    } finally {
      setProcesando(false);
    }
  }

  async function onConfirmar(datos: GuardarGastoInput) {
    setProcesando(true);
    try {
      await guardarGasto(datos);
      setMensajes((m) => [
        ...quitarTransitorios(m),
        { tipo: "texto", autor: "bot", texto: "✅ Gasto registrado." },
        { tipo: "otro" },
      ]);
      setBorrador(EXTRACCION_VACIA);
      setImagen(null);
    } catch {
      agregarBot("No pude guardar el gasto. Reintenta en un momento.");
    } finally {
      setProcesando(false);
    }
  }

  function onCancelar() {
    setMensajes((m) => quitarTransitorios(m));
    setBorrador(EXTRACCION_VACIA);
    setImagen(null);
    agregarBot("Listo, lo descarté. ¿Registramos otro?");
  }

  function onOtroSi() {
    setMensajes((m) => [
      ...quitarTransitorios(m),
      { tipo: "texto", autor: "bot", texto: "Dale 👍 Cuéntame el siguiente o adjunta la boleta." },
    ]);
  }
  function onOtroNo() {
    setMensajes((m) => [
      ...quitarTransitorios(m),
      { tipo: "texto", autor: "bot", texto: "Perfecto, ¡gracias! Cuando quieras registrar otro, escríbeme." },
    ]);
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3">
        <span className="font-semibold text-gray-800">Rendición de Gastos</span>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>
            {perfil.nombre} · {perfil.area}
          </span>
          <Link href="/dashboard" className="rounded-lg border px-3 py-1 text-xs">
            Dashboard
          </Link>
          <button onClick={() => cerrarSesion()} className="rounded-lg border px-3 py-1 text-xs">
            Salir
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {mensajes.map((m, i) => {
          if (m.tipo === "texto") {
            return (
              <MensajeBurbuja key={i} autor={m.autor}>
                {m.texto}
              </MensajeBurbuja>
            );
          }
          if (m.tipo === "confirmacion") {
            return (
              <TarjetaConfirmacion
                key={i}
                borrador={m.borrador}
                imagenUrl={m.imagenUrl}
                imagenDriveId={m.imagenDriveId}
                onConfirmar={onConfirmar}
                onCancelar={onCancelar}
                deshabilitado={procesando}
              />
            );
          }
          // tipo "otro"
          return (
            <div key={i} className="flex flex-col items-start gap-2">
              <MensajeBurbuja autor="bot">¿Deseas registrar otro?</MensajeBurbuja>
              <div className="flex gap-2">
                <button
                  onClick={onOtroSi}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Sí
                </button>
                <button onClick={onOtroNo} className="rounded-lg border px-4 py-2 text-sm">
                  No
                </button>
              </div>
            </div>
          );
        })}
        {procesando && <p className="text-center text-xs text-gray-400">Procesando…</p>}
        <div ref={finRef} />
      </div>

      <BarraEntrada onTexto={onTexto} onArchivo={onArchivo} deshabilitado={procesando} />
    </div>
  );
}

function PaginaProtegida() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function cargarPerfil() {
    try {
      const token = await getIdTokenActual();
      if (!token) return;
      const p = await obtenerPerfil();
      setPerfil(p);
    } catch {
      setError("No se pudo cargar tu perfil.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarPerfil();
  }, []);

  if (cargando) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">Cargando…</div>;
  }
  if (error || !perfil) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-red-600">
        {error ?? "Error"}
      </div>
    );
  }
  if (!perfil.completo) {
    return (
      <Onboarding
        nombreInicial={perfil.nombre}
        areas={perfil.areas}
        onListo={() => {
          setCargando(true);
          cargarPerfil();
        }}
      />
    );
  }
  return <Chat perfil={perfil} />;
}

export default function Page() {
  return (
    <AuthGate>
      <PaginaProtegida />
    </AuthGate>
  );
}
