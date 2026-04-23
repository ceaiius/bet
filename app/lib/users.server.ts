import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * ===========================================================================
 * users.server.ts — the in-memory user "database"
 * ===========================================================================
 * This is a DEMO-grade user store. The password-hashing code, however, is
 * real: we use Node's built-in `scrypt` (a memory-hard KDF recommended by
 * OWASP) with a per-user random salt and `timingSafeEqual` for comparison.
 *
 * What we would swap in production:
 *   - The `USERS` Map → a SQL/Postgres/Prisma call.
 *   - `scrypt` is fine, but teams more often use `argon2id` via a native
 *     binding. Same shape; different constants. NEVER roll your own.
 *   - `bcrypt` is also acceptable (still widely deployed). DO NOT ever
 *     store raw passwords, MD5, SHA-1, or unsalted SHA-256. Ever.
 *
 * Why `.server.ts`:
 *   Node's `crypto` module does NOT exist in the browser bundle. React
 *   Router's compiler guarantees a file with this suffix (and its
 *   transitive imports) never ships to the client. If this file somehow
 *   got imported by a component, the build would fail loudly — exactly
 *   what we want around anything touching password hashes.
 * ===========================================================================
 */

export type User = {
  id: string;
  email: string;
  displayName: string;
  /** Stored as `salt:hash` in hex. Only exposed inside this module. */
  passwordHash: string;
  /** Wallet balance in whole dollars (demo precision). */
  balance: number;
  createdAt: string;
};

/** Safe subset returned to loaders/components. NEVER expose passwordHash. */
export type PublicUser = Omit<User, "passwordHash">;

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

/**
 * scrypt constants (N=16384, r=8, p=1) are the Node defaults. keylen=64
 * is overkill-safe. Increase N to slow down brute force at the cost of
 * login latency (OWASP 2024 recommends N ≥ 2^17 if latency allows).
 */
const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  if (expected.length !== actual.length) return false;

  // `timingSafeEqual` compares all bytes regardless of where they differ.
  // A naive `===` would return early on the first mismatched byte, leaking
  // information about the hash via response timing. This is the textbook
  // "timing attack" defence.
  return timingSafeEqual(expected, actual);
}

// ---------------------------------------------------------------------------
// The store
// ---------------------------------------------------------------------------

const USERS = new Map<string, User>();

// Seed two demo users so you can log in immediately without registering.
// Credentials intentionally weak + obvious for dev UX.
seedUser({
  email: "alice@betlab.test",
  displayName: "Alice",
  password: "password123",
  balance: 500,
});
seedUser({
  email: "bob@betlab.test",
  displayName: "Bob",
  password: "password123",
  balance: 250,
});

function seedUser(input: {
  email: string;
  displayName: string;
  password: string;
  balance: number;
}) {
  const id = `usr_${USERS.size + 1}`;
  USERS.set(id, {
    id,
    email: input.email.toLowerCase(),
    displayName: input.displayName,
    passwordHash: hashPassword(input.password),
    balance: input.balance,
    createdAt: new Date().toISOString(),
  });
}

function toPublic(user: User): PublicUser {
  // Destructure explicitly so a future field can't silently leak.
  const { passwordHash: _omit, ...safe } = user;
  return safe;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getUserById(id: string): Promise<PublicUser | null> {
  const user = USERS.get(id);
  return user ? toPublic(user) : null;
}

export async function getUserByEmail(
  email: string
): Promise<PublicUser | null> {
  for (const user of USERS.values()) {
    if (user.email === email.toLowerCase()) return toPublic(user);
  }
  return null;
}

/**
 * Validate an email+password pair. Returns the PublicUser on success.
 *
 * Small-but-critical detail: when the email doesn't exist, we STILL run a
 * dummy `verifyPassword` call against a synthetic hash. Without this,
 * "login with unknown email" returns in ~1ms while "login with known email
 * but wrong password" takes ~100ms. That timing gap lets attackers
 * enumerate which emails are registered — a privacy leak in consumer apps
 * and outright dangerous in enterprise ones.
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<PublicUser | null> {
  const normalized = email.toLowerCase();
  let match: User | null = null;
  for (const user of USERS.values()) {
    if (user.email === normalized) {
      match = user;
      break;
    }
  }
  if (!match) {
    // Dummy hash so timing is comparable. Known-hash for a random password.
    verifyPassword("_dummy_input_", DUMMY_HASH);
    return null;
  }
  if (!verifyPassword(password, match.passwordHash)) return null;
  return toPublic(match);
}

const DUMMY_HASH = hashPassword("_dummy_seed_");

/**
 * Create a new user. Throws a user-facing Error with a stable `code` on
 * validation failure so the route action can render a nice error message.
 */
export class RegistrationError extends Error {
  constructor(
    public code:
      | "email_taken"
      | "invalid_email"
      | "weak_password"
      | "name_required",
    message: string
  ) {
    super(message);
    this.name = "RegistrationError";
  }
}

export async function registerUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<PublicUser> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RegistrationError("invalid_email", "Please enter a valid email.");
  }
  if (input.password.length < 8) {
    throw new RegistrationError(
      "weak_password",
      "Password must be at least 8 characters."
    );
  }
  if (!displayName) {
    throw new RegistrationError("name_required", "Display name is required.");
  }

  const existing = await getUserByEmail(email);
  if (existing) {
    throw new RegistrationError(
      "email_taken",
      "An account with that email already exists."
    );
  }

  const id = `usr_${USERS.size + 1}`;
  const user: User = {
    id,
    email,
    displayName,
    passwordHash: hashPassword(input.password),
    balance: 100, // new-user signup bonus
    createdAt: new Date().toISOString(),
  };
  USERS.set(id, user);
  return toPublic(user);
}
