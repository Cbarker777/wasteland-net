import { describe, expect, it } from 'vitest'
import { figureSrc, POOL_ORDER, POOLS, QUESTIONS_BY_ID } from '../data/pool'
import { answerBoss, answerStudy, build, IDS_BY_POOL, startMiniBoss, IDS_BY_SUBELEMENT, newSave, parseSave, setPool, startBoss, submitBoss, tick, type Save } from './save'
import { addDays } from './dates'
import { buildExam, buildMiniExam, miniPassMark } from './boss'
import { rankFor, skillBreakdown, RANKS } from './progression'
import { currentStreak, longestStreak } from './streak'
import { dailyDecay, decaySupplies, initialSupplies } from './supplies'
import { DAILY_GOAL, MINI_LENGTH, SCRAP_BOSS_PASS, SCRAP_CORRECT, SCRAP_MINI_PASS, SUPPLIES_CORRECT, SUPPLIES_RECOVERY_BONUS, SUPPLIES_START, XP_CORRECT } from './config'
import { emptyOutpost, MAX_STRUCTURE_LEVEL, STRUCTURES } from './outpost'

// Every file actually shipped in public/figures/.
const FIGURE_FILES = new Set(Object.keys(import.meta.glob('../../public/figures/*')).map((p) => `figures/${p.split('/').pop()}`))

const today = '2026-09-26'
const rng = () => 0
const q = POOLS.extra.questions[0]
const wrong = (q.correct + 1) % 4

describe('question pools', () => {
  it('Extra has all ten sub-elements with the official exam distribution', () => {
    expect(POOLS.extra.subelements.map((s) => `${s.id}:${s.examQuestions}`)).toEqual([
      'E1:6', 'E2:5', 'E3:3', 'E4:5', 'E5:4', 'E6:6', 'E7:8', 'E8:4', 'E9:8', 'E0:1',
    ])
    expect(POOLS.extra.questions.length).toBe(599)
    expect(POOLS.extra).toMatchObject({ element: 4, examLength: 50, passMark: 37 })
  })

  it('General has all ten sub-elements with the official exam distribution', () => {
    expect(POOLS.general.subelements.map((s) => `${s.id}:${s.examQuestions}`)).toEqual([
      'G1:5', 'G2:5', 'G3:3', 'G4:5', 'G5:3', 'G6:2', 'G7:3', 'G8:3', 'G9:4', 'G0:2',
    ])
    expect(POOLS.general.questions.length).toBe(423)
    expect(POOLS.general).toMatchObject({ element: 3, examLength: 35, passMark: 26 })
  })

  it('Technician has all ten sub-elements with the official exam distribution', () => {
    expect(POOLS.technician.subelements.map((s) => `${s.id}:${s.examQuestions}`)).toEqual([
      'T1:6', 'T2:3', 'T3:3', 'T4:2', 'T5:4', 'T6:4', 'T7:4', 'T8:4', 'T9:2', 'T0:3',
    ])
    expect(POOLS.technician.questions.length).toBe(409)
    expect(POOLS.technician).toMatchObject({ element: 2, examLength: 35, passMark: 26 })
  })

  it('carries the Technician errata text', () => {
    expect(QUESTIONS_BY_ID.get('T5A05')!.question).toBe('A difference in which of the following causes electron flow?')
  })

  it.each(POOL_ORDER)('%s: every question that cites a figure shows an image that exists', (pool) => {
    for (const q of POOLS[pool].questions) {
      if (/figure [TGE]d?-?d/i.test(q.question)) expect(q.figure, q.id).toBeTruthy()
      if (q.figure) expect(FIGURE_FILES.has(figureSrc(q)!), q.id).toBe(true)
    }
  })

  it('does not contain withdrawn questions', () => {
    const withdrawn = ['E2A13', 'E4D05', 'E6D07', 'E9E10', 'G1A04', 'G1C08', 'G1C09', 'G1C10', 'G1E09', 'G6B09', 'G8C01', 'G9C06', 'G9D13']
    for (const id of withdrawn) expect(QUESTIONS_BY_ID.has(id)).toBe(false)
  })

  it('keeps each pool to its own questions', () => {
    expect(IDS_BY_POOL.technician.every((id) => id.startsWith('T'))).toBe(true)
    expect(IDS_BY_POOL.general.every((id) => id.startsWith('G'))).toBe(true)
    expect(IDS_BY_POOL.extra.every((id) => id.startsWith('E'))).toBe(true)
  })
})

