import { Router, Request, Response } from "express";
import { eq, and, between, gte, sql } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/index.js";
import { blocks, blockSeries } from "../db/schema.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import {
  expandRecurrence,
  validateRule,
  daysBetween,
  MAX_OCCURRENCES,
  RecurrenceRule,
} from "../lib/recurrence.js";

const router = Router();
const anthropic = new Anthropic();

// All routes in this file require auth
router.use(requireAuth);

async function categoriseBlock(
  title: string,
  description?: string,
): Promise<string[]> {
  const prompt = `You are a life activity categoriser. Given an activity, return a JSON array of 1-3 category labels from this list:
  
  ["Work", "Fitness", "Social", "Family", "Learning", "Health", "Creative", "Rest", "Errands", "Travel", "Food", "Spirituality", "Finance", "Hobbies"]

  Activity title: "${title}"
  ${description ? `Description: "${description}"` : ""}

  Rules:
  - Return ONLY a raw JSON array, no explanation, no markdown
  - Pick the most relevant 1-3 categories`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6", // updated model name
    max_tokens: 100,
    messages: [{ role: "user", content: prompt }],
  });

  try {
    const text =
      message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const categories = JSON.parse(text);
    return Array.isArray(categories) ? categories : ["Uncategorised"];
  } catch {
    return ["Uncategorised"];
  }
}

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

router.get("/", async (req: Request, res: Response) => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { from, to } = req.query as { from?: string; to?: string };

  const rows =
    from && to
      ? await db
          .select()
          .from(blocks)
          .where(and(eq(blocks.userId, userId), between(blocks.date, from, to)))
      : await db.select().from(blocks).where(eq(blocks.userId, userId));

  res.json(rows);
});

// Creates a single block, or — when a `recurrence` object is present — a whole
// series. Responds with the created block, or with an array of them for a series.
router.post("/", async (req: Request, res: Response) => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { title, description, date, start_time, end_time, recurrence } =
    req.body;

  if (!title || !date || !start_time || !end_time) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const durationMinutes = calcDuration(start_time, end_time);
  if (durationMinutes <= 0) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  // Categorise once, then reuse across the series. Every occurrence has the
  // same title and notes, so extra calls would return the same answer — and a
  // year of weekly blocks would otherwise be 52 sequential requests to Claude.
  const categories = await categoriseBlock(title, description);

  if (!recurrence) {
    const [block] = await db
      .insert(blocks)
      .values({
        userId,
        title,
        description: description ?? "",
        date,
        startTime: start_time,
        endTime: end_time,
        durationMinutes,
        categories,
      })
      .returning();

    res.status(201).json(block);
    return;
  }

  const rule: RecurrenceRule = {
    freq: recurrence.freq,
    interval: Number(recurrence.interval ?? 1),
    byWeekday: Array.isArray(recurrence.by_weekday)
      ? recurrence.by_weekday.map(Number)
      : [],
    startDate: date,
    endDate: recurrence.end_date,
  };

  const invalid = validateRule(rule);
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }

  const dates = expandRecurrence(rule);
  if (dates.length === 0) {
    res
      .status(400)
      .json({ error: "That pattern doesn't fall on any date in the range" });
    return;
  }
  if (dates.length > MAX_OCCURRENCES) {
    res.status(400).json({
      error: `That pattern makes more than ${MAX_OCCURRENCES} blocks. Try a nearer repeat-until date.`,
    });
    return;
  }

  const [series] = await db
    .insert(blockSeries)
    .values({
      userId,
      title,
      description: description ?? "",
      startTime: start_time,
      endTime: end_time,
      categories,
      freq: rule.freq,
      interval: rule.interval,
      byWeekday: rule.byWeekday,
      startDate: rule.startDate,
      endDate: rule.endDate,
    })
    .returning();

  const created = await db
    .insert(blocks)
    .values(
      dates.map((occurrenceDate) => ({
        userId,
        seriesId: series.id,
        title,
        description: description ?? "",
        date: occurrenceDate,
        startTime: start_time,
        endTime: end_time,
        durationMinutes,
        categories,
      })),
    )
    .returning();

  res.status(201).json(created);
});

