/**
 * Mock Toronto cycling–layer streets for the inner map text (replace with JSON pipeline later).
 * tier: 0 = no coverage (always grey); 1 = SH, 2 = BL, 3 = CT when installed by selected year.
 * installedYear: null or ≤0 → treat as visible from 2001 onward when tier > 0.
 */

export type StreetSample = {
  name: string
  tier: 0 | 1 | 2 | 3
  installedYear: number | null
  neighbourhoodKey: string
}

/** Display names for legend title when hovering a neighbourhood. */
export const NEIGHBOURHOOD_LABELS: Record<string, string> = {
  kensington: 'Kensington Market',
  trinity: 'Trinity–Bellwoods',
  annex: 'The Annex',
  leslieville: 'Leslieville',
}

export const STREET_SAMPLE: StreetSample[] = [
  { name: 'BLOOR', tier: 3, installedYear: 2017, neighbourhoodKey: 'kensington' },
  { name: 'COLLEGE', tier: 2, installedYear: 2012, neighbourhoodKey: 'kensington' },
  { name: 'QUEEN', tier: 2, installedYear: 2005, neighbourhoodKey: 'kensington' },
  { name: 'DUNDAS', tier: 2, installedYear: 2008, neighbourhoodKey: 'kensington' },
  { name: 'HARBOURFRONT', tier: 3, installedYear: 2015, neighbourhoodKey: 'kensington' },
  { name: 'SHERBOURNE', tier: 2, installedYear: 2010, neighbourhoodKey: 'kensington' },
  { name: 'CHURCH', tier: 1, installedYear: 2003, neighbourhoodKey: 'kensington' },
  { name: 'YONGE', tier: 1, installedYear: 2001, neighbourhoodKey: 'trinity' },
  { name: 'BAY', tier: 1, installedYear: 2004, neighbourhoodKey: 'trinity' },
  { name: 'UNIVERSITY', tier: 2, installedYear: 2009, neighbourhoodKey: 'trinity' },
  { name: 'SPADINA', tier: 2, installedYear: 2011, neighbourhoodKey: 'trinity' },
  { name: 'BATHURST', tier: 1, installedYear: 2006, neighbourhoodKey: 'trinity' },
  { name: 'OSSINGTON', tier: 1, installedYear: 2007, neighbourhoodKey: 'trinity' },
  { name: 'DUFFERIN', tier: 1, installedYear: 2005, neighbourhoodKey: 'trinity' },
  { name: 'LANSDOWNE', tier: 1, installedYear: 2008, neighbourhoodKey: 'annex' },
  { name: 'RONCESVALLES', tier: 2, installedYear: 2013, neighbourhoodKey: 'annex' },
  { name: 'GERRARD', tier: 1, installedYear: 2004, neighbourhoodKey: 'annex' },
  { name: 'DANFORTH', tier: 2, installedYear: 2008, neighbourhoodKey: 'annex' },
  { name: 'BROADVIEW', tier: 1, installedYear: 2006, neighbourhoodKey: 'annex' },
  { name: 'PARLIAMENT', tier: 1, installedYear: 2005, neighbourhoodKey: 'annex' },
  { name: 'JARVIS', tier: 2, installedYear: 2010, neighbourhoodKey: 'annex' },
  { name: 'WELLINGTON', tier: 3, installedYear: 2016, neighbourhoodKey: 'leslieville' },
  { name: 'FRONT', tier: 2, installedYear: 2014, neighbourhoodKey: 'leslieville' },
  { name: 'KING', tier: 2, installedYear: 2009, neighbourhoodKey: 'leslieville' },
  { name: 'RICHMOND', tier: 1, installedYear: 2005, neighbourhoodKey: 'leslieville' },
  { name: 'ADELAIDE', tier: 1, installedYear: 2006, neighbourhoodKey: 'leslieville' },
  { name: 'WESTERN', tier: 0, installedYear: null, neighbourhoodKey: 'leslieville' },
  { name: 'SIDE', tier: 0, installedYear: null, neighbourhoodKey: 'leslieville' },
  { name: 'ALLEY', tier: 0, installedYear: null, neighbourhoodKey: 'leslieville' },
]

export type TierCategory = 'ct' | 'bl' | 'sh' | 'none'

/** Effective bikeway category for a street at the given year (matches map colouring rules). */
export function effectiveTierCategory(row: StreetSample, selectedYear: number): TierCategory {
  if (row.tier === 0) return 'none'
  const startYear = row.installedYear == null || row.installedYear <= 0 ? 2001 : row.installedYear
  if (selectedYear < startYear) return 'none'
  if (row.tier === 3) return 'ct'
  if (row.tier === 2) return 'bl'
  return 'sh'
}

export type TierPalette = { sh: string; bl: string; ct: string }

export function colorForStreetAtYear(
  row: StreetSample,
  selectedYear: number,
  tierColors: TierPalette,
  uncovered: string,
): string {
  const cat = effectiveTierCategory(row, selectedYear)
  if (cat === 'none') return uncovered
  if (cat === 'ct') return tierColors.ct
  if (cat === 'bl') return tierColors.bl
  return tierColors.sh
}

export type TierPercentBreakdown = {
  ct: number
  bl: number
  sh: number
  none: number
  segmentCount: number
}

/** Streets in scope: one neighbourhood key, or `null` = all of Toronto (full sample). */
export function streetsInScope(neighbourhoodKey: string | null): StreetSample[] {
  if (neighbourhoodKey == null) return STREET_SAMPLE
  return STREET_SAMPLE.filter(s => s.neighbourhoodKey === neighbourhoodKey)
}

/**
 * Integer percentages (sum 100) for CT, BL, SH, and none (—), plus segment count in scope.
 */
export function computeTierPercents(neighbourhoodKey: string | null, selectedYear: number): TierPercentBreakdown {
  const rows = streetsInScope(neighbourhoodKey)
  const n = rows.length
  let ct = 0
  let bl = 0
  let sh = 0
  let none = 0
  for (const row of rows) {
    const c = effectiveTierCategory(row, selectedYear)
    if (c === 'ct') ct++
    else if (c === 'bl') bl++
    else if (c === 'sh') sh++
    else none++
  }
  if (n === 0) {
    return { ct: 0, bl: 0, sh: 0, none: 0, segmentCount: 0 }
  }
  const raw = [ct, bl, sh, none].map(c => (c / n) * 100)
  const floors = raw.map(x => Math.floor(x))
  let rem = 100 - floors.reduce((a, b) => a + b, 0)
  const order = [0, 1, 2, 3].sort(
    (i, j) => (raw[j] - floors[j]) - (raw[i] - floors[i]),
  )
  const out = [...floors]
  for (let k = 0; k < rem; k++) out[order[k]]++
  return { ct: out[0], bl: out[1], sh: out[2], none: out[3], segmentCount: n }
}
