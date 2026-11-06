import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Notice | Rattafy",
  description: "Learn what Rattafy collects and how account and study data is used.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-16">
      <Link href="/signin" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">Rattafy<span className="text-emerald-400">.</span></Link>
      <article className="mt-8 space-y-8">
        <header>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Privacy</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Privacy Notice</h1>
          <p className="mt-3 text-sm text-zinc-500">Last updated November 5, 2026</p>
          <p className="mt-5 max-w-2xl leading-relaxed text-zinc-300">
            This page explains what Rattafy handles when you create an account and use the study tools. Please don’t submit confidential or sensitive personal information.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Account information</h2>
          <p className="leading-relaxed text-zinc-400">
            Email signup and sign-in are provided by Supabase Auth. Supabase handles your credentials and account record; Rattafy uses your signed-in account to allow access to the planner and its generation APIs. Rattafy does not send your account email or password to AI providers.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Study material and AI providers</h2>
          <p className="leading-relaxed text-zinc-400">
            When you request a plan, prediction, answer, or OCR result, the relevant syllabus text, question-paper text, question, or image is sent from Rattafy’s server to one of the AI providers configured for the app. If a provider fails or is rate limited, Rattafy may retry the request or try another configured provider.
          </p>
          <p className="leading-relaxed text-zinc-400">
            Text-based PDFs are read in your browser. Scanned PDF pages and syllabus photos are compressed in your browser; image data is then sent to the app and an AI vision provider for text extraction. The original PDF file is not uploaded as a file to Rattafy’s server.
          </p>
          <p className="leading-relaxed text-zinc-400">
            AI providers process requests under their own terms and privacy practices. Rattafy does not control their retention or use of request data. Review the policies of the configured provider before submitting material you need to keep private.
          </p>
          <p className="leading-relaxed text-zinc-400">
            Rattafy is hosted on Vercel, which processes requests and the technical data needed to serve the app. Supabase provides account authentication. These services handle data under their own privacy practices.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">App storage and usage</h2>
          <p className="leading-relaxed text-zinc-400">
            Rattafy does not save plans or uploaded study material to your account history. App servers do use a temporary in-memory cache to reuse results and provide fallback results. It can contain submitted text and generated output, is not tied to an account, and may remain in a server process until it expires or that process ends. Stale results are eligible for fallback for up to seven days.
          </p>
          <p className="leading-relaxed text-zinc-400">
            Rattafy keeps aggregate totals for plans and predictions and uses Vercel Analytics for site usage metrics. The app does not send syllabus, paper, or answer content to the analytics integration.
          </p>
          <p className="leading-relaxed text-zinc-400">
            To enforce hourly request limits, the app uses your client IP address and signed-in account ID. The rate-limit service stores hashed identifiers and request counts rather than the raw IP address or account ID.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">Your choices</h2>
          <p className="leading-relaxed text-zinc-400">
            You can choose what text or files to submit and can sign out at any time. Rattafy currently has no self-service account deletion control; the project owner can delete an account through Supabase Auth. Signing out does not delete the account or remove prior data held by Supabase or an AI provider.
          </p>
        </section>

        <p className="border-t border-zinc-800 pt-5 text-xs leading-relaxed text-zinc-600">
          This notice describes the app’s current implementation and may change as its features and providers change.
        </p>
        <Link href="/signin" className="inline-flex rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-white">Go back</Link>
      </article>
    </main>
  );
}
