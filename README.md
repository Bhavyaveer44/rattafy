# Rattafy

[rattafy.vercel.app](https://rattafy.vercel.app/)

Rattafy is an exam-prep assistant for students short on time. Give it a syllabus, the hours left, and optionally past exam papers. It builds a focused study plan and can predict likely questions with model answers.

## Features

- **Account access:** Email and password signup and sign-in with Supabase Auth, confirmation email resend, and password recovery. Authentication has its own `/signin` page. The planner and its generation endpoints require a signed-in account.
- **Study plans:** Paste a syllabus, choose hours remaining and a target, and get topics grouped into study, skim, and sacrifice priorities.
- **Syllabus photos:** Upload syllabus photos; Rattafy compresses them in the browser and extracts the text with AI vision.
- **Past papers:** Upload up to five PDFs. Text is extracted in the browser, with OCR fallback for scanned pages.
- **Question predictions:** Generate likely exam questions from the syllabus and optionally uploaded past papers.
- **Model answers:** Request an exam-style answer and examiner tip for predicted questions.
- **API safeguards:** Generation endpoints validate inputs, cap request sizes, and apply hourly quotas per account and client IP.
- **Error monitoring:** Sentry is required in production and captures unhandled app errors and AI/OCR failures; structured server logs omit submitted content and provider response text.
- **Privacy notice:** `/privacy` explains what account and study data the app and its configured AI providers handle.
- **Resilient AI requests:** Configured AI providers are tried in sequence, with retries, provider cooldowns, cached results, and stale-cache fallback where available.
- **Usage totals:** The home page can show the number of plans and predictions generated.
- **Responsive dark interface:** Designed to work on desktop and mobile screens.

## Tech stack

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4
- Supabase Auth with `@supabase/ssr` and `@supabase/supabase-js`
- Groq, Hugging Face, Together AI, and Fireworks AI compatible chat APIs
- PDF.js for browser-side PDF text extraction
- Tesseract.js and AI vision for image and scanned-page processing
- Vercel Analytics and Vercel hosting
- Sentry error monitoring for Next.js client, server, and edge runtimes

## Getting started

### Requirements

- Node.js and npm
- A Supabase project for signup and sign-in
- At least one supported AI provider API key to generate plans, predictions, answers, and OCR

### Install

```bash
npm install
```

Create `.env.local` in the project root:

```env
# At least one AI provider key is needed. Groq is the default provider.
GROQ_API_KEY=
# Optional fallback providers
HUGGINGFACE_API_KEY=
TOGETHER_API_KEY=
FIREWORKS_API_KEY=

# Supabase Project URL and publishable key
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

In Supabase, enable email authentication and configure the Auth URL allowlist with the local callback:

```text
http://localhost:3000/auth/callback
http://localhost:3000/auth/recovery-callback
```

For the deployed app, add:

```text
https://rattafy.vercel.app/auth/callback
https://rattafy.vercel.app/auth/recovery-callback
```

The signup flow sends confirmation emails when email confirmation is enabled in Supabase. If confirmation is required, a user must confirm their email before signing in.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Signed-out visitors are directed to `/signin`; after signing in, they can use the planner at `/`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes for AI features | Primary AI provider and vision requests |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes for accounts | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes for accounts | Supabase publishable key for browser and server Supabase clients |
| `HUGGINGFACE_API_KEY` | Optional | AI provider fallback |
| `TOGETHER_API_KEY` | Optional | AI provider fallback |
| `FIREWORKS_API_KEY` | Optional | AI provider fallback |
| `SENTRY_DSN` | Required in production | Sentry server and edge error reporting DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Required in production | Same Sentry DSN for browser error reporting (public by design) |
| `SENTRY_ORG`, `SENTRY_PROJECT` | Required in production | Sentry organization and project slugs used for source map uploads |
| `SENTRY_AUTH_TOKEN` | Required in production | Build token with the `org:ci` scope for source map uploads; keep it secret |

Keep AI provider keys server-side. Do not prefix them with `NEXT_PUBLIC_`.

## Scripts

```bash
npm run dev    # Start the development server
npm run build  # Build the production app
npm run start  # Serve the production build
npm run lint   # Run ESLint
```

## Deployment

The app is configured for Vercel.

1. Import the repository into Vercel.
2. Add the environment variables listed above to the Vercel environments you use. Use the same Supabase project URL and publishable key for the intended deployment. Production builds fail when any required Sentry setting is missing or the two DSNs differ.
3. In Supabase Auth URL Configuration, allow both `https://rattafy.vercel.app/auth/callback` and `https://rattafy.vercel.app/auth/recovery-callback` (and the matching paths on any custom production domain you use).
4. Deploy or redeploy the app after changing environment variables.

### Required Sentry setup

Create a Sentry JavaScript/Next.js project, then add its project DSN to both `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN`. The values must match. Set `SENTRY_ORG` and `SENTRY_PROJECT` to the Sentry slugs shown in the project settings. Create a personal auth token with only the `org:ci` scope and set it as `SENTRY_AUTH_TOKEN`; the build uses it to upload source maps. Production build and startup both fail if these values are missing or the DSNs differ.

## API routes

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/plan` | POST | Generate a study plan |
| `/api/questions` | POST | Predict likely exam questions |
| `/api/answer` | POST | Generate a model answer |
| `/api/ocr` | POST | Extract text from an image |
| `/api/stats` | GET | Read public plan and prediction totals |
| `/auth/callback` | GET | Complete Supabase email confirmation/sign-in callback |
| `/auth/recovery-callback` | GET | Complete a password recovery callback |
| `/reset-password` | GET | Set a new password after opening a recovery link |
| `/privacy` | GET | Read the app's privacy notice |

The plan, questions, answer, and OCR endpoints require a valid signed-in Supabase user. `/api/stats` is public and returns aggregate counts only.

## Project layout

- `app/` — App Router pages, auth callback, and API routes
- `components/` — planner and account interface
- `lib/ai-client.ts` — AI provider configuration, retries, and fallback behavior
- `lib/cache.ts` — in-memory result cache
- `lib/pdf.ts` — browser-side PDF parsing and OCR fallback coordination
- `lib/image.ts` — browser-side image compression
- `lib/supabase/` — Supabase browser/server clients and session handling
- `proxy.ts` — refresh Supabase sessions for incoming requests
