import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empaqueta en .next/standalone solo lo necesario para ejecutar, con su
  // propio server.js. Es lo que copia el Dockerfile de producción: sin esto
  // la imagen no se construye.
  output: 'standalone',
};

export default nextConfig;
