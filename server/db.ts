import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "../shared/schema.js";

// Lazy initialization - only initialize when actually used
let _pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

function initializeDb() {
  if (_pool && _db) {
    return { pool: _pool, db: _db };
  }

  // Use DATABASE_URL from environment (Supabase connection string)
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set. Please add your Supabase DATABASE_URL to environment variables.",
    );
  }

  // Safely extract and log only the host portion without exposing credentials
  try {
    const url = new URL(connectionString.replace('postgresql://', 'http://'));
    console.log(`[DB] Connecting to Supabase database: ${url.hostname}:${url.port}`);
  } catch (e) {
    console.log(`[DB] Connecting to Supabase database...`);
  }

  _pool = new Pool({ 
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  _pool.on("error", (err) => {
    console.error("Unexpected Supabase database error:", err);
  });

  _db = drizzle(_pool, { schema });

  return { pool: _pool, db: _db };
}

// Create proxy objects that lazily initialize
export const pool = new Proxy({} as Pool, {
  get(_target, prop) {
    const { pool } = initializeDb();
    return (pool as any)[prop];
  }
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const { db } = initializeDb();
    return (db as any)[prop];
  }
});
