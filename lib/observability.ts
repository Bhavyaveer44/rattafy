import * as Sentry from "@sentry/nextjs";

/** Report a safe, structured server error without recording request or provider content. */
export function reportServerError(event: string, route: string, error: unknown) {
  const errorType = error instanceof Error ? error.name : "UnknownError";

  console.error(JSON.stringify({
    level: "error",
    event,
    route,
    errorType,
    timestamp: new Date().toISOString(),
  }));

  Sentry.withScope((scope) => {
    scope.setTag("route", route);
    scope.setTag("error_type", errorType);
    scope.setTag("event", event);
    // Keep the failing call stack while replacing its message with a safe event name.
    const safeError = new Error(event);
    safeError.name = errorType;
    if (error instanceof Error && error.stack) {
      const stackFrames = error.stack.split("\n").slice(1).join("\n");
      safeError.stack = `${errorType}: ${event}${stackFrames ? `\n${stackFrames}` : ""}`;
    }
    Sentry.captureException(safeError);
  });
}
