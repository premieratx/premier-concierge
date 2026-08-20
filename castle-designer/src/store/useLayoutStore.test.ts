import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_LAYOUT } from '../domain/seedLayout';
import type { Container } from '../domain/types';
import { useLayoutStore } from './useLayoutStore';

const newContainer: Omit<Container, 'id'> = {
  type: '20ST',
  position: { x: 800, y: 0, z: 0 },
  rotation: 0,
  role: 'structural',
  finish: 'painted',
  openings: [],
};

describe('useLayoutStore', () => {
  beforeEach(() => {
    useLayoutStore.setState({ past: [], future: [], selectedIds: [] });
    useLayoutStore.getState().loadSeed();
    useLayoutStore.setState({ past: [], future: [] });
  });

  it('starts a session on the generated property', () => {
    // The seed is loaded per test; the initial state is the whole property.
    expect(useLayoutStore.getState().layout.containers.length).toBe(6);
  });

  it('never mutates the seed constant', () => {
    const store = useLayoutStore.getState();
    const first = store.layout.containers[0]!;
    store.updateContainer(first.id, { position: { x: 999, y: 0, z: 0 } });
    expect(SEED_LAYOUT.containers[0]!.position.x).toBe(0);
  });

  it('adds, selects and removes containers', () => {
    const id = useLayoutStore.getState().addContainer(newContainer);
    expect(useLayoutStore.getState().layout.containers).toHaveLength(7);
    expect(useLayoutStore.getState().selectedIds).toEqual([id]);

    useLayoutStore.getState().removeContainer(id);
    expect(useLayoutStore.getState().layout.containers).toHaveLength(6);
  });

  it('undoes and redoes an edit', () => {
    const store = useLayoutStore.getState();
    store.addContainer(newContainer);
    expect(useLayoutStore.getState().layout.containers).toHaveLength(7);

    useLayoutStore.getState().undo();
    expect(useLayoutStore.getState().layout.containers).toHaveLength(6);

    useLayoutStore.getState().redo();
    expect(useLayoutStore.getState().layout.containers).toHaveLength(7);
  });

  it('snaps a move to the grid', () => {
    const store = useLayoutStore.getState();
    const target = store.layout.containers[0]!;
    store.moveContainer(target.id, { x: 37, y: 0, z: 5 });
    const moved = useLayoutStore.getState().layout.containers.find((c) => c.id === target.id)!;
    expect(moved.position).toEqual({ x: 40, y: 0, z: 8 });
  });

  it('re-snaps when rotating, because the module changes with the axis', () => {
    const store = useLayoutStore.getState();
    const target = store.layout.containers.find((c) => c.type === '40HC')!;
    store.select(target.id);
    store.moveContainer(target.id, { x: 40, y: 0, z: 24 });
    useLayoutStore.getState().rotateSelected();
    const rotated = useLayoutStore.getState().layout.containers.find((c) => c.id === target.id)!;
    expect(rotated.rotation).toBe(90);
    // At 90 degrees the long axis runs along Z, so Z snaps to 40 and X to 8.
    expect(rotated.position.x % 8).toBe(0);
    expect(rotated.position.z % 40).toBe(0);
  });

  it('duplicates the selection with fresh ids', () => {
    const store = useLayoutStore.getState();
    const target = store.layout.containers[0]!;
    store.select(target.id);
    useLayoutStore.getState().duplicateSelected();

    const state = useLayoutStore.getState();
    expect(state.layout.containers).toHaveLength(7);
    const copy = state.layout.containers.at(-1)!;
    expect(copy.id).not.toBe(target.id);
    expect(copy.openings.every((o) => target.openings.every((t) => t.id !== o.id))).toBe(true);
  });

  it('adds and removes openings, which is what drives the welding budget', () => {
    const store = useLayoutStore.getState();
    const target = store.layout.containers[1]!;
    store.addOpening(target.id, { face: 'sideA', width: 6, height: 7, offsetU: 4, offsetV: 0 });

    const withOpening = useLayoutStore.getState().layout.containers.find((c) => c.id === target.id)!;
    expect(withOpening.openings).toHaveLength(1);

    useLayoutStore.getState().removeOpening(target.id, withOpening.openings[0]!.id);
    expect(
      useLayoutStore.getState().layout.containers.find((c) => c.id === target.id)!.openings,
    ).toHaveLength(0);
  });

  it('toggles layers independently', () => {
    const store = useLayoutStore.getState();
    expect(store.layers.dragon).toBe(true);
    store.toggleLayer('dragon');
    expect(useLayoutStore.getState().layers.dragon).toBe(false);
    expect(useLayoutStore.getState().layers.marina).toBe(true);
  });
});
