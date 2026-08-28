import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").unique().notNull(),
  passwordHash: text("password_hash").notNull(),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const emailTokens = pgTable("email_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").unique().notNull(),
  type: text("type").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// The recurrence rule for a repeating block. The occurrences themselves are
// materialised as ordinary rows in `blocks` — this table records what generated
// them so that "edit all future occurrences" has something to update.
export const blockSeries = pgTable("block_series", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").default(""),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  freq: text("freq").notNull(), // 'daily' | 'weekly'
  interval: integer("interval").notNull().default(1),
  byWeekday: jsonb("by_weekday").$type<number[]>().notNull().default([]),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const blocks = pgTable("blocks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Null for one-off blocks. Deliberately ON DELETE SET NULL rather than
  // CASCADE: deleting a series shouldn't erase occurrences you already
  // completed, because that would silently rewrite your analytics history.
  seriesId: integer("series_id").references(() => blockSeries.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description").default(""),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  categories: jsonb("categories").$type<string[]>().notNull().default([]),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type EmailToken = typeof emailTokens.$inferSelect;
export type Block = typeof blocks.$inferSelect;
export type NewBlock = typeof blocks.$inferInsert;
export type BlockSeries = typeof blockSeries.$inferSelect;
export type NewBlockSeries = typeof blockSeries.$inferInsert;
