import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // googleapis hace require dinámicos que se rompen al empaquetarse en
  // funciones serverless (Vercel). Se deja como externo para que se cargue
  // desde node_modules en runtime, como está diseñado.
  serverExternalPackages: ["googleapis"],
  // Mueve el indicador de desarrollo de Next.js a la esquina inferior derecha
  // para que no tape el botón de adjuntar boleta (abajo a la izquierda).
  // (Solo afecta el modo desarrollo; no aparece en producción.)
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
