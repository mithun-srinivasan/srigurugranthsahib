/**
 * app/not-found.tsx
 * ---------------------------------------------------------------------------
 * Not-found page for the SGGS Reader app.
 * Themed with CSS variables, includes a "Reset local data" escape hatch.
 */

"use client";

import Link from "next/link";
import { Search, Home, BookOpen, Trash2, RotateCcw } from "lucide-react";

export default function NotFound() {
  const buttonBase = "flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]";
  const buttonPrimary = `${buttonBase} bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90`;
  const buttonOutline = `${buttonBase} border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface)]`;
  const buttonGhost = `${buttonBase} bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]`;
  const buttonDestructive = `${buttonBase} bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90`;

  const handleResetData = () => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("sgs-") || key.startsWith("sggs-"))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
    window.location.reload();
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--text)]">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
          <Search className="w-8 h-8 text-[var(--accent)]" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-[var(--text)]">Page not found</h1>
          <p className="text-[var(--text-muted)]">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>

        <div className="space-y-3">
          <Link href="/">
            <button className={buttonPrimary}>
              <Home className="w-4 h-4" aria-hidden="true" />
              Go home
            </button>
          </Link>

          <Link href="/ang/1">
            <button className={buttonOutline}>
              <BookOpen className="w-4 h-4" aria-hidden="true" />
              Start reading
            </button>
          </Link>

          <Link href="/search">
            <button className={buttonGhost}>
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Search Gurbani
            </button>
          </Link>
        </div>

        <hr className="border-[var(--border)] my-4" />

        <div className="space-y-3 text-sm">
          <p className="text-[var(--text-muted)]">
            If you think this is a mistake, try refreshing or clearing local data.
          </p>
          <button onClick={handleResetData} className={buttonDestructive}>
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Reset local data
          </button>
        </div>
      </div>
    </div>
  );
}