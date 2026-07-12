import { useMemo, useState } from 'react'
import type { SheetData } from '../types'
import { fiscalYearOf } from '../config'
import { evaluateExpression } from '../formula'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// Same set as the Dashboard's forecast categories - recurring monthly commitments.
// Matched by substring so "Vehicle+Travel" / "Truly Personal" still count.
const FORECAST_KEYWORDS = ['personal', 'vehicle', 'home']

function isForecastCategory(category: string): boolean {
  const normalized = category.trim().toLowerCase()
  return FORECAST_KEYWORDS.some((kw) => normalized.includes(kw))
}

export function todayLocal(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export interface ExpenseFormValues {
  main: string
  category: string
  amount: number
  amountExpr: string
  remarks: string
  date: string
}

export default function ExpenseForm({
  data,
  initialMain,
  initialCategory,
  initialAmount,
  initialRemarks,
  initialDate,
  editingRow,
  saveLabel = 'Save',
  onCancel,
  onSubmit,
  onSaved,
}: {
  data: SheetData
  initialMain?: string
  initialCategory?: string
  initialAmount?: number
  initialRemarks?: string
  initialDate?: string
  editingRow?: number
  saveLabel?: string
  onCancel: () => void
  onSubmit: (entry: ExpenseFormValues) => Promise<void>
  onSaved: () => void
}) {
  const today = todayLocal()
  const mains = useMemo(
    () => Array.from(new Set(data.budgets.map((b) => b.main))).filter(Boolean),
    [data.budgets]
  )

  const [main, setMain] = useState(initialMain || mains[0] || '')
  const [category, setCategory] = useState(initialCategory || '')
  const [amountInput, setAmountInput] = useState(
    initialAmount !== undefined && initialAmount !== null ? String(initialAmount) : ''
  )
  const [remarks, setRemarks] = useState(initialRemarks || '')
  const [date, setDate] = useState(initialDate || today)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Categories loaded dynamically from the Budget sheet, filtered by Main.
  const categories = useMemo(() => {
    const list = Array.from(
      new Set(data.budgets.filter((b) => b.main === main).map((b) => b.category))
    ).filter(Boolean)
    return list
  }, [data.budgets, main])

  const isRecurringMain = /recurring/i.test(main)
  // "Truly Personal" is the most common category, so default to it under Recurring.
  const defaultCategory = isRecurringMain
    ? categories.find((c) => /personal/i.test(c)) || categories[0] || ''
    : categories[0] || ''
  const effectiveCategory = category || defaultCategory

  const evalResult = useMemo(() => evaluateExpression(amountInput), [amountInput])
  const amountNum = evalResult.value ?? 0
  const amountErrorMessage = evalResult.error
    ? evalResult.error
    : evalResult.value !== null && evalResult.value <= 0
      ? 'Amount must be greater than 0'
      : null

  const isValidDate = !!date && date <= today
  const canSave =
    !!main && !!effectiveCategory && evalResult.value !== null && evalResult.value > 0 && isValidDate && !saving

  // Feature: show "XX% of the monthly budget spent" for the recurring
  // forecast categories, using the selected date's year/month.
  const budgetNote = useMemo(() => {
    if (!isForecastCategory(effectiveCategory) || !date) return null
    const [selYearStr, selMonthStr] = date.split('-')
    const selYear = Number(selYearStr)
    const selMonthIndex = Number(selMonthStr) - 1
    if (isNaN(selYear) || isNaN(selMonthIndex)) return null

    const fy = fiscalYearOf(date)
    const monthlyBudget = data.budgets
      .filter((b) => String(b.year) === fy && b.main === main && b.category === effectiveCategory)
      .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)

    const existingSpent = data.expenses
      .filter((exp) => {
        if (exp.main !== main || exp.category !== effectiveCategory) return false
        if (editingRow !== undefined && exp._row === editingRow) return false
        const [ey, em] = (exp.date || '').split('-').map(Number)
        return ey === selYear && em - 1 === selMonthIndex
      })
      .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)

    const projected = existingSpent + (amountNum > 0 ? amountNum : 0)
    if (monthlyBudget <= 0) return null

    const pct = Math.round((projected / monthlyBudget) * 100)
    return { pct, monthLabel: `${MONTH_NAMES[selMonthIndex]} ${selYear}` }
  }, [data, main, effectiveCategory, date, amountNum, editingRow])

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        main,
        category: effectiveCategory,
        amount: amountNum,
        amountExpr: amountInput.trim(),
        remarks,
        date,
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
          <label>Date</label>
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label>Amount</label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="e.g. 100+45-56"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
          />
          {amountInput.trim() !== '' && (
            <div className={`amount-preview ${amountErrorMessage ? 'error' : ''}`}>
              {amountErrorMessage ? amountErrorMessage : `= ${amountNum}`}
            </div>
          )}
        </div>
      </div>

      {budgetNote && (
        <div className={`status-banner ${budgetNote.pct > 100 ? 'error' : 'info'}`}>
          {budgetNote.pct}% of {effectiveCategory}'s monthly budget spent for {budgetNote.monthLabel}.
        </div>
      )}

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
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  )
}
