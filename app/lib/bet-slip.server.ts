import { createCookie } from "react-router";
import { getEvent } from "~/data/sports";
import {
  MAX_SLIP_ITEMS,
  type BetSlip,
  type BetSlipItem,
  type BetSlipRef,
} from "./bet-slip";

/**
 * ===========================================================================
 * bet-slip.server.ts — SERVER-ONLY module
 * ===========================================================================
 * The `.server.ts` suffix tells React Router's compiler to throw a build
 * error if any code in the browser bundle ever imports this file. It is
 * the primary tool for guaranteeing secrets and server-only deps never
 * leak to the client.
 *
 * Contents:
 *   - `betSlipCookie`  : a signed cookie storing only BetSlipRef[] + stake
 *   - `getBetSlip(req)`: reads cookie, enriches refs into full items
 *   - `commitBetSlip(slip)`: serializes state back to a Set-Cookie header
 *   - `addToSlip` / `removeFromSlip` / `setStake` / `clearSlip` : pure helpers
 *   - `placeBet(...)` + `PLACED_BETS` : demo in-memory "database" of tickets
 * ===========================================================================
 */

/**
 * `createCookie` creates a small, serializable cookie primitive.
 *
 * Options worth knowing:
 *   - httpOnly  : JS on the page cannot read it (defeats XSS exfiltration).
 *   - sameSite  : "lax" is the modern default; blocks most CSRF.
 *   - secure    : cookie only sent over HTTPS in prod. Auto-disabled in dev.
 *   - maxAge    : seconds; if omitted, the cookie is a "session" cookie.
 *   - secrets   : rotatable signing keys. First is used to sign; all are
 *                 accepted for verifying old cookies.
 *
 * In Phase 5 we'll move `secrets` to `process.env.SESSION_SECRET` and add
 * a `.env` loader. For now the dev default is fine — this cookie isn't
 * security-critical (it's just the user's WIP bet slip).
 */
const betSlipCookie = createCookie("__bet_slip", {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: import.meta.env.PROD,
  maxAge: 60 * 60 * 24 * 7, // 7 days
  secrets: ["dev-only-rotate-me"],
});

/** Raw representation we actually persist. */
type CookiePayload = {
  refs: BetSlipRef[];
  stake: number;
};

const EMPTY_PAYLOAD: CookiePayload = { refs: [], stake: 10 };

/**
 * Parse the cookie. We harden against malformed/corrupt input (e.g. a user
 * rotating secrets) — if anything goes wrong, we treat it as an empty slip
 * rather than surfacing an error.
 */
async function parseCookie(request: Request): Promise<CookiePayload> {
  const header = request.headers.get("Cookie");
  try {
    const parsed = (await betSlipCookie.parse(header)) as CookiePayload | null;
    if (!parsed || !Array.isArray(parsed.refs)) return EMPTY_PAYLOAD;
    return {
      refs: parsed.refs.slice(0, MAX_SLIP_ITEMS),
      stake: Number.isFinite(parsed.stake) ? parsed.stake : EMPTY_PAYLOAD.stake,
    };
  } catch {
    return EMPTY_PAYLOAD;
  }
}

/** Serialize a payload into a Set-Cookie header string. */
async function serializeCookie(payload: CookiePayload): Promise<string> {
  return betSlipCookie.serialize(payload);
}

// ----------------------------------------------------------------------------
// Public helpers — used by the /bet-slip action and the _shell loader.
// ----------------------------------------------------------------------------

/**
 * Read the slip from the request cookie AND enrich it with live event data.
 * Any ref whose event/market/selection no longer exists is silently dropped
 * (e.g. an event finished and was removed) — this keeps the UI self-healing.
 */
export async function getBetSlip(request: Request): Promise<BetSlip> {
  const { refs, stake } = await parseCookie(request);
  const enriched = await Promise.all(refs.map(enrichRef));
  return {
    items: enriched.filter((x): x is BetSlipItem => x !== null),
    stake,
  };
}

async function enrichRef(ref: BetSlipRef): Promise<BetSlipItem | null> {
  const event = await getEvent(ref.eventId);
  if (!event) return null;
  const market = event.markets.find((m) => m.id === ref.marketId);
  if (!market) return null;
  const selection = market.selections.find((s) => s.id === ref.selectionId);
  if (!selection) return null;
  return {
    ...ref,
    eventLabel: `${event.homeTeam} vs ${event.awayTeam}`,
    marketName: market.name,
    selectionLabel: selection.label,
    price: selection.price,
  };
}

/** Produces a Set-Cookie header value that the action attaches to its
 *  Response. Loaders don't need to call this — they only READ the cookie. */
export async function commitBetSlipRefs(
  refs: BetSlipRef[],
  stake: number
): Promise<string> {
  return serializeCookie({ refs, stake });
}

// ----------------------------------------------------------------------------
// Pure mutators (work on CookiePayload only; no request/response concerns).
// ----------------------------------------------------------------------------

export function addToRefs(refs: BetSlipRef[], ref: BetSlipRef): BetSlipRef[] {
  // one selection per event+market (replaces existing).
  const withoutSame = refs.filter(
    (r) => !(r.eventId === ref.eventId && r.marketId === ref.marketId)
  );
  if (withoutSame.length >= MAX_SLIP_ITEMS) {
    // caller should surface this via a validation error, but we also guard.
    return withoutSame;
  }
  return [...withoutSame, ref];
}

export function removeFromRefs(refs: BetSlipRef[], ref: BetSlipRef): BetSlipRef[] {
  return refs.filter(
    (r) =>
      !(
        r.eventId === ref.eventId &&
        r.marketId === ref.marketId &&
        r.selectionId === ref.selectionId
      )
  );
}

export async function readRawCookie(request: Request) {
  return parseCookie(request);
}

// ----------------------------------------------------------------------------
// Placed-bet tickets — in-memory demo DB.
// In a real app this is a SQL insert + maybe a Kafka produce.
// ----------------------------------------------------------------------------

export type PlacedBet = {
  id: string;
  userId: string; // Phase 5: tie each ticket to its owner
  placedAt: string;
  stake: number;
  odds: number; // locked at placement
  potentialReturn: number;
  items: BetSlipItem[];
};

/** Module-level Map works for a single-node dev server. In production you
 *  would swap this for a real datastore. */
const PLACED_BETS = new Map<string, PlacedBet>();

export function placeBet(input: Omit<PlacedBet, "id" | "placedAt">): PlacedBet {
  const id = `bet_${Math.random().toString(36).slice(2, 10)}`;
  const placedAt = new Date().toISOString();
  const ticket: PlacedBet = { id, placedAt, ...input };
  PLACED_BETS.set(id, ticket);
  return ticket;
}

/** Return all bets for a specific user, newest first. */
export function listPlacedBetsForUser(userId: string): PlacedBet[] {
  return [...PLACED_BETS.values()]
    .filter((b) => b.userId === userId)
    .sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt));
}
