import { describe, expect, it } from 'vitest';
import { generateProperty } from '../domain/property';
import { SEED_LAYOUT } from '../domain/seedLayout';
import { deserializeLayout, LayoutParseError, serializeLayout } from './serialize';

describe('round trip', () => {
  it('survives the seed layout unchanged', () => {
    const restored = deserializeLayout(serializeLayout(SEED_LAYOUT));
    expect(restored).toEqual(SEED_LAYOUT);
  });

  it('survives the whole generated property unchanged', () => {
    const layout = generateProperty({ marinaPhase: 'enhanced' });
    const restored = deserializeLayout(serializeLayout(layout));
    expect(restored).toEqual(layout);
    expect(restored.containers.length).toBe(layout.containers.length);
    expect(restored.decor.length).toBe(layout.decor.length);
    expect(restored.features.length).toBe(layout.features.length);
  });

  it('writes JSON that diffs line by line', () => {
    const json = serializeLayout(SEED_LAYOUT);
    expect(json.split('\n').length).toBeGreaterThan(20);
    expect(json.endsWith('\n')).toBe(true);
  });
});

describe('parsing', () => {
  it('rejects text that is not JSON', () => {
    expect(() => deserializeLayout('{ nope')).toThrow(LayoutParseError);
  });

  it('rejects units other than feet', () => {
    expect(() => deserializeLayout('{"units":"m","containers":[]}')).toThrow(/feet/);
  });

  it('rejects a future schema version', () => {
    expect(() => deserializeLayout('{"version":99,"containers":[]}')).toThrow(/version/);
  });

  it('rejects an unknown container type', () => {
    const json = JSON.stringify({
      containers: [{ id: 'a', type: '53FT', rotation: 0, position: { x: 0, y: 0, z: 0 } }],
    });
    expect(() => deserializeLayout(json)).toThrow(/unknown type/);
  });

  it('rejects free rotation', () => {
    const json = JSON.stringify({
      containers: [{ id: 'a', type: '40HC', rotation: 45, position: { x: 0, y: 0, z: 0 } }],
    });
    expect(() => deserializeLayout(json)).toThrow(/rotation must be 0 or 90/);
  });

  it('loads a layout saved before decor and site features existed', () => {
    const json = JSON.stringify({
      id: 'old',
      name: 'Old file',
      containers: [
        {
          id: 'a',
          type: '40HC',
          rotation: 0,
          position: { x: 0, y: 0, z: 0 },
          role: 'structural',
          finish: 'painted',
        },
      ],
    });
    const layout = deserializeLayout(json);
    expect(layout.containers[0]?.openings).toEqual([]);
    expect(layout.decor).toEqual([]);
    expect(layout.features).toEqual([]);
    expect(layout.site.marinaPhase).toBe('enhanced');
  });
});
