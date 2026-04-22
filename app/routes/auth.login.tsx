import { Link } from "react-router";
import type { Route } from "./+types/auth.login";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Log in — BetLab" }];
}

/**
 * Login page — visual only in Phase 1.
 * Full implementation (action, session cookies, redirects) is Phase 5.
 */
export default function Login() {
  return (
    <div>
      <h1 className="text-xl font-bold">Log in</h1>
      <p className="mt-1 text-sm text-gray-400">
        We'll wire up the <code>action</code> and session cookies in Phase 5.
      </p>

      <form className="mt-6 flex flex-col gap-3 opacity-60" aria-disabled>
        <input
          type="email"
          placeholder="you@example.com"
          disabled
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
        />
        <input
          type="password"
          placeholder="password"
          disabled
          className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled
          className="cursor-not-allowed rounded-md bg-emerald-500/40 px-3 py-2 text-sm font-medium text-gray-950"
        >
          (disabled until Phase 5)
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-400">
        No account?{" "}
        <Link to="/register" className="text-emerald-300 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
