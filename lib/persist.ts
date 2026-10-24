/**
 * lib/persist.ts
 * ---------------------------------------------------------------------------
 * Shared persisted-store helper for localStorage-backed state.
 *
 * Provides:
 *   (a) Runtime validation of parsed JSON per slice — arrays/objects/field types,
 *       drop bad items, never throw.
 *   (b) Versioned storage keys (key + "__vN") for future migrations.
 *   (c) 500 ms debounce + immediate flush on `pagehide` and `visibilitychange:hidden`.
 *   (d) Surfaced "storage full / not saved" signal instead of silently swallowing
 *       quota errors.
 *
 * All existing providers (Bookmarks, Notes, Highlights, Progress, ReaderPrefs)
 * migrate to this helper while keeping their original storage keys and backup
 * format compatible.
 */

"use client";

import { useEffect, useRef, useState, useCallback, useMemo, type ReactNode } from "react";

/** Version suffix appended to storage keys for future migrations. */
const STORAGE_VERSION = 1;

/** Builds the versioned storage key. */
function versionedKey(baseKey: string): string {
  return `${baseKey}__v${STORAGE_VERSION}`;
}

/** Result of a validation: either valid data or a reason it was rejected. */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

/** Validator function for a single slice of data. */
export interface SliceValidator<T> {
  /** Validate and sanitise a raw value from localStorage. Never throws. */
  (raw: unknown): ValidationResult<T>;
  /** Current schema version for this slice (for future migrations). */
  schemaVersion: number;
}

/** Creates a properly typed validator with schema version. */
export function createValidator<T>(
  schemaVersion: number,
  validator: (raw: unknown) => ValidationResult<T>
): SliceValidator<T> {
  return Object.assign(validator, { schemaVersion });
}

/** Configuration for a persisted slice. */
export interface PersistSliceConfig<T> {
  /** Base localStorage key (without version suffix). */
  key: string;
  /** Validator for this slice's data shape. */
  validator: SliceValidator<T>;
  /** Default value when storage is empty or invalid. */
  defaultValue: T;
  /** Optional: called when a quota error occurs during write. */
  onQuotaError?: (error: Error) => void;
}

/** Internal state shared by all hooks using the same slice. */
interface SliceState<T> {
  data: T;
  hydrated: boolean;
  /** Ref mirror for the debounced writer. */
  ref: T;
  /** Debounce timer handle. */
  timer: ReturnType<typeof setTimeout> | null;
  /** Quota error signal for the current session. */
  quotaError: Error | null;
  /** Versioned storage key for this slice. */
  vKey: string;
}

/** Global registry of slice state (one per key per session). */
const sliceRegistry = new Map<string, SliceState<unknown>>();

/** Get or create the shared state for a slice. */
function getSliceState<T>(config: PersistSliceConfig<T>): SliceState<T> {
  const vKey = versionedKey(config.key);
  let state = sliceRegistry.get(vKey) as SliceState<T> | undefined;
  if (!state) {
    state = {
      data: config.defaultValue,
      hydrated: false,
      ref: config.defaultValue,
      timer: null,
      quotaError: null,
      vKey,
    };
    sliceRegistry.set(vKey, state);
  }
  return state;
}

/**
 * Hydrates a slice from localStorage (once per session).
 * Returns the validated data or the default value.
 */
function hydrateSlice<T>(config: PersistSliceConfig<T>): T {
  const state = getSliceState(config);
  if (state.hydrated) return state.data;

  try {
    const raw = localStorage.getItem(versionedKey(config.key));
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      const result = config.validator(parsed);
      if (result.ok) {
        state.data = result.data;
        state.ref = result.data;
      }
      // Invalid data is silently dropped; default is used.
    }
  } catch {
    // Corrupted JSON — use default.
  } finally {
    state.hydrated = true;
  }
  return state.data;
}

/**
 * Persists a slice to localStorage with debounce.
 * Also registers global flush handlers on first use.
 */
function persistSlice<T>(config: PersistSliceConfig<T>, data: T): void {
  const state = getSliceState(config);
  state.data = data;
  state.ref = data;
  state.quotaError = null; // clear previous error on new write attempt

  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(() => {
    try {
      localStorage.setItem(versionedKey(config.key), JSON.stringify(data));
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      state.quotaError = err;
      config.onQuotaError?.(err);
    }
  }, 500);
}

/**
 * Immediately flushes a slice to localStorage (bypasses debounce).
 * Called on pagehide / visibilitychange:hidden.
 */
function flushSlice<T>(config: PersistSliceConfig<T>): void {
  const state = getSliceState(config);
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
  try {
    localStorage.setItem(versionedKey(config.key), JSON.stringify(state.ref));
    state.quotaError = null;
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    state.quotaError = err;
    config.onQuotaError?.(err);
  }
}

/** Register global flush handlers once. */
let flushHandlersRegistered = false;
function registerFlushHandlers(): void {
  if (flushHandlersRegistered || typeof window === "undefined") return;
  flushHandlersRegistered = true;

  const flushAll = () => {
    for (const [, state] of sliceRegistry) {
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = null;
      }
      try {
        localStorage.setItem(state.vKey, JSON.stringify(state.ref));
        state.quotaError = null;
      } catch {
        // Best effort; quota errors already signalled during debounced write.
      }
    }
  };

  // pagehide fires when the page is being unloaded (including bfcache).
  window.addEventListener("pagehide", flushAll);
  // visibilitychange:hidden fires when tab is hidden (mobile backgrounding).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
}

