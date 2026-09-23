import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/privacy", "/terms"].map((p) => ({
    url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${p}`,
  }));
}
