import { describe, expect, it } from 'vitest'
import { applyAnswer, longInterval, pickNext, type Card, type Cards } from './srs'
import { addDays } from './dates'
import { MAX_ACTIVE_LEARNING } from './config'

const today = '2026-09-26'
const lo = () => 0 // rng at its minimum
const hi = () => 0.9999 // rng at its maximum

describe('applyAnswer', () => {
  it('requeues a missed question within 3 to 5 questions', () => {
    expect(applyAnswer(undefined, false, { step: 10, today, rng: lo }).card.dueStep).toBe(13)
    expect(applyAnswer(undefined, false, { step: 10, today, rng: hi }).card.dueStep).toBe(15)
  })

  it('graduates to medium only after three correct in a row', () => {
    let card: Card | undefined
    const results = []
    for (let i = 0; i < 3; i++) {
      const r = applyAnswer(card, true, { step: i, today, rng: lo })
      card = r.card
      results.push(r.graduated)
    }
    expect(results).toEqual([null, null, 'medium'])
    expect(card!.stage).toBe('medium')
    expect(card!.dueDate).toBe(addDays(today, 2))
  })

  it('resets the streak on a miss so graduation needs three fresh correct answers', () => {
    let card = applyAnswer(undefined, true, { step: 0, today, rng: lo }).card
    card = applyAnswer(card, true, { step: 1, today, rng: lo }).card
    card = applyAnswer(card, false, { step: 2, today, rng: lo }).card
    expect(card.streak).toBe(0)
    card = applyAnswer(card, true, { step: 3, today, rng: lo }).card
    card = applyAnswer(card, true, { step: 4, today, rng: lo }).card
    expect(card.stage).toBe('learning')
    expect(applyAnswer(card, true, { step: 5, today, rng: lo }).graduated).toBe('medium')
  })

  it('flags recovery exactly once after a missed question is answered correctly', () => {
    const missed = applyAnswer(undefined, false, { step: 0, today, rng: lo }).card
    const first = applyAnswer(missed, true, { step: 4, today, rng: lo })
    expect(first.recovered).toBe(true)
    expect(applyAnswer(first.card, true, { step: 12, today, rng: lo }).recovered).toBe(false)
  })

  it('moves medium to long after two on-time reviews', () => {
    const medium: Card = { stage: 'medium', streak: 3, reviews: 0, dueStep: 0, dueDate: today, missedPending: false, seen: 3, correct: 3 }
    const first = applyAnswer(medium, true, { step: 0, today, rng: lo })
    expect(first.card.stage).toBe('medium')
    expect(first.card.dueDate).toBe(addDays(today, 5))
    const later = addDays(today, 5)
    const second = applyAnswer(first.card, true, { step: 1, today: later, rng: lo })
    expect(second.graduated).toBe('long')
    expect(second.card.dueDate).toBe(addDays(later, 21))
  })

  it('does not advance the schedule for an early review', () => {
    const long: Card = { stage: 'long', streak: 5, reviews: 1, dueStep: 0, dueDate: addDays(today, 10), missedPending: false, seen: 5, correct: 5 }
    const r = applyAnswer(long, true, { step: 0, today, rng: lo })
    expect(r.early).toBe(true)
    expect(r.card.dueDate).toBe(long.dueDate)
    expect(r.card.reviews).toBe(1)
  })

  it('drops a long-term question back to learning on a miss', () => {
    const long: Card = { stage: 'long', streak: 5, reviews: 2, dueStep: 0, dueDate: today, missedPending: false, seen: 5, correct: 5 }
    const r = applyAnswer(long, false, { step: 40, today, rng: lo })
    expect(r.card).toMatchObject({ stage: 'learning', streak: 0, reviews: 0, dueStep: 43, missedPending: true })
  })

  it('grows long-term intervals up to a ceiling', () => {
    expect(longInterval(0)).toBe(21)
    expect(longInterval(1)).toBeGreaterThan(21)
    expect(longInterval(20)).toBe(120)
  })
})

describe('pickNext', () => {
  const learningCard = (dueStep: number): Card => ({ stage: 'learning', streak: 0, reviews: 0, dueStep, dueDate: today, missedPending: true, seen: 1, correct: 0 })
  const reviewCard = (dueDate: string): Card => ({ stage: 'medium', streak: 3, reviews: 0, dueStep: 0, dueDate, missedPending: false, seen: 3, correct: 3 })

  it('serves a due learning card before anything else', () => {
    const cards: Cards = { a: reviewCard(today), b: learningCard(5) }
    expect(pickNext(['a', 'b', 'c'], cards, { step: 5, today, rng: lo })).toEqual({ id: 'b', kind: 'learning' })
  })

  it('serves date-due reviews before new questions', () => {
    const cards: Cards = { a: reviewCard(today), b: learningCard(99) }
    expect(pickNext(['a', 'b', 'c'], cards, { step: 5, today, rng: lo })).toEqual({ id: 'a', kind: 'review' })
  })

  it('introduces new questions when nothing is due', () => {
    const cards: Cards = { a: reviewCard(addDays(today, 3)), b: learningCard(99) }
    expect(pickNext(['a', 'b', 'c'], cards, { step: 5, today, rng: lo })).toEqual({ id: 'c', kind: 'new' })
  })

  it('stops introducing new questions when the learning loop is full', () => {
    const cards: Cards = {}
    const ids: string[] = ['fresh']
    for (let i = 0; i < MAX_ACTIVE_LEARNING; i++) {
      cards[`l${i}`] = learningCard(100 + i)
      ids.push(`l${i}`)
    }
    expect(pickNext(ids, cards, { step: 5, today, rng: lo })).toEqual({ id: 'l0', kind: 'learning' })
  })

  it('never repeats the previous question when another is available', () => {
    const cards: Cards = { a: learningCard(0), b: learningCard(3) }
    expect(pickNext(['a', 'b'], cards, { step: 5, today, rng: lo, lastId: 'a' })!.id).toBe('b')
  })

  it('offers early reviews once everything is mastered and nothing is due', () => {
    const cards: Cards = { a: reviewCard(addDays(today, 9)), b: reviewCard(addDays(today, 4)) }
    expect(pickNext(['a', 'b'], cards, { step: 5, today, rng: lo })).toEqual({ id: 'b', kind: 'early' })
  })

  it('returns null for an empty set', () => {
    expect(pickNext([], {}, { step: 0, today, rng: lo })).toBeNull()
  })
})
