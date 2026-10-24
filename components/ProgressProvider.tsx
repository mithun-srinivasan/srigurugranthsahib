/**
 * components/ProgressProvider.tsx
 * ---------------------------------------------------------------------------
 * Context + provider backing four related "reading journey" features:
 *   7. Reading progress — completed Angs (marked when the reader's end
 *      sentinel triggers, or via the home-page steer).
 *   8. Reading streaks — consecutive days with at least one Ang read.
 *   9. Reading history — the most recent Angs revisited, newest last.
 *  13. Reading playlist — a "Sehaj Paath"-style plan: start today and read
 *      N Angs/day until all 1430 are covered.
 *  28. Daily goal tracker — an Angs-per-day goal with today's progress.
 *
 * All state lives in `localStorage` (`sgs-reader-progress`) guarded by a
 * hydration flag, and is debounced 500ms on write, mirroring the other
 * providers.
 *
 * Migrated to use the shared `lib/persist.ts` helper for:
 *   - Runtime validation with bad-item dropping
 *   - Versioned storage keys
 *   - 500ms debounce + immediate flush on pagehide/visibilitychange
 *   - Quota error surfacing
 *
 * Consume with `useReadingProgress()`.
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { ReadingProgress } from "@/lib/types";
import { MAX_ANG, MIN_ANG } from "@/lib/types";
import { createPersistHook, createValidator, validateArray, validateNumber, validateString, validateRecord, validateOptional } from "@/lib/persist";

/** localStorage key for the reading-progress blob. */
const STORAGE_KEY = "sgs-reader-progress";

/** Local date key such as `2026-09-14`, used for day/streak arithmetic. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parses a `YYYY-MM-DD` key back into a local Date at noon. */
function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Empty starting state — nothing read, no plan, no daily goal. */
const EMPTY: ReadingProgress = { readAngs: [], visits: {}, history: [], plan: null, dailyGoal: 0 };

/** Normalises a stored daily goal (corrupt storage → 0 = unset). */
function normalizeGoal(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(50, Math.round(value)))
    : 0;
}

/** Validator for a single history entry. */
function validateHistoryEntry(raw: unknown): { ok: true; data: { ang: number; at: number } } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "history: not an object" };
  }
  const obj = raw as Record<string, unknown>;

  const angResult = validateNumber(obj.ang, "history.ang", { integer: true, min: MIN_ANG, max: MAX_ANG });
  if (!angResult.ok) return angResult;

  const atResult = validateNumber(obj.at, "history.at", { integer: true, min: 0 });
  if (!atResult.ok) return atResult;

  return {
    ok: true,
    data: { ang: angResult.data, at: atResult.data },
  };
}

/** Validator for the ReadingProgress object. */
function validateReadingProgress(raw: unknown): { ok: true; data: ReadingProgress } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "progress: not an object" };
  }
  const obj = raw as Record<string, unknown>;

  // readAngs: array of integers 1-1430
  const readAngsResult = validateArray(obj.readAngs, (item) =>
    validateNumber(item, "readAngs.item", { integer: true, min: MIN_ANG, max: MAX_ANG }), "readAngs");
  if (!readAngsResult.ok) return readAngsResult;

  // visits: record of string -> number
  const visitsResult = validateRecord(obj.visits, (v) => validateNumber(v, "visits.value", { integer: true, min: 0 }), "visits");
  if (!visitsResult.ok) return visitsResult;

  // history: array of { ang, at }
  const historyResult = validateArray(obj.history, validateHistoryEntry, "history");
  if (!historyResult.ok) return historyResult;

  // plan: optional { startDate: string, totalDays: number }
  const planResult = validateOptional(obj.plan, (v) => {
    if (typeof v !== "object" || v === null) return { ok: false, reason: "plan: not an object" };
    const p = v as Record<string, unknown>;
    const startDateResult = validateString(p.startDate, "plan.startDate");
    if (!startDateResult.ok) return startDateResult;
    const totalDaysResult = validateNumber(p.totalDays, "plan.totalDays", { integer: true, min: 1, max: 1430 });
    if (!totalDaysResult.ok) return totalDaysResult;
    return {
      ok: true,
      data: { startDate: startDateResult.data, totalDays: totalDaysResult.data },
    };
  }, "plan");
  if (!planResult.ok) return planResult;

  // dailyGoal: number 0-50
  const dailyGoalResult = validateNumber(obj.dailyGoal, "dailyGoal", { min: 0, max: 50 });
  if (!dailyGoalResult.ok) return dailyGoalResult;

  return {
    ok: true,
    data: {
      readAngs: readAngsResult.data,
      visits: visitsResult.data,
      history: historyResult.data,
      plan: planResult.data ?? null,
      dailyGoal: dailyGoalResult.data,
    } satisfies ReadingProgress,
  };
}

/** Validator for the full progress object. */
const progressValidator = createValidator<ReadingProgress>(1, (raw: unknown) => {
  const result = validateReadingProgress(raw);
  if (!result.ok) return { ok: true, data: EMPTY };
  return { ok: true, data: result.data };
});

/** Persisted slice hook for progress. */
const usePersistedProgress = createPersistHook<ReadingProgress>({
  key: STORAGE_KEY,
  validator: progressValidator,
  defaultValue: EMPTY,
});

