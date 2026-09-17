# Content Brain

A private visual knowledge canvas for collecting business context, voice samples, expert frameworks, and creative inspiration, then using those connected sources in an AI writing studio.

## Local development

1. Copy `.env.example` to `.env` and add the values.
2. Run `npm install`.
3. Run `netlify dev` to use local Functions and Blobs.

The front end falls back to browser storage if Netlify Functions are unavailable.

## Netlify

Build command: `npm run build`

Publish directory: `dist`

Required environment variables:

- `CONTENT_HUB_SECRET`
- `OPENAI_API_KEY`

Optional:

- `OPENAI_MODEL` (defaults to `gpt-5.4-mini`)
