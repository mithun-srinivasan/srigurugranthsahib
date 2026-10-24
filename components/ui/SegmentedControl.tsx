/**
 * components/ui/SegmentedControl.tsx
 * ---------------------------------------------------------------------------
 * High-fidelity animated segmented control inspired by interior.dev (interior.dev/docs/segmented-control).
 *
 * Micro-interaction anatomy:
 *   - "The selection travels. Nothing jumps."
 *   - A smooth sliding indicator pill moves under the selected tab using CSS
 *     transform with spring-like cubic-bezier physics.
 *   - Supports full keyboard accessibility (Left / Right arrows cycle options).
 *   - Replaces abrupt tab-switching buttons across reader controls and search.
 */

"use client";

import { useRef, useEffect, useState, useId } from "react";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  size?: "sm" | "md";
}

export default function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
  size = "md",
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    ready: boolean;
  }>({
    left: 0,
    width: 0,
    ready: false,
  });

  const baseId = useId();

  // Update sliding pill indicator position when `value` or `options` change
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const selectedIndex = options.findIndex((opt) => opt.value === value);
    if (selectedIndex === -1) return;

    const buttons = container.querySelectorAll<HTMLButtonElement>("button[role='radio']");
    const targetButton = buttons[selectedIndex];
    if (targetButton) {
      setIndicatorStyle({
        left: targetButton.offsetLeft,
        width: targetButton.offsetWidth,
        ready: true,
      });
    }
  }, [value, options]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex = currentIndex;
    if (e.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % options.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + options.length) % options.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = options.length - 1;
    } else {
      return;
    }

    e.preventDefault();
    onChange(options[nextIndex].value);
    const container = containerRef.current;
    if (container) {
      const buttons = container.querySelectorAll<HTMLButtonElement>("button[role='radio']");
      buttons[nextIndex]?.focus();
    }
  };

  const isSmall = size === "sm";

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={ariaLabel}
      className={`relative inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-1 select-none ${className}`}
    >
      {/* Sliding background pill indicator */}
      {indicatorStyle.ready && (
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 rounded-lg bg-[var(--surface)] shadow-sm border border-[var(--border-subtle)] transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            transform: `translateX(${indicatorStyle.left}px)`,
            width: `${indicatorStyle.width}px`,
          }}
        />
      )}

      {/* Segment options */}
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            id={`${baseId}-${opt.value}`}
            type="button"
            aria-pressed={selected}
            tabIndex={0}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`relative z-10 flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.97] ${
              isSmall ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs"
            } ${
              selected
                ? "text-[var(--text)] font-semibold"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {opt.icon && <span className="shrink-0">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
