import { useEffect, useRef, useState } from "react";
import { Link, useFetcher, useRouteLoaderData } from "react-router";
import type { Event, Selection } from "~/data/sports";
import type { loader as shellLoader } from "~/routes/_shell";
import { isInSlip } from "~/lib/bet-slip";
import { formatOdds } from "~/lib/format";

/**
 * <LiveEventCard />
 *
 * Two things this component adds on top of EventCard:
 *
 *   1. A "LIVE" badge and pulse indicator.
 *   2. Per-selection "price flash" — when a price changes between polls,
 *      the UI flashes green (up) or red (down) for ~800ms.
 *
 * The diffing trick: keep a ref of the last-seen prices keyed by
 * `"marketId.selectionId"`. On every render, compare current to ref —
 * if different, add to a short-lived "flash" set. Use a timeout to
 * clear flash entries so the animation stops.
 */
export function LiveEventCard({ event }: { event: Event }) {
  const market = event.markets[0];
  const shell = useRouteLoaderData<typeof shellLoader>("routes/_shell");
  const slip = shell?.betSlip ?? { items: [], stake: 10 };

  const previousPrices = useRef<Map<string, number>>(new Map());
  const [flash, setFlash] = useState<Map<string, "up" | "down">>(new Map());

  useEffect(() => {
    if (!market) return;
    const newFlash = new Map<string, "up" | "down">();
    for (const sel of market.selections) {
      const key = `${market.id}.${sel.id}`;
      const prev = previousPrices.current.get(key);
      if (prev !== undefined && prev !== sel.price) {
        newFlash.set(key, sel.price > prev ? "up" : "down");
      }
      previousPrices.current.set(key, sel.price);
    }
    if (newFlash.size > 0) {
      setFlash((prev) => new Map([...prev, ...newFlash]));
      const t = setTimeout(() => {
        setFlash((prev) => {
          const next = new Map(prev);
          for (const k of newFlash.keys()) next.delete(k);
          return next;
        });
      }, 900);
      return () => clearTimeout(t);
    }
    // We want this effect to run on every render triggered by new loader
    // data. The market.selections prices are our signal of "new data came in".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market?.selections.map((s) => s.price).join(",")]);

  return (
    <article className="rounded-lg border border-white/10 bg-white/5 transition hover:border-emerald-400/30">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-red-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
          LIVE
        </span>
        <span className="truncate text-gray-400">
          {event.leagueSlug.replace(/-/g, " ")}
        </span>
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
          {market.selections.map((sel) => {
            const key = `${market.id}.${sel.id}`;
            return (
              <LiveOddsButton
                key={sel.id}
                eventId={event.id}
                marketId={market.id}
                selection={sel}
                alreadyInSlip={isInSlip(slip, {
                  eventId: event.id,
                  marketId: market.id,
                  selectionId: sel.id,
                })}
                flash={flash.get(key)}
              />
            );
          })}
        </div>
      )}
    </article>
  );
}

function LiveOddsButton({
  eventId,
  marketId,
  selection,
  alreadyInSlip,
  flash,
}: {
  eventId: string;
  marketId: string;
  selection: Selection;
  alreadyInSlip: boolean;
  flash?: "up" | "down";
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
          "flex w-full flex-col items-center rounded-md px-2 py-1.5 text-xs transition",
          "disabled:cursor-not-allowed disabled:text-gray-600",
          optimisticInSlip
            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-inset ring-emerald-400/40"
            : "enabled:hover:bg-emerald-500/10 enabled:hover:text-emerald-300",
          flash === "up" ? "animate-[price-flash-up_0.9s_ease-out]" : "",
          flash === "down" ? "animate-[price-flash-down_0.9s_ease-out]" : "",
          submitting ? "opacity-60" : "",
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