describe('boss exam', () => {
  it.each(POOL_ORDER)('%s draws one question per group, matching the sub-element distribution', (pool) => {
    const p = POOLS[pool]
    const ids = buildExam(p, Math.random)
    expect(ids.length).toBe(p.examLength)
    expect(new Set(ids.map((id) => QUESTIONS_BY_ID.get(id)!.group)).size).toBe(p.examLength)
    for (const se of p.subelements) expect(ids.filter((id) => id.startsWith(se.id)).length).toBe(se.examQuestions)
  })

  it('uses the selected pool', () => {
    const save = startBoss(setPool(newSave(today), 'general'), today, rng)
    expect(save.activeBoss!.pool).toBe('general')
    expect(save.activeBoss!.ids.length).toBe(35)
    expect(save.activeBoss!.ids.every((id) => id.startsWith('G'))).toBe(true)
  })

  it('Extra passes at 37 and fails at 36', () => {
    let save = startBoss(newSave(today), today, rng)
    const ids = save.activeBoss!.ids
    ids.forEach((id, i) => (save = answerBoss(save, i, i < 37 ? QUESTIONS_BY_ID.get(id)!.correct : null)))
    const passed = submitBoss(save, today, rng)
    expect(passed.outcome.score).toMatchObject({ correct: 37, passed: true })
    expect(passed.save.badges['boss-pass']).toBe(today)
    expect(passed.save.badges['boss-perfect']).toBeUndefined()
    expect(passed.save.badges['general-boss-pass']).toBeUndefined()

    save = answerBoss(save, 36, null)
    expect(submitBoss(save, today, rng).outcome.score).toMatchObject({ correct: 36, passed: false })
  })

  it('Technician passes at 26 and earns its own badge', () => {
    let save = startBoss(setPool(newSave(today), 'technician'), today, rng)
    const ids = save.activeBoss!.ids
    expect(ids.every((id) => id.startsWith('T'))).toBe(true)
    ids.forEach((id, i) => (save = answerBoss(save, i, i < 26 ? QUESTIONS_BY_ID.get(id)!.correct : null)))
    const passed = submitBoss(save, today, rng)
    expect(passed.outcome.score).toMatchObject({ correct: 26, total: 35, passed: true })
    expect(passed.save.badges['technician-boss-pass']).toBe(today)
  })

  it('General passes at 26 and earns its own badges', () => {
    let save = startBoss(setPool(newSave(today), 'general'), today, rng)
    const ids = save.activeBoss!.ids
    ids.forEach((id, i) => (save = answerBoss(save, i, i < 26 ? QUESTIONS_BY_ID.get(id)!.correct : null)))
    const passed = submitBoss(save, today, rng)
    expect(passed.outcome.score).toMatchObject({ correct: 26, total: 35, passed: true })
    expect(passed.save.bossHistory.at(-1)!.pool).toBe('general')
    expect(passed.save.badges['general-boss-pass']).toBe(today)
    expect(passed.save.badges['boss-pass']).toBeUndefined()

    save = answerBoss(save, 25, null)
    expect(submitBoss(save, today, rng).outcome.score.passed).toBe(false)
  })

  it('sends missed boss questions straight to the front of the study queue', () => {
    let save = startBoss(newSave(today), today, rng)
    const missedId = save.activeBoss!.ids[0]
    save = answerBoss(save, 0, (QUESTIONS_BY_ID.get(missedId)!.correct + 1) % 4)
    const after = submitBoss(save, today, rng).save
    expect(after.cards[missedId]).toMatchObject({ stage: 'learning', missedPending: true, dueStep: 0 })
    expect(after.activeBoss).toBeNull()
  })

  it('awards the perfect badge for a clean sweep', () => {
    let save = startBoss(newSave(today), today, rng)
    save.activeBoss!.ids.forEach((id, i) => (save = answerBoss(save, i, QUESTIONS_BY_ID.get(id)!.correct)))
    expect(submitBoss(save, today, rng).save.badges['boss-perfect']).toBe(today)
  })
})

