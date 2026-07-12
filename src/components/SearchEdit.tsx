import { useMemo, useState } from 'react'
import type { SheetData, ExpenseRow } from '../types'
import { updateExpense, deleteExpense } from '../api'
import ExpenseForm from './ExpenseForm'

const PAGE_SIZE = 10

function money(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export default function SearchEdit({
  data,
  onBack,
  onRefresh,
}: {
  data: SheetData
  onBack: () => void
  onRefresh: () => Promise<void>
}) {
  const categories = useMemo(
    () => Array.from(new Set(data.expenses.map((e) => e.category))).filter(Boolean).sort(),
    [data.expenses]
  )

  const [category, setCategory] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(0)
  const [editingRow, setEditingRow] = useState<ExpenseRow | null>(null)
  const [deletingRow, setDeletingRow] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return data.expenses
      .filter((exp) => {
        if (category !== 'all' && exp.category !== category) return false
        if (dateFrom && exp.date < dateFrom) return false
        if (dateTo && exp.date > dateTo) return false
        return true
      })
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [data.expenses, category, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const clampedPage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(clampedPage * PAGE_SIZE, clampedPage * PAGE_SIZE + PAGE_SIZE)

  function updateFilter(fn: () => void) {
    fn()
    setPage(0)
  }

  async function handleDelete(exp: ExpenseRow) {
    if (exp._row === undefined) return
    const confirmed = window.confirm(
      `Delete this expense?\n\n${exp.date} · ${exp.category} · ${money(exp.amount)}\n\nThis removes the row from your Google Sheet and cannot be undone.`
    )
    if (!confirmed) return

    setDeletingRow(exp._row)
    setDeleteError(null)
    try {
      await deleteExpense(exp._row)
      await onRefresh()
    } catch (err: any) {
      setDeleteError(err.message || 'Could not delete this expense.')
    } finally {
      setDeletingRow(null)
    }
  }

  if (editingRow) {
    return (
      <div>
        <div className="perforation">
          <span>Editing entry</span>
        </div>
        <ExpenseForm
          data={data}
          initialMain={editingRow.main}
          initialCategory={editingRow.category}
          initialAmount={editingRow.amount}
          initialRemarks={editingRow.remarks}
          initialDate={editingRow.date}
          editingRow={editingRow._row}
          saveLabel="Update"
          onCancel={() => setEditingRow(null)}
          onSubmit={(entry) =>
            updateExpense({ ...entry, _row: editingRow._row as number })
          }
          onSaved={async () => {
            await onRefresh()
            setEditingRow(null)
          }}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="field-row">
        <div className="field">
          <label>Category</label>
          <select
            value={category}
            onChange={(e) => updateFilter(() => setCategory(e.target.value))}
          >
            <option value="all">All</option>
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
          <label>From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => updateFilter(() => setDateFrom(e.target.value))}
          />
        </div>
        <div className="field">
          <label>To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => updateFilter(() => setDateTo(e.target.value))}
          />
        </div>
      </div>

      <div className="perforation">
        <span>{filtered.length} entries</span>
      </div>

      {deleteError && <div className="status-banner error">{deleteError}</div>}

      {pageItems.length === 0 && (
        <div className="empty-state">No expenses match this search.</div>
      )}

      {pageItems.map((exp, i) => (
        <div className="ledger-row" key={`${exp._row}-${i}`}>
          <div className="ledger-row-top">
            <span className="cat">{exp.category}</span>
            <span className="figures">{money(exp.amount)}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 2,
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--muted)' }}>
              {exp.date} · {exp.main}
              {exp.remarks ? ` · ${exp.remarks}` : ''}
            </span>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setEditingRow(exp)}
                disabled={deletingRow === exp._row}
              >
                Edit
              </button>
              <button
                className="btn btn-danger"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => handleDelete(exp)}
                disabled={deletingRow === exp._row}
              >
                {deletingRow === exp._row ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ))}

      {filtered.length > PAGE_SIZE && (
        <div className="btn-row">
          <button
            className="btn btn-secondary"
            disabled={clampedPage === 0}
            onClick={() => setPage(clampedPage - 1)}
          >
            ← Prev
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--muted)',
              flex: 1,
            }}
          >
            Page {clampedPage + 1} of {totalPages}
          </div>
          <button
            className="btn btn-secondary"
            disabled={clampedPage >= totalPages - 1}
            onClick={() => setPage(clampedPage + 1)}
          >
            Next →
          </button>
        </div>
      )}

      <button className="btn btn-secondary" style={{ width: '100%', marginTop: 18 }} onClick={onBack}>
        Back to Dashboard
      </button>
    </div>
  )
}
