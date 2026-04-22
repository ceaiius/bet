import { Link } from "react-router";
import type { Route } from "./+types/home";

import { getFeaturedEvents } from "~/data/sports";
import { EventCard } from "~/components/EventCard";

/**
 * ===========================================================================
 * Home route  /
 * ===========================================================================
 * Introduces TWO new route-module exports:
 *
 *   - `loader`  : async data fn. Runs on the server during SSR, and on the
 *                 client during client navigations (transparent to you).
 *
 *   - `headers` : HTTP response headers. The function receives info about
 *                 what's being sent so you can set Cache-Control, etc.
 *                 This ONLY has effect on the document response (SSR) and
 *                 on resource-route requests (Phase 7). During client-side
 *                 navigation it's a no-op.
 *
 * The home page is a good place to experiment with caching because the
 * featured events don't change minute-to-minute. In a real sportsbook,
 * you'd STILL keep odds pages uncached — those change constantly.
 * ===========================================================================
 */

export async function loader({}: Route.LoaderArgs) {
  const featured = await getFeaturedEvents();
  return { featured };
}

export function headers(_args: Route.HeadersArgs) {
  // `public`    : shared caches (CDN) may store
  // `max-age`   : browser caches for N seconds
  // `s-maxage`  : CDN-specific TTL
  // `stale-while-revalidate` : serve stale while refetching in background
  return {
    "Cache-Control":
      "public, max-age=10, s-maxage=60, stale-while-revalidate=300",
  };
}

export function meta({}: Route.MetaArgs) {
  return [
    { title: "BetLab — Featured events" },
    {
      name: "description",
      content: "Featured sporting events. Powered by React Router v7 loaders.",
    },
  ];
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { featured } = loaderData;

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Welcome to BetLab</h1>
      <p className="mt-2 max-w-2xl text-gray-400">
        You're now on <Badge>Phase&nbsp;2 — Data loading</Badge>. Every route
        you visit below now runs a <code>loader</code> with simulated latency.
        Watch the top progress bar + NavLink pending state.
      </p>

      <h2 className="mt-10 text-lg font-semibold">Featured today</h2>
      {featured.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No featured events yet.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {featured.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}

      <h2 className="mt-10 text-lg font-semibold">Explore</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <DemoCard
          to="/sports"
          title="Sports index"
          body="Re-uses the SHELL loader's data via useRouteLoaderData — no extra fetch."
        />
        <DemoCard
          to="/sports/football"
          title="Football (dynamic segment)"
          body="Its loader fetches leagues + a live count. shouldRevalidate skips refetch when :sport is unchanged."
        />
        <DemoCard
          to="/sports/football/premier-league"
          title="Premier League"
          body="Nested loader: fetches events for this league while parent data stays cached."
        />
        <DemoCard
          to="/events/evt-epl-001"
          title="Event detail (real loader)"
          body="Real lookup with throw-404 on unknown id — exercises the route ErrorBoundary from Phase 1."
        />
      </div>
    </section>
  );
}

/* --- tiny local components --- */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs text-emerald-300">
      {children}
    </span>
  );
}

function DemoCard({
  to,
  title,
  body,
}: {
  to: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      prefetch="intent"
      className="group rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-emerald-400/40 hover:bg-white/10"
    >
      <div className="text-sm font-semibold text-white group-hover:text-emerald-300">
        {title} →
      </div>
      <p className="mt-1 text-xs text-gray-400">{body}</p>
    </Link>
  );
}
