import { describe, expect, it } from 'vitest'
import { POOL, QUESTIONS_BY_ID } from '../data/pool'
import { answerBoss, answerStudy, IDS_BY_SUBELEMENT, newSave, parseSave, startBoss, submitBoss, tick, type Save } from './save'
import { addDays } from './dates'
import { buildExam } from './boss'
import { rankFor, skillBreakdown, RANKS } from './progression'
import { currentStreak, longestStreak } from './streak'
import { dailyDecay, decaySupplies, initialSupplies } from './supplies'
import { DAILY_GOAL, EXAM_LENGTH, SUPPLIES_CORRECT, SUPPLIES_RECOVERY_BONUS, SUPPLIES_START, XP_CORRECT } from './config'

const today = '2026-09-26'
const rng = () => 0
const q = POOL.questions[0]
const wrong = (q.correct + 1) % 4

describe('question pool', () => {
  it('has all ten sub-elements with the official exam distribution', () => {
    expect(POOL.subelements.map((s) => `${s.id}:${s.examQuestions}`)).toEqual([
      'E1:6', 'E2:5', 'E3:3', 'E4:5', 'E5:4', 'E6:6', 'E7:8', 'E8:4', 'E9:8', 'E0:1',
    ])
    expect(POOL.questions.length).toBe(599)
  })

  it('does not contain withdrawn questions', () => {
    for (const id of ['E2A13', 'E4D05', 'E6D07', 'E9E10']) expect(QUESTIONS_BY_ID.has(id)).toBe(false)
  })
})

describe('boss exam', () => {
  it('draws one question per group, 50 total, matching the sub-element distribution', () => {
    const ids = buildExam(POOL.subelements, POOL.questions, Math.random)
    expect(ids.length).toBe(EXAM_LENGTH)
    expect(new Set(ids.map((id) => QUESTIONS_BY_ID.get(id)!.group)).size).toBe(50)
    for (const se of POOL.subelements) expect(ids.filter((id) => id.startsWith(se.id)).length).toBe(se.examQuestions)
  })

  it('passes at 37 and fails at 36', () => {
    let save = startBoss(newSave(today), today, rng)
    const ids = save.activeBoss!.ids
    ids.forEach((id, i) => (save = answerBoss(save, i, i < 37 ? QUESTIONS_BY_ID.get(id)!.correct : null)))
    const passed = submitBoss(save, today, rng)
    expect(passed.outcome.score).toMatchObject({ correct: 37, passed: true })
    expect(passed.save.badges['boss-pass']).toBe(today)
    expect(passed.save.badges['boss-perfect']).toBeUndefined()

    save = answerBoss(save, 36, null)
    expect(submitBoss(save, today, rng).outcome.score).toMatchObject({ correct: 36, passed: false })
  })

  it('sends missed boss questions straight to the front of the study queue', () => {
    let save = startBoss(newSave(today), today, rng)
    const missedId = save.activeBoss!.ids[0]
    save = answerBoss(save, 0, (QUESTIONS_BY_ID.get(missedId)!.correct + 1) % 4)
    const after = submitBoss(save, today, rng).save
    expect(after.cards[missedId]).toMatchObject({ stage: 'learning', missedPending: true, dueStep: 0 })
    expect(after.activeBoss).toBeNull()
  })

  it('awards the perfect badge for 50/50', () => {
    let save = startBoss(newSave(today), today, rng)
    save.activeBoss!.ids.forEach((id, i) => (save = answerBoss(save, i, QUESTIONS_BY_ID.get(id)!.correct)))
    expect(submitBoss(save, today, rng).save.badges['boss-perfect']).toBe(today)
  })
})

describe('study answers', () => {
  it('never subtracts supplies or XP for a wrong answer', () => {
    const save = newSave(today)
    const { save: after, outcome } = answerStudy(save, q.id, wrong, today, rng)
    expect(outcome).toMatchObject({ correct: false, xp: 0, supplies: 0 })
    expect(after.supplies.amount).toBe(SUPPLIES_START)
    expect(after.xp).toBe(0)
  })

  it('pays a recovery bonus for correctly answering a previously-missed question', () => {
    let save = answerStudy(newSave(today), q.id, wrong, today, rng).save
    const { save: after, outcome } = answerStudy(save, q.id, q.correct, today, rng)
    expect(outcome.recoveryBonus).toBe(SUPPLIES_RECOVERY_BONUS)
    expect(after.supplies.amount).toBe(SUPPLIES_START + SUPPLIES_CORRECT + SUPPLIES_RECOVERY_BONUS)
    save = after
    expect(answerStudy(save, q.id, q.correct, today, rng).outcome.recoveryBonus).toBe(0)
  })

  it('awards XP and counts the day toward the streak', () => {
    const { save, outcome } = answerStudy(newSave(today), q.id, q.correct, today, rng)
    expect(outcome.xp).toBe(XP_CORRECT)
    expect(save.days[today]).toBe(1)
    expect(save.step).toBe(1)
  })
})

