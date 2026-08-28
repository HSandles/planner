export type Freq = "daily" | "weekly";

/** How often a series repeats. Weekdays are 0 = Sunday … 6 = Saturday. */
export interface Recurrence {
  freq: Freq;
  interval: number;
  by_weekday: number[];
  end_date: string;
}

/**
 * Which occurrences an edit or delete applies to. "future" means this
 * occurrence and every later one in the same series.
 */
export type EditScope = "single" | "future";

export interface Block {
  id: number;
  userId: number;
  /** Null for one-off blocks. */
  seriesId: number | null;
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  categories: string[];
  completed: boolean;
  createdAt: string;
}

export interface CreateBlockInput {
  title: string;
  description?: string;
  date: string;
  start_time: string;
  end_time: string;
  /** Omit for a one-off block. */
  recurrence?: Recurrence;
}

export interface UpdateBlockInput {
  title?: string;
  description?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  completed?: boolean;
  scope?: EditScope;
}

export interface AnalyticsEntry {
  category: string;
  planned: number;
  completed: number;
}

export interface User {
  id: number;
  email: string;
  verified: boolean;
}
