export interface BudgetRow {
  year: string | number
  main: string
  category: string
  amount: number
  [key: string]: unknown
}

export interface ExpenseRow {
  main: string
  category: string
  amount: number
  date: string // yyyy-MM-dd
  remarks?: string
  [key: string]: unknown
}

export interface SheetData {
  budgets: BudgetRow[]
  expenses: ExpenseRow[]
}

export interface CategoryTotal {
  category: string
  budget: number
  spent: number
  remaining: number
}
