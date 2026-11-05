import { AuthPage } from "@/components/auth-page";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  confirmation_link_failed: "That confirmation link is invalid or expired. Sign in if your email is confirmed, or request a fresh confirmation email.",
  reset_link_failed: "That password reset link is invalid or expired. Request a fresh reset link to try again.",
  auth_not_configured: "Authentication is not configured. Please contact the app owner.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string | string[] }>;
}) {
  const params = await searchParams;
  const errorCode = Array.isArray(params.auth_error) ? params.auth_error[0] : params.auth_error;
  const initialMessage = errorCode ? AUTH_ERROR_MESSAGES[errorCode] ?? "We couldn't complete that email link. Please try again." : "";
  return (
    <AuthPage
      initialMessage={initialMessage}
      initialConfirmationPending={errorCode === "confirmation_link_failed"}
    />
  );
}
