/**
 * The whole save file and the pure transitions on it. The Zustand store is a
 * thin wrapper around these, so everything here is testable without React.
 */
import { POOL, QUESTIONS_BY_ID, SUBELEMENT_ORDER, type SubelementId } from '../data/pool'
import { newlyEarned, type Badge } from './badges'
import { buildExam, scoreExam, type ExamScore } from './boss'
import { SUPPLIES_CORRECT, SUPPLIES_RECOVERY_BONUS, XP_CORRECT, XP_GRADUATE_LONG, XP_GRADUATE_MEDIUM } from './config'
import { rankFor, skillBreakdown, SKILL_MAX_LEVEL, type Rank } from './progression'
import { applyAnswer, type Cards, type Rng } from './srs'
import { longestStreak, type DayLog } from './streak'
import { decaySupplies, gainSupplies, initialSupplies, survivorDays, type Supplies } from './supplies'

export const SAVE_VERSION = 1

export type BossRecord = {
  date: string
  correct: number
  total: number
  passed: boolean
  bySubelement: ExamScore['bySubelement']
}

export type ActiveBoss = { ids: string[]; answers: (number | null)[]; startedAt: string }

export type Save = {
  version: typeof SAVE_VERSION
  createdAt: string
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
  SUBELEMENT_ORDER.map((se) => [se, POOL.questions.filter((q) => q.subelement === se).map((q) => q.id)]),
) as Record<SubelementId, string[]>

export const ALL_IDS = POOL.questions.map((q) => q.id)

function awardBadges(save: Save, today: string): { save: Save; earned: Badge[] } {
  const maxed = new Set<SubelementId>()
  for (const se of SUBELEMENT_ORDER) if (skillBreakdown(IDS_BY_SUBELEMENT[se], save.cards).level >= SKILL_MAX_LEVEL) maxed.add(se)
  const earned = newlyEarned(save.badges, {
    longestStreak: longestStreak(save.days),
    bestBossScore: save.bossHistory.length ? Math.max(...save.bossHistory.map((b) => b.correct)) : null,
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

export function startBoss(save: Save, today: string, rng: Rng): Save {
  const ids = buildExam(POOL.subelements, POOL.questions, rng)
  return { ...save, activeBoss: { ids, answers: ids.map(() => null), startedAt: today } }
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

export type BossOutcome = { score: ExamScore; xp: number; supplies: number; rankUp: Rank | null; earned: Badge[] }

/**
 * Scores the battle and feeds every answer into spaced repetition: misses go
 * straight to the front of the study queue, correct answers count as normal.
 */
export function submitBoss(save: Save, today: string, rng: Rng): { save: Save; outcome: BossOutcome } {
  const boss = save.activeBoss
  if (!boss) throw new Error('No boss battle in progress')
  const score = scoreExam(boss.ids, boss.answers, QUESTIONS_BY_ID)

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
      { date: today, correct: score.correct, total: score.total, passed: score.passed, bySubelement: score.bySubelement },
    ],
    activeBoss: null,
  }
  const after = rankFor(next.xp)
  const awarded = awardBadges(next, today)
  return { save: awarded.save, outcome: { score, xp, supplies, rankUp: after.index > before ? after.rank : null, earned: awarded.earned } }
}

/** Validates an imported save file just enough to not crash on it. */
export function parseSave(json: string): Save {
  const data = JSON.parse(json) as Partial<Save>
  if (data.version !== SAVE_VERSION || typeof data.cards !== 'object' || typeof data.xp !== 'number' || !data.supplies) {
    throw new Error('Not a Wasteland Net save file')
  }
  return data as Save
}
