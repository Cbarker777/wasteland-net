import { BADGES, type Badge } from '../game/badges'
import { EXAM_LENGTH, EXAM_PASS, SURVIVOR_DAYS } from '../game/config'
import { skillBreakdown, SKILL_MAX_LEVEL } from '../game/progression'
import { IDS_BY_SUBELEMENT, type Save } from '../game/save'
import { longestStreak } from '../game/streak'
import { survivorDays } from '../game/supplies'
import { today, useGame } from '../store'
import { Meter, Panel } from '../ui/kit'

const SECTIONS: { kind: Badge['kind']; title: string }[] = [
  { kind: 'streak', title: 'Study streak' },
  { kind: 'boss', title: 'Boss battle' },
  { kind: 'survivor', title: 'Survival' },
  { kind: 'mastery', title: 'Skill mastery' },
]

function progress(b: Badge, save: Save): [number, number] {
  switch (b.kind) {
    case 'streak':
      return [Math.min(longestStreak(save.days), b.streakDays!), b.streakDays!]
    case 'boss': {
      const best = save.bossHistory.length ? Math.max(...save.bossHistory.map((x) => x.correct)) : 0
      return [best, b.id === 'boss-perfect' ? EXAM_LENGTH : EXAM_PASS]
    }
    case 'mastery':
      return [skillBreakdown(IDS_BY_SUBELEMENT[b.subelement!], save.cards).level, SKILL_MAX_LEVEL]
    case 'survivor':
      return [Math.min(survivorDays(save.supplies, today()), SURVIVOR_DAYS), SURVIVOR_DAYS]
  }
}

export function Badges() {
  const save = useGame((s) => s.save)
  const earnedCount = BADGES.filter((b) => save.badges[b.id]).length

  return (
    <div className="grid gap-4">
      <p className="text-sm text-sand-dim">
        {earnedCount} of {BADGES.length} badges earned. Once you earn a badge, you keep it.
      </p>
      {SECTIONS.map((sec) => (
        <Panel key={sec.kind} title={sec.title}>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BADGES.filter((b) => b.kind === sec.kind).map((b) => {
              const earned = save.badges[b.id]
              const [n, max] = progress(b, save)
              return (
                <li key={b.id} className={`flex gap-3 rounded-sm p-3 ring-1 ${earned ? 'bg-panel-2 ring-signal-dim' : 'bg-dust/50 ring-line'}`}>
                  <div
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
                      earned ? 'border-signal text-signal glow' : 'border-line text-static'
                    }`}
                    aria-hidden
                  >
                    {b.glyph}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm ${earned ? 'text-signal' : 'text-sand-dim'}`}>{b.name}</div>
                    <div className="text-xs text-static">{b.description}</div>
                    {earned ? (
                      <div className="mt-1 text-[11px] text-rad">Earned {earned}</div>
                    ) : (
                      <div className="mt-1.5 flex items-center gap-2">
                        <Meter value={n} max={max} tone="static" className="!h-1.5" />
                        <span className="shrink-0 text-[11px] text-static">
                          {n}/{max}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Panel>
      ))}
    </div>
  )
}
