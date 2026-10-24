/**
 * app/shabad-of-day/route.ts
 * ---------------------------------------------------------------------------
 * GET route handler for the Shabad of the Day (item 11).
 *
 * Returns the same shabad for everyone on a given calendar date
 * (deterministic by date-keyed Ang derivation), with s-maxage /
 * stale-while-revalidate cache headers so all viewers see the same shabad
 * and CDNs can cache it.
 *
 * The client ShabadOfDayCard can fetch from this endpoint. The card keeps its
 * localStorage date-keyed cache for offline fallback.
 */

import { getDeterministicShabadOfDay } from "@/lib/data";

// Cache until the end of the local day so the shabad is stable all day.
function endOfDaySeconds(): number {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(1, Math.floor((end.getTime() - now.getTime()) / 1000));
}

export async function GET(): Promise<Response> {
  try {
    const shabad = await getDeterministicShabadOfDay();
    if (!shabad) {
      return Response.json({ error: "Shabad unavailable" }, { status: 502 });
    }

    return Response.json(shabad, {
      headers: {
        "Cache-Control": `public, s-maxage=${endOfDaySeconds()}, stale-while-revalidate=${endOfDaySeconds()}`,
      },
    });
  } catch {
    return Response.json({ error: "Shabad unavailable" }, { status: 502 });
  }
}
