# Phase 2 — Data loading with `loader`

Reference notes. Pair with the inline comments in the files touched this
phase.

---

## 1. Where does a `loader` run?

| Situation                          | Where the loader runs             |
|------------------------------------|-----------------------------------|
| First request (SSR)                | Server                            |
| Client-side navigation (`<Link>`)  | Server (RR fetches the JSON)      |
| Client-side navigation (SPA mode)  | Client (via the internal fetcher) |
| Hot reload during dev              | Server                            |

Implication: **`loader` is always server-capable**. You can `import` a
database client, a secret key, Node-only APIs. In framework mode they are
stripped from the client bundle automatically.

The client-only equivalent is `clientLoader`. It runs only in the browser
and is useful for:
- Data from `window`/`localStorage`/`document.cookie`
- Re-reading a client cache (e.g. SWR-like)
- Calling a third-party JS SDK that doesn't have a server equivalent

Set `clientLoader.hydrate = true` to make RR call it on first render
(SSR-then-rehydrate), at which point you likely want `HydrateFallback` too.

---

## 2. The full args your loader receives

```ts
export async function loader({
  request,  // Fetch Request — has URL, headers, signal (for aborts)
  params,   // Typed from the route path
  context,  // Server context (adapter-specific; unused in our setup)
}: Route.LoaderArgs) {}
```

`request.signal` is your abort signal — pass it to `fetch` so in-flight
calls cancel when the user navigates away mid-load. Miss this in interviews
and a sharp reviewer will ding you.

---

## 3. What a loader can return

- A plain serializable object/array/primitive (99% of the time).
- A `Response` instance (custom status, custom body).
- A `redirect(...)` (a Response with 302 + Location).
- `data(value, { status, headers })` — the helper. Use when you want to
  return data BUT also control status/headers.
- A `throw` of a `Response` — the idiomatic "bail out to ErrorBoundary".

Return values are JSON-serialized. That means no `Date`, `Map`, `Set`,
`BigInt`, class instances, or functions on the way out. Convert to strings
or primitives in the loader (we use ISO strings for kickoff times).

---

## 4. Reading loader data in the component

Two equivalent patterns:

**A. Component props (framework-mode idiomatic, fully typed):**

```tsx
export default function Page({ loaderData }: Route.ComponentProps) {
  loaderData.foo; // fully typed
}
```

