# Phase 1 — Routing fundamentals & the framework skeleton

Reference notes you can revisit before the interview. Pair with the inline
comments in the files touched this phase.

---

## 1. The two declarative styles

React Router v7 framework mode supports two ways to declare routes:

| Style       | Plugin                            | Where routes live      |
|-------------|-----------------------------------|------------------------|
| Config      | built in                          | `app/routes.ts`        |
| File-based  | `@react-router/fs-routes`         | `app/routes/**` names  |

We chose **config-based** for this project because the whole route tree is
visible in one file — easier to grok, easier to refactor, easier to review.

The four helpers you'll use all day long:

```ts
index("file.tsx")                   // default child, no path segment
route("path", "file.tsx", [...])    // normal segment, may have children
layout("file.tsx", [...])           // pathless wrapper (Outlet), no URL
prefix("segment", [...])            // group children under a URL prefix
```

Dynamic segments: `:param`, `:param?` (optional), `*` (splat).

---

## 2. The route module contract

A "route module" is just a file with specific named exports. You pick which
ones you need:

| Export               | When it runs                  | Purpose |
|----------------------|-------------------------------|---------|
| `default` (component)| Render                        | The UI for the route |
| `loader`             | Server (and on client nav)    | Load data for the route (Phase 2) |
| `clientLoader`       | Browser only                  | Load data on the client (Phase 2) |
| `action`             | Server on POST/PUT/etc.       | Mutations (Phase 3) |
| `clientAction`       | Browser on POST/PUT/etc.      | Client-side mutations |
| `meta`               | Render                        | Produces `<meta>` / `<title>` |
| `links`              | Render                        | Produces `<link>` (preconnect, favicon, CSS) |
| `headers`            | Server response               | HTTP headers (Phase 7) |
| `handle`             | Any time via `useMatches()`   | Arbitrary per-route metadata (e.g. breadcrumbs) |
| `shouldRevalidate`   | Nav / mutation                | Opt out of automatic loader revalidation |
| `ErrorBoundary`      | On thrown error/Response      | Route-scoped error UI |
| `HydrateFallback`    | During client hydration       | Placeholder while `clientLoader` runs |

All of these are optional *except* at least the default export (usually).

---

## 3. `+types/*` codegen — the single biggest DX win

`react-router typegen` scans `app/routes.ts` and generates a typed namespace
per route at `.react-router/types/app/routes/+types/<route-file>.d.ts`. You
import it with `import type { Route } from "./+types/<basename>";`.

It gives you:

- `Route.LoaderArgs` — `{ request, params, context }` with **`params` typed
  from your route path**. `/sports/:sport` → `params.sport: string`.
- `Route.ActionArgs` — same idea for actions.
- `Route.ComponentProps` — typed `{ loaderData, actionData, params, matches }`.
- `Route.MetaArgs`, `Route.LinksFunction`, `Route.ErrorBoundaryProps`.

You never have to manually type `params` again. If you rename a segment,
TS errors show up at the call sites.

The generated types are created:
- Automatically when you run `npm run dev` (Vite plugin watches).
- On demand via `npm run typecheck`.
- Committed? **No.** `.react-router/` is gitignored.

---

## 4. `<Outlet />` — THE core primitive

`<Outlet />` is where a parent route renders its children. Omitting it in a
layout route means the child URL matches and fetches data, but nothing is
drawn — classic bug.

Pass context down with:

```tsx
<Outlet context={{ user }} />
```

and consume in a child with:

```tsx
const { user } = useOutletContext<{ user: User }>();
```

