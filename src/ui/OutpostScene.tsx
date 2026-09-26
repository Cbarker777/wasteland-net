import type { ReactNode } from 'react'
import { STRUCTURES_BY_ID, type Outpost, type StructureId } from '../game/outpost'

/**
 * The outpost as line art on a wasteland horizon. Every structure is drawn
 * from its level (0 = empty plot), so building or upgrading changes the
 * picture. Colors come from the theme tokens via Tailwind fill-/stroke- classes.
 */

const W = 960
const H = 300
const G = 238 // ground line

const PLOTS: { id: StructureId; x: number }[] = [
  { id: 'purifier', x: 95 },
  { id: 'greenhouse', x: 245 },
  { id: 'clinic', x: 390 },
  { id: 'tower', x: 530 },
  { id: 'solar', x: 690 },
  { id: 'bunker', x: 850 },
]

export function OutpostScene({ outpost, powered, labels = false }: { outpost: Outpost; powered: boolean; labels?: boolean }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={describe(outpost)}>
      <defs>
        <linearGradient id="op-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#120e0a" />
          <stop offset="0.75" stopColor="#3a2614" />
          <stop offset="1" stopColor="#5a3818" />
        </linearGradient>
        <radialGradient id="op-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb347" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Sky, hazy sun, and the dead city on the horizon */}
      <rect width={W} height={H} fill="url(#op-sky)" />
      <circle cx={760} cy={170} r={90} fill="url(#op-sun)" />
      <circle cx={760} cy={170} r={26} className="fill-signal" opacity={0.35} />
      <path
        d="M0 205 h40 v-30 h18 v12 h22 v-40 h14 v8 h16 v48 h30 v-22 h20 v-54 l10 -8 v62 h26 v-18 h34 v26 h40 v-44 h12 v-10 h10 v54 h60 v-16 h24 v-30 h16 v40 h50 v-12 h30 v-36 h8 l6 -12 v48 h44 v-20 h28 v28 h60 v-58 h20 v58 h70 v-24 h26 v-14 h14 v38 h40 v-30 h22 v30 h60 V238 H0 Z"
        fill="#1c150e"
        opacity={0.9}
      />
      {/* Ground */}
      <path d={`M0 ${G} C 160 ${G - 8}, 320 ${G + 6}, 480 ${G - 2} S 800 ${G + 4}, ${W} ${G - 4} V ${H} H 0 Z`} className="fill-dust" />
      <path d={`M0 ${G} C 160 ${G - 8}, 320 ${G + 6}, 480 ${G - 2} S 800 ${G + 4}, ${W} ${G - 4}`} className="stroke-signal-dim" fill="none" strokeWidth={1.5} />
      {[70, 180, 330, 470, 620, 760, 900].map((x, i) => (
        <path key={i} d={`M${x} ${G + 18 + (i % 3) * 12} q 12 -6 24 0`} className="stroke-line" fill="none" strokeWidth={1.5} />
      ))}

      {/* Campfire in the foreground, clear of every plot's footprint */}
      <Campfire x={462} y={G + 30} lit={powered} />

      {PLOTS.map(({ id, x }) => {
        const level = outpost[id]
        return (
          <g key={id}>
            {level === 0 ? <EmptyPlot x={x} /> : DRAW[id](x, level, powered)}
            {labels && (
              <text x={x} y={H - 26} textAnchor="middle" className={level ? 'fill-signal' : 'fill-static'} fontSize={12} fontFamily="var(--font-mono)" letterSpacing="0.06em">
                {STRUCTURES_BY_ID[id].name.toUpperCase()}
                <tspan x={x} dy={15} className={level ? 'fill-sand-dim' : 'fill-static'}>
                  {level > 0 ? `LV ${level}` : 'EMPTY'}
                </tspan>
              </text>
            )}
          </g>
        )
      })}

      {!powered && (
        <text x={W / 2} y={40} textAnchor="middle" className="fill-rust flicker" fontSize={16} fontFamily="var(--font-mono)" letterSpacing="0.2em">
          LOW POWER · LIGHTS OUT
        </text>
      )}
    </svg>
  )
}

