/**
 * ===========================================================================
 * Mock sportsbook "database" with async accessors
 * ===========================================================================
 * In a real project these functions would live on the server (e.g. Prisma
 * queries, REST calls, gRPC clients). Here they are in-memory but EVERY
 * accessor is `async` and we sprinkle simulated latency so our loaders
 * behave like real network IO — you'll see `NavLink` pending states, the
 * global LoadingBar, prefetch=intent benefits, and the waterfall pitfall.
 *
 * File organization principle:
 *   - `data/` is the "server-only" module in spirit. If we were enforcing it
 *     strictly we'd rename to `sports.server.ts` so React Router's compiler
 *     guarantees it never ships to the client. We'll do that conversion in
 *     Phase 5 when we introduce session secrets that MUST stay server-side.
 * ===========================================================================
 */

// ----------------------------- types ---------------------------------------

export type Sport = {
  slug: string;
  name: string;
  icon: string;
  liveCount: number;
};

export type League = {
  slug: string;
  name: string;
  country: string;
  sportSlug: string;
};

/**
 * A sportsbook "market" is a set of mutually-exclusive outcomes with odds.
 * We model a single 1X2 ("match result") market per event to keep Phase 2
 * focused on loaders. In Phase 3 we'll add more markets + selections.
 */
export type Market = {
  id: string;
  name: string; // e.g. "Match Result"
  selections: Selection[];
};

export type Selection = {
  id: string;
  label: string; // "Home", "Draw", "Away", or team/player name
  /** Decimal odds (e.g. 2.15 = 2.15x payout). We'll implement the format
   *  toggle — decimal/American/fractional — in Phase 6. */
  price: number;
};

export type Event = {
  id: string;
  sportSlug: string;
  leagueSlug: string;
  homeTeam: string;
  awayTeam: string;
  /** ISO timestamp. Kickoff time — we'll render with a `formatTime` helper. */
  startsAt: string;
  markets: Market[];
  /** Phase 4: in-play flag. In a real app this would come from a feed. */
  isLive?: boolean;
};

export type HotStats = {
  /** Total live-odds volatility in the last poll (fake metric for demo). */
  volatilityPct: number;
  /** Highest-odds selection right now. */
  longestShot: { label: string; price: number; eventLabel: string };
  /** Number of live events currently streaming. */
  liveCount: number;
};

// ----------------------------- catalog -------------------------------------

export const SPORTS: Sport[] = [
  { slug: "football", name: "Football", icon: "⚽", liveCount: 42 },
  { slug: "basketball", name: "Basketball", icon: "🏀", liveCount: 17 },
  { slug: "tennis", name: "Tennis", icon: "🎾", liveCount: 23 },
  { slug: "ice-hockey", name: "Ice Hockey", icon: "🏒", liveCount: 8 },
  { slug: "baseball", name: "Baseball", icon: "⚾", liveCount: 11 },
  { slug: "mma", name: "MMA", icon: "🥊", liveCount: 3 },
  { slug: "esports", name: "Esports", icon: "🎮", liveCount: 14 },
];

export const LEAGUES: League[] = [
  {
    slug: "premier-league",
    name: "Premier League",
    country: "England",
    sportSlug: "football",
  },
  { slug: "la-liga", name: "La Liga", country: "Spain", sportSlug: "football" },
  { slug: "serie-a", name: "Serie A", country: "Italy", sportSlug: "football" },
  {
    slug: "bundesliga",
    name: "Bundesliga",
    country: "Germany",
    sportSlug: "football",
  },
  {
    slug: "champions-league",
    name: "Champions League",
    country: "Europe",
    sportSlug: "football",
  },
  { slug: "nba", name: "NBA", country: "USA", sportSlug: "basketball" },
  {
    slug: "euroleague",
    name: "Euroleague",
    country: "Europe",
    sportSlug: "basketball",
  },
  { slug: "atp", name: "ATP Tour", country: "World", sportSlug: "tennis" },
  { slug: "wta", name: "WTA Tour", country: "World", sportSlug: "tennis" },
  { slug: "nhl", name: "NHL", country: "USA/Canada", sportSlug: "ice-hockey" },
  { slug: "mlb", name: "MLB", country: "USA", sportSlug: "baseball" },
  { slug: "ufc", name: "UFC", country: "World", sportSlug: "mma" },
  {
    slug: "cs2",
    name: "Counter-Strike 2",
    country: "World",
    sportSlug: "esports",
  },
  { slug: "dota-2", name: "Dota 2", country: "World", sportSlug: "esports" },
  {
    slug: "lol",
    name: "League of Legends",
    country: "World",
    sportSlug: "esports",
  },
];

