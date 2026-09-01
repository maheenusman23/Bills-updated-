<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# BillSlayer AI

Medical-legal billing dispute platform — PostgreSQL + pgvector for structured data and
similarity-based lawyer/clinic matching, MinIO for raw file storage, local Tesseract.js OCR,
and a deterministic (no external AI API) billing-audit document engine.

## Run Locally

**Prerequisites:** Node.js only — no Docker, no cloud account, no native Postgres install.

1. Install dependencies:
   `npm install`
2. Create `.env` from `.env.example` (the defaults already point at the local services below).
3. Start the local database (embedded Postgres + pgvector, in a separate terminal, leave running):
   `npx tsx scripts/local-postgres.ts`
4. Start MinIO locally (in another terminal, leave running):
   `./bin/minio.exe server minio-data --console-address ":9001"`
   (first run: download the binary — see `bin/README.md` if `bin/minio.exe` isn't present.)
5. Run the app:
   `npm run dev`

**Optional:** set `EMAIL_USER`/`EMAIL_PASS` in `.env` for real OTP emails (falls back to a
sandbox mode that returns the OTP directly in the API response if unset — fine for local dev).

**Deploying to production:** swap `DATABASE_URL` in `.env` to a real hosted Postgres with
pgvector enabled (Supabase or Neon both work — run `create extension if not exists vector;`
once, then load `db/init/001_schema.sql`), and point `MINIO_*` at a real MinIO/S3-compatible
bucket instead of the local binary. No code changes needed either way.

No AI API key is required or used anywhere in this app — OCR runs locally via Tesseract.js,
matching embeddings run locally via a small in-process model, and document generation is a
deterministic rule engine over the OCR'd bill data.
