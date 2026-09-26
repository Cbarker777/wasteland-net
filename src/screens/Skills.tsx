import { SKILL_INFO, SUBELEMENT_ORDER } from '../data/pool'
import { skillBreakdown, SKILL_MAX_LEVEL } from '../game/progression'
import { IDS_BY_SUBELEMENT } from '../game/save'
import { useGame } from '../store'
import { Button, Panel, Segments } from '../ui/kit'
import { pct } from '../ui/util'

export function Skills() {
  const cards = useGame((s) => s.save.cards)
  const go = useGame((s) => s.go)
  const rows = SUBELEMENT_ORDER.map((se) => ({ se, ...skillBreakdown(IDS_BY_SUBELEMENT[se], cards) }))
  const touched = rows.filter((r) => r.level < SKILL_MAX_LEVEL)
  // Weak spots only mean something once there's progress to compare.
  const weakCutoff = touched.length && rows.some((r) => r.mastery > 0) ? [...touched].sort((a, b) => a.mastery - b.mastery)[Math.min(2, touched.length - 1)].mastery : -1

  return (
    <div className="grid gap-4">
      <Panel title="Skill trees" right="Level 10 = every question in long-term review">
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-sand-dim">
          <Legend cls="bg-static/60" label="Unseen" />
          <Legend cls="bg-signal" label="Training" />
          <Legend cls="bg-sky" label="Medium-term" />
          <Legend cls="bg-rad" label="Long-term" />
        </div>
        <ul className="grid gap-5">
          {rows.map((r) => {
            const weak = r.level < SKILL_MAX_LEVEL && r.mastery <= weakCutoff
            return (
              <li key={r.se} className="grid gap-2 md:grid-cols-[minmax(0,16rem)_1fr_auto] md:items-center md:gap-5">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-signal">{r.se}</span>
                    <span className="text-sm">{SKILL_INFO[r.se].label}</span>
                    {weak && <span className="label whitespace-nowrap !text-rust">Weak spot</span>}
                    {r.level === SKILL_MAX_LEVEL && <span className="label !text-rad">Maxed</span>}
                  </div>
                  <div className="text-xs text-static">{SKILL_INFO[r.se].flavor}</div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-sand-dim">
                    <span>
                      Lv {r.level} · {Math.round(r.mastery * 100)}% mastered
                    </span>
                    <span>
                      {r.seen ? `${pct(r.correct, r.seen)}% accuracy` : 'No attempts'} · {r.total} questions
                    </span>
                  </div>
                  <Segments value={r.level} max={SKILL_MAX_LEVEL} tone={r.level === SKILL_MAX_LEVEL ? 'rad' : weak ? 'rust' : 'signal'} />
                  <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-[1px]" title={`${r.unseen} unseen · ${r.learning} training · ${r.medium} medium · ${r.long} long-term`}>
                    <span className="bg-rad" style={{ width: `${pct(r.long, r.total)}%` }} />
                    <span className="bg-sky" style={{ width: `${pct(r.medium, r.total)}%` }} />
                    <span className="bg-signal" style={{ width: `${pct(r.learning, r.total)}%` }} />
                    <span className="flex-1 bg-static/60" />
                  </div>
                </div>
                <Button onClick={() => go('study', r.se)} className="justify-self-start">
                  Drill
                </Button>
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-3 ${cls}`} />
      {label}
    </span>
  )
}
