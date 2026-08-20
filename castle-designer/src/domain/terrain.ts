/**
 * The site.
 *
 * This is a reading of the landform visible in aerial imagery of the Cypress
 * Creek Marina parcel on Lake Travis — a bench of high ground behind the road,
 * a limestone bluff falling away on the east, the Long Hollow Creek draw
 * cutting down the west side, and a cove at the bottom where the docks are.
 * The parcel is taken as 1,000 feet across by 600 deep, scaled off the
 * imagery's 100-foot bar.
 *
 * It is an interpretation of what the photograph shows, not survey data. Real
 * contours come from LiDAR — TNRIS publishes it for Travis County — and every
 * elevation here should be replaced by that before anybody cuts a pad. What
 * this is good for is showing how the programme sits on a hill instead of on
 * a table, and what terracing it costs.
 *
 * Datum: zero is the lake surface. Everything on land is feet above it.
 */

export const PARCEL = {
  sizeX: 1000,
  sizeZ: 600,
  minX: -500,
  minZ: -300,
  maxX: 500,
  maxZ: 300,
} as const;

/** Height of the ridge behind the compound, in feet above the lake. */
export const HILL_CREST_FT = 96;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Where the water meets the land, as a function of X.
 *
 * The cove bites in around 120 feet west of centre — that is the marina — and
 * the shore runs away to the south-east where the bluff comes down.
 */
export function shorelineZAt(x: number): number {
  const along = clamp(x / 500, -1, 1);
  const cove = 45 * Math.exp(-(((x + 120) / 130) ** 2));
  return 250 + 40 * along - cove;
}

/** Nominal shoreline on the centre line, for anything that needs one number. */
export const NOMINAL_SHORELINE_Z = shorelineZAt(0);

/**
 * Natural grade before anything is cut: feet above lake level.
 *
 * Rises steeply off the bank and flattens toward the ridge, steeper again on
 * the east where the bluff is, with the creek draw subtracted down the west.
 */
export function naturalGrade(x: number, z: number): number {
  const inland = shorelineZAt(x) - z;

  if (inland <= 0) {
    // Under the water the bed keeps falling, but not forever.
    return Math.max(-42, inland * 0.55);
  }

  let height = HILL_CREST_FT * (1 - Math.exp(-inland / 205));

  // The east side of the parcel is a limestone bluff: same fall, less run.
  height *= 1 + 0.22 * clamp(x / 500, 0, 1);

  // Long Hollow Creek cuts a draw down the west side, swinging as it falls.
  const drawCentre = -330 + 0.22 * z;
  height -= 30 * Math.exp(-(((x - drawCentre) / 78) ** 2)) * clamp(inland / 90, 0, 1);

  // A little cross-fall, because no hillside is a ramp.
  height += 3.5 * Math.sin(x / 130) * Math.cos(z / 95);

  return Math.max(0, height);
}

export interface Rect2 {
  x: number;
  z: number;
  sizeX: number;
  sizeZ: number;
}

export interface Terrace {
  id: string;
  name: string;
  /** Finished floor level of the pad, in feet above the lake. */
  elevation: number;
  rect: Rect2;
  /** What the terrace carries. */
  note: string;
}

/**
 * The cut pads.
 *
 * Four levels stepping down the hill toward the water, each sized so the cut
 * at the back roughly balances the fill at the front — which is what keeps the
 * earthwork from becoming the biggest line item on the job. The steps between
 * them are 12 to 18 feet, and the castle's own walls do most of the retaining.
 */
export const TERRACES: Terrace[] = [
  {
    id: 'upper',
    name: 'Keep terrace',
    elevation: 86,
    rect: { x: -160, z: -256, sizeX: 320, sizeZ: 104 },
    note: 'Keep and the two back towers, on the crest',
  },
  {
    id: 'middle',
    name: 'Hall terrace',
    elevation: 74,
    rect: { x: -224, z: -152, sizeX: 448, sizeZ: 144 },
    note: 'Great hall, courtyard and the curtain wall',
  },
  {
    id: 'lower',
    name: 'Gate terrace',
    elevation: 60,
    rect: { x: -160, z: -8, sizeX: 320, sizeZ: 72 },
    note: 'Gatehouse, forecourt and the drop-off',
  },
  {
    id: 'lawn',
    name: 'Lawn terrace',
    elevation: 42,
    rect: { x: -280, z: 64, sizeX: 560, sizeZ: 88 },
    note: 'Dragon, fire terraces and the lawn stages',
  },
];

export const TERRACE_BY_ID: Record<string, Terrace> = Object.fromEntries(
  TERRACES.map((t) => [t.id, t]),
);

export function terraceElevation(id: string): number {
  const terrace = TERRACE_BY_ID[id];
  if (!terrace) throw new Error(`unknown terrace: ${id}`);
  return terrace.elevation;
}

function inRect(rect: Rect2, x: number, z: number): boolean {
  return (
    x >= rect.x && x <= rect.x + rect.sizeX && z >= rect.z && z <= rect.z + rect.sizeZ
  );
}

/** The terrace a point sits on, if any. */
export function terraceAt(x: number, z: number): Terrace | undefined {
  // Later terraces are lower and nearer the water; the first match wins, and
  // the pads are laid out not to overlap.
  return TERRACES.find((t) => inRect(t.rect, x, z));
}

/** How far a terrace edge is blended into the hill either side of it. */
const BATTER_RUN_FT = 26;

/**
 * Finished grade: the terrace where there is one, natural grade elsewhere, and
 * a graded slope across the band between them so the pads do not stand on
 * vertical cliffs of nothing.
 */
export function finishedGrade(x: number, z: number): number {
  const terrace = terraceAt(x, z);
  if (terrace) return terrace.elevation;

  const natural = naturalGrade(x, z);

  // Find the nearest pad within the blend band and ease toward its level.
  let best: { distance: number; elevation: number } | null = null;
  for (const t of TERRACES) {
    const dx = Math.max(t.rect.x - x, 0, x - (t.rect.x + t.rect.sizeX));
    const dz = Math.max(t.rect.z - z, 0, z - (t.rect.z + t.rect.sizeZ));
    const distance = Math.hypot(dx, dz);
    if (distance > BATTER_RUN_FT) continue;
    if (!best || distance < best.distance) best = { distance, elevation: t.elevation };
  }
  if (!best) return natural;

  const t = best.distance / BATTER_RUN_FT;
  const eased = t * t * (3 - 2 * t);
  return best.elevation * (1 - eased) + natural * eased;
}

/**
 * How much of each terrace face the buildings themselves hold back.
 *
 * The curtain wall on the hall terrace is a two-course run of containers
 * standing on the downhill edge of a cut pad — which is to say it is already a
 * retaining wall, and paying for a second one behind it would be paying twice.
 * The lawn terrace has almost nothing on its edge, so almost nothing is saved.
 */
const RETAINED_BY_STRUCTURE: Record<string, number> = {
  upper: 0.45,
  middle: 0.7,
  lower: 0.55,
  lawn: 0.12,
};

/** Height of face that can daylight into a graded slope instead of a wall. */
const DAYLIGHT_ALLOWANCE_FT = 4;

export interface TerraceEarthwork {
  id: string;
  name: string;
  cutCy: number;
  fillCy: number;
  /** Face that has to be held, before the buildings take their share. */
  faceSqFt: number;
  /** Held by the castle's own walls. */
  structureSqFt: number;
  /** Left for purpose-built retaining, which is what gets priced. */
  wallSqFt: number;
}

