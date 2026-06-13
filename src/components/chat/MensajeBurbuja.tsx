import type { ReactNode } from "react";

export function MensajeBurbuja({
  autor,
  children,
}: {
  autor: "bot" | "usuario";
  children: ReactNode;
}) {
  const esBot = autor === "bot";
  return (
    <div className={`flex ${esBot ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          esBot ? "bg-bosca-gris text-bosca-carbon" : "bg-bosca-burdeo text-white"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
