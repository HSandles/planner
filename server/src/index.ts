import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { existsSync } from "fs";
import { join } from "path";
import { pool } from "./db/index.js";
import { users, blocks } from "./db/schema.js";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import authRouter from "./routes/auth.js";
import blocksRouter from "./routes/blocks.js";

const app = express();

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? (process.env.CLIENT_URL ?? true)
        : "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Create tables if they don't exist
await db.execute(sql`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`);

await db.execute(sql`
  CREATE TABLE IF NOT EXISTS blocks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    categories JSONB NOT NULL DEFAULT '[]',
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`);

// Routes
app.use("/auth", authRouter);
app.use("/api/blocks", blocksRouter);

// Serve React app in production
if (process.env.NODE_ENV === "production") {
  const clientPath = "/app/client/dist";
  console.log("clientPath:", clientPath);
  console.log("exists:", existsSync(clientPath));
  app.use(express.static(clientPath));
  app.get("*", (_req, res) => {
    res.sendFile(join(clientPath, "index.html"));
  });
}

app.listen(3001, () => console.log("Server running on http://localhost:3001"));
