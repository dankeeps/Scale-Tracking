import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esconde o indicador de dev do Next (o ícone "N" no canto). Só afeta o
  // desenvolvimento; erros de compilação/runtime continuam aparecendo.
  devIndicators: false,
};

export default nextConfig;
