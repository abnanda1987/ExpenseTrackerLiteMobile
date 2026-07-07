import { useEffect, useState, useCallback } from 'react'
import { fetchData } from './api'
import type { SheetData } from './types'
import Dashboard from './components/Dashboard'
import AddExpense from './components/AddExpense'

type View = 'dashboard' | 'add'

export default function App() {
  const [data, setData] = useState<SheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('dashboard')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await fetchData()
      setData(d)
    } catch (err: any) {
      setError(err.message || 'Something went wrong loading your data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="app-shell">
      <div className="passbook">
        <div className="passbook-header">
          <p className="brand">ExpTrackerLite</p>
          <h1>{view === 'dashboard' ? 'Dashboard' : 'Add Expense'}</h1>
        </div>
        <div className="passbook-body">
          {error && <div className="status-banner error">{error}</div>}
          {loading && !data && <div className="spinner-line">Loading your ledger…</div>}
          {data && view === 'dashboard' && (
            <Dashboard data={data} onAddExpense={() => setView('add')} />
          )}
          {data && view === 'add' && (
            <AddExpense
              data={data}
              onCancel={() => setView('dashboard')}
              onSaved={async () => {
                await load()
                setView('dashboard')
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
