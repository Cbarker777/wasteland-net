/**
 * The whole save file and the pure transitions on it. The Zustand store is a
 * thin wrapper around these, so everything here is testable without React.
 *
 * XP, rank, Supplies, and streaks belong to the survivor and are shared across
 * pools. Skills, boss battles, and mastery badges belong to one pool. Question
 * ids are unique across pools (G… vs E…), so one `cards` map holds both.
 */
import { ALL_SUBELEMENTS, POOL_ORDER, POOLS, QUESTIONS_BY_ID, type PoolId, type SubelementId } from '../data/pool'
import { newlyEarned, type Badge } from './badges'
import { buildExam, scoreExam, type ExamScore } from './boss'
import { SUPPLIES_CORRECT, SUPPLIES_RECOVERY_BONUS, XP_CORRECT, XP_GRADUATE_LONG, XP_GRADUATE_MEDIUM } from './config'
import { rankFor, skillBreakdown, SKILL_MAX_LEVEL, type Rank } from './progression'
import { applyAnswer, type Cards, type Rng } from './srs'
import { longestStreak, type DayLog } from './streak'
import { decaySupplies, gainSupplies, initialSupplies, survivorDays, type Supplies } from './supplies'

export const SAVE_VERSION = 2
export const DEFAULT_POOL: PoolId = 'extra'

export type BossRecord = {
  pool: PoolId
  date: string
  correct: number
  total: number
  passed: boolean
  bySubelement: ExamScore['bySubelement']
}

export type ActiveBoss = { pool: PoolId; ids: string[]; answers: (number | null)[]; startedAt: string }

export type Save = {
  version: typeof SAVE_VERSION
  createdAt: string
  /** The pool the player is studying; scopes study, skills, and boss battles. */
  pool: PoolId
  cards: Cards
  /** Study answers so far; learning cards are scheduled against this counter. */
  step: number
  xp: number
  supplies: Supplies
  days: DayLog
  bossHistory: BossRecord[]
  activeBoss: ActiveBoss | null
  /** Badge id → date earned. */
  badges: Record<string, string>
}

export function newSave(today: string): Save {
  return {
    version: SAVE_VERSION,
    createdAt: today,
    pool: DEFAULT_POOL,
    cards: {},
    step: 0,
    xp: 0,
    supplies: initialSupplies(today),
    days: {},
    bossHistory: [],
    activeBoss: null,
    badges: {},
  }
}

export const IDS_BY_SUBELEMENT: Record<SubelementId, string[]> = Object.fromEntries(
  ALL_SUBELEMENTS.map((se) => [se, [...QUESTIONS_BY_ID.values()].filter((q) => q.subelement === se).map((q) => q.id)]),
)

export const IDS_BY_POOL: Record<PoolId, string[]> = {
  general: POOLS.general.questions.map((q) => q.id),
  extra: POOLS.extra.questions.map((q) => q.id),
}

export function bestBoss(save: Save, pool: PoolId): number | null {
  const scores = save.bossHistory.filter((b) => b.pool === pool).map((b) => b.correct)
  return scores.length ? Math.max(...scores) : null
}

function awardBadges(save: Save, today: string): { save: Save; earned: Badge[] } {
  const maxed = new Set<SubelementId>()
  for (const se of ALL_SUBELEMENTS) if (skillBreakdown(IDS_BY_SUBELEMENT[se], save.cards).level >= SKILL_MAX_LEVEL) maxed.add(se)
  const best: Partial<Record<PoolId, number>> = {}
  for (const p of POOL_ORDER) {
    const b = bestBoss(save, p)
    if (b !== null) best[p] = b
  }
  const earned = newlyEarned(save.badges, {
    longestStreak: longestStreak(save.days),
    bestBossScore: best,
    maxedSkills: maxed,
    survivorDays: survivorDays(save.supplies, today),
  })
  if (!earned.length) return { save, earned }
  const badges = { ...save.badges }
  for (const b of earned) badges[b.id] = today
  return { save: { ...save, badges }, earned }
}

/** Run on load and periodically: applies daily Supplies decay and checks time-based badges. */
export function tick(save: Save, today: string): { save: Save; earned: Badge[] } {
  const supplies = decaySupplies(save.supplies, today)
  return awardBadges(supplies === save.supplies ? save : { ...save, supplies }, today)
}

export function setPool(save: Save, pool: PoolId): Save {
  return save.pool === pool ? save : { ...save, pool }
}

export type AnswerOutcome = {
  correct: boolean
  xp: number
  supplies: number
  recoveryBonus: number
  graduated: 'medium' | 'long' | null
  early: boolean
  streak: number
  rankUp: Rank | null
  earned: Badge[]
}

