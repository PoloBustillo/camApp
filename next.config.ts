import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Increase body size for video uploads (default 10MB)
  middlewareClientMaxBodySize: 100 * 1024 * 1024, // 100MB

  // Prisma usa binarios nativos — deben excluirse del bundle y resolverse en runtime
  serverExternalPackages: ["@prisma/client", ".prisma", "ws"],

  // Tree-shaking de iconos y componentes UI pesados
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
