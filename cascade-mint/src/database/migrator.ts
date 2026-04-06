/**
 * Database Migration Runner
 * Handles SQL migrations with version tracking
 */

import { getDatabase, exec } from './index.js';

interface MigrationRecord {
  name: string;
  executed_at: number;
  rollback_sql?: string;
}

interface MigrationFile {
  name: string;
  upSql: string;
  downSql: string;
}

/**
 * Run all pending migrations
 */
export async function runMigrations(migrationFiles: MigrationFile[]): Promise<void> {
  const db = getDatabase();

  // Create migrations table if not exists
  await exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at INTEGER NOT NULL,
      rollback_sql TEXT
    )
  `);

  // Get already executed migrations
  const executed = await db
    .prepare('SELECT name FROM migrations')
    .all<{ name: string }>();

  const executedNames = new Set(executed.results.map(r => r.name));

  // Sort migrations by name
  const sortedFiles = [...migrationFiles].sort((a, b) => a.name.localeCompare(b.name));

  for (const file of sortedFiles) {
    if (executedNames.has(file.name)) {
      console.log(`⏩ Skipping already executed: ${file.name}`);
      continue;
    }

    console.log(`📦 Running migration: ${file.name}`);

    try {
      // Execute UP migration
      await exec(file.upSql);

      // Record migration
      await db
        .prepare(
          'INSERT INTO migrations (name, executed_at, rollback_sql) VALUES (?, ?, ?)'
        )
        .bind(file.name, Date.now(), file.downSql || null)
        .run();

      console.log(`✅ Executed migration: ${file.name}`);
    } catch (error) {
      console.error(`❌ Failed migration: ${file.name}`, error);
      throw error;
    }
  }
}

/**
 * Rollback the latest migration
 */
export async function rollbackLatest(): Promise<void> {
  const db = getDatabase();

  // Get the latest migration
  const latest = await db
    .prepare('SELECT name, rollback_sql FROM migrations ORDER BY id DESC LIMIT 1')
    .first<MigrationRecord>();

  if (!latest) {
    console.log('No migrations to rollback');
    return;
  }

  if (!latest.rollback_sql) {
    console.log(`No rollback SQL for: ${latest.name}`);
    return;
  }

  try {
    // Execute DOWN migration
    await exec(latest.rollback_sql);

    // Remove migration record
    await db
      .prepare('DELETE FROM migrations WHERE name = ?')
      .bind(latest.name)
      .run();

    console.log(`✅ Rolled back: ${latest.name}`);
  } catch (error) {
    console.error(`❌ Rollback failed: ${latest.name}`, error);
    throw error;
  }
}

/**
 * Get migration status
 */
export async function getMigrationStatus(): Promise<MigrationRecord[]> {
  const db = getDatabase();
  const result = await db
    .prepare('SELECT * FROM migrations ORDER BY id ASC')
    .all<MigrationRecord>();
  return result.results;
}
