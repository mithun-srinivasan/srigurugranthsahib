/**
 * app/manifest.ts
 * ---------------------------------------------------------------------------
 * Generates the PWA Web App Manifest (feature 1) as a route handler at
 * `/manifest.webmanifest`.  This is what lets the app be installed to a
 * home screen / desktop and launch its own standalone window.
 *
 * Icons live in `public/` as static PNGs (`/icon-192.png`, `/icon-512.png`).
 */

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    scope: "/",
    lang: "en",
    name: "Sri Guru Granth Sahib Ji — Ang Reader",
    short_name: "SGGS Reader",
    description:
      "A minimalist, verse-by-verse digital reader for Sri Guru Granth Sahib Ji with offline support.",
    start_url: "/",
    display: "standalone",
    background_color: "#090A0F",
    theme_color: "#F59E0B",
    categories: ["education", "books", "religion"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}