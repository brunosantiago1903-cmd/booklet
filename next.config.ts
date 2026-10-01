import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pluggy-sdk depende de `got`, que deve rodar como módulo Node sem bundling.
  serverExternalPackages: ["pluggy-sdk"],
  experimental: {
    serverActions: {
      // Importação de OFX passa pelo Server Action; comprovantes vão direto ao Storage.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
