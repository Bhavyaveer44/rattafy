"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center text-zinc-100">
        <h2 className="text-2xl font-bold">Something went wrong</h2>
        <p className="max-w-md text-sm text-zinc-400">
          Rattafy couldn’t load this page. Try again, or return to the app.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => reset()}
            className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-emerald-400"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-zinc-700 px-4 py-2 font-semibold hover:bg-zinc-900"
          >
            Go home
          </Link>
        </div>
      </body>
    </html>
  );
}
