import { prepareWithSegments, layoutNextLine, type PreparedTextWithSegments, type LayoutCursor } from '@chenglou/pretext'
import { subtractIntervalFromSpans, type Interval, type Pt } from './chinaOutline'

export type TextInShapeOptions = {
  font: string
  lineHeight: number
  chordPadding: number
  minChordCssPx: number
  /** Cycle through these for each word (global order while drawing). */
  wordColors: string[]
}

/** Axis-aligned holes for Pretext filler (e.g. geo label bounds). */
export type ExclusionRect = { left: number; right: number; top: number; bottom: number }

/** Bounding box for `fillText` at alphabetic baseline `cy`, horizontally centered on `cx`. */
export function measureLabelExclusionRect(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  cx: number,
  cy: number,
  pad: number,
): ExclusionRect {
  ctx.font = font
  const m = ctx.measureText(text)
  const w = m.width
  const asc = m.actualBoundingBoxAscent ?? 8
  const desc = m.actualBoundingBoxDescent ?? 2
  return {
    left: cx - w / 2 - pad,
    right: cx + w / 2 + pad,
    top: cy - asc - pad,
    bottom: cy + desc + pad,
  }
}


/** Draw one laid-out line with a color per word; advances `wordIndex`. */
function fillLineWordColors(
  ctx: CanvasRenderingContext2D,
  lineText: string,
  startX: number,
  y: number,
  palette: string[],
  wordIndex: { value: number },
): void {
  const words = lineText.split(/\s+/).filter(Boolean)
  if (words.length === 0 || palette.length === 0) return
  const spaceW = ctx.measureText(' ').width
  let x = startX
  for (let i = 0; i < words.length; i++) {
    if (i > 0) x += spaceW
    ctx.fillStyle = palette[wordIndex.value % palette.length]
    wordIndex.value++
    const w = words[i]
    ctx.fillText(w, x, y)
    x += ctx.measureText(w).width
  }
}

const START_CURSOR: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }

/** Fill the viewport outside the shape with text (one line per outside span per row). */
export function drawSurroundingText(
  ctx: CanvasRenderingContext2D,
  outsideAtY: (y: number) => Interval[],
  canvasH: number,
  prepared: PreparedTextWithSegments,
  opts: TextInShapeOptions,
  exclusionRects?: ExclusionRect[],
): void {
  const { font, lineHeight, chordPadding, minChordCssPx, wordColors } = opts
  ctx.font = font
  ctx.textBaseline = 'alphabetic'
  const wordIndex = { value: 0 }

  let cursor = START_CURSOR
  let y = lineHeight * 0.85
  const yMax = canvasH - 4

  scanline: while (y < yMax) {
    let intervals = outsideAtY(y)
    if (exclusionRects?.length) {
      for (const r of exclusionRects) {
        if (y < r.top || y > r.bottom) continue
        intervals = subtractIntervalFromSpans(intervals, r.left, r.right)
      }
    }
    const spans = intervals
      .filter((s) => s.right - s.left >= minChordCssPx)
      .sort((a, b) => a.left - b.left)
    if (spans.length === 0) {
      y += lineHeight
      continue
    }
    for (const span of spans) {
      const maxWidth = Math.max(4, span.right - span.left - chordPadding * 2)
      const line = layoutNextLine(prepared, cursor, maxWidth)
      if (!line) break scanline

      const lineW = line.width
      const x = span.left + chordPadding + Math.max(0, (maxWidth - lineW) / 2)
      fillLineWordColors(ctx, line.text, x, y, wordColors, wordIndex)
      cursor = line.end
    }
    y += lineHeight
  }
}

/**
 * Fill the viewport outside the shape with text rendered in vertical columns (rotated 90° CW).
 * Scans left→right by column (step = lineHeight). At each x, finds y-spans outside the shape
 * via `outsideAtX`, then draws a laid-out line rotated so it reads top-to-bottom.
 * Per-word colour cycling is preserved by drawing in a rotated context.
 */
export function drawSurroundingTextVertical(
  ctx: CanvasRenderingContext2D,
  outsideAtX: (x: number) => Interval[],
  canvasW: number,
  prepared: PreparedTextWithSegments,
  opts: TextInShapeOptions,
): void {
  const { font, lineHeight, chordPadding, minChordCssPx, wordColors } = opts
  ctx.font = font
  ctx.textBaseline = 'alphabetic'
  const wordIndex = { value: 0 }

  let cursor = START_CURSOR
  // Start first column at lineHeight * 0.85 from left (same rhythm as drawChinaText's y-start)
  let x = lineHeight * 0.85
  const xMax = canvasW

  // Baseline offset inside the column: place baseline at 75% of lineHeight so
  // cap-height ascenders stay within the column width.
  const baselineOffset = lineHeight * 0.75

  scanline: while (x < xMax) {
    const intervals = outsideAtX(x)
    const spans = intervals
      .filter((s) => s.right - s.left >= minChordCssPx)
      .sort((a, b) => a.left - b.left)

    if (spans.length === 0) {
      x += lineHeight
      continue
    }

    for (const span of spans) {
      const maxHeight = Math.max(4, span.right - span.left - chordPadding * 2)
      const line = layoutNextLine(prepared, cursor, maxHeight)
      if (!line) break scanline

      // Centre the text within the span
      const yStart = span.left + chordPadding + Math.max(0, (maxHeight - line.width) / 2)

      // Rotate 90° CW so horizontal text appears as a top-to-bottom column.
      // translate to (x + baselineOffset, yStart): baseline lands at x + baselineOffset,
      // characters ascend leftward within the column.
      ctx.save()
      ctx.translate(x + baselineOffset, yStart)
      ctx.rotate(Math.PI / 2)
      fillLineWordColors(ctx, line.text, 0, 0, wordColors, wordIndex)
      ctx.restore()

      cursor = line.end
    }
    x += lineHeight
  }
}

