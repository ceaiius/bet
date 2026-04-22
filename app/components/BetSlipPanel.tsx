import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import {
  calculateParlayOdds,
  calculatePotentialReturn,
  type BetSlip,
  type BetSlipItem,
} from "~/lib/bet-slip";
import { formatOdds } from "~/lib/format";

/**
 * ===========================================================================
 * <BetSlipPanel /> — the real deal in Phase 3.
 * ===========================================================================
 * Every mutation uses `useFetcher()` + `<fetcher.Form action="/bet-slip">`.
 * Why not plain `<Form>`?
 *
 *   <Form>          : causes a PAGE NAVIGATION. Use when you want the URL
 *                     to change (login → redirect home, place order → go
 *                     to confirmation page).
 *   <fetcher.Form>  : fires the action without navigation. The URL, scroll
 *                     position, and focus all stay put. Perfect for UI bits
 *                     that mutate server state in place (bet slip, toggles,
 *                     infinite scroll appends).
 *
 * Each interactive thing here uses its OWN fetcher so their pending states
 * are independent. Click "Remove" on item 2 → only that button shows
 * "removing…"; the stake input and place-bet button stay idle.
 *
 * Optimistic UI pattern:
 *   `fetcher.state !== "idle"` → submission in flight
 *   `fetcher.formData?.get(...)` → inspect what's being submitted
 *   Show the optimistic outcome immediately, RR will reconcile when the
 *   revalidated loader data comes back.
 * ===========================================================================
 */

type Props = {
  slip: BetSlip;
};

