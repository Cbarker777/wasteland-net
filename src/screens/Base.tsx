import { SKILL_INFO, SUBELEMENT_ORDER } from '../data/pool'
import { DAILY_GOAL, EXAM_PASS } from '../game/config'
import { rankFor, RANKS, skillBreakdown, SKILL_MAX_LEVEL } from '../game/progression'
import { ALL_IDS, IDS_BY_SUBELEMENT } from '../game/save'
import { dueCount } from '../game/srs'
import { currentStreak } from '../game/streak'
import { dailyDecay, daysOfSupplies } from '../game/supplies'
import { today, useGame } from '../store'
import { Button, Meter, Panel, Segments } from '../ui/kit'

export function Base() {
  const save = useGame((s) => s.save)
  const go = useGame((s) => s.go)
  const t = today()
  const r = rankFor(save.xp)
  const due = dueCount(ALL_IDS, save.cards, t)
  const learning = Object.values(save.cards).filter((c) => c.stage === 'learning').length
  const unseen = ALL_IDS.length - Object.keys(save.cards).length
  const skills = SUBELEMENT_ORDER.map((se) => ({ se, ...skillBreakdown(IDS_BY_SUBELEMENT[se], save.cards) }))
  const weakest = skills.filter((s) => s.level < SKILL_MAX_LEVEL).sort((a, b) => a.mastery - b.mastery).slice(0, 3)
  const lastBoss = save.bossHistory.at(-1)
  const bestBoss = save.bossHistory.length ? Math.max(...save.bossHistory.map((b) => b.correct)) : null
  const streak = currentStreak(save.days, t)
  const todayCount = save.days[t] ?? 0

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <Panel title="Survivor" right={`Rank ${r.index + 1} of ${RANKS.length}`} className="md:col-span-3">
        <div className="text-3xl font-bold text-signal glow">{r.rank.name.toUpperCase()}</div>
        <p className="mt-1 text-sm text-sand-dim italic">{r.rank.flavor}</p>
        <div className="mt-4 flex items-baseline justify-between text-xs text-sand-dim">
          <span>{save.xp.toLocaleString()} XP</span>
          <span>{r.next ? `${(r.next.minXp - save.xp).toLocaleString()} XP to ${r.next.name}` : 'Top rank reached'}</span>
        </div>
        <Meter value={r.intoRank} max={r.rankSpan ?? 1} className="mt-1 !h-3" />
        <ol className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tracking-wider uppercase">
          {RANKS.map((rank, i) => (
            <li key={rank.id} className={i < r.index ? 'text-signal-dim' : i === r.index ? 'text-signal' : 'text-static'}>
              {i > 0 && <span className="mr-3 text-line">›</span>}
              {rank.name}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Supplies" className="md:col-span-2">
        {save.supplies.amount === 0 ? (
          <div className="flicker">
            <div className="text-2xl font-bold text-rust">LOW POWER</div>
            <p className="mt-1 text-sm text-sand-dim">
              Stockpile is empty and the radio is on reserve cells. Nothing is lost. Answer a few questions to restock and power back up.
            </p>
          </div>
        ) : (
          <>
            <div className="text-3xl font-bold text-rad glow-rad">{save.supplies.amount.toLocaleString()}</div>
            <p className="mt-1 text-sm text-sand-dim">
              Losing {dailyDecay(save.supplies.amount)} per day. Lasts about {daysOfSupplies(save.supplies.amount)} days without study.
            </p>
          </>
        )}
        <p className="mt-3 text-xs text-static">Correct answers restock supplies, and fixing a question you missed pays a bonus. Wrong answers never cost supplies.</p>
      </Panel>

      <Panel title="Scavenge run" className="md:col-span-3">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat n={due} label="Reviews due" tone="text-rad" />
          <Stat n={learning} label="In training" tone="text-signal" />
          <Stat n={unseen} label="Unseen" tone="text-sky" />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={() => go('study', 'all')}>
            Start scavenging
          </Button>
          <span className="text-xs text-sand-dim">
            Today: {todayCount}/{DAILY_GOAL} for the streak · {streak} day streak
          </span>
        </div>
      </Panel>

      <Panel title="Weak spots" className="md:col-span-2">
        {skills.every((s) => s.mastery === 0) ? (
          <p className="text-sm text-sand-dim">No field data yet. Answer some questions and your weakest sub-elements show up here.</p>
        ) : weakest.length === 0 ? (
          <p className="text-sm text-rad">Every skill is maxed. The wasteland has nothing left to teach you.</p>
        ) : (
          <ul className="grid gap-3">
            {weakest.map((s) => (
              <li key={s.se}>
                <button onClick={() => go('study', s.se)} className="group w-full text-left">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="group-hover:text-signal">
                      {s.se} · {SKILL_INFO[s.se].label}
                    </span>
                    <span className="text-sand-dim">Lv {s.level}</span>
                  </div>
                  <Segments value={s.level} max={SKILL_MAX_LEVEL} tone="rust" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-static">Select a skill to drill just that sub-element.</p>
      </Panel>

      <Panel title="Boss battle" className="md:col-span-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1 text-sm text-sand-dim">
            {save.activeBoss ? (
              <span className="text-rust">A battle with the Examiner is in progress.</span>
            ) : lastBoss ? (
              <>
                Last fight: <span className={lastBoss.passed ? 'text-rad' : 'text-rust'}>{lastBoss.correct}/50 ({lastBoss.passed ? 'PASS' : 'FAIL'})</span> · Best: {bestBoss}/50 · Pass mark: {EXAM_PASS}
              </>
            ) : (
              <>A full 50-question Extra exam, distributed across the sub-elements like the real one. Score {EXAM_PASS} or better to pass.</>
            )}
          </div>
          <Button variant={save.activeBoss ? 'danger' : 'ghost'} onClick={() => go('boss')}>
            {save.activeBoss ? 'Resume battle' : 'Face the Examiner'}
          </Button>
        </div>
      </Panel>
    </div>
  )
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="rounded-sm bg-dust/60 py-3 ring-1 ring-line">
      <div className={`text-2xl font-bold ${tone}`}>{n}</div>
      <div className="label mt-1">{label}</div>
    </div>
  )
}
