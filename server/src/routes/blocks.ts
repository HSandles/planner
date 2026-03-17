import { Router, Request, Response } from "express";
import { eq, and, between } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db/index.js";
import { blocks } from "../db/schema.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";

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
    model: "claude-sonnet-4-20250514",
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

router.post("/", async (req: Request, res: Response) => {
  const { id: userId } = (req as AuthenticatedRequest).user;
  const { title, description, date, start_time, end_time } = req.body;

  if (!title || !date || !start_time || !end_time) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const durationMinutes = calcDuration(start_time, end_time);
  if (durationMinutes <= 0) {
    res.status(400).json({ error: "End time must be after start time" });
    return;
  }

  const categories = await categoriseBlock(title, description);

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
});

router.patch("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id: userId } = (req as unknown as AuthenticatedRequest).user;
  const blockId = parseInt(req.params.id);
  const { title, description, date, start_time, end_time, completed } =
    req.body;

  // Toggling completion only
  if (completed !== undefined && !title) {
    const [updated] = await db
      .update(blocks)
      .set({ completed })
      .where(and(eq(blocks.id, blockId), eq(blocks.userId, userId)))
      .returning();
    res.json(updated);
    return;
  }

  const categories = await categoriseBlock(title, description);
  const durationMinutes = calcDuration(start_time, end_time);

  const [updated] = await db
    .update(blocks)
    .set({
      title,
      description,
      date,
      startTime: start_time,
      endTime: end_time,
      durationMinutes,
      categories,
      completed: completed ?? false,
    })
    .where(and(eq(blocks.id, blockId), eq(blocks.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Block not found" });
    return;
  }

  res.json(updated);
});

router.delete("/:id", async (req: Request<{ id: string }>, res: Response) => {
  const { id: userId } = (req as unknown as AuthenticatedRequest).user;
  await db
    .delete(blocks)
    .where(
      and(eq(blocks.id, parseInt(req.params.id)), eq(blocks.userId, userId)),
    );
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
