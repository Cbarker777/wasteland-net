import { POOLS } from '../data/pool'
import { DAILY_GOAL, SUPPLIES_LOW } from '../game/config'
import { rankFor } from '../game/progression'
import { currentStreak } from '../game/streak'
import { dailyDecay } from '../game/supplies'
import { today, useGame, type Screen } from '../store'
import { Meter } from './kit'

const NAV: { id: Screen; label: string }[] = [
  { id: 'base', label: 'Base' },
  { id: 'study', label: 'Scavenge' },
  { id: 'boss', label: 'Boss Battle' },
  { id: 'skills', label: 'Skills' },
  { id: 'badges', label: 'Badges' },
  { id: 'log', label: 'Radio Log' },
]

export function StatusBar() {
  const save = useGame((s) => s.save)
  const screen = useGame((s) => s.screen)
  const go = useGame((s) => s.go)
  const r = rankFor(save.xp)
  const t = today()
  const streak = currentStreak(save.days, t)
  const todayCount = save.days[t] ?? 0
  const supplies = save.supplies.amount
  const low = supplies > 0 && supplies < SUPPLIES_LOW

  return (
    <header className="border-b border-line bg-panel/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4 pt-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <button onClick={() => go('base')} className="flex items-center gap-2 text-left" aria-label="Wasteland Net home">
            <Antenna />
            <span className="text-lg font-bold tracking-[0.2em] text-signal glow">WASTELAND NET</span>
            <span className="rounded-sm px-1.5 py-0.5 text-[10px] tracking-[0.14em] text-signal uppercase ring-1 ring-signal-dim">{POOLS[save.pool].name}</span>
          </button>

          <div className="grid w-full grid-cols-3 gap-3 sm:ml-auto sm:w-auto sm:max-w-xl sm:flex-1 sm:gap-4">
            <div>
              <div className="label truncate">
                <span className="hidden sm:inline">Rank · </span>
                {save.xp.toLocaleString()} XP
              </div>
              <div className="truncate text-sm text-signal">{r.rank.name}</div>
              <Meter value={r.intoRank} max={r.rankSpan ?? 1} className="mt-1" />
            </div>
            <div>
              <div className="label truncate">
                Supplies<span className="hidden sm:inline"> · −{dailyDecay(supplies)}/day</span>
              </div>
              <div className={`truncate text-sm ${supplies === 0 ? 'text-rust flicker' : low ? 'text-rust' : 'text-rad'}`}>
                {supplies === 0 ? 'LOW POWER' : supplies.toLocaleString()}
              </div>
              <Meter value={supplies} max={Math.max(200, supplies)} tone={supplies === 0 || low ? 'rust' : 'rad'} className="mt-1" />
            </div>
            <div>
              <div className="label">Streak</div>
              <div className="text-sm text-sky">
                {streak} day{streak === 1 ? '' : 's'}
              </div>
              <Meter value={Math.min(todayCount, DAILY_GOAL)} max={DAILY_GOAL} tone="sky" className="mt-1" />
            </div>
          </div>
        </div>

        <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto" aria-label="Screens">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.id)}
              aria-current={screen === n.id ? 'page' : undefined}
              className={`shrink-0 border-b-2 px-3 py-2 text-xs tracking-[0.12em] uppercase transition-colors ${
                screen === n.id ? 'border-signal text-signal' : 'border-transparent text-sand-dim hover:text-sand'
              }`}
            >
              {n.label}
              {n.id === 'boss' && save.activeBoss && <span className="ml-1 text-rust">●</span>}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}

function Antenna() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-signal" aria-hidden>
      <path d="M12 10v12M8 22h8M12 10l-4 12M12 10l4 12" />
      <circle cx="12" cy="8" r="1.6" fill="currentColor" />
      <path d="M7.8 4.5a6 6 0 0 0 0 7M16.2 4.5a6 6 0 0 1 0 7M5 2a10 10 0 0 0 0 12M19 2a10 10 0 0 1 0 12" />
    </svg>
  )
}