export interface Earthwork {
  /** Cubic yards excavated. */
  cutCy: number;
  /** Cubic yards of engineered fill placed. */
  fillCy: number;
  /** Cubic yards that have to be hauled in, or off, once cut meets fill. */
  importCy: number;
  /** Square feet of purpose-built retaining wall. */
  retainingSqFt: number;
  /** Square feet the buildings retain for free. */
  structureRetainedSqFt: number;
  perTerrace: TerraceEarthwork[];
}

/**
 * Cut, fill and retaining, sampled across each pad.
 *
 * A five-foot grid is finer than the height model deserves but cheap, and it
 * makes the balance between cut and fill legible per terrace, which is the
 * number that decides whether the dirt has to leave the site.
 */
export function earthwork(step = 5): Earthwork {
  const perTerrace: TerraceEarthwork[] = [];
  let cut = 0;
  let fill = 0;
  let retaining = 0;
  let structureRetained = 0;

  for (const terrace of TERRACES) {
    let terraceCut = 0;
    let terraceFill = 0;
    const cellArea = step * step;

    for (let x = terrace.rect.x; x < terrace.rect.x + terrace.rect.sizeX; x += step) {
      for (let z = terrace.rect.z; z < terrace.rect.z + terrace.rect.sizeZ; z += step) {
        const natural = naturalGrade(x + step / 2, z + step / 2);
        const delta = terrace.elevation - natural;
        if (delta < 0) terraceCut += -delta * cellArea;
        else terraceFill += delta * cellArea;
      }
    }

    // Only the uphill and downhill faces need holding. The side edges run
    // along the contour and daylight into the hill, and the first few feet of
    // any face can be a graded slope rather than a wall.
    let face = 0;
    for (let x = terrace.rect.x; x < terrace.rect.x + terrace.rect.sizeX; x += step) {
      for (const z of [terrace.rect.z, terrace.rect.z + terrace.rect.sizeZ]) {
        const drop = Math.abs(terrace.elevation - naturalGrade(x, z));
        face += Math.max(0, drop - DAYLIGHT_ALLOWANCE_FT) * step;
      }
    }

    const structureShare = RETAINED_BY_STRUCTURE[terrace.id] ?? 0;
    const entry: TerraceEarthwork = {
      id: terrace.id,
      name: terrace.name,
      cutCy: terraceCut / 27,
      fillCy: terraceFill / 27,
      faceSqFt: face,
      structureSqFt: face * structureShare,
      wallSqFt: face * (1 - structureShare),
    };
    perTerrace.push(entry);
    cut += entry.cutCy;
    fill += entry.fillCy;
    retaining += entry.wallSqFt;
    structureRetained += entry.structureSqFt;
  }

  return {
    cutCy: cut,
    fillCy: fill,
    // Positive means dirt has to be brought in; negative means it leaves.
    importCy: fill - cut,
    retainingSqFt: retaining,
    structureRetainedSqFt: structureRetained,
    perTerrace,
  };
}

/** Elevation contour interval used by the model and the plan overlay. */
export const CONTOUR_INTERVAL_FT = 10;

/** Ground function for a layout, chosen by its declared terrain model. */
export function groundFunctionFor(terrain: 'flat' | 'cypressCreek') {
  return terrain === 'cypressCreek' ? finishedGrade : () => 0;
}

/**
 * Pad level for a building that follows the hill rather than getting a
 * terrace: the lowest natural grade anywhere under its footprint, rounded
 * down.
 *
 * Taking the low point rather than the average means the uphill end is cut
 * into the slope instead of the downhill end standing on air, which is both
 * how it gets built and what keeps the cantilever rule satisfied — a container
 * at or below grade is bearing on it.
 */
export function padUnder(rect: Rect2, step = 8): number {
  let lowest = Infinity;
  for (let x = rect.x; x <= rect.x + rect.sizeX; x += step) {
    for (let z = rect.z; z <= rect.z + rect.sizeZ; z += step) {
      lowest = Math.min(lowest, naturalGrade(x, z));
    }
  }
  return Math.floor(lowest);
}
