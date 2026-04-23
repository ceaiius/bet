import { Suspense } from "react";
import { Await } from "react-router";
import type { Route } from "./+types/live";

import { getHotStats, getLiveEvents } from "~/data/sports";
import { LiveEventCard } from "~/components/LiveEventCard";
import { LivePoller } from "~/components/LivePoller";
import { HotStats, HotStatsSkeleton } from "~/components/HotStats";

/**
 * ===========================================================================
 * /live  —  Phase 4: streaming loaders + Suspense + polling
 * ===========================================================================
 * This page demonstrates the THREE pillars of "real-time-ish" data in
 * React Router framework mode:
 *
 *   1. STREAMING: the loader returns a MIX of awaited values (critical,
 *      must-be-ready-before-first-paint) AND un-awaited Promises (slower,
 *      non-critical, streamed in after initial HTML). The component pairs
 *      each Promise with `<Suspense>` + `<Await>`.
 *
 *   2. POLLING via useRevalidator: <LivePoller /> triggers the loader to
 *      re-run on an interval. React Router re-runs this loader (and any
 *      other matched loader that opts in), turbo-streams the new data
 *      back, and the UI updates in place.
 *
 *   3. ABORT SIGNALS: every call we make inside the loader forwards
 *      `request.signal`. If the user navigates away mid-load (or the
 *      revalidator fires a new one before the last finished), the
 *      in-flight work is cancelled — no wasted CPU/DB time.
 * ===========================================================================
 */

export async function loader({ request }: Route.LoaderArgs) {
  // Critical data: we AWAIT this. The page will not start rendering until
  // it resolves. The user sees no content before this is ready.
  const liveEvents = await getLiveEvents(request.signal);

  // Non-critical: a DEFERRED promise. We DO NOT await it. React Router
  // serializes the promise into the response stream and sends the rest of
  // the HTML immediately; the promise resolves in the background and its
  // result streams in as a second chunk.
  const hotStatsPromise = getHotStats(request.signal);

  // IMPORTANT: attach a `.catch` so an unhandled rejection doesn't
  // crash the runtime. The <Await> component will still see the failure
  // via its own error boundary. Without this catch, Node logs scary
  // "UnhandledPromiseRejection" warnings during streaming.
  hotStatsPromise.catch(() => {});

  return { liveEvents, hotStats: hotStatsPromise };
}

export function meta({}: Route.MetaArgs) {
  return [{ title: "Live — BetLab" }];
}

export default function LivePage({ loaderData }: Route.ComponentProps) {
  const { liveEvents, hotStats } = loaderData;

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Live / in-play</h1>
          <p className="mt-1 text-sm text-gray-400">
            Odds jitter on every poll. Watch the prices flicker green/red.
          </p>
        </div>
        {/* Polls the current route's loaders every N ms. */}
        <LivePoller intervalMs={4000} />
      </div>

      {/* Critical-path section: rendered synchronously. */}
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-gray-400">
        In-play ({liveEvents.length})
      </h2>
      {liveEvents.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">Nothing live right now.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {liveEvents.map((e) => (
            <LiveEventCard key={e.id} event={e} />
          ))}
        </div>
      )}

      {/* Streamed-in section: <Suspense> fallback shows until the Promise
          resolves. The key={String(hotStats)} trick forces <Suspense> to
          remount each time the Promise identity changes (i.e., every
          revalidation), re-showing the skeleton until new data arrives. */}
      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Hot stats{" "}
        <span className="ml-2 text-[10px] text-emerald-300">(streamed)</span>
      </h2>
      <div className="mt-4">
        <Suspense fallback={<HotStatsSkeleton />}>
          <Await resolve={hotStats} errorElement={<HotStatsError />}>
            {(data) => <HotStats data={data} />}
          </Await>
        </Suspense>
      </div>
    </section>
  );
}

function HotStatsError() {
  return (
    <div className="rounded-lg border border-red-400/20 bg-red-500/5 p-4 text-sm text-red-300">
      Hot stats failed to load. They'll retry on the next poll.
    </div>
  );
}
