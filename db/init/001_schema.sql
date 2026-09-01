-- BillSlayer AI — PostgreSQL schema (replaces sql.js/SQLite)
-- Run once against a fresh Postgres database (e.g. a new Supabase project's SQL Editor,
-- or `psql "$DATABASE_URL" -f db/init/001_schema.sql`).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
  email                 TEXT UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('client','lawyer','clinic','admin')),
  password              TEXT NOT NULL,
  license_number        TEXT,
  org_name              TEXT,
  org_type              TEXT CHECK (org_type IN ('clinic','law_firm')),
  bio                   TEXT,
  accepted_terms        BOOLEAN NOT NULL DEFAULT false,
  plan_id               TEXT NOT NULL DEFAULT 'free',
  available_credits     INTEGER NOT NULL DEFAULT 0,
  total_credits_used    INTEGER NOT NULL DEFAULT 0,
  matchmaking_consent   BOOLEAN NOT NULL DEFAULT false,
  is_blocked            BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  plan_expires_at       TIMESTAMPTZ,
  reset_otp             TEXT,
  reset_otp_expires_at  TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS users_lawyer_license_unique
  ON users (lower(license_number))
  WHERE role = 'lawyer' AND license_number IS NOT NULL;

CREATE TABLE IF NOT EXISTS cases (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  patient_name TEXT,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  status       TEXT NOT NULL DEFAULT 'Analyzing Uploads'
);
CREATE INDEX IF NOT EXISTS cases_user_id_idx ON cases(user_id);

-- Replaces cases.files JSON-blob-in-TEXT. Raw bytes live in MinIO; this row is the metadata.
CREATE TABLE IF NOT EXISTS case_files (
  id                TEXT PRIMARY KEY,
  case_id           TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  minio_object_key  TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  size_bytes        INTEGER NOT NULL,
  ocr_text          TEXT,
  ocr_status        TEXT NOT NULL DEFAULT 'pending' CHECK (ocr_status IN ('pending','processing','done','failed','skipped')),
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','valid','rejected')),
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_files_case_id_idx ON case_files(case_id);

CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  case_id      TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL,
  title        TEXT NOT NULL,
  service_type TEXT NOT NULL,
  content      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  downloaded   BOOLEAN NOT NULL DEFAULT false,
  is_locked    BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS documents_case_id_idx ON documents(case_id);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);

CREATE TABLE IF NOT EXISTS matches (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_name      TEXT NOT NULL,
  client_email     TEXT NOT NULL,
  lawyer_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lawyer_name      TEXT NOT NULL,
  lawyer_email     TEXT NOT NULL,
  client_consented BOOLEAN NOT NULL DEFAULT false,
  lawyer_consented BOOLEAN NOT NULL DEFAULT false,
  status           TEXT,
  initiated_by     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_timed_out     BOOLEAN NOT NULL DEFAULT false,
  notified         BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS matches_client_id_idx ON matches(client_id);
CREATE INDEX IF NOT EXISTS matches_lawyer_id_idx ON matches(lawyer_id);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('info','warning','success','match_timeout')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read       BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);

CREATE TABLE IF NOT EXISTS payments (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  amount     NUMERIC(10,2) NOT NULL,
  item       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);

CREATE TABLE IF NOT EXISTS api_costs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email   TEXT NOT NULL,
  role         TEXT NOT NULL,
  service_type TEXT NOT NULL,
  cost         NUMERIC(10,4) NOT NULL,
  revenue      NUMERIC(10,4) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_costs_user_id_idx ON api_costs(user_id);

-- pgvector matching: one embedding per case (title + description + OCR'd file text),
-- generated locally via @xenova/transformers (Xenova/all-MiniLM-L6-v2 -> 384 dims). No API key.
CREATE TABLE IF NOT EXISTS case_embeddings (
  case_id    TEXT PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  embedding  vector(384),
  model      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS case_embeddings_ivfflat_idx ON case_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- One embedding per user, generated from their optional `bio` field. Used to rank
-- lawyer/clinic candidates in matchmaking by similarity to a client's case embedding.
CREATE TABLE IF NOT EXISTS user_embeddings (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  embedding  vector(384),
  model      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_embeddings_ivfflat_idx ON user_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
