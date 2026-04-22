import { Link, useFetcher, useRouteLoaderData } from "react-router";
import type { Event, Selection } from "~/data/sports";
import type { loader as shellLoader } from "~/routes/_shell";
import { isInSlip } from "~/lib/bet-slip";
import { formatKickoff, formatOdds } from "~/lib/format";

/**
 * <EventCard />
 *
 * Phase 3: each odds button is a `<fetcher.Form>` that POSTs to /bet-slip.
 * The button shows three distinct visual states:
 *
 *   - default   (not in slip, not in flight)
 *   - pending   (fetcher in flight — optimistic "being added" look)
 *   - active    (currently in slip, confirmed)
 *
 * We compute "is this selection in the slip?" by peeking at the shell
 * loader's data via `useRouteLoaderData`. Because the shell loader is
 * revalidated after every /bet-slip action, this value is always fresh.
 */
export function EventCard({ event }: { event: Event }) {
  const market = event.markets[0];
  const shell = useRouteLoaderData<typeof shellLoader>("routes/_shell");
  const slip = shell?.betSlip ?? { items: [], stake: 10 };

  return (
    <article className="rounded-lg border border-white/10 bg-white/5 transition hover:border-emerald-400/30">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-gray-400">
        <span className="truncate">{event.leagueSlug.replace(/-/g, " ")}</span>
        <time dateTime={event.startsAt}>{formatKickoff(event.startsAt)}</time>
      </div>

      <Link
        to={`/events/${event.id}`}
        prefetch="intent"
        className="block px-4 py-3 hover:bg-white/5"
      >
        <div className="text-sm font-semibold text-white">{event.homeTeam}</div>
        <div className="text-sm text-gray-300">{event.awayTeam}</div>
      </Link>

      {market && (
        <div className="grid grid-cols-3 gap-1 border-t border-white/10 p-1">
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
      )}
    </article>
  );
}

/**
 * One fetcher per button. They run independently, so clicking two odds
 * buttons in quick succession produces two parallel requests with two
 * independent pending states.
 */
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

  /**
   * Optimistic state: while a submit is in flight, show what the UI WILL
   * look like when it succeeds. If we're adding, treat it as already in
   * the slip; if we're removing, treat it as not in the slip.
   */
  const optimisticInSlip = submitting
    ? fetcher.formData?.get("intent") === "add"
    : alreadyInSlip;

  const disabled = !selection.price;

  return (
    <fetcher.Form method="post" action="/bet-slip">
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="marketId" value={marketId} />
      <input type="hidden" name="selectionId" value={selection.id} />
      <button
        type="submit"
        disabled={disabled}
        aria-pressed={optimisticInSlip}
        className={[
          "flex w-full flex-col items-center rounded-md px-2 py-1.5 text-xs transition",
          "disabled:cursor-not-allowed disabled:text-gray-600",
          optimisticInSlip
            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-inset ring-emerald-400/40"
            : "enabled:hover:bg-emerald-500/10 enabled:hover:text-emerald-300",
          submitting ? "animate-pulse" : "",
        ].join(" ")}
      >
        <span className="text-[10px] uppercase tracking-wider text-gray-500">
          {selection.label}
        </span>
        <span className="mt-0.5 font-mono font-semibold">
          {formatOdds(selection.price)}
        </span>
      </button>
    </fetcher.Form>
  );
}
