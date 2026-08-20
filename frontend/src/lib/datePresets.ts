export type DatePeriod = 'today' | 'this_month' | 'last_6_months' | 'this_year' | 'custom'

export const DATE_PERIOD_OPTIONS: { value: DatePeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'this_month', label: 'This month' },
  { value: 'last_6_months', label: 'Last 6 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom' },
]

type YmdParts = { y: number; m: number; d: number }

function partsInToronto(date = new Date()): YmdParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? '1')

  return { y: get('year'), m: get('month'), d: get('day') }
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

function shiftMonths({ y, m, d }: YmdParts, deltaMonths: number): YmdParts {
  const index = y * 12 + (m - 1) + deltaMonths
  const ny = Math.floor(index / 12)
  const nm = (index % 12) + 1
  const nd = Math.min(d, daysInMonth(ny, nm))
  return { y: ny, m: nm, d: nd }
}

/** Inclusive date range (YYYY-MM-DD) for a preset in America/Toronto. */
export function rangeForPeriod(period: Exclude<DatePeriod, 'custom'>): { from: string; to: string } {
  const todayParts = partsInToronto()
  const today = ymd(todayParts.y, todayParts.m, todayParts.d)

  switch (period) {
    case 'today':
      return { from: today, to: today }
    case 'this_month':
      return { from: ymd(todayParts.y, todayParts.m, 1), to: today }
    case 'last_6_months': {
      const start = shiftMonths(todayParts, -6)
      return { from: ymd(start.y, start.m, start.d), to: today }
    }
    case 'this_year':
      return { from: ymd(todayParts.y, 1, 1), to: today }
  }
}

export function torontoTodayYmd(): string {
  const { y, m, d } = partsInToronto()
  return ymd(y, m, d)
}
