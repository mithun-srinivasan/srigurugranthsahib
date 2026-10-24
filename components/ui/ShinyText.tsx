/**
 * components/ui/ShinyText.tsx
 * ---------------------------------------------------------------------------
 * Delicate animated gradient text shimmer inspired by Magic UI (magicui.design).
 *
 * How it works:
 *   - Applies a slow, luminous gradient shine across text headings or sacred
 *     invocations without distracting animations or layout shifts.
 *   - Uses background-clip text with transparent gradient sweeps.
 *   - Respects `prefers-reduced-motion` by freezing into a rich static gradient.
 */

import { type ReactNode } from "react";

interface ShinyTextProps {
  children: ReactNode;
  /** Speed of the shimmer animation in seconds. Defaults to 8. */
  shimmerWidth?: number;
  className?: string;
}

export default function ShinyText({
  children,
  className = "",
}: ShinyTextProps) {
  return (
    <span
      className={`inline-block bg-gradient-to-r from-[var(--text)] via-[var(--accent)] to-[var(--text)] bg-[length:250%_100%] bg-clip-text text-transparent [animation:shiny-text_8s_ease-in-out_infinite] motion-reduce:animate-none ${className}`}
    >
      {children}
    </span>
  );
}
