import { describe, it, expect } from "vitest";
import { getTableName } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import path from "node:path";
import * as schema from "@/db/schema";

// @auth/drizzle-adapter's package.json `exports` field only publishes the
// top-level entry point, so its internal `defineTables` helper (which is
// what actually decides which tables the adapter queries) can't be reached
// via the normal package specifier. We import the same physical file by an
// absolute path to reach it directly for this check — this does not exercise
// any network/DB code, `defineTables` is a pure function that just merges
// the schema object we pass in with its own defaults.
// (Vitest's own `import.meta.url` is an http: virtual-module URL, not a
// file: one, so we build the path from `process.cwd()` instead.)
const pgAdapterInternalsUrl = pathToFileURL(
  path.resolve(
    process.cwd(),
    "node_modules/@auth/drizzle-adapter/lib/pg.js",
  ),
).href;

describe("DrizzleAdapter table wiring (lib/auth.ts regression check)", () => {
  it("resolves to Task 2's real migrated tables, not the adapter's built-in defaults", async () => {
    const { defineTables } = await import(pgAdapterInternalsUrl);

    // Exactly the shape lib/auth.ts passes as the second argument to
    // DrizzleAdapter(db, schema).
    const tables = defineTables({
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    });

    // Reference equality: defineTables must return *our* table objects
    // (schema.usersTable ?? <default>), not silently fall back to its own
    // internal singular-named tables.
    expect(tables.usersTable).toBe(schema.users);
    expect(tables.accountsTable).toBe(schema.accounts);
    expect(tables.sessionsTable).toBe(schema.sessions);
    expect(tables.verificationTokensTable).toBe(schema.verificationTokens);

    // Belt-and-suspenders: confirm the underlying SQL table names are the
    // plural ones Task 2's migration actually created, not the adapter's
    // default singular "user"/"account"/"session"/"verificationToken".
    expect(getTableName(tables.usersTable)).toBe("users");
    expect(getTableName(tables.accountsTable)).toBe("accounts");
    expect(getTableName(tables.sessionsTable)).toBe("sessions");
    expect(getTableName(tables.verificationTokensTable)).toBe(
      "verificationTokens",
    );
  });

  it("would have used the wrong (unmigrated) tables if called with no schema arg, proving this was a real bug", async () => {
    const { defineTables } = await import(pgAdapterInternalsUrl);

    // This is what `DrizzleAdapter(db)` — the original buggy call — resolves
    // to internally: no schema passed in means defineTables falls back to
    // its own default tables.
    const defaultTables = defineTables();

    expect(getTableName(defaultTables.usersTable)).toBe("user");
    expect(getTableName(defaultTables.accountsTable)).toBe("account");
    expect(getTableName(defaultTables.sessionsTable)).toBe("session");
    expect(getTableName(defaultTables.verificationTokensTable)).toBe(
      "verificationToken",
    );

    // None of these match Task 2's actual migrated table names.
    expect(getTableName(defaultTables.usersTable)).not.toBe(
      getTableName(schema.users),
    );
  });
});
