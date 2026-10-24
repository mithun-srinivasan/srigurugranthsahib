/**
 * components/ShabadOfDayServer.tsx
 * ---------------------------------------------------------------------------
 * Server component that fetches the deterministic Shabad of the Day for the
 * current local date and passes it to ShabadOfDayCard as a prop.
 *
 * The same date yields the same shabad for everyone (date-keyed, not random).
 * The fetch runs on the server so the shabad is in the HTML on first paint.
 * The client card keeps its localStorage cache for offline fallback.
 */

import "server-only";

import { getDeterministicShabadOfDay } from "@/lib/data";
import ShabadOfDayCard from "./ShabadOfDayCard";

export default async function ShabadOfDayServer() {
  const today = new Date();
  const shabad = await getDeterministicShabadOfDay(today);
  return <ShabadOfDayCard shabad={shabad} />;
}
