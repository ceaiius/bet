import { Link, useParams } from "react-router";
import type { Route } from "./+types/$";

/**
 * SPLAT (catch-all) route.
 *
 * Registered in `app/routes.ts` as `route("*", "routes/$.tsx")`. It matches
 * ANY path that no other route claimed. The matched path is available under
 * `params["*"]` (the splat key is literally `*`).
 *
 * The convention of calling the file `$.tsx` mirrors the file-based plugin:
 *   $.tsx         → `*`
 *   foo.$.tsx     → `foo/*`
 * It's a visual hint for future-you (and teammates).
 */
export function meta({}: Route.MetaArgs) {
  return [{ title: "404 — BetLab" }];
}

export default function NotFound() {
  const params = useParams();
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-24 text-center">
      <div className="text-6xl">🎯</div>
      <h1 className="mt-6 text-3xl font-bold">404 — Nothing here</h1>
      <p className="mt-2 text-gray-400">
        No route matched <code className="text-emerald-300">/{params["*"]}</code>.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-gray-950 hover:bg-emerald-400"
      >
        Back home
      </Link>
    </section>
  );
}
