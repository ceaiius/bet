import { NavLink, useRouteLoaderData } from "react-router";
import type { Sport } from "~/data/sports";
import type { loader as shellLoader } from "~/routes/_shell";
import { formatCount } from "~/lib/format";

/**
 * ---------------------------------------------------------------------------
 * <Sidebar />
 * ---------------------------------------------------------------------------
 * Two ways to consume parent-route data:
 *
 *   A) Receive it as a prop from the parent component (the shell passes it
 *      down explicitly). Pros: zero coupling to route IDs, refactor-friendly.
 *      Cons: every intermediate layout has to thread the prop through.
 *
 *   B) Call `useRouteLoaderData("routes/_shell")` directly anywhere in the
 *      descendant tree. Pros: decoupled, drops into deeply-nested components
 *      without prop-drilling. Cons: couples the component to a specific
 *      route ID string.
 *
 * You'll see both in real codebases. Rule of thumb:
 *   - If the component is only ever used under ONE parent route → prop.
 *   - If it's a shared widget that might render anywhere → useRouteLoaderData.
 *
 * The Sidebar is arguably the second case (rendered by the shell only, but
 * it's "the global nav"). We accept a prop for simplicity, AND show the
 * hook pattern below for reference.
 * ---------------------------------------------------------------------------
 */

type Props = {
  /** Prefer this when possible — no route-ID coupling. */
  sports?: Sport[];
};

export function Sidebar({ sports: sportsProp }: Props) {
  /**
   * Typed `useRouteLoaderData`:
   *   - The string arg is the route ID. React Router framework mode derives
   *     it from the file path inside `app/`, minus extension. So
   *     `app/routes/_shell.tsx` → `"routes/_shell"`.
   *   - The generic `<typeof shellLoader>` makes the return type match the
   *     loader's. Without it, you'd get `unknown`.
   *   - It returns `undefined` if this route isn't in the matched tree.
   *     Handle that by falling back to the prop.
   */
  const shellData = useRouteLoaderData<typeof shellLoader>("routes/_shell");
  const sports = sportsProp ?? shellData?.sports ?? [];

  return (
    <aside className="hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-white/10 bg-gray-950/50 md:block">
      <div className="px-3 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        Sports
      </div>

      {sports.length === 0 ? (
        <div className="px-3 text-xs text-gray-500">No sports loaded.</div>
      ) : (
        <ul className="flex flex-col gap-0.5 px-2 pb-4">
          {sports.map((sport) => (
            <li key={sport.slug}>
              <NavLink
                to={`/sports/${sport.slug}`}
                prefetch="intent"
                className={({ isActive }) =>
                  [
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "text-gray-300 hover:bg-white/5 hover:text-white",
                  ].join(" ")
                }
              >
                {({ isPending }) => (
                  <>
                    <span className="text-base leading-none">{sport.icon}</span>
                    <span className="flex-1">{sport.name}</span>
                    {isPending ? (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    ) : (
                      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                        {formatCount(sport.liveCount)}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