// Partial update. Only the fields present in the body change, so a bare move
// (`{ date }`) or a completion toggle (`{ completed }`) leaves everything else
// alone. Pass `scope: "future"` on an occurrence of a series to apply the same
// change to that occurrence and every later one.
router.patch("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id: userId } = (req as unknown as AuthenticatedRequest).user;
  const blockId = parseInt(req.params.id);
  const { title, description, date, start_time, end_time, completed, scope } =
    req.body;

  const [existing] = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.id, blockId), eq(blocks.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  const next = {
    title: title ?? existing.title,
    description: description ?? existing.description ?? "",
    date: date ?? existing.date,
    startTime: start_time ?? existing.startTime,
    endTime: end_time ?? existing.endTime,
    completed: completed ?? existing.completed,
  };

  const durationMinutes = calcDuration(next.startTime, next.endTime);
  if (durationMinutes <= 0) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  // Only spend a Claude call when the text it reads has actually changed.
  // Moving a block or ticking it off can't change its categories.
  const textChanged =
    next.title !== existing.title ||
    next.description !== (existing.description ?? "");
  const categories = textChanged
    ? await categoriseBlock(next.title, next.description)
    : (existing.categories as string[]);

  const applyToFuture = scope === "future" && existing.seriesId !== null;

  if (!applyToFuture) {
    const [updated] = await db
      .update(blocks)
      .set({
        title: next.title,
        description: next.description,
        date: next.date,
        startTime: next.startTime,
        endTime: next.endTime,
        durationMinutes,
        categories,
        completed: next.completed,
      })
      .where(and(eq(blocks.id, blockId), eq(blocks.userId, userId)))
      .returning();

    res.json(updated);
    return;
  }

  const seriesId = existing.seriesId as number;
  const dayDelta = daysBetween(existing.date, next.date);

  await db
    .update(blocks)
    .set({
      title: next.title,
      description: next.description,
      startTime: next.startTime,
      endTime: next.endTime,
      durationMinutes,
      categories,
      // A date is inherently per-occurrence, so "all future" shifts each later
      // occurrence by however many days this one moved: nudging a Monday to the
      // Tuesday moves every later Monday to a Tuesday too. `completed` is
      // deliberately absent — ticking off one session shouldn't tick the rest.
      ...(dayDelta !== 0
        ? {
            date: sql`to_char(${blocks.date}::date + ${dayDelta}, 'YYYY-MM-DD')`,
          }
        : {}),
    })
    .where(
      and(
        eq(blocks.userId, userId),
        eq(blocks.seriesId, seriesId),
        gte(blocks.date, existing.date),
      ),
    );

  if (completed !== undefined) {
    await db
      .update(blocks)
      .set({ completed: next.completed })
      .where(and(eq(blocks.id, blockId), eq(blocks.userId, userId)));
  }

  // Keep the rule row in step so the series still describes its own occurrences.
  const [series] = await db
    .select()
    .from(blockSeries)
    .where(and(eq(blockSeries.id, seriesId), eq(blockSeries.userId, userId)));

  if (series) {
    const shifted = (series.byWeekday as number[]).map(
      (d) => (((d + dayDelta) % 7) + 7) % 7,
    );
    await db
      .update(blockSeries)
      .set({
        title: next.title,
        description: next.description,
        startTime: next.startTime,
        endTime: next.endTime,
        categories,
        ...(dayDelta !== 0 ? { byWeekday: shifted } : {}),
      })
      .where(eq(blockSeries.id, seriesId));
  }

  const [updated] = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.id, blockId), eq(blocks.userId, userId)));

  res.json(updated);
});

// `?scope=future` deletes this occurrence and every later one in its series.
router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id: userId } = (req as unknown as AuthenticatedRequest).user;
  const blockId = parseInt(req.params.id);
  const { scope } = req.query as { scope?: string };

  const [existing] = await db
    .select()
    .from(blocks)
    .where(and(eq(blocks.id, blockId), eq(blocks.userId, userId)));

  if (!existing) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  if (scope !== "future" || existing.seriesId === null) {
    await db
      .delete(blocks)
      .where(and(eq(blocks.id, blockId), eq(blocks.userId, userId)));
    res.json({ success: true });
    return;
  }

  const seriesId = existing.seriesId;

  await db
    .delete(blocks)
    .where(
      and(
        eq(blocks.userId, userId),
        eq(blocks.seriesId, seriesId),
        gte(blocks.date, existing.date),
      ),
    );

  // Past occurrences keep pointing at the series. Once none are left, the rule
  // has nothing to describe, so drop it.
  const remaining = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(eq(blocks.seriesId, seriesId))
    .limit(1);

  if (remaining.length === 0) {
    await db
      .delete(blockSeries)
      .where(and(eq(blockSeries.id, seriesId), eq(blockSeries.userId, userId)));
  }

  res.json({ success: true });
});

router.get("/analytics", async (req: Request, res: Response) => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { from, to } = req.query as { from?: string; to?: string };

  const rows =
    from && to
      ? await db
          .select({
            categories: blocks.categories,
            durationMinutes: blocks.durationMinutes,
            completed: blocks.completed,
          })
          .from(blocks)
          .where(and(eq(blocks.userId, userId), between(blocks.date, from, to)))
      : await db
          .select({
            categories: blocks.categories,
            durationMinutes: blocks.durationMinutes,
            completed: blocks.completed,
          })
          .from(blocks)
          .where(eq(blocks.userId, userId));

  const planned: Record<string, number> = {};
  const completed: Record<string, number> = {};

  for (const row of rows) {
    const cats = row.categories as string[];
    for (const cat of cats) {
      planned[cat] = (planned[cat] ?? 0) + row.durationMinutes;
      if (row.completed) {
        completed[cat] = (completed[cat] ?? 0) + row.durationMinutes;
      }
    }
  }

  const data = Object.keys(planned)
    .map((category) => ({
      category,
      planned: Math.round((planned[category] / 60) * 10) / 10,
      completed: Math.round(((completed[category] ?? 0) / 60) * 10) / 10,
    }))
    .sort((a, b) => b.planned - a.planned);

  res.json(data);
});

export default router;
