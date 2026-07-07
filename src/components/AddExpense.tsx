import { useMemo, useState } from 'react'
import type { SheetData } from '../types'
import { addExpense } from '../api'

export default function AddExpense({
  data,
  onCancel,
  onSaved,
}: {
  data: SheetData
  onCancel: () => void
  onSaved: () => void
}) {
  const mains = useMemo(
    () => Array.from(new Set(data.budgets.map((b) => b.main))).filter(Boolean),
    [data.budgets]
  )

  const [main, setMain] = useState(mains[0] || '')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Categories loaded dynamically from the Budget sheet, filtered by Main.
  const categories = useMemo(() => {
    const list = Array.from(
      new Set(
        data.budgets.filter((b) => b.main === main).map((b) => b.category)
      )
    ).filter(Boolean)
    return list
  }, [data.budgets, main])

  const defaultCategory = categories.find((c) => /^personal$/i.test(c)) || categories[0] || ''
  const effectiveCategory = category || defaultCategory
  const amountNum = Number(amount)
  const canSave = !!main && !!effectiveCategory && amountNum > 0 && !saving

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await addExpense({
        main,
        category: effectiveCategory,
        amount: amountNum,
        remarks,
      })
      onSaved()
    } catch (err: any) {
      setError(err.message || 'Could not save this expense.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {error && <div className="status-banner error">{error}</div>}

      <div className="field-row">
        <div className="field">
          <label>Main</label>
          <select
            value={main}
            onChange={(e) => {
              setMain(e.target.value)
              setCategory('')
            }}
          >
            {mains.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Category</label>
          <select value={effectiveCategory} onChange={(e) => setCategory(e.target.value)}>
            {categories.length === 0 && <option value="">No categories yet</option>}
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Optional note…"
          />
        </div>
      </div>

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
