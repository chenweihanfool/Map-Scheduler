import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // The target Postgres instance is shared with other unrelated apps' data
  // (their own schemas). Scoping drizzle-kit to just this schema stops
  // `db:push` from ever seeing/touching anything outside it.
  schemaFilter: ["mapscheduler"],
});
