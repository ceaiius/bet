import { Form, Link, data, useNavigation, useSearchParams } from "react-router";
import type { Route } from "./+types/auth.login";

import {
  createUserSession,
  requireAnonymous,
} from "~/lib/auth.server";
import { verifyCredentials } from "~/lib/users.server";

/**
 * ===========================================================================
 * /login  —  Phase 5
 * ===========================================================================
 * Full loader + action implementation. Concepts demonstrated:
 *
 *   - `loader` that redirects AWAY from this page if the user is already
 *     authenticated. Prevents logged-in users from seeing the login form.
 *
 *   - `action` that validates credentials, issues a session cookie, and
 *     redirects to either `?redirectTo=…` or `/account`.
 *
 *   - Returning `data({ ... }, { status: 400 })` for validation failures,
 *     which the component reads via `actionData` on the `Route.ComponentProps`.
 *
 *   - `useNavigation().state` for a clean "Logging in…" pending state.
 *
 *   - Preserving the submitted email on failure — essential UX detail that
 *     's easy to forget. When the response is re-rendered, the form has
 *     already re-mounted, so we need `defaultValue={actionData?.email}`.
 *
 *   - `<Form method="post">` (not `fetcher.Form`) because we WANT this to
 *     navigate. A successful login should put us on the destination page.
 * ===========================================================================
 */

export function meta({}: Route.MetaArgs) {
  return [{ title: "Log in — BetLab" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  // If already signed in, bounce to /account (or ?redirectTo). Loader-level
  // guard is better than component-level because the redirect fires BEFORE
  // any HTML is generated — no flash of the login form.
  await requireAnonymous(request);
  return null;
}

type ActionError = {
  formError?: string;
  fieldErrors?: { email?: string; password?: string };
  email?: string; // preserved for re-render
};

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/account");

  // Field-level validation first — cheap, no DB.
  const fieldErrors: ActionError["fieldErrors"] = {};
  if (!email) fieldErrors.email = "Email is required.";
  if (!password) fieldErrors.password = "Password is required.";
  if (Object.keys(fieldErrors).length > 0) {
    return data<ActionError>(
      { fieldErrors, email },
      { status: 400 }
    );
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    // Generic message — don't reveal whether the email exists.
    return data<ActionError>(
      { formError: "Invalid email or password.", email },
      { status: 400 }
    );
  }

  return createUserSession({
    request,
    userId: user.id,
    redirectTo,
    flash: `Welcome back, ${user.displayName}.`,
  });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  const pending =
    navigation.state === "submitting" &&
    navigation.formAction?.endsWith("/login");

  const redirectTo = searchParams.get("redirectTo") ?? "";

  return (
    <div>
      <h1 className="text-xl font-bold">Log in</h1>
      <p className="mt-1 text-sm text-gray-400">
        Demo users: <code>alice@betlab.test</code> or{" "}
        <code>bob@betlab.test</code> (password <code>password123</code>).
      </p>

      <Form method="post" className="mt-6 flex flex-col gap-3" noValidate>
        {/* Hidden passthrough so the action knows where to return. */}
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-300">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            defaultValue={actionData?.email ?? ""}
            aria-invalid={Boolean(actionData?.fieldErrors?.email)}
            aria-describedby={
              actionData?.fieldErrors?.email ? "email-error" : undefined
            }
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
          />
          {actionData?.fieldErrors?.email && (
            <span id="email-error" className="text-xs text-red-300">
              {actionData.fieldErrors.email}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-300">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            aria-invalid={Boolean(actionData?.fieldErrors?.password)}
            aria-describedby={
              actionData?.fieldErrors?.password ? "password-error" : undefined
            }
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
          />
          {actionData?.fieldErrors?.password && (
            <span id="password-error" className="text-xs text-red-300">
              {actionData.fieldErrors.password}
            </span>
          )}
        </label>

        {actionData?.formError && (
          <div
            role="alert"
            className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          >
            {actionData.formError}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-gray-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Logging in…" : "Log in"}
        </button>
      </Form>

      <p className="mt-6 text-sm text-gray-400">
        No account?{" "}
        <Link
          to={{
            pathname: "/register",
            search: redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : undefined,
          }}
          className="text-emerald-300 hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