export function answerStudy(save: Save, id: string, choice: number, today: string, rng: Rng): { save: Save; outcome: AnswerOutcome } {
  const q = QUESTIONS_BY_ID.get(id)
  if (!q) throw new Error(`Unknown question ${id}`)
  const step = save.step + 1
  const correct = choice === q.correct
  const r = applyAnswer(save.cards[id], correct, { step, today, rng })

  let xp = 0
  let supplies = 0
  let recoveryBonus = 0
  if (correct) {
    xp = XP_CORRECT + (r.graduated === 'medium' ? XP_GRADUATE_MEDIUM : r.graduated === 'long' ? XP_GRADUATE_LONG : 0)
    supplies = SUPPLIES_CORRECT
    if (r.recovered) recoveryBonus = SUPPLIES_RECOVERY_BONUS
  }

  const before = rankFor(save.xp).index
  const next: Save = {
    ...save,
    step,
    cards: { ...save.cards, [id]: r.card },
    xp: save.xp + xp,
    supplies: gainSupplies(save.supplies, supplies + recoveryBonus, today),
    days: { ...save.days, [today]: (save.days[today] ?? 0) + 1 },
  }
  const after = rankFor(next.xp)
  const awarded = awardBadges(next, today)
  return {
    save: awarded.save,
    outcome: {
      correct,
      xp,
      supplies,
      recoveryBonus,
      graduated: r.graduated,
      early: r.early,
      streak: r.card.streak,
      rankUp: after.index > before ? after.rank : null,
      earned: awarded.earned,
    },
  }
}

/** Starts a boss battle on the save's current pool. */
export function startBoss(save: Save, today: string, rng: Rng): Save {
  const ids = buildExam(POOLS[save.pool], rng)
  return { ...save, activeBoss: { pool: save.pool, ids, answers: ids.map(() => null), startedAt: today } }
}

export function answerBoss(save: Save, index: number, choice: number | null): Save {
  if (!save.activeBoss) return save
  const answers = save.activeBoss.answers.slice()
  answers[index] = choice
  return { ...save, activeBoss: { ...save.activeBoss, answers } }
}

export function abandonBoss(save: Save): Save {
  return { ...save, activeBoss: null }
}

export type BossOutcome = { pool: PoolId; score: ExamScore; xp: number; supplies: number; rankUp: Rank | null; earned: Badge[] }

/**
 * Scores the battle and feeds every answer into spaced repetition: misses go
 * straight to the front of the study queue, correct answers count as normal.
 */
export function submitBoss(save: Save, today: string, rng: Rng): { save: Save; outcome: BossOutcome } {
  const boss = save.activeBoss
  if (!boss) throw new Error('No boss battle in progress')
  const score = scoreExam(boss.ids, boss.answers, QUESTIONS_BY_ID, POOLS[boss.pool].passMark)

  const cards = { ...save.cards }
  let xp = 0
  let supplies = 0
  boss.ids.forEach((id, i) => {
    const correct = boss.answers[i] === QUESTIONS_BY_ID.get(id)!.correct
    const r = applyAnswer(cards[id], correct, { step: save.step, today, rng })
    cards[id] = correct ? r.card : { ...r.card, dueStep: save.step }
    if (correct) {
      xp += XP_CORRECT + (r.graduated === 'medium' ? XP_GRADUATE_MEDIUM : r.graduated === 'long' ? XP_GRADUATE_LONG : 0)
      supplies += SUPPLIES_CORRECT + (r.recovered ? SUPPLIES_RECOVERY_BONUS : 0)
    }
  })

  const answered = boss.answers.filter((a) => a !== null).length
  const before = rankFor(save.xp).index
  const next: Save = {
    ...save,
    cards,
    xp: save.xp + xp,
    supplies: gainSupplies(save.supplies, supplies, today),
    days: { ...save.days, [today]: (save.days[today] ?? 0) + answered },
    bossHistory: [
      ...save.bossHistory,
      { pool: boss.pool, date: today, correct: score.correct, total: score.total, passed: score.passed, bySubelement: score.bySubelement },
    ],
    activeBoss: null,
  }
  const after = rankFor(next.xp)
  const awarded = awardBadges(next, today)
  return {
    save: awarded.save,
    outcome: { pool: boss.pool, score, xp, supplies, rankUp: after.index > before ? after.rank : null, earned: awarded.earned },
  }
}

/**
 * Brings an older save up to the current version. v1 was Extra-only, so
 * everything in it belongs to the Extra pool.
 */
export function migrateSave(data: unknown): Save {
  const s = data as Record<string, unknown> & Partial<Save>
  if ((s.version as number) === 1) {
    return {
      ...(s as unknown as Save),
      version: SAVE_VERSION,
      pool: 'extra',
      bossHistory: (s.bossHistory ?? []).map((b) => ({ ...b, pool: 'extra' as const })),
      activeBoss: s.activeBoss ? { ...s.activeBoss, pool: 'extra' } : null,
    }
  }
  return s as Save
}

/** Validates an imported save file just enough to not crash on it. */
export function parseSave(json: string): Save {
  const data = JSON.parse(json) as Partial<Save> | null
  if (!data || ((data.version as number) !== 1 && data.version !== SAVE_VERSION) || typeof data.cards !== 'object' || typeof data.xp !== 'number' || !data.supplies) {
    throw new Error('Not a Wasteland Net save file')
  }
  return migrateSave(data)
}
