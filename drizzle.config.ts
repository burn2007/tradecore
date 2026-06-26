import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema/index.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Use DATABASE_URL_DIRECT (non-pooled) for migrations
    url: process.env.DATABASE_URL_DIRECT ?? "",
  },
} satisfies Config;
