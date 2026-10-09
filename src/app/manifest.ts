import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dogear",
    short_name: "Dogear",
    description: "Read free classics from Project Gutenberg and your own EPUBs, comfortably. Dogear keeps your page.",
    start_url: "/",
    display: "standalone",
    background_color: "#f9f6f0",
    theme_color: "#f9f6f0",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
