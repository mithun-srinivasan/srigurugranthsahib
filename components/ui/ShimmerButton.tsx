/**
 * components/ui/ShimmerButton.tsx
 * ---------------------------------------------------------------------------
 * Luminous shimmer action button inspired by Magic UI (magicui.design).
 *
 * How it works:
 *   - Wraps children in a button/container with a rotating subtle perimeter
 *     sheen, giving primary actions a quiet, inviting glow.
 *   - Uses GPU-accelerated CSS conic-gradient rotation.
 *   - Supports custom classes, click handlers, and link wrappers.
 */

"use client";

import { type ReactNode } from "react";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  shimmerColor?: string;
  shimmerSize?: string;
  shimmerDuration?: string;
  className?: string;
}

export default function ShimmerButton({
  children,
  shimmerColor = "rgba(255, 255, 255, 0.4)",
  shimmerSize = "0.08em",
  shimmerDuration = "3s",
  className = "",
  style,
  ...props
}: ShimmerButtonProps) {
  return (
    <button
      {...props}
      style={
        {
          "--shimmer-color": shimmerColor,
          "--shimmer-size": shimmerSize,
          "--shimmer-duration": shimmerDuration,
          ...style,
        } as React.CSSProperties
      }
      className={`group relative isolate inline-flex items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--accent)] px-6 py-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98] ${className}`}
    >
      {/* Animated shimmer border sheen */}
      <div className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit] motion-reduce:hidden">
        <div
          className="absolute inset-[-100%] aspect-square [animation:shimmer-spin_var(--shimmer-duration)_linear_infinite] [background:conic-gradient(from_0deg_at_50%_50%,transparent_0%,var(--shimmer-color)_15%,transparent_30%)]"
        />
      </div>

      {/* Button content */}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  );
}
