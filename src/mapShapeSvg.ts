import type { Pt } from './chinaOutline'

/** How the SVG path is turned into a polygon (see `loadSvgOutlinePoints`). */
export type SvgOutlineSampleOptions = {
  /**
   * Minimum number of samples along the path (after clamping).
   * Higher = smoother outline from the SVG; more work for layout.
   */
  minSegments: number
  /**
   * Maximum number of samples (after clamping).
   * Caps cost for very long paths.
   */
  maxSegments: number
  /**
   * Rough sample count is `ceil(pathLength / lengthDivisor)` before clamping.
   * Lower divisor = more points (denser polygon).
   */
  lengthDivisor: number
}

const DEFAULT_SAMPLE: SvgOutlineSampleOptions = {
  minSegments: 120,
  maxSegments: 3000,
  lengthDivisor: 1.5,
}

/**
 * Load outline from an SVG (single <path> or <polygon>) exported from Figma.
 * Path is sampled along its length for use with the polygon scanline layout.
 *
 * Tuning: edit `public/map.svg` for the silhouette; use sample options for
 * how finely the path is discretized (see `SvgOutlineSampleOptions`).
 */
export async function loadSvgOutlinePoints(
  url: string,
  sample: Partial<SvgOutlineSampleOptions> = {},
): Promise<Pt[]> {
  const o = { ...DEFAULT_SAMPLE, ...sample }
  const minSeg = Math.min(o.minSegments, o.maxSegments)
  const maxSeg = Math.max(o.minSegments, o.maxSegments)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load ${url}`)
  const xml = await res.text()
  const doc = new DOMParser().parseFromString(xml, 'image/svg+xml')

  const poly = doc.querySelector('polygon')
  if (poly) {
    const raw = poly.getAttribute('points')?.trim() ?? ''
    const nums = raw.split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n))
    const out: Pt[] = []
    for (let i = 0; i + 1 < nums.length; i += 2) out.push({ x: nums[i], y: nums[i + 1] })
    if (out.length >= 3) return out
  }

  const pathSrc = doc.querySelector('path')
  const d = pathSrc?.getAttribute('d')?.trim()
  if (!d) {
    throw new Error('map.svg: need a <path d="..."> or <polygon points="..."> (export SVG from Figma).')
  }

  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', d)
  svg.appendChild(path)
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.style.visibility = 'hidden'
  svg.style.pointerEvents = 'none'
  document.body.appendChild(svg)

  try {
    const p = path as SVGPathElement
    const len = p.getTotalLength()
    if (!Number.isFinite(len) || len < 1) {
      throw new Error('Invalid SVG path length. Try flattening strokes in Figma before export.')
    }
    const segments = Math.max(minSeg, Math.min(maxSeg, Math.ceil(len / o.lengthDivisor)))
    const out: Pt[] = []
    for (let i = 0; i < segments; i++) {
      const pt = p.getPointAtLength((i / segments) * len)
      out.push({ x: pt.x, y: pt.y })
    }
    return out
  } finally {
    svg.remove()
  }
}
