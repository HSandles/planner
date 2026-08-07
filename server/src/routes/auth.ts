import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, emailTokens } from "../db/schema.js";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth.js";
import {
  createVerificationToken,
  sendVerificationEmail,
} from "../lib/email.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production";
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res: Response, userId: number, email: string): void {
  const token = jwt.sign({ id: userId, email }, JWT_SECRET, {
    expiresIn: "7d",
  });
  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
  });
}

router.post("/register", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const [user] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        verified: false,
      })
      .returning({ id: users.id, email: users.email });

    // Send verification email
    const token = await createVerificationToken(user.id);
    await sendVerificationEmail(user.email, token);

    setAuthCookie(res, user.id, user.email);
    res.status(201).json({ id: user.id, email: user.email, verified: false });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "23505") {
      res
        .status(409)
        .json({ error: "An account with this email already exists" });
    } else {
      console.error("Registration error:", err);
      res.status(500).json({ error: "Registration failed" });
    }
  }
});

router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  setAuthCookie(res, user.id, user.email);
  res.json({ id: user.id, email: user.email, verified: user.verified });
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ success: true });
});

router.get("/me", requireAuth, async (req: Request, res: Response) => {
  const { id } = (req as unknown as AuthenticatedRequest).user;
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      verified: users.verified,
    })
    .from(users)
    .where(eq(users.id, id));

  res.json(user);
});

// Verify email token
router.get("/verify", async (req: Request, res: Response) => {
  const { token } = req.query as { token: string };

  if (!token) {
    res.status(400).json({ error: "Token is required" });
    return;
  }

  const [emailToken] = await db
    .select()
    .from(emailTokens)
    .where(eq(emailTokens.token, token));

  if (!emailToken) {
    res.status(400).json({ error: "Invalid or expired token" });
    return;
  }

  if (emailToken.usedAt) {
    res.status(400).json({ error: "Token has already been used" });
    return;
  }

  if (new Date() > emailToken.expiresAt) {
    res.status(400).json({ error: "Token has expired" });
    return;
  }

  // Mark token as used and user as verified
  await db
    .update(emailTokens)
    .set({ usedAt: new Date() })
    .where(eq(emailTokens.id, emailToken.id));

  await db
    .update(users)
    .set({ verified: true })
    .where(eq(users.id, emailToken.userId));

  // Redirect to app with success message
  const APP_URL =
    process.env.NODE_ENV === "production"
      ? (process.env.APP_URL ?? "")
      : "http://localhost:5173";

  res.redirect(`${APP_URL}/?verified=true`);
});

// Resend verification email
router.post(
  "/resend-verification",
  requireAuth,
  async (req: Request, res: Response) => {
    const { id, email } = (req as unknown as AuthenticatedRequest).user;

    const [user] = await db.select().from(users).where(eq(users.id, id));

    if (user.verified) {
      res.status(400).json({ error: "Account is already verified" });
      return;
    }

    const token = await createVerificationToken(id);
    await sendVerificationEmail(email, token);

    res.json({ success: true });
  },
);

export default router;
