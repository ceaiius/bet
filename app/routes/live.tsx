import type { Route } from "./+types/live";

/**
 * Placeholder for Phase 4 (streaming / polling live odds).
 * Kept deliberately boring for now.
 */

export function meta({}: Route.MetaArgs) {
  return [{ title: "Live — BetLab" }];
}

export default function Live() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-bold">Live / in-play</h1>
      <p className="mt-2 text-gray-400">
        We'll build this out in Phase 4 with streaming loaders (<code>Suspense</code>
        + <code>&lt;Await&gt;</code>) and <code>useRevalidator</code> polling.
      </p>
    </section>
  );
}
