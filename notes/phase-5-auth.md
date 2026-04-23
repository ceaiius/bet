# Phase 5 — Authentication: cookie sessions from scratch

This phase replaces the Phase 1 auth stubs with a real end-to-end auth
flow. Everything is built from React Router primitives — no Clerk, no
Auth.js, no Firebase. The goal is to understand what those libraries do
under the hood, because in a real sportsbook codebase you'll almost
certainly have a bespoke auth flow (KYC, risk checks, multi-device
enforcement) and hand-rolled session handling.

---

## 1. Mental model — three layers

```
┌───────────────────────────┐
│ Route: login/register/…   │  ← validate form, return data() or redirect()
│   action → createUserSession
└──────────────┬────────────┘
               │
┌──────────────▼────────────┐
│ auth.server.ts            │  ← session cookie, flash, getUser/requireUser
│   (framework glue)        │
└──────────────┬────────────┘
               │
┌──────────────▼────────────┐
│ users.server.ts           │  ← hashPassword, verifyCredentials, store
│   (domain + persistence)  │
└───────────────────────────┘
```

Strict separation matters: the route doesn't know how passwords are
hashed, the hash layer doesn't know about cookies, and the cookie layer
doesn't know about users beyond an opaque `userId` string. Swapping any
one of these (e.g. moving from scrypt to argon2, or from cookie-only
sessions to server-side sessions) touches a single file.

## 2. Password hashing (`users.server.ts`)

```ts
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const salt = randomBytes(16).toString("hex");
const derived = scryptSync(password, salt, 64).toString("hex");
// store:   `${salt}:${derived}`
```

Non-obvious rules:

1. **Unique per-user salt.** A shared salt makes rainbow tables trivial.
2. **Slow, memory-hard KDF.** `scrypt` / `argon2` / `bcrypt`. Never MD5,
   SHA-1, or plain SHA-256. The point is that verifying one password
   should take ~10–100ms — fast for a login, agonizing for a brute-forcer.
3. **`timingSafeEqual` for comparison.** `Buffer.compare` and `===` both
   short-circuit on the first differing byte. Attackers measure response
   time to infer the hash byte-by-byte. `timingSafeEqual` reads every
   byte unconditionally.
4. **Dummy verification on unknown email.** If "unknown email" returns
   in 1ms and "known email, wrong password" takes 100ms, anyone can
   enumerate your user list. Run `verifyPassword` against a dummy hash
   even on the unknown-user path so timings match.

## 3. Cookie session storage (`auth.server.ts`)

```ts
const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,  // blocks `document.cookie` reads (XSS-hardening)
    path: "/",
    sameSite: "lax", // blocks cross-site POSTs (CSRF-hardening)
    secure: import.meta.env.PROD,
    secrets: [process.env.SESSION_SECRET ?? "dev-only"],
    maxAge: 60 * 60 * 24 * 30,
  },
});
```

`createCookieSessionStorage` gives you `session.get/set/flash/unset` plus
`commitSession` / `destroySession` helpers. **The entire session lives
inside the cookie.** Since cookies are capped at ~4KB and sent with
every request, you MUST keep payloads tiny — `{ userId, flash }` only.

For larger sessions, swap to `createFileSessionStorage`,
`createMemorySessionStorage`, or a DB-backed implementation. Those put
the data server-side; only a session ID rides the cookie.

### Cookie hardening checklist

| Attribute        | Defends against                     |
|------------------|-------------------------------------|
| `httpOnly`       | XSS-driven cookie theft             |
| `sameSite=lax`   | CSRF for non-idempotent routes      |
| `secure`         | MITM on plain HTTP                  |
| Signed (secrets) | Tamper (user flipping userId=…)     |
| Short `maxAge`   | Stolen-cookie blast radius          |

**Secret rotation.** `secrets` is an array. The FIRST secret signs new
cookies; ALL of them are accepted for verification. To rotate: add a new
secret to the front, deploy, wait one session lifetime, remove the old.

## 4. The auth helpers API

```ts
getUserId(request)           // → string | undefined       — cheap
getUser(request)             // → PublicUser | null        — DB read
requireUser(request, ?to)    // → PublicUser (or throws redirect to /login)
requireAnonymous(request)    // → void     (or throws redirect to /account)
createUserSession({ ... })   // → Response (Set-Cookie + redirect)
logout(request)              // → Response (destroy cookie + redirect)
consumeFlash(request)        // → { message, setCookieHeader }
```

Three things worth internalizing:

1. **Throwing a redirect is the idiomatic short-circuit.** Loaders and
   actions return `Response`; throwing a `Response` (via `redirect()`)
   cleanly unwinds the stack — same pattern as `throw new Response(…,
   { status: 404 })` from Phase 2.

