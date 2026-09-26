import { SCRAP_BOSS_PASS, SCRAP_CORRECT, SUPPLIES_CORRECT, SUPPLIES_RECOVERY_BONUS } from '../game/config'
import { MAX_STRUCTURE_LEVEL, nextCost, perks, STRUCTURES } from '../game/outpost'
import { dailyDecay } from '../game/supplies'
import { useGame } from '../store'
import { Button, Panel } from '../ui/kit'
import { OutpostScene } from '../ui/OutpostScene'

export function OutpostScreen() {
  const save = useGame((s) => s.save)
  const build = useGame((s) => s.build)
  const p = perks(save.outpost)

  return (
    <div className="grid gap-4">
      <Panel title="Outpost" right={`${save.scrap.toLocaleString()} scrap`}>
        <div className="overflow-hidden rounded-sm ring-1 ring-line">
          <OutpostScene outpost={save.outpost} powered={save.supplies.amount > 0} labels />
        </div>
        <p className="mt-3 text-xs text-static">
          Correct answers bring back Scrap. Spend it here to build and upgrade. Scrap never decays, and building never costs Supplies.
        </p>
      </Panel>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STRUCTURES.map((s) => {
          const level = save.outpost[s.id]
          const cost = nextCost(save.outpost, s.id)
          const short = cost !== null ? cost - save.scrap : 0
          return (
            <li key={s.id} className="panel flex flex-col rounded-sm p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className={level ? 'text-signal' : 'text-sand'}>{s.name}</h3>
                <span className="flex gap-1" aria-label={`Level ${level} of ${MAX_STRUCTURE_LEVEL}`}>
                  {Array.from({ length: MAX_STRUCTURE_LEVEL }, (_, i) => (
                    <span key={i} className={`h-2 w-4 rounded-[1px] ${i < level ? 'bg-signal' : 'bg-dust ring-1 ring-line'}`} />
                  ))}
                </span>
              </div>
              <p className="mt-1 text-xs text-static italic">{s.flavor}</p>
              <dl className="mt-3 grid gap-1 text-xs">
                <div className="flex gap-2">
                  <dt className="w-10 shrink-0 text-sand-dim">Now</dt>
                  <dd className={level ? 'text-rad' : 'text-static'}>{level ? s.effect(level) : 'Not built'}</dd>
                </div>
                {level < MAX_STRUCTURE_LEVEL && (
                  <div className="flex gap-2">
                    <dt className="w-10 shrink-0 text-sand-dim">Next</dt>
                    <dd className="text-sand">{s.effect(level + 1)}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-auto pt-4">
                {cost === null ? (
                  <div className="label !text-rad">Max level</div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <Button variant={short <= 0 ? 'primary' : 'ghost'} disabled={short > 0} onClick={() => build(s.id)}>
                      {level ? 'Upgrade' : 'Build'} · {cost} scrap
                    </Button>
                    {short > 0 && <span className="text-xs text-static">Need {short} more</span>}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <Panel title="Active perks">
        <ul className="grid gap-1 text-sm text-sand-dim sm:grid-cols-2">
          <li>
            Supplies decay: <span className="text-sand">{dailyDecay(save.supplies.amount, p.decayMultiplier)}/day</span>
            {p.decayMultiplier < 1 && <span className="text-rad"> ({Math.round((1 - p.decayMultiplier) * 100)}% slower)</span>}
          </li>
          <li>
            Per correct answer: <span className="text-sand">+{SUPPLIES_CORRECT + p.suppliesPerCorrect} Supplies, +{SCRAP_CORRECT + p.scrapPerCorrect} Scrap</span>
          </li>
          <li>
            Fixing a missed question: <span className="text-sand">+{SUPPLIES_RECOVERY_BONUS + p.recoveryBonus} Supplies</span>
          </li>
          <li>
            First correct answer each day: <span className="text-sand">{p.dailyCharge ? `+${p.dailyCharge} Supplies` : '—'}</span>
          </li>
          <li>
            Passing a boss battle: <span className="text-sand">+{SCRAP_BOSS_PASS + p.bossPassScrap} Scrap</span>
          </li>
        </ul>
      </Panel>
    </div>
  )
}
