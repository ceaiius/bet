import {
  Form,
  Link,
  data,
  useNavigation,
  useSearchParams,
} from "react-router";
import type { Route } from "./+types/auth.register";

import {
  createUserSession,
  requireAnonymous,
} from "~/lib/auth.server";
import { RegistrationError, registerUser } from "~/lib/users.server";

/**
 * ===========================================================================
 * /register  —  Phase 5
 * ===========================================================================
 * Same shape as /login but with more validation, a confirm-password field,
 * and auto-login on success (we call `createUserSession` immediately so the
 * user doesn't have to type their password a second time).
 *
 * Pattern worth noting: `RegistrationError` is thrown by the data layer
 * with a stable `code`. The action catches it and forwards the code + a
 * human message to the UI. Separating "which thing failed" from "what to
 * show" lets us localize messages or render field-specific errors without
 * parsing English.
 * ===========================================================================
 */

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign up — BetLab" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAnonymous(request);
  return null;
}

type ActionError = {
  formError?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
    confirm?: string;
    displayName?: string;
  };
  values?: { email?: string; displayName?: string };
};

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/account");

  const fieldErrors: NonNullable<ActionError["fieldErrors"]> = {};
  if (!email) fieldErrors.email = "Email is required.";
  if (!displayName) fieldErrors.displayName = "Display name is required.";
  if (password.length < 8)
    fieldErrors.password = "At least 8 characters.";
  if (password !== confirm) fieldErrors.confirm = "Passwords don't match.";

  if (Object.keys(fieldErrors).length > 0) {
    return data<ActionError>(
      { fieldErrors, values: { email, displayName } },
      { status: 400 }
    );
  }

  try {
    const user = await registerUser({ email, password, displayName });
    return createUserSession({
      request,
      userId: user.id,
      redirectTo,
      flash: `Welcome, ${user.displayName}! You got $100 on the house.`,
    });
  } catch (err) {
    if (err instanceof RegistrationError) {
      const field =
        err.code === "email_taken" || err.code === "invalid_email"
          ? "email"
          : err.code === "weak_password"
          ? "password"
          : err.code === "name_required"
          ? "displayName"
          : undefined;
      return data<ActionError>(
        {
          fieldErrors: field ? { [field]: err.message } : undefined,
          formError: field ? undefined : err.message,
          values: { email, displayName },
        },
        { status: 400 }
      );
    }
    throw err; // bubble to ErrorBoundary
  }
}

export default function Register({ actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();

  const pending =
    navigation.state === "submitting" &&
    navigation.formAction?.endsWith("/register");

  const redirectTo = searchParams.get("redirectTo") ?? "";

  return (
    <div>
      <h1 className="text-xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-gray-400">
        New accounts get a $100 welcome balance.
      </p>

      <Form method="post" className="mt-6 flex flex-col gap-3" noValidate>
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <Field
          label="Display name"
          name="displayName"
          autoComplete="nickname"
          defaultValue={actionData?.values?.displayName}
          error={actionData?.fieldErrors?.displayName}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={actionData?.values?.email}
          error={actionData?.fieldErrors?.email}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={actionData?.fieldErrors?.password}
        />
        <Field
          label="Confirm password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          error={actionData?.fieldErrors?.confirm}
        />

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
          {pending ? "Creating account…" : "Sign up"}
        </button>
      </Form>

      <p className="mt-6 text-sm text-gray-400">
        Already have an account?{" "}
        <Link
          to={{
            pathname: "/login",
            search: redirectTo
              ? `?redirectTo=${encodeURIComponent(redirectTo)}`
              : undefined,
          }}
          className="text-emerald-300 hover:underline"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}

// Small presentational helper to keep the form compact.
function Field({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  error?: string;
}) {
  const errId = error ? `${name}-error` : undefined;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-300">{label}</span>
      <input
        type={type}
        name={name}
        autoComplete={autoComplete}
        required
        defaultValue={defaultValue ?? ""}
        aria-invalid={Boolean(error)}
        aria-describedby={errId}
        className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-emerald-400/60"
      />
      {error && (
        <span id={errId} className="text-xs text-red-300">
          {error}
        </span>
      )}
    </label>
  );
}