export function BetSlipPanel({ slip }: Props) {
  // One fetcher for whole-slip ops (stake, clear, place).
  const opFetcher = useFetcher<{ ok?: true; error?: string; placedBetId?: string; odds?: number; potentialReturn?: number }>();

  const isPlacing =
    opFetcher.state !== "idle" && opFetcher.formData?.get("intent") === "place";
  const isClearing =
    opFetcher.state !== "idle" && opFetcher.formData?.get("intent") === "clear";

  // Snapshot confirmation data into a narrowed local so downstream JSX can
  // use it without non-null assertions.
  const placedData =
    opFetcher.data?.ok && opFetcher.data.placedBetId
      ? {
          placedBetId: opFetcher.data.placedBetId,
          odds: opFetcher.data.odds ?? 0,
          potentialReturn: opFetcher.data.potentialReturn ?? 0,
        }
      : null;

  // --- Optimistic slip: apply the in-flight op on top of server state ---
  // (We only optimistically "clear" here. "Remove" is optimistic inside
  // each row's own fetcher — see BetSlipRow below.)
  const optimisticItems: BetSlipItem[] = isClearing ? [] : slip.items;

  const odds = calculateParlayOdds(optimisticItems);
  const potentialReturn = calculatePotentialReturn(slip.stake, odds);

  return (
    <aside className="hidden h-[calc(100vh-3.5rem)] w-80 shrink-0 flex-col overflow-y-auto border-l border-white/10 bg-gray-950/50 xl:flex">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-white">
          Bet slip{" "}
          {optimisticItems.length > 0 && (
            <span className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-gray-400">
              {optimisticItems.length}
            </span>
          )}
        </h2>
        {optimisticItems.length > 0 && (
          <opFetcher.Form method="post" action="/bet-slip">
            <input type="hidden" name="intent" value="clear" />
            <button
              type="submit"
              disabled={isClearing}
              className="text-xs text-gray-400 hover:text-red-400 disabled:opacity-50"
            >
              {isClearing ? "Clearing…" : "Clear all"}
            </button>
          </opFetcher.Form>
        )}
      </div>

      {placedData ? (
        <PlacedConfirmation
          betId={placedData.placedBetId}
          odds={placedData.odds}
          potentialReturn={placedData.potentialReturn}
        />
      ) : optimisticItems.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <ul className="flex-1 divide-y divide-white/5">
            {optimisticItems.map((item) => (
              <BetSlipRow key={`${item.eventId}-${item.marketId}`} item={item} />
            ))}
          </ul>

          <div className="border-t border-white/10 p-4">
            <StakeInput slip={slip} />

            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between text-gray-400">
                <dt>Combined odds</dt>
                <dd className="font-mono text-white">{formatOdds(odds)}</dd>
              </div>
              <div className="flex justify-between text-gray-400">
                <dt>Potential return</dt>
                <dd className="font-mono text-emerald-300">
                  {potentialReturn ? potentialReturn.toFixed(2) : "—"}
                </dd>
              </div>
            </dl>

            {opFetcher.data?.error && (
              <p className="mt-3 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {opFetcher.data.error}
              </p>
            )}

            <opFetcher.Form method="post" action="/bet-slip" className="mt-3">
              <input type="hidden" name="intent" value="place" />
              <button
                type="submit"
                disabled={isPlacing || optimisticItems.length === 0}
                className="w-full rounded-md bg-emerald-500 py-2 text-sm font-semibold text-gray-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/40"
              >
                {isPlacing ? "Placing bet…" : `Place bet`}
              </button>
            </opFetcher.Form>
          </div>
        </>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function BetSlipRow({ item }: { item: BetSlipItem }) {
  /**
   * Each row has its own fetcher so rows can be in different states
   * independently. Classic pattern: try adding two selections fast, or
   * remove two in a row — the UI reflects each operation individually.
   */
  const rowFetcher = useFetcher<{ ok?: true; error?: string }>();
  const isRemoving = rowFetcher.state !== "idle";

  // Optimistic disappearance: while the remove is in flight, render the row
  // dimmed. If we wanted to HIDE it completely (even more optimistic), we'd
  // `return null` here. Showing a dimmed row is friendlier if the server
  // rejects the remove.
  return (
    <li
      className={[
        "px-4 py-3 text-sm transition",
        isRemoving ? "opacity-40" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-xs text-gray-400">{item.marketName}</div>
          <div className="font-medium text-white">{item.selectionLabel}</div>
          <div className="mt-0.5 text-xs text-gray-500">{item.eventLabel}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono font-semibold text-emerald-300">
            {formatOdds(item.price)}
          </span>
          <rowFetcher.Form method="post" action="/bet-slip">
            <input type="hidden" name="intent" value="remove" />
            <input type="hidden" name="eventId" value={item.eventId} />
            <input type="hidden" name="marketId" value={item.marketId} />
            <input type="hidden" name="selectionId" value={item.selectionId} />
            <button
              type="submit"
              disabled={isRemoving}
              className="text-[10px] uppercase tracking-wider text-gray-500 hover:text-red-400"
            >
              {isRemoving ? "Removing" : "Remove"}
            </button>
          </rowFetcher.Form>
        </div>
      </div>
      {rowFetcher.data?.error && (
        <p className="mt-1 text-[10px] text-red-400">{rowFetcher.data.error}</p>
      )}
    </li>
  );
}

function StakeInput({ slip }: { slip: BetSlip }) {
  /**
   * Debounced stake updater: we auto-submit the form on blur. You could
   * also wire this to an onChange debounce — the pattern is identical.
   * Fetcher's `.state` tells us when the write is in flight so the input
   * can show a subtle indicator.
   */
  const stakeFetcher = useFetcher<{ ok?: true; error?: string }>();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSaving = stakeFetcher.state !== "idle";

  // If server corrects the stake (e.g. clamps it), sync the input.
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = String(slip.stake);
    }
  }, [slip.stake]);

  return (
    <stakeFetcher.Form method="post" action="/bet-slip" ref={formRef}>
      <input type="hidden" name="intent" value="setStake" />
      <label className="block text-xs font-medium text-gray-400">Stake</label>
      <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3">
        <span className="text-gray-500">$</span>
        <input
          ref={inputRef}
          name="stake"
          type="number"
          min={1}
          step={1}
          defaultValue={slip.stake}
          onBlur={() => formRef.current?.requestSubmit()}
          className="w-full bg-transparent py-1.5 text-sm text-white outline-none"
        />
        {isSaving && (
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        )}
      </div>
    </stakeFetcher.Form>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="text-3xl">🧾</div>
      <p className="text-sm text-gray-400">Your bet slip is empty.</p>
      <p className="text-xs text-gray-500">
        Click any price on an event to add a selection.
      </p>
    </div>
  );
}

function PlacedConfirmation({
  betId,
  odds,
  potentialReturn,
}: {
  betId: string;
  odds: number;
  potentialReturn: number;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="text-4xl">✅</div>
      <h3 className="text-base font-semibold text-white">Bet placed!</h3>
      <p className="text-xs text-gray-500">
        Ticket <code className="text-emerald-300">{betId}</code>
      </p>
      <dl className="mt-2 text-sm">
        <div className="flex justify-between gap-8">
          <dt className="text-gray-400">Odds</dt>
          <dd className="font-mono text-white">{formatOdds(odds)}</dd>
        </div>
        <div className="flex justify-between gap-8">
          <dt className="text-gray-400">Potential return</dt>
          <dd className="font-mono text-emerald-300">{potentialReturn.toFixed(2)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-gray-500">
        Phase 5 will add a real /account/bets page to list your tickets.
      </p>
    </div>
  );
}
