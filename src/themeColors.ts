/** Reads tokens from src/colors.css (:root) for canvas rendering. */

export type ThemeColors = {
  bgCanvas: string
  bgSurface: string
  textOnSurface: string[]
  textOnCanvas: string[]
  /** Grey for streets with no infra or not yet built by selected year */
  uncoveredStreet: string
  /** Bikeway tier colours — SH / BL / CT (tier 1 / 2 / 3 when installed) */
  tierSh: string
  tierBl: string
  tierCt: string
  mapStroke: string
  mapLabelCity: string
  mapLabelNature: string
}

/** Reads --{prefix}-1, --{prefix}-2, … until a value is empty. */
function readColorList(s: CSSStyleDeclaration, prefix: string): string[] {
  const out: string[] = []
  for (let i = 1; ; i++) {
    const val = s.getPropertyValue(`${prefix}-${i}`).trim()
    if (!val) break
    out.push(val)
  }
  return out
}

export function readThemeColors(): ThemeColors {
  const s = getComputedStyle(document.documentElement)
  const v = (name: string) => s.getPropertyValue(name).trim()

  return {
    bgCanvas: v('--color-bg-canvas') || '#0e1220',
    bgSurface: v('--color-bg-surface') || '#ece7ed',
    textOnSurface: readColorList(s, '--color-surface'),
    textOnCanvas:  readColorList(s, '--color-canvas'),
    uncoveredStreet: v('--color-uncovered-street') || '#b4b2a9',
    tierSh: v('--color-tier-sh') || '#ba7517',
    tierBl: v('--color-tier-bl') || '#0f6e56',
    tierCt: v('--color-tier-ct') || '#534ab7',
    mapStroke: v('--color-map-stroke') || 'rgba(120, 60, 90, 0.55)',
    mapLabelCity: v('--color-map-label-city') || '#4a2d5c',
    mapLabelNature: v('--color-map-label-nature') || '#2d5a4a',
  }
}