**B. The hook (works anywhere in the route's tree):**

```tsx
import { useLoaderData } from "react-router";
const data = useLoaderData<typeof loader>();
```

Use A when the component is the route default; use B for nested components
that don't want to thread props.

---

## 5. `useRouteLoaderData` — reach UP the tree, not DOWN

```tsx
import { useRouteLoaderData } from "react-router";
import type { loader as shellLoader } from "~/routes/_shell";

const shell = useRouteLoaderData<typeof shellLoader>("routes/_shell");
```

- The string is the **route ID** — in framework mode derived from the file
  path in `app/`, extension stripped. So `app/routes/_shell.tsx` becomes
  `"routes/_shell"`.
- Returns `undefined` if that route isn't currently matched.
- Decouples a deep component from prop-drilling, at the cost of coupling
  it to that route ID.

Three mental-model-busting facts:
1. There is **no extra fetch** — you're reading an already-loaded cache.
2. Data is **scoped to the current navigation**. When the user navigates,
   RR re-runs matched loaders and refills these caches.
3. It works on BOTH server AND client, same API.

---

## 6. Parallel loading, not waterfalls

**The golden rule:** on each navigation, React Router runs ALL matched
routes' loaders in parallel. You, the dev, get a waterfall ONLY when:

- You `await` sequentially inside a single loader. Fix: `Promise.all`.
- You fetch in a `useEffect` after render. (Don't. That's what loaders are
  for.)

This is the reason loaders exist at all. Compare:

```tsx
// ❌ Classic React anti-pattern (Network tab: sequential requests)
function EventPage() {
  const [event, setEvent] = useState(null);
  useEffect(() => { fetch(...).then(setEvent); }, [id]);
  // Then child fetches again from its own useEffect. Waterfall.
}

// ✅ RR framework mode (Network tab: all parallel)
// _shell.loader + sports.$sport.loader + sports.$sport.$league.loader all
// fire at the same time the moment RR commits to the navigation.
```

---

## 7. `headers` export

```ts
export function headers(args: Route.HeadersArgs) {
  return { "Cache-Control": "public, max-age=10, s-maxage=60" };
}
```

- Only affects the **document response** (SSR) and resource routes.
- For nested routes, RR merges them — the child's `headers` wins on
  conflicts with parents'.
- Use sparingly. Caching odds pages will get you in real trouble; use
  `no-store` for anything volatile.

See `home.tsx` (cached briefly) and `events.$eventId.tsx` (`no-store`)
for two ends of the spectrum.

---

## 8. `shouldRevalidate` — the scalpel, not the chainsaw

Default: every matched loader revalidates on every navigation AND after
every action. That's the safe default.

You can opt out for a specific route:

```ts
export function shouldRevalidate({
  currentParams, nextParams, defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentParams.sport === nextParams.sport) return false;
  return defaultShouldRevalidate;
}
```

Rules I follow:
- Default is correct most of the time; reach for it only with profiling.
- Never use it to avoid refetching after a mutation — that's a bug waiting
  to happen. (Compare `formAction`/`actionStatus` if you really must.)
- Always pass through `defaultShouldRevalidate` for cases you don't
  explicitly handle.

Note: `ShouldRevalidateFunctionArgs` is imported from `react-router`
directly, not from the per-route `Route.*` codegen namespace.

---

## 9. `useNavigation` vs `useFetcher().state`

- `useNavigation()` reflects the GLOBAL page navigation.
  States: `"idle" | "loading" | "submitting"`.
  Use it for top-level UX: a progress bar, a dim overlay, etc.

- `useFetcher().state` reflects ONE fetcher's state.
  Use it for per-component optimistic UI (Phase 3).

Our `<LoadingBar />` in `app/components/LoadingBar.tsx` uses the former.

Pending states on `<NavLink>` (the emerald pulse in the sidebar) come from
the SAME system — RR flips `isPending` on whichever link is navigating.

---

## 10. Typing `useRouteLoaderData` correctly

With `verbatimModuleSyntax: true` in `tsconfig`, `import type { loader }`
works for this use case:

```ts
import type { loader as shellLoader } from "~/routes/_shell";
useRouteLoaderData<typeof shellLoader>("routes/_shell");
```

This works because `typeof X` in a TYPE position refers to the type of the
value — and a type-only import still lets TS look up that type.

If you hit weird errors, fall back to the (slightly uglier) value import:

```ts
import { type loader } from "~/routes/_shell";
// or:
import type * as Shell from "~/routes/_shell";
useRouteLoaderData<typeof Shell.loader>("routes/_shell");
```

---

## 11. Senior-level interview questions

1. You have `/sports/:sport/:league`. The user navigates from `/sports/football/premier-league` to `/sports/football/la-liga`. Which loaders run, and which are skipped (assuming no `shouldRevalidate`)?
2. Same routes. Now `sports.$sport` has `shouldRevalidate` that returns `false` when `:sport` is unchanged. What changes?
3. What does `request.signal` do inside a loader, and why should you forward it to every `fetch` call?
4. When would you prefer `clientLoader` over `loader`?
5. Explain the difference between `useLoaderData`, `useRouteLoaderData`, and `useOutletContext`. When is each correct?
6. After a successful action (POST), which loaders run? Can you prevent a specific one from revalidating, and would you?
7. `loader` returns a `Date`. What happens on the client?
8. What's the difference between `throw new Response(...)` and `return new Response(...)` from a loader?
9. A sportsbook wants featured-odds pages to be briefly cached at the CDN. What would you put in `headers`, and what are the risks?
10. Your `/events/:eventId` loader is slow (500ms). The card that links to it on `/` has `prefetch="intent"`. Walk through what happens when the user hovers the card, then clicks it 100ms later.
11. Why can't you return a `Map` or a class instance from a loader?
12. Where should secrets (API keys, session secrets) be referenced, and why is that safe?

Try each out loud. If any feel shaky, open the file that demonstrates it.

---

## 12. Files touched this phase

- `app/data/sports.ts` — grown into a proper async data layer
- `app/lib/format.ts` — new helpers (odds, kickoff, count)
- `app/components/Sidebar.tsx` — consumes via `useRouteLoaderData` (with prop fallback)
- `app/components/EventCard.tsx` — new, reusable
- `app/components/LoadingBar.tsx` — new, uses `useNavigation`
- `app/app.css` — keyframes for the bar
- `app/root.tsx` — mounts `<LoadingBar />`
- `app/routes/_shell.tsx` — loader returning sports
- `app/routes/home.tsx` — loader + `headers` example
- `app/routes/sports._index.tsx` — no loader; reads parent
- `app/routes/sports.$sport.tsx` — loader, `shouldRevalidate`, `useRouteLoaderData` peek
- `app/routes/sports.$sport.$league.tsx` — nested loader, `Promise.all`
- `app/routes/events.$eventId.tsx` — real lookup, 404 throw, `no-store` headers

---

## 13. What's next (Phase 3 preview)

Mutations with `action`. We'll make the bet slip real:

- `<fetcher.Form>` to add/remove selections without navigating.
- Optimistic UI with `fetcher.formData`.
- Server-side validation, typed errors, `useActionData`.
- `redirect()` after success (e.g. place-bet → /account/bets).
- The automatic revalidation model: after an action, every loader re-runs
  by default — watch the Network tab to see it.
