// ASSUMPTION: Budget sheet's "Year" is treated as the plain calendar year
// (Jan-Dec) that an expense date falls in. If your Budget sheet actually
// uses an April-March fiscal year (or any other start month), change this
// constant. 1 = January, 4 = April, etc.
export const FISCAL_YEAR_START_MONTH = 1

export function fiscalYearOf(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const month = d.getMonth() + 1 // 1-12
  const year = d.getFullYear()
  if (FISCAL_YEAR_START_MONTH === 1) return String(year)
  // e.g. Apr-Dec belongs to "year", Jan-Mar belongs to "year-1"
  return month >= FISCAL_YEAR_START_MONTH ? String(year) : String(year - 1)
}
