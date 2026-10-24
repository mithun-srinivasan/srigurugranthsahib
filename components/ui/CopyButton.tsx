/**
 * components/ui/CopyButton.tsx
 * ---------------------------------------------------------------------------
 * High-fidelity animated copy button inspired by interior.dev (interior.dev/docs/copy-button).
 *
 * Micro-interaction anatomy:
 *   - "Software feels cheap in the half-second after a click."
 *   - Immediate tactile press feedback (scale down to 0.94, spring back).
 *   - Morphing crossfade from Copy icon to Check icon with micro-rotation.
 *   - Accessible screen-reader live region reporting "Copied to clipboard".
 *   - Auto-resets after 2000ms.
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  /** The text to copy to the user's clipboard. */
  textToCopy: string;
  /** Accessible label for the button. Defaults to "Copy text". */
  label?: string;
  /** Whether to show a text label next to the icon. */
  showLabel?: boolean;
  /** Label text when idle. Defaults to "Copy". */
  idleText?: string;
  /** Label text when copied. Defaults to "Copied!". */
  copiedText?: string;
  /** Optional callback fired when copied successfully. */
  onCopy?: () => void;
  /** Additional CSS class names. */
  className?: string;
  /** Icon size in pixels. Defaults to 14. */
  size?: number;
}

export default function CopyButton({
  textToCopy,
  label = "Copy verse",
  showLabel = false,
  idleText = "Copy",
  copiedText = "Copied!",
  onCopy,
  className = "",
  size = 14,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      if (onCopy) onCopy();
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Clipboard write failed (e.g. denied permissions)
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? copiedText : label}
      title={copied ? copiedText : label}
      className={`group relative inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--text-muted)] transition-all duration-150 ease-out hover:text-[var(--text)] hover:bg-[var(--surface-hover)] active:scale-[0.93] ${
        copied ? "text-[var(--accent)]" : ""
      } ${className}`}
    >
      {/* Icon with crossfade + scale morph */}
      <span className="relative flex h-4 w-4 items-center justify-center">
        <Copy
          size={size}
          className={`absolute transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            copied
              ? "scale-50 rotate-45 opacity-0 pointer-events-none"
              : "scale-100 rotate-0 opacity-100"
          }`}
        />
        <Check
          size={size}
          className={`absolute text-[var(--accent)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            copied
              ? "scale-100 rotate-0 opacity-100"
              : "scale-50 -rotate-45 opacity-0 pointer-events-none"
          }`}
        />
      </span>

      {/* Optional text label */}
      {showLabel && (
        <span className="relative inline-grid text-[11px] font-medium leading-none">
          <span
            className={`col-start-1 row-start-1 transition-all duration-150 ${
              copied ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
            }`}
          >
            {idleText}
          </span>
          <span
            className={`col-start-1 row-start-1 text-[var(--accent)] transition-all duration-150 ${
              copied ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
            }`}
          >
            {copiedText}
          </span>
        </span>
      )}

      {/* Screen reader announcement */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? copiedText : ""}
      </span>
    </button>
  );
}
