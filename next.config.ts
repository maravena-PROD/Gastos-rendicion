import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mueve el indicador de desarrollo de Next.js a la esquina inferior derecha
  // para que no tape el botón de adjuntar boleta (abajo a la izquierda).
  // (Solo afecta el modo desarrollo; no aparece en producción.)
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
