import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import pg from 'pg'
import Anthropic from '@anthropic-ai/sdk'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import cookieParser from 'cookie-parser'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const { Pool } = pg
const app = express()
const anthropic = new Anthropic()

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.CLIENT_URL ?? true
    : 'http://localhost:5173',
  credentials: true
}))
app.use(express.json())
app.use(cookieParser())

// --- DATABASE ---
const pool = new Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'planner',
  user: process.env.DB_USER ?? 'harry',
  password: process.env.DB_PASSWORD,
})


await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`)

await pool.query(`
  CREATE TABLE IF NOT EXISTS blocks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    categories JSONB NOT NULL DEFAULT '[]',
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`)

console.log('Connected to PostgreSQL')

// --- INTERFACES ---
interface UserRow {
  id: number
  email: string
  password_hash: string
  created_at: string
}

interface BlockRow {
  id: number
  user_id: number
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

interface CreateBlockBody {
  title: string
  description?: string
  date: string
  start_time: string
  end_time: string
}

interface UpdateBlockBody {
  title?: string
  description?: string
  date?: string
  start_time?: string
  end_time?: string
  completed?: boolean
}

interface AnalyticsEntry {
  category: string
  hours: number
}

// This extends the Express Request type to include the authenticated user.
// Once a request passes the auth middleware, req.user is guaranteed to exist.
interface AuthenticatedRequest extends Request {
  user: { id: number; email: string }
}

// --- AUTH MIDDLEWARE ---
// This runs before any protected route handler.
// It reads the JWT from the cookie, verifies it, and attaches the user to the request.
function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined

  if (!token) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: number; email: string }
    ;(req as AuthenticatedRequest).user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' })
  }
}

// --- AUTH ROUTES ---

app.post('/auth/register', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' })
    return
  }

  // bcrypt automatically generates a salt and hashes the password.
  // The 12 is the "cost factor" — higher means slower but more secure.
  const password_hash = await bcrypt.hash(password, 12)

  try {
    const result = await pool.query<UserRow>(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase(), password_hash]
    )

    const user = result.rows[0]
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })

    res.cookie('token', token, {
      httpOnly: true,   // not accessible via JavaScript
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax',  // protects against CSRF
      maxAge: COOKIE_MAX_AGE
    })

    res.status(201).json({ id: user.id, email: user.email })
  } catch (err: unknown) {
    // Postgres error code 23505 = unique violation (email already exists)
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'An account with this email already exists' })
    } else {
      res.status(500).json({ error: 'Registration failed' })
    }
  }
})

app.post('/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' })
    return
  }

  const result = await pool.query<UserRow>(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  )

  const user = result.rows[0]

  // bcrypt.compare is timing-safe — it won't leak information about whether
  // the email or password was wrong, which prevents user enumeration attacks
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Invalid email or password' })
    return
  }

  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' })

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE
  })

  res.json({ id: user.id, email: user.email })
})

app.post('/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('token')
  res.json({ success: true })
})

// Returns the current user if their cookie is valid — used on page load
// to check if the user is already logged in
app.get('/auth/me', requireAuth, (req: Request, res: Response) => {
  res.json((req as unknown as AuthenticatedRequest).user)
})

// --- HELPERS ---
async function categoriseBlock(title: string, description?: string): Promise<string[]> {
  const prompt = `You are a life activity categoriser. Given an activity, return a JSON array of 1-3 category labels from this list:
  
  ["Work", "Fitness", "Social", "Family", "Learning", "Health", "Creative", "Rest", "Errands", "Travel", "Food", "Spirituality", "Finance", "Hobbies"]

  Activity title: "${title}"
  ${description ? `Description: "${description}"` : ''}

  Rules:
  - Return ONLY a raw JSON array, no explanation, no markdown
  - Pick the most relevant 1-3 categories`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [{ role: 'user', content: prompt }]
  })

  try {
    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    const categories = JSON.parse(text)
    return Array.isArray(categories) ? categories : ['Uncategorised']
  } catch {
    return ['Uncategorised']
  }
}

function calcDuration(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return (eh * 60 + em) - (sh * 60 + sm)
}

// --- PROTECTED ROUTES ---
// All routes below require a valid JWT cookie

app.get('/api/blocks', requireAuth, async (req: Request, res: Response) => {
  const { id } = (req as unknown as AuthenticatedRequest).user
  const { from, to } = req.query as { from?: string; to?: string }

  let result
  if (from && to) {
    result = await pool.query<BlockRow>(
      'SELECT * FROM blocks WHERE user_id = $1 AND date BETWEEN $2 AND $3 ORDER BY date ASC, start_time ASC',
      [id, from, to]
    )
  } else {
    result = await pool.query<BlockRow>(
      'SELECT * FROM blocks WHERE user_id = $1 ORDER BY date DESC, start_time ASC',
      [id]
    )
  }

  res.json(result.rows)
})

app.post('/api/blocks', requireAuth, async (req: Request<{}, {}, CreateBlockBody>, res: Response) => {
  const { id } = (req as unknown as AuthenticatedRequest).user
  const { title, description, date, start_time, end_time } = req.body

  if (!title || !date || !start_time || !end_time) {
    res.status(400).json({ error: 'Missing required fields' })
    return
  }

  const duration_minutes = calcDuration(start_time, end_time)
  if (duration_minutes <= 0) {
    res.status(400).json({ error: 'End time must be after start time' })
    return
  }

  const categories = await categoriseBlock(title, description)

  const result = await pool.query<BlockRow>(
    `INSERT INTO blocks (user_id, title, description, date, start_time, end_time, duration_minutes, categories)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [id, title, description ?? '', date, start_time, end_time, duration_minutes, JSON.stringify(categories)]
  )

  res.status(201).json(result.rows[0])
})