/** Public context API. */
interface ProgressContextValue extends ReadingProgress {
  hydrated: boolean;
  /** Marks an Ang as completed AND records the day visit + history entry. */
  markAngRead: (ang: number) => void;
  /** Whether the given Ang's ending has been reached before. */
  isAngRead: (ang: number) => boolean;
  /** Percentage (0–100) of the Guru Granth completed. */
  progressPercent: number;
  /** Number of distinct days with at least one Ang read. */
  totalReadDays: number;
  /** Current streak (consecutive days, counting forward from today). */
  streak: number;
  /** The most recently read Ang entry (or undefined). */
  lastRead: { ang: number; at: number } | undefined;
  /** Start (or restart) a Sehaj-Paath reading plan lasting `totalDays` days. */
  startPlan: (totalDays: number) => void;
  /** Permanently remove the reading plan. */
  clearPlan: () => void;
  /** Day-of-plan index (0-based) for the plan's start date. */
  planDayIndex: number;
  /** Today's slice of the plan as [fromAng, toAng] (empty when no plan). */
  todaysPlanRange: [number, number] | null;
  /** Ang to continue from under the plan (first unread >= today's start). */
  planContinueAng: number;
  /** Distinct Angs completed today (derived from history timestamps). */
  todaysAngCount: number;
  /** Set the daily Sehaj Paath goal (angs/day, clamped 0–50; 0 clears it). */
  setDailyGoal: (angs: number) => void;
  /** Quota error signal (storage full / not saved). */
  quotaError: Error | null;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress, hydrated, quotaError] = usePersistedProgress();

  // -- Actions ---------------------------------------------------------------

  const markAngRead = useCallback((ang: number) => {
    const now = Date.now();
    const key = dayKey();
    setProgress((p) => {
      const readAngs = p.readAngs.includes(ang) ? p.readAngs : [...p.readAngs, ang];
      const visits = { ...p.visits, [key]: (p.visits[key] ?? 0) + 1 };
      const history = [...p.history.filter((h) => h.ang !== ang), { ang, at: now }].slice(-60);
      return { ...p, readAngs, visits, history };
    });
  }, [setProgress]);

  const isAngRead = useCallback((ang: number) => progress.readAngs.includes(ang), [progress.readAngs]);

  const startPlan = useCallback((totalDays: number) => {
    setProgress((p) => ({
      ...p,
      plan: { startDate: dayKey(), totalDays: Math.max(1, Math.min(1430, totalDays)) },
    }));
  }, [setProgress]);

  const clearPlan = useCallback(() => {
    setProgress((p) => ({ ...p, plan: null }));
  }, [setProgress]);

  const setDailyGoal = useCallback((angs: number) => {
    setProgress((p) => ({
      ...p,
      dailyGoal: Math.max(0, Math.min(50, Math.round(angs) || 0)),
    }));
  }, [setProgress]);

  const value = useMemo((): ProgressContextValue => {
    /** Consecutive days (>=1) with a read, counting forward from today. */
    const streak = (() => {
      if (!hydrated) return 0;
      let days = 0;
      const cursor = new Date();
      // If today has no read yet, allow the streak to count from yesterday.
      if (!progress.visits[dayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
      while (progress.visits[dayKey(cursor)]) {
        days += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return days;
    })();

    /** 0-based index into the plan for the current day (-1 when no plan). */
    const planDayIndex = (() => {
      if (!hydrated || !progress.plan) return -1;
      const start = dateFromKey(progress.plan.startDate);
      // Noon-to-noon arithmetic: midnight-based `today` would sit 12 h
      // behind a noon `start` and report day 0 all through day 2.
      const today = dateFromKey(dayKey());
      const dayMs = 86_400_000;
      const idx = Math.round((today.getTime() - start.getTime()) / dayMs);
      return Math.max(0, Math.min(idx, progress.plan.totalDays - 1));
    })();

    /** The Ang range scheduled for today under the plan (null when no plan). */
    const todaysPlanRange: [number, number] | null = (() => {
      if (!hydrated || !progress.plan || planDayIndex < 0) return null;
      const perDay = Math.ceil(MAX_ANG / progress.plan.totalDays);
      const fromAng = planDayIndex * perDay + 1;
      const toAng = Math.min(MAX_ANG, fromAng + perDay - 1);
      return [fromAng, toAng];
    })();

    /** First unread Ang at or after today's range start. */
    const planContinueAng = (() => {
      if (!hydrated || !todaysPlanRange) return MIN_ANG;
      const [fromAng] = todaysPlanRange;
      let cursor = fromAng;
      while (cursor <= MAX_ANG && progress.readAngs.includes(cursor)) cursor += 1;
      return cursor;
    })();

    /** Distinct Angs completed today — history holds one entry per Ang. */
    const todaysAngCount = (() => {
      if (!hydrated) return 0;
      const today = dayKey();
      return progress.history.filter((h) => dayKey(new Date(h.at)) === today).length;
    })();

    return {
      ...progress,
      dailyGoal: normalizeGoal(progress.dailyGoal),
      hydrated,
      markAngRead,
      isAngRead,
      progressPercent: Math.round((progress.readAngs.length / MAX_ANG) * 100),
      totalReadDays: Object.keys(progress.visits).length,
      streak,
      lastRead: progress.history[progress.history.length - 1],
      startPlan,
      clearPlan,
      planDayIndex,
      todaysPlanRange,
      planContinueAng,
      todaysAngCount,
      setDailyGoal,
      quotaError,
    };
  }, [progress, hydrated, markAngRead, isAngRead, startPlan, clearPlan, setDailyGoal, quotaError]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useReadingProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useReadingProgress must be used within ProgressProvider");
  return ctx;
}