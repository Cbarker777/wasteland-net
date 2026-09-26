/**
 * The outpost: structures bought with Scrap. Each level changes how the base
 * looks and adds a small perk. No perk makes a question easier; they only
 * adjust Supplies and Scrap.
 */

export type StructureId = 'tower' | 'purifier' | 'greenhouse' | 'clinic' | 'solar' | 'bunker'

export type StructureDef = {
  id: StructureId
  name: string
  flavor: string
  /** Scrap cost to reach level 1, 2, 3. */
  costs: [number, number, number]
  /** What the structure does at a given level (1–3). */
  effect: (level: number) => string
}

export const MAX_STRUCTURE_LEVEL = 3

export const STRUCTURES: StructureDef[] = [
  {
    id: 'tower',
    name: 'Radio Tower',
    flavor: 'Taller mast, farther reach. Salvage crews follow the signal home.',
    costs: [60, 200, 500],
    effect: (l) => `+${l} Scrap per correct answer`,
  },
  {
    id: 'purifier',
    name: 'Water Purifier',
    flavor: 'Clean water means the stockpile stretches further.',
    costs: [100, 300, 700],
    effect: (l) => `Supplies decay ${l * 15}% slower`,
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse',
    flavor: 'Something green growing in the dust.',
    costs: [100, 300, 700],
    effect: (l) => `+${l} Supplies per correct answer`,
  },
  {
    id: 'clinic',
    name: 'Field Clinic',
    flavor: 'Patching up old mistakes pays better with a medic on hand.',
    costs: [80, 250, 600],
    effect: (l) => `+${l * 3} extra Supplies when you fix a missed question`,
  },
  {
    id: 'solar',
    name: 'Solar Array',
    flavor: 'Panels charge while you sleep. The first contact of the day tops you up.',
    costs: [120, 350, 800],
    effect: (l) => `+${l * 5} Supplies on your first correct answer each day`,
  },
  {
    id: 'bunker',
    name: 'Signal Bunker',
    flavor: 'Hardened shelter for the fights that matter.',
    costs: [150, 400, 900],
    effect: (l) => `+${l * 15} Scrap when you pass a boss battle`,
  },
]

export const STRUCTURES_BY_ID = Object.fromEntries(STRUCTURES.map((s) => [s.id, s])) as Record<StructureId, StructureDef>

export type Outpost = Record<StructureId, number>

export const emptyOutpost = (): Outpost => ({ tower: 0, purifier: 0, greenhouse: 0, clinic: 0, solar: 0, bunker: 0 })

/** Scrap needed for the next level, or null if already maxed. */
export function nextCost(outpost: Outpost, id: StructureId): number | null {
  const level = outpost[id]
  return level >= MAX_STRUCTURE_LEVEL ? null : STRUCTURES_BY_ID[id].costs[level]
}

export type Perks = {
  /** Multiplier on daily Supplies decay. */
  decayMultiplier: number
  suppliesPerCorrect: number
  scrapPerCorrect: number
  recoveryBonus: number
  dailyCharge: number
  bossPassScrap: number
}

export function perks(o: Outpost): Perks {
  return {
    decayMultiplier: 1 - 0.15 * o.purifier,
    suppliesPerCorrect: o.greenhouse,
    scrapPerCorrect: o.tower,
    recoveryBonus: 3 * o.clinic,
    dailyCharge: 5 * o.solar,
    bossPassScrap: 15 * o.bunker,
  }
}

export function structuresBuilt(o: Outpost): number {
  return STRUCTURES.filter((s) => o[s.id] > 0).length
}

export function structuresMaxed(o: Outpost): number {
  return STRUCTURES.filter((s) => o[s.id] >= MAX_STRUCTURE_LEVEL).length
}
