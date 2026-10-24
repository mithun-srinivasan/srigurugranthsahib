/**
 * app/robots.ts
 * ---------------------------------------------------------------------------
 * Robots.txt for the SGGS Reader.
 */

import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://srigurugranthsahib.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/sync/", "/nitnem/*/print"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
