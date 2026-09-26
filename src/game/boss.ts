/**
 * Boss battle: a simulated Element 4 exam. The real exam draws exactly one
 * question from each of the pool's 50 groups, which is what gives it the
 * official per-sub-element distribution (E1 6, E2 5, E3 3, … E0 1).
 */
import type { Question, Subelement, SubelementId } from '../data/pool'
import { EXAM_PASS } from './config'
import type { Rng } from './srs'

export function buildExam(subelements: readonly Subelement[], questions: readonly Question[], rng: Rng): string[] {
  const ids: string[] = []
  for (const se of subelements) {
    for (const g of se.groups) {
      const options = questions.filter((q) => q.group === g.id)
      ids.push(options[Math.floor(rng() * options.length)].id)
    }
  }
  return ids
}

export type ExamScore = {
  correct: number
  total: number
  passed: boolean
  bySubelement: Partial<Record<SubelementId, { correct: number; total: number }>>
  missed: string[]
}

export function scoreExam(ids: readonly string[], answers: readonly (number | null)[], byId: ReadonlyMap<string, Question>): ExamScore {
  const score: ExamScore = { correct: 0, total: ids.length, passed: false, bySubelement: {}, missed: [] }
  ids.forEach((id, i) => {
    const q = byId.get(id)!
    const row = (score.bySubelement[q.subelement] ??= { correct: 0, total: 0 })
    row.total++
    if (answers[i] === q.correct) {
      score.correct++
      row.correct++
    } else score.missed.push(id)
  })
  score.passed = score.correct >= EXAM_PASS
  return score
}
