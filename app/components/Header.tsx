import { Link, NavLink } from "react-router";

/**
 * ---------------------------------------------------------------------------
 * <Header />
 * ---------------------------------------------------------------------------
 * Phase 3 additions:
 *   - A bet slip count badge. We receive it as a prop from the shell because
 *     the count is just `betSlip.items.length` — threading it down is less
 *     coupling than having the header reach into route data itself.
 * ---------------------------------------------------------------------------
 */

type Props = {
  betSlipCount?: number;
};

export function Header({ betSlipCount = 0 }: Props) {
  return (
    <header className="sticky top-0 z-20 h-14 border-b border-white/10 bg-gray-950/80 backdrop-blur">
      <div className="flex h-full items-center gap-6 px-4">
        <Link
          to="/"
          prefetch="intent"
          className="text-lg font-bold tracking-tight text-emerald-400"
        >
          ⚡ BetLab
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink
            to="/"
            end
            prefetch="intent"
            className={({ isActive, isPending }) =>
              [
                "rounded-md px-3 py-1.5 transition",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-gray-300 hover:text-white",
                isPending ? "animate-pulse" : "",
              ].join(" ")
            }
          >
            Home
          </NavLink>

          <NavLink
            to="/sports"
            prefetch="intent"
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 transition ${
                isActive ? "bg-white/10 text-white" : "text-gray-300 hover:text-white"
              }`
            }
          >
            Sports
          </NavLink>

          <NavLink
            to="/live"
            prefetch="intent"
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 transition ${
                isActive ? "bg-white/10 text-white" : "text-gray-300 hover:text-white"
              }`
            }
          >
            Live
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2 text-sm">
          {betSlipCount > 0 && (
            <span
              aria-label={`${betSlipCount} selection${betSlipCount === 1 ? "" : "s"} in bet slip`}
              className="flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-xs font-bold text-gray-950"
            >
              {betSlipCount}
            </span>
          )}
          <Link
            to="/login"
            className="rounded-md px-3 py-1.5 text-gray-300 hover:text-white"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="rounded-md bg-emerald-500 px-3 py-1.5 font-medium text-gray-950 hover:bg-emerald-400"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}
