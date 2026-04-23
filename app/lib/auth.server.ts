import { createCookieSessionStorage, redirect } from "react-router";
import { getUserById, type PublicUser } from "./users.server";

/**
 * ===========================================================================
 * auth.server.ts — session cookies, flash messages, and auth helpers
 * ===========================================================================
 *
 * `createCookieSessionStorage` is React Router's built-in session primitive.
 * Under the hood it's still a `Cookie` — but with a Session abstraction
 * layered on top (`session.get/set/flash/unset`, plus `commitSession` and
 * `destroySession` helpers).
 *
 * Two styles of cookie session storage exist:
 *
 *   - createCookieSessionStorage  → entire session lives INSIDE the cookie
 *                                   (what we use). Stateless. Good for
 *                                   userId + a flash message. Max ~4KB.
 *   - createFileSessionStorage /
 *     createMemorySessionStorage → cookie stores only a session ID; the
 *                                   payload lives server-side. Required if
 *                                   you need large sessions or want to
 *                                   invalidate a logged-in user remotely.
 *
 * For this app we store ONLY { userId, flash }, both tiny, so cookie
 * storage is the right trade-off: zero server state, horizontally scalable,
 * and one network round-trip.
 * ===========================================================================
 */

// In real deployments this MUST come from process.env, rotated regularly.
// `secrets` is an array: the first one signs new cookies; all of them are
// accepted when verifying. Add a new secret to the FRONT of the array,
// wait for old cookies to expire, then remove the old one.
const SESSION_SECRETS = [
  process.env.SESSION_SECRET ?? "dev-only-session-secret-rotate-me",
];

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true, // defeats JS `document.cookie` exfiltration (XSS)
    path: "/",
    sameSite: "lax", // blocks most CSRF while allowing top-level GETs
    secure: import.meta.env.PROD, // HTTPS-only in production
    secrets: SESSION_SECRETS,
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
});

// ---------------------------------------------------------------------------
// Low-level session helpers. Prefer the higher-level APIs below in routes.
// ---------------------------------------------------------------------------

export function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export function commitSession(
  session: Awaited<ReturnType<typeof getSession>>
) {
  return sessionStorage.commitSession(session);
}

export function destroySession(
  session: Awaited<ReturnType<typeof getSession>>
) {
  return sessionStorage.destroySession(session);
}

// ---------------------------------------------------------------------------
// High-level auth API used from loaders & actions
// ---------------------------------------------------------------------------

/**
 * Read `userId` from the session. Returns `undefined` for anonymous users.
 * Cheap — doesn't touch the user store.
 */
export async function getUserId(request: Request): Promise<string | undefined> {
  const session = await getSession(request);
  const userId = session.get("userId");
  return typeof userId === "string" ? userId : undefined;
}

/**
 * Read the full `PublicUser` for the current session, or `null`.
 * Use this in loaders that want to render user-specific UI.
 */
export async function getUser(request: Request): Promise<PublicUser | null> {
  const userId = await getUserId(request);
  if (!userId) return null;
  const user = await getUserById(userId);
  return user;
}

/**
 * Enforce authentication. If there's no user, THROWS a redirect to /login
 * with a `?redirectTo=<currentPath>` query so the user returns here after
 * logging in.
 *
 * Why `throw redirect(...)` not `return`:
 *   Loaders and actions run in a stack — throwing a Response short-circuits
 *   further work and lets React Router handle the redirect at the
 *   framework layer. It's the same pattern as `throw new Response(...)`
 *   for 404s. Cleaner than returning a redirect from every caller.
 */
export async function requireUser(
  request: Request,
  redirectTo?: string
): Promise<PublicUser> {
  const user = await getUser(request);
  if (user) return user;

  const url = new URL(request.url);
  const target = redirectTo ?? url.pathname + url.search;
  const params = new URLSearchParams({ redirectTo: target });
  throw redirect(`/login?${params.toString()}`);
}

/**
 * Used on /login and /register — if already logged in, kick to /account.
 * Also supports honoring a `redirectTo` query so you can't hang out on
 * the login page after submitting.
 */
export async function requireAnonymous(
  request: Request,
  fallbackRedirect = "/account"
): Promise<void> {
  const userId = await getUserId(request);
  if (!userId) return;
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirectTo") ?? fallbackRedirect;
  throw redirect(safeRedirectTo(redirectTo, fallbackRedirect));
}

/**
 * Log in the user: write userId to session, attach optional flash message,
 * and redirect to the requested path.
 *
 * Note the `headers.append` dance — an action may be setting OTHER cookies
 * (e.g. the bet-slip cookie). If we used `{ "Set-Cookie": commit }` we'd
 * clobber them. `Headers` with `.append` preserves duplicates.
 */
export async function createUserSession({
  request,
  userId,
  redirectTo,
  flash,
}: {
  request: Request;
  userId: string;
  redirectTo: string;
  flash?: string;
}): Promise<Response> {
  const session = await getSession(request);
  session.set("userId", userId);
  if (flash) session.flash("flash", flash);

  const headers = new Headers();
  headers.append("Set-Cookie", await commitSession(session));

  return redirect(safeRedirectTo(redirectTo, "/"), { headers });
}

/**
 * Destroy the session and redirect to `/`. `destroySession` sends a
 * `Set-Cookie` with `Max-Age=0` so the browser drops it.
 */
export async function logout(request: Request): Promise<Response> {
  const session = await getSession(request);
  return redirect("/", {
    headers: { "Set-Cookie": await destroySession(session) },
  });
}

// ---------------------------------------------------------------------------
// Flash messages
// ---------------------------------------------------------------------------

/**
 * Read (and consume) a flash message. `session.flash(key, value)` stores a
 * value that is REMOVED on the next `session.get(key)` — perfect for
 * one-time notices like "Welcome back, Alice!".
 *
 * The contract: if we read a flash, we MUST commit the session so the
 * removal actually persists in the cookie. Otherwise the value re-appears
 * on the next request — an infinite "welcome back" greeting. Ask me how I
 * know.
 *
 * Returns `{ message, headers }` so callers can attach the Set-Cookie they
 * need. If there was no flash, `headers` is undefined and you can skip it.
 */
export async function consumeFlash(request: Request): Promise<{
  message: string | null;
  setCookieHeader: string | null;
}> {
  const session = await getSession(request);
  const message = session.get("flash");
  if (!message) return { message: null, setCookieHeader: null };
  // The get() above already removed the flash internally; we must commit.
  return {
    message: String(message),
    setCookieHeader: await commitSession(session),
  };
}

// ---------------------------------------------------------------------------
// redirectTo sanitization — NEVER trust URLs from user input
// ---------------------------------------------------------------------------

/**
 * Prevents the classic "open redirect" bug.
 *
 * Attacker sends:  /login?redirectTo=https://evil.com
 * Victim logs in → gets bounced to evil.com → phish.
 *
 * Rule: only allow relative paths that start with "/" and NOT "//" (which
 * is protocol-relative and would navigate to an external host).
 */
function safeRedirectTo(to: string, fallback: string): string {
  if (typeof to !== "string") return fallback;
  if (!to.startsWith("/")) return fallback;
  if (to.startsWith("//")) return fallback;
  return to;
}
