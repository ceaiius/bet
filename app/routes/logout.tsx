import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { logout } from "~/lib/auth.server";

/**
 * ===========================================================================
 * /logout — resource route (action only)
 * ===========================================================================
 * Why POST (action) and not GET (loader):
 *   Logout MUTATES server state (it destroys a session). GET requests are
 *   supposed to be safe + idempotent; putting destructive actions behind
 *   GETs is how "prefetcher logged me out" bugs happen — e.g. an email
 *   security scanner or browser prefetch hits /logout and nukes the
 *   session. POST + a <Form> makes the intent explicit.
 *
 * The Header renders `<Form action="/logout" method="post">` with a
 * submit button. No JavaScript required — progressive enhancement.
 * ===========================================================================
 */

export async function loader() {
  // Direct GET → just bounce home. We don't leak a 405 here because browser
  // prefetchers might hit it and there's no user harm in a plain redirect.
  return redirect("/");
}

export async function action({ request }: Route.ActionArgs) {
  return logout(request);
}
