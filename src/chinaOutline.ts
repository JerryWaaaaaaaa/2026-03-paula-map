/** GeoJSON lon/lat ring → canvas points + scanline intervals for text layout. */

export type Pt = { x: number; y: number }

export type LonLat = [number, number]

export type Interval = { left: number; right: number }

type GeoMultiPolygon = {
  type: 'MultiPolygon'
  coordinates: number[][][][]
}

type GeoFeatureCollection = {
  type: 'FeatureCollection'
  features: Array<{ geometry: GeoMultiPolygon }>
}

function ringAreaLonLat(ring: LonLat[]): number {
  let sum = 0
  const n = ring.length
  if (n < 3) return 0
  const last = ring[n - 1][0] === ring[0][0] && ring[n - 1][1] === ring[0][1] ? n - 1 : n
  for (let i = 0; i < last; i++) {
    const j = (i + 1) % last
    sum += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1]
  }
  return Math.abs(sum / 2)
}

function openRing(ring: LonLat[]): LonLat[] {
  if (ring.length < 2) return ring
  const a = ring[0]
  const b = ring[ring.length - 1]
  if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1)
  return ring
}

/** Pick the outer ring with the largest planar area (main landmass vs small islands). */
export function largestOuterRing(geo: GeoFeatureCollection): LonLat[] {
  let best: LonLat[] | null = null
  let bestArea = -1
  for (const f of geo.features) {
    const { coordinates } = f.geometry
    for (const polygon of coordinates) {
      const outer = polygon[0] as LonLat[]
      if (!outer?.length) continue
      const area = ringAreaLonLat(outer)
      if (area > bestArea) {
        bestArea = area
        best = outer
      }
    }
  }
  if (!best) throw new Error('No polygon rings in GeoJSON')
  return openRing(best)
}

export function ringBounds(ring: LonLat[]): { minLon: number; maxLon: number; minLat: number; maxLat: number } {
  let minLon = Infinity,
    maxLon = -Infinity,
    minLat = Infinity,
    maxLat = -Infinity
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
  }
  return { minLon, maxLon, minLat, maxLat }
}

/** Project geographic ring to canvas coordinates; Y increases downward. */
export function projectRingToCanvas(
  ring: LonLat[],
  canvasCssW: number,
  canvasCssH: number,
  padding: number,
): { points: Pt[]; bounds: { minX: number; maxX: number; minY: number; maxY: number } } {
  const { minLon, maxLon, minLat, maxLat } = ringBounds(ring)
  const lonR = maxLon - minLon || 1
  const latR = maxLat - minLat || 1
  const innerW = canvasCssW - padding * 2
  const innerH = canvasCssH - padding * 2
  const scale = Math.min(innerW / lonR, innerH / latR)
  const w = lonR * scale
  const h = latR * scale
  const offX = padding + (innerW - w) / 2
  const offY = padding + (innerH - h) / 2

  const points: Pt[] = ring.map(([lon, lat]) => ({
    x: offX + (lon - minLon) * scale,
    y: offY + (maxLat - lat) * scale,
  }))

  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  return { points, bounds: { minX, maxX, minY, maxY } }
}

function dedupeSorted(xs: number[], eps = 1e-4): number[] {
  const out: number[] = []
  for (const x of xs) {
    if (out.length && Math.abs(out[out.length - 1] - x) < eps) continue
    out.push(x)
  }
  return out
}

/** Horizontal scanline intersections → inside intervals (non-convex simple polygons). */
export function intervalsAtY(poly: Pt[], y: number): Interval[] {
  const n = poly.length
  if (n < 3) return []
  const xs: number[] = []
  for (let i = 0; i < n; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % n]
    const yi = a.y
    const yj = b.y
    if (Math.abs(yi - yj) < 1e-9) continue
    if ((yi < y) === (yj < y)) continue
    const x = a.x + ((y - yi) * (b.x - a.x)) / (yj - yi)
    xs.push(x)
  }
  xs.sort((u, v) => u - v)
  const clean = dedupeSorted(xs)
  const out: Interval[] = []
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const left = clean[i]
    const right = clean[i + 1]
    if (right > left) out.push({ left, right })
  }
  return out
}

export function widestInterval(intervals: Interval[]): Interval | null {
  if (intervals.length === 0) return null
  return intervals.reduce((a, b) => (b.right - b.left > a.right - a.left ? b : a))
}

export async function loadChinaGeoJson(url = '/china.geojson'): Promise<GeoFeatureCollection> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`)
  return res.json() as Promise<GeoFeatureCollection>
}
