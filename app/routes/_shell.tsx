import { Outlet } from "react-router";
import type { Route } from "./+types/_shell";

import { Header } from "~/components/Header";
import { Sidebar } from "~/components/Sidebar";
import { BetSlipPanel } from "~/components/BetSlipPanel";
import { getAllSports } from "~/data/sports";
import { getBetSlip } from "~/lib/bet-slip.server";

/**
 * ===========================================================================
 * _shell.tsx — pathless layout. Loader now returns sports + bet slip.
 * ===========================================================================
 * Why put the bet slip on the SHELL's loader?
 *   - Every page lives inside the shell → every page can read the slip for
 *     free via `useRouteLoaderData("routes/_shell")` (no extra fetch).
 *   - After any /bet-slip action, RR auto-revalidates this loader. One
 *     source of truth, zero manual cache invalidation on the client.
 *
 * Parallel fetch via `Promise.all`: the sports catalog and the slip have no
 * dependency on each other, so we fan out both queries at once.
 * ===========================================================================
 */

export async function loader({ request }: Route.LoaderArgs) {
  const [sports, betSlip] = await Promise.all([
    getAllSports(),
    getBetSlip(request),
  ]);
  return { sports, betSlip };
}

export default function Shell({ loaderData }: Route.ComponentProps) {
  const { sports, betSlip } = loaderData;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <Header betSlipCount={betSlip.items.length} />
      <div className="flex">
        <Sidebar sports={sports} />
        <main className="min-h-[calc(100vh-3.5rem)] flex-1 overflow-x-hidden">
          <Outlet />
        </main>
        <BetSlipPanel slip={betSlip} />
      </div>
    </div>
  );
}
