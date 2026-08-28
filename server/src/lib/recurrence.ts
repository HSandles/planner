export type Freq = "daily" | "weekly";

export interface RecurrenceRule {
  freq: Freq;
  interval: number; // every N days / weeks
  byWeekday: number[]; // 0 = Sunday … 6 = Saturday, weekly only
  startDate: string; // YYYY-MM-DD, inclusive
  endDate: string; // YYYY-MM-DD, inclusive
}

// A series is materialised into real rows up front, so the horizon has to be
// bounded. 366 covers "every day for a year" — the longest pattern anyone is
// realistically planning in one go.
export const MAX_OCCURRENCES = 366;
export const MAX_INTERVAL = 30;

const DAY_MS = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Dates live in the database as plain YYYY-MM-DD text with no timezone, so all
// arithmetic here is done in UTC. Local time would let the server's timezone
// decide which weekday a date falls on, and DST would make "+ 1 day" occasionally
// mean 23 or 25 hours.
function toUtcMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function weekdayOf(date: string): number {
  return new Date(toUtcMs(date)).getUTCDay();
}

/** Returns an error message, or null if the rule is usable. */
export function validateRule(rule: RecurrenceRule): string | null {
  if (!DATE_RE.test(rule.startDate) || !DATE_RE.test(rule.endDate)) {
    return "Recurrence dates must be in YYYY-MM-DD format";
  }
  // ISO dates sort lexicographically, so a string compare is a date compare.
  if (rule.endDate < rule.startDate) {
    return "Repeat-until date must be on or after the start date";
  }
  if (rule.freq !== "daily" && rule.freq !== "weekly") {
    return "Repeat frequency must be daily or weekly";
  }
  if (
    !Number.isInteger(rule.interval) ||
    rule.interval < 1 ||
    rule.interval > MAX_INTERVAL
  ) {
    return `Repeat interval must be a whole number between 1 and ${MAX_INTERVAL}`;
  }
  if (rule.freq === "weekly") {
    if (rule.byWeekday.length === 0) {
      return "Pick at least one day of the week";
    }
    if (
      rule.byWeekday.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    ) {
      return "Days of the week must be integers from 0 (Sunday) to 6 (Saturday)";
    }
  }
  return null;
}

/**
 * Expands a rule into the concrete dates it covers. Walks day by day rather than
 * jumping ahead, which keeps the weekly and daily cases readable — a year is 365
 * iterations, so there is nothing to gain from being clever.
 *
 * Stops one past MAX_OCCURRENCES so callers can detect an over-long pattern.
 */
export function expandRecurrence(rule: RecurrenceRule): string[] {
  const startMs = toUtcMs(rule.startDate);
  const endMs = toUtcMs(rule.endDate);

  // Anchor weekly intervals to the Sunday of the start date's week, so
  // "every 2 weeks" steps in calendar weeks rather than in 14-day hops from
  // whichever weekday the series happened to start on.
  const anchorMs = startMs - new Date(startMs).getUTCDay() * DAY_MS;

  const dates: string[] = [];

  for (let ms = startMs; ms <= endMs; ms += DAY_MS) {
    let include: boolean;

    if (rule.freq === "daily") {
      const dayIndex = Math.round((ms - startMs) / DAY_MS);
      include = dayIndex % rule.interval === 0;
    } else {
      const weekIndex = Math.floor((ms - anchorMs) / (7 * DAY_MS));
      include =
        rule.byWeekday.includes(new Date(ms).getUTCDay()) &&
        weekIndex % rule.interval === 0;
    }

    if (include) {
      dates.push(fromUtcMs(ms));
      if (dates.length > MAX_OCCURRENCES) break;
    }
  }

  return dates;
}
