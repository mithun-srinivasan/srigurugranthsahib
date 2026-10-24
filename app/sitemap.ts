/**
 * app/sitemap.ts
 * ---------------------------------------------------------------------------
 * XML sitemap for the SGGS Reader: all 1,430 Angs, the 8 Nitnem banis, and
 * static routes. Generated at build time.
 */

import type { MetadataRoute } from "next";
import { NITNEM_BANIS } from "@/lib/nitnem";
import { MIN_ANG, MAX_ANG } from "@/lib/ang";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://srigurugranthsahib.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/search", "/bookmarks", "/calendar", "/learn", "/nitnem", "/sync"].map(
    (path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date().toISOString(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.8,
    }),
  );

  const baniRoutes = NITNEM_BANIS.map((b) => ({
    url: `${baseUrl}/nitnem/${b.token}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const angRoutes = [];
  for (let n = MIN_ANG; n <= MAX_ANG; n++) {
    angRoutes.push({
      url: `${baseUrl}/ang/${n}`,
      lastModified: new Date().toISOString(),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    });
  }

  return [...staticRoutes, ...baniRoutes, ...angRoutes];
}
