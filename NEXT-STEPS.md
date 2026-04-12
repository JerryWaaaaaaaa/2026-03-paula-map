# Next steps

Items **not** implemented in the current slice (see plan / `type-toronto-build-plan.md` for context). Use this as a backlog when you extend the project.

## Map asset and geography

- Swap [`public/map-alpha.png`](public/map-alpha.png) for a Toronto (or study-area) silhouette when ready; update [`src/mapGeo.ts`](src/mapGeo.ts) bounds and any landmark positions if you keep geo-anchored images.

## Neighbourhoods and interaction

- Neighbourhood polygons, grouping, hover-to-focus one area, dimming other areas, and breakdown tooltips.
- Optional raster “neighbourhood id” map or vector hit-testing for per-area interaction.

## Zoom modes

- Zoomed-out aggregate view (e.g. stacked CT / BL / SH with font-weight by density); current build is **zoom-in only** (street tokens + pan/zoom + word hover).

## Visual and typography

- Full Toronto tier colour system from the build plan (amber / teal / purple ramps) — current build reuses the existing surface palette plus [`--color-uncovered-street`](src/colors.css) only.
- Variable-font weight encoding for tiers at low zoom.
- Text labels aligned along road LineStrings (true geometry) instead of the grid fill.

## Data and tooling

- `scripts/processData` (or similar) pulling Toronto Open Data bikeways, optional OSM centre lines for grey canvas, and optional neighbourhood merge.
- Ship [`public/data/streets.json`](public/data/) (and neighbourhoods file if/when needed) and replace [`src/streetSample.ts`](src/streetSample.ts).

## Time and polish

- Optional fade animation on year change (~400ms) for segments appearing/disappearing.
- Performance: cull off-screen words or move to Canvas spatial indexing if counts grow very large.
- Optional faint neighbourhood boundaries on hover.

## Landmark photos on the map (paused)

- Landmark PNGs, text cutouts, and hover tooltips are **off** by default. In [`src/main.ts`](src/main.ts), set **`LANDMARK_MAP_RENDER_ENABLED`** to `true` to load [`LANDMARK_DEFS`](src/main.ts) images again, draw them on the canvas, and restore the dev GUI “Landmark width” control.

## Earlier prototype notes (Type China era)

- Image sizing / per-landmark scale overrides if the landmark set grows.
- Softer mask edge (alpha threshold, multi-sample cells) if the silhouette edge looks too harsh.