/**
 * We hand-write a small set of events. We also use a deterministic seed for
 * any "random-looking" values so SSR and CSR produce identical markup
 * (hydration mismatches are a real pain — always be deterministic in loaders).
 */
function mkMarket1x2(home: number, draw: number, away: number): Market {
  return {
    id: "1x2",
    name: "Match Result",
    selections: [
      { id: "home", label: "Home", price: home },
      { id: "draw", label: "Draw", price: draw },
      { id: "away", label: "Away", price: away },
    ],
  };
}

// Pinned "now" to keep the mock kickoff times predictable during dev.
// In a real API, we'd use real Date.now(). Using a fixed anchor avoids
// "time drift" between SSR and hydration for this learning project.
const NOW = new Date("2026-04-21T18:00:00Z").getTime();
const mins = (n: number) => new Date(NOW + n * 60_000).toISOString();

export const EVENTS: Event[] = [
  {
    id: "evt-epl-001",
    sportSlug: "football",
    leagueSlug: "premier-league",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    startsAt: mins(60),
    markets: [mkMarket1x2(2.05, 3.4, 3.6)],
  },
  {
    id: "evt-epl-002",
    sportSlug: "football",
    leagueSlug: "premier-league",
    homeTeam: "Man City",
    awayTeam: "Liverpool",
    startsAt: mins(150),
    markets: [mkMarket1x2(1.85, 3.7, 4.2)],
  },
  {
    id: "evt-laliga-001",
    sportSlug: "football",
    leagueSlug: "la-liga",
    homeTeam: "Real Madrid",
    awayTeam: "Barcelona",
    startsAt: mins(240),
    markets: [mkMarket1x2(2.2, 3.5, 3.1)],
  },
  {
    id: "evt-seriea-001",
    sportSlug: "football",
    leagueSlug: "serie-a",
    homeTeam: "Inter",
    awayTeam: "Juventus",
    startsAt: mins(90),
    markets: [mkMarket1x2(2.4, 3.2, 2.95)],
  },
  {
    id: "evt-ucl-001",
    sportSlug: "football",
    leagueSlug: "champions-league",
    homeTeam: "Bayern",
    awayTeam: "PSG",
    startsAt: mins(180),
    markets: [mkMarket1x2(2.1, 3.6, 3.25)],
  },
  {
    id: "evt-nba-001",
    sportSlug: "basketball",
    leagueSlug: "nba",
    homeTeam: "Lakers",
    awayTeam: "Celtics",
    startsAt: mins(30),
    markets: [
      mkMarket1x2(1.95, 0 /* no draw in basketball; kept for shape */, 1.85),
    ],
    isLive: true,
  },
  {
    id: "evt-nba-002",
    sportSlug: "basketball",
    leagueSlug: "nba",
    homeTeam: "Warriors",
    awayTeam: "Nuggets",
    startsAt: mins(210),
    markets: [mkMarket1x2(2.3, 0, 1.6)],
  },
  {
    id: "evt-atp-001",
    sportSlug: "tennis",
    leagueSlug: "atp",
    homeTeam: "Alcaraz",
    awayTeam: "Sinner",
    startsAt: mins(120),
    markets: [mkMarket1x2(1.75, 0, 2.1)],
    isLive: true,
  },
  {
    id: "evt-ufc-001",
    sportSlug: "mma",
    leagueSlug: "ufc",
    homeTeam: "Jones",
    awayTeam: "Aspinall",
    startsAt: mins(300),
    markets: [mkMarket1x2(1.5, 0, 2.7)],
  },
  {
    id: "evt-cs2-001",
    sportSlug: "esports",
    leagueSlug: "cs2",
    homeTeam: "NAVI",
    awayTeam: "FaZe",
    startsAt: mins(75),
    markets: [mkMarket1x2(1.9, 0, 1.95)],
    isLive: true,
  },
  {
    id: "evt-epl-003",
    sportSlug: "football",
    leagueSlug: "premier-league",
    homeTeam: "Tottenham",
    awayTeam: "Newcastle",
    startsAt: mins(-15), // kicked off 15 min ago → definitely live
    markets: [mkMarket1x2(2.6, 3.1, 2.7)],
    isLive: true,
  },
];

