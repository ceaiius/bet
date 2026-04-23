import { useEffect, useRef, useState } from "react";
import { useRevalidator } from "react-router";

/**
 * ===========================================================================
 * <LivePoller />
 * ===========================================================================
 * Periodically re-runs the matched loaders using `useRevalidator()`.
 *
 * `useRevalidator()` returns:
 *   - `revalidate()` — imperatively re-run every matched loader
 *   - `state`        — "idle" | "loading"
 *
 * Key behaviors you want in any real poller:
 *   1. Pause when the tab is hidden (saves battery + server load).
 *   2. Skip tick if the previous revalidation hasn't finished yet
 *      (avoids overlapping requests / wasted bandwidth).
 *   3. Forward a countdown so the user knows something is happening.
 *
 * NOTE on alternatives: for finer-grained polling (e.g. "only refresh the
 * odds section, not the rest of the page"), use a RESOURCE ROUTE +
 * `useFetcher().load(url)` instead. Revalidator is the blunt instrument;
 * fetcher.load is the scalpel. We'll preview that in Phase 7.
 * ===========================================================================
 */

type Props = {
  intervalMs?: number;
};

export function LivePoller({ intervalMs = 5000 }: Props) {
  const revalidator = useRevalidator();
  const [countdown, setCountdown] = useState(intervalMs);

  // Keep a ref to the latest state so the interval callback always reads
  // the freshest value without re-binding on every render.
  const stateRef = useRef(revalidator.state);
  stateRef.current = revalidator.state;

  useEffect(() => {
    let lastTick = Date.now();
    let paused = document.visibilityState === "hidden";

    const onVisibilityChange = () => {
      paused = document.visibilityState === "hidden";
      if (!paused) {
        // Reset the countdown timer when coming back.
        lastTick = Date.now();
        setCountdown(intervalMs);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const tick = setInterval(() => {
      if (paused) return;

      const elapsed = Date.now() - lastTick;
      const remaining = Math.max(0, intervalMs - elapsed);
      setCountdown(remaining);

      if (remaining === 0 && stateRef.current === "idle") {
        lastTick = Date.now();
        revalidator.revalidate();
      }
    }, 250);

    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
    // intentionally not depending on `revalidator` to avoid timer re-creation
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  const busy = revalidator.state !== "idle";

  return (
    <div
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs"
      aria-live="polite"
    >
      <span
        className={[
          "h-2 w-2 rounded-full",
          busy ? "animate-ping bg-emerald-400" : "bg-emerald-500",
        ].join(" ")}
      />
      <span className="text-gray-300">
        {busy ? "Updating…" : `Next in ${Math.ceil(countdown / 1000)}s`}
      </span>
    </div>
  );
}