describe('study answers', () => {
  it('never subtracts supplies or XP for a wrong answer', () => {
    const save = newSave(today)
    const { save: after, outcome } = answerStudy(save, q.id, wrong, today, rng)
    expect(outcome).toMatchObject({ correct: false, xp: 0, supplies: 0, scrap: 0 })
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
  it('migrates an Extra-only v1 save without losing anything', () => {
    const v1 = {
      version: 1,
      createdAt: today,
      cards: { E1A01: { stage: 'medium', streak: 3, reviews: 0, dueStep: 0, dueDate: today, missedPending: false, seen: 3, correct: 3 } },
      step: 3,
      xp: 540,
      supplies: { amount: 90, lastDecayDate: today, positiveSince: today },
      days: { [today]: 3 },
      bossHistory: [{ date: today, correct: 42, total: 50, passed: true, bySubelement: {} }],
      activeBoss: null,
      badges: { 'boss-pass': today },
    }
    const save = parseSave(JSON.stringify(v1))
    expect(save).toMatchObject({ version: 4, pool: 'extra', miniBosses: {}, xp: 540, badges: { 'boss-pass': today } })
    // Back-pay: Scrap for every correct answer already logged.
    expect(save.scrap).toBe(3 * SCRAP_CORRECT)
    expect(save.outpost).toEqual(emptyOutpost())
    expect(save.bossHistory[0].pool).toBe('extra')
    expect(save.cards.E1A01.stage).toBe('medium')
  })


  it('round-trips through JSON and rejects junk', () => {
    const save = answerStudy(newSave(today), q.id, q.correct, today, rng).save
    expect(parseSave(JSON.stringify(save))).toEqual(save)
    expect(() => parseSave('{"hello":1}')).toThrow()
  })
})

describe('outpost', () => {
  const rich = (): Save => ({ ...newSave(today), scrap: 10_000 })
  const withOutpost = (levels: Partial<Save['outpost']>): Save => ({ ...newSave(today), outpost: { ...emptyOutpost(), ...levels } })

  it('pays Scrap for correct answers only', () => {
    const right = answerStudy(newSave(today), q.id, q.correct, today, rng)
    expect(right.outcome.scrap).toBe(SCRAP_CORRECT)
    expect(right.save.scrap).toBe(SCRAP_CORRECT)
    expect(answerStudy(newSave(today), q.id, wrong, today, rng).save.scrap).toBe(0)
  })

  it('spends Scrap to build and upgrade, up to max level', () => {
    let save = rich()
    const tower = STRUCTURES.find((s) => s.id === 'tower')!
    save = build(save, 'tower', today).save
    expect(save.outpost.tower).toBe(1)
    expect(save.scrap).toBe(10_000 - tower.costs[0])
    save = build(build(save, 'tower', today).save, 'tower', today).save
    expect(save.outpost.tower).toBe(MAX_STRUCTURE_LEVEL)
    expect(() => build(save, 'tower', today)).toThrow('max')
  })

  it('refuses to build without enough Scrap and never touches Supplies', () => {
    const poor = newSave(today)
    expect(() => build(poor, 'tower', today)).toThrow('Scrap')
    expect(build(rich(), 'bunker', today).save.supplies).toEqual(rich().supplies)
  })

  it('Radio Tower and Greenhouse add per-answer Scrap and Supplies', () => {
    const { outcome } = answerStudy(withOutpost({ tower: 2, greenhouse: 3 }), q.id, q.correct, today, rng)
    expect(outcome.scrap).toBe(SCRAP_CORRECT + 2)
    expect(outcome.supplies).toBe(SUPPLIES_CORRECT + 3)
  })

  it('Field Clinic raises the recovery bonus', () => {
    const missed = answerStudy(withOutpost({ clinic: 2 }), q.id, wrong, today, rng).save
    expect(answerStudy(missed, q.id, q.correct, today, rng).outcome.recoveryBonus).toBe(SUPPLIES_RECOVERY_BONUS + 6)
  })

  it('Solar Array charges once per day on the first correct answer', () => {
    const q2 = POOLS.extra.questions[1]
    const first = answerStudy(withOutpost({ solar: 1 }), q.id, q.correct, today, rng)
    expect(first.outcome.solarCharge).toBe(5)
    expect(answerStudy(first.save, q2.id, q2.correct, today, rng).outcome.solarCharge).toBe(0)
    expect(answerStudy(first.save, q2.id, q2.correct, addDays(today, 1), rng).outcome.solarCharge).toBe(5)
  })

  it('Water Purifier slows daily decay', () => {
    const plain = tick({ ...newSave(today), supplies: { amount: 500, lastDecayDate: today, positiveSince: today } }, addDays(today, 1)).save
    const purified = tick({ ...withOutpost({ purifier: 3 }), supplies: { amount: 500, lastDecayDate: today, positiveSince: today } }, addDays(today, 1)).save
    expect(500 - purified.supplies.amount).toBeLessThan(500 - plain.supplies.amount)
    expect(500 - purified.supplies.amount).toBe(Math.round((500 - plain.supplies.amount) * 0.55))
  })

  it('Signal Bunker adds Scrap for a passed boss battle', () => {
    let save = startBoss(withOutpost({ bunker: 2 }), today, rng)
    save.activeBoss!.ids.forEach((id, i) => (save = answerBoss(save, i, QUESTIONS_BY_ID.get(id)!.correct)))
    const { outcome } = submitBoss(save, today, rng)
    expect(outcome.scrap).toBe(50 * SCRAP_CORRECT + SCRAP_BOSS_PASS + 30)
  })

  it('awards the founder badge once all six are built', () => {
    let save = rich()
    for (const s of STRUCTURES.slice(0, -1)) save = build(save, s.id, today).save
    expect(save.badges['outpost-built']).toBeUndefined()
    const last = build(save, STRUCTURES.at(-1)!.id, today)
    expect(last.earned.map((b) => b.id)).toContain('outpost-built')
  })
})

describe('mini bosses', () => {
  const answerAll = (save: Save, correctCount: number) => {
    save.activeBoss!.ids.forEach((id, i) => (save = answerBoss(save, i, i < correctCount ? QUESTIONS_BY_ID.get(id)!.correct : null)))
    return save
  }

  it.each(POOL_ORDER.flatMap((p) => POOLS[p].subelements.map((se) => [p, se.id] as const)))('%s %s: 10 distinct questions spread evenly across groups', (pool, seId) => {
    const se = POOLS[pool].subelements.find((s) => s.id === seId)!
    const ids = buildMiniExam(se, POOLS[pool].questions, Math.random)
    expect(ids.length).toBe(MINI_LENGTH)
    expect(new Set(ids).size).toBe(MINI_LENGTH)
    expect(ids.every((id) => id.startsWith(seId))).toBe(true)
    const perGroup = se.groups.map((g) => ids.filter((id) => id.startsWith(g.id)).length)
    const available = se.groups.map((g) => POOLS[pool].questions.filter((q) => q.group === g.id).length)
    // Even spread: no group gets 2+ more than another unless it ran out of questions.
    for (let a = 0; a < perGroup.length; a++)
      for (let b = 0; b < perGroup.length; b++) if (perGroup[a] < available[a]) expect(perGroup[b] - perGroup[a]).toBeLessThanOrEqual(1)
  })

  it('uses every question when a sub-element has fewer than the mini boss length', () => {
    const se = { id: 'X1', name: 'Tiny', examQuestions: 1, groups: [{ id: 'X1A', title: 'Tiny' }] }
    const qs = [0, 1, 2].map((n) => ({ ...q, id: `X1A0${n}`, group: 'X1A', subelement: 'X1' }))
    expect(buildMiniExam(se, qs, rng)).toEqual(['X1A00', 'X1A01', 'X1A02'])
  })

  it('passes at 8 of 10, the same 74% ratio as the real exams', () => {
    expect(miniPassMark(10)).toBe(8)
    let save = startMiniBoss(newSave(today), 'E7', today, rng)
    const passed = submitBoss(answerAll(save, 8), today, rng)
    expect(passed.outcome).toMatchObject({ subelement: 'E7', passMark: 8, score: { correct: 8, total: 10, passed: true } })
    save = startMiniBoss(newSave(today), 'E7', today, rng)
    expect(submitBoss(answerAll(save, 7), today, rng).outcome.score.passed).toBe(false)
  })

  it('records results per sub-element, apart from full boss history and badges', () => {
    let save = startMiniBoss({ ...newSave(today), outpost: { ...emptyOutpost(), bunker: 3 } }, 'E1', today, rng)
    const { save: after, outcome } = submitBoss(answerAll(save, 10), today, rng)
    expect(after.bossHistory).toEqual([])
    expect(after.badges['boss-pass']).toBeUndefined()
    expect(after.badges['boss-perfect']).toBeUndefined()
    expect(after.miniBosses.E1).toEqual({ attempts: 1, wins: 1, best: 10, total: 10, lastDate: today })
    // Mini win bonus only; the Signal Bunker bonus is for full battles.
    expect(outcome.scrap).toBe(10 * SCRAP_CORRECT + SCRAP_MINI_PASS)

    save = startMiniBoss(after, 'E1', today, rng)
    const again = submitBoss(answerAll(save, 3), today, rng).save
    expect(again.miniBosses.E1).toMatchObject({ attempts: 2, wins: 1, best: 10 })
  })

  it('sends mini boss misses to the front of the study queue', () => {
    let save = startMiniBoss(newSave(today), 'E3', today, rng)
    const missed = save.activeBoss!.ids[0]
    save = answerBoss(save, 0, (QUESTIONS_BY_ID.get(missed)!.correct + 1) % 4)
    expect(submitBoss(save, today, rng).save.cards[missed]).toMatchObject({ stage: 'learning', missedPending: true })
  })

  it('only tests sub-elements from the selected pool', () => {
    expect(() => startMiniBoss(newSave(today), 'T1', today, rng)).toThrow('not in the Extra pool')
    expect(startMiniBoss(setPool(newSave(today), 'technician'), 'T1', today, rng).activeBoss!.ids.every((id) => id.startsWith('T1'))).toBe(true)
  })
})
