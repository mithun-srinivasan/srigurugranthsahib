/**
 * components/HukamnamaServer.tsx
 * ---------------------------------------------------------------------------
 * Server component that fetches the Daily Hukamnama from hs.sgpc.net
 * (via getHukamnama in lib/data.ts) and passes it to HukamnamaCard as a prop.
 *
 * Running the fetch on the server puts the Hukamnama into the HTML on first
 * paint — no client-side loading skeleton. The fetch is cached for 6 hours
 * (s-maxage/stale-while-revalidate via fetchUpstream's `next: { revalidate }`).
 * The client card keeps its localStorage cache for offline fallback.
 */

import "server-only";

import { getHukamnama } from "@/lib/data";
import HukamnamaCard from "./HukamnamaCard";

export default async function HukamnamaServer() {
  const info = await getHukamnama();
  return <HukamnamaCard info={info} />;
}