function describe(o: Outpost): string {
  const built = PLOTS.filter((p) => o[p.id] > 0).map((p) => `${STRUCTURES_BY_ID[p.id].name} level ${o[p.id]}`)
  return built.length ? `Your outpost: ${built.join(', ')}` : 'Your outpost: six empty plots'
}

const frame = 'fill-panel-2 stroke-signal'
const light = (on: boolean) => (on ? 'fill-signal' : 'fill-line')

function EmptyPlot({ x }: { x: number }) {
  return (
    <g>
      <rect x={x - 40} y={G - 6} width={80} height={10} className="fill-none stroke-static" strokeDasharray="5 5" strokeWidth={1.5} />
      <path d={`M${x - 8} ${G - 6} v-26 l18 7 -18 7`} className="stroke-static fill-none" strokeWidth={1.5} />
    </g>
  )
}

function Campfire({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  return (
    <g>
      <path d={`M${x - 12} ${y + 2} l24 -8 M${x - 12} ${y - 6} l24 8`} className="stroke-signal-dim" strokeWidth={3} strokeLinecap="round" />
      {lit && <path d={`M${x} ${y - 30} c 8 10 9 18 0 24 c -9 -6 -8 -14 0 -24 Z`} className="fill-signal flicker" opacity={0.9} />}
    </g>
  )
}

const DRAW: Record<StructureId, (x: number, level: number, powered: boolean) => ReactNode> = {
  tower: (x, level, powered) => {
    const h = [0, 110, 150, 190][level]
    const top = G - h
    const braces: string[] = []
    for (let y = G, i = 0; y > top + 14; y -= 20, i++) {
      const w1 = 20 * ((y - top) / h) + 4
      const w2 = 20 * ((y - 20 - top) / h) + 4
      braces.push(i % 2 ? `M${x - w1} ${y} L${x + w2} ${y - 20}` : `M${x + w1} ${y} L${x - w2} ${y - 20}`)
    }
    return (
      <g>
        {level >= 3 && <path d={`M${x} ${top + 40} L${x - 70} ${G} M${x} ${top + 40} L${x + 70} ${G}`} className="stroke-static" strokeWidth={1} />}
        <path d={`M${x - 24} ${G} L${x - 4} ${top} M${x + 24} ${G} L${x + 4} ${top}`} className="stroke-signal" strokeWidth={2.5} />
        <path d={braces.join(' ')} className="stroke-signal-dim" strokeWidth={1.5} fill="none" />
        <path d={`M${x} ${top} v-24`} className="stroke-signal" strokeWidth={2} />
        {level >= 2 && (
          <g>
            <path d={`M${x + 8} ${top + 50} l14 -6`} className="stroke-signal" strokeWidth={2} />
            <ellipse cx={x + 30} cy={top + 40} rx={10} ry={16} transform={`rotate(-25 ${x + 30} ${top + 40})`} className={frame} strokeWidth={2} />
          </g>
        )}
        <circle cx={x} cy={top - 26} r={4} className={`${light(powered)} ${powered ? 'flicker' : ''}`} />
      </g>
    )
  },

  purifier: (x, level, powered) => {
    const tanks = Array.from({ length: level }, (_, i) => i)
    const start = x - ((level - 1) * 40) / 2
    return (
      <g>
        <path d={`M${start} ${G - 20} H ${start + (level - 1) * 40}`} className="stroke-signal-dim" strokeWidth={3} />
        {tanks.map((i) => {
          const cx = start + i * 40
          const th = 50 + i * 8
          return (
            <g key={i}>
              <rect x={cx - 15} y={G - th} width={30} height={th} rx={4} className={frame} strokeWidth={2} />
              <rect x={cx - 10} y={G - th * 0.55} width={20} height={th * 0.55 - 6} className={powered ? 'fill-sky' : 'fill-line'} opacity={0.6} />
              <ellipse cx={cx} cy={G - th} rx={15} ry={4} className={frame} strokeWidth={2} />
            </g>
          )
        })}
        <path d={`M${start - 22} ${G} v-34 h8`} className="stroke-signal" strokeWidth={2} fill="none" />
      </g>
    )
  },

  greenhouse: (x, level) => {
    const w = 60 + level * 22
    const h = 50 + level * 4
    const ribs = Array.from({ length: level + 2 }, (_, i) => x - w / 2 + ((i + 1) * w) / (level + 3))
    return (
      <g>
        <path d={`M${x - w / 2} ${G} V ${G - h + 20} Q ${x} ${G - h - 18} ${x + w / 2} ${G - h + 20} V ${G} Z`} className="fill-panel-2 stroke-signal" strokeWidth={2} opacity={0.95} />
        {ribs.map((rx, i) => (
          <path key={i} d={`M${rx} ${G} V ${G - h + 10}`} className="stroke-signal-dim" strokeWidth={1} />
        ))}
        {Array.from({ length: level * 3 }, (_, i) => {
          const px = x - w / 2 + 12 + (i * (w - 24)) / Math.max(1, level * 3 - 1)
          const ph = 10 + ((i * 7) % 9)
          return <path key={i} d={`M${px} ${G} l-5 -${ph} M${px} ${G} l5 -${ph} M${px} ${G} v-${ph + 4}`} className="stroke-rad" strokeWidth={2} strokeLinecap="round" />
        })}
      </g>
    )
  },

  clinic: (x, level, powered) => (
    <g>
      {level >= 2 && <path d={`M${x + 30} ${G} L${x + 58} ${G - 38} L${x + 86} ${G} Z`} className={frame} strokeWidth={2} />}
      <rect x={x - 35} y={G - 50} width={70} height={50} className={frame} strokeWidth={2} />
      <path d={`M${x - 42} ${G - 48} L${x} ${G - 72} L${x + 42} ${G - 48}`} className="stroke-signal fill-none" strokeWidth={2.5} />
      <path d={`M${x - 20} ${G - 25} h14 m-7 -7 v14`} className="stroke-rust" strokeWidth={4} />
      <rect x={x + 6} y={G - 36} width={16} height={16} className={light(powered)} opacity={powered ? 0.8 : 1} />
      {level >= 3 && (
        <g>
          <path d={`M${x - 35} ${G - 50} v-50`} className="stroke-signal" strokeWidth={2} />
          <path d={`M${x - 35} ${G - 100} h26 l-6 8 6 8 h-26`} className="fill-rust" />
        </g>
      )}
    </g>
  ),

  solar: (x, level, powered) => {
    const count = level * 2
    const start = x - ((count - 1) * 26) / 2
    return (
      <g>
        {Array.from({ length: count }, (_, i) => {
          const px = start + i * 26
          const back = i % 2 === 1
          const y = G - (back ? 44 : 30)
          return (
            <g key={i}>
              <path d={`M${px} ${G} V ${y + 6}`} className="stroke-signal-dim" strokeWidth={2} />
              <path d={`M${px - 12} ${y + 10} L${px - 4} ${y - 8} L${px + 16} ${y - 8} L${px + 8} ${y + 10} Z`} className={powered ? 'fill-sky stroke-signal' : 'fill-line stroke-signal-dim'} strokeWidth={1.5} opacity={0.85} />
              <path d={`M${px - 8} ${y + 1} h20 M${px + 2} ${y - 8} l-4 18`} className="stroke-panel-2" strokeWidth={1} />
            </g>
          )
        })}
      </g>
    )
  },

  bunker: (x, level, powered) => {
    const w = 70 + level * 16
    return (
      <g>
        <path d={`M${x - w / 2} ${G} A ${w / 2} ${w / 2.6} 0 0 1 ${x + w / 2} ${G} Z`} className={frame} strokeWidth={2.5} />
        <rect x={x - 16} y={G - w / 2.6 + 18} width={32} height={6} rx={2} className={light(powered)} />
        {level >= 3 && <path d={`M${x + 10} ${G - w / 2.6 + 2} v-36 m-8 8 h16 m-12 8 h8`} className="stroke-signal" strokeWidth={2} />}
        {Array.from({ length: level * 4 }, (_, i) => {
          const row = i % 2
          const bx = x - w / 2 - 6 + (i >> 1) * 18 + row * 9
          return <ellipse key={i} cx={bx} cy={G - 5 - row * 8} rx={9} ry={5} className="fill-signal-dim stroke-dust" strokeWidth={1} />
        })}
      </g>
    )
  },
}
