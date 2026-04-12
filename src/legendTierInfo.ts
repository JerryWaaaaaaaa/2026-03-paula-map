/** Static copy for the map legend (tiers + hover tooltips). Order: least to most infrastructure. */

export type LegendTierMod = 'none' | 'sh' | 'bl' | 'ct'

export type LegendTierRowDef = {
  mod: LegendTierMod
  fullName: string
  description: string
}

export const LEGEND_TIER_ROWS: readonly LegendTierRowDef[] = [
  {
    mod: 'none',
    fullName: 'No coverage',
    description: 'no bike lane coverage',
  },
  {
    mod: 'sh',
    fullName: 'Shared (SH)',
    description: 'signed route, sharrow, neighbourhood route',
  },
  {
    mod: 'bl',
    fullName: 'Painted lane (BL)',
    description: 'bike lane, buffered lane, contra-flow',
  },
  {
    mod: 'ct',
    fullName: 'Protected (CT)',
    description: 'cycle track, multi-use trail',
  },
]
