/**
 * The whole save file and the pure transitions on it. The Zustand store is a
 * thin wrapper around these, so everything here is testable without React.
 *
 * XP, rank, Supplies, Scrap, the outpost, and streaks belong to the survivor
 * and are shared across pools. Skills, boss battles, and mastery badges belong
 * to one pool. Question ids are unique across pools (T…, G…, E…), so one
 * `cards` map holds them all.
 */
import { ALL_SUBELEMENTS, POOL_ORDER, POOLS, QUESTIONS_BY_ID, type PoolId, type SubelementId } from '../data/pool'
import { newlyEarned, type Badge } from './badges'
import { buildExam, buildMiniExam, miniPassMark, scoreExam, type ExamScore } from './boss'
import {
  SCRAP_BOSS_PASS,
  SCRAP_CORRECT,
  SCRAP_GRADUATE_LONG,
  SCRAP_GRADUATE_MEDIUM,
  SCRAP_MINI_PASS,
  SUPPLIES_CORRECT,
  SUPPLIES_RECOVERY_BONUS,
  XP_CORRECT,
  XP_GRADUATE_LONG,
  XP_GRADUATE_MEDIUM,
} from './config'
import { emptyOutpost, nextCost, perks, structuresBuilt, structuresMaxed, type Outpost, type Perks, type StructureId } from './outpost'
import { rankFor, skillBreakdown, SKILL_MAX_LEVEL, type Rank } from './progression'
import { applyAnswer, type AnswerResult, type Cards, type Rng } from './srs'
import { longestStreak, type DayLog } from './streak'
import { decaySupplies, gainSupplies, initialSupplies, survivorDays, type Supplies } from './supplies'

export const SAVE_VERSION = 4
export const DEFAULT_POOL: PoolId = 'extra'

export type BossRecord = {
  pool: PoolId
  date: string
  correct: number
  total: number
  passed: boolean
  bySubelement: ExamScore['bySubelement']
}

export type ActiveBoss = {
  pool: PoolId
  /** Set for a mini boss: the one sub-element being tested. */
  subelement?: SubelementId
  ids: string[]
  answers: (number | null)[]
  startedAt: string
}

/** Mini boss results per sub-element. Kept apart from bossHistory so they never count toward full-exam badges. */
export type MiniRecord = { attempts: number; wins: number; best: number; total: number; lastDate: string }

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
  /** Building material for the outpost. Never decays. */
  scrap: number
  /** Structure levels, 0 = not built. */
  outpost: Outpost
  /** Last day the Solar Array paid its first-correct-answer charge. */
  lastChargeDate: string | null
  days: DayLog
  bossHistory: BossRecord[]
  miniBosses: Record<SubelementId, MiniRecord>
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
    scrap: 0,
    outpost: emptyOutpost(),
    lastChargeDate: null,
    days: {},
    bossHistory: [],
    miniBosses: {},
    activeBoss: null,
    badges: {},
  }
}

export const IDS_BY_SUBELEMENT: Record<SubelementId, string[]> = Object.fromEntries(
  ALL_SUBELEMENTS.map((se) => [se, [...QUESTIONS_BY_ID.values()].filter((q) => q.subelement === se).map((q) => q.id)]),
)

export const IDS_BY_POOL = Object.fromEntries(POOL_ORDER.map((p) => [p, POOLS[p].questions.map((q) => q.id)])) as Record<PoolId, string[]>

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
    structuresBuilt: structuresBuilt(save.outpost),
    structuresMaxed: structuresMaxed(save.outpost),
  })
  if (!earned.length) return { save, earned }
  const badges = { ...save.badges }
  for (const b of earned) badges[b.id] = today
  return { save: { ...save, badges }, earned }
}

/** Run on load and periodically: applies daily Supplies decay and checks time-based badges. */
export function tick(save: Save, today: string): { save: Save; earned: Badge[] } {
  const supplies = decaySupplies(save.supplies, today, perks(save.outpost).decayMultiplier)
  return awardBadges(supplies === save.supplies ? save : { ...save, supplies }, today)
}

export function setPool(save: Save, pool: PoolId): Save {
  return save.pool === pool ? save : { ...save, pool }
}

