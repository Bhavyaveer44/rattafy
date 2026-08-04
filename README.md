# Rattafy

https://rattafy.vercel.app/

Rattafy is a fast, opinionated exam-prep assistant built with Next.js. It helps students turn a syllabus, study hours, and past-question papers into a ruthless study plan in seconds.

The app is designed for last-minute preparation: it prioritizes what matters, highlights what can be skimmed, and predicts the most likely exam questions before the exam day arrives.

## What it does

- Accepts a syllabus as text or by uploading syllabus photos
- Reads previous-year question papers from PDF uploads
- Generates a study plan based on available hours and target goal
- Classifies topics as Study, Skim, or Sacrifice
- Predicts likely exam questions and offers short model answers
- Tracks basic usage stats for plans and predictions

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- PDF.js for PDF text extraction
- Groq-backed AI routes for planning, OCR, question prediction, and answer generation
- Vercel Analytics

## Project structure

- app/ — main app UI and API routes
- app/api/ — server endpoints for planning, OCR, question prediction, answers, and stats
- components/ — reusable UI components
- lib/ — helpers for PDF parsing, image handling, and rate limiting

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file and add your Groq API key:

   ```bash
   GROQ_API_KEY=your_api_key_here
   ```

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

This project is well suited for deployment on Vercel. Make sure the GROQ_API_KEY environment variable is configured in your hosting environment before deploying.
