import { Form, Link, NavLink } from "react-router";
import type { PublicUser } from "~/lib/users.server";

/**
 * ---------------------------------------------------------------------------
 * <Header />
 * ---------------------------------------------------------------------------
 * Phase 3: bet slip count badge.
 * Phase 5: logged-in user avatar + logout <Form>. Uses <Form method="post">
 *          to /logout rather than a <Link> — destructive action, see
 *          routes/logout.tsx for the reasoning.
 * ---------------------------------------------------------------------------
 */

type Props = {
  betSlipCount?: number;
  user?: PublicUser | null;
};

export function Header({ betSlipCount = 0, user }: Props) {
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

          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function UserMenu({ user }: { user: PublicUser }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        to="/account"
        prefetch="intent"
        className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 hover:bg-white/10"
      >
        <span
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-gray-950"
        >
          {user.displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="text-gray-200">{user.displayName}</span>
        <span className="ml-1 font-mono text-xs text-emerald-300">
          ${user.balance.toFixed(0)}
        </span>
      </Link>
      <Form action="/logout" method="post">
        <button
          type="submit"
          className="rounded-md px-2 py-1.5 text-gray-400 hover:text-white"
          title="Log out"
        >
          ↩
        </button>
      </Form>
    </div>
  );
}
