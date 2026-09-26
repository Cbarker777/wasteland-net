import type { Cards, Card } from './srs'

// ── Survivor rank: driven by lifetime XP ──

export type Rank = { id: string; name: string; minXp: number; flavor: string }

export const RANKS: Rank[] = [
  { id: 'scavenger', name: 'Scavenger', minXp: 0, flavor: 'Picking through the ruins for anything that still hums.' },
  { id: 'signal-runner', name: 'Signal Runner', minXp: 2_000, flavor: 'Carrying messages between the settlements.' },
  { id: 'relay-keeper', name: 'Relay Keeper', minXp: 8_000, flavor: 'A tower of your own, and the know-how to keep it lit.' },
  { id: 'net-control', name: 'Net Control', minXp: 20_000, flavor: 'The wasteland checks in with you.' },
  { id: 'wasteland-elmer', name: 'Wasteland Elmer', minXp: 40_000, flavor: 'Survivors come to you to learn the old ways.' },
]

export type RankProgress = { rank: Rank; index: number; next: Rank | null; intoRank: number; rankSpan: number | null }

export function rankFor(xp: number): RankProgress {
  let index = 0
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].minXp) index = i
  const rank = RANKS[index]
  const next = RANKS[index + 1] ?? null
  return { rank, index, next, intoRank: xp - rank.minXp, rankSpan: next ? next.minXp - rank.minXp : null }
}

// ── Sub-element skills: driven by how well each question is known ──

export const SKILL_MAX_LEVEL = 10

/** 0 for unseen, climbing through learning and medium, 1 only in the long-term pool. */
export function questionMastery(card: Card | undefined): number {
  if (!card) return 0
  switch (card.stage) {
    case 'learning':
      return Math.min(card.streak, 2) * 0.1
    case 'medium':
      return 0.5 + card.reviews * 0.15
    case 'long':
      return 1
  }
}

export type SkillBreakdown = {
  total: number
  unseen: number
  learning: number
  medium: number
  long: number
  /** 0..1 average mastery. */
  mastery: number
  /** 0..SKILL_MAX_LEVEL; max only when every question is in the long-term pool. */
  level: number
  seen: number
  correct: number
}

export function skillBreakdown(ids: readonly string[], cards: Cards): SkillBreakdown {
  const b: SkillBreakdown = { total: ids.length, unseen: 0, learning: 0, medium: 0, long: 0, mastery: 0, level: 0, seen: 0, correct: 0 }
  let sum = 0
  for (const id of ids) {
    const c = cards[id]
    if (!c) b.unseen++
    else {
      b[c.stage]++
      b.seen += c.seen
      b.correct += c.correct
    }
    sum += questionMastery(c)
  }
  b.mastery = ids.length ? sum / ids.length : 0
  b.level = b.long === ids.length && ids.length > 0 ? SKILL_MAX_LEVEL : Math.min(SKILL_MAX_LEVEL - 1, Math.floor(b.mastery * SKILL_MAX_LEVEL))
  return b
}
