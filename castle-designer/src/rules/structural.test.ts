import { describe, expect, it } from 'vitest';
import { generateProperty } from '../domain/property';
import type { Container, Decor, Layout } from '../domain/types';
import {
  CANTILEVER_LIMIT,
  OPENING_ERROR_PCT,
  checkCantilever,
  checkCornerAlignment,
  checkOpeningArea,
  checkOverlap,
  checkRoofLoads,
  checkSealedEnvelope,
  checkStackHeight,
  checkWeldingBudget,
  runAllChecks,
  transferBeamFor,
} from './structural';

function box(id: string, overrides: Partial<Container> = {}): Container {
  return {
    id,
    type: '40HC',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    role: 'structural',
    finish: 'painted',
    openings: [],
    ...overrides,
  };
}

function layoutOf(containers: Container[], decor: Decor[] = []): Layout {
  return {
    version: 1,
    id: 'test',
    name: 'test',
    units: 'ft',
    containers,
    decor,
    features: [],
    site: {
      sizeX: 400,
      sizeZ: 400,
      shorelineZ: 300,
      waterLevelFt: -6,
      marinaPhase: 'existing',
      terrain: 'flat',
    },
  };
}

describe('R0 overlap', () => {
  it('passes when nothing shares volume', () => {
    expect(checkOverlap([box('a'), box('b', { position: { x: 40, y: 0, z: 0 } })])[0]?.severity).toBe('pass');
  });

  it('errors on shared volume', () => {
    const v = checkOverlap([box('a'), box('b', { position: { x: 20, y: 0, z: 0 } })]);
    expect(v[0]?.severity).toBe('error');
    expect(v[0]?.containerIds).toEqual(['a', 'b']);
  });
});

describe('R1 corner alignment', () => {
  it('passes when a stack lands casting on casting', () => {
    const v = checkCornerAlignment([box('a'), box('b', { position: { x: 0, y: 9.5, z: 0 } })]);
    expect(v[0]?.severity).toBe('pass');
  });

  it('errors and names a transfer beam when the stack steps', () => {
    const v = checkCornerAlignment([box('a'), box('b', { position: { x: 8, y: 9.5, z: 0 } })]);
    expect(v[0]?.severity).toBe('error');
    expect(v[0]?.message).toContain('transfer beam');
    expect(v[0]?.costImpact).toBeGreaterThan(0);
  });

  it('scales the beam with the offset', () => {
    expect(transferBeamFor(3)).toContain('W10x33');
    expect(transferBeamFor(7)).toContain('W12x50');
    expect(transferBeamFor(20)).toContain('truss');
  });
});

describe('R2 stack height', () => {
  const column = (levels: number) =>
    Array.from({ length: levels }, (_, i) => box(`c${i}`, { position: { x: 0, y: i * 9.5, z: 0 } }));

  it('passes at two levels', () => {
    expect(checkStackHeight(column(2))[0]?.severity).toBe('pass');
  });

  it('warns at three', () => {
    expect(checkStackHeight(column(3))[0]?.severity).toBe('warning');
  });

  it('still warns at four', () => {
    expect(checkStackHeight(column(4))[0]?.severity).toBe('warning');
  });

  it('errors above four', () => {
    const v = checkStackHeight(column(5));
    expect(v[0]?.severity).toBe('error');
    expect(v[0]?.message).toContain('5 containers deep');
  });
});

describe('R3 opening area', () => {
  const wallSqFt = 40 * 9.5;

  it('passes below 30% of a side wall', () => {
    const c = box('a', {
      openings: [{ id: 'o', face: 'sideA', width: 10, height: 8, offsetU: 0, offsetV: 0 }],
    });
    expect((10 * 8) / wallSqFt).toBeLessThan(0.3);
    expect(checkOpeningArea([c])[0]?.severity).toBe('pass');
  });

  it('warns above 30%', () => {
    const c = box('a', {
      openings: [{ id: 'o', face: 'sideA', width: 20, height: 8, offsetU: 0, offsetV: 0 }],
    });
    expect(checkOpeningArea([c])[0]?.severity).toBe('warning');
  });

  it('errors above 50%', () => {
    const c = box('a', {
      openings: [{ id: 'o', face: 'sideA', width: 30, height: 8, offsetU: 0, offsetV: 0 }],
    });
    expect((30 * 8) / wallSqFt).toBeGreaterThan(OPENING_ERROR_PCT);
    const v = checkOpeningArea([c]);
    expect(v[0]?.severity).toBe('error');
    expect(v[0]?.message).toContain('shear diaphragm');
  });

  it('sums several cuts in the same wall', () => {
    const c = box('a', {
      openings: [
        { id: 'o1', face: 'sideA', width: 10, height: 8, offsetU: 0, offsetV: 0 },
        { id: 'o2', face: 'sideA', width: 10, height: 8, offsetU: 14, offsetV: 0 },
      ],
    });
    expect(checkOpeningArea([c])[0]?.severity).toBe('warning');
  });
});

