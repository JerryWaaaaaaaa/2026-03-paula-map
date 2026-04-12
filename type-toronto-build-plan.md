# Type Toronto — build plan

A typographic data visualization of Toronto's cycling infrastructure evolution over time.
Inspired by Paula Scher's text-as-geography maps. All visual elements are composed of
street names and abbreviations; color and font weight encode infrastructure data.

---

## Project overview

- **Subject:** Downtown Toronto cycling infrastructure, 2001–2025
- **Concept:** The map canvas is entirely filled with street name text. No basemap, no outlines.
  Text color encodes infrastructure tier. Font weight encodes coverage density (zoomed out).
  A time slider steps through years, revealing how the network grew.
- **Interaction:** Zoom in/out, hover by neighbourhood, scrub through time.
- **Data source:** Toronto Open Data — Bikeways dataset (GeoJSON/CSV with `INSTALLED` year field)

---

## Visual encoding system

### Infrastructure tiers

| Tier | Dataset types | Abbreviation | Color |
|---|---|---|---|
| No coverage | (any street not in bikeways dataset) | — | Grey `#B4B2A9` |
| Shared | Signed route, sharrow, neighbourhood route | `SH` | Amber `#BA7517` |
| Painted lane | Bike lane, buffered lane, contra-flow | `BL` | Teal `#0F6E56` |
| Protected | Cycle track, multi-use trail | `CT` | Purple `#534AB7` |

Tier is determined by the `INFRA_HIGH` field in the bikeways dataset.

### Zoomed-in state (street level)
- Each text node = one street name
- Text color = infrastructure tier color (above)
- Font weight = 300 for grey (no coverage), 400 for SH, 500 for BL/CT
- No background fill in idle state
- Streets are grouped and positioned by neighbourhood polygon

### Zoomed-out state (neighbourhood level)
- Each neighbourhood renders its three tier abbreviations stacked: CT / BL / SH
- Font weight of each abbreviation = coverage density:
  - weight 300 → 0–25% of neighbourhood streets have that tier
  - weight 500 → 25–60%
  - weight 700 → 60–100%
- All three abbreviations always visible, weight does the talking

### Hover state
**Hovered neighbourhood:**
- Every street token gains a colored background pill matching its tier
- Text color darkens to the 900-stop of that tier's ramp for contrast
- Neighbourhood label becomes purple (CT color)
- Tooltip appears near cursor with a breakdown bar chart (% per tier)

**Non-hovered neighbourhoods:**
- All text collapses to uniform light grey `#D3D1C7`
- Font weight collapses to 300
- Tier color fully removed — no visual competition with the active area

**Transitions:**
- Hover enter: 150ms ease-out (background appear + color shift simultaneously)
- Neighbour dim: 200ms ease-out (color + weight collapse together)
- Mouse leave: 250ms ease-in (slightly slower so eye can track the reversal)

### Color tokens (full)

| Tier | Idle text | Hover bg | Hover text | Dim text |
|---|---|---|---|---|
| Grey | `#B4B2A9` | `#F1EFE8` | `#888780` | `#D3D1C7` |
| SH (amber) | `#BA7517` | `#FAC775` | `#633806` | `#D3D1C7` |
| BL (teal) | `#0F6E56` | `#9FE1CB` | `#085041` | `#D3D1C7` |
| CT (purple) | `#534AB7` | `#CECBF6` | `#26215C` | `#D3D1C7` |

---

## Time slider

- Range: 2001–2025 (discrete integer steps, one per year)
- Each step forward: newly installed segments in that year appear, colored by tier
- Each step backward: those segments revert to grey (no coverage)
- Segments that were removed (e.g. Ford-era removals ~2012) should revert to grey
  at the correct year, then re-appear if reinstated
- Transition on year change: new segments fade in over 400ms; removals fade out over 400ms
- The map is always fully filled with text — grey streets always present as canvas

---

## Data pipeline

### Primary dataset
**Toronto Open Data — Bikeways**
- URL: `https://ckan0.cf.opendata.inter.prod-toronto.ca/en/dataset/bikeways`
- Format: GeoJSON or CSV (both available)
- Key fields:
  - `INFRA_HIGH` — highest infrastructure type on segment (use this for tier classification)
  - `INFRA_LOW` — lowest infrastructure type (secondary, optional)
  - `INSTALLED` — year installed (integer, 2001–present; some pre-2001 entries exist, treat as 2001)
  - `geometry` — LineString coordinates of the road segment

