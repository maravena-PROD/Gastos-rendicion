import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // firebase-admin y googleapis hacen require dinámicos que se rompen al
  // empaquetarse en funciones serverless (Vercel). Se dejan como externos
  // para que se carguen desde node_modules en runtime, como están diseñados.
  serverExternalPackages: ["firebase-admin", "googleapis"],
  // Mueve el indicador de desarrollo de Next.js a la esquina inferior derecha
  // para que no tape el botón de adjuntar boleta (abajo a la izquierda).
  // (Solo afecta el modo desarrollo; no aparece en producción.)
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
