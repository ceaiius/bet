# Phase 4 — Streaming, `<Await>`, `useRevalidator`, and `request.signal`

This is the phase where the app starts _feeling_ like a sportsbook: odds
flicker, a live ticker ticks, and slow data streams in without blocking the
first paint. Three APIs do 95% of the work:

- **Streaming loaders** — return un-awaited `Promise`s, pair with
  `<Suspense>` + `<Await>` in the component.
- **`useRevalidator()`** — re-run all matched loaders imperatively.
- **`request.signal`** — an `AbortSignal` you forward into every async call
  so work cancels when the client walks away.

---

## 1. Streaming: critical vs. deferred data

A loader that looks like this:

```ts
export async function loader({ request }: Route.LoaderArgs) {
  const liveEvents = await getLiveEvents(request.signal);   // awaited
  const hotStatsPromise = getHotStats(request.signal);      // NOT awaited
  hotStatsPromise.catch(() => {});                          // see §5
  return { liveEvents, hotStats: hotStatsPromise };
}
```

…tells React Router:

1. _Don't_ render HTML until `liveEvents` resolves — it's part of the
   critical path.
2. Serialize `hotStatsPromise` into the response stream. React Router sends
   the HTML immediately with a `<Suspense>` boundary in place of the
   awaited children; when the promise resolves, it flushes a second chunk
   (an inline `<script>`) that swaps the fallback for the real UI.

On the component side:

```tsx
<Suspense fallback={<HotStatsSkeleton />}>
  <Await resolve={hotStats} errorElement={<HotStatsError />}>
    {(data) => <HotStats data={data} />}
  </Await>
</Suspense>
```

- `<Suspense>` owns the loading fallback.
- `<Await>` unwraps the promise using React 19's `use()` under the hood.
- `errorElement` handles a rejected promise so one slow tile failing
  doesn't nuke the whole page.

### Why this matters

Blocking _everything_ on your slowest loader is the classic waterfall trap.
Deferred streaming gives you the best of both worlds: the user sees content
fast, and the slow piece shows up when it's ready. In a sportsbook, the
"featured markets" list is critical; the "popular bets with friends" panel
is not.

## 2. Polling with `useRevalidator`

```tsx
const revalidator = useRevalidator();
setInterval(() => {
  if (revalidator.state === "idle") revalidator.revalidate();
}, 4000);
```

`revalidate()` re-runs **every matched loader that opts in** and
turbo-streams new data. It does _not_ unmount components, so React's
reconciliation updates only the parts that changed — the UI stays put and
prices flicker in place.

### The gotchas

1. **Visibility.** A background tab polling every few seconds eats battery
   and hammers your server. Pause on `document.visibilityState === "hidden"`.
2. **Overlap.** If the server is slow, your interval will fire again while
   the last request is still in flight. Guard with `state !== "idle"`.
3. **Overreach.** By default, every matched loader re-runs. In this app
   that means the shell re-fetches the sports catalog every 4s — wasteful.
   Opt the shell out via `shouldRevalidate`.
4. **Scalpel vs. hammer.** For surgical polling, use a **resource route**
   + `useFetcher().load("/api/live-odds")` instead. Only that one loader
   runs, and it writes to `fetcher.data` rather than `loaderData`.

### The `shouldRevalidate` we wired into `_shell`

```ts
export function shouldRevalidate({
  currentUrl, nextUrl, formMethod, defaultShouldRevalidate,
}) {
  if (currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate;
  if (formMethod) return defaultShouldRevalidate; // keep bet-slip count fresh
  return false; // pure revalidator tick → skip
}
```

This single function is why the Network panel on `/live` only shows the
live-page `.data` request on each tick, not the whole shell.

## 3. `request.signal` — the "please stop" pipe

Every `loader({ request })` and `action({ request })` gets a standard
`Request`. The `request.signal` fires (aborts) when:

- The client navigates away mid-load.
- `useRevalidator().revalidate()` is called before the last one finished.
- The user hits ESC in Chrome, closes the tab, etc.

You must **forward it into anything async**:

```ts
await fetch(url, { signal: request.signal });
await db.query(sql, { signal: request.signal });
await sleep(1000, request.signal);
```

Our `sleep()` helper now honors it:

```ts
export const sleep = (ms, signal) => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason);
  const timer = setTimeout(() => { cleanup(); resolve(); }, ms);
  const onAbort = () => { clearTimeout(timer); reject(signal.reason); };
  signal?.addEventListener("abort", onAbort, { once: true });
});
```

Without abort forwarding, a slow loader will keep running on the server
after the user has already moved on — burning CPU, holding DB connections,
and occasionally racing with a newer request to clobber its results.

## 4. Price-flash technique (client-side diffing)

```tsx
const previousPrices = useRef<Map<string, number>>(new Map());
useEffect(() => {
  // compare current prices to previousPrices; write flashes into state
  // reset flashes after ~900ms via setTimeout
}, [market?.selections.map((s) => s.price).join(",")]);
```

