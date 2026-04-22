import { Link, useRouteLoaderData } from "react-router";
import type { Route } from "./+types/sports._index";
import type { loader as shellLoader } from "~/routes/_shell";
import { formatCount } from "~/lib/format";

/**
 * ===========================================================================
 * /sports  —  the "don't refetch" pattern
 * ===========================================================================
 * This route HAS NO LOADER. It reuses the shell's loader data via
 * `useRouteLoaderData("routes/_shell")`.
 *
 * Why: the shell route is always matched (it's the pathless layout wrapping
 * us). Its loader has already fetched the full sports catalog. Fetching it
 * again here would be wasteful.
 *
 * Senior-level insight:
 *   - React Router matches a tree of routes on each navigation.
 *   - ALL matched routes' loaders run in PARALLEL by default.
 *   - A child route can skip having its own loader entirely if parent data
 *     is sufficient — that's the most efficient case.
 *   - If the child DOES need its own data, RR still parallelizes parent +
 *     child loaders (no waterfall), which is the whole point of loaders
 *     being colocated at the route level vs fired from useEffect.
 * ===========================================================================
 */

export function meta({}: Route.MetaArgs) {
  return [{ title: "All sports — BetLab" }];
}

export default function SportsIndex() {
  const shell = useRouteLoaderData<typeof shellLoader>("routes/_shell");
  const sports = shell?.sports ?? [];

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-bold">All sports</h1>
      <p className="mt-2 text-gray-400">
        This route has <strong>no loader</strong> of its own. It reads from
        the shell's loader via <code>useRouteLoaderData</code>.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sports.map((s) => (
          <li key={s.slug}>
            <Link
              to={`/sports/${s.slug}`}
              prefetch="intent"
              className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-4 transition hover:border-emerald-400/40 hover:bg-white/10"
            >
              <span className="text-2xl">{s.icon}</span>
              <div className="flex-1">
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-gray-400">
                  {formatCount(s.liveCount)} live now
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
