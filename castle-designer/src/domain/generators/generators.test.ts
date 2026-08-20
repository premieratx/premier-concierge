import { describe, expect, it } from 'vitest';
import { dimsOf } from '../dimensions';
import { findIntersections, snapPosition } from '../geometry';
import { batterVeneerSqFt, generateBatter } from './batter';
import { generateBawn } from './bawn';
import { rectEdges, type Rect } from './common';
import { generateCrenellation, merlonCount } from './crenellation';
import {
  generateGreatHall,
  hallMetrics,
  HALL_SPAN_WARN_FT,
} from './greatHall';
import { generateMarina, ENHANCED_MARINA, EXISTING_MARINA } from './marina';
import { generateTower } from './tower';
import { generateFirePitRing, generateLandStages } from './spectacle';
import { generateAccommodations } from './accommodations';

describe('crenellation', () => {
  const edge = { from: { x: 0, z: 0 }, to: { x: 60, z: 0 }, y: 10 };

  it('fits whole merlons across the run', () => {
    // 3-foot teeth on a 3-foot pitch: ten of them across sixty feet.
    expect(merlonCount(60, 3, 3)).toBe(10);
    const result = generateCrenellation(edge);
    expect(result.decor.filter((d) => d.kind === 'merlon')).toHaveLength(10);
  });

  it('centres the run so both ends read as a tooth', () => {
    const merlons = generateCrenellation(edge).decor.filter((d) => d.kind === 'merlon');
    const first = merlons[0]!;
    const last = merlons.at(-1)!;
    const leadIn = first.center.x - 1.5;
    const runOut = 60 - (last.center.x + 1.5);
    expect(leadIn).toBeCloseTo(runOut, 6);
  });

  it('sits the teeth on top of a solid parapet', () => {
    const result = generateCrenellation(edge, 3, 3, 4, { parapetHeight: 1 });
    const parapet = result.decor.find((d) => d.kind === 'parapet')!;
    const merlon = result.decor.find((d) => d.kind === 'merlon')!;
    expect(parapet.center.y).toBeCloseTo(10.5, 6);
    expect(merlon.center.y - merlon.size.y / 2).toBeCloseTo(11, 6);
  });

  it('emits nothing for a zero-length edge', () => {
    const empty = generateCrenellation({ from: { x: 0, z: 0 }, to: { x: 0, z: 0 }, y: 0 });
    expect(empty.decor).toEqual([]);
  });

  it('turns the teeth to follow the wall', () => {
    const alongZ = generateCrenellation({ from: { x: 0, z: 0 }, to: { x: 0, z: 40 }, y: 10 });
    const merlon = alongZ.decor.find((d) => d.kind === 'merlon')!;
    expect(merlon.rotationY).toBeCloseTo(-Math.PI / 2, 6);
  });
});

describe('tower', () => {
  it('stacks two containers per level, castings aligned', () => {
    const t = generateTower(0, 0, 3, '20ST', { idPrefix: 't' });
    expect(t.containers).toHaveLength(6);
    const levels = new Set(t.containers.map((c) => c.position.y));
    expect(levels.size).toBe(3);
    expect(findIntersections(t.containers)).toEqual([]);
  });

  it('lands every container on the grid', () => {
    const t = generateTower(-220, -16, 4, '20ST');
    for (const c of t.containers) {
      const snapped = snapPosition(c.position, c.type, c.rotation);
      expect([snapped.x, snapped.z]).toEqual([c.position.x, c.position.z]);
    }
  });

  it('crowns the tower and hangs bartizans off two corners', () => {
    const t = generateTower(0, 0, 2, '20ST');
    expect(t.decor.some((d) => d.kind === 'merlon')).toBe(true);
    expect(t.decor.filter((d) => d.kind === 'conicalRoof')).toHaveLength(2);
  });

  it('regenerates taller when asked for more levels', () => {
    expect(generateTower(0, 0, 5, '20ST').containers).toHaveLength(10);
  });
});

describe('great hall', () => {
  it('is the open span between two intact walls, not a hollowed-out row', () => {
    const hall = generateGreatHall(44, 160, 2, { origin: { x: 0, z: 0 } });
    expect(hall.containers).toHaveLength(16);
    // Not one cut in any of them: the span is doing the work, not the welder.
    expect(hall.containers.every((c) => c.openings.length === 0)).toBe(true);
  });

  it('puts the clear span between the wall faces', () => {
    const hall = generateGreatHall(44, 160, 1, { origin: { x: 0, z: 0 } });
    const zs = [...new Set(hall.containers.map((c) => c.position.z))].sort((a, b) => a - b);
    expect(zs).toHaveLength(2);
    expect(zs[1]! - (zs[0]! + dimsOf('40HC').width)).toBe(44);
  });

  it('spans the trusses across the hall, not along it', () => {
    const hall = generateGreatHall(44, 160, 2);
    const trusses = hall.decor.filter((d) => d.kind === 'truss');
    expect(trusses.length).toBeGreaterThan(2);
    expect(trusses[0]!.size.z).toBe(44);
  });

  it('flags a span the truss cannot carry cheaply', () => {
    expect(hallMetrics(44, 160).overSpan).toBe(false);
    expect(hallMetrics(HALL_SPAN_WARN_FT + 1, 160).overSpan).toBe(true);
  });

  it('rounds the length to whole container bays', () => {
    expect(hallMetrics(44, 150).lengthFt).toBe(160);
  });
});

