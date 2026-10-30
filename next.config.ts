import type { NextConfig } from "next";

/**
 * Dominio público de R2, si está configurado.
 *
 * Las imágenes de catálogo viven en un bucket de Cloudflare R2 y se sirven
 * desde su dominio público; hay que autorizarlo para poder usar `next/image`.
 */
function r2RemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim();

  if (!base) return [];

  try {
    const url = new URL(base);
    const pathname = url.pathname.replace(/\/+$/, "");

    return [
      {
        protocol: url.protocol === "http:" ? "http" : "https",
        hostname: url.hostname,
        port: url.port,
        pathname: `${pathname}/**`,
      },
    ];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Enable React Strict Mode
  reactStrictMode: true,
  images: {
    remotePatterns: r2RemotePatterns(),
  },
  async headers() {
    return [
      {
        // El service worker debe revalidarse siempre para recibir versiones
        // nuevas (plan.md §7).
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
