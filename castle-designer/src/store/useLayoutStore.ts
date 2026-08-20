import { create } from 'zustand';
import { snapPosition } from '../domain/geometry';
import { makeId } from '../domain/ids';
import { generateProperty } from '../domain/property';
import { SEED_LAYOUT } from '../domain/seedLayout';
import type {
  Container,
  Layout,
  MarinaPhase,
  ModelLayer,
  Opening,
  Rotation,
  Vec3,
} from '../domain/types';
import type { PricingStrategy } from '../revenue/slips';

export type TimeOfDay = 'day' | 'dusk' | 'night';

/** Re-exported so panels do not have to reach into the domain for the type. */
export type LayerKey = ModelLayer;

export const LAYER_LABELS: Record<ModelLayer, string> = {
  curtainWall: 'Curtain wall',
  towers: 'Towers',
  greatHall: 'Great hall',
  keep: 'Keep',
  crenellation: 'Crenellation',
  wallWalk: 'Wall walk',
  bartizans: 'Bartizans',
  batter: 'Battered plinth',
  gate: 'Gatehouse',
  cabins: 'Lake cabins',
  bunkhouse: 'Bunkhouse',
  glamping: 'Canvas platforms',
  docks: 'Docks and fingers',
  slipsStandard: 'Standard slips',
  slipsPremier: 'Premier slips',
  patios: 'Over-slip patios',
  boats: 'Boats',
  swimToys: 'Swings and jump platforms',
  bars: 'Bars',
  furniture: 'Furniture',
  stages: 'Land stages',
  overwaterStage: 'Overwater stage',
  firePits: 'Fire pits',
  dragon: 'Dragon',
  dragonFire: 'Dragon fire',
  stringLights: 'Party lights',
  areaLighting: 'Area lighting',
  water: 'Water',
  grid: 'Grid',
  capacity: 'Capacity labels',
  edges: 'Edge outlines',
};

export interface LayerGroup {
  title: string;
  layers: ModelLayer[];
}

/** Layer toggles, grouped the way somebody actually thinks about the site. */
export const LAYER_GROUPS: LayerGroup[] = [
  {
    title: 'Castle',
    layers: ['curtainWall', 'towers', 'greatHall', 'keep', 'gate'],
  },
  {
    title: 'Castle trim',
    layers: ['crenellation', 'wallWalk', 'bartizans', 'batter'],
  },
  {
    title: 'Accommodations',
    layers: ['cabins', 'bunkhouse', 'glamping'],
  },
  {
    title: 'Marina',
    layers: ['docks', 'slipsStandard', 'slipsPremier', 'patios', 'boats', 'swimToys'],
  },
  {
    title: 'Programme',
    layers: ['stages', 'overwaterStage', 'bars', 'furniture'],
  },
  {
    title: 'Fire and light',
    layers: ['firePits', 'dragon', 'dragonFire', 'stringLights', 'areaLighting'],
  },
  {
    title: 'Site and overlays',
    layers: ['water', 'grid', 'capacity', 'edges'],
  },
];

export const ALL_LAYERS: ModelLayer[] = LAYER_GROUPS.flatMap((g) => g.layers);

function defaultLayers(): Record<ModelLayer, boolean> {
  const out = {} as Record<ModelLayer, boolean>;
  for (const layer of ALL_LAYERS) out[layer] = true;
  // The grid is a drafting aid, not part of the model.
  out.grid = false;
  return out;
}

const HISTORY_LIMIT = 60;

export interface LayoutState {
  layout: Layout;
  past: Layout[];
  future: Layout[];
  selectedIds: string[];
  timeOfDay: TimeOfDay;
  layers: Record<ModelLayer, boolean>;
  pricingStrategy: PricingStrategy;
  cameraPreset: string;

  setCameraPreset(key: string): void;
  select(id: string | null, additive?: boolean): void;
  selectMany(ids: string[]): void;
  setTimeOfDay(time: TimeOfDay): void;
  toggleLayer(layer: ModelLayer): void;
  setLayers(layers: ModelLayer[], on: boolean): void;
  setPricingStrategy(strategy: PricingStrategy): void;

