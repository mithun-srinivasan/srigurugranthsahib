/**
 * components/ui/BorderBeam.tsx
 * ---------------------------------------------------------------------------
 * An ambient glowing border beam that traverses the perimeter of a card.
 *
 * Inspired by Magic UI (magicui.design/docs/components/border-beam):
 *   - Uses an absolute overlay with a moving gradient to highlight sacred
 *     content (Hukamnama, Shabad of the Day, Nitnem) without layout shifts.
 *   - The beam colour defaults to the active theme's Kesari saffron accent
 *     (`var(--accent)`), maintaining visual unity across light, dark, and sepia.
 *   - Respects `prefers-reduced-motion` by fading to a quiet static border glow.
 */

"use client";

import React from "react";

interface BorderBeamProps {
  /** Size of the beam in pixels along the perimeter. Defaults to 200. */
  size?: number;
  /** Duration of one full orbit in seconds. Defaults to 12. */
  duration?: number;
  /** Border width of the beam in pixels. Defaults to 1.5. */
  borderWidth?: number;
  /** Primary colour stop. Defaults to saffron accent glow. */
  colorFrom?: string;
  /** Secondary colour stop. Defaults to vibrant amber. */
  colorTo?: string;
  /** Delay before animation starts in seconds. Defaults to 0. */
  delay?: number;
  /** Additional CSS class names. */
  className?: string;
}

export default function BorderBeam({
  size = 200,
  duration = 12,
  borderWidth = 1.5,
  colorFrom = "var(--accent)",
  colorTo = "#FBBF24",
  delay = 0,
  className = "",
}: BorderBeamProps) {
  return (
    <div
      style={
        {
          "--size": `${size}px`,
          "--duration": `${duration}s`,
          "--border-width": `${borderWidth}px`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--delay": `-${delay}s`,
        } as React.CSSProperties
      }
      className={`pointer-events-none absolute inset-0 rounded-[inherit] [border:calc(var(--border-width))_solid_transparent] ![mask-clip:padding-box,border-box] ![mask-composite:intersect] [mask:linear-gradient(transparent,transparent),linear-gradient(white,white)] ${className}`}
    >
      <div
        className="absolute aspect-square w-[var(--size)] [animation:border-beam_var(--duration)_linear_infinite] [animation-delay:var(--delay)] [background:radial-gradient(circle_at_center,var(--color-to)_0%,var(--color-from)_35%,transparent_70%)] [offset-anchor:calc(var(--size)/2)_calc(var(--size)/2)] [offset-path:rect(0_auto_auto_0_round_inherit)] motion-reduce:hidden"
      />
    </div>
  );
}
