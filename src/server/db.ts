import { Pool } from "pg";
import dotenv from "dotenv";
// ES module imports are hoisted and evaluated before any of server.ts's own top-level
// statements (including its dotenv.config() call), so this module must load its own env
// vars rather than relying on being imported after that call.
dotenv.config();

const isLocal = process.env.DATABASE_URL?.includes("localhost") || process.env.DATABASE_URL?.includes("127.0.0.1");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  // The local dev database (PGlite over a socket adapter, see scripts/local-postgres.ts)
  // only ever tolerates a single connection for its entire process lifetime — a second
  // connection attempt (even after the first disconnected cleanly) fails. So for local dev:
  // exactly one connection, opened once, and idleTimeoutMillis:0 so pg never auto-closes it
  // and silently tries to reopen a "second" (and therefore doomed) connection later.
  max: isLocal ? 1 : 10,
  idleTimeoutMillis: isLocal ? 0 : 10000,
});

export async function waitForPostgres(maxAttempts = 10, delayMs = 1500): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query("SELECT 1");
      console.log("Connected to PostgreSQL.");
      return;
    } catch (err) {
      console.warn(`Postgres not ready yet (attempt ${attempt}/${maxAttempts}): ${(err as Error).message}`);
      if (attempt === maxAttempts) {
        throw new Error(
          `Could not connect to PostgreSQL after ${maxAttempts} attempts. Is DATABASE_URL set correctly in .env? ` +
          `Original error: ${(err as Error).message}`
        );
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

export async function withTransaction<T>(fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
