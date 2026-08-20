# Container Castle Designer — Hill Country Yacht Club

A parametric 3D property model. Shipping containers are **data**, not hardcoded
geometry: a layout definition drives the model, the bill of materials, the cost
estimate and a structural rule checker, and all four recalculate together.

Everything is client-side. Layouts are JSON files you import and export.

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # 143 tests
npm run typecheck
npm run build
npm run export:layouts # regenerate layouts/*.json
```

## What is in the model

| Piece | What it is |
|---|---|
| **Castle** | 96 containers: a bawn curtain wall with a two-course water elevation, four corner towers, two gate towers, a 44′ × 160′ great hall and a three-level keep — all crenellated, on a battered plinth |
| **Dragon** | A 150-foot welded steel sculpture on the arrival lawn, 186-foot wingspan, breathing fire on a nine-second cycle |
| **Fire** | Seven rainbow gas pits in two clusters flanking the dragon, each drifting through the spectrum on its own clock |
| **Stages** | Three land stages — great hall, fire ring, grove — plus an overwater stage at the head of the dock |
| **Marina** | Existing and enhanced schemes, switchable. Enhanced runs a 260′ spine, 26 berths, and ten premier berths with over-slip patios, shade, bars, rope swings, jump platforms and festoon lighting |
| **Lodging** | Nine lake cabins, a two-level bunkhouse, six canvas platforms and eight tower suites — 29 keys, 88 beds |

## The idea the tool exists to teach

Use containers as **intact structural objects**, not as sliced-open room
volumes. Every cut costs welded reinforcement: 18 hours for anything over
3′ × 3′, 6 hours for anything smaller, at $95/hr against a $50,000 cap — 526
hours, and no more.

The great hall works because it is the *open span between* two container walls
rather than a hollowed-out row. A hollowed-out row of the same footprint would
need a welded tube-steel frame at every removed wall. Keeping the boxes intact
spends the money on a truss instead, which is bought rather than welded on site.

The welding meter sits at the top of the cost panel for exactly this reason.
Cut a hole in the inspector and watch it climb.

## Domain model

World units are **feet**; one Three.js unit is one foot.

A container's `position` is the **minimum corner** of its bounding box, not the
centroid. Storing the min corner makes grid snapping and corner-casting
alignment exact integer comparisons instead of half-dimension floating point.

| Type | Length | Width | Height | Tare | Usable |
|---|---|---|---|---|---|
| 40′ High Cube | 40′ 0″ | 8′ 0″ | 9′ 6″ | 8,600 lb | ~305 sf |
| 20′ Standard | 20′ 0″ | 8′ 0″ | 8′ 6″ | 5,100 lb | ~152 sf |

Interior clear width is **7′ 8″** after the corrugation. There is no such thing
as an eight-foot-wide container room, and the UI will not offer you one.

Corner castings sit at all eight corners and are the only rated load path.
Every structural rule resolves through them.

Containers carry a **zone** — `castle`, `lodging`, `marina`, `backOfHouse` — so
the castle's dollars per square foot can be checked against the reference
design without the lodging or the marina quietly changing the answer.

## The rule checker

| Rule | What it catches | Severity |
|---|---|---|
| R0 | Two containers sharing volume | error |
| R1 | A stack stepping off its corner castings — names the transfer beam | error |
| R2 | Stack height: 3–4 containers needs engineered lateral bracing | warning at 3, error above 4 |
| R3 | Side wall cut past 30% / 50% of its area — the shear diaphragm | warning / error |
| R4 | Welded tube-steel frames, and the hours they cost | informational |
| R5 | The $50,000 welding cap, and which openings to eliminate to get back under it | error |
| R6 | A container roof carrying a deck or terrace — rated for snow, not occupancy | warning, priced |
| R7 | More than 25% of a container overhanging unsupported | error |
| R8 | A sealed container bearing on an open-air one without a thermal break | warning |

Only **errors** paint the model red. Rule R6 legitimately names every container
under the wall walk; turning the whole curtain wall red for a priced, expected
warning would bury the findings that actually stop the build. Warnings are
highlighted by selecting them from the panel.

## The cost engine

`takeoff(layout, zone)` measures the model — exposed exterior surface face by
face, stack joints, adjacencies, ground containers, welding hours — and
`estimateFromQuantities` turns quantities into line items. Soft cost runs on
hard cost; contingency runs on hard plus soft, because a contingency has to
cover the design fees on whatever the scope change turns out to be.

The rate table in `src/cost/rates.ts` is reproduced exactly as supplied. Rates
for the dragon, the marina, the stages and the lighting are **my assumptions**
and live in a separate `SITE_RATES` table so they never muddy the castle
validation.

**Validation target:** the reference design — 95 containers, 5,100 sf sealed,
14,900 sf open-air — computes to $6.26M, or $313/sf, against a $6.3M / $315
target. A test asserts ±3%.

## The marina business case

The interesting question is not what the build-out costs but whether the
over-slip patios pay for themselves, and whether the furnishings are better
sold as a premier rate or as a separate monthly add-on. `src/revenue/slips.ts`
prices both:

- **Bundled** — the patio, the furniture and the toys are baked into a premier
  rate. Simple to sell; the tenant never sees a line item they can decline.
- **Add-on** — every berth is priced as standard and the furnishing package is
  a separate monthly charge. Lower headline rate, earns only on the tenants who
  take it, but it prices a thing a slip rental normally never includes and can
  be sold to standard berths later without repricing the lease.

Every market number in that file — rates, occupancy, attach rate, operating
margin — is a placeholder. Replace them with real comps from the lake before
anyone relies on the payback.

## Layout of the source

```
src/
  domain/       types, dimensions, geometry, ids, seed layout, property assembly
    generators/ tower, crenellation, bartizan, batter, great hall, bawn,
                marina, accommodations, spectacle
  rules/        structural R0–R8, welding budget
  cost/         rates, takeoff, estimate
  revenue/      slip pricing and payback
  scene/        instanced containers, decor, terrain and water, dragon, fire,
                marina, stages, string lights, lighting, camera presets
  ui/           toolbar, cost, warnings, revenue, layers, inspector
  io/           JSON import and export
layouts/        generated JSON: existing marina, enhanced marina, reference castle
```

Containers and decor are drawn with `InstancedMesh` per type and a single
merged `LineSegments` for the outlines. One mesh per box is the wrong shape
above about fifty containers, and the frame rate falls off a cliff around
eighty.

## Controls

Click to select, shift-click to add. Arrow keys nudge on the 8-foot module
(shift for 40), **R** rotates, **Ctrl+D** duplicates, **Delete** removes,
**Ctrl+Z** / **Ctrl+Shift+Z** undo and redo, **Esc** clears the selection.

## What this is not

This tool makes it feel like the castle is designed. It is not — it is
*specified*. Before any of it is real you still need a civil site capacity
analysis, geotech borings, and a structural PE with container experience who
will stamp a bolted multi-storey assembly.

**Impervious cover limits in the Highland Lakes watershed may cap this
programme regardless of what the budget allows.** Get the civil analysis before
falling in love with a specific layout.
