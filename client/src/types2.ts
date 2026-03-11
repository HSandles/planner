export interface Block {
  id: number
  title: string
  description: string
  date: string
  start_time: string
  end_time: string
  duration_minutes: number
  categories: string[]
  completed: boolean
  created_at: string
}

export interface CreateBlockInput {
  title: string
  description?: string
  date: string
  start_time: string
  end_time: string
}

export interface UpdateBlockInput {
  title?: string
  description?: string
  date?: string
  start_time?: string
  end_time?: string
  completed?: boolean
}

export interface AnalyticsEntry {
  category: string
  planned: number
  completed: number
}

export interface User {
  id: number
  email: string
}