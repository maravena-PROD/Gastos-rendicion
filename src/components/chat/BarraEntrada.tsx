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
        className="flex items-center justify-center rounded-full border p-2.5 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.6}
          stroke="currentColor"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
          />
        </svg>
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
