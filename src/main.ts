import './style.css'
import { loadChinaGeoJson, largestOuterRing, projectRingToCanvas } from './chinaOutline'
import {
  prepareWithSegments,
  drawChinaText,
  clipToPolygon,
  strokePolygon,
  fillPolygon,
} from './textInShape'
import { MAP_BODY_TEXT } from './copy'

const BASE_FONT_PX = 9
const BASE_LINE_HEIGHT = 10
const PADDING = 28
const BASE_CHORD_PAD = 2
const BASE_MIN_CHORD = 10

const TEXT_CORPUS = Array(80).fill(MAP_BODY_TEXT).join(' ')

let fontScale = 1

function getTextMetrics(scale: number) {
  const fontPx = Math.max(4, Math.round(BASE_FONT_PX * scale * 10) / 10)
  const lineHeight = Math.round(BASE_LINE_HEIGHT * scale * 10) / 10
  const chordPadding = Math.max(1, Math.round(BASE_CHORD_PAD * scale * 10) / 10)
  const minChordCssPx = Math.max(4, Math.round(BASE_MIN_CHORD * scale * 10) / 10)
  return {
    font: `500 ${fontPx}px "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif`,
    lineHeight,
    chordPadding,
    minChordCssPx,
  }
}

let prepared: ReturnType<typeof prepareWithSegments>

function rebuildPrepared() {
  prepared = prepareWithSegments(TEXT_CORPUS, getTextMetrics(fontScale).font)
}

rebuildPrepared()

const canvas = document.createElement('canvas')
const ctxRaw = canvas.getContext('2d')
if (!ctxRaw) throw new Error('Canvas unsupported')
const ctx = ctxRaw

const root = document.querySelector<HTMLDivElement>('#app')!
root.appendChild(canvas)

function sizeCanvas(): { cssW: number; cssH: number } {
  const dpr = Math.min(window.devicePixelRatio ?? 1, 2)
  const cssW = window.innerWidth
  const cssH = window.innerHeight
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  canvas.width = Math.floor(cssW * dpr)
  canvas.height = Math.floor(cssH * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { cssW, cssH }
}

async function paint() {
  const geo = await loadChinaGeoJson()
  const ring = largestOuterRing(geo)

  const render = () => {
    const { cssW, cssH } = sizeCanvas()
    const { points } = projectRingToCanvas(ring, cssW, cssH, PADDING)

    ctx.fillStyle = '#0b1220'
    ctx.fillRect(0, 0, cssW, cssH)

    fillPolygon(ctx, points, '#e8dcc8')

    const m = getTextMetrics(fontScale)
    ctx.save()
    clipToPolygon(ctx, points)
    drawChinaText(ctx, points, prepared, {
      font: m.font,
      lineHeight: m.lineHeight,
      chordPadding: m.chordPadding,
      minChordCssPx: m.minChordCssPx,
      textFillStyle: '#141018',
    })
    ctx.restore()

    strokePolygon(ctx, points, 'rgba(201, 162, 39, 0.85)', 1.25)
  }

  const scaler = document.createElement('div')
  scaler.className = 'font-size-scaler'
  const label = document.createElement('label')
  label.className = 'font-size-scaler__label'
  label.htmlFor = 'font-size-range'
  label.textContent = 'Text size'

  const range = document.createElement('input')
  range.id = 'font-size-range'
  range.type = 'range'
  range.min = '0.5'
  range.max = '2'
  range.step = '0.05'
  range.value = String(fontScale)

  const valueEl = document.createElement('span')
  valueEl.className = 'font-size-scaler__value'
  valueEl.textContent = `${Math.round(fontScale * 100)}%`

  range.addEventListener('input', () => {
    fontScale = parseFloat(range.value)
    valueEl.textContent = `${Math.round(fontScale * 100)}%`
    rebuildPrepared()
    render()
  })

  scaler.append(label, range, valueEl)
  root.appendChild(scaler)

  render()
  window.addEventListener('resize', render)
}

paint().catch((e) => {
  console.error(e)
  root.textContent = String(e)
})
