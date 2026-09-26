import { useCallback, useEffect, useState } from 'react'
import { POOLS, QUESTIONS_BY_ID, skillInfo } from '../data/pool'
import { passMarkFor, type BossOutcome } from '../game/save'
import { useGame } from '../store'
import { Button, Meter, Panel } from '../ui/kit'
import { keyToChoice, pct } from '../ui/util'
import { QuestionCard } from '../ui/QuestionCard'

export function Boss() {
  const active = useGame((s) => s.save.activeBoss)
  const go = useGame((s) => s.go)
  const [result, setResult] = useState<{ outcome: BossOutcome; ids: string[]; answers: (number | null)[] } | null>(null)

  if (result)
    return (
      <BossResult
        {...result}
        onDone={() => {
          // A mini boss is launched from Skills, so that's where it returns.
          if (result.outcome.subelement) go('skills')
          setResult(null)
        }}
      />
    )
  if (active) return <Battle onFinish={setResult} />
  return <BossLobby />
}

function BossLobby() {
  const poolId = useGame((s) => s.save.pool)
  const allHistory = useGame((s) => s.save.bossHistory)
  const history = allHistory.filter((b) => b.pool === poolId)
  const pool = POOLS[poolId]
  const start = useGame((s) => s.startBoss)
  const best = history.length ? Math.max(...history.map((b) => b.correct)) : null
  const passes = history.filter((b) => b.passed).length

  return (
    <div className="grid gap-4 md:grid-cols-5">
      <Panel title={`The Examiner · ${pool.name}`} className="md:col-span-3">
        <p className="font-read leading-relaxed text-sand">
          A volunteer-examiner automaton still guards the old relay tower, and it answers to nobody. It asks {pool.examLength} questions: one from every question group, the
          same spread as the real Element {pool.element} exam. You see no score until you submit. Land {pool.passMark} hits to bring it down.
        </p>
        <ul className="mt-4 grid grid-cols-5 gap-2 text-center text-xs">
          {pool.subelements.map((se) => (
            <li key={se.id} className="rounded-sm bg-dust/60 py-2 ring-1 ring-line" title={skillInfo(se.id).label}>
              <div className="text-signal">{se.id}</div>
              <div className="text-sand-dim">×{se.examQuestions}</div>
            </li>
          ))}
        </ul>
        <Button variant="primary" onClick={start} className="mt-5">
          Engage the Examiner
        </Button>
      </Panel>

      <Panel title={`${pool.name} battle record`} right={history.length ? `${passes}/${history.length} won` : undefined} className="md:col-span-2">
        {history.length === 0 ? (
          <p className="text-sm text-sand-dim">No battles yet. Your first fight shows where you really stand.</p>
        ) : (
          <>
            <div className="mb-3 text-sm text-sand-dim">
              Best: <span className="text-signal">
                {best}/{pool.examLength}
              </span>
            </div>
            <ol className="grid gap-1.5 text-sm">
              {history
                .slice(-8)
                .reverse()
                .map((b, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-static">{b.date}</span>
                    <Meter value={b.correct} max={b.total} tone={b.passed ? 'rad' : 'rust'} className="flex-1" />
                    <span className={`w-16 text-right ${b.passed ? 'text-rad' : 'text-rust'}`}>{b.correct}/{b.total}</span>
                  </li>
                ))}
            </ol>
          </>
        )}
      </Panel>
    </div>
  )
}

