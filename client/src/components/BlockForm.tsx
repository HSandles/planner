import { useState, ChangeEvent } from 'react'
import { Block, CreateBlockInput } from '../types2'
import styles from './BlockForm.module.css'

interface BlockFormProps {
  onAdd: (block: Block) => void
  onCancel: () => void
  existing?: Block  // if provided, we're editing rather than creating
}

const today = new Date().toISOString().split('T')[0]

export default function BlockForm({ onAdd, onCancel, existing }: BlockFormProps) {
  const [form, setForm] = useState<CreateBlockInput>({
    title: existing?.title ?? '',
    description: existing?.description ?? '',
    date: existing?.date ?? today,
    start_time: existing?.start_time ?? '',
    end_time: existing?.end_time ?? ''
  })
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  const set = (field: keyof CreateBlockInput) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (): Promise<void> => {
    if (!form.title || !form.date || !form.start_time || !form.end_time) {
      setError('Please fill in all required fields.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const url = existing ? `/api/blocks/${existing.id}` : '/api/blocks'
      const method = existing ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form)
      })

      if (!res.ok) {
        const err = await res.json() as { error: string }
        setError(err.error || 'Something went wrong.')
        setSubmitting(false)
        return
      }

      const block: Block = await res.json()
      onAdd(block)
    } catch {
      setError('Could not connect to server.')
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.form}>
      <h3 className={styles.heading}>{existing ? 'Edit Block' : 'New Time Block'}</h3>

      <label className={styles.label}>
        Activity *
        <input
          className={styles.input}
          placeholder="e.g. Gym session, Dinner with Sarah, Team standup"
          value={form.title}
          onChange={set('title')}
        />
      </label>

      <label className={styles.label}>
        Notes <span className={styles.optional}>(optional)</span>
        <textarea
          className={styles.textarea}
          placeholder="Any extra context helps with categorisation..."
          value={form.description}
          onChange={set('description')}
          rows={2}
        />
      </label>

      <label className={styles.label}>
        Date *
        <input
          className={styles.input}
          type="date"
          value={form.date}
          onChange={set('date')}
        />
      </label>

      <div className={styles.timeRow}>
        <label className={styles.label}>
          Start *
          <input
            className={styles.input}
            type="time"
            value={form.start_time}
            onChange={set('start_time')}
          />
        </label>
        <label className={styles.label}>
          End *
          <input
            className={styles.input}
            type="time"
            value={form.end_time}
            onChange={set('end_time')}
          />
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button className={styles.cancel} onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button className={styles.submit} onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Saving…' : existing ? 'Save Changes' : 'Save Block'}
        </button>
      </div>

      {submitting && (
        <p className={styles.hint}>✦ Claude is categorising your activity…</p>
      )}
    </div>
  )
}