/**
 * app/hukamnama/route.ts
 * ---------------------------------------------------------------------------
 * GET route handler for the Daily Hukamnama (item 11).
 *
 * Runs the server-side fetch (hs.sgpc.net + BaniDB enrich) and returns JSON
 * with s-maxage / stale-while-revalidate cache headers so CDNs and browsers
 * can cache the response for 6 hours (the Hukamnama changes at Amrit Vela).
 *
 * The client HukamnamaCard can fetch from this endpoint instead of calling a
 * server action, giving proper HTTP cache semantics. The card keeps its
 * localStorage cache for offline fallback.
 */

import { getHukamnama } from "@/lib/data";
import type { HukamnamaInfo } from "@/lib/types";

// 6 hours = 21600 seconds — the Hukamnama changes at Amrit Vela, never more.
const CACHE_MAX_AGE = 21600;

export async function GET(): Promise<Response> {
  try {
    const info = await getHukamnama();
    if (!info) {
      return Response.json({ error: "Hukamnama unavailable" }, { status: 502 });
    }

    return Response.json(info, {
      headers: {
        "Cache-Control": `public, s-maxage=${CACHE_MAX_AGE}, stale-while-revalidate=${CACHE_MAX_AGE}`,
      },
    });
  } catch {
    return Response.json({ error: "Hukamnama unavailable" }, { status: 502 });
  }
}
