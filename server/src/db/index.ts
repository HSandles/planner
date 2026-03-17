import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? "planner",
  user: process.env.DB_USER ?? "harry",
  password: process.env.DB_PASSWORD,
});

// The drizzle instance is what we use to query the database.
// Passing the schema lets Drizzle know about our tables.
export const db = drizzle(pool, { schema });
