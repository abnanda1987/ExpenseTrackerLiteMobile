import type { SheetData } from './types'

const BASE_URL = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined

function assertConfigured() {
  if (!BASE_URL) {
    throw new Error(
      'VITE_APPS_SCRIPT_URL is not set. Copy .env.example to .env and paste your ' +
        'Apps Script Web App URL.'
    )
  }
}

export async function fetchData(): Promise<SheetData> {
  assertConfigured()
  const res = await fetch(`${BASE_URL}?action=data`)
  if (!res.ok) throw new Error(`Failed to load data (${res.status})`)
  const json = await res.json()
  return {
    budgets: (json.budgets || []).map((b: any) => ({
      ...b,
      amount: Number(b.amount) || 0,
    })),
    expenses: (json.expenses || []).map((e: any) => ({
      ...e,
      amount: Number(e.amount) || 0,
    })),
  }
}

export interface NewExpense {
  main: string
  category: string
  amount: number
  remarks: string
  date: string // yyyy-MM-dd
}

export interface UpdateExpense extends NewExpense {
  _row: number
}

async function postToSheet(payload: Record<string, unknown>): Promise<void> {
  assertConfigured()
  // Content-Type text/plain avoids a CORS preflight (OPTIONS), which
  // Apps Script web apps do not support. The body is still valid JSON.
  const res = await fetch(BASE_URL as string, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to save expense (${res.status})`)
  const json = await res.json()
  if (!json.ok) throw new Error(json.error || 'Failed to save expense')
}

export async function addExpense(entry: NewExpense): Promise<void> {
  await postToSheet({ action: 'add', ...entry })
}

export async function updateExpense(entry: UpdateExpense): Promise<void> {
  await postToSheet({ action: 'update', ...entry })
}