  setMarinaPhase(phase: MarinaPhase): void;
  loadProperty(phase?: MarinaPhase): void;
  loadSeed(): void;
  replaceLayout(layout: Layout): void;

  addContainer(container: Omit<Container, 'id'> & { id?: string }): string;
  updateContainer(id: string, patch: Partial<Omit<Container, 'id'>>): void;
  moveContainer(id: string, position: Vec3, snap?: boolean): void;
  nudgeSelected(dx: number, dz: number): void;
  rotateSelected(): void;
  duplicateSelected(): void;
  removeSelected(): void;
  removeContainer(id: string): void;
  addOpening(containerId: string, opening: Omit<Opening, 'id'>): void;
  removeOpening(containerId: string, openingId: string): void;

  undo(): void;
  redo(): void;
  canUndo(): boolean;
  canRedo(): boolean;
}

export function cloneLayout(layout: Layout): Layout {
  return {
    ...layout,
    site: { ...layout.site },
    containers: layout.containers.map((c) => ({
      ...c,
      position: { ...c.position },
      openings: c.openings.map((o) => ({ ...o })),
    })),
    decor: layout.decor.map((d) => ({
      ...d,
      center: { ...d.center },
      size: { ...d.size },
    })),
    features: layout.features.map((f) =>
      f.kind === 'stringLights'
        ? { ...f, from: { ...f.from }, to: { ...f.to } }
        : { ...f, position: { ...f.position } },
    ),
  };
}

