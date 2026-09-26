import { Fragment, useRef, useState } from 'react'
import { POOL_ORDER, POOLS } from '../data/pool'
import {
  DAILY_GOAL,
  GRADUATE_STREAK,
  LONG_FIRST_DAYS,
  MEDIUM_INTERVALS_DAYS,
  MISS_REQUEUE_MAX,
  MISS_REQUEUE_MIN,
  SCRAP_CORRECT,
  SUPPLIES_CORRECT,
  SUPPLIES_DECAY_FLAT,
  SUPPLIES_DECAY_PERCENT,
  SUPPLIES_RECOVERY_BONUS,
  XP_CORRECT,
} from '../game/config'
import { IDS_BY_POOL } from '../game/save'
import { longestStreak } from '../game/streak'
import { today, useGame } from '../store'
import { Button, Panel } from '../ui/kit'
import { pct } from '../ui/util'

export function Log() {
  const save = useGame((s) => s.save)
  const importSave = useGame((s) => s.importSave)
  const resetSave = useGame((s) => s.resetSave)
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [resetText, setResetText] = useState('')

  const cards = Object.values(save.cards)
  const seen = cards.reduce((n, c) => n + c.seen, 0)
  const correct = cards.reduce((n, c) => n + c.correct, 0)

  const exportSave = () => {
    const blob = new Blob([JSON.stringify(save)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `wasteland-net-save-${today()}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      importSave(await file.text())
      setMsg('Save loaded.')
    } catch (e) {
      setMsg(`Could not load that file: ${(e as Error).message}`)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Service record">
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-sand-dim">Answers logged</dt>
          <dd>{seen.toLocaleString()}</dd>
          <dt className="text-sand-dim">Accuracy</dt>
          <dd>{seen ? `${pct(correct, seen)}%` : '—'}</dd>
          {POOL_ORDER.map((p) => (
            <Fragment key={p}>
              <dt className="text-sand-dim">{POOLS[p].name} seen</dt>
              <dd>
                {IDS_BY_POOL[p].filter((id) => save.cards[id]).length} / {POOLS[p].questions.length}
              </dd>
            </Fragment>
          ))}
          <dt className="text-sand-dim">Longest streak</dt>
          <dd>{longestStreak(save.days)} days</dd>
          <dt className="text-sand-dim">Boss battles</dt>
          <dd>{save.bossHistory.length}</dd>
          <dt className="text-sand-dim">On the air since</dt>
          <dd>{save.createdAt}</dd>
        </dl>
        <p className="mt-4 text-xs text-static">
          Question pools: {POOL_ORDER.map((p) => POOLS[p].version).join('; ')}. Source: NCVEC, public domain.
        </p>
      </Panel>

      <Panel title="Save file">
        <p className="text-sm text-sand-dim">
          Progress is saved in this browser only. To move it to another device or keep a backup, export it here and import it on the other device.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={exportSave}>Export save</Button>
          <Button onClick={() => fileRef.current?.click()}>Import save</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
        </div>
        {msg && <p className="mt-2 text-xs text-signal">{msg}</p>}
        <div className="mt-5 border-t border-line pt-3">
          <label className="label" htmlFor="reset">
            Wipe progress: type RESET
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="reset"
              value={resetText}
              onChange={(e) => setResetText(e.target.value)}
              className="w-32 rounded-sm border border-line bg-dust px-2 py-1 text-sm"
              autoComplete="off"
            />
            <Button
              variant="danger"
              disabled={resetText !== 'RESET'}
              onClick={() => {
                resetSave()
                setResetText('')
              }}
            >
              Wipe
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Field manual" className="md:col-span-2">
        <div className="grid gap-4 text-sm leading-relaxed text-sand-dim md:grid-cols-2">
          <Rule title="Scavenging (study)">
            A missed question comes back within {MISS_REQUEUE_MIN}–{MISS_REQUEUE_MAX} questions. Answer it {GRADUATE_STREAK} times in a row to move it to the
            medium-term pool (reviews after {MEDIUM_INTERVALS_DAYS.join(' and ')} days). Keep getting it right and it goes to the long-term cache, where it resurfaces
            about every {LONG_FIRST_DAYS}+ days. A miss at any point sends it back to training.
          </Rule>
          <Rule title="Rank and skills">
            Every correct answer earns {XP_CORRECT} XP, plus a bonus when a question moves up a pool. XP sets your survivor rank. Each sub-element is its own skill
            that levels up as its questions move into long-term review. It reaches level 10 when every question is there.
          </Rule>
          <Rule title="Supplies">
            You lose {SUPPLIES_DECAY_FLAT} + {SUPPLIES_DECAY_PERCENT * 100}% of your stockpile every day. Correct answers add {SUPPLIES_CORRECT}. Answering a question you
            previously missed adds {SUPPLIES_RECOVERY_BONUS} more. Wrong answers cost nothing. At zero the radio drops to low power until you study again. That's all
            that happens.
          </Rule>
          <Rule title="Outpost">
            Every correct answer also brings back {SCRAP_CORRECT} Scrap, with more when a question moves up a pool or you pass a boss battle. Scrap never decays.
            Spend it on the Outpost screen. Each structure has 3 levels and a small perk that adjusts Supplies or Scrap. None of them make questions easier.
          </Rule>
          <Rule title="Boss battle">
            One question from each question group, matching the real exam:{' '}
            {POOL_ORDER.map((p) => `${POOLS[p].name} is ${POOLS[p].examLength} questions with ${POOLS[p].passMark} to pass`).join(', ')}. Misses go straight into
            your study queue. XP, rank, Supplies, and streaks are shared
            across pools; skills, boss battles, and mastery badges belong to the pool you pick on Base. A day
            counts toward your streak once you answer {DAILY_GOAL} questions.
          </Rule>
        </div>
      </Panel>
    </div>
  )
}

function Rule({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1 text-signal">{title}</h3>
      <p>{children}</p>
    </div>
  )
}
