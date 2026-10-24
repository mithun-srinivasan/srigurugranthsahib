/**
 * app/layout.tsx
 * ---------------------------------------------------------------------------
 * Root layout for the entire application.
 *
 * Responsibilities:
 *   - Loads the two Google fonts: `Noto Sans Gurmukhi` (for scripture text)
 *     and `Inter` (for UI / body text), injecting their CSS variable classes.
 *   - Provides global metadata (title, description) used by Next.js <head>.
 *   - Mounts the app-wide providers that wrap every page (reader prefs,
 *     bookmarks, reading progress/streaks/history, notes, and highlights),
 *     plus the shortcut-help modal, the crossfade transition overlay, and
 *     the PWA service-worker registrar.
 *   - Includes Vercel Analytics and Speed Insights for production telemetry.
 */

import type { Metadata, Viewport } from "next";
import { Noto_Sans_Gurmukhi, Inter } from "next/font/google";
import { ReaderPrefsProvider } from "@/components/ReaderPrefsProvider";
import { BookmarksProvider } from "@/components/BookmarksProvider";
import { ProgressProvider } from "@/components/ProgressProvider";
import { NotesProvider } from "@/components/NotesProvider";
import { HighlightsProvider } from "@/components/HighlightsProvider";
import PageTransition from "@/components/PageTransition";
import ShortcutHelp from "@/components/ShortcutHelp";
import OfflineIndicator from "@/components/OfflineIndicator";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

/**
 * Noto Sans Gurmukhi — loaded for the `gurmukhi` subset only.
 * `display: "swap"` ensures the system font is used while the webfont loads,
 * preventing invisible/overlapping scripture text on fast connections.
 */
const gurmukhi = Noto_Sans_Gurmukhi({
  subsets: ["gurmukhi"],
  weight: ["400", "500", "600"],
  variable: "--font-gurmukhi",
  display: "swap",
});

/** Inter — the primary UI font for English text and navigation. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

/** Global SEO metadata applied to every page unless overridden. */
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://srigurugranthsahib.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sri Guru Granth Sahib Ji — Ang Reader",
  description: "A verse-by-verse digital reader for Sri Guru Granth Sahib Ji — all 1,430 Angs plus daily Nitnem banis, genuine translations in four languages, commentary, and a daily Hukamnama from SGPC.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sri Guru Granth Sahib Ji — Ang Reader",
    description: "A verse-by-verse digital reader for Sri Guru Granth Sahib Ji — all 1,430 Angs plus daily Nitnem banis, genuine translations, commentary, and a daily Hukamnama from SGPC.",
    url: "/",
    siteName: "SGGS Reader",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Sri Guru Granth Sahib Ji — Ang Reader",
    description: "A verse-by-verse digital reader for Sri Guru Granth Sahib Ji.",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SGGS Reader",
    statusBarStyle: "black-translucent",
  },
};

/** Mobile-viewport metadata (safe-area + theme colour for installed PWAs). */
export const viewport: Viewport = {
  themeColor: "#F59E0B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="theme-light" suppressHydrationWarning>
      <head>
        {/* Inline theme init: reads sgs-reader-prefs__v1 before first paint
            so the user's theme, focus mode, accent, and OLED settings are
            applied immediately — no flash of the default light theme. */}
        <script
          id="sggs-theme-init"
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var raw = localStorage.getItem('sgs-reader-prefs__v1');
                  if (!raw) return;
                  var prefs = JSON.parse(raw);
                  if (!prefs || typeof prefs !== 'object') return;
                  var theme = prefs.theme || 'light';
                  if (prefs.isAutoTheme === true) {
                    var m = window.matchMedia('(prefers-color-scheme: dark)');
                    if (m.matches) theme = 'dark';
                    else {
                      var h = new Date().getHours();
                      theme = (h >= 6 && h < 18) ? 'light' : 'dark';
                    }
                  }
                  var root = document.documentElement;
                  root.classList.remove('theme-light', 'theme-dark', 'theme-sepia');
                  root.classList.add('theme-' + theme);
                  root.dataset.focusMode = prefs.isFocusMode === true ? 'on' : '';
                  var style = root.style;
                  var accentHex = prefs.accentHex || null;
                  if (accentHex && /^#([0-9a-fA-F]{3}){1,2}$/.test(accentHex)) {
                    var h = accentHex.replace('#', '');
                    if (h.length === 3) h = h.split('').map(function(c){ return c + c; }).join('');
                    var n = parseInt(h, 16);
                    if (!Number.isNaN(n) && h.length === 6) {
                      var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
                      style.setProperty('--accent', accentHex);
                      style.setProperty('--accent-light', 'rgba(' + r + ', ' + g + ', ' + b + ', 0.12)');
                      style.setProperty('--accent-glow', 'rgba(' + r + ', ' + g + ', ' + b + ', 0.2)');
                    }
                  } else {
                    style.removeProperty('--accent');
                    style.removeProperty('--accent-light');
                    style.removeProperty('--accent-glow');
                  }
                  if (prefs.isOledTheme === true && theme !== 'light') {
                    style.setProperty('--bg', '#000');
                    style.setProperty('--bg-glass', 'rgba(0, 0, 0, 0.88)');
                    style.setProperty('--surface', '#000');
                  } else {
                    style.removeProperty('--bg');
                    style.removeProperty('--bg-glass');
                    style.removeProperty('--surface');
                  }
                } catch (e) {
                  // Fail silently — React hydration applies the theme after mount.
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${gurmukhi.variable} ${inter.variable} font-sans antialiased`}>
        <ReaderPrefsProvider>
          <BookmarksProvider>
            <ProgressProvider>
              <NotesProvider>
                <HighlightsProvider>
                  <PageTransition />
                  <ShortcutHelp />
                  <OfflineIndicator />
                  <ServiceWorkerRegistrar />
                  {children}
                </HighlightsProvider>
              </NotesProvider>
            </ProgressProvider>
          </BookmarksProvider>
        </ReaderPrefsProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}