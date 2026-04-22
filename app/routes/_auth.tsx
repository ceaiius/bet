import { Link, Outlet } from "react-router";

/**
 * Pathless layout for auth pages (/login, /register).
 *
 * This layout INTENTIONALLY doesn't render the Header/Sidebar — it's a
 * stripped-down, focused experience. It shows that different sections of
 * the app can use totally different shells.
 *
 * In Phase 5 this layout will also:
 *   - Add a `loader` that reads the session cookie
 *   - Redirect to `/` if the user is already logged in
 */
export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 py-12">
        <Link
          to="/"
          className="text-lg font-bold tracking-tight text-emerald-400"
        >
          ⚡ BetLab
        </Link>
        <div className="w-full rounded-xl border border-white/10 bg-white/5 p-6">
          <Outlet />
        </div>
        <Link to="/" className="text-xs text-gray-500 hover:text-gray-300">
          ← back to app
        </Link>
      </div>
    </div>
  );
}