// ----------------------------- helpers -------------------------------------

/**
 * Simulated network latency.
 *
 * Phase 4 enhancement: accepts an optional `AbortSignal`. If the signal
 * fires BEFORE the delay completes, we reject with an AbortError.
 *
 * In production loaders you should forward `request.signal` into every
 * fetch/DB call so they cancel when the user navigates away mid-load —
 * otherwise a slow query can keep burning CPU and holding a DB connection
 * for a request that nobody cares about anymore.
 */
export const sleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("Aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });

// ----------------------------- async accessors -----------------------------
// Every loader in this app calls one of these. Keep them small, typed,
// and free of UI concerns.

export async function getAllSports(): Promise<Sport[]> {
  await sleep(120);
  return SPORTS;
}

export async function getSport(slug: string): Promise<Sport | undefined> {
  console.log("getSport", slug);
  await sleep(120);
  return SPORTS.find((s) => s.slug === slug);
}

export async function getLeaguesForSport(sportSlug: string): Promise<League[]> {
  await sleep(180);
  return LEAGUES.filter((l) => l.sportSlug === sportSlug);
}

export async function getLeague(
  sportSlug: string,
  leagueSlug: string,
): Promise<League | undefined> {
  await sleep(150);
  return LEAGUES.find(
    (l) => l.sportSlug === sportSlug && l.slug === leagueSlug,
  );
}

export async function getEventsForLeague(
  sportSlug: string,
  leagueSlug: string,
): Promise<Event[]> {
  await sleep(220);
  return EVENTS.filter(
    (e) => e.sportSlug === sportSlug && e.leagueSlug === leagueSlug,
  );
}

export async function getEvent(eventId: string): Promise<Event | undefined> {
  await sleep(140);
  return EVENTS.find((e) => e.id === eventId);
}

export async function getFeaturedEvents(): Promise<Event[]> {
  await sleep(100);
  // Top 4 upcoming events by start time.
  return [...EVENTS]
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))
    .slice(0, 4);
}

// ---------------------------------------------------------------------------
// Phase 4: "live" accessors
// ---------------------------------------------------------------------------

/**
 * Fast accessor — list of currently-live events. Returns a fresh odds
 * snapshot each call: prices jitter by ±5% to simulate a live price feed.
 * The jitter is intentional — watching prices flicker is how you see
 * polling working.
 */
export async function getLiveEvents(signal?: AbortSignal): Promise<Event[]> {
  await sleep(120, signal);
  return EVENTS.filter((e) => e.isLive).map((e) => ({
    ...e,
    markets: e.markets.map((m) => ({
      ...m,
      selections: m.selections.map((s) => ({
        ...s,
        price: jitter(s.price),
      })),
    })),
  }));
}

/**
 * Deliberately slow. Returned as a PROMISE from the /live loader (not
 * awaited) so the critical content paints first and this streams in via
 * `<Await>` + `<Suspense>`.
 */
export async function getHotStats(signal?: AbortSignal): Promise<HotStats> {
  await sleep(1200, signal);
  const live = EVENTS.filter((e) => e.isLive);
  let longestShot = {
    label: "—",
    price: 0,
    eventLabel: "—",
  };
  for (const e of live) {
    for (const m of e.markets) {
      for (const s of m.selections) {
        if (s.price > longestShot.price) {
          longestShot = {
            label: s.label,
            price: s.price,
            eventLabel: `${e.homeTeam} vs ${e.awayTeam}`,
          };
        }
      }
    }
  }
  return {
    volatilityPct: Math.round(Math.random() * 40 + 10), // 10%–50%
    longestShot,
    liveCount: live.length,
  };
}

function jitter(price: number): number {
  if (!price) return 0;
  // ±5%, rounded to 2 decimals. Never let it drop below 1.01 (minimum
  // realistic decimal odds).
  const swing = price * 0.05 * (Math.random() * 2 - 1);
  return Math.max(1.01, +(price + swing).toFixed(2));
}
