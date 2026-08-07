import { Resend } from "resend";
import crypto from "crypto";
import { db } from "../db/index.js";
import { emailTokens } from "../db/schema.js";

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.APP_URL ?? "http://localhost:5173";
const FROM_EMAIL = "Chronicle <onboarding@resend.dev>";

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createVerificationToken(userId: number): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(emailTokens).values({
    userId,
    token,
    type: "verification",
    expiresAt,
  });

  return token;
}

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const verifyUrl = `${APP_URL}/auth/verify?token=${token}`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Verify your Chronicle account",
    html: `
      <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e;">
        <h1 style="font-size: 28px; margin-bottom: 8px;">◈ Chronicle</h1>
        <p style="color: #9090aa; font-style: italic; margin-bottom: 32px;">Your time, understood.</p>
        
        <h2 style="font-size: 20px; margin-bottom: 16px;">Verify your email address</h2>
        <p style="color: #4a4a6a; line-height: 1.6; margin-bottom: 24px;">
          Thanks for signing up. Click the button below to verify your email address and activate your account.
        </p>
        
        <a href="${verifyUrl}" 
           style="display: inline-block; background: #c9732a; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-family: sans-serif; font-weight: 500; margin-bottom: 24px;">
          Verify my account
        </a>
        
        <p style="color: #9090aa; font-size: 13px; line-height: 1.6;">
          This link expires in 24 hours. If you didn't create a Chronicle account, you can safely ignore this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #ede9df; margin: 32px 0;" />
        <p style="color: #9090aa; font-size: 12px;">
          Can't click the button? Copy this link: ${verifyUrl}
        </p>
      </div>
    `,
  });
}

export async function sendWeeklyDigest(
  email: string,
  data: {
    totalPlanned: number;
    totalCompleted: number;
    completionRate: number;
    topCategory: string;
  },
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Your Chronicle week in review",
    html: `
      <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 20px; color: #1a1a2e;">
        <h1 style="font-size: 28px; margin-bottom: 8px;">◈ Chronicle</h1>
        <p style="color: #9090aa; font-style: italic; margin-bottom: 32px;">Your time, understood.</p>
        
        <h2 style="font-size: 20px; margin-bottom: 24px;">Your week in review</h2>
        
        <div style="display: grid; gap: 16px; margin-bottom: 32px;">
          <div style="background: #f4f1ea; border-radius: 12px; padding: 20px;">
            <div style="font-size: 32px; font-weight: 600; color: #1a1a2e;">${data.totalPlanned.toFixed(1)}h</div>
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #9090aa;">Planned</div>
          </div>
          <div style="background: #f4f1ea; border-radius: 12px; padding: 20px;">
            <div style="font-size: 32px; font-weight: 600; color: #c9732a;">${data.totalCompleted.toFixed(1)}h</div>
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #9090aa;">Completed</div>
          </div>
          <div style="background: #f4f1ea; border-radius: 12px; padding: 20px;">
            <div style="font-size: 32px; font-weight: 600; color: #1a1a2e;">${data.completionRate}%</div>
            <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #9090aa;">Completion rate</div>
          </div>
        </div>

        <p style="color: #4a4a6a; line-height: 1.6;">
          Your top activity this week was <strong>${data.topCategory}</strong>. 
          Log in to see your full breakdown.
        </p>

        <a href="${APP_URL}" 
           style="display: inline-block; margin-top: 24px; background: #c9732a; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-family: sans-serif; font-weight: 500;">
          View my insights
        </a>

        <hr style="border: none; border-top: 1px solid #ede9df; margin: 32px 0;" />
        <p style="color: #9090aa; font-size: 12px;">
          You're receiving this because you have a Chronicle account.
        </p>
      </div>
    `,
  });
}
