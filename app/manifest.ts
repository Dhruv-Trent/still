import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Still — Tasks & Reminders",
    short_name: "Still",
    description: "Room for what matters.",
    start_url: "/workspace",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#244ed8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
