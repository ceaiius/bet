import type { HotStats as HotStatsData } from "~/data/sports";
import { formatOdds } from "~/lib/format";

/**
 * Streamed-in "hot stats" panel.
 *
 * Rendered inside <Suspense><Await resolve={promise}>{...}</Await></Suspense>
 * on the /live page. Until the promise resolves, <HotStatsSkeleton /> shows
 * instead. After the first resolution, every revalidation (poll) replaces
 * this with the new data — the Suspense fallback shows again briefly.
 */
export function HotStats({ data }: { data: HotStatsData }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Stat
        label="Live events"
        value={String(data.liveCount)}
        caption="Right now"
      />
      <Stat
        label="Volatility"
        value={`${data.volatilityPct}%`}
        caption="Last poll window"
      />
      <Stat
        label="Longest shot"
        value={formatOdds(data.longestShot.price)}
        caption={`${data.longestShot.label} · ${data.longestShot.eventLabel}`}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-semibold text-white">
        {value}
      </div>
      <div className="mt-1 truncate text-xs text-gray-400">{caption}</div>
    </div>
  );
}

export function HotStatsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[92px] animate-pulse rounded-lg border border-white/10 bg-white/5"
        />
      ))}
    </div>
  );
}