function Battle({ onFinish }: { onFinish: (r: { outcome: BossOutcome; ids: string[]; answers: (number | null)[] }) => void }) {
  const boss = useGame((s) => s.save.activeBoss)!
  const pool = POOLS[boss.pool]
  const examLength = boss.ids.length
  const answer = useGame((s) => s.answerBoss)
  const submit = useGame((s) => s.submitBoss)
  const abandon = useGame((s) => s.abandonBoss)
  const [i, setI] = useState(() => Math.max(0, boss.answers.findIndex((a) => a === null)))
  const [confirming, setConfirming] = useState<'submit' | 'retreat' | null>(null)
  const answered = boss.answers.filter((a) => a !== null).length
  const q = QUESTIONS_BY_ID.get(boss.ids[i])!

  const choose = useCallback(
    (c: number) => {
      answer(i, c)
      setConfirming(null)
    },
    [answer, i],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowRight') setI((x) => Math.min(examLength - 1, x + 1))
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1))
      else {
        const c = keyToChoice(e.key)
        if (c !== null) choose(c)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choose, examLength])

  const doSubmit = () => {
    const snapshot = { ids: boss.ids, answers: boss.answers }
    onFinish({ outcome: submit(), ...snapshot })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_16rem]">
      <Panel
        title={
          boss.subelement
            ? `${skillInfo(boss.subelement).miniBoss} · ${boss.subelement} mini boss · Question ${i + 1} of ${examLength}`
            : `${pool.name} boss battle · Question ${i + 1} of ${examLength}`
        }
        right={`${answered}/${examLength} answered · pass ${passMarkFor(boss)}`}
      >
        <QuestionCard q={q} selected={boss.answers[i]} revealed={false} onSelect={choose} />
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setI(i - 1)} disabled={i === 0}>
            ← Prev
          </Button>
          <Button onClick={() => setI(i + 1)} disabled={i === examLength - 1} variant={boss.answers[i] !== null ? 'primary' : 'ghost'}>
            Next →
          </Button>
          <span className="label ml-auto self-center !text-static">1–4 / A–D answer · ←/→ move</span>
        </div>
      </Panel>

      <Panel title="Question map">
        <div className="grid grid-cols-10 gap-1 lg:grid-cols-5">
          {boss.ids.map((id, n) => (
            <button
              key={id}
              onClick={() => setI(n)}
              aria-label={`Question ${n + 1}${boss.answers[n] === null ? ', unanswered' : ''}`}
              className={`h-7 rounded-[2px] text-[10px] ${
                n === i ? 'bg-signal text-dust' : boss.answers[n] !== null ? 'bg-signal-dim/50 text-sand' : 'bg-dust text-static ring-1 ring-line'
              }`}
            >
              {n + 1}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          {confirming === 'submit' ? (
            <div className="rounded-sm border border-signal-dim p-2 text-xs">
              {examLength - answered} unanswered. They count as misses.
              <div className="mt-2 flex gap-2">
                <Button variant="primary" onClick={doSubmit} className="!px-2 !py-1 !text-xs">
                  Submit
                </Button>
                <Button onClick={() => setConfirming(null)} className="!px-2 !py-1 !text-xs">
                  Keep going
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="primary" onClick={() => (answered < examLength ? setConfirming('submit') : doSubmit())}>
              Submit for scoring
            </Button>
          )}
          {confirming === 'retreat' ? (
            <div className="rounded-sm border border-rust-dim p-2 text-xs">
              Retreat and discard this battle?
              <div className="mt-2 flex gap-2">
                <Button variant="danger" onClick={abandon} className="!px-2 !py-1 !text-xs">
                  Retreat
                </Button>
                <Button onClick={() => setConfirming(null)} className="!px-2 !py-1 !text-xs">
                  Stay
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" onClick={() => setConfirming('retreat')}>
              Retreat
            </Button>
          )}
        </div>
      </Panel>
    </div>
  )
}

function BossResult({ outcome, ids, answers, onDone }: { outcome: BossOutcome; ids: string[]; answers: (number | null)[]; onDone: () => void }) {
  const { score, passMark, subelement } = outcome
  const pool = POOLS[outcome.pool]
  const [showMissed, setShowMissed] = useState(false)
  const hp = Math.max(0, passMark - score.correct)
  const enemy = subelement ? skillInfo(subelement).miniBoss : 'The Examiner'
  const passRatio = passMark / score.total

  // Mini bosses break down by question group; full battles by sub-element.
  const rows = subelement
    ? POOLS[outcome.pool].subelements
        .find((s) => s.id === subelement)!
        .groups.map((g) => {
          const idx = ids.map((id, i) => (id.startsWith(g.id) ? i : -1)).filter((i) => i >= 0)
          return { id: g.id, label: g.title, correct: idx.filter((i) => answers[i] === QUESTIONS_BY_ID.get(ids[i])!.correct).length, total: idx.length }
        })
        .filter((r) => r.total > 0)
    : pool.subelements.map(({ id }) => ({ id, label: skillInfo(id).label, ...score.bySubelement[id]! }))

  return (
    <div className="grid gap-4">
      <Panel title={subelement ? `${enemy} · ${subelement} ${skillInfo(subelement).label} · report` : `${pool.name} battle report`}>
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className={`text-5xl font-bold ${score.passed ? 'text-rad glow-rad' : 'text-rust'}`}>{score.passed ? 'PASS' : 'FAIL'}</div>
            <div className="mt-1 text-sm text-sand-dim">
              {score.correct}/{score.total} correct ({pct(score.correct, score.total)}%) · pass mark {passMark}
            </div>
          </div>
          <div className="min-w-56 flex-1">
            <div className="label mb-1">{enemy} integrity</div>
            <Meter value={hp} max={passMark} tone="rust" className="!h-4" />
            <div className="mt-1 text-xs text-sand-dim">
              {score.passed
                ? score.correct === score.total
                  ? 'Flawless. Not a single miss.'
                  : subelement
                    ? `${enemy} is down. This sub-element is holding up.`
                    : 'The Examiner is down. You would pass the real thing today.'
                : `${hp} more correct answer${hp === 1 ? '' : 's'} would have brought it down.`}
            </div>
          </div>
          <div className="text-sm text-sand">
            +{outcome.xp} XP · +{outcome.supplies} supplies · +{outcome.scrap} scrap
          </div>
        </div>
      </Panel>

      <Panel title={subelement ? 'By question group' : 'By sub-element'}>
        <ul className={`grid gap-2 ${subelement ? '' : 'sm:grid-cols-2'}`}>
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-3 text-sm">
              <span className={`${subelement ? 'w-10' : 'w-7'} text-signal`}>{row.id}</span>
              <span className={`${subelement ? 'min-w-0 flex-[2]' : 'w-44'} truncate text-xs text-sand-dim`} title={row.label}>
                {row.label}
              </span>
              <Meter value={row.correct} max={row.total} tone={row.correct === row.total ? 'rad' : row.correct / row.total >= passRatio ? 'signal' : 'rust'} className="flex-1" />
              <span className="w-10 text-right">
                {row.correct}/{row.total}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      {score.missed.length > 0 && (
        <Panel title={`Missed (${score.missed.length})`} right="Now at the front of your study queue">
          {showMissed ? (
            <ul className="grid gap-4">
              {score.missed.map((id) => {
                const q = QUESTIONS_BY_ID.get(id)!
                const yours = answers[ids.indexOf(id)]
                return (
                  <li key={id} className="border-b border-line pb-3 last:border-0">
                    <div className="text-xs text-signal">{id}</div>
                    <p className="font-read mt-1 text-sand">{q.question}</p>
                    {q.figure && <p className="text-xs text-static">(Refers to Figure {q.figure})</p>}
                    <p className="mt-1 text-sm text-rad">
                      ✓ {'ABCD'[q.correct]}. {q.answers[q.correct]}
                    </p>
                    <p className="text-sm text-rust">{yours === null ? '✗ Unanswered' : `✗ ${'ABCD'[yours]}. ${q.answers[yours]}`}</p>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Button onClick={() => setShowMissed(true)}>Review misses</Button>
          )}
        </Panel>
      )}

      <div>
        <Button variant="primary" onClick={onDone}>
          {outcome.subelement ? 'Back to skills' : 'Back to the tower'}
        </Button>
      </div>
    </div>
  )
}