The key idea: **loader data is the source of truth; `useRef` is the
"last-seen" snapshot; `useState` carries the ephemeral flash state.** The
dependency array uses a stringified price summary so the effect only runs
when a price actually changed between polls.

## 5. Little streaming footguns

1. **Unhandled rejections.** If the deferred promise rejects and nothing
   is listening yet (the client hasn't rendered `<Await>`), Node logs
   "UnhandledPromiseRejection". Always attach `.catch(() => {})` inside the
   loader — `<Await errorElement>` will still observe the rejection.
2. **Non-serializable values.** Turbo-stream supports Date, Map, Set,
   Error, Promise, etc. It does NOT support functions, class instances
   with methods, or DOM nodes. Keep deferred payloads plain-data.
3. **Headers and streaming.** Once the first chunk is sent, you can't
   change status codes or headers. All response-shaping (`data(…, init)`)
   must happen on the _awaited_ portion of the loader.
4. **Suspense in lists.** One `<Suspense>` per promise is usually right.
   Put them _inside_ the list so one slow item doesn't block the others.

## 6. Alternatives you should know for the interview

| Tool                        | When to reach for it                                                            |
|-----------------------------|---------------------------------------------------------------------------------|
| `useRevalidator`            | Blunt re-fetch of the whole page's matched loaders.                             |
| `useFetcher().load(url)`    | Poll a single resource route; doesn't affect `loaderData`.                      |
| SSE / WebSocket + setState  | True push updates. RR doesn't wrap this; open a connection in `useEffect`.      |
| React 19 `use(promise)`     | What `<Await>` is built on. You can use it directly for your own promises.      |
| React Query / SWR           | Purely client-side caching/revalidation. Overlaps with RR loaders; usually you pick one.|

## 7. Senior-level interview questions (answer out loud)

1. Walk me through exactly what bytes go over the wire when a loader
   returns `{ critical, deferred: somePromise }`. How does the client know
   where to inject the streamed chunk?
2. What is `turbo-stream`? What does it buy us over `JSON.stringify` +
   `dangerouslySetInnerHTML` for serializing loader data?
3. If I `await` two promises in parallel with `Promise.all`, is that
   _the same_ as returning `{ a: promiseA, b: promiseB }` from the loader?
   What's the observable behavioral difference?
4. `<Await>` uses React's `use()` hook. What happens if the promise
   rejects and I don't provide `errorElement`?
5. Distinguish `useRevalidator()` from `useFetcher().load(url)`. When
   would each be wrong?
6. My `/live` page polls every 4s and the user has 8 tabs open. My
   database is melting. Name three mitigations _in the client_ and three
   _on the server_.
7. I return a deferred Promise from a loader. Halfway through, the user
   navigates away. What happens on (a) the server, (b) the client, and
   (c) the React tree?
8. Why is `.catch(() => {})` commonly required on deferred promises in
   Node? Does the error disappear?
9. `shouldRevalidate` receives `formMethod`, `formAction`, `actionResult`,
   `currentUrl`, `nextUrl`. Sketch the decision matrix for a shell-level
   loader in a multi-tenant app.
10. A colleague wants to use `setInterval` in a Route component to re-fetch
    data with `fetch()` and `setState`. Argue for or against vs.
    `useRevalidator()` in RR framework mode.
11. You have a price-flash effect depending on loader data. How do you
    make sure SSR doesn't cause a hydration mismatch the first time?
12. `request.signal` is an `AbortSignal`. What's the contract you must
    honor to be a "good citizen" of it in your own async helpers?
13. How would you implement "pause polling while the bet slip is open and
    the user is editing stake" without introducing a global state library?

---

## What's wired up

- `app/data/sports.ts` — `isLive`, `getLiveEvents`, `getHotStats`,
  jitter, signal-aware `sleep`.
- `app/routes/live.tsx` — critical+deferred loader, `<Suspense>`/`<Await>`,
  mounts `<LivePoller />`.
- `app/components/LivePoller.tsx` — interval + visibility pause + overlap
  guard + countdown.
- `app/components/LiveEventCard.tsx` — price diff via `useRef` +
  green/red flash.
- `app/components/HotStats.tsx` — consumes streamed data + skeleton.
- `app/routes/_shell.tsx` — `shouldRevalidate` to skip polling re-fetches.
- `app/app.css` — `price-flash-up` / `price-flash-down` keyframes.

## Try this in the browser

1. Open `/live`. You should see events render immediately, then the
   "Hot stats" row pops in ~1.2s later with a skeleton fallback.
2. Watch the odds buttons — they flash green or red every ~4s.
3. Open DevTools → Network, filter `.data`. You'll see exactly one
   `/live.data` request every 4 seconds. The shell loader does **not**
   fire. That's `shouldRevalidate` at work.
4. Switch tabs for 20 seconds, come back. Polling paused while the tab
   was hidden, resumes on focus.
5. Click a Navigate-to-event link while a poll is in flight. The old
   `.data` request should cancel (red in Network). That's `request.signal`
   doing its job.
