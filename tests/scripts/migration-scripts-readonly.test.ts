/**
 * The pre-deploy checks run against the production database. Mongoose builds
 * every imported model's indexes on connect unless autoIndex is off, which
 * would turn a "read-only" check into an index build — and for the unique
 * posting index, a build over the very duplicates the check is looking for.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const scripts = ["find-duplicate-postings.ts", "ledger-sync-report.ts"];

describe("migration scripts connect without building indexes", () => {
  for (const name of scripts) {
    it(name, () => {
      const src = readFileSync(join(process.cwd(), "scripts", "migrations", name), "utf8");
      const connects = src.match(/mongoose\.connect\([^)]*\)/g) ?? [];
      expect(connects.length).toBeGreaterThan(0);
      for (const call of connects) expect(call).toMatch(/autoIndex:\s*false/);
    });
  }
});
