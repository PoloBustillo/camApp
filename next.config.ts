import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Prisma usa binarios nativos — deben excluirse del bundle y resolverse en runtime
  serverExternalPackages: ["@prisma/client", ".prisma", "ws"],

  // Tree-shaking + body size limit
  experimental: {
    optimizePackageImports: ["lucide-react"],
    middlewareClientMaxBodySize: 104857600, // 100MB for video uploads
    workerThreads: false,
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