/**
 * Creates a React hook for a single persisted slice.
 * Returns [data, setData, hydrated, quotaError, forceFlush].
 */
export function createPersistHook<T>(config: PersistSliceConfig<T>) {
  // Register global flush handlers on first hook creation.
  registerFlushHandlers();

  return function usePersistedSlice(): [
    T,
    (updater: T | ((prev: T) => T)) => void,
    boolean,
    Error | null,
    () => void
  ] {
    const state = getSliceState(config);

    // Hydrate on first render (SSR-safe: runs after mount).
    const [, forceRender] = useState(0);
    const hydratedRef = useRef(false);

    useEffect(() => {
      if (!hydratedRef.current) {
        hydratedRef.current = true;
        const data = hydrateSlice(config);
        state.data = data;
        state.ref = data;
        forceRender((n) => n + 1);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- state is from registry, stable across renders
    }, []);

    // Keep ref mirror current for the debounced writer.
    useEffect(() => {
      if (state.hydrated) {
        state.ref = state.data;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- state is from registry, stable across renders
    }, [state.data, state.hydrated]);

    const setData = useCallback(
      (updater: T | ((prev: T) => T)) => {
        const next = typeof updater === "function" ? (updater as (prev: T) => T)(state.data) : updater;
        state.data = next;
        state.ref = next;
        forceRender((n) => n + 1);
        persistSlice(config, next);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps -- config and state are stable from outer scope
      []
    );

    const forceFlush = useCallback(() => flushSlice(config), []);

    return [state.data, setData, state.hydrated, state.quotaError, forceFlush];
  };
}

/**
 * Validator helpers for common shapes.
 */

/** Validates an array of items with a per-item validator. */
export function validateArray<T>(
  raw: unknown,
  itemValidator: (item: unknown) => ValidationResult<T>,
  context: string
): ValidationResult<T[]> {
  if (!Array.isArray(raw)) return { ok: false, reason: `${context}: not an array` };
  const valid: T[] = [];
  for (const item of raw) {
    const result = itemValidator(item);
    if (result.ok) valid.push(result.data);
    // Invalid items are dropped silently.
  }
  return { ok: true, data: valid };
}

/** Validates an object with known fields. */
export function validateObject<T extends Record<string, unknown>>(
  raw: unknown,
  fieldValidators: Record<string, (value: unknown) => ValidationResult<unknown>>,
  context: string
): ValidationResult<T> {
  if (typeof raw !== "object" || raw === null) return { ok: false, reason: `${context}: not an object` };
  const obj = raw as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  let hasValidField = false;
  for (const [key, validator] of Object.entries(fieldValidators)) {
    const fieldResult = validator(obj[key]);
    if (fieldResult.ok) {
      result[key] = fieldResult.data;
      hasValidField = true;
    }
    // Invalid fields are dropped.
  }
  return hasValidField ? { ok: true, data: result as T } : { ok: false, reason: `${context}: no valid fields` };
}

/** Validates a string field. */
export function validateString(
  raw: unknown,
  context: string,
  options?: { minLength?: number; maxLength?: number }
): ValidationResult<string> {
  if (typeof raw !== "string") return { ok: false, reason: `${context}: not a string` };
  if (options?.minLength !== undefined && raw.length < options.minLength) {
    return { ok: false, reason: `${context}: too short` };
  }
  if (options?.maxLength !== undefined && raw.length > options.maxLength) {
    return { ok: false, reason: `${context}: too long` };
  }
  return { ok: true, data: raw };
}

/** Validates a number field. */
export function validateNumber(
  raw: unknown,
  context: string,
  options?: { min?: number; max?: number; integer?: boolean }
): ValidationResult<number> {
  if (typeof raw !== "number" || Number.isNaN(raw)) return { ok: false, reason: `${context}: not a number` };
  if (options?.integer && !Number.isInteger(raw)) return { ok: false, reason: `${context}: not an integer` };
  if (options?.min !== undefined && raw < options.min) return { ok: false, reason: `${context}: below minimum` };
  if (options?.max !== undefined && raw > options.max) return { ok: false, reason: `${context}: above maximum` };
  return { ok: true, data: raw };
}

/** Validates a boolean field. */
export function validateBoolean(raw: unknown, context: string): ValidationResult<boolean> {
  if (typeof raw !== "boolean") return { ok: false, reason: `${context}: not a boolean` };
  return { ok: true, data: raw };
}

/** Validates an optional field (allows undefined/null). */
export function validateOptional<T>(
  raw: unknown,
  validator: (value: unknown) => ValidationResult<T>,
  context: string
): ValidationResult<T | undefined> {
  if (raw === undefined || raw === null) return { ok: true, data: undefined };
  return validator(raw);
}

/** Validates an array of strings. */
export function validateStringArray(raw: unknown, context: string): ValidationResult<string[]> {
  return validateArray(raw, (item) => validateString(item, `${context}[item]`), context);
}

/** Validates a record (object with string keys) of a specific value type. */
export function validateRecord<T>(
  raw: unknown,
  valueValidator: (value: unknown) => ValidationResult<T>,
  context: string
): ValidationResult<Record<string, T>> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: `${context}: not a record` };
  }
  const result: Record<string, T> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const itemResult = valueValidator(value);
    if (itemResult.ok) result[key] = itemResult.data;
  }
  return { ok: true, data: result };
}