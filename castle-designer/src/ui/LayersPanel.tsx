import { CONTAINER_TYPES, dimsOf } from '../domain/dimensions';
import { featuresOfKind } from '../domain/types';
import { CAMERA_PRESETS } from '../scene/cameraPresets';
import { LAYER_LABELS, useLayoutStore, type LayerKey } from '../store/useLayoutStore';
import { Button, Row, Section, num } from './primitives';

const LAYER_ORDER: LayerKey[] = [
  'castle',
  'decor',
  'lodging',
  'marina',
  'stages',
  'dragon',
  'fire',
  'lights',
  'water',
  'grid',
];

/** Layer toggles, the container palette, and the named viewpoints. */
export function LayersPanel() {
  const layers = useLayoutStore((s) => s.layers);
  const toggleLayer = useLayoutStore((s) => s.toggleLayer);
  const showEdges = useLayoutStore((s) => s.showEdges);
  const setShowEdges = useLayoutStore((s) => s.setShowEdges);
  const cameraPreset = useLayoutStore((s) => s.cameraPreset);
  const setCameraPreset = useLayoutStore((s) => s.setCameraPreset);
  const addContainer = useLayoutStore((s) => s.addContainer);
  const loadProperty = useLayoutStore((s) => s.loadProperty);
  const loadSeed = useLayoutStore((s) => s.loadSeed);
  const layout = useLayoutStore((s) => s.layout);

  const lodging = featuresOfKind(layout.features, 'accommodation');
  const keys = lodging.reduce((a, l) => a + l.units, 0);
  const sleeps = lodging.reduce((a, l) => a + l.sleeps, 0);

  return (
    <div className="space-y-6">
      <Section title="Viewpoint">
        <div className="grid grid-cols-2 gap-1.5">
          {CAMERA_PRESETS.map((p) => (
            <Button
              key={p.key}
              active={cameraPreset === p.key}
              onClick={() => setCameraPreset(p.key)}
              title={p.hint}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Layers">
        {LAYER_ORDER.map((key) => (
          <label key={key} className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={layers[key]}
              onChange={() => toggleLayer(key)}
              className="size-3.5 accent-sky-500"
            />
            {LAYER_LABELS[key]}
          </label>
        ))}
        <label className="flex items-center gap-2 pt-1 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={showEdges}
            onChange={(e) => setShowEdges(e.target.checked)}
            className="size-3.5 accent-sky-500"
          />
          Edge outlines
        </label>
      </Section>

      <Section title="Palette" subtitle="Drops a container at the origin, selected">
        <div className="flex gap-2">
          {CONTAINER_TYPES.map((type) => (
            <Button
              key={type}
              onClick={() =>
                addContainer({
                  type,
                  position: { x: 0, y: 0, z: 240 },
                  rotation: 0,
                  role: 'structural',
                  finish: 'painted',
                  openings: [],
                  zone: 'castle',
                  label: `New ${type}`,
                })
              }
            >
              + {dimsOf(type).label}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Model" subtitle="Regenerate from the parametric definition">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => loadProperty()}>Rebuild property</Button>
          <Button onClick={loadSeed} title="Two hall walls and a corner tower">
            Six-container fragment
          </Button>
        </div>
      </Section>

      <Section title="Lodging programme">
        {lodging.map((l) => (
          <Row key={l.id} label={l.name} value={`${num(l.units)} keys · sleeps ${num(l.sleeps)}`} />
        ))}
        <div className="my-2 h-px bg-slate-800" />
        <Row label="Total keys" value={num(keys)} emphasis />
        <Row label="Heads in beds" value={num(sleeps)} />
      </Section>
    </div>
  );
}