`useRouteLoaderData("routes/_shell")` is the other common pattern for passing
data from a parent loader to a descendant (we'll use it from Phase 2 onward).

---

## 5. `<Link>` vs `<NavLink>` vs `<Form>`

- `<Link to="...">` — client-side navigation, participates in loader
  revalidation. Supports `prefetch="none" | "intent" | "render" | "viewport"`.
- `<NavLink>` — same, plus active/pending state via:
  - `className={({ isActive, isPending }) => ...}`
  - `style={(...)}`
  - `children={({ isActive, isPending }) => ...}`
  - `end` prop to require an exact match.
- `<Form>` — submits to a route's `action` and triggers revalidation.
  Progressive enhancement: works without JS. We meet this in Phase 3.

**`prefetch="intent"` is your go-to default.** It fetches the loader data
+ code-split bundle on hover/focus. By click time, the next page is warm.

---

## 6. Error boundaries & thrown Responses

Idiomatic RR: when data is missing / forbidden / invalid, **`throw` a
`Response`** from the loader (or the component, though less common). React
Router interprets this as a routing error and renders the nearest
`ErrorBoundary`.

```ts
throw new Response("Not found", { status: 404 });
```

Then, in the boundary:

```tsx
import { isRouteErrorResponse } from "react-router";
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) { /* ... */ }
}
```

Key mental model:
- Error boundaries are **scoped**. A 404 inside `/sports/:sport` renders the
  boundary in `sports.$sport.tsx`, but the shell header/sidebar **keep
  rendering**. That's nested routing paying off.
- If you `throw error` from a child boundary, it bubbles up to the parent.
- If no route has one, root's `ErrorBoundary` is the fallback.

---

## 7. `Layout` (named export on root)

The ROOT route has a special optional export `Layout` that wraps the HTML
document. React Router renders your route *inside* it, AND re-uses it for
your `ErrorBoundary` so that an error still renders inside a valid HTML
document with your `<Meta />` and `<Links />`.

Don't put data-dependent UI in `Layout` — keep it presentational. If the
error boundary fires, whatever loader feeds your header will have exploded.

---

## 8. `HydrateFallback`

Shown during the brief window where the client is still running a
`clientLoader` (with `clientLoader.hydrate = true`). For SSR-only loaders
(Phase 2 default), this is not used. For routes with data that must be
fetched from `window` (e.g. from `localStorage`) it's essential.

Keep it static and instant.

---

## 9. `react-router.config.ts`

Top-level app flags:
- `ssr: true` — SSR every request (our default).
- `ssr: false` — SPA mode; ship static `index.html` + JS.
- `prerender: ["/","/sports"]` — static-HTML-at-build-time.
- `basename: "/app"` — mount under a subpath.

Sportsbook reality: SSR on for everything that renders odds; optionally
prerender marketing-ish pages in Phase 8.

---

## 10. Senior-level interview prompts you should be able to answer

1. Why does React Router isolate errors per route rather than rendering a
   single global error screen?
2. You have `/sports/:sport` with an `ErrorBoundary`. A loader under it
   throws `new Response(..., { status: 500 })`. What renders, and what
   DOESN'T re-render?
3. When is `<Link prefetch="intent">` a bad idea?
4. You want `/sports` to have a shared sidebar but NOT add a URL segment.
   Which helper do you reach for, and what's the file-naming convention?
5. Difference between `useLoaderData`, `useRouteLoaderData`, and
   `useOutletContext`?
6. When would you prefer file-based over config-based routes?
7. What happens if you forget `<Outlet />` in a layout route?
8. Why do you `throw new Response(...)` instead of `return` + `if`?
9. How do you share data from a parent loader to ONLY one child, without
   re-fetching?
10. What's the difference between `Layout` (named) and the default export
    on the root route?

Self-test: answer each out loud before reading the file comments.

---

## Files touched this phase

- `app/routes.ts` — full route tree with commentary
- `app/root.tsx` — all root exports documented
- `react-router.config.ts` — SSR/SPA/prerender notes
- `app/routes/_shell.tsx` — pathless layout
- `app/routes/home.tsx`
- `app/routes/live.tsx`
- `app/routes/sports._index.tsx`
- `app/routes/sports.$sport.tsx` — dynamic segment + ErrorBoundary
- `app/routes/sports.$sport.$league.tsx` — nested dynamic segment
- `app/routes/events.$eventId.tsx` — throws on purpose to demo boundary
- `app/routes/$.tsx` — splat 404
- `app/routes/_auth.tsx` — alternate shell
- `app/routes/auth.login.tsx`, `auth.register.tsx`
- `app/components/{Header,Sidebar,BetSlipPanel}.tsx`
- `app/data/sports.ts`, `app/lib/format.ts`

---

## What's next (Phase 2 preview)

Migrate the sidebar data into a `loader` on `_shell.tsx`, consume it from
`Sidebar.tsx` via `useRouteLoaderData`. Add real event data, loaders on
`/sports/:sport` and `/events/:eventId`, and learn about parallel data
fetching, `headers`, and the revalidation model.
