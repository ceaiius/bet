import {
  Link,
  isRouteErrorResponse,
  useFetcher,
  useParams,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/events.$eventId";

import { getEvent, getLeague, getSport, type Selection } from "~/data/sports";
import type { loader as shellLoader } from "~/routes/_shell";
import { isInSlip } from "~/lib/bet-slip";
import { formatKickoff, formatOdds } from "~/lib/format";

/**
 * /events/:eventId
 *
 * Phase 2: loader + ErrorBoundary.
 * Phase 3: odds buttons become <fetcher.Form> posts — same pattern as EventCard.
 */

export async function loader({ params }: Route.LoaderArgs) {
  const event = await getEvent(params.eventId);
  if (!event) {
    throw new Response("Event not found", { status: 404 });
  }
  const [sport, league] = await Promise.all([
    getSport(event.sportSlug),
    getLeague(event.sportSlug, event.leagueSlug),
  ]);

  return { event, sport, league };
}

export function headers(_args: Route.HeadersArgs) {
  return { "Cache-Control": "no-store" };
}

export function meta({ data }: Route.MetaArgs) {
  if (!data) return [{ title: "Event — BetLab" }];
  const { event } = data;
  return [
    { title: `${event.homeTeam} vs ${event.awayTeam} — BetLab` },
    {
      name: "description",
      content: `Odds for ${event.homeTeam} vs ${event.awayTeam}.`,
    },
  ];
}

export default function EventPage({ loaderData }: Route.ComponentProps) {
  const { event, sport, league } = loaderData;
  const market = event.markets[0];

  const shell = useRouteLoaderData<typeof shellLoader>("routes/_shell");
  const slip = shell?.betSlip ?? { items: [], stake: 10 };

  return (
    <section className="mx-auto max-w-3xl px-6 py-10">
      <div className="text-xs uppercase tracking-wider text-gray-500">
        {sport?.name} · {league?.name}
      </div>

      <h1 className="mt-1 text-3xl font-bold">
        {event.homeTeam} <span className="text-gray-500">vs</span>{" "}
        {event.awayTeam}
      </h1>
      <div className="mt-1 text-sm text-gray-400">
        Kickoff:{" "}
        <time dateTime={event.startsAt}>{formatKickoff(event.startsAt)}</time>
      </div>

      {market && (
        <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-semibold text-gray-300">{market.name}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {market.selections.map((sel) => (
              <OddsButton
                key={sel.id}
                eventId={event.id}
                marketId={market.id}
                selection={sel}
                alreadyInSlip={isInSlip(slip, {
                  eventId: event.id,
                  marketId: market.id,
                  selectionId: sel.id,
                })}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Each button is its own `useFetcher()` — click two quickly to
            see independent pending states.
          </p>
        </div>
      )}
    </section>
  );
}

function OddsButton({
  eventId,
  marketId,
  selection,
  alreadyInSlip,
}: {
  eventId: string;
  marketId: string;
  selection: Selection;
  alreadyInSlip: boolean;
}) {
  const fetcher = useFetcher();
  const submitting = fetcher.state !== "idle";
  const intent = alreadyInSlip ? "remove" : "add";
  const optimisticInSlip = submitting
    ? fetcher.formData?.get("intent") === "add"
    : alreadyInSlip;

  return (
    <fetcher.Form method="post" action="/bet-slip">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="marketId" value={marketId} />
      <input type="hidden" name="selectionId" value={selection.id} />
      <button
        type="submit"
        disabled={!selection.price}
        aria-pressed={optimisticInSlip}
        className={[
          "flex w-full flex-col items-center rounded-md border px-2 py-3 transition",
          "disabled:cursor-not-allowed disabled:text-gray-600",
          optimisticInSlip
            ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
            : "border-white/10 bg-white/5 enabled:hover:border-emerald-400/50 enabled:hover:bg-emerald-500/10 enabled:hover:text-emerald-300",
          submitting ? "animate-pulse" : "",
        ].join(" ")}
      >
        <span className="text-[10px] uppercase tracking-wider text-gray-400">
          {selection.label}
        </span>
        <span className="mt-1 font-mono text-lg font-semibold">
          {formatOdds(selection.price)}
        </span>
      </button>
    </fetcher.Form>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const params = useParams();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-2xl font-bold text-white">Event not found</h1>
        <p className="mt-2 text-gray-400">
          No event with id <code>{params.eventId}</code>.
        </p>
        <Link
          to="/sports"
          className="mt-6 inline-block rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-emerald-400"
        >
          Browse sports
        </Link>
      </section>
    );
  }
  throw error;
}
