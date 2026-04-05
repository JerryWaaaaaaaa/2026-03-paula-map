import './style.css'
import GUI from 'lil-gui'
import { drawWordsInShape, drawWordsAroundShape } from './textInShape'
import {
  type PngMask,
  loadPngMask,
  computeMaskTransform,
  maskIntervalsAtY,
  maskOutsideIntervalsAtX,
} from './pngMask'
import { readThemeColors } from './themeColors'
import { MAP_FILLER_TEXT, SURROUNDING_CITIES_TEXT } from './copy'

// ─── Constants ────────────────────────────────────────────────────────────────

const FONT_FAMILY = "'Geist Mono', monospace"

// Word arrays — color cycles once per word; truncation cuts within a word at span edges
const INNER_WORDS = Array(50).fill(MAP_FILLER_TEXT).join(' ').toUpperCase().split(/\s+/).filter(Boolean)
const OUTER_WORDS = Array(30).fill(SURROUNDING_CITIES_TEXT).join(' ').toUpperCase().split(/\s+/).filter(Boolean)

// ─── GUI Params ───────────────────────────────────────────────────────────────

const params = {
  fontSize:      9,
  lineHeight:    10.5,
  mapPadding:    40,
  overlapBuffer: 1.0,
}

const gui = new GUI({ title: 'Text Controls' })
gui.add(params, 'fontSize',      6,   18,  0.5).name('Font Size').onChange(renderFrame)
gui.add(params, 'lineHeight',    7,   22,  0.5).name('Line Height').onChange(renderFrame)
gui.add(params, 'mapPadding',    0,  120,  1  ).name('Map Padding').onChange(renderFrame)
gui.add(params, 'overlapBuffer', 0,    3,  0.1).name('Overlap Buffer').onChange(renderFrame)

// ─── DOM Structure ────────────────────────────────────────────────────────────

const root = document.querySelector<HTMLDivElement>('#app')!

const canvas = document.createElement('canvas')
canvas.id = 'map-canvas'
canvas.setAttribute('aria-label', 'Map filled with text — drag to pan')
root.appendChild(canvas)
const ctx = canvas.getContext('2d')!

// ─── Canvas Sizing ────────────────────────────────────────────────────────────

let lastW = 0
let lastH = 0
let lastDpr = 0

function sizeCanvas(): { w: number; h: number } {
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  if (w !== lastW || h !== lastH || dpr !== lastDpr) {
    lastW = w
    lastH = h
    lastDpr = dpr
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  return { w, h }
}

// ─── Pan ──────────────────────────────────────────────────────────────────────

let panX = 0
let panY = 0

type PanState = {
  pid: number
  startCX: number
  startCY: number
  startPX: number
  startPY: number
} | null

let panState: PanState = null
let panRaf = 0

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return
  panState = {
    pid: e.pointerId,
    startCX: e.clientX,
    startCY: e.clientY,
    startPX: panX,
    startPY: panY,
  }
  canvas.setPointerCapture(e.pointerId)
  document.body.classList.add('is-panning')
})

canvas.addEventListener('pointermove', (e) => {
  if (!panState || panState.pid !== e.pointerId) return
  panX = panState.startPX + (e.clientX - panState.startCX)
  panY = panState.startPY + (e.clientY - panState.startCY)
  if (!panRaf) {
    panRaf = requestAnimationFrame(() => {
      panRaf = 0
      renderFrame()
    })
  }
})

const endPan = (e: PointerEvent): void => {
  if (!panState || panState.pid !== e.pointerId) return
  panState = null
  document.body.classList.remove('is-panning')
  try {
    canvas.releasePointerCapture(e.pointerId)
  } catch {
    /* already released */
  }
}
canvas.addEventListener('pointerup', endPan)
canvas.addEventListener('pointercancel', endPan)

// ─── PNG Mask ─────────────────────────────────────────────────────────────────

let mask: PngMask | null = null

// ─── Render ───────────────────────────────────────────────────────────────────

function renderFrame(): void {
  if (!mask) return
  const theme = readThemeColors()
  const { w, h } = sizeCanvas()
  const { fontSize, lineHeight, mapPadding, overlapBuffer } = params
  const fontSpec = `400 ${fontSize}px ${FONT_FAMILY}`

  const transform = computeMaskTransform(mask.imgW, mask.imgH, w, h, mapPadding, panX, panY)
  const insideAtY = (y: number) => maskIntervalsAtY(mask!, transform, y, w)
  const spansAtX  = (x: number) => maskOutsideIntervalsAtX(mask!, transform, x, h, lineHeight * overlapBuffer)

  ctx.clearRect(0, 0, w, h)

  drawWordsAroundShape(ctx, spansAtX, w, OUTER_WORDS, {
    font: fontSpec,
    lineHeight,
    colors: theme.textOnCanvas,
  })

  drawWordsInShape(ctx, insideAtY, h, INNER_WORDS, {
    font: fontSpec,
    lineHeight,
    colors: theme.textOnSurface,
  })
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const initialFontSpec = `400 ${params.fontSize}px ${FONT_FAMILY}`
  await document.fonts.load(initialFontSpec)
  mask = await loadPngMask('/map-alpha.png')
  renderFrame()
  window.addEventListener('resize', renderFrame)
}

init().catch((e: unknown) => {
  console.error(e)
  root.textContent = String(e)
})