2. **`requireUser` = "this loader ONLY runs when authed."** After the
   call, `user` is non-null. No `if (!user) return null` conditionals in
   the component; no flickering of protected content.

3. **`redirectTo` must be sanitized.** User-supplied redirect URLs are a
   classic open-redirect vector. Allow only paths that start with `/`
   and not `//` (protocol-relative). See `safeRedirectTo`.

## 5. The login action, annotated

```ts
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/account");

  const fieldErrors = {} as { email?: string; password?: string };
  if (!email) fieldErrors.email = "Email is required.";
  if (!password) fieldErrors.password = "Password is required.";
  if (Object.keys(fieldErrors).length)
    return data({ fieldErrors, email }, { status: 400 });

  const user = await verifyCredentials(email, password);
  if (!user)
    return data({ formError: "Invalid email or password.", email }, { status: 400 });

  return createUserSession({ request, userId: user.id, redirectTo,
    flash: `Welcome back, ${user.displayName}.` });
}
```

- **Field errors vs. form errors.** Field-level issues go under the
  specific input. Credentials-level "invalid email or password" is a
  form-level message — deliberately vague so we don't confirm account
  existence.
- **Preserve the email field.** Returning it in `actionData.email` so the
  re-rendered form can `defaultValue={actionData.email}`. Classic UX
  detail that's easy to forget.
- **Status 400 on validation failure** so clients / test tools treat the
  response properly; it also prevents browsers from caching a failed
  attempt.

## 6. Flash messages — one-shot notices

`session.flash(key, value)` stores a value that `session.get(key)`
consumes. The flow:

```
login action: session.flash("flash", "Welcome back!") → commit → redirect
                                                                     │
                                                                     ▼
_shell loader:  consumeFlash(request)   ← reads + clears + commits session
                                        → returns { message, setCookieHeader }
                                        → attaches Set-Cookie to response
                                                                     │
                                                                     ▼
_shell component renders <FlashToast message={flash} key={flash} />
```

Two footguns:

- **You MUST commit the session after reading the flash.** `session.get`
  marks it for removal, but only `commitSession` actually persists the
  removal to the cookie. Miss the commit and the toast shows every time
  you navigate.
- **Key the toast on the message string.** Otherwise back-to-back
  flashes with the same identity won't re-trigger the fade-in.

## 7. Protected mutation: the "place" bet intent

Before Phase 5, anyone could place a bet. Now the action does:

```ts
case "place": {
  const userId = await getUserId(request);
  if (!userId) {
    const redirectTo = request.headers.get("Referer") ?? "/";
    throw redirect(`/login?redirectTo=${encodeURIComponent(pathFor(redirectTo))}`);
  }
  // ...proceed with placement, tagging the ticket with userId
}
```

Why guard in the **action** and not the component?