/** What one correct answer pays, including outpost perks. */
function rewardFor(r: AnswerResult, p: Perks) {
  return {
    xp: XP_CORRECT + (r.graduated === 'medium' ? XP_GRADUATE_MEDIUM : r.graduated === 'long' ? XP_GRADUATE_LONG : 0),
    supplies: SUPPLIES_CORRECT + p.suppliesPerCorrect,
    recovery: r.recovered ? SUPPLIES_RECOVERY_BONUS + p.recoveryBonus : 0,
    scrap: SCRAP_CORRECT + p.scrapPerCorrect + (r.graduated === 'medium' ? SCRAP_GRADUATE_MEDIUM : r.graduated === 'long' ? SCRAP_GRADUATE_LONG : 0),
  }
}

export type AnswerOutcome = {
  correct: boolean
  xp: number
  supplies: number
  recoveryBonus: number
  /** Solar Array's first-correct-answer-of-the-day charge. */
  solarCharge: number
  scrap: number
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
  const p = perks(save.outpost)

  const reward = correct ? rewardFor(r, p) : { xp: 0, supplies: 0, recovery: 0, scrap: 0 }
  const solarCharge = correct && p.dailyCharge > 0 && save.lastChargeDate !== today ? p.dailyCharge : 0

  const before = rankFor(save.xp).index
  const next: Save = {
    ...save,
    step,
    cards: { ...save.cards, [id]: r.card },
    xp: save.xp + reward.xp,
    supplies: gainSupplies(save.supplies, reward.supplies + reward.recovery + solarCharge, today),
    scrap: save.scrap + reward.scrap,
    lastChargeDate: solarCharge ? today : save.lastChargeDate,
    days: { ...save.days, [today]: (save.days[today] ?? 0) + 1 },
  }
  const after = rankFor(next.xp)
  const awarded = awardBadges(next, today)
  return {
    save: awarded.save,
    outcome: {
      correct,
      xp: reward.xp,
      supplies: reward.supplies,
      recoveryBonus: reward.recovery,
      solarCharge,
      scrap: reward.scrap,
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

/** Starts a mini boss on one sub-element of the save's current pool. */
export function startMiniBoss(save: Save, subelement: SubelementId, today: string, rng: Rng): Save {
  const pool = POOLS[save.pool]
  const se = pool.subelements.find((s) => s.id === subelement)
  if (!se) throw new Error(`${subelement} is not in the ${pool.name} pool`)
  const ids = buildMiniExam(se, pool.questions, rng)
  return { ...save, activeBoss: { pool: save.pool, subelement, ids, answers: ids.map(() => null), startedAt: today } }
}

export function passMarkFor(boss: Pick<ActiveBoss, 'pool' | 'subelement' | 'ids'>): number {
  return boss.subelement ? miniPassMark(boss.ids.length) : POOLS[boss.pool].passMark
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

export type BossOutcome = {
  pool: PoolId
  /** Set when this was a mini boss. */
  subelement?: SubelementId
  passMark: number
  score: ExamScore
  xp: number
  supplies: number
  scrap: number
  rankUp: Rank | null
  earned: Badge[]
}

/**
 * Scores the battle and feeds every answer into spaced repetition: misses go
 * straight to the front of the study queue, correct answers count as normal.
 */
export function submitBoss(save: Save, today: string, rng: Rng): { save: Save; outcome: BossOutcome } {
  const boss = save.activeBoss
  if (!boss) throw new Error('No boss battle in progress')
  const passMark = passMarkFor(boss)
  const score = scoreExam(boss.ids, boss.answers, QUESTIONS_BY_ID, passMark)
  const p = perks(save.outpost)

  const cards = { ...save.cards }
  let xp = 0
  let supplies = 0
  let scrap = 0
  boss.ids.forEach((id, i) => {
    const correct = boss.answers[i] === QUESTIONS_BY_ID.get(id)!.correct
    const r = applyAnswer(cards[id], correct, { step: save.step, today, rng })
    cards[id] = correct ? r.card : { ...r.card, dueStep: save.step }
    if (correct) {
      const reward = rewardFor(r, p)
      xp += reward.xp
      supplies += reward.supplies + reward.recovery
      scrap += reward.scrap
    }
  })
  if (score.passed) scrap += boss.subelement ? SCRAP_MINI_PASS : SCRAP_BOSS_PASS + p.bossPassScrap
  const solarCharge = score.correct > 0 && p.dailyCharge > 0 && save.lastChargeDate !== today ? p.dailyCharge : 0
  supplies += solarCharge

  const answered = boss.answers.filter((a) => a !== null).length
  const before = rankFor(save.xp).index
  const next: Save = {
    ...save,
    cards,
    xp: save.xp + xp,
    supplies: gainSupplies(save.supplies, supplies, today),
    scrap: save.scrap + scrap,
    lastChargeDate: solarCharge ? today : save.lastChargeDate,
    days: { ...save.days, [today]: (save.days[today] ?? 0) + answered },
    bossHistory: boss.subelement
      ? save.bossHistory
      : [...save.bossHistory, { pool: boss.pool, date: today, correct: score.correct, total: score.total, passed: score.passed, bySubelement: score.bySubelement }],
    miniBosses: boss.subelement ? { ...save.miniBosses, [boss.subelement]: recordMini(save.miniBosses[boss.subelement], score, today) } : save.miniBosses,
    activeBoss: null,
  }
  const after = rankFor(next.xp)
  const awarded = awardBadges(next, today)
  return {
    save: awarded.save,
    outcome: { pool: boss.pool, subelement: boss.subelement, passMark, score, xp, supplies, scrap, rankUp: after.index > before ? after.rank : null, earned: awarded.earned },
  }
}

function recordMini(prev: MiniRecord | undefined, score: ExamScore, today: string): MiniRecord {
  const better = !prev || score.correct / score.total > prev.best / prev.total
  return {
    attempts: (prev?.attempts ?? 0) + 1,
    wins: (prev?.wins ?? 0) + (score.passed ? 1 : 0),
    best: better ? score.correct : prev.best,
    total: better ? score.total : prev.total,
    lastDate: today,
  }
}

export type BuildResult = { save: Save; earned: Badge[] }

/** Spends Scrap to build or upgrade one structure. Throws if it can't be afforded. */
export function build(save: Save, id: StructureId, today: string): BuildResult {
  const cost = nextCost(save.outpost, id)
  if (cost === null) throw new Error('Already at max level')
  if (save.scrap < cost) throw new Error('Not enough Scrap')
  return awardBadges({ ...save, scrap: save.scrap - cost, outpost: { ...save.outpost, [id]: save.outpost[id] + 1 } }, today)
}

/**
 * Brings an older save up to the current version.
 * v1 → v2: v1 was Extra-only, so everything in it belongs to the Extra pool.
 * v2 → v3: adds Scrap and the outpost, with back-pay of Scrap for every
 * correct answer already logged.
 * v3 → v4: adds mini boss records.
 */
export function migrateSave(data: unknown): Save {
  let s = data as Record<string, unknown> & Partial<Save>
  if ((s.version as number) === 1) {
    s = {
      ...s,
      version: 2 as never,
      pool: 'extra',
      bossHistory: (s.bossHistory ?? []).map((b) => ({ ...b, pool: 'extra' as const })),
      activeBoss: s.activeBoss ? { ...s.activeBoss, pool: 'extra' } : null,
    }
  }
  if ((s.version as number) === 2) {
    const correctSoFar = Object.values(s.cards ?? {}).reduce((n, c) => n + c.correct, 0)
    s = { ...s, version: 3 as never, scrap: correctSoFar * SCRAP_CORRECT, outpost: emptyOutpost(), lastChargeDate: null }
  }
  if ((s.version as number) === 3) {
    s = { ...s, version: SAVE_VERSION, miniBosses: {} }
  }
  return s as Save
}

/** Validates an imported save file just enough to not crash on it. */
export function parseSave(json: string): Save {
  const data = JSON.parse(json) as Partial<Save> | null
  const version = data?.version as number | undefined
  if (!data || !version || version < 1 || version > SAVE_VERSION || typeof data.cards !== 'object' || typeof data.xp !== 'number' || !data.supplies) {
    throw new Error('Not a Wasteland Net save file')
  }
  return migrateSave(data)
}
