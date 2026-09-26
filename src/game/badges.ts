import { SKILL_INFO, SUBELEMENT_ORDER, type SubelementId } from '../data/pool'
import { EXAM_LENGTH, EXAM_PASS, STREAK_BADGES, SURVIVOR_DAYS } from './config'

export type BadgeKind = 'streak' | 'boss' | 'mastery' | 'survivor'

export type Badge = {
  id: string
  kind: BadgeKind
  name: string
  description: string
  /** Label shown on the badge plate. */
  glyph: string
  subelement?: SubelementId
  streakDays?: number
}

const STREAK_NAMES: Record<number, string> = { 7: 'Week on the Air', 30: 'Month of Signals', 100: 'Hundred-Day Net' }

export const BADGES: Badge[] = [
  ...STREAK_BADGES.map<Badge>((days) => ({
    id: `streak-${days}`,
    kind: 'streak',
    name: STREAK_NAMES[days] ?? `${days}-Day Streak`,
    description: `Meet the daily goal ${days} days in a row.`,
    glyph: `${days}D`,
    streakDays: days,
  })),
  { id: 'boss-pass', kind: 'boss', name: 'Examiner Down', description: `Pass a boss battle (${EXAM_PASS} of ${EXAM_LENGTH} or better).`, glyph: 'PASS' },
  { id: 'boss-perfect', kind: 'boss', name: 'Flawless Transmission', description: `Answer all ${EXAM_LENGTH} boss battle questions correctly.`, glyph: '50/50' },
  ...SUBELEMENT_ORDER.map<Badge>((se) => ({
    id: `mastery-${se}`,
    kind: 'mastery',
    name: SKILL_INFO[se].badge,
    description: `Max out the ${SKILL_INFO[se].label} skill: every ${se} question in long-term review.`,
    glyph: se,
    subelement: se,
  })),
  { id: 'survivor', kind: 'survivor', name: 'Still Standing', description: `Keep Supplies above zero for ${SURVIVOR_DAYS} days straight.`, glyph: `${SURVIVOR_DAYS}+` },
]

export const BADGES_BY_ID: ReadonlyMap<string, Badge> = new Map(BADGES.map((b) => [b.id, b]))

export type BadgeFacts = {
  longestStreak: number
  bestBossScore: number | null
  maxedSkills: ReadonlySet<SubelementId>
  survivorDays: number
}

export function qualifies(badge: Badge, f: BadgeFacts): boolean {
  switch (badge.kind) {
    case 'streak':
      return f.longestStreak >= badge.streakDays!
    case 'boss':
      if (f.bestBossScore === null) return false
      return badge.id === 'boss-perfect' ? f.bestBossScore >= EXAM_LENGTH : f.bestBossScore >= EXAM_PASS
    case 'mastery':
      return f.maxedSkills.has(badge.subelement!)
    case 'survivor':
      return f.survivorDays >= SURVIVOR_DAYS
  }
}

/** Badges earned now that weren't already. Earned badges are permanent. */
export function newlyEarned(earned: Readonly<Record<string, string>>, facts: BadgeFacts): Badge[] {
  return BADGES.filter((b) => !earned[b.id] && qualifies(b, facts))
}
