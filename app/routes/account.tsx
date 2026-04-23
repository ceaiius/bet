import { Form, Link } from "react-router";
import type { Route } from "./+types/account";

import { requireUser } from "~/lib/auth.server";
import { listPlacedBetsForUser } from "~/lib/bet-slip.server";
import { formatOdds } from "~/lib/format";

/**
 * ===========================================================================
 * /account  —  protected route (Phase 5)
 * ===========================================================================
 * `requireUser` throws a redirect if there's no session, so by the time
 * this loader returns, `user` is guaranteed non-null. That's the whole
 * point: keep the auth check at the FRAMEWORK layer, not sprinkled inside
 * components with conditional renders.
 *
 * This page also exists to demonstrate per-user data scoping. The
 * `listPlacedBetsForUser(user.id)` call replaces the Phase 3 global
 * `listPlacedBets()` — two different users now see two different
 * histories.
 * ===========================================================================
 */

export function meta({}: Route.MetaArgs) {
  return [{ title: "Account — BetLab" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const bets = listPlacedBetsForUser(user.id);
  return { user, bets };
}

export default function Account({ loaderData }: Route.ComponentProps) {
  const { user, bets } = loaderData;

  return (
    <section className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{user.displayName}</h1>
          <p className="mt-1 text-sm text-gray-400">{user.email}</p>
        </div>

        {/* Logout is a <Form action="/logout" method="post"> — see the
            comments in routes/logout.tsx for why POST. */}
        <Form action="/logout" method="post">
          <button
            type="submit"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
          >
            Log out
          </button>
        </Form>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Stat label="Balance" value={`$${user.balance.toFixed(2)}`} />
        <Stat
          label="Bets placed"
          value={String(bets.length)}
          caption="All time"
        />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Bet history
      </h2>

      {bets.length === 0 ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-6 text-sm text-gray-400">
          No bets yet.{" "}
          <Link to="/" className="text-emerald-300 hover:underline">
            Find some action
          </Link>
          .
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {bets.map((bet) => (
            <li
              key={bet.id}
              className="rounded-lg border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-xs text-gray-400">
                    {bet.id}
                  </div>
                  <div className="mt-1 text-sm text-gray-300">
                    {new Date(bet.placedAt).toLocaleString("en-US", {
                      timeZone: "UTC",
                    })}{" "}
                    UTC
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold text-white">
                    ${bet.stake.toFixed(2)} @ {formatOdds(bet.odds)}
                  </div>
                  <div className="text-emerald-300">
                    returns ${bet.potentialReturn.toFixed(2)}
                  </div>
                </div>
              </div>
              <ul className="mt-3 space-y-1 border-t border-white/10 pt-3 text-xs text-gray-300">
                {bet.items.map((it) => (
                  <li
                    key={`${it.eventId}.${it.marketId}.${it.selectionId}`}
                    className="flex justify-between gap-2"
                  >
                    <span className="truncate">
                      <span className="text-gray-500">{it.marketName}:</span>{" "}
                      {it.selectionLabel} — {it.eventLabel}
                    </span>
                    <span className="font-mono">{formatOdds(it.price)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold text-white">
        {value}
      </div>
      {caption && <div className="mt-1 text-xs text-gray-400">{caption}</div>}
    </div>
  );
}
