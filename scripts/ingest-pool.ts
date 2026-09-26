/**
 * Ingests the official NCVEC question pools (.docx) into src/data/pools/*.json
 * and copies their diagrams to public/figures/.
 *
 * Sources:
 *   https://www.ncvec.org/index.php/2023-2027-general-question-pool-release
 *   https://www.ncvec.org/index.php/2024-2028-extra-class-question-pool-release
 * Each .docx already has every errata applied (withdrawn questions are marked
 * "Question Deleted"), so this script transcribes it verbatim — it never
 * edits question text. When NCVEC issues new errata, drop the new .docx into
 * pool-source/, update that pool's entry in POOLS, and re-run `npm run ingest:pool`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync, strFromU8 } from 'fflate'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

type PoolSource = {
  id: 'general' | 'extra'
  name: string
  element: number
  docx: string
  version: string
  /** Active dates of this pool, for the "update the pool" reminder. */
  validThrough: string
  examLength: number
  passMark: number
  /**
   * Diagrams appear at the end of the document in figure order. The docx
   * carries no captions we can read, so this ordering was checked by eye
   * against the images themselves.
   */
  figures: string[]
}

const POOLS: PoolSource[] = [
  {
    id: 'general',
    name: 'General',
    element: 3,
    docx: 'pool-source/general-pool-2023-2027-6th-errata-2026-02-04.docx',
    version: '2023-2027 General pool, 6th errata (Feb 4, 2026)',
    validThrough: '2027-06-30',
    examLength: 35,
    passMark: 26,
    figures: ['G7-1'],
  },
  {
    id: 'extra',
    name: 'Extra',
    element: 4,
    docx: 'pool-source/extra-pool-2024-2028-4th-errata-2026-02-04.docx',
    version: '2024-2028 Extra pool, 4th errata (Feb 4, 2026)',
    validThrough: '2028-06-30',
    examLength: 50,
    passMark: 37,
    figures: ['E5-1', 'E6-1', 'E6-2', 'E6-3', 'E7-1', 'E7-2', 'E7-3', 'E9-1', 'E9-2', 'E9-3'],
  },
]

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

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")

const titleCase = (s: string) => s.toLowerCase().replace(/(^|\s)(\w)/g, (_, sp: string, c: string) => sp + c.toUpperCase())

function ingest(src: PoolSource) {
  const L = src.id === 'general' ? 'G' : 'E'
  const files = unzipSync(readFileSync(join(ROOT, src.docx)))
  const xml = strFromU8(files['word/document.xml'])

  const lines = xml.split('</w:p>').map((p) => {
    let text = ''
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>/g)) text += m[0] === '<w:tab/>' ? ' ' : m[1]
    return decode(text).replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
  })

  // The errata preamble can quote SUBELEMENT headings and question headers,
  // so the pool proper starts at the syllabus: the last "SUBELEMENT x1"
  // heading before the first question of the pool.
  const firstQ = lines.findIndex((l) => new RegExp(`^${L}1A01 \\(`).test(l))
  let start = -1
  for (let i = 0; i < firstQ; i++) if (new RegExp(`^SUBELEMENT ${L}1 `).test(lines[i]) && !lines[i - 1]?.startsWith('SUBELEMENT')) start = i
  // Step back to the syllabus summary if it directly precedes (it lists every group title).
  const summary = lines.findLastIndex((l, i) => i < start && new RegExp(`^SUBELEMENT ${L}1 .*Questions$`).test(l))
  if (summary >= 0) start = summary
  const end = lines.findIndex((l) => l.includes('end of question pool text'))
  if (firstQ < 0 || start < 0 || end < 0) throw new Error(`${src.id}: could not locate pool boundaries`)

  const SUB_RE = new RegExp(`^SUBELEMENT (${L}\\d) [-–] (.+?)\\s*[-–]?\\s*\\[(\\d+) exam questions? [-–] (\\d+) groups?\\]`, 'i')
  const GROUP_RE = new RegExp(`^(${L}\\d[A-Z]) (.+)$`)
  const Q_RE = new RegExp(`^(${L}\\d[A-Z]\\d\\d) \\(([A-D])\\)\\s*(?:\\[(.+)\\])?$`)
  const DELETED_RE = new RegExp(`^(${L}\\d[A-Z]\\d\\d)\\s+Question Deleted`, 'i')
  const ANY_Q_RE = new RegExp(`^${L}\\d[A-Z]\\d\\d\\b`)
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
      const existing = subelements.get(id)
      subelements.set(id, { id, name: titleCase(rawName.replace(/\s*[-–]\s*$/, '')), examQuestions: Number(exam), groups: existing?.groups ?? [] })
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
      const figure = new RegExp(`Figure (${L}\\d-\\d)`).exec(question)?.[1]
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

    if (ANY_Q_RE.test(line)) throw new Error(`${src.id}: unrecognized question header "${line}"`)

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
    if (q.figure && !src.figures.includes(q.figure)) throw new Error(`${q.id}: unknown figure ${q.figure}`)
  }
  const expectedSubs = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((d) => L + d)
  if ([...subelements.keys()].join() !== expectedSubs.join()) throw new Error(`${src.id}: unexpected subelements ${[...subelements.keys()]}`)
  let examTotal = 0
  for (const se of subelements.values()) {
    examTotal += se.examQuestions
    if (se.groups.length !== se.examQuestions) throw new Error(`${se.id}: ${se.groups.length} groups`)
    for (const g of se.groups) if (!questions.some((q) => q.group === g.id)) throw new Error(`Group ${g.id} has no questions`)
  }
  if (examTotal !== src.examLength) throw new Error(`${src.id}: exam totals ${examTotal}, expected ${src.examLength}`)

  mkdirSync(join(ROOT, 'src/data/pools'), { recursive: true })
  writeFileSync(
    join(ROOT, `src/data/pools/${src.id}.json`),
    JSON.stringify(
      {
        id: src.id,
        name: src.name,
        element: src.element,
        version: src.version,
        validThrough: src.validThrough,
        examLength: src.examLength,
        passMark: src.passMark,
        subelements: [...subelements.values()],
        questions,
      },
      null,
      1,
    ) + '\n',
  )

  // ── Figures ──
  const media = Object.keys(files)
    .filter((f) => /^word\/media\/image\d+\.png$/.test(f))
    .sort((a, b) => Number(/(\d+)\.png/.exec(a)![1]) - Number(/(\d+)\.png/.exec(b)![1]))
  if (media.length !== src.figures.length) throw new Error(`${src.id}: expected ${src.figures.length} images, got ${media.length}`)
  mkdirSync(join(ROOT, 'public/figures'), { recursive: true })
  media.forEach((f, idx) => writeFileSync(join(ROOT, `public/figures/${src.figures[idx]}.png`), files[f]))

  console.log(`${src.name} (Element ${src.element}): ${src.version}`)
  for (const se of subelements.values())
    console.log(`  ${se.id} ${se.name.padEnd(34)} ${String(questions.filter((q) => q.subelement === se.id).length).padStart(3)} questions, ${se.examQuestions} on exam`)
  console.log(`  ${questions.length} active questions, ${deleted.length} withdrawn (${deleted.join(', ')}), ${media.length} figures\n`)
}

for (const src of POOLS) ingest(src)
