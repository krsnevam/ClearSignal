import { defineConfig } from 'drizzle-kit';

// Migrations are hand-written SQL (partitioning isn't expressible in drizzle);
// drizzle-kit is used for `migrate` and for drift checks against schema.ts.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
