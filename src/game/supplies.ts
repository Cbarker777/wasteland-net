import { SUPPLIES_DECAY_FLAT, SUPPLIES_DECAY_PERCENT, SUPPLIES_START } from './config'
import { daysBetween } from './dates'

export type Supplies = {
  amount: number
  /** Last day decay was applied through. */
  lastDecayDate: string
  /** First day of the current unbroken run above zero; null while at zero. */
  positiveSince: string | null
}

export function initialSupplies(today: string): Supplies {
  return { amount: SUPPLIES_START, lastDecayDate: today, positiveSince: today }
}

export function dailyDecay(amount: number): number {
  return SUPPLIES_DECAY_FLAT + Math.round(amount * SUPPLIES_DECAY_PERCENT)
}

/** Applies one day's decay for every day that has started since the last tick. */
export function decaySupplies(s: Supplies, today: string): Supplies {
  const days = daysBetween(s.lastDecayDate, today)
  if (days <= 0) return s
  let { amount, positiveSince } = s
  for (let i = 1; i <= days && amount > 0; i++) {
    amount = Math.max(0, amount - dailyDecay(amount))
    if (amount === 0) positiveSince = null
  }
  return { amount, lastDecayDate: today, positiveSince }
}

/** Adds supplies. Wrong answers never call this — there is no penalty path. */
export function gainSupplies(s: Supplies, gained: number, today: string): Supplies {
  if (gained <= 0) return s
  return { ...s, amount: s.amount + gained, positiveSince: s.positiveSince ?? today }
}

/** Days of the current unbroken run above zero, counting today. */
export function survivorDays(s: Supplies, today: string): number {
  return s.positiveSince && s.amount > 0 ? daysBetween(s.positiveSince, today) + 1 : 0
}

/** Forecast for the status panel: days until the stockpile runs dry with no study. */
export function daysOfSupplies(amount: number): number {
  let days = 0
  let a = amount
  while (a > 0 && days < 999) {
    a = Math.max(0, a - dailyDecay(a))
    days++
  }
  return days
}

