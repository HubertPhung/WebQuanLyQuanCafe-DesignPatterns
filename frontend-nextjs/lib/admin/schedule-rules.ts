export function matchesSchedulePeriod(date: string, month: string, year: string): boolean {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(date)
  return Boolean(match && Number(match[1]) === Number(year) && Number(match[2]) === Number(month))
}
