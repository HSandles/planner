import { useState, useEffect } from 'react'
import BlockForm from '../components/BlockForm'
import BlockList from '../components/BlockList'
import { Block } from '../models'
import styles from './BlocksPage.module.css'

export default function BlocksPage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [showForm, setShowForm] = useState<boolean>(false)
  const [editingBlock, setEditingBlock] = useState<Block | null>(null)

  const fetchBlocks = async (): Promise<void> => {
    const res = await fetch('/api/blocks', { credentials: 'include' })
    const data: Block[] = await res.json()
    setBlocks(data)
    setLoading(false)
  }

  useEffect(() => { fetchBlocks() }, [])

  // Handles creating a single block, creating a whole recurring series (an
  // array), and saving an edited occurrence. `seriesWide` means the save also
  // changed other occurrences we're not holding, so we refetch instead of
  // patching just the one block we got back.
  const handleSave = (saved: Block | Block[], seriesWide?: boolean): void => {
    if (Array.isArray(saved)) {
      setBlocks(prev => [...saved, ...prev])
    } else if (seriesWide) {
      fetchBlocks()
    } else {
      setBlocks(prev => {
        const exists = prev.find(b => b.id === saved.id)
        if (exists) {
          return prev.map(b => b.id === saved.id ? saved : b)
        }
        return [saved, ...prev]
      })
    }
    setShowForm(false)
    setEditingBlock(null)
  }

  const handleDelete = async (id: number): Promise<void> => {
    await fetch(`/api/blocks/${id}`, { method: 'DELETE', credentials: 'include' })
    setBlocks(prev => prev.filter(b => b.id !== id))
  }

  const handleEdit = (block: Block): void => {
    setEditingBlock(block)
    setShowForm(true)
  }

  const handleToggleComplete = async (id: number, completed: boolean): Promise<void> => {
    const res = await fetch(`/api/blocks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ completed })
    })
    const updated: Block = await res.json()
    setBlocks(prev => prev.map(b => b.id === id ? updated : b))
  }

  const handleCloseForm = (): void => {
    setShowForm(false)
    setEditingBlock(null)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Your Time Blocks</h2>
          <p className={styles.subtitle}>Log activities and we'll categorise them automatically.</p>
        </div>
        <button className={styles.addBtn} onClick={() => setShowForm(true)}>
          + Add Block
        </button>
      </header>

      {showForm && (
        <div
          className={styles.formOverlay}
          onClick={(e) => e.target === e.currentTarget && handleCloseForm()}
        >
          <div className={styles.formModal}>
            <BlockForm
              onSave={handleSave}
              onCancel={handleCloseForm}
              existing={editingBlock ?? undefined}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.empty}>Loading your blocks...</div>
      ) : blocks.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>Nothing logged yet.</p>
          <p>Add your first time block to get started.</p>
        </div>
      ) : (
        <BlockList
          blocks={blocks}
          onDelete={handleDelete}
          onEdit={handleEdit}
          onToggleComplete={handleToggleComplete}
        />
      )}
    </div>
  )
}