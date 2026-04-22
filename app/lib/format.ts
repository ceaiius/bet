/**
 * Small formatting helpers used by Phase 2+ UI.
 *
 * Note on Intl + SSR: `Intl.DateTimeFormat` without an explicit `timeZone`
 * will use the system TZ, which differs between the server and the user's
 * browser → hydration mismatch. For anything time-related we either:
 *   (a) pin `timeZone: "UTC"` (what we do here), or
 *   (b) render on the client only (inside a `useEffect`).
 * Be wary of this in interviews — it's a classic Remix/RR SSR gotcha.
 */

export function formatCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** Decimal odds with exactly two decimals. `0` means the outcome doesn't
 *  apply (e.g. "draw" in basketball) and we render as "—". */
export function formatOdds(price: number): string {
  if (!price || price <= 0) return "—";
  return price.toFixed(2);
}

/** Human kickoff time, rendered deterministically in UTC. */
export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}
