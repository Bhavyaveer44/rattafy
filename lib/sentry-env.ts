const REQUIRED_SENTRY_ENV = [
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "SENTRY_AUTH_TOKEN",
] as const;

export function assertProductionSentryConfig() {
  if (process.env.NODE_ENV !== "production") return;

  const missing = REQUIRED_SENTRY_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Production monitoring is required. Set: ${missing.join(", ")}`);
  }

  if (process.env.SENTRY_DSN !== process.env.NEXT_PUBLIC_SENTRY_DSN) {
    throw new Error("SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN must match.");
  }
}
