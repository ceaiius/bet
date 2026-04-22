/**
 * ===========================================================================
 * Shared bet-slip types and pure math
 * ===========================================================================
 * IMPORTANT: this file is safe to import from BOTH client and server code.
 * Anything that requires server-only primitives (cookies, secrets, DB) goes
 * into `bet-slip.server.ts` — the `.server.ts` suffix is a convention that
 * tells the React Router compiler to refuse any client import of the file.
 * It's your safety net against accidentally shipping secrets.
 * ===========================================================================
 */

/** The MINIMAL representation persisted in the cookie. We only store
 *  references, never prices — because odds change and we want the latest. */
export type BetSlipRef = {
  eventId: string;
  marketId: string;
  selectionId: string;
};

/** The ENRICHED representation the UI consumes. Built server-side by
 *  joining `BetSlipRef`s with the live events data. */
export type BetSlipItem = BetSlipRef & {
  eventLabel: string;     // "Arsenal vs Chelsea"
  marketName: string;     // "Match Result"
  selectionLabel: string; // "Home"
  price: number;          // current decimal odds
};

export type BetSlip = {
  items: BetSlipItem[];
  stake: number; // total stake for the parlay (single combined bet)
};

/** Parlay semantics: multiply every selection's odds together.
 *  Empty slip → 0 (signals "no bet"). */
export function calculateParlayOdds(items: BetSlipItem[]): number {
  if (items.length === 0) return 0;
  return items.reduce((acc, it) => acc * it.price, 1);
}

export function calculatePotentialReturn(stake: number, odds: number): number {
  if (!stake || stake <= 0 || !odds) return 0;
  return stake * odds;
}

/** UX limits. The action validates against these too — never trust clients. */
export const MAX_SLIP_ITEMS = 10;
export const MIN_STAKE = 1;
export const MAX_STAKE = 10_000;

/** The set of actions the /bet-slip route understands. The formData must
 *  include an `intent` equal to one of these. Using a string-literal union
 *  gives us exhaustive `switch` checking — miss a case, TS errors. */
export const BET_SLIP_INTENTS = [
  "add",
  "remove",
  "setStake",
  "clear",
  "place",
] as const;

export type BetSlipIntent = (typeof BET_SLIP_INTENTS)[number];

export function isBetSlipIntent(x: unknown): x is BetSlipIntent {
  return typeof x === "string" && (BET_SLIP_INTENTS as readonly string[]).includes(x);
}

/** Given a BetSlipRef and the current slip, is this selection already in it? */
export function isInSlip(slip: BetSlip, ref: BetSlipRef): boolean {
  return slip.items.some(
    (it) =>
      it.eventId === ref.eventId &&
      it.marketId === ref.marketId &&
      it.selectionId === ref.selectionId
  );
}
