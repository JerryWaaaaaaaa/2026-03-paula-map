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

const FONT = '500 9px "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif'
const LINE_HEIGHT = 10
const PADDING = 28
const CHORD_PAD = 2
const MIN_CHORD = 10

const TEXT_CORPUS = Array(80).fill(MAP_BODY_TEXT).join(' ')

let prepared = prepareWithSegments(TEXT_CORPUS, FONT)

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

    ctx.save()
    clipToPolygon(ctx, points)
    drawChinaText(ctx, points, prepared, {
      font: FONT,
      lineHeight: LINE_HEIGHT,
      chordPadding: CHORD_PAD,
      minChordCssPx: MIN_CHORD,
      textFillStyle: '#141018',
    })
    ctx.restore()

    strokePolygon(ctx, points, 'rgba(201, 162, 39, 0.85)', 1.25)
  }

  render()
  window.addEventListener('resize', render)
}

paint().catch((e) => {
  console.error(e)
  root.textContent = String(e)
})
