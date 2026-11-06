import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { assertProductionSentryConfig } from "./lib/sentry-env";

assertProductionSentryConfig();

const nextConfig: NextConfig = {
  // Pin the workspace root — a stray lockfile in the home folder confuses inference
  turbopack: { root: __dirname },
  experimental: { proxyClientMaxBodySize: "4mb" },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: false },
  silent: !process.env.CI,
});
