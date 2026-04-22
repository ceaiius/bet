import { Link, isRouteErrorResponse, useParams } from "react-router";
import type { Route } from "./+types/sports.$sport.$league";

import { getEventsForLeague, getLeague } from "~/data/sports";
import { EventCard } from "~/components/EventCard";

/**
 * ===========================================================================
 * /sports/:sport/:league
 * ===========================================================================
 * Loader fetches league info + its events. Runs IN PARALLEL with the
 * `sports.$sport` loader above and the `_shell` loader. RR's nested data
 * fetching is the killer feature — no `useEffect` waterfalls.
 *
 * NOTE: in Phase 1 we demoed `throw error` in the boundary to bubble up.
 * The loader below uses the simpler "just throw a 404 Response and let
 * this route's boundary handle it" approach.
 * ===========================================================================
 */

export async function loader({ params }: Route.LoaderArgs) {
  // Running in parallel vs. sequentially:
  //   const league = await getLeague(...);   ← sequential, slow
  //   const events = await getEventsForLeague(...);
  // vs.
  //   const [league, events] = await Promise.all([...]);   ← parallel
  // Use Promise.all for independent queries. Always.
  const [league, events] = await Promise.all([
    getLeague(params.sport, params.league),
    getEventsForLeague(params.sport, params.league),
  ]);

  if (!league) {
    throw new Response("League not found", { status: 404 });
  }

  return { league, events };
}

export function meta({ data, params }: Route.MetaArgs) {
  return [{ title: `${data?.league.name ?? params.league} — BetLab` }];
}

export default function LeaguePage({ loaderData }: Route.ComponentProps) {
  const { league, events } = loaderData;

  return (
    <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-5">
      <div className="text-xs uppercase tracking-wider text-emerald-300">
        {league.country}
      </div>
      <h2 className="mt-1 text-2xl font-bold">{league.name}</h2>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">
          No upcoming events in this league right now.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const params = useParams();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <div className="rounded-lg border border-red-400/20 bg-red-500/5 p-5">
        <h2 className="text-lg font-semibold text-red-300">Unknown league</h2>
        <p className="mt-1 text-sm text-gray-400">
          <code>
            /sports/{params.sport}/{params.league}
          </code>{" "}
          doesn't exist.
        </p>
        <Link
          to={`/sports/${params.sport}`}
          className="mt-4 inline-block text-sm text-emerald-300 hover:underline"
        >
          ← Back to {params.sport}
        </Link>
      </div>
    );
  }
  throw error;
}
