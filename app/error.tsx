/**
 * app/error.tsx
 * ---------------------------------------------------------------------------
 * Route-level error boundary for the SGGS Reader app.
 * Themed with CSS variables, includes a "Reset local data" escape hatch
 * that clears only sgs-* / sggs-* localStorage keys after confirmation.
 */

"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Trash2, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetStatus, setResetStatus] = useState<"idle" | "clearing" | "done" | "error">("idle");

  const handleResetData = async () => {
    setResetStatus("clearing");
    try {
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
      setResetStatus("done");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch {
      setResetStatus("error");
    }
  };

  useEffect(() => {
    console.error("[SGGS Reader] Route error:", error);
  }, [error]);

  const buttonBase = "flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 focus:ring-offset-[var(--bg)]";
  const buttonPrimary = `${buttonBase} bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90`;
  const buttonOutline = `${buttonBase} border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] hover:bg-[var(--surface)]`;
  const buttonGhost = `${buttonBase} bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]`;
  const buttonDestructive = `${buttonBase} bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90`;

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--text)]">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-[var(--accent-light)] flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-[var(--accent)]" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-[var(--text)]">Something went wrong</h1>
          <p className="text-[var(--text-muted)] text-sm">
            We encountered an unexpected error while loading this page.
          </p>
        </div>

        <div className="space-y-3">
          <button onClick={reset} className={buttonPrimary}>
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Try again
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className={buttonOutline}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
            Reset local data
          </button>

          <Link href="/">
            <button className={buttonGhost}>
              <Home className="w-4 h-4" aria-hidden="true" />
              Go home
            </button>
          </Link>
        </div>

        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title">
            <div className="w-full max-w-md rounded-xl bg-[var(--bg)] p-6 space-y-4 shadow-xl border border-[var(--border)]">
              <h2 id="reset-dialog-title" className="text-lg font-semibold text-[var(--text)]">
                Reset all local data?
              </h2>
              <p className="text-sm text-[var(--text-muted)]">
                This will clear all your bookmarks, notes, highlights, reading progress,
                preferences, and notification settings. This action cannot be undone.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  className={buttonOutline + " flex-1"}
                  onClick={() => setShowResetConfirm(false)}
                  disabled={resetStatus !== "idle"}
                >
                  Cancel
                </button>
                <button
                  className={buttonDestructive + " flex-1"}
                  onClick={handleResetData}
                  disabled={resetStatus !== "idle"}
                >
                  {resetStatus === "clearing" && (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Clearing…
                    </span>
                  )}
                  {resetStatus === "done" ? "Done!" : resetStatus === "error" ? "Failed" : "Yes, reset everything"}
                </button>
              </div>
            </div>
          </div>
        )}

        {error.digest && (
          <details className="text-left text-xs text-[var(--text-faint)]">
            <summary className="cursor-pointer select-none">Error details</summary>
            <pre className="mt-2 p-3 overflow-auto rounded bg-[var(--surface)] text-[var(--text-muted)]">
              {error.message}
              {error.digest && <span> Digest: {error.digest}</span>}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}