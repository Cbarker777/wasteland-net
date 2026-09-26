import poolJson from './pool.json'

export type SubelementId = 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8' | 'E9' | 'E0'

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
  version: string
  subelements: Subelement[]
  questions: Question[]
}

export const POOL = poolJson as Pool
export const QUESTIONS_BY_ID: ReadonlyMap<string, Question> = new Map(POOL.questions.map((q) => [q.id, q]))

/** Wasteland flavor for each sub-element skill. The official names stay primary. */
export const SKILL_INFO: Record<SubelementId, { label: string; flavor: string; badge: string }> = {
  E1: { label: "Commission's Rules", flavor: 'The old laws still hold on the air', badge: 'Keeper of the Old Law' },
  E2: { label: 'Operating Procedures', flavor: 'Satellites, contests, and digital nets', badge: 'Procedure Veteran' },
  E3: { label: 'Radio Wave Propagation', flavor: 'Reading the sky for a path out', badge: 'Sky Reader' },
  E4: { label: 'Amateur Radio Practices', flavor: 'Test gear, receivers, and noise hunting', badge: 'Bench Scavver' },
  E5: { label: 'Electrical Principles', flavor: 'Resonance, phase, and the math of power', badge: 'Current Tamer' },
  E6: { label: 'Circuit Components', flavor: 'Salvaged parts and what they really do', badge: 'Parts Hoarder' },
  E7: { label: 'Practical Circuits', flavor: 'Amps, filters, and oscillators from the scrap pile', badge: 'Rig Builder' },
  E8: { label: 'Signals and Emissions', flavor: 'Modulation, sampling, and the shape of a signal', badge: 'Waveform Whisperer' },
  E9: { label: 'Antennas and Feed Lines', flavor: 'Wire in the air is the difference between heard and lost', badge: 'Skywire Rigger' },
  E0: { label: 'Safety', flavor: 'RF exposure, towers, and staying alive', badge: 'Still Breathing' },
}

export const SUBELEMENT_ORDER: SubelementId[] = POOL.subelements.map((s) => s.id)
