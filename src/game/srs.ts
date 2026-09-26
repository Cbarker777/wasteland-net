/**
 * Spaced repetition. A question with no card is "new". Cards move:
 *
 *   new/learning ── 3 correct in a row ──▶ medium ── 2 on-time reviews ──▶ long
 *        ▲                                   │                             │
 *        └───────────── any miss ────────────┴─────────────────────────────┘
 *
 * Learning cards are scheduled by answer count (`dueStep`), so a miss comes
 * back within 3–5 questions. Medium and long cards are scheduled by date.
 */
import {
  GRADUATE_STREAK,
  LEARN_REQUEUE_MAX,
  LEARN_REQUEUE_MIN,
  LONG_FIRST_DAYS,
  LONG_GROWTH,
  LONG_MAX_DAYS,
  MAX_ACTIVE_LEARNING,
  MEDIUM_INTERVALS_DAYS,
  MISS_REQUEUE_MAX,
  MISS_REQUEUE_MIN,
} from './config'
import { addDays } from './dates'

export type Stage = 'learning' | 'medium' | 'long'

export type Card = {
  stage: Stage
  /** Correct answers in a row. */
  streak: number
  /** On-time successful reviews in the current stage (medium/long). */
  reviews: number
  /** Learning: the answer number at which it's due. */
  dueStep: number
  /** Medium/long: the date it's due for review. */
  dueDate: string
  /** Missed and not yet answered correctly since — pays a recovery bonus. */
  missedPending: boolean
  seen: number
  correct: number
}

export type Cards = Record<string, Card>

export type Rng = () => number

export type AnswerContext = { step: number; today: string; rng: Rng }

export type AnswerResult = {
  card: Card
  /** Stage the card graduated into on this answer, if any. */
  graduated: 'medium' | 'long' | null
  /** Correct answer on a question that had been missed. */
  recovered: boolean
  /** Correct review of a card that wasn't due yet — schedule unchanged. */
  early: boolean
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function longInterval(reviews: number): number {
  return Math.min(LONG_MAX_DAYS, Math.round(LONG_FIRST_DAYS * LONG_GROWTH ** reviews))
}

export function applyAnswer(prev: Card | undefined, isCorrect: boolean, ctx: AnswerContext): AnswerResult {
  const base: Card = prev ?? {
    stage: 'learning',
    streak: 0,
    reviews: 0,
    dueStep: 0,
    dueDate: ctx.today,
    missedPending: false,
    seen: 0,
    correct: 0,
  }
  const card: Card = { ...base, seen: base.seen + 1, correct: base.correct + (isCorrect ? 1 : 0) }

  if (!isCorrect) {
    return {
      card: {
        ...card,
        stage: 'learning',
        streak: 0,
        reviews: 0,
        dueStep: ctx.step + randInt(ctx.rng, MISS_REQUEUE_MIN, MISS_REQUEUE_MAX),
        missedPending: true,
      },
      graduated: null,
      recovered: false,
      early: false,
    }
  }

  const recovered = card.missedPending
  card.missedPending = false
  card.streak += 1

  if (card.stage === 'learning') {
    if (card.streak >= GRADUATE_STREAK) {
      Object.assign(card, { stage: 'medium', reviews: 0, dueDate: addDays(ctx.today, MEDIUM_INTERVALS_DAYS[0]) })
      return { card, graduated: 'medium', recovered, early: false }
    }
    card.dueStep = ctx.step + randInt(ctx.rng, LEARN_REQUEUE_MIN, LEARN_REQUEUE_MAX)
    return { card, graduated: null, recovered, early: false }
  }

  // Reviewing ahead of schedule proves nothing new; leave the schedule alone.
  if (card.dueDate > ctx.today) return { card, graduated: null, recovered, early: true }

  card.reviews += 1
  if (card.stage === 'medium') {
    if (card.reviews >= MEDIUM_INTERVALS_DAYS.length) {
      Object.assign(card, { stage: 'long', reviews: 0, dueDate: addDays(ctx.today, longInterval(0)) })
      return { card, graduated: 'long', recovered, early: false }
    }
    card.dueDate = addDays(ctx.today, MEDIUM_INTERVALS_DAYS[card.reviews])
    return { card, graduated: null, recovered, early: false }
  }

  card.dueDate = addDays(ctx.today, longInterval(card.reviews))
  return { card, graduated: null, recovered, early: false }
}

export type PickKind = 'learning' | 'review' | 'new' | 'early'
export type Pick = { id: string; kind: PickKind }

export type PickContext = {
  /** The answer number the picked question will be asked at. */
  step: number
  today: string
  rng: Rng
  /** Avoid asking the same question twice in a row when there's any alternative. */
  lastId?: string | null
}

/**
 * Chooses the next question from `ids` (already filtered to the player's focus).
 * Priority: learning cards that are due → date-due reviews → a new question
 * (if the learning loop isn't full) → the soonest learning card → an early review.
 */
export function pickNext(ids: readonly string[], cards: Cards, ctx: PickContext): Pick | null {
  const pool = ids.length > 1 && ctx.lastId ? ids.filter((id) => id !== ctx.lastId) : ids

  const learning: string[] = []
  const reviews: string[] = []
  const fresh: string[] = []
  let activeLearning = 0
  for (const id of ids) {
    const c = cards[id]
    if (c?.stage === 'learning') activeLearning++
  }
  for (const id of pool) {
    const c = cards[id]
    if (!c) fresh.push(id)
    else if (c.stage === 'learning') learning.push(id)
    else reviews.push(id)
  }

  const byStep = (a: string, b: string) => cards[a].dueStep - cards[b].dueStep
  const byDate = (a: string, b: string) => (cards[a].dueDate < cards[b].dueDate ? -1 : cards[a].dueDate > cards[b].dueDate ? 1 : 0)

  const dueLearning = learning.filter((id) => cards[id].dueStep <= ctx.step).sort(byStep)
  if (dueLearning.length) return { id: dueLearning[0], kind: 'learning' }

  const dueReviews = reviews.filter((id) => cards[id].dueDate <= ctx.today)
  if (dueReviews.length) {
    const oldest = dueReviews.sort(byDate)[0]
    const tied = dueReviews.filter((id) => cards[id].dueDate === cards[oldest].dueDate)
    return { id: tied[Math.floor(ctx.rng() * tied.length)], kind: 'review' }
  }

  if (fresh.length && activeLearning < MAX_ACTIVE_LEARNING) {
    return { id: fresh[Math.floor(ctx.rng() * fresh.length)], kind: 'new' }
  }

  if (learning.length) return { id: learning.sort(byStep)[0], kind: 'learning' }

  if (reviews.length) return { id: reviews.sort(byDate)[0], kind: 'early' }

  return null
}

/** How many questions in `ids` are due right now (for the "signals waiting" count). */
export function dueCount(ids: readonly string[], cards: Cards, today: string): number {
  let n = 0
  for (const id of ids) {
    const c = cards[id]
    if (c && c.stage !== 'learning' && c.dueDate <= today) n++
  }
  return n
}
