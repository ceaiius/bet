import { useNavigation } from "react-router";

/**
 * ---------------------------------------------------------------------------
 * <LoadingBar />
 * ---------------------------------------------------------------------------
 * Global top-of-page progress bar driven by `useNavigation`.
 *
 *   navigation.state  →  "idle" | "loading" | "submitting"
 *     - "loading"    : we're running loaders for a client-side navigation
 *     - "submitting" : we're running an action (Phase 3)
 *     - "idle"       : nothing in flight
 *
 * `useNavigation` reflects the GLOBAL page navigation. For per-component
 * "is MY request in flight?" you use `useFetcher().state` (Phase 3).
 *
 * Pro move: gate the visibility behind a tiny delay so fast navigations
 * don't flash the bar. We do that here with a CSS transition + opacity.
 * ---------------------------------------------------------------------------
 */
export function LoadingBar() {
  const navigation = useNavigation();
  const active = navigation.state !== "idle";

  return (
    <div
      aria-hidden
      className={[
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 transition-opacity duration-150",
        active ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div className="h-full w-full origin-left animate-[loading-bar_1.2s_ease-in-out_infinite] bg-emerald-400" />
      {/* keyframes are defined in app.css */}
    </div>
  );
}
