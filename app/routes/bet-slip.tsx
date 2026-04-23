import { data, redirect } from "react-router";
import type { Route } from "./+types/bet-slip";

import { getUserId } from "~/lib/auth.server";
import {
  addToRefs,
  commitBetSlipRefs,
  getBetSlip,
  placeBet,
  readRawCookie,
  removeFromRefs,
} from "~/lib/bet-slip.server";
import {
  calculateParlayOdds,
  calculatePotentialReturn,
  isBetSlipIntent,
  MAX_SLIP_ITEMS,
  MAX_STAKE,
  MIN_STAKE,
  type BetSlipRef,
} from "~/lib/bet-slip";

/**
 * ===========================================================================
 * /bet-slip  —  an ACTION-ONLY route ("resource route" style)
 * ===========================================================================
 * This route has an `action` but no useful component. All bet slip mutations
 * from anywhere in the app post here via `<fetcher.Form action="/bet-slip">`.
 *
 * Key ideas introduced this phase:
 *
 *   1. `action({ request })`
 *      Runs on the server (like a loader) but in response to non-GET HTTP
 *      methods — typically POST. Return values are available to the UI via
 *      `fetcher.data` or `useActionData()`.
 *
 *   2. `data(value, { status, headers })`
 *      The helper for returning body + headers from an action. Use it when
 *      you need to:
 *        - attach a `Set-Cookie` header (we do this on every mutation)
 *        - set a custom status code (e.g. 400 for validation errors)
 *
 *   3. `redirect(url, { status?, headers? })`
 *      Returns a 302. React Router follows redirects transparently. From a
 *      fetcher, a redirect causes a top-level navigation — this is the
 *      primary way an action navigates the user somewhere after success.
 *
 *   4. Automatic revalidation
 *      After this action returns, React Router re-runs EVERY matched
 *      loader in the current app. That's why the Sidebar, BetSlipPanel,
 *      and even the Header badge update with no manual "refresh".
 *
 *   5. Intent-based dispatch
 *      A hidden `<input name="intent" value="add">` in the Form tells the
 *      action which operation to perform. Cleaner than separate routes for
 *      each mutation, scales well, and pairs with a type-safe union.
 * ===========================================================================
 */

/** We don't want GET /bet-slip to render anything. Throwing a 405 keeps
 *  the route honest and teaches ErrorBoundary error bubbling to root. */
export async function loader() {
  throw new Response("Method Not Allowed", { status: 405 });
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (!isBetSlipIntent(intent)) {
    return data({ error: "Unknown intent" }, { status: 400 });
  }

  // Always start from the authoritative cookie state — not from any
  // hidden-input state the client might send. Trust nothing from the form
  // except operation instructions.
  const current = await readRawCookie(request);
  let nextRefs: BetSlipRef[] = current.refs;
  let nextStake = current.stake;

  switch (intent) {
    case "add": {
      const ref = parseRef(formData);
      if (!ref) return data({ error: "Malformed selection" }, { status: 400 });
      if (current.refs.length >= MAX_SLIP_ITEMS) {
        return data(
          { error: `Slip is full (${MAX_SLIP_ITEMS} selections max)` },
          { status: 400 }
        );
      }
      nextRefs = addToRefs(current.refs, ref);
      break;
    }

    case "remove": {
      const ref = parseRef(formData);
      if (!ref) return data({ error: "Malformed selection" }, { status: 400 });
      nextRefs = removeFromRefs(current.refs, ref);
      break;
    }

    case "setStake": {
      const raw = formData.get("stake");
      const n = Number(raw);
      if (!Number.isFinite(n) || n < MIN_STAKE || n > MAX_STAKE) {
        return data(
          { error: `Stake must be between ${MIN_STAKE} and ${MAX_STAKE}` },
          { status: 400 }
        );
      }
      nextStake = n;
      break;
    }

    case "clear": {
      nextRefs = [];
      break;
    }

    case "place": {
      // Phase 5: auth-gated mutation. If anonymous, redirect through the
      // login flow and come back. We preserve intent by sending them to
      // `/` (the referring page is usually fine); in a production app
      // you'd persist the slip ID and re-offer to place it after login.
      const userId = await getUserId(request);
      if (!userId) {
        const url = new URL(request.url);
        const redirectTo = request.headers.get("Referer") ?? "/";
        throw redirect(
          `/login?redirectTo=${encodeURIComponent(
            new URL(redirectTo, url).pathname
          )}`
        );
      }

      // Re-fetch fully enriched slip so we lock in CURRENT prices.
      const slip = await getBetSlip(request);
      if (slip.items.length === 0) {
        return data({ error: "Your slip is empty" }, { status: 400 });
      }
      if (slip.stake < MIN_STAKE) {
        return data(
          { error: `Minimum stake is ${MIN_STAKE}` },
          { status: 400 }
        );
      }
      const odds = calculateParlayOdds(slip.items);
      const potentialReturn = calculatePotentialReturn(slip.stake, odds);
      const ticket = placeBet({
        userId,
        stake: slip.stake,
        odds,
        potentialReturn,
        items: slip.items,
      });

      // Successful placement clears the slip and sets a Set-Cookie header.
      const setCookie = await commitBetSlipRefs([], slip.stake);
      // NB: We return `data` rather than `redirect` so the BetSlipPanel can
      // show a lightweight confirmation inline via `fetcher.data`. In Phase 5
      // we'll switch to `redirect("/account/bets/" + ticket.id)` once we
      // have the protected area wired up.
      return data(
        { ok: true as const, placedBetId: ticket.id, odds, potentialReturn },
        { headers: { "Set-Cookie": setCookie } }
      );
    }
  }

  // All non-"place" mutations land here: persist the new cookie and return
  // a small ok payload. The revalidation fires automatically.
  const setCookie = await commitBetSlipRefs(nextRefs, nextStake);
  return data(
    { ok: true as const },
    { headers: { "Set-Cookie": setCookie } }
  );
}

function parseRef(formData: FormData): BetSlipRef | null {
  const eventId = formData.get("eventId");
  const marketId = formData.get("marketId");
  const selectionId = formData.get("selectionId");
  if (
    typeof eventId !== "string" ||
    typeof marketId !== "string" ||
    typeof selectionId !== "string" ||
    !eventId ||
    !marketId ||
    !selectionId
  ) {
    return null;
  }
  return { eventId, marketId, selectionId };
}

/**
 * No default export.
 *
 * A route module with only `loader` and/or `action` is called a RESOURCE
 * ROUTE. React Router won't try to render it; it's a pure endpoint. The
 * canonical use cases:
 *   - Non-HTML responses (CSV, XML, images, sitemap.xml, robots.txt)
 *   - API endpoints consumed by fetchers (this route)
 *   - Webhooks (e.g. POST /webhooks/stripe)
 *
 * We cover resource routes in depth in Phase 7.
 */
