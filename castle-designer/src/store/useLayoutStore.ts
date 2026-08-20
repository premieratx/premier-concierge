import { create } from 'zustand';
import { makeId } from '../domain/ids';
import { SEED_LAYOUT } from '../domain/seedLayout';
import type { Container, Layout } from '../domain/types';

export interface LayoutState {
  layout: Layout;
  /** Ids of the currently selected containers. Phase 2 makes this multi-select. */
  selectedIds: string[];
  /** Whether the 3D view draws edge outlines. */
  showEdges: boolean;

  select(id: string | null): void;
  setShowEdges(show: boolean): void;

  addContainer(container: Omit<Container, 'id'> & { id?: string }): string;
  updateContainer(id: string, patch: Partial<Omit<Container, 'id'>>): void;
  removeContainer(id: string): void;
  replaceLayout(layout: Layout): void;
  resetToSeed(): void;
}

/** Deep-ish clone so the seed constant is never mutated by store edits. */
function cloneLayout(layout: Layout): Layout {
  return {
    ...layout,
    containers: layout.containers.map((c) => ({
      ...c,
      position: { ...c.position },
      openings: c.openings.map((o) => ({ ...o })),
    })),
  };
}

export const useLayoutStore = create<LayoutState>((set) => ({
  layout: cloneLayout(SEED_LAYOUT),
  selectedIds: [],
  showEdges: true,

  select: (id) => set({ selectedIds: id ? [id] : [] }),

  setShowEdges: (showEdges) => set({ showEdges }),

  addContainer: (container) => {
    const id = container.id ?? makeId('c');
    set((state) => ({
      layout: {
        ...state.layout,
        containers: [...state.layout.containers, { ...container, id } as Container],
      },
      selectedIds: [id],
    }));
    return id;
  },

  updateContainer: (id, patch) =>
    set((state) => ({
      layout: {
        ...state.layout,
        containers: state.layout.containers.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        ),
      },
    })),

  removeContainer: (id) =>
    set((state) => ({
      layout: {
        ...state.layout,
        containers: state.layout.containers.filter((c) => c.id !== id),
      },
      selectedIds: state.selectedIds.filter((s) => s !== id),
    })),

  replaceLayout: (layout) => set({ layout: cloneLayout(layout), selectedIds: [] }),

  resetToSeed: () => set({ layout: cloneLayout(SEED_LAYOUT), selectedIds: [] }),
}));

/** Selector helpers, kept out of components so subscriptions stay narrow. */
export const selectContainers = (s: LayoutState) => s.layout.containers;
export const selectSelectedIds = (s: LayoutState) => s.selectedIds;
