import { useCallback, useEffect, useRef, useState } from 'react'
import { poolOf, POOLS, QUESTIONS_BY_ID, skillInfo, subelementIds } from '../data/pool'
import { GRADUATE_STREAK, MISS_REQUEUE_MAX, MISS_REQUEUE_MIN } from '../game/config'
import { skillBreakdown } from '../game/progression'
import { IDS_BY_POOL, IDS_BY_SUBELEMENT, type AnswerOutcome } from '../game/save'
import { pickNext, type Pick } from '../game/srs'
import { today, useGame, type Focus } from '../store'
import { Button, Panel } from '../ui/kit'
import { QuestionCard } from '../ui/QuestionCard'
import { keyToChoice } from '../ui/util'

export function Study() {
  const focus = useGame((s) => s.focus)
  const setFocus = useGame((s) => s.setFocus)
  const cards = useGame((s) => s.save.cards)
  const pool = useGame((s) => s.save.pool)
  const answer = useGame((s) => s.answerStudy)

  const [current, setCurrent] = useState<Pick | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null)
  const [session, setSession] = useState({ answered: 0, correct: 0 })
  const lastId = useRef<string | null>(null)

  const next = useCallback(() => {
    const { save, focus } = useGame.getState()
    // Only the selected pool: a sub-element focus from another pool falls back to the whole pool.
    const ids = focus !== 'all' && poolOf(focus) === save.pool ? IDS_BY_SUBELEMENT[focus] : IDS_BY_POOL[save.pool]
    const pick = pickNext(ids, save.cards, { step: save.step + 1, today: today(), rng: Math.random, lastId: lastId.current })
    lastId.current = pick?.id ?? null
    setCurrent(pick)
    setSelected(null)
    setOutcome(null)
  }, [])

  useEffect(next, [focus, pool, next])

  const choose = useCallback(
    (choice: number) => {
      if (!current || outcome) return
      setSelected(choice)
      const o = answer(current.id, choice)
      setOutcome(o)
      setSession((s) => ({ answered: s.answered + 1, correct: s.correct + (o.correct ? 1 : 0) }))
    },
    [current, outcome, answer],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement || e.ctrlKey || e.metaKey || e.altKey) return
      if (outcome && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        next()
        return
      }
      const c = keyToChoice(e.key)
      if (c !== null && !outcome) choose(c)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [outcome, choose, next])

  const q = current ? QUESTIONS_BY_ID.get(current.id) : undefined
  const card = current ? cards[current.id] : undefined

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="label" htmlFor="focus">
          Frequency
        </label>
        <select
          id="focus"
          value={focus}
          onChange={(e) => setFocus(e.target.value as Focus)}
          className="rounded-sm border border-line bg-panel px-2 py-1.5 text-sm text-sand"
        >
          <option value="all">All {POOLS[pool].name} sub-elements</option>
          {subelementIds(pool).map((se) => (
            <option key={se} value={se}>
              {se} · {skillInfo(se).label} (Lv {skillBreakdown(IDS_BY_SUBELEMENT[se], cards).level})
            </option>
          ))}
        </select>
        <span className="label ml-auto">
          This session: {session.correct}/{session.answered}
        </span>
      </div>

      <Panel>
        {!q || !current ? (
          <p className="text-sand-dim">No questions on this frequency.</p>
        ) : (
          <>
            <QuestionCard q={q} selected={selected} revealed={outcome !== null} onSelect={choose} tag={<KindTag pick={current} streak={card?.streak ?? 0} missed={card?.missedPending ?? false} />} />
            {outcome ? (
              <Result outcome={outcome} correctLetter={'ABCD'[q.correct]} onNext={next} />
            ) : (
              <p className="label mt-4 !text-static">Keys 1–4 or A–D to answer</p>
            )}
          </>
        )}
      </Panel>
    </div>
  )
}

function KindTag({ pick, streak, missed }: { pick: Pick; streak: number; missed: boolean }) {
  const card = useGame((s) => s.save.cards[pick.id])
  let text: string
  let cls = 'text-sand-dim'
  switch (pick.kind) {
    case 'new':
      text = 'New signal'
      cls = 'text-sky'
      break
    case 'learning':
      text = missed ? 'Requeued · missed earlier' : `Training ${streak}/${GRADUATE_STREAK}`
      cls = missed ? 'text-rust' : 'text-signal'
      break
    case 'review':
      text = card?.stage === 'long' ? 'Long-term cache check' : 'Medium-term review'
      cls = 'text-rad'
      break
    case 'early':
      text = 'Extra patrol · not due yet'
  }
  return <span className={`label ${cls}`}>{text}</span>
}

function Result({ outcome, correctLetter, onNext }: { outcome: AnswerOutcome; correctLetter: string; onNext: () => void }) {
  return (
    <div className={`mt-5 flex flex-wrap items-center gap-4 rounded-sm border p-4 ${outcome.correct ? 'border-rad-dim bg-rad-dim/15' : 'border-rust-dim bg-rust-dim/15'}`}>
      <div className="min-w-0 flex-1">
        {outcome.correct ? (
          <>
            <div className="font-bold text-rad glow-rad">SIGNAL CLEAR</div>
            <div className="mt-1 text-sm text-sand">
              +{outcome.xp} XP · +{outcome.supplies} supplies
              {outcome.recoveryBonus > 0 && <span className="text-signal"> · +{outcome.recoveryBonus} recovery bonus</span>}
            </div>
            <div className="mt-1 text-xs text-sand-dim">
              {outcome.graduated === 'medium' && '3 in a row — moved to the medium-term pool. It returns in a couple of days.'}
              {outcome.graduated === 'long' && 'Locked in — moved to the long-term cache. It will resurface now and then.'}
              {!outcome.graduated && outcome.early && 'Reviewed early — its schedule is unchanged.'}
              {!outcome.graduated && !outcome.early && outcome.streak < GRADUATE_STREAK && <Pips n={outcome.streak} />}
            </div>
          </>
        ) : (
          <>
            <div className="font-bold text-rust">STATIC ON THE LINE</div>
            <div className="mt-1 text-sm text-sand">
              Correct answer: <span className="font-bold text-rad">{correctLetter}</span>. It comes back within {MISS_REQUEUE_MIN}–{MISS_REQUEUE_MAX} questions.
            </div>
            <div className="mt-1 text-xs text-sand-dim">No supplies lost. Get it right next time for a recovery bonus.</div>
          </>
        )}
      </div>
      <Button variant="primary" onClick={onNext}>
        Next ⏎
      </Button>
    </div>
  )
}

function Pips({ n }: { n: number }) {
  return (
    <span>
      {Array.from({ length: GRADUATE_STREAK }, (_, i) => (
        <span key={i} className={i < n ? 'text-rad' : 'text-static'}>
          ●
        </span>
      ))}{' '}
      {n}/{GRADUATE_STREAK} in a row to reach the medium-term pool
    </span>
  )
}
