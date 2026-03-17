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

  // Handles both creating a new block and saving an edited one
  const handleSave = (savedBlock: Block): void => {
    setBlocks(prev => {
      const exists = prev.find(b => b.id === savedBlock.id)
      if (exists) {
        return prev.map(b => b.id === savedBlock.id ? savedBlock : b)
      }
      return [savedBlock, ...prev]
    })
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
              onAdd={handleSave}
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