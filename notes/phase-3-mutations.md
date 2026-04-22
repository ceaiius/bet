# Phase 3 — Mutations: `action`, `<Form>`, `<fetcher.Form>`, optimistic UI

Reference notes to pair with the inline comments in the Phase 3 files.

---

## 1. The mental model: loaders read, actions write

Framework mode mirrors HTTP:

| HTTP verb            | Framework export | Typical use                  |
|----------------------|------------------|------------------------------|
| GET                  | `loader`         | read data                    |
| POST / PUT / PATCH / DELETE | `action`  | write data                   |

A route can have both, neither, or just one. After any `action` completes
successfully, **React Router re-runs every matched loader** on the client,
refreshing the UI. You almost never write manual cache invalidation.

---

## 2. `<Form>` vs `<fetcher.Form>` — the single most important distinction

| Feature                         | `<Form>`                    | `<fetcher.Form>`              |
|---------------------------------|-----------------------------|-------------------------------|
| Causes a page navigation?       | Yes                         | No                            |
| Updates URL?                    | Yes (to the action route)   | No                            |
| Scroll position reset?          | Yes, by default             | No                            |
| Focus reset?                    | Typically yes               | No                            |
| Multiple concurrent?            | No (it's the global nav)    | Yes — one per `useFetcher()`  |
| Action data location            | `useActionData()`           | `fetcher.data`                |
| Pending state                   | `useNavigation().state === "submitting"` | `fetcher.state !== "idle"` |

Rule of thumb:
- **`<Form>`** for *primary flows*: login, register, "Place order and see
  confirmation page", "Delete account and go to homepage". Anything where
  you'd also accept a full-page reload as a fallback.
- **`<fetcher.Form>`** for *inline UI*: bet slip add/remove, star toggles,
  "load more" buttons, autocomplete, debounced search. Anything where the
  URL shouldn't change.

Phase 5 will use `<Form>` for login with a `redirect()` to `/account`.

---

## 3. Anatomy of an action

```ts
export async function action({ request, params, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");
  // ... validate, mutate, return
}
```

Return values are the same universe as loaders:
- Plain serializable object → available as `fetcher.data` / `useActionData()`
- `data(value, { status, headers })` → same, plus custom status/headers
- `redirect("/somewhere", { headers? })` → RR navigates the whole page
- `throw new Response(..., { status })` → triggers the nearest `ErrorBoundary`

Our `/bet-slip` action uses all four patterns.

---

## 4. The "intent" pattern

A single action handling multiple mutations is cleaner than one route per
mutation. Put a hidden `<input name="intent" value="add">` in the form and
switch on it server-side:

```ts
switch (intent) {
  case "add":      ...
  case "remove":   ...
  case "setStake": ...
  case "clear":    ...
  case "place":    ...
}
```

Paired with a string-literal union + an `isBetSlipIntent` guard, the
compiler enforces exhaustiveness — missing a case errors at build time.
This is exactly what `app/lib/bet-slip.ts` does.

Alternative: action-per-route. Works fine but scales poorly (you end up
with `/bet-slip/add`, `/bet-slip/remove`, `/bet-slip/clear`...). Pick the
intent pattern unless you have a compelling reason otherwise.

---

## 5. Validation and error handling

**Never trust the client.** The form can be edited, replayed, or forged.
The action re-reads the authoritative server state (`readRawCookie` in our
case), validates inputs, and only then mutates.

Surface errors to the UI by returning:

```ts
return data({ error: "Slip is full" }, { status: 400 });
```

- The non-2xx status is semantically correct.
- The shape is `{ error: string }` (not `throw`) because you want the form
  to STAY on the page and show the error, not jump to an ErrorBoundary.

**Throw** only for unrecoverable conditions (malformed request, forbidden,
not found). A validation failure is recoverable; an expired session is not.

---

## 6. Optimistic UI with `fetcher.formData`

The fetcher object exposes the form data of the *in-flight* submission:

```ts
const submitting = fetcher.state !== "idle";
const intent = fetcher.formData?.get("intent");

const optimisticInSlip = submitting
  ? fetcher.formData?.get("intent") === "add"
  : alreadyInSlip;
```

Render UI based on `optimisticInSlip` → the button flips to "active" the
instant the user clicks, well before the server responds. When the server
confirms (and the shell loader revalidates), the real data kicks in and
everything stays consistent. If the server REJECTS (validation error), the
fetcher returns the error and `alreadyInSlip` is still the old truth —
the UI snaps back automatically.

The three states you typically care about:

| State | `fetcher.state` | What to render |
|-------|-----------------|----------------|
| Idle, has data (last result) | `"idle"` + `data` set | Show result / error |
| Submitting                   | `"submitting"`        | Show optimistic UI |
| Loading revalidation         | `"loading"`           | (rare in fetchers; usually idle by now) |

---

## 7. One fetcher per interactive element

`useFetcher()` creates an independent state container. To see this in
action:

- Two odds buttons on the same card → two fetchers → click both fast,
  each shows its own pending state.
- Each row in the bet slip has its own fetcher for "remove" → you can
  remove two selections in parallel.
- The stake input's fetcher, the clear button's fetcher, and the place-bet
  button's fetcher are all separate → clearing doesn't disable placing.

Watch the Network tab and you'll see multiple simultaneous `POST /bet-slip`
requests. That's intentional and correct.

If you need fetchers to de-dupe (e.g. "only one 'save draft' in flight"),
pass a **key** to `useFetcher({ key: "saveDraft" })`. Multiple components
using the same key share one fetcher.

---

## 8. Automatic revalidation

After a `/bet-slip` action returns, React Router:

1. Waits for the action response.
2. Re-runs every matched loader on the CURRENT page (not just `/bet-slip`'s
   loader — *every* loader, including the shell's and whatever page you're
   viewing).
3. Commits the new data to the UI.

That's why adding a selection anywhere in the app updates the Sidebar count,
the BetSlipPanel, and the EventCard highlights simultaneously. One server
round-trip, one coherent UI update.

You can opt out per loader with `shouldRevalidate` (Phase 2), using the
`formAction` / `actionResult` / `actionStatus` args to decide.

---

## 9. Cookies in practice

`createCookie(name, opts)` returns an object with `.parse()` and `.serialize()`:

```ts
const cookie = createCookie("__bet_slip", {
  httpOnly: true,
  sameSite: "lax",
  secure: import.meta.env.PROD,
  maxAge: 60 * 60 * 24 * 7,
  secrets: [process.env.SESSION_SECRET ?? "dev-rotate"],
});
```

Usage in the action:

```ts
const setCookie = await cookie.serialize(nextState);
return data({ ok: true }, { headers: { "Set-Cookie": setCookie } });
```

Usage in the loader:

```ts
const state = await cookie.parse(request.headers.get("Cookie"));
```

Important properties:
- `httpOnly`: JS cannot read the cookie → defeats XSS theft.
- `sameSite: "lax"`: cookie is NOT sent on cross-site POSTs → blocks CSRF
  for the common case. Fully pinning to `"strict"` breaks login redirects.
- `secure: PROD`: cookie only sent over HTTPS in production. Auto-disabled
  in dev so you can test on `http://localhost`.
- `secrets`: for signing (detects tampering). Array is rotatable — prepend
  a new secret, keep old ones to accept existing cookies during rollover.

Our bet slip stores only refs, not prices — prices are joined server-side
on every read. This keeps the cookie small and guarantees fresh odds.

---

## 10. Resource routes (sneak peek of Phase 7)

A route module with only `loader` and/or `action` (no default export) is a
**resource route**. React Router treats it as a pure endpoint. Uses:

- API for `<fetcher.Form>` (our `/bet-slip`)
- Non-HTML responses: `/sitemap.xml`, `/feed.rss`, `/reports/bets.csv`
- Webhooks: `POST /webhooks/stripe`

Resource routes can still:
- Return redirects (`redirect(...)`)
- Set any headers (`data(v, { headers })`)
- Access session cookies
- Use `params` (e.g. `/api/event/:id/odds`)

We'll build a real `Content-Type: text/csv` one in Phase 7.

---

## 11. Framework-mode idioms worth memorizing

- **Never do** `fetch("/api/...")` from `useEffect`. Use a loader or a fetcher.
- **Never do** `router.refresh()`-style manual cache busts. Mutations
  revalidate automatically.
- **Progressive enhancement for free**: all `<Form>` and `<fetcher.Form>`
  submissions work **without JavaScript**. Turn JS off and add/remove
  selections — it still works (the page reloads, but the action runs and
  the cookie is updated). This is a senior-level selling point.
- **`Set-Cookie` on actions, not loaders**: loaders CAN set cookies via
  `data(..., { headers: { "Set-Cookie" } })`, but it's unusual. If a
  loader needs to write state, reconsider — usually it's an action's job.

---

## 12. Senior-level interview questions

1. Describe the lifecycle of a `<fetcher.Form>` submit end-to-end, from
   click to UI update. Which functions run on server vs client?
2. You use `<Form method="post" action="/login">`. Login succeeds and the
   action returns `redirect("/account")`. What happens? What if it returns
   `data({ ok: true })` instead?
3. Why is `<fetcher.Form>` better than `useState + fetch()` for inline
   mutations? Give three concrete reasons.
4. A user with a flaky connection clicks "Add to slip" twice in 200ms.
   What does RR do? How would you ensure at most one is in flight?
5. Your action returns `redirect("/x")` but the user triggered it via a
   `useFetcher()`. Does the page navigate? Why?
6. When does `useActionData()` return non-undefined? And when does
   `fetcher.data` return non-undefined?
7. Walk through when the `_shell` loader re-runs: (a) direct navigation,
   (b) clicking a NavLink, (c) successful `/bet-slip` action, (d) failed
   `/bet-slip` action (400). Which re-run?
8. Why does this app's bet slip cookie store only refs, not prices?
9. Without JS, what happens when the user clicks an odds button?
10. You have three `useFetcher()`s in the same component. Two should share
    state (debounce key), one should be independent. How?
11. You need to upload a file. What changes in the form markup, and what
    changes server-side?
12. `httpOnly` vs `sameSite: "lax"` vs `secrets` on cookies — which
    defends against what?
13. Someone suggests calling `window.location.reload()` after a successful
    mutation to "make sure the UI is fresh". Why is this wrong in a
    framework-mode app?

---

## 13. Files touched this phase

- `app/lib/bet-slip.ts` — shared types + parlay math (client-safe)
- `app/lib/bet-slip.server.ts` — cookie IO + placed-bets store
- `app/routes/bet-slip.tsx` — action-only resource route
- `app/routes.ts` — registered `/bet-slip`
- `app/routes/_shell.tsx` — loader now returns `{ sports, betSlip }`
- `app/components/Header.tsx` — slip-count badge
- `app/components/BetSlipPanel.tsx` — full interactive panel with fetchers
- `app/components/EventCard.tsx` — odds buttons → `<fetcher.Form>`
- `app/routes/events.$eventId.tsx` — odds buttons → `<fetcher.Form>`

---

## 14. Things to try in the running app

1. Add three selections across different events. Watch the header badge,
   sidebar pending states, and BetSlipPanel all update from ONE action.
2. Open DevTools Network, click an odds button, watch the `POST /bet-slip`
   → then the auto-fired `.data` request revalidating the shell loader.
3. Change the stake and tab away. The stake input shows a small pulse
   while the save flies.
4. Click "Place bet" with an empty slip → you'll see the validation error
   inline.
5. Open two tabs of the app, place a bet in tab A, refresh tab B —
   server state is shared (the in-memory `PLACED_BETS` Map).
6. Turn JS off in devtools, add a selection. The page reloads but the
   cookie is set and the slip updates. Progressive enhancement in action.

---

## 15. What's next (Phase 4 preview)

**Streaming and live data.**
- `defer`-style returns: returning a `Promise` inside a loader object →
  `<Await>` + `<Suspense>` for incremental reveal.
- `useRevalidator()` to poll live odds without a full navigation.
- `request.signal` + abort-aware fetches.
- Race-condition pitfalls with fetchers (and how to avoid them).
- An actually-live `/live` page.
