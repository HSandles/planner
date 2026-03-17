export interface Block {
  id: number;
  userId: number;
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
}

export interface UpdateBlockInput {
  title?: string;
  description?: string;
  date?: string;
  start_time?: string;
  end_time?: string;
  completed?: boolean;
}

export interface AnalyticsEntry {
  category: string;
  planned: number;
  completed: number;
}

export interface User {
  id: number;
  email: string;
}
