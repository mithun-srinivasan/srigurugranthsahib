/**
 * components/ui/Particles.tsx
 * ---------------------------------------------------------------------------
 * Ambient particle canvas system inspired by Magic UI (magicui.design).
 *
 * How it works:
 *   - Renders a lightweight, high-DPI HTML5 canvas with floating micro-particles.
 *   - Particles resemble gentle celestial light or golden dust (Amrit Vela ambiance).
 *   - Supports subtle mouse proximity interaction without layout shift.
 *   - Respects `prefers-reduced-motion` and pauses animation when off-screen
 *     via IntersectionObserver to maintain 60fps and 0% idle CPU overhead.
 */

"use client";

import { useEffect, useRef } from "react";

interface ParticlesProps {
  /** Number of particles to simulate. Defaults to 40 for subtle ambiance. */
  quantity?: number;
  /** Static particle colour or CSS variable. Defaults to Kesari amber. */
  color?: string;
  /** Maximum particle radius in pixels. Defaults to 1.5. */
  size?: number;
  /** Interaction distance with pointer in pixels. Defaults to 100. */
  ease?: number;
  /** Additional CSS class names. */
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  targetAlpha: number;
}

export default function Particles({
  quantity = 35,
  color = "#F59E0B",
  size = 1.6,
  ease = 50,
  className = "",
}: ParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let isVisible = true;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // -- Dimensions & DPI ---------------------------------------------------
    let width = container.clientWidth;
    let height = container.clientHeight;

    const resize = () => {
      if (!container || !canvas) return;
      width = container.clientWidth;
      height = container.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    // -- Mouse tracking -----------------------------------------------------
    const mouse = { x: -1000, y: -1000 };
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseleave", handleMouseLeave);

    // -- Particle pool ------------------------------------------------------
    const particles: Particle[] = [];
    for (let i = 0; i < quantity; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -Math.random() * 0.35 - 0.05, // gentle upward drift
        size: Math.random() * size + 0.6,
        alpha: Math.random() * 0.5 + 0.1,
        targetAlpha: Math.random() * 0.6 + 0.2,
      });
    }

    // -- Animation loop -----------------------------------------------------
    const render = () => {
      if (!isVisible) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (!prefersReducedMotion) {
          p.x += p.vx;
          p.y += p.vy;

          // Mouse proximity push
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < ease && dist > 0) {
            const force = (1 - dist / ease) * 0.6;
            p.x -= (dx / dist) * force;
            p.y -= (dy / dist) * force;
          }

          // Gentle fade pulsation
          p.alpha += (p.targetAlpha - p.alpha) * 0.02;
          if (Math.abs(p.targetAlpha - p.alpha) < 0.05) {
            p.targetAlpha = Math.random() * 0.6 + 0.15;
          }

          // Wrap boundaries
          if (p.y < -10) p.y = height + 10;
          if (p.x < -10) p.x = width + 10;
          if (p.x > width + 10) p.x = -10;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = p.alpha;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    // Pause when offscreen
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(animationFrameId);
      }
    });
    observer.observe(container);

    if (isVisible) {
      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      observer.disconnect();
    };
  }, [quantity, color, size, ease]);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