describe('supplies', () => {
  it('decays once per elapsed day, slowly', () => {
    const s = initialSupplies(today)
    expect(decaySupplies(s, today)).toBe(s)
    const next = decaySupplies(s, addDays(today, 1))
    expect(next.amount).toBe(SUPPLIES_START - dailyDecay(SUPPLIES_START))
    expect(dailyDecay(SUPPLIES_START)).toBeLessThan(SUPPLIES_START / 3)
  })

  it('bottoms out at zero (low power), not below, and breaks the survivor run', () => {
    const s = decaySupplies(initialSupplies(today), addDays(today, 60))
    expect(s.amount).toBe(0)
    expect(s.positiveSince).toBeNull()
  })

  it('awards the survivor badge after 30 days above zero', () => {
    let save: Save = { ...newSave(today), supplies: { amount: 100_000, lastDecayDate: today, positiveSince: today } }
    save = tick(save, addDays(today, 28)).save
    expect(save.badges.survivor).toBeUndefined()
    save = tick(save, addDays(today, 29)).save
    expect(save.badges.survivor).toBe(addDays(today, 29))
  })
})

describe('streaks', () => {
  it('counts consecutive days meeting the goal, including a not-yet-met today', () => {
    const days = { [addDays(today, -2)]: DAILY_GOAL, [addDays(today, -1)]: DAILY_GOAL, [today]: 3 }
    expect(currentStreak(days, today)).toBe(2)
    expect(currentStreak({ ...days, [today]: DAILY_GOAL }, today)).toBe(3)
    expect(currentStreak({ [addDays(today, -3)]: DAILY_GOAL }, today)).toBe(0)
  })

  it('finds the longest run and awards the 7-day badge', () => {
    const days: Record<string, number> = {}
    for (let i = 0; i < 7; i++) days[addDays(today, -10 + i)] = DAILY_GOAL
    days[addDays(today, -1)] = DAILY_GOAL
    expect(longestStreak(days)).toBe(7)
    expect(tick({ ...newSave(today), days }, today).save.badges['streak-7']).toBe(today)
  })
})

describe('ranks and skills', () => {
  it('climbs through the five survivor ranks', () => {
    expect(RANKS.map((r) => r.name)).toEqual(['Scavenger', 'Signal Runner', 'Relay Keeper', 'Net Control', 'Wasteland Elmer'])
    expect(rankFor(0).rank.name).toBe('Scavenger')
    expect(rankFor(RANKS[4].minXp).rank.name).toBe('Wasteland Elmer')
    expect(rankFor(RANKS[4].minXp).next).toBeNull()
  })

  it('maxes a skill only when every question is in long-term review, and awards its badge', () => {
    const ids = IDS_BY_SUBELEMENT.E0
    const longCard = { stage: 'long' as const, streak: 6, reviews: 0, dueStep: 0, dueDate: addDays(today, 21), missedPending: false, seen: 6, correct: 6 }
    const cards = Object.fromEntries(ids.map((id) => [id, longCard]))
    expect(skillBreakdown(ids, cards).level).toBe(10)
    const almost = { ...cards, [ids[0]]: { ...longCard, stage: 'medium' as const } }
    expect(skillBreakdown(ids, almost).level).toBe(9)
    expect(tick({ ...newSave(today), cards }, today).save.badges['mastery-E0']).toBe(today)
  })

  it('reports a rank-up on the answer that crosses the threshold', () => {
    const save = { ...newSave(today), xp: RANKS[1].minXp - 1 }
    expect(answerStudy(save, q.id, q.correct, today, rng).outcome.rankUp?.name).toBe('Signal Runner')
  })
})

describe('save files', () => {
  it('round-trips through JSON and rejects junk', () => {
    const save = answerStudy(newSave(today), q.id, q.correct, today, rng).save
    expect(parseSave(JSON.stringify(save))).toEqual(save)
    expect(() => parseSave('{"hello":1}')).toThrow()
  })
})