### Secondary dataset
**OpenStreetMap — Toronto street centerlines**
- For all streets NOT in the bikeways dataset (the grey canvas layer)
- Use Overpass API or a pre-downloaded OSM extract for downtown Toronto
- Recommended bounding box for downtown: `43.63, -79.42, 43.68, -79.36`
- Filter to `highway = residential | secondary | tertiary | primary` to avoid highways

### Neighbourhood polygons
**Toronto Open Data — Neighbourhoods**
- URL: `https://open.toronto.ca/dataset/neighbourhoods/`
- GeoJSON polygons for ~140 Toronto neighbourhoods
- Use `point-in-polygon` to assign each street segment to a neighbourhood
- Focus on downtown neighbourhoods for v1 (roughly 30–40 neighbourhoods)

### Data processing steps (pre-build, run once)
1. Download bikeways GeoJSON
2. Download OSM street centerlines for downtown bounding box
3. Download neighbourhood polygons, filter to downtown
4. For each bikeways segment: classify tier from `INFRA_HIGH`, extract `INSTALLED` year
5. For each OSM street: assign to neighbourhood via point-in-polygon
6. Merge: bikeways streets get tier + year; OSM-only streets get tier = "none", year = null
7. For each neighbourhood: pre-compute per-year coverage stats (% streets per tier)
8. Output: two JSON files —
   - `streets.json` — array of `{ id, name, neighbourhood, tier, installedYear, coordinates }`
   - `neighbourhoods.json` — array of `{ id, name, bounds, yearlyStats: { [year]: { ct, bl, sh, none } } }`

---

## Tech stack

### Recommended
```
Framework:     Vanilla JS or React (no heavy framework needed)
Rendering:     Canvas API (for text at scale) or D3.js + SVG
Zoom:          d3-zoom for pan/zoom behavior
Map math:      d3-geo for projection, turf.js for point-in-polygon
Fonts:         Variable font with weight axis (e.g. Inter Variable or similar)
               Must support weight 300–700 programmatically
Build:         Vite (fast dev server, simple config)
Data:          Pre-processed JSON files (no runtime API calls)
```

### Rendering approach — important decision
Two viable approaches with different tradeoffs:

**Option A: SVG + D3**
- Each street = a `<text>` element positioned along its road geometry
- Zoom/hover via D3 zoom + CSS transitions
- Pro: hover and transitions are trivial, DOM is inspectable
- Con: performance degrades past ~5000 text nodes; may need culling at low zoom

**Option B: Canvas 2D API**
- All text drawn via `ctx.fillText()` each frame
- Pro: handles 20,000+ text nodes without issue
- Con: hover detection requires manual hit-testing (quadtree or spatial index)
- Use `rbush` for spatial indexing of bounding boxes

**Recommendation:** Start with SVG/D3 for the prototype (easier to build, debug, and tweak
visual design). Migrate to Canvas only if performance becomes an issue at full dataset scale.

---

## File structure

```
type-toronto/
├── public/
│   └── data/
│       ├── streets.json          # pre-processed street data
│       └── neighbourhoods.json   # pre-processed neighbourhood data
├── src/
│   ├── main.js                   # entry point
│   ├── map/
│   │   ├── MapRenderer.js        # core rendering logic (SVG or Canvas)
│   │   ├── ZoomController.js     # d3-zoom setup, zoom level thresholds
│   │   ├── TextLayout.js         # positions text tokens along road geometries
│   │   └── HoverController.js    # neighbourhood hit-testing, hover state
│   ├── data/
│   │   ├── loader.js             # loads and caches streets.json + neighbourhoods.json
│   │   └── tierClassifier.js     # INFRA_HIGH string → tier enum
│   ├── ui/
│   │   ├── TimeSlider.js         # year slider component
│   │   ├── Tooltip.js            # neighbourhood hover tooltip with bar chart
│   │   └── Legend.js             # CT / BL / SH / — legend
│   └── styles/
│       └── main.css
├── scripts/
│   ├── processData.js            # one-time data pipeline (Node.js)
│   └── fetchOSM.js               # Overpass API fetch for street centerlines
├── index.html
├── package.json
└── vite.config.js
```