app.patch('/api/blocks/:id', requireAuth, async (req: Request<{ id: string }, {}, UpdateBlockBody>, res: Response) => {
  const { id: userId } = (req as unknown as AuthenticatedRequest).user
  const { id } = req.params
  const { title, description, date, start_time, end_time, completed } = req.body

  // If just toggling completion, skip re-categorisation
  if (completed !== undefined && !title) {
    const result = await pool.query<BlockRow>(
      'UPDATE blocks SET completed = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [completed, id, userId]
    )
    res.json(result.rows[0])
    return
  }

  // If editing the block content, re-categorise with Claude
  const categories = await categoriseBlock(title ?? '', description)
  const duration_minutes = calcDuration(start_time ?? '', end_time ?? '')

  const result = await pool.query<BlockRow>(
    `UPDATE blocks 
     SET title = $1, description = $2, date = $3, start_time = $4, 
         end_time = $5, duration_minutes = $6, categories = $7, completed = $8
     WHERE id = $9 AND user_id = $10
     RETURNING *`,
    [title, description ?? '', date, start_time, end_time, duration_minutes, JSON.stringify(categories), completed ?? false, id, userId]
  )

  if (!result.rows.length) {
    res.status(404).json({ error: 'Block not found' })
    return
  }

  res.json(result.rows[0])
})

app.delete('/api/blocks/:id', requireAuth, async (req: Request<{ id: string }>, res: Response) => {
  const { id: userId } = (req as unknown as AuthenticatedRequest).user
  // Include user_id in the WHERE clause so users can only delete their own blocks
  await pool.query('DELETE FROM blocks WHERE id = $1 AND user_id = $2', [req.params.id, userId])
  res.json({ success: true })
})

app.get('/api/analytics', requireAuth, async (req: Request, res: Response) => {
  const { id } = (req as unknown as AuthenticatedRequest).user
  const { from, to } = req.query as { from?: string; to?: string }

  let result
  if (from && to) {
    result = await pool.query<Pick<BlockRow, 'categories' | 'duration_minutes' | 'completed'>>(
      'SELECT categories, duration_minutes, completed FROM blocks WHERE user_id = $1 AND date BETWEEN $2 AND $3',
      [id, from, to]
    )
  } else {
    result = await pool.query<Pick<BlockRow, 'categories' | 'duration_minutes' | 'completed'>>(
      'SELECT categories, duration_minutes, completed FROM blocks WHERE user_id = $1',
      [id]
    )
  }

  const planned: Record<string, number> = {}
  const completed: Record<string, number> = {}

  for (const row of result.rows) {
    for (const cat of row.categories) {
      planned[cat] = (planned[cat] ?? 0) + row.duration_minutes
      if (row.completed) {
        completed[cat] = (completed[cat] ?? 0) + row.duration_minutes
      }
    }
  }

  const data = Object.keys(planned)
    .map(category => ({
      category,
      planned: Math.round((planned[category] / 60) * 10) / 10,
      completed: Math.round(((completed[category] ?? 0) / 60) * 10) / 10
    }))
    .sort((a, b) => b.planned - a.planned)

  res.json(data)
})
// Serve the React app in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = join(process.cwd(), '../client/dist')
  app.use(express.static(clientPath))
  app.get('*', (_req, res) => {
    res.sendFile(join(clientPath, 'index.html'))
  })
}

app.listen(3001, () => console.log('Server running on http://localhost:3001'))