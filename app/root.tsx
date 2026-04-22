import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { LoadingBar } from "~/components/LoadingBar";

/**
 * ===========================================================================
 * root.tsx — the ROOT ROUTE
 * ===========================================================================
 * Every React Router framework-mode app has a single root route that:
 *   - renders the `<html>` document (via the `Layout` export)
 *   - wraps EVERY other route with an <Outlet />
 *   - is the last line of defense for `ErrorBoundary`
 *
 * The route module "exports" you'll use here (pattern also applies to any
 * route file):
 *
 *   1. `links`             → array of `<link>` descriptors. React Router
 *                            dedupes across matched routes and renders them
 *                            through the <Links /> component below.
 *
 *   2. `meta`              → same idea for `<meta>`/`<title>`. We define meta
 *                            per-route in each file; parents' meta merges.
 *
 *   3. `Layout` (named!)   → a wrapper component that renders the <html>
 *                            shell. SPECIAL: React Router uses it for the
 *                            ErrorBoundary too, so your errors still have
 *                            a valid HTML document around them.
 *
 *   4. `default export`    → the route's main component, rendered INSIDE
 *                            `Layout`.
 *
 *   5. `ErrorBoundary`     → global fallback for any unhandled error in the
 *                            app (404s from splat, render errors, etc.).
 *
 *   6. `HydrateFallback`   → rendered during server render AND the first
 *                            client paint when the route is still hydrating
 *                            its `clientLoader`. We'll lean on it in Phase 2
 *                            for routes that have `clientLoader.hydrate`.
 *
 *   7. `loader` / `action` → data fns. Skipped in Phase 1; introduced in
 *                            Phases 2 and 3 respectively.
 * ===========================================================================
 */

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  // This function is rendered for EVERY request, including when an error is
  // thrown by any child. That's why it's separate from the default export —
  // the framework needs a reliable HTML document to render errors into.
  return (
    <html lang="en" className="dark">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* <Meta /> renders the merged `meta` export of all matched routes. */}
        <Meta />
        {/* <Links /> renders the merged `links` export of all matched routes. */}
        <Links />
      </head>
      <body className="bg-gray-950 text-gray-100 antialiased">
        {/* Global navigation/submission progress bar. Reads useNavigation,
            so it must live INSIDE the React Router tree (which <body> is). */}
        <LoadingBar />
        {children}
        {/*
          <ScrollRestoration /> restores scroll position on back/forward
          navigation. By default it uses a `location.key`-based strategy;
          you can pass `getKey` to customize (e.g. per-pathname).
        */}
        <ScrollRestoration />
        {/*
          <Scripts /> injects the hydration script + any route chunks.
          In SPA mode it still matters because RR boots the client router.
        */}
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // The default export is just a host for <Outlet />. All real UI comes from
  // child routes (the shell layout in our case).
  return <Outlet />;
}

/**
 * HydrateFallback is rendered:
 *   - on the server if the root route (or any ancestor) has a `clientLoader`
 *     marked with `.hydrate = true` and data isn't ready yet, or
 *   - during the client's first paint while that clientLoader is running.
 *
 * Keep it light and content-free of data that a clientLoader would provide.
 */
export function HydrateFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400">
      <div className="flex items-center gap-3">
        <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
        <span className="text-sm">Loading BetLab…</span>
      </div>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    // `isRouteErrorResponse` narrows the type of `error` to include `.status`
    // and `.statusText`. This is how you distinguish a thrown Response
    // (e.g. `throw new Response("...", { status: 404 })`) from a runtime
    // JS error.
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-3xl px-6 pt-24 pb-16">
      <h1 className="text-3xl font-bold">{message}</h1>
      <p className="mt-2 text-gray-400">{details}</p>
      {stack && (
        <pre className="mt-6 w-full overflow-x-auto rounded-md border border-white/10 bg-white/5 p-4 text-xs text-gray-300">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