- Actions are the only place where the state transition happens. A
  component-level check is UX ("hide the button"); an action-level check
  is SECURITY (doesn't matter if the client hides the button, you still
  can't place without a session).
- Short-circuiting with `throw redirect(...)` hands control to RR.
  `fetcher.Form` correctly follows the redirect into a top-level
  navigation — the user lands on `/login?redirectTo=…`, logs in, comes
  back.

## 8. `<Form>` vs `<fetcher.Form>` in auth flows

- `<Form method="post">` — **navigates**. Login and register should
  navigate so the URL changes and subsequent refreshes don't resubmit
  the form.
- `<fetcher.Form>` — stays on the page. Useful for "update profile"
  style actions inside `/account`, or for the bet-slip mutations. We
  also use a regular `<Form>` for logout because logout redirects the
  user elsewhere anyway.

## 9. Progressive enhancement

All of Phase 5 works with JavaScript disabled:

- `<Form method="post">` submits a normal HTML form. The action runs
  server-side, returns a redirect, the browser navigates.
- The logout button is a `<button type="submit">` inside a `<Form>`.
- The flash message is plain HTML rendered by the server on the next
  response. No hydration required.

The JavaScript enhancement layer adds pending states (`useNavigation`),
error re-rendering (`actionData`), and the toast fade-out.

## 10. What we did NOT implement (and how you'd approach them)

| Feature                      | Approach                                                                |
|------------------------------|-------------------------------------------------------------------------|
| CSRF tokens                  | Double-submit cookie or per-session token in a hidden `<input>`.        |
| Rate limiting                | Middleware / reverse proxy. Track attempts per IP + email.              |
| Remember-me vs session       | Separate cookie with longer `maxAge`; require re-auth for sensitive ops.|
| Email verification           | Generate token, mail a link that hits `/verify?token=…`.                |
| Password reset               | One-use token stored in DB with short expiry; link mailed to user.      |
| 2FA (TOTP / WebAuthn)        | A second action after password; set `session.twoFactorPassed=true`.     |
| Remote session invalidation  | Switch to server-side session storage; keep a `revokedAt` column.       |
| Device fingerprinting        | Additional signal; never the primary auth factor.                       |

In a regulated sportsbook, **most** of those are mandatory (KYC, AML,
age verification, jurisdiction checks). The cookie-session piece we
built here is the 10% of auth you actually write yourself; the other
90% is compliance plumbing around it.

## 11. Senior-level interview questions

1. Walk through exactly which HTTP requests and `Set-Cookie` headers fly
   on a successful login, from the click to the user seeing `/account`.
2. Cookie-only sessions vs. server-side sessions — when would you pick
   each, and what changes in `auth.server.ts`?
3. What attacks does `httpOnly` defend against? What attacks does it
   NOT defend against?
4. `sameSite=lax` vs. `strict` vs. `none`. When is each appropriate,
   and which one risks breaking SSO flows?
5. How do `session.flash` and `session.get` interact with `commitSession`?
   What happens if you forget the commit?
6. Your `requireUser` helper throws a redirect. Why throw rather than
   return? What's the difference to the caller?
7. Describe the open-redirect vulnerability in `?redirectTo=…` and the
   exact rules you'd enforce to prevent it.
8. Why must password verification use `timingSafeEqual`? Give a concrete
   attacker scenario where `===` would leak information.
9. When registering, why run a dummy `verifyPassword` on unknown-email
   paths? What does that change is provable at the HTTP layer?
10. How would you rotate `SESSION_SECRET` with zero downtime, and what
    invariants does the `secrets: [...]` array rely on?
11. The logout button is a `<Form method="post">` — why not a
    `<Link to="/logout">`? Name two concrete bugs the `<Link>` approach
    invites.
12. In this app we `throw redirect(...)` from the action when an
    anonymous user tries to place a bet. Sketch an alternative design
    where the slip is preserved across the login hop.
13. `actionData` gives you errors back after a failed login. What would
    you change to progressively enhance the error UI (announce to screen
    readers, focus management, etc.)?
14. The shell loader now reads the user on every request. How expensive
    is that, and what would you cache / memoize?
15. If you moved this app behind a CDN, which responses become
    un-cacheable because of authentication? How do you mark them?

---

## What's wired up

- `app/lib/users.server.ts` — User store, scrypt hashing,
  `verifyCredentials`, `registerUser`.
- `app/lib/auth.server.ts` — session storage, `getUser`, `requireUser`,
  `requireAnonymous`, `createUserSession`, `logout`, `consumeFlash`,
  `safeRedirectTo`.
- `app/routes/auth.login.tsx` — loader guard + action + error-preserving
  form.
- `app/routes/auth.register.tsx` — same shape plus confirm password and
  auto-login on success.
- `app/routes/logout.tsx` — action-only resource route.
- `app/routes/account.tsx` — protected route with per-user bet history.
- `app/routes/bet-slip.tsx` — `place` intent now requires auth; tickets
  are tagged with `userId`.
- `app/routes/_shell.tsx` — loads user + flash in parallel, attaches
  `Set-Cookie` when flash is consumed.
- `app/components/Header.tsx` — `UserMenu` with avatar + logout form.
- `app/components/FlashToast.tsx` — one-shot notification.
- `app/routes.ts` — registered `/account` and `/logout`.

## Try this in the browser

1. Hit `/account` while logged out. You get redirected to
   `/login?redirectTo=%2Faccount`. Log in as `alice@betlab.test` /
   `password123`. You land on `/account` with a "Welcome back, Alice."
   toast.
2. Wrong password: error appears inline; the email input keeps its
   value. Try an empty email: field-level error under the input.
3. Register a new account. You get auto-logged-in with a $100 welcome
   balance and a toast.
4. Log out — the cookie disappears and you're back to the anonymous
   header with Log in / Sign up.
5. Log in as Bob, place a bet on `/events/:eventId`. Go to `/account` —
   Bob sees his bet. Log out, log in as Alice. Alice's `/account` is
   clean. Two parallel histories from one in-memory `Map`.
6. While logged out, add a selection and click **Place bet** in the
   slip. You get redirected to `/login?redirectTo=…` — Phase 5's
   action-level auth guard in action.
7. Open DevTools → Application → Cookies. See `__session` and
   `__bet_slip` — both `HttpOnly`, both `SameSite=Lax`. The one sports
   books need to keep scrutinizing for a living.
