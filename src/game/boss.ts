/**
 * Boss battle: a simulated license exam. The real exams draw exactly one
 * question from each of the pool's groups (35 for General, 50 for Extra),
 * which is what gives them the official per-sub-element distribution.
 */
import type { Pool, Question, SubelementId } from '../data/pool'
import type { Rng } from './srs'

export function buildExam(pool: Pool, rng: Rng): string[] {
  const ids: string[] = []
  for (const se of pool.subelements) {
    for (const g of se.groups) {
      const options = pool.questions.filter((q) => q.group === g.id)
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

export function scoreExam(
  ids: readonly string[],
  answers: readonly (number | null)[],
  byId: ReadonlyMap<string, Question>,
  passMark: number,
): ExamScore {
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
  score.passed = score.correct >= passMark
  return score
}
