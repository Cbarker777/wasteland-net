import { POOL_ORDER, POOLS, skillInfo, type PoolId, type SubelementId } from '../data/pool'
import { STREAK_BADGES, SURVIVOR_DAYS } from './config'

export type BadgeKind = 'streak' | 'boss-pass' | 'boss-perfect' | 'mastery' | 'survivor'

export type Badge = {
  id: string
  kind: BadgeKind
  name: string
  description: string
  /** Label shown on the badge plate. */
  glyph: string
  /** Boss and mastery badges belong to one pool; streak and survivor are shared. */
  pool?: PoolId
  subelement?: SubelementId
  streakDays?: number
}

const STREAK_NAMES: Record<number, string> = { 7: 'Week on the Air', 30: 'Month of Signals', 100: 'Hundred-Day Net' }

/** The original Extra-only badge ids are kept so existing saves keep their badges. */
const bossId = (pool: PoolId, kind: 'pass' | 'perfect') => (pool === 'extra' ? `boss-${kind}` : `${pool}-boss-${kind}`)

const BOSS_NAMES: Record<PoolId, { pass: string; perfect: string }> = {
  technician: { pass: 'First Contact', perfect: 'Five by Five' },
  general: { pass: 'Gatekeeper Down', perfect: 'Clean Copy' },
  extra: { pass: 'Examiner Down', perfect: 'Flawless Transmission' },
}

export const BADGES: Badge[] = [
  ...STREAK_BADGES.map<Badge>((days) => ({
    id: `streak-${days}`,
    kind: 'streak',
    name: STREAK_NAMES[days] ?? `${days}-Day Streak`,
    description: `Meet the daily goal ${days} days in a row.`,
    glyph: `${days}D`,
    streakDays: days,
  })),
  { id: 'survivor', kind: 'survivor', name: 'Still Standing', description: `Keep Supplies above zero for ${SURVIVOR_DAYS} days straight.`, glyph: `${SURVIVOR_DAYS}+` },
  ...POOL_ORDER.flatMap<Badge>((pool) => {
    const p = POOLS[pool]
    return [
      {
        id: bossId(pool, 'pass'),
        kind: 'boss-pass',
        pool,
        name: BOSS_NAMES[pool].pass,
        description: `Pass a ${p.name} boss battle (${p.passMark} of ${p.examLength} or better).`,
        glyph: 'PASS',
      },
      {
        id: bossId(pool, 'perfect'),
        kind: 'boss-perfect',
        pool,
        name: BOSS_NAMES[pool].perfect,
        description: `Answer all ${p.examLength} ${p.name} boss battle questions correctly.`,
        glyph: `${p.examLength}/${p.examLength}`,
      },
      ...p.subelements.map<Badge>((se) => ({
        id: `mastery-${se.id}`,
        kind: 'mastery',
        pool,
        name: skillInfo(se.id).badge,
        description: `Max out ${p.name} ${skillInfo(se.id).label}: every ${se.id} question in long-term review.`,
        glyph: se.id,
        subelement: se.id,
      })),
    ]
  }),
]

export type BadgeFacts = {
  longestStreak: number
  bestBossScore: Partial<Record<PoolId, number>>
  maxedSkills: ReadonlySet<SubelementId>
  survivorDays: number
}

export function qualifies(badge: Badge, f: BadgeFacts): boolean {
  switch (badge.kind) {
    case 'streak':
      return f.longestStreak >= badge.streakDays!
    case 'boss-pass':
      return (f.bestBossScore[badge.pool!] ?? -1) >= POOLS[badge.pool!].passMark
    case 'boss-perfect':
      return (f.bestBossScore[badge.pool!] ?? -1) >= POOLS[badge.pool!].examLength
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
