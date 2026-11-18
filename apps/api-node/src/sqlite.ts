import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { SqlMetadataStore, type SqlStatement } from "@share/server";

export function openMetadata(path: string, migrationDirectory: string): SqlMetadataStore {
  const database = new DatabaseSync(path);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY NOT NULL);
  `);
  for (const file of readdirSync(migrationDirectory)
    .filter((name) => /^\d+_.+\.sql$/u.test(name))
    .sort()) {
    database.exec("BEGIN IMMEDIATE");
    try {
      if (!database.prepare("SELECT 1 FROM schema_migrations WHERE name = ?").get(file)) {
        database.exec(readFileSync(join(migrationDirectory, file), "utf8"));
        database.prepare("INSERT INTO schema_migrations VALUES (?)").run(file);
      }
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      database.close();
      throw error;
    }
  }
  return new SqlMetadataStore({
    prepare(query) {
      const statement = database.prepare(query);
      function bind(...values: SQLInputValue[]): SqlStatement {
        return {
          bind,
          async run() {
            return { meta: { changes: Number(statement.run(...values).changes) } };
          },
          async first<Row>() {
            return (statement.get(...values) as Row | undefined) ?? null;
          },
          async all<Row>() {
            return { results: statement.all(...values) as Row[] };
          },
        };
      }
      return bind();
    },
  });
}
