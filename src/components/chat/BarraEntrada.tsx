"use client";

import { useRef, useState } from "react";

export function BarraEntrada({
  onTexto,
  onArchivo,
  deshabilitado,
}: {
  onTexto: (texto: string) => void;
  onArchivo: (file: File) => void;
  deshabilitado: boolean;
}) {
  const [texto, setTexto] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function enviar() {
    const limpio = texto.trim();
    if (!limpio || deshabilitado) return;
    onTexto(limpio);
    setTexto("");
  }

  return (
    <div className="flex items-center gap-2 border-t bg-white p-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onArchivo(file);
          e.target.value = "";
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={deshabilitado}
        aria-label="Adjuntar boleta"
        className="rounded-full border px-3 py-2 text-lg disabled:opacity-40"
      >
        📷
      </button>
      <input
        className="flex-1 rounded-full border px-4 py-2 text-sm text-gray-900"
        placeholder="Escribe un gasto…"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") enviar();
        }}
        disabled={deshabilitado}
      />
      <button
        onClick={enviar}
        disabled={deshabilitado}
        className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        Enviar
      </button>
    </div>
  );
}
