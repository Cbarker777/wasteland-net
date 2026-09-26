/**
 * Boss battle: a simulated license exam. The real exams draw exactly one
 * question from each of the pool's groups (35 for General, 50 for Extra),
 * which is what gives them the official per-sub-element distribution.
 */
import type { Pool, Question, Subelement, SubelementId } from '../data/pool'
import { MINI_LENGTH, MINI_PASS_RATIO } from './config'
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

/**
 * Mini boss: a test on one sub-element, spread evenly across its question
 * groups (round-robin, no repeats). Uses every question if there are fewer
 * than `length`.
 */
export function buildMiniExam(se: Subelement, questions: readonly Question[], rng: Rng, length = MINI_LENGTH): string[] {
  const byGroup = se.groups.map((g) => shuffle(questions.filter((q) => q.group === g.id).map((q) => q.id), rng))
  const ids: string[] = []
  for (let round = 0; ids.length < length && byGroup.some((g) => g.length > round); round++) {
    for (const g of byGroup) if (round < g.length && ids.length < length) ids.push(g[round])
  }
  // Keep the exam in pool order, grouped the way the syllabus reads.
  return ids.sort()
}

export const miniPassMark = (length: number) => Math.ceil(length * MINI_PASS_RATIO)

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
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
