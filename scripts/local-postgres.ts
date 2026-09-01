// Local dev/test database — no Docker, no cloud account, no native Postgres install needed.
// Runs a real Postgres engine (compiled to WASM via PGlite) with the pgvector extension,
// exposed over the real Postgres wire protocol so the app's normal `pg` client can connect
// to it exactly like it would to Supabase/Neon/any real Postgres via DATABASE_URL.
//
// This is a local-dev convenience only — swap DATABASE_URL to a real hosted Postgres for
// production. Run with: npx tsx scripts/local-postgres.ts
import fs from "fs";
import path from "path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const DATA_DIR = path.join(process.cwd(), "pglite-data");
const SCHEMA_FILE = path.join(process.cwd(), "db", "init", "001_schema.sql");
const PORT = Number(process.env.LOCAL_PG_PORT || 5432);
const HOST = process.env.LOCAL_PG_HOST || "127.0.0.1";

async function main() {
  const db = await PGlite.create(`file://${DATA_DIR}`, { extensions: { vector } });
  console.log(`PGlite database ready (data dir: ${DATA_DIR}).`);

  const schemaSql = fs.readFileSync(SCHEMA_FILE, "utf-8");
  await db.exec(schemaSql); // idempotent: every statement in the schema uses IF NOT EXISTS
  console.log("Schema applied (db/init/001_schema.sql).");

  const server = new PGLiteSocketServer({ db, port: PORT, host: HOST });
  await server.start();
  console.log(`Local Postgres (PGlite + pgvector) listening on postgres://${HOST}:${PORT}/postgres`);
  console.log(`Set DATABASE_URL="postgres://postgres@${HOST}:${PORT}/postgres" in .env`);
  console.log(
    "NOTE: this socket server only tolerates ONE connection for its entire process lifetime " +
    "(a documented @electric-sql/pglite-socket limitation, not a bug in this script) — the app " +
    "keeps a single persistent pooled connection open the whole time it runs, which works fine, " +
    "but if you restart the app server, restart this script too before it reconnects."
  );

  const shutdown = async () => {
    console.log("\nShutting down local Postgres...");
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start local Postgres:", err);
  process.exit(1);
});
