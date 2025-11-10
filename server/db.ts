import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "../shared/schema.js";

neonConfig.webSocketConstructor = ws;

// Use SUPABASE_DB_URL if available, otherwise fall back to DATABASE_URL
const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "SUPABASE_DB_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Safely extract and log only the host portion without exposing credentials
try {
  const url = new URL(connectionString.replace('postgresql://', 'http://'));
  console.log(`[DB] Connecting to database host: ${url.hostname}:${url.port}`);
} catch (e) {
  console.log(`[DB] Connecting to database...`);
}

export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });
