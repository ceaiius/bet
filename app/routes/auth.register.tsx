import { Link } from "react-router";
import type { Route } from "./+types/auth.register";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Create account — BetLab" }];
}

export default function Register() {
  return (
    <div>
      <h1 className="text-xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-gray-400">
        Real implementation (validation, password hashing, cookie session)
        is Phase 5.
      </p>

      <p className="mt-6 text-sm text-gray-400">
        Already have an account?{" "}
        <Link to="/login" className="text-emerald-300 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
