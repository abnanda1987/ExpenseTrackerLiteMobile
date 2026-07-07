import { useMemo, useState } from 'react'
import type { SheetData, CategoryTotal } from '../types'
import { fiscalYearOf } from '../config'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// These categories get a projected month-end forecast instead of a plain
// over/under check, since they're recurring monthly commitments. Matched
// by substring (case-insensitive) so names like "Vehicle+Travel" or
// "Truly Personal" still count.
const FORECAST_KEYWORDS = ['personal', 'vehicle', 'home']

function isForecastCategory(category: string): boolean {
  const normalized = category.trim().toLowerCase()
  return FORECAST_KEYWORDS.some((kw) => normalized.includes(kw))
}

type BarStatus = 'green' | 'amber' | 'red'

function money(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export default function Dashboard({
  data,
  onAddExpense,
  onSearchEdit,
}: {
  data: SheetData
  onAddExpense: () => void
  onSearchEdit: () => void
}) {
  const years = useMemo(
    () => Array.from(new Set(data.budgets.map((b) => String(b.year)))).sort().reverse(),
    [data.budgets]
  )
  const mains = useMemo(
    () => Array.from(new Set(data.budgets.map((b) => b.main))).filter(Boolean),
    [data.budgets]
  )

  const currentYear = fiscalYearOf(new Date().toISOString())
  const currentMonth = String(new Date().getMonth())

  const defaultYear = years.includes(currentYear) ? currentYear : years[0] || ''
  const defaultMain = mains.find((m) => /recurring/i.test(m)) || mains[0] || ''

  const [year, setYear] = useState(defaultYear)
  const [main, setMain] = useState(defaultMain)
  const [month, setMonth] = useState<string>(currentMonth) // '0'-'11', or 'all'; only used when main looks like "Recurring"

  const isRecurring = /recurring/i.test(main)
  const isViewingCurrentMonth = isRecurring && month !== 'all' && year === currentYear && month === currentMonth
  const todayDayOfMonth = new Date().getDate()
  const daysInSelectedMonth =
    month !== 'all' && !isNaN(Number(year)) ? new Date(Number(year), Number(month) + 1, 0).getDate() : 30

  function statusFor(row: CategoryTotal): BarStatus {
    if (row.spent > row.budget) return 'red' // already over budget, regardless of category
    if (!isForecastCategory(row.category)) return 'green'
    if (!isViewingCurrentMonth) return 'green' // can't meaningfully forecast a past/future or "All" view
    const projected =
      todayDayOfMonth > 0 ? (row.spent / todayDayOfMonth) * daysInSelectedMonth : row.spent
    return projected > row.budget ? 'amber' : 'green'
  }

  const rows: CategoryTotal[] = useMemo(() => {
    const budgetsForSelection = data.budgets.filter(
      (b) => String(b.year) === year && b.main === main
    )
    const categories = Array.from(new Set(budgetsForSelection.map((b) => b.category)))

    return categories.map((category) => {
      const budget = budgetsForSelection
        .filter((b) => b.category === category)
        .reduce((sum, b) => sum + (Number(b.amount) || 0), 0)

      const spent = data.expenses
        .filter((exp) => {
          if (exp.main !== main || exp.category !== category) return false
          if (fiscalYearOf(exp.date) !== year) return false
          if (isRecurring && month !== 'all') {
            const d = new Date(exp.date)
            if (isNaN(d.getTime()) || String(d.getMonth()) !== month) return false
          }
          return true
        })
        .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0)

      return { category, budget, spent, remaining: budget - spent }
    })
  }, [data, year, main, month, isRecurring])

  const totals = rows.reduce(
    (acc, r) => ({
      budget: acc.budget + r.budget,
      spent: acc.spent + r.spent,
      remaining: acc.remaining + r.remaining,
    }),
    { budget: 0, spent: 0, remaining: 0 }
  )

  if (years.length === 0) {
    return (
      <div className="empty-state">
        No budget rows found yet. Add some rows to the <strong>Budget</strong> sheet
        (Year, Main, Category, Amount) to get started.
      </div>
    )
  }

  return (
    <div>
      <div className="btn-row" style={{ marginBottom: 18 }}>
        <button className="btn btn-add" style={{ margin: 0 }} onClick={onAddExpense}>
          + Add Expense
        </button>
        <button className="btn btn-secondary" onClick={onSearchEdit}>
          Search / Edit
        </button>
      </div>

      <div className="field-row">
        <div className="field">
          <label>FY</label>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Main</label>
          <select value={main} onChange={(e) => setMain(e.target.value)}>
            {mains.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        {isRecurring && (
          <div className="field">
            <label>Month</label>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="all">All</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i)}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="stub">
        <div className="stub-card">
          <div className="label">Budget</div>
          <div className="value">{money(totals.budget)}</div>
        </div>
        <div className="stub-card">
          <div className="label">Spent</div>
          <div className="value">{money(totals.spent)}</div>
        </div>
        <div
          className={`stub-card remaining ${
            totals.remaining >= 0 ? 'positive' : 'negative'
          }`}
        >
          <div className="label">Remaining</div>
          <div className="value">{money(totals.remaining)}</div>
        </div>
      </div>

      <div className="perforation">
        <span>Ledger</span>
      </div>

      {rows.length === 0 && (
        <div className="empty-state">No categories for this FY / Main yet.</div>
      )}

      {rows.map((row) => {
        const pct = row.budget > 0 ? Math.min(100, (row.spent / row.budget) * 100) : row.spent > 0 ? 100 : 0
        const status = statusFor(row)
        return (
          <div className="ledger-row" key={row.category}>
            <div className="ledger-row-top">
              <span className="cat">{row.category}</span>
              <span className="figures">
                {money(row.spent)} / {money(row.budget)}
              </span>
            </div>
            <div className="bar-track">
              <div
                className={`bar-fill ${status === 'red' ? 'over' : status === 'amber' ? 'amber' : ''}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
