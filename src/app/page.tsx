"use client";

import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { cerrarSesion, getIdTokenActual } from "@/lib/firebase-client";
import {
  extraerDesdeTexto,
  extraerDesdeImagen,
  subirBoleta,
  guardarGasto,
  type GuardarGastoInput,
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
  | { tipo: "confirmacion"; borrador: ExtraccionGasto; imagenUrl?: string };

interface Sesion {
  nombre: string;
  rol: string;
}

function Chat() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { tipo: "texto", autor: "bot", texto: "Hola 👋 Cuéntame un gasto o adjunta una boleta 📷" },
  ]);
  const [borrador, setBorrador] = useState<ExtraccionGasto>(EXTRACCION_VACIA);
  const [imagen, setImagen] = useState<{ url: string; id: string } | null>(null);
  const [procesando, setProcesando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  useEffect(() => {
    async function cargarSesion() {
      const token = await getIdTokenActual();
      if (!token) return;
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setSesion({ nombre: data.usuario.nombre, rol: data.usuario.rol });
      }
    }
    cargarSesion();
  }, []);

  function agregarBot(texto: string) {
    setMensajes((m) => [...m, { tipo: "texto", autor: "bot", texto }]);
  }
  function agregarUsuario(texto: string) {
    setMensajes((m) => [...m, { tipo: "texto", autor: "usuario", texto }]);
  }

  function avanzar(nuevoBorrador: ExtraccionGasto, img: { url: string; id: string } | null) {
    if (camposFaltantes(nuevoBorrador).length === 0) {
      setMensajes((m) => [
        ...m,
        { tipo: "confirmacion", borrador: nuevoBorrador, imagenUrl: img?.url },
      ]);
    } else {
      const pregunta = siguientePregunta(nuevoBorrador);
      if (pregunta) agregarBot(pregunta);
    }
  }

  async function onTexto(texto: string) {
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
    agregarUsuario("📷 (boleta adjunta)");
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
      await guardarGasto({ ...datos, imagenDriveId: imagen?.id });
      setMensajes((m) => m.filter((x) => x.tipo !== "confirmacion"));
      agregarBot("✅ Registro completado.");
      setBorrador(EXTRACCION_VACIA);
      setImagen(null);
    } catch {
      agregarBot("No pude guardar el gasto. Reintenta en un momento.");
    } finally {
      setProcesando(false);
    }
  }

  function onCancelar() {
    setMensajes((m) => m.filter((x) => x.tipo !== "confirmacion"));
    setBorrador(EXTRACCION_VACIA);
    setImagen(null);
    agregarBot("Listo, lo descarté. ¿Registramos otro?");
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3">
        <span className="font-semibold text-gray-800">Rendición de Gastos</span>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {sesion && (
            <span>
              {sesion.nombre} · {sesion.rol}
            </span>
          )}
          <button onClick={() => cerrarSesion()} className="rounded-lg border px-3 py-1 text-xs">
            Salir
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {mensajes.map((m, i) =>
          m.tipo === "texto" ? (
            <MensajeBurbuja key={i} autor={m.autor}>
              {m.texto}
            </MensajeBurbuja>
          ) : (
            <TarjetaConfirmacion
              key={i}
              borrador={m.borrador}
              imagenUrl={m.imagenUrl}
              onConfirmar={onConfirmar}
              onCancelar={onCancelar}
              deshabilitado={procesando}
            />
          ),
        )}
        {procesando && <p className="text-center text-xs text-gray-400">Procesando…</p>}
        <div ref={finRef} />
      </div>

      <BarraEntrada onTexto={onTexto} onArchivo={onArchivo} deshabilitado={procesando} />
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate>
      <Chat />
    </AuthGate>
  );
}
