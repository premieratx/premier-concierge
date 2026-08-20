import { beforeEach, describe, expect, it } from 'vitest';
import { SEED_LAYOUT } from '../domain/seedLayout';
import type { Container } from '../domain/types';
import { useLayoutStore } from './useLayoutStore';

const newContainer: Omit<Container, 'id'> = {
  type: '20ST',
  position: { x: 80, y: 0, z: 0 },
  rotation: 0,
  role: 'structural',
  finish: 'painted',
  openings: [],
};

describe('useLayoutStore', () => {
  beforeEach(() => {
    useLayoutStore.getState().resetToSeed();
  });

  it('starts from the seed layout', () => {
    expect(useLayoutStore.getState().layout.containers).toHaveLength(6);
  });

  it('never mutates the seed constant', () => {
    const store = useLayoutStore.getState();
    const first = store.layout.containers[0]!;
    store.updateContainer(first.id, { position: { x: 999, y: 0, z: 0 } });
    expect(SEED_LAYOUT.containers[0]!.position.x).toBe(0);
  });

  it('adds, selects, and removes containers', () => {
    const id = useLayoutStore.getState().addContainer(newContainer);
    expect(useLayoutStore.getState().layout.containers).toHaveLength(7);
    expect(useLayoutStore.getState().selectedIds).toEqual([id]);

    useLayoutStore.getState().removeContainer(id);
    expect(useLayoutStore.getState().layout.containers).toHaveLength(6);
    expect(useLayoutStore.getState().selectedIds).toEqual([]);
  });

  it('honours an explicit id when one is supplied', () => {
    const id = useLayoutStore.getState().addContainer({ ...newContainer, id: 'fixed-id' });
    expect(id).toBe('fixed-id');
  });

  it('clears selection when the selection is cleared', () => {
    const store = useLayoutStore.getState();
    store.select(store.layout.containers[2]!.id);
    expect(useLayoutStore.getState().selectedIds).toHaveLength(1);
    store.select(null);
    expect(useLayoutStore.getState().selectedIds).toEqual([]);
  });
});
