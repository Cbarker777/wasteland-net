import extraJson from './pools/extra.json'
import generalJson from './pools/general.json'

export type PoolId = 'general' | 'extra'

/** "G1", "E7", … — unique across pools because of the letter prefix. */
export type SubelementId = string

export type Group = { id: string; title: string }

export type Subelement = {
  id: SubelementId
  name: string
  examQuestions: number
  groups: Group[]
}

export type Question = {
  id: string
  subelement: SubelementId
  group: string
  question: string
  answers: [string, string, string, string]
  correct: number
  refs?: string
  figure?: string
}

export type Pool = {
  id: PoolId
  name: string
  element: number
  version: string
  validThrough: string
  examLength: number
  passMark: number
  subelements: Subelement[]
  questions: Question[]
}

export const POOL_ORDER: PoolId[] = ['general', 'extra']

export const POOLS: Record<PoolId, Pool> = {
  general: generalJson as Pool,
  extra: extraJson as Pool,
}

export const QUESTIONS_BY_ID: ReadonlyMap<string, Question> = new Map(POOL_ORDER.flatMap((p) => POOLS[p].questions.map((q) => [q.id, q] as const)))

export const poolOf = (id: string): PoolId => (id.startsWith('G') ? 'general' : 'extra')

export const subelementIds = (pool: PoolId): SubelementId[] => POOLS[pool].subelements.map((s) => s.id)

export const ALL_SUBELEMENTS: SubelementId[] = POOL_ORDER.flatMap(subelementIds)

/**
 * Both pools number their sub-elements by the same topics (x1 rules … x0
 * safety), so the wasteland flavor is keyed by that digit.
 */
const TOPICS: Record<string, { label: string; flavor: string; badge: string }> = {
  '1': { label: "Commission's Rules", flavor: 'The old laws still hold on the air', badge: 'Keeper of the Old Law' },
  '2': { label: 'Operating Procedures', flavor: 'Nets, contests, and working the bands', badge: 'Procedure Veteran' },
  '3': { label: 'Radio Wave Propagation', flavor: 'Reading the sky for a path out', badge: 'Sky Reader' },
  '4': { label: 'Amateur Radio Practices', flavor: 'Test gear, receivers, and noise hunting', badge: 'Bench Scavver' },
  '5': { label: 'Electrical Principles', flavor: 'Resonance, phase, and the math of power', badge: 'Current Tamer' },
  '6': { label: 'Circuit Components', flavor: 'Salvaged parts and what they really do', badge: 'Parts Hoarder' },
  '7': { label: 'Practical Circuits', flavor: 'Amps, filters, and oscillators from the scrap pile', badge: 'Rig Builder' },
  '8': { label: 'Signals and Emissions', flavor: 'Modulation, sampling, and the shape of a signal', badge: 'Waveform Whisperer' },
  '9': { label: 'Antennas and Feed Lines', flavor: 'Wire in the air is the difference between heard and lost', badge: 'Skywire Rigger' },
  '0': { label: 'Safety', flavor: 'RF exposure, towers, and staying alive', badge: 'Still Breathing' },
}

export function skillInfo(se: SubelementId) {
  return TOPICS[se.slice(1)]
}
