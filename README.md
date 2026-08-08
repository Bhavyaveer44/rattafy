# Rattafy

https://rattafy.vercel.app/

Rattafy is a fast, opinionated exam-prep assistant built with Next.js. It helps students turn a syllabus, study hours, and past-question papers into a ruthless study plan in seconds.

The app is designed for last-minute preparation: it prioritizes what matters, highlights what can be skimmed, and predicts the most likely exam questions before the exam day arrives.

## Features

- **Smart Study Planning**: Accepts syllabus as text or photos, generates ruthless study plans
- **Question Prediction**: AI-powered exam question prediction based on syllabus and PYQs
- **Model Answers**: Generates detailed model answers for predicted questions
- **PDF Processing**: Extracts text from PDFs with OCR fallback for scanned pages
- **Multi-API Rotation**: Rotates between Groq, Hugging Face, and Fireworks.ai for reliability
- **Intelligent Caching**: Reduces API calls by 60-80% with smart caching layer
- **Fallback Mechanism**: Graceful degradation with stale cache when APIs fail
- **Rate Limiting**: Per-IP rate limits to prevent abuse
- **Mobile Responsive**: Works seamlessly on all devices

## Tech stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **AI/ML**: 
  - Multi-API rotation (Groq, Hugging Face, Fireworks.ai)
  - Exponential backoff retry logic
  - Vision models for OCR
- **PDF Processing**: PDF.js for text extraction with OCR fallback
- **Caching**: In-memory caching with stale cache fallback
- **Rate Limiting**: Upstash Redis for per-IP rate limiting
- **Analytics**: Vercel Analytics
- **Hosting**: Vercel

## Project structure

- `app/` — main app UI and API routes
- `app/api/` — server endpoints (plan, questions, answer, ocr, stats)
- `lib/` — core utilities
  - `ai-client.ts` — Multi-API rotation with retry logic
  - `cache.ts` — Intelligent caching layer
  - `pdf.ts` — PDF text extraction with OCR
  - `image.ts` — Image compression for OCR
  - `ratelimit.ts` — Rate limiting with Upstash Redis
  - `counter.ts` — Usage statistics tracking
- `components/` — reusable UI components

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file (`.env.local`) and add your API keys:

   ```bash
   GROQ_API_KEY=your_groq_api_key
   HUGGINGFACE_API_KEY=your_huggingface_api_key
   FIREWORKS_API_KEY=your_fireworks_api_key
   KV_REST_API_URL=your_upstash_redis_url
   KV_REST_API_TOKEN=your_upstash_redis_token
   ```

   **Note**: At minimum, you need `GROQ_API_KEY`. Other providers are optional but recommended for reliability.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open http://localhost:3000 in your browser.

## Scripts

- npm run dev — start the local development server
- npm run build — create a production build
- npm run start — run the production build locally
- npm run lint — run ESLint

## Deployment

This project is optimized for Vercel deployment.

### Environment Variables

Configure these in your Vercel project settings:

- `GROQ_API_KEY` (required) - Groq API key for AI models
- `HUGGINGFACE_API_KEY` (optional) - Hugging Face API key for backup
- `FIREWORKS_API_KEY` (optional) - Fireworks.ai API key for backup
- `KV_REST_API_URL` (recommended) - Upstash Redis URL for rate limiting
- `KV_REST_API_TOKEN` (recommended) - Upstash Redis token for rate limiting

### Deployment Steps

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Rate Limits

- Plan generation: 15 requests/hour per IP
- Question prediction: 15 requests/hour per IP
- Model answers: 40 requests/hour per IP
- OCR: 60 requests/hour per IP

## Architecture

### Multi-API Rotation

The app automatically rotates between multiple AI providers to ensure reliability:
- Primary: Groq (fast, free tier)
- Backup: Hugging Face (free tier)
- Backup: Fireworks.ai (free tier)

If one provider hits rate limits or fails, the app automatically tries the next provider with exponential backoff retry.

### Caching Layer

- Plans are cached for 24 hours
- Predictions are cached for 12 hours
- OCR results are cached for 7 days
- Answers are cached for 24 hours
- Stale cache fallback provides results even when APIs are down

### Error Handling

- Automatic retry with exponential backoff (up to 3 retries)
- Graceful degradation to cached data on API failure
- User-friendly error messages
- Fallback responses include warning flags
