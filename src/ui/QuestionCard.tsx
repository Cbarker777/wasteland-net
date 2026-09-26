import { SKILL_INFO, type Question } from '../data/pool'

const LETTERS = ['A', 'B', 'C', 'D']

/**
 * One pool question. In study mode `revealed` shows right/wrong; in the boss
 * battle it stays false and only the selection is shown, like the real exam.
 */
export function QuestionCard({
  q,
  selected,
  revealed,
  onSelect,
  tag,
}: {
  q: Question
  selected: number | null
  revealed: boolean
  onSelect: (choice: number) => void
  tag?: React.ReactNode
}) {
  return (
    <article>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="rounded-sm bg-panel-2 px-2 py-0.5 text-xs text-signal ring-1 ring-line">{q.id}</span>
        <span className="label">{SKILL_INFO[q.subelement].label}</span>
        {q.refs && <span className="label !text-static">§ {q.refs}</span>}
        {tag && <span className="ml-auto">{tag}</span>}
      </div>

      <p className="mb-5 font-read text-lg leading-relaxed text-sand">{q.question}</p>

      {q.figure && (
        <figure className="mb-5 rounded-sm bg-[#f4efe4] p-3">
          <img src={`figures/${q.figure}.png`} alt={`Figure ${q.figure} from the question pool`} className="mx-auto max-h-80 w-auto" />
        </figure>
      )}

      <ol className="grid gap-2">
        {q.answers.map((text, i) => {
          const isSel = selected === i
          const isRight = i === q.correct
          let cls = 'border-line hover:border-signal-dim hover:bg-panel-2'
          if (revealed) {
            if (isRight) cls = 'border-rad bg-rad-dim/30 text-sand'
            else if (isSel) cls = 'border-rust bg-rust-dim/30 text-sand-dim'
            else cls = 'border-line opacity-60'
          } else if (isSel) cls = 'border-signal bg-signal/15 ring-1 ring-signal'
          return (
            <li key={i}>
              <button
                type="button"
                disabled={revealed}
                onClick={() => onSelect(i)}
                aria-pressed={isSel}
                className={`flex w-full items-start gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors disabled:cursor-default ${cls}`}
              >
                <span className={`mt-0.5 w-5 shrink-0 font-bold ${revealed && isRight ? 'text-rad' : revealed && isSel ? 'text-rust' : 'text-signal'}`}>{LETTERS[i]}</span>
                <span className="font-read leading-snug">{text}</span>
                {revealed && isRight && <span className="ml-auto shrink-0 text-xs text-rad">✓ CORRECT</span>}
                {revealed && isSel && !isRight && <span className="ml-auto shrink-0 text-xs text-rust">✗ YOUR CALL</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </article>
  )
}