export function drawChinaText(
  ctx: CanvasRenderingContext2D,
  insideAtY: (y: number) => Interval[],
  yMin: number,
  yMax: number,
  prepared: PreparedTextWithSegments,
  opts: TextInShapeOptions,
  exclusionRects?: ExclusionRect[],
): void {
  const { font, lineHeight, chordPadding, minChordCssPx, wordColors } = opts
  ctx.font = font
  ctx.textBaseline = 'alphabetic'
  const wordIndex = { value: 0 }

  let cursor = START_CURSOR
  let y = yMin + lineHeight * 0.85

  scanline: while (y < yMax - 4) {
    let intervals = insideAtY(y)
    if (exclusionRects?.length) {
      for (const r of exclusionRects) {
        if (y < r.top || y > r.bottom) continue
        intervals = subtractIntervalFromSpans(intervals, r.left, r.right)
      }
    }
    const spans = intervals
      .filter((s) => s.right - s.left >= minChordCssPx)
      .sort((a, b) => a.left - b.left)
    if (spans.length === 0) {
      y += lineHeight
      continue
    }
    for (const span of spans) {
      const maxWidth = Math.max(4, span.right - span.left - chordPadding * 2)
      const line = layoutNextLine(prepared, cursor, maxWidth)
      if (!line) break scanline

      const lineW = line.width
      const x = span.left + chordPadding + Math.max(0, (maxWidth - lineW) / 2)
      fillLineWordColors(ctx, line.text, x, y, wordColors, wordIndex)
      cursor = line.end
    }
    y += lineHeight
  }
}


export function clipToPolygon(ctx: CanvasRenderingContext2D, poly: Pt[]): void {
  if (poly.length === 0) return
  ctx.beginPath()
  ctx.moveTo(poly[0].x, poly[0].y)
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y)
  ctx.closePath()
  ctx.clip()
}

export function strokePolygon(ctx: CanvasRenderingContext2D, poly: Pt[], strokeStyle: string, lineWidth: number): void {
  if (poly.length === 0) return
  ctx.save()
  ctx.strokeStyle = strokeStyle
  ctx.lineWidth = lineWidth
  ctx.beginPath()
  ctx.moveTo(poly[0].x, poly[0].y)
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

export function fillPolygon(ctx: CanvasRenderingContext2D, poly: Pt[], fillStyle: string): void {
  if (poly.length === 0) return
  ctx.save()
  ctx.fillStyle = fillStyle
  ctx.beginPath()
  ctx.moveTo(poly[0].x, poly[0].y)
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export { prepareWithSegments }

export type WordFillOptions = {
  font: string
  lineHeight: number
  colors: string[]
}

/**
 * Fill the shape defined by `insideAtY` with horizontal words, row by row.
 * Each word gets one color (cycling through `colors`). If a word exceeds the
 * remaining space in a span it is truncated to however many letters fit —
 * the word is still consumed so the next span starts fresh with the next word.
 */
export function drawWordsInShape(
  ctx: CanvasRenderingContext2D,
  insideAtY: (y: number) => Interval[],
  canvasH: number,
  words: string[],
  opts: WordFillOptions,
): void {
  const { font, lineHeight, colors } = opts
  ctx.font = font
  ctx.textBaseline = 'alphabetic'
  const charW = ctx.measureText('M').width

  let wordIdx = 0
  let y = lineHeight * 0.85

  while (y < canvasH) {
    for (const span of insideAtY(y)) {
      let x = span.left
      while (x < span.right) {
        const maxLetters = Math.floor((span.right - x) / charW)
        if (maxLetters <= 0) break
        const letters = words[wordIdx % words.length].slice(0, maxLetters)
        ctx.fillStyle = colors[wordIdx % colors.length]
        ctx.fillText(letters, x, y)
        x += letters.length * charW
        wordIdx++
      }
    }
    y += lineHeight
  }
}

/**
 * Fill the spans returned by `spansAtX` with vertical words (rotated 90° CW,
 * reading top-to-bottom), column by column left-to-right.
 * Each word gets one color. Words are truncated to fit the remaining span height
 * so text always ends flush at the span boundary.
 */
export function drawWordsAroundShape(
  ctx: CanvasRenderingContext2D,
  spansAtX: (x: number) => Interval[],
  canvasW: number,
  words: string[],
  opts: WordFillOptions,
): void {
  const { font, lineHeight, colors } = opts
  ctx.font = font
  ctx.textBaseline = 'alphabetic'
  const charW = ctx.measureText('M').width
  const baselineOffset = lineHeight * 0.75

  let wordIdx = 0
  let x = lineHeight * 0.85

  while (x < canvasW) {
    for (const span of spansAtX(x)) {
      let y = span.left
      while (y < span.right) {
        const maxLetters = Math.floor((span.right - y) / charW)
        if (maxLetters <= 0) break
        const letters = words[wordIdx % words.length].slice(0, maxLetters)
        ctx.fillStyle = colors[wordIdx % colors.length]
        ctx.save()
        ctx.translate(x + baselineOffset, y)
        ctx.rotate(Math.PI / 2)
        ctx.fillText(letters, 0, 0)
        ctx.restore()
        y += letters.length * charW
        wordIdx++
      }
    }
    x += lineHeight
  }
}
