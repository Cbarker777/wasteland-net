import { DAILY_GOAL } from './config'
import { addDays } from './dates'

/** Answers per local date. */
export type DayLog = Record<string, number>

const met = (days: DayLog, key: string) => (days[key] ?? 0) >= DAILY_GOAL

/** Consecutive days meeting the daily goal, ending today (or yesterday if today isn't met yet). */
export function currentStreak(days: DayLog, today: string): number {
  let cursor = met(days, today) ? today : addDays(today, -1)
  let n = 0
  while (met(days, cursor)) {
    n++
    cursor = addDays(cursor, -1)
  }
  return n
}

export function longestStreak(days: DayLog): number {
  const keys = Object.keys(days).filter((k) => met(days, k)).sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const k of keys) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1
    best = Math.max(best, run)
    prev = k
  }
  return best
}