describe('R5 welding budget', () => {
  const bigOpening = (i: number) => ({
    id: `o${i}`,
    face: 'sideA' as const,
    width: 6,
    height: 7,
    offsetU: 0,
    offsetV: 0,
    label: `cut ${i}`,
  });

  it('passes well under the cap', () => {
    const c = box('a', { openings: [bigOpening(0)] });
    expect(checkWeldingBudget([c])[0]?.severity).toBe('pass');
  });

  it('errors above 526 hours and names what to cut', () => {
    // 30 large openings is 540 hours, just past the cap.
    const containers = Array.from({ length: 30 }, (_, i) =>
      box(`c${i}`, { position: { x: i * 40, y: 0, z: 0 }, openings: [bigOpening(i)] }),
    );
    const v = checkWeldingBudget(containers);
    expect(v[0]?.severity).toBe('error');
    expect(v[0]?.message).toContain('over the cap');
    expect(v[0]?.message).toContain('cut 0');
  });

  it('mentions hours budgeted outside the castle zone', () => {
    const v = checkWeldingBudget([box('a', { openings: [bigOpening(0)] })], 120);
    expect(v[0]?.message).toContain('outside the castle zone');
  });
});

describe('R6 roof loads', () => {
  it('passes with a bare roof', () => {
    expect(checkRoofLoads([box('a')], [])[0]?.severity).toBe('pass');
  });

  it('warns and prices framing when a deck sits on a container roof', () => {
    const decor: Decor[] = [
      {
        id: 'd',
        kind: 'deck',
        center: { x: 20, y: 9.8, z: 4 },
        size: { x: 40, y: 0.6, z: 8 },
      },
    ];
    const v = checkRoofLoads([box('a')], decor);
    expect(v[0]?.severity).toBe('warning');
    expect(v[0]?.costImpact).toBeGreaterThan(0);
  });
});

describe('R7 cantilever', () => {
  it('passes with full support', () => {
    const v = checkCantilever([box('a'), box('b', { position: { x: 0, y: 9.5, z: 0 } })]);
    expect(v[0]?.severity).toBe('pass');
  });

  it('errors past a quarter of the length', () => {
    // Half the upper box hangs off the end of the lower one.
    const v = checkCantilever([box('a'), box('b', { position: { x: 20, y: 9.5, z: 0 } })]);
    expect(v[0]?.severity).toBe('error');
    expect(0.5).toBeGreaterThan(CANTILEVER_LIMIT);
  });
});

describe('R8 sealed envelope', () => {
  it('passes when sealed boxes only touch sealed boxes', () => {
    const v = checkSealedEnvelope([
      box('a', { role: 'sealed' }),
      box('b', { role: 'sealed', position: { x: 0, y: 0, z: 8 } }),
    ]);
    expect(v[0]?.severity).toBe('pass');
  });

  it('warns where a sealed box meets an open-air one', () => {
    const v = checkSealedEnvelope([
      box('a', { role: 'sealed' }),
      box('b', { role: 'structural', position: { x: 0, y: 0, z: 8 } }),
    ]);
    expect(v[0]?.severity).toBe('warning');
    expect(v[0]?.containerIds).toContain('a');
  });
});

describe('runAllChecks', () => {
  it('paints only errors red, never warnings', () => {
    // The wall walk names every curtain container under rule R6. That is a
    // priced, expected warning, and turning the whole castle red for it would
    // bury the findings that actually stop the build.
    const result = runAllChecks(generateProperty());
    expect(result.warningContainerIds.size).toBeGreaterThan(0);
    expect(result.errorContainerIds.size).toBe(0);
  });

  it('flags every container named by an error or a warning', () => {
    const result = runAllChecks(
      layoutOf([box('a'), box('b', { position: { x: 20, y: 0, z: 0 } })]),
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errorContainerIds.has('a')).toBe(true);
  });

  it('never flags a container for a passing rule', () => {
    const result = runAllChecks(layoutOf([box('a')]));
    expect(result.errors).toHaveLength(0);
    expect(result.errorContainerIds.size).toBe(0);
  });

  it('leaves the generated property free of errors', () => {
    const result = runAllChecks(generateProperty());
    expect(result.errors.map((e) => `${e.rule}: ${e.message}`)).toEqual([]);
  });

  it('finds the wall walk bearing on the curtain wall roofs', () => {
    // The walkway behind the crenellation puts people on container roofs,
    // which are rated for snow and not for a crowd.
    const result = runAllChecks(generateProperty());
    expect(result.warnings.map((w) => w.rule)).toContain('R6');
  });
});