---

## Build phases

### Phase 1 — static prototype (validate visual language)
- Hardcode ~50 streets across 3–4 downtown neighbourhoods
- Implement zoom-in (street names + color) and zoom-out (abbreviations + weight)
- Implement hover: background pills + dimming of other neighbourhoods
- Implement tooltip with breakdown bars
- No real data, no time slider yet
- Goal: confirm the visual system looks right before touching real data

### Phase 2 — data pipeline
- Run `scripts/processData.js` to generate `streets.json` and `neighbourhoods.json`
- Wire up real data to the renderer
- Validate that neighbourhood groupings look correct on the actual map shape
- Check that the Toronto shape reads as Toronto from text density alone (no basemap)

### Phase 3 — time slider
- Add year slider UI
- Filter visible streets by `installedYear <= selectedYear`
- Grey streets always visible regardless of year
- Animate year transitions (fade in new segments)

### Phase 4 — polish
- Tune text density so the map shape is legible (may need font size adjustments per zoom level)
- Add zoom-level thresholds (exact pixel values where zoom-in → zoom-out mode switches)
- Performance audit — cull off-screen text nodes
- Add a subtle neighbourhood boundary line (optional, very faint, only visible on hover)

---

## Key implementation notes for Claude Code

### Text positioning along roads
Street names should follow the road geometry direction. For each LineString segment:
1. Compute the angle of the dominant segment direction
2. Rotate the text label to match
3. If the segment is too short for the full name, abbreviate or skip
4. Repeat the name along longer segments to fill space (like Type China does)

### Zoom thresholds
Define two breakpoints:
- `zoomLevel < 1.5` → zoomed-out mode (abbreviations + weight)
- `zoomLevel >= 1.5` → zoomed-in mode (street names + color)
The threshold value will need tuning based on the actual bounding box of downtown Toronto.

### Neighbourhood hover hit-testing (SVG approach)
Group each neighbourhood's `<text>` elements inside a `<g data-neighbourhood="id">`.
Add `onMouseEnter` / `onMouseLeave` on each `<g>`. When entered:
1. Add `hovered` class to that `<g>` → triggers pill backgrounds via CSS
2. Add `dimmed` class to all sibling `<g>` elements → collapses to grey

### Font weight continuity
Use a variable font so weight can be set as a continuous value (300, 400, 500, 700)
without loading multiple font files. `Inter` or `DM Sans` both have variable weight axes
available from Google Fonts. Set `font-variation-settings: 'wght' 500` in CSS.

### Year data edge cases
- `INSTALLED` values of `0` or null → treat as pre-2001, show from year 2001 onwards
- Some segments have different install years per side (INFRA_HIGH vs INFRA_LOW may differ)
  → use INFRA_HIGH year as the canonical year for simplicity
- Removed segments (Ford-era ~2011–2014): the dataset does not track removals explicitly.
  For v1, ignore removals — only show additions. Can add removal tracking in a later phase
  using the Two Wheeled Politics tracker as a manual reference.

---

## Prompt to start Claude Code

Paste this to begin the Phase 1 prototype:

```
I'm building a typographic data visualization called "Type Toronto" — a map of downtown
Toronto's cycling infrastructure where all visual elements are composed of street name text.
No basemap. Text color encodes infrastructure tier (grey = no coverage, amber = shared/sharrow,
teal = painted bike lane, purple = protected cycle track). Font weight encodes coverage density
when zoomed out.

Please read the full build plan in type-toronto-build-plan.md before starting.

Start with Phase 1: a static HTML/JS prototype using Vite, with hardcoded data for
4 downtown neighbourhoods (Kensington Market, Trinity Bellwoods, The Annex, Leslieville).
Include ~15 streets per neighbourhood with manually assigned tiers.

Implement:
1. Zoom-in view: street names as flowing text, colored by tier, no background
2. Zoom-out view: CT / BL / SH abbreviations with font-weight encoding density
3. Hover: background pill on hovered neighbourhood streets, dimming of others, tooltip
4. Smooth transitions per the spec (150ms enter, 250ms leave)

Use D3.js for zoom and SVG rendering. Use Inter Variable font from Google Fonts.
Color tokens are in the build plan. Do not use a basemap or map tiles.
```
