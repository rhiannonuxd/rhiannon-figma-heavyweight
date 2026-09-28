import { TextRunSource } from './types'

/**
 * Figma's layer order is a paint order, not a reading order. PDF text extractors that follow the
 * content stream can therefore read a visually lower layer before a higher one. Group nearly
 * aligned node tops into one row, then emit each row from left to right.
 *
 * The input is never mutated. Keeping this as a source-level operation also leaves every text
 * node's internal line, shaping, kerning, and link order untouched.
 */
export function geometricTextOrder(
  sources: readonly TextRunSource[],
  rowTolerance = 1
): TextRunSource[] {
  const pending = sources
    .map((source, index) => ({ source, index }))
    .sort(
      (a, b) =>
        a.source.offset.y - b.source.offset.y ||
        a.source.offset.x - b.source.offset.x ||
        a.index - b.index
    )

  const ordered: TextRunSource[] = []
  for (let start = 0; start < pending.length;) {
    const rowTop = pending[start].source.offset.y
    let end = start + 1
    while (end < pending.length && pending[end].source.offset.y - rowTop <= rowTolerance) end += 1

    pending
      .slice(start, end)
      .sort(
        (a, b) =>
          a.source.offset.x - b.source.offset.x ||
          a.source.offset.y - b.source.offset.y ||
          a.index - b.index
      )
      .forEach(({ source }) => ordered.push(source))
    start = end
  }
  return ordered
}

type TextRow = {
  top: number
  left: number
  sources: Array<{ source: TextRunSource; index: number }>
}

const MONTH =
  '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
const DATE_RANGE = new RegExp(
  `\\b${MONTH}\\s+\\d{4}\\s*(?:-|\\u2013|\\u2014)\\s*(?:${MONTH}\\s+\\d{4}|Present|Current)\\b`,
  'i'
)

function textRows(sources: readonly TextRunSource[], rowTolerance = 1): TextRow[] {
  const pending = sources
    .map((source, index) => ({ source, index }))
    .sort(
      (a, b) =>
        a.source.offset.y - b.source.offset.y ||
        a.source.offset.x - b.source.offset.x ||
        a.index - b.index
    )

  const rows: TextRow[] = []
  for (let start = 0; start < pending.length;) {
    const top = pending[start].source.offset.y
    let end = start + 1
    while (end < pending.length && pending[end].source.offset.y - top <= rowTolerance) end += 1
    const rowSources = pending
      .slice(start, end)
      .sort(
        (a, b) =>
          a.source.offset.x - b.source.offset.x ||
          a.source.offset.y - b.source.offset.y ||
          a.index - b.index
      )
    rows.push({
      top,
      left: Math.min(...rowSources.map(({ source }) => source.offset.x)),
      sources: rowSources
    })
    start = end
  }
  return rows
}

function rowText(row: TextRow): string {
  return row.sources
    .map(({ source }) => source.characters.trim())
    .filter(Boolean)
    .join(' ')
}

function looksLikeEmployer(row: TextRow, header: TextRow): boolean {
  const text = rowText(row)
  return (
    text.length > 0 &&
    text.length <= 80 &&
    row.top - header.top <= 48 &&
    Math.abs(row.left - header.left) <= 24 &&
    !DATE_RANGE.test(text) &&
    !/^[\u2022\u25cf\u25e6\-*]/u.test(text) &&
    !/[.!?]$/.test(text) &&
    !/^[A-Z][A-Z\s&/+]{3,}$/.test(text)
  )
}

/**
 * Workday and similar field parsers need more than geometrically correct prose: they infer an
 * employment record from a conventional title -> employer -> dates sequence. Figma resumes often
 * put title and dates on one line above the employer. Detect that compact, dated header pattern and
 * emit its fields separately in the order Workday demonstrated it expects. PDF coordinates are
 * untouched, so the visible page remains identical.
 */
export function workdayTextOrder(
  sources: readonly TextRunSource[],
  rowTolerance = 1
): TextRunSource[] {
  const rows = textRows(sources, rowTolerance)
  const ordered: TextRunSource[] = []

  for (let index = 0; index < rows.length; index += 1) {
    const header = rows[index]
    const employer = rows[index + 1]
    const dated = header.sources.filter(({ source }) => DATE_RANGE.test(source.characters))
    const titles = header.sources.filter(({ source }) => !DATE_RANGE.test(source.characters))
    if (
      employer !== undefined &&
      dated.length > 0 &&
      titles.length > 0 &&
      looksLikeEmployer(employer, header)
    ) {
      ordered.push(...titles.map(({ source }) => source))
      ordered.push(...employer.sources.map(({ source }) => source))
      ordered.push(...dated.map(({ source }) => source))
      index += 1
      continue
    }
    ordered.push(...header.sources.map(({ source }) => source))
  }
  return ordered
}
