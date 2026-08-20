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
npm run build:artifact # fold the whole app into one self-contained HTML file
```

`build:artifact` inlines the bundle and the stylesheet into a single page with
no outbound requests, for publishing somewhere with a strict content security
policy. That build hides the export, import and screenshot controls, because a
sandboxed page cannot hand the viewer a file.

## What is in the model

| Piece | What it is |
|---|---|
| **Castle** | 96 containers: a bawn curtain wall with a two-course water elevation, four corner towers, two gate towers, a 44′ × 160′ great hall and a three-level keep — all crenellated, on a battered plinth |
| **Dragon** | A 48-foot scrap-metal beast on the arrival lawn — donor car hoods for wing membrane, wheel rims at the joints, leaf springs for legs, headlights for eyes — breathing fire on a nine-second cycle |
| **Fire** | Seven rainbow gas pits in two clusters flanking the dragon, each drifting through the spectrum on its own clock |
| **Stages** | Three land stages — great hall, fire ring, grove — plus an overwater stage at the head of the dock |
| **Marina** | Existing and enhanced schemes, switchable. Enhanced is seven hexagons — a hub carrying the ship store with a stage on its roof, and six satellites off its corners on retractable walkways — 90 berths at 12′ × 24′ under 65,000 sf of clear roof deck with 792 kW of solar beneath it |
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

## What it looks like

Containers are drawn with procedurally generated corrugation, cargo-door ends
and visible corner castings — all built in memory, since the published build
makes no network requests and has nowhere to load an image from. The property
is planted with live oaks and Ashe junipers, scattered deterministically so the
same tree lands in the same place on every load. People are sampled from the
occupancy model at one figure per sixteen occupants, which is the only thing
that gives the model scale: a forty-foot container reads as a box until
somebody is standing next to it.

Bloom, a vignette and a procedural room environment finish it. The environment
matters more than it sounds: metallic materials get almost all their colour
from what they reflect, and with nothing to reflect every metal in the scene
renders near black.

**Walk mode** puts you in it at eye height — click to look, WASD to move, shift
to run. There is no collision, which is deliberate: walking through the curtain
wall into the great hall is useful in a design tool.

## Layers and capacity

Thirty-three display layers, grouped: curtain wall, towers, great hall, keep and
gatehouse; crenellation, wall walk, bartizans and plinth; cabins, bunkhouse and
canvas platforms; docks, slips by tier, over-slip patios, boats and swim toys;
stages, bars and furniture; fire pits, dragon, dragon fire, party lights and
area lighting; oaks and cedars, people and water; grid, capacity chips and edge
outlines.

Layers belong to the model, not the viewer. A generator knows the deck it just
emitted is the bunkhouse gallery and not a glamping platform, and nothing
downstream could work that out from geometry alone.

Capacity is occupant load per IBC Table 1004.5, measured off the model where
the geometry can answer — the hall from its truss bays, the docks from their
decks, the lodging from its bed count — and off stated assumptions where it
cannot, with the assumption written next to the number. It is a check on the
programme, not an egress design: door widths, travel distances, parking, water
and septic are unmodelled, and one of them will cap this site long before the
floor area does.

## The marina

Seven hexagons, sixty feet a side. The hub carries a ship store with a stage on
its roof; six satellites sit off its corners at the end of fifty-foot walkways
that **retract at the hub end**, so a storm meets seven independent rafts on
their own piles rather than one rigid structure trying to move as a single
body.

Each satellite is ringed by a six-foot walkway with berths off its inner faces
— 12′ × 24′, fifteen per hexagon, ninety in all — and three of its six edges
left open at twenty feet clear. What is left in the middle is a 44-foot turning
basin, about one and a half boat lengths.

Every hexagon is roofed at sixteen feet with clear structural decking you can
stand on and photovoltaic underneath it: 65,472 sf of roof, 40,592 sf of array,
792 kW. The roof is the shade over every berth and the largest revenue line the
marina has that is not a lease.

It is costed the way a floating dock is actually bought — 893 dock floats at
4′ × 8′ × 32″ and $700 each, framework by the square foot, array by the watt —
not as one number per berth.

The **Dock plan** workspace draws the whole thing at one unit to the foot, from
the same model the 3D view uses. Scroll to zoom and berth numbers, dimensions
and the float grid appear as the scale crosses the point where they would be
legible on paper.

## The dragon

Twenty thousand dollars, which buys a scrap build and not a sculpture: donor
car parts and yard steel welded onto a used-pipe spine, left in whatever faded
paint the donors arrived in. Parts, consumables and rigging scale with length;
the plinth and the burner do not. At forty-eight feet the lines sum to exactly
the cap, and the estimator will show you what a hundred and fifty would cost.

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
