/**
 * Ingests the official NCVEC Amateur Extra question pool (.docx) into
 * src/data/pool.json and copies its diagrams to public/figures/.
 *
 * Source: https://www.ncvec.org/index.php/2024-2028-extra-class-question-pool-release
 * The .docx already has every errata applied (withdrawn questions are marked
 * "Question Deleted"), so this script transcribes it verbatim — it never
 * edits question text. When NCVEC issues new errata, drop the new .docx into
 * pool-source/, point SOURCE_DOCX at it, and re-run `npm run ingest:pool`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, strFromU8 } from 'fflate'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE_DOCX = 'pool-source/extra-pool-2024-2028-4th-errata-2026-02-04.docx'
const POOL_VERSION = '2024-2028 Extra pool, 4th errata (Feb 4, 2026)'

// Diagrams appear at the end of the document in figure order. The docx
// carries no captions we can read, so this ordering was checked by eye
// against the images themselves.
const FIGURE_ORDER = ['E5-1', 'E6-1', 'E6-2', 'E6-3', 'E7-1', 'E7-2', 'E7-3', 'E9-1', 'E9-2', 'E9-3']

type Subelement = { id: string; name: string; examQuestions: number; groups: { id: string; title: string }[] }
type Question = {
  id: string
  subelement: string
  group: string
  question: string
  answers: [string, string, string, string]
  correct: number
  refs?: string
  figure?: string
}

const files = unzipSync(readFileSync(join(ROOT, SOURCE_DOCX)))
const xml = strFromU8(files['word/document.xml'])

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")

const lines = xml.split('</w:p>').map((p) => {
  let text = ''
  for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)) text += m[0] === '<w:tab/>' ? ' ' : m[1]
  return decode(text).replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
})

// Skip the errata preamble: the pool proper starts at the first SUBELEMENT.
const start = lines.findIndex((l) => l.startsWith('SUBELEMENT E'))
const end = lines.findIndex((l) => l.includes('end of question pool text'))
if (start < 0 || end < 0) throw new Error('Could not locate pool boundaries in the docx')

const SUB_RE = /^SUBELEMENT (E\d) - (.+?)\s*-?\s*\[(\d+) exam questions? - (\d+) groups?\]/i
const GROUP_RE = /^(E\d[A-Z]) (.+)$/
const Q_RE = /^(E\d[A-Z]\d\d) \(([A-D])\)\s*(?:\[(.+)\])?$/
const DELETED_RE = /^(E\d[A-Z]\d\d) Question Deleted/i
const ANSWER_RE = /^([A-D])\. ?(.*)$/

const subelements = new Map<string, Subelement>()
const questions: Question[] = []
const deleted: string[] = []

for (let i = start; i < end; i++) {
  const line = lines[i]
  if (!line) continue

  const sub = SUB_RE.exec(line)
  if (sub) {
    const [, id, rawName, exam, groupCount] = sub
    const name = rawName.replace(/\s*-\s*$/, '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    const existing = subelements.get(id)
    subelements.set(id, { id, name, examQuestions: Number(exam), groups: existing?.groups ?? [] })
    if (Number(exam) !== Number(groupCount)) throw new Error(`${id}: exam questions != groups`)
    continue
  }

  const del = DELETED_RE.exec(line)
  if (del) {
    deleted.push(del[1])
    continue
  }

  const q = Q_RE.exec(line)
  if (q) {
    const [, id, letter, refs] = q
    const text: string[] = []
    const answers: string[] = []
    i++
    for (; i < end && lines[i] !== '~~'; i++) {
      const l = lines[i]
      if (!l) continue
      const a = ANSWER_RE.exec(l)
      if (a && a[1] === 'ABCD'[answers.length]) answers.push(a[2])
      else if (answers.length === 0) text.push(l)
      else answers[answers.length - 1] += ' ' + l
    }
    if (answers.length !== 4) throw new Error(`${id}: expected 4 answers, got ${answers.length}`)
    const question = text.join(' ')
    const figure = /Figure (E\d-\d)/.exec(question)?.[1]
    questions.push({
      id,
      subelement: id.slice(0, 2),
      group: id.slice(0, 3),
      question,
      answers: answers as Question['answers'],
      correct: 'ABCD'.indexOf(letter),
      ...(refs ? { refs } : {}),
      ...(figure ? { figure } : {}),
    })
    continue
  }

  const group = GROUP_RE.exec(line)
  if (group) {
    const se = subelements.get(group[1].slice(0, 2))
    if (!se) throw new Error(`Group ${group[1]} before its subelement`)
    if (!se.groups.some((g) => g.id === group[1])) se.groups.push({ id: group[1], title: group[2] })
  }
}

// ── Validation: fail loudly rather than ship a malformed pool. ──
const ids = new Set<string>()
for (const q of questions) {
  if (ids.has(q.id)) throw new Error(`Duplicate question ${q.id}`)
  ids.add(q.id)
  if (!q.question || q.answers.some((a) => !a)) throw new Error(`${q.id}: empty text`)
  if (q.figure && !FIGURE_ORDER.includes(q.figure)) throw new Error(`${q.id}: unknown figure ${q.figure}`)
}
const expectedSubs = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E0']
if ([...subelements.keys()].join() !== expectedSubs.join()) throw new Error('Unexpected subelements')
let examTotal = 0
for (const se of subelements.values()) {
  examTotal += se.examQuestions
  if (se.groups.length !== se.examQuestions) throw new Error(`${se.id}: ${se.groups.length} groups`)
  for (const g of se.groups)
    if (!questions.some((q) => q.group === g.id)) throw new Error(`Group ${g.id} has no questions`)
}
if (examTotal !== 50) throw new Error(`Exam totals ${examTotal}, expected 50`)

writeFileSync(
  join(ROOT, 'src/data/pool.json'),
  JSON.stringify({ version: POOL_VERSION, subelements: [...subelements.values()], questions }, null, 1) + '\n',
)

// ── Figures ──
const media = Object.keys(files)
  .filter((f) => /^word\/media\/image\d+\.png$/.test(f))
  .sort((a, b) => Number(/(\d+)\.png/.exec(a)![1]) - Number(/(\d+)\.png/.exec(b)![1]))
if (media.length !== FIGURE_ORDER.length) throw new Error(`Expected ${FIGURE_ORDER.length} images, got ${media.length}`)
mkdirSync(join(ROOT, 'public/figures'), { recursive: true })
media.forEach((f, idx) => writeFileSync(join(ROOT, `public/figures/${FIGURE_ORDER[idx]}.png`), files[f]))

console.log(`Pool: ${POOL_VERSION}`)
for (const se of subelements.values())
  console.log(`  ${se.id} ${se.name.padEnd(32)} ${String(questions.filter((q) => q.subelement === se.id).length).padStart(3)} questions, ${se.examQuestions} on exam`)
console.log(`  ${questions.length} active questions, ${deleted.length} withdrawn (${deleted.join(', ')}), ${media.length} figures`)