export const useLayoutStore = create<LayoutState>((set, get) => {
  /**
   * Push the current layout onto the undo stack and apply a change. Every
   * mutation goes through here so undo never misses one.
   */
  function commit(mutate: (layout: Layout) => Layout, extra: Partial<LayoutState> = {}) {
    set((state) => {
      const next = mutate(cloneLayout(state.layout));
      return {
        ...extra,
        layout: next,
        past: [...state.past, state.layout].slice(-HISTORY_LIMIT),
        future: [],
      };
    });
  }

  return {
    layout: generateProperty({ marinaPhase: 'enhanced' }),
    past: [],
    future: [],
    selectedIds: [],
    timeOfDay: 'dusk',
    layers: defaultLayers(),
    pricingStrategy: 'bundled',
    cameraPreset: 'property',

    setCameraPreset: (cameraPreset) => set({ cameraPreset }),

    select: (id, additive = false) =>
      set((state) => {
        if (!id) return { selectedIds: [] };
        if (!additive) return { selectedIds: [id] };
        return state.selectedIds.includes(id)
          ? { selectedIds: state.selectedIds.filter((s) => s !== id) }
          : { selectedIds: [...state.selectedIds, id] };
      }),

    selectMany: (ids) => set({ selectedIds: [...ids] }),

    setTimeOfDay: (timeOfDay) => set({ timeOfDay }),
    setPricingStrategy: (pricingStrategy) => set({ pricingStrategy }),
    toggleLayer: (layer) =>
      set((state) => ({ layers: { ...state.layers, [layer]: !state.layers[layer] } })),

    setLayers: (layers, on) =>
      set((state) => {
        const next = { ...state.layers };
        for (const layer of layers) next[layer] = on;
        return { layers: next };
      }),

    setMarinaPhase: (phase) => get().loadProperty(phase),

    loadProperty: (phase) =>
      set((state) => ({
        layout: generateProperty({ marinaPhase: phase ?? state.layout.site.marinaPhase }),
        past: [...state.past, state.layout].slice(-HISTORY_LIMIT),
        future: [],
        selectedIds: [],
      })),

    loadSeed: () =>
      set((state) => ({
        layout: cloneLayout(SEED_LAYOUT),
        past: [...state.past, state.layout].slice(-HISTORY_LIMIT),
        future: [],
        selectedIds: [],
      })),

    replaceLayout: (layout) =>
      set((state) => ({
        layout: cloneLayout(layout),
        past: [...state.past, state.layout].slice(-HISTORY_LIMIT),
        future: [],
        selectedIds: [],
      })),

    addContainer: (container) => {
      const id = container.id ?? makeId('c');
      commit(
        (layout) => ({
          ...layout,
          containers: [...layout.containers, { ...container, id } as Container],
        }),
        { selectedIds: [id] },
      );
      return id;
    },

    updateContainer: (id, patch) =>
      commit((layout) => ({
        ...layout,
        containers: layout.containers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      })),

    moveContainer: (id, position, snap = true) =>
      commit((layout) => ({
        ...layout,
        containers: layout.containers.map((c) =>
          c.id === id
            ? { ...c, position: snap ? snapPosition(position, c.type, c.rotation) : position }
            : c,
        ),
      })),

    nudgeSelected: (dx, dz) => {
      const { selectedIds } = get();
      if (selectedIds.length === 0) return;
      commit((layout) => ({
        ...layout,
        containers: layout.containers.map((c) =>
          selectedIds.includes(c.id)
            ? {
                ...c,
                position: { x: c.position.x + dx, y: c.position.y, z: c.position.z + dz },
              }
            : c,
        ),
      }));
    },

    rotateSelected: () => {
      const { selectedIds } = get();
      if (selectedIds.length === 0) return;
      commit((layout) => ({
        ...layout,
        containers: layout.containers.map((c) => {
          if (!selectedIds.includes(c.id)) return c;
          const rotation: Rotation = c.rotation === 0 ? 90 : 0;
          return { ...c, rotation, position: snapPosition(c.position, c.type, rotation) };
        }),
      }));
    },

    duplicateSelected: () => {
      const { selectedIds, layout } = get();
      if (selectedIds.length === 0) return;
      const copies: Container[] = [];
      for (const c of layout.containers) {
        if (!selectedIds.includes(c.id)) continue;
        copies.push({
          ...c,
          id: makeId('c'),
          // Offset by one container width so the copy is visible and still
          // lands on the grid.
          position: { ...c.position, z: c.position.z + 8 },
          openings: c.openings.map((o) => ({ ...o, id: makeId('o') })),
          ...(c.label ? { label: `${c.label} copy` } : {}),
        });
      }
      commit(
        (l) => ({ ...l, containers: [...l.containers, ...copies] }),
        { selectedIds: copies.map((c) => c.id) },
      );
    },

    removeSelected: () => {
      const { selectedIds } = get();
      if (selectedIds.length === 0) return;
      commit(
        (layout) => ({
          ...layout,
          containers: layout.containers.filter((c) => !selectedIds.includes(c.id)),
        }),
        { selectedIds: [] },
      );
    },

    addOpening: (containerId, opening) =>
      commit((layout) => ({
        ...layout,
        containers: layout.containers.map((c) =>
          c.id === containerId
            ? { ...c, openings: [...c.openings, { ...opening, id: makeId('o') }] }
            : c,
        ),
      })),

    removeOpening: (containerId, openingId) =>
      commit((layout) => ({
        ...layout,
        containers: layout.containers.map((c) =>
          c.id === containerId
            ? { ...c, openings: c.openings.filter((o) => o.id !== openingId) }
            : c,
        ),
      })),

    removeContainer: (id) =>
      commit(
        (layout) => ({
          ...layout,
          containers: layout.containers.filter((c) => c.id !== id),
        }),
        { selectedIds: get().selectedIds.filter((s) => s !== id) },
      ),

    undo: () =>
      set((state) => {
        const previous = state.past.at(-1);
        if (!previous) return state;
        return {
          layout: previous,
          past: state.past.slice(0, -1),
          future: [state.layout, ...state.future].slice(0, HISTORY_LIMIT),
          selectedIds: [],
        };
      }),

    redo: () =>
      set((state) => {
        const next = state.future[0];
        if (!next) return state;
        return {
          layout: next,
          past: [...state.past, state.layout].slice(-HISTORY_LIMIT),
          future: state.future.slice(1),
          selectedIds: [],
        };
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,
  };
});

export const selectContainers = (s: LayoutState) => s.layout.containers;
export const selectSelectedIds = (s: LayoutState) => s.selectedIds;
