export const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

/** Maps 1–4 / A–D keys to an answer index. */
export function keyToChoice(key: string): number | null {
  const k = key.toLowerCase()
  const i = ['1', '2', '3', '4'].indexOf(k)
  if (i >= 0) return i
  const j = ['a', 'b', 'c', 'd'].indexOf(k)
  return j >= 0 ? j : null
}
