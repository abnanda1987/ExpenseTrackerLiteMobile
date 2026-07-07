import type { SheetData } from '../types'
import { addExpense } from '../api'
import ExpenseForm from './ExpenseForm'

export default function AddExpense({
  data,
  onCancel,
  onSaved,
}: {
  data: SheetData
  onCancel: () => void
  onSaved: () => void
}) {
  return (
    <ExpenseForm
      data={data}
      saveLabel="Save"
      onCancel={onCancel}
      onSaved={onSaved}
      onSubmit={(entry) => addExpense(entry)}
    />
  )
}
