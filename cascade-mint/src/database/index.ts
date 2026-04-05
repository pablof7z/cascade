/**
 * Database Module
 * Turso/D1 integration for Cashu Mint
 */

import type { D1Database } from '@cloudflare/workers-types';

// Global database instance
let db: D1Database | null = null;

/**
 * Initialize database with D1 binding
 * Called during Hono app initialization
 */
export function initDatabase(database: D1Database): void {
  db = database;
}

/**
 * Get the database instance
 */
export function getDatabase(): D1Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return db !== null;
}

/**
 * Execute a raw SQL query (for migrations)
 */
export async function exec(sql: string): Promise<void> {
  const database = getDatabase();
  await database.exec(sql);
}

/**
 * Prepare and execute a statement
 */
export async function prepare<T>(
  sql: string,
  ...bindings: (string | number | null)[]
): Promise<{ results: T[]; success: boolean }> {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  const result = await stmt.bind(...bindings).all<T>();
  return {
    results: result.results || [],
    success: result.success,
  };
}

/**
 * Prepare and execute a single row query
 */
export async function prepareFirst<T>(
  sql: string,
  ...bindings: (string | number | null)[]
): Promise<T | null> {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  const result = await stmt.bind(...bindings).first<T>();
  return result || null;
}

/**
 * Prepare and execute a write statement
 */
export async function prepareRun(
  sql: string,
  ...bindings: (string | number | null)[]
): Promise<{ meta: { changes: number; last_row_id: number } }> {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  const result = await stmt.bind(...bindings).run();
  return {
    meta: {
      changes: result.meta.changes,
      last_row_id: result.meta.last_row_id,
    },
  };
}

// Re-export types
export type { D1Database } from '@cloudflare/workers-types';
