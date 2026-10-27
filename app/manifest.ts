import type { MetadataRoute } from "next"

/**
 * Manifest de instalación de la PWA (plan.md §7).
 *
 * `start_url` apunta al panel: si no hay sesión, el layout autenticado
 * redirige a `/login`, así que la app instalada siempre aterriza en un sitio
 * válido.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Naranja Pimienta",
    short_name: "Pimienta",
    description:
      "Punto de venta, cocina, catálogo e inventario para cafeterías.",
    lang: "es",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#e2703a",
    categories: ["business", "food", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Punto de venta",
        short_name: "POS",
        url: "/pos",
      },
      {
        name: "Cocina",
        short_name: "Cocina",
        url: "/kitchen",
      },
    ],
  }
}
