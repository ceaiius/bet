import {
  Outlet,
  data,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import type { Route } from "./+types/_shell";

import { Header } from "~/components/Header";
import { Sidebar } from "~/components/Sidebar";
import { BetSlipPanel } from "~/components/BetSlipPanel";
import { FlashToast } from "~/components/FlashToast";
import { getAllSports } from "~/data/sports";
import { getBetSlip } from "~/lib/bet-slip.server";
import { consumeFlash, getUser } from "~/lib/auth.server";

/**
 * ===========================================================================
 * _shell.tsx — pathless layout. Loader aggregates shell-wide data.
 * ===========================================================================
 *
 * The shell loader is now the single source of:
 *   - The sports catalog (for the Sidebar)
 *   - The current bet slip (for BetSlipPanel + Header badge)
 *   - The logged-in user  (Phase 5 — for Header state)
 *   - A consumed flash message (Phase 5 — shown as a toast after login etc.)
 *
 * Notice we run the four data reads in PARALLEL with `Promise.all`. None
 * of them depend on each other, so there's no reason to waterfall.
 *
 * Because `consumeFlash` REMOVES the message from the session, we must
 * attach its `Set-Cookie` header to this loader's response. That's why we
 * use `data(...)` here rather than returning a plain object.
 * ===========================================================================
 */

export async function loader({ request }: Route.LoaderArgs) {
  const [sports, betSlip, user, flash] = await Promise.all([
    getAllSports(),
    getBetSlip(request),
    getUser(request),
    consumeFlash(request),
  ]);

  const payload = { sports, betSlip, user, flash: flash.message };

  // Attach Set-Cookie ONLY if we actually consumed a flash. Otherwise the
  // Vary/cache story is cleaner (no header = cacheable where possible).
  if (flash.setCookieHeader) {
    return data(payload, {
      headers: { "Set-Cookie": flash.setCookieHeader },
    });
  }
  return data(payload);
}

/**
 * Phase 4 optimization: skip re-fetching the whole shell when a child
 * route triggers `useRevalidator()` purely for polling.
 *
 * Rule:
 *   - Pathname changed         → revalidate (sport/league highlight updates)
 *   - Any form method          → revalidate (action may have affected slip/user)
 *   - Pure poll (same path)    → skip
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate;
  if (formMethod) return defaultShouldRevalidate;
  return false;
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  const { sports, betSlip, user, flash } = loaderData;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header betSlipCount={betSlip.items.length} user={user} />
      <div className="flex">
        <Sidebar sports={sports} />
        <main className="min-h-[calc(100vh-3.5rem)] flex-1 overflow-x-hidden">
          <Outlet />
        </main>
        <BetSlipPanel slip={betSlip} />
      </div>
      {/* Flash toast mounts when a flash message arrives; auto-dismisses. */}
      {flash && <FlashToast key={flash} message={flash} />}
    </div>
  );
}
