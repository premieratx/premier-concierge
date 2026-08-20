/**
 * Domain model for the container castle designer.
 *
 * World units are FEET. One Three.js unit == one foot.
 *
 * Axis convention:
 *   +X  east/west run of the site
 *   +Y  up (elevation)
 *   +Z  north/south run of the site
 *
 * A container's `position` is the MINIMUM CORNER of its axis-aligned bounding
 * box: the smallest x, the base elevation (y = 0 sits on grade), the smallest z.
 * Storing the min corner rather than the centroid is what makes grid snapping
 * and corner-casting alignment (rule R1) exact integer comparisons instead of
 * half-dimension floating point arithmetic.
 */

export type ContainerType = '40HC' | '20ST';

/** Containers only ever sit square to the grid. Free rotation is not a thing. */
export type Rotation = 0 | 90;

/**
 * How a container participates in the castle.
 *  - `structural` — load-bearing box in the main massing
 *  - `sealed`     — conditioned envelope (insulated, thermally broken)
 *  - `wall`       — one leaf of a wall assembly, e.g. a great hall side
 *  - `tower`      — part of a stacked corner tower
 */
export type ContainerRole = 'structural' | 'sealed' | 'wall' | 'tower';

export type Finish = 'painted' | 'stone';

/**
 * Which face of a container an opening is cut into, in the container's own
 * local frame (before rotation is applied).
 *  - `sideA` / `sideB` — the two long walls (40' or 20' x wall height)
 *  - `endA` / `endB`   — the two 8'-wide ends (endB is the door end)
 *  - `roof`            — a roof penetration
 */
export type WallFace = 'sideA' | 'sideB' | 'endA' | 'endB' | 'roof';

/**
 * A cut in a container wall. Every one of these costs welded tube-steel
 * reinforcement, which is the whole pedagogical point of the tool.
 *
 * `offsetU` runs along the face from its origin corner; `offsetV` runs up from
 * the container floor (or, for a roof cut, across the 8' width).
 */
export interface Opening {
  id: string;
  face: WallFace;
  /** Feet, along the face. */
  width: number;
  /** Feet, up the face. */
  height: number;
  /** Feet from the face's origin corner, along the face. */
  offsetU: number;
  /** Feet from the container floor, up the face. */
  offsetV: number;
  label?: string;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Container {
  id: string;
  type: ContainerType;
  /** Minimum corner of the bounding box, in feet. See module docblock. */
  position: Vec3;
  rotation: Rotation;
  role: ContainerRole;
  openings: Opening[];
  finish: Finish;
  /** Optional human name, e.g. "NW tower L2". Shown in the inspector. */
  label?: string;
}

export interface Layout {
  /** Schema version, bumped when the serialized shape changes. */
  version: number;
  id: string;
  name: string;
  /** Declared for forward compatibility; feet is the only supported unit. */
  units: 'ft';
  containers: Container[];
  notes?: string;
}
