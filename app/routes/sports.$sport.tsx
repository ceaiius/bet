import {
  Link,
  Outlet,
  isRouteErrorResponse,
  useParams,
  useRouteLoaderData,
  type ShouldRevalidateFunctionArgs,
} from "react-router";
import type { Route } from "./+types/sports.$sport";
import type { loader as shellLoader } from "~/routes/_shell";

import { getLeaguesForSport, getSport } from "~/data/sports";

/**
 * ===========================================================================
 * /sports/:sport
 * ===========================================================================
 * New concepts in Phase 2:
 *
 *   1. Throwing a Response FROM A LOADER
 *      When the sport doesn't exist, we `throw new Response(..., {status:404})`
 *      from the loader. React Router catches it and renders THIS route's
 *      ErrorBoundary instead of the default component. The shell layout
 *      above still renders — error isolation, again.
 *
 *   2. `shouldRevalidate`
 *      Export a function that returns `true/false`. React Router calls it
 *      to decide whether to re-run this loader on a new navigation. By
 *      default, ALL loaders revalidate on every navigation (important for
 *      mutations — Phase 3). When you know your loader's output depends
 *      only on `:sport` and nothing else, you can skip refetches when the
 *      sport didn't change.
 *
 *      Rule of thumb: use sparingly. Over-opting-out leads to stale data.
 *      The default (revalidate always) is the safer starting point.
 *
 *   3. Combining `useLoaderData` (via props) with `useRouteLoaderData`
 *      We get our own data as `loaderData` from props. We can ALSO peek at
 *      the shell's sports list to render a nicer header, with no extra fetch.
 * ===========================================================================
 */

export async function loader({ params }: Route.LoaderArgs) {
  // `params.sport` is typed as `string` automatically thanks to `route(":sport")`.
  const [sport, leagues] = await Promise.all([
    getSport(params.sport),
    getLeaguesForSport(params.sport),
  ]);

  if (!sport) {
    // Throwing `new Response` is the idiomatic way to signal a routing error
    // from a loader. The ErrorBoundary below catches it via isRouteErrorResponse.
    throw new Response("Sport not found", { status: 404 });
  }

  return { sport, leagues };
}

/**
 * `shouldRevalidate` receives:
 *   - currentParams / nextParams
 *   - currentUrl / nextUrl
 *   - defaultShouldRevalidate (the answer RR would give)
 *   - formAction / actionResult / actionStatus (for post-mutation cases)
 *
 * We return `true` to revalidate, `false` to skip.
 */
export function shouldRevalidate({
  currentParams,
  nextParams,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  // If the user navigates from /sports/football/premier-league to
  // /sports/football/la-liga, `:sport` is unchanged. Our loader output
  // doesn't depend on `:league`, so we can skip the refetch.
  if (currentParams.sport === nextParams.sport) return false;
  return defaultShouldRevalidate;
}

export function meta({ data }: Route.MetaArgs) {
  // `data` is the loader's return value (or undefined if the loader threw).
  return [{ title: `${data?.sport.name ?? "Sport"} — BetLab` }];
}

export default function SportPage({ loaderData }: Route.ComponentProps) {
  const { sport, leagues } = loaderData;

  // Peek at the shell's data for a cross-sport stat in the header — no
  // extra network call.
  const shell = useRouteLoaderData<typeof shellLoader>("routes/_shell");
  const totalLive = shell?.sports.reduce((sum, s) => sum + s.liveCount, 0);

  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{sport.icon}</span>
          <div>
            <h1 className="text-3xl font-bold">{sport.name}</h1>
            <p className="text-xs text-gray-500">
              {sport.liveCount} live in this sport
              {totalLive ? ` · ${totalLive} across all sports` : ""}
            </p>
          </div>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Leagues
      </h2>

      {leagues.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">
          No leagues configured yet for this sport.
        </p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {leagues.map((l) => (
            <li key={l.slug}>
              <Link
                to={`/sports/${sport.slug}/${l.slug}`}
                prefetch="intent"
                className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-4 py-3 transition hover:border-emerald-400/40 hover:bg-white/10"
              >
                <span className="font-medium">{l.name}</span>
                <span className="text-xs text-gray-500">{l.country}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Child route: /sports/:sport/:league */}
      <div className="mt-10">
        <Outlet />
      </div>
    </section>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const params = useParams();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-2xl font-bold text-white">Unknown sport</h1>
        <p className="mt-2 text-gray-400">
          We don't have anything under <code>/sports/{params.sport}</code>.
        </p>
        <Link
          to="/sports"
          className="mt-6 inline-block rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-emerald-400"
        >
          Back to all sports
        </Link>
      </section>
    );
  }
  return (
    <section className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-2xl font-bold text-red-400">Something went wrong</h1>
      <p className="mt-2 text-gray-400">
        An unexpected error occurred while loading this sport.
      </p>
    </section>
  );
}
