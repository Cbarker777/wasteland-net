import { POOLS, skillInfo, subelementIds } from '../data/pool'
import { skillBreakdown, SKILL_MAX_LEVEL } from '../game/progression'
import { MINI_LENGTH } from '../game/config'
import { IDS_BY_SUBELEMENT } from '../game/save'
import { useGame } from '../store'
import { Button, Panel, Segments } from '../ui/kit'
import { pct } from '../ui/util'

export function Skills() {
  const cards = useGame((s) => s.save.cards)
  const pool = useGame((s) => s.save.pool)
  const go = useGame((s) => s.go)
  const minis = useGame((s) => s.save.miniBosses)
  const activeBoss = useGame((s) => s.save.activeBoss)
  const startMini = useGame((s) => s.startMiniBoss)
  const rows = subelementIds(pool).map((se) => ({ se, ...skillBreakdown(IDS_BY_SUBELEMENT[se], cards) }))
  // The three least-mastered unmaxed skills, once there's progress to compare.
  const weakSpots = new Set(
    rows.some((r) => r.mastery > 0)
      ? rows
          .filter((r) => r.level < SKILL_MAX_LEVEL)
          .sort((a, b) => a.mastery - b.mastery || b.seen - a.seen)
          .slice(0, 3)
          .map((r) => r.se)
      : [],
  )

  return (
    <div className="grid gap-4">
      <Panel title={`${POOLS[pool].name} skill trees`} right="Level 10 = every question in long-term review">
        <p className="mb-3 text-xs text-static">
          Drill to practice with feedback. Fight a mini boss for a {MINI_LENGTH}-question test on one sub-element with no feedback until the end.
          {activeBoss && ' Finish your current battle before starting a mini boss.'}
        </p>
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-sand-dim">
          <Legend cls="bg-static/60" label="Unseen" />
          <Legend cls="bg-signal" label="Training" />
          <Legend cls="bg-sky" label="Medium-term" />
          <Legend cls="bg-rad" label="Long-term" />
        </div>
        <ul className="grid gap-5">
          {rows.map((r) => {
            const weak = weakSpots.has(r.se)
            return (
              <li key={r.se} className="grid gap-2 md:grid-cols-[minmax(0,16rem)_1fr_auto] md:items-center md:gap-5">
                <div>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-signal">{r.se}</span>
                    <span className="text-sm">{skillInfo(r.se).label}</span>
                    {weak && <span className="label whitespace-nowrap !text-rust">Weak spot</span>}
                    {r.level === SKILL_MAX_LEVEL && <span className="label !text-rad">Maxed</span>}
                  </div>
                  <div className="text-xs text-static">{skillInfo(r.se).flavor}</div>
                  <MiniRecordLine name={skillInfo(r.se).miniBoss} record={minis[r.se]} />
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
                <div className="flex gap-2 justify-self-start">
                  <Button onClick={() => go('study', r.se)}>Drill</Button>
                  <Button variant="danger" disabled={!!activeBoss} onClick={() => startMini(r.se)}>
                    Mini boss
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>
    </div>
  )
}

function MiniRecordLine({ name, record }: { name: string; record?: { attempts: number; wins: number; best: number; total: number } }) {
  if (!record) return <div className="mt-1 text-[11px] text-static">Mini boss: {name}</div>
  return (
    <div className="mt-1 text-[11px]">
      {record.wins > 0 ? (
        <span className="text-rad">✓ {name} defeated</span>
      ) : (
        <span className="text-rust">✗ {name} undefeated</span>
      )}
      <span className="text-static">
        {' '}
        · best {record.best}/{record.total} · {record.wins}/{record.attempts} won
      </span>
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