describe('bawn', () => {
  const perimeter: Rect = { x: -200, z: 0, sizeX: 400, sizeZ: 200 };

  it('runs containers round the perimeter without overlapping at the corners', () => {
    const bawn = generateBawn(perimeter, 1, { idPrefix: 'b' });
    expect(findIntersections(bawn.containers)).toEqual([]);
    expect(bawn.containers.length).toBeGreaterThan(20);
  });

  it('leaves a gap for the gate and marks it', () => {
    const solid = generateBawn(perimeter, 1, { idPrefix: 'a' });
    const gated = generateBawn(perimeter, 1, { gateSide: 'south', gateBays: 2, idPrefix: 'c' });
    expect(gated.containers.length).toBe(solid.containers.length - 2);
    expect(gated.decor.some((d) => d.kind === 'gate')).toBe(true);
  });

  it('puts a wall walk behind the parapet on every run', () => {
    const bawn = generateBawn(perimeter, 1, { idPrefix: 'd' });
    expect(bawn.decor.filter((w) => w.kind === 'walkway')).toHaveLength(4);
  });

  it('doubles the container count when it doubles in height', () => {
    const one = generateBawn(perimeter, 1, { idPrefix: 'e' }).containers.length;
    const two = generateBawn(perimeter, 2, { idPrefix: 'f' }).containers.length;
    expect(two).toBe(one * 2);
  });
});

describe('batter', () => {
  it('leans a panel out on each side of the footprint', () => {
    const result = generateBatter({ x: 0, z: 0, sizeX: 100, sizeZ: 60 }, 1 / 6, 8);
    expect(result.decor).toHaveLength(4);
    expect(result.decor.every((d) => d.slope === Math.atan(1 / 6))).toBe(true);
    expect(rectEdges({ x: 0, z: 0, sizeX: 100, sizeZ: 60 }, 0)).toHaveLength(4);
  });

  it('measures the veneer along the slope, not the elevation', () => {
    const footprint = { x: 0, z: 0, sizeX: 100, sizeZ: 60 };
    const perimeter = 2 * (100 + 60);
    expect(batterVeneerSqFt(footprint, 1 / 6, 8)).toBeGreaterThan(perimeter * 8);
  });
});

describe('marina', () => {
  it('brackets every berth with a finger', () => {
    const m = generateMarina(ENHANCED_MARINA);
    const fingers = m.features.filter((f) => f.kind === 'dock' && f.role === 'finger');
    // One more finger than slips, on each of the two sides.
    expect(fingers).toHaveLength((ENHANCED_MARINA.slipsPerSide + 1) * 2);
    expect(m.slips).toHaveLength(ENHANCED_MARINA.slipsPerSide * 2);
  });

  it('numbers the slips from one, without gaps or repeats', () => {
    const m = generateMarina(ENHANCED_MARINA);
    const numbers = m.slips.map((s) => s.slipNumber).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: m.slips.length }, (_, i) => i + 1));
  });

  it('gives premier berths the patio, the toys and the bar', () => {
    const premier = generateMarina(ENHANCED_MARINA).slips.filter((s) => s.tier === 'premier');
    expect(premier).toHaveLength(ENHANCED_MARINA.premierSlipsPerSide * 2);
    expect(premier.every((s) => s.patio && s.ropeSwing && s.jumpPlatform && s.bar && s.furnished)).toBe(true);
  });

  it('gives the outer berths the premier tier, where the view is', () => {
    const m = generateMarina(ENHANCED_MARINA);
    const oneSide = m.slips.filter((s) => s.position.x > 0).sort((a, b) => a.position.z - b.position.z);
    expect(oneSide.at(-1)?.tier).toBe('premier');
    expect(oneSide[0]?.tier).toBe('standard');
  });

  it('leaves the existing marina plain', () => {
    const m = generateMarina(EXISTING_MARINA);
    expect(m.slips.every((s) => s.tier === 'standard')).toBe(true);
    expect(m.slips.some((s) => s.patio)).toBe(false);
    expect(m.features.some((f) => f.kind === 'overwaterStage')).toBe(false);
    expect(m.features.some((f) => f.kind === 'stringLights')).toBe(false);
  });

  it('builds out more berths than exist today', () => {
    expect(generateMarina(ENHANCED_MARINA).slips.length).toBeGreaterThan(
      generateMarina(EXISTING_MARINA).slips.length,
    );
  });
});

describe('spectacle', () => {
  it('spreads the fire pits evenly round the ring with different hues', () => {
    const pits = generateFirePitRing({
      center: { x: 0, z: 0 },
      ringRadiusFt: 40,
      count: 4,
      pitRadiusFt: 5,
      rainbow: true,
      startHue: 0,
    });
    expect(pits).toHaveLength(4);
    expect(pits.map((p) => p.hue)).toEqual([0, 90, 180, 270]);
    for (const p of pits) {
      expect(Math.hypot(p.position.x, p.position.z)).toBeCloseTo(40, 6);
    }
  });

  it('builds three land stages', () => {
    expect(generateLandStages()).toHaveLength(3);
  });
});

describe('accommodations', () => {
  it('zones every lodging container and its trim', () => {
    const result = generateAccommodations();
    expect(result.containers.every((c) => c.zone === 'lodging')).toBe(true);
    expect(result.decor.every((d) => d.zone === 'lodging')).toBe(true);
  });

  it('counts keys and beds without double-counting the tower suites', () => {
    const result = generateAccommodations();
    const suites = result.features.find((f) => f.style === 'towerSuite');
    expect(suites?.units).toBe(8);
    // Tower suites are fitted out inside castle containers, so they add none.
    const cabinsAndBunks = result.containers.length;
    expect(cabinsAndBunks).toBe(9 + 6);
  });

  it('places nothing inside anything else', () => {
    expect(findIntersections(generateAccommodations().containers)).toEqual([]);
  });
});
