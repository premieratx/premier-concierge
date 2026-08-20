import { CONTAINER_TYPES, dimsOf } from '../domain/dimensions';
import { CAMERA_PRESETS } from '../scene/cameraPresets';
import {
  ALL_LAYERS,
  LAYER_GROUPS,
  LAYER_LABELS,
  useLayoutStore,
} from '../store/useLayoutStore';
import { Button, Section } from './primitives';

/** Layer toggles, the container palette, and the named viewpoints. */
export function LayersPanel() {
  const layers = useLayoutStore((s) => s.layers);
  const toggleLayer = useLayoutStore((s) => s.toggleLayer);
  const setLayers = useLayoutStore((s) => s.setLayers);
  const cameraPreset = useLayoutStore((s) => s.cameraPreset);
  const setCameraPreset = useLayoutStore((s) => s.setCameraPreset);
  const addContainer = useLayoutStore((s) => s.addContainer);
  const loadProperty = useLayoutStore((s) => s.loadProperty);
  const loadSeed = useLayoutStore((s) => s.loadSeed);

  const onCount = ALL_LAYERS.filter((l) => layers[l]).length;

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

      <Section
        title={`Layers — ${onCount} of ${ALL_LAYERS.length} on`}
        subtitle="Everything in the model is on one of these"
      >
        <div className="flex gap-2 pb-1">
          <Button onClick={() => setLayers(ALL_LAYERS, true)}>All on</Button>
          <Button onClick={() => setLayers(ALL_LAYERS, false)}>All off</Button>
        </div>
        {LAYER_GROUPS.map((group) => {
          const allOn = group.layers.every((l) => layers[l]);
          return (
            <div key={group.title} className="pt-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {group.title}
                </span>
                <button
                  type="button"
                  onClick={() => setLayers(group.layers, !allOn)}
                  className="text-[11px] text-slate-500 hover:text-sky-400"
                >
                  {allOn ? 'none' : 'all'}
                </button>
              </div>
              {group.layers.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 py-0.5 text-sm text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() => toggleLayer(key)}
                    className="size-3.5 accent-sky-500"
                  />
                  {LAYER_LABELS[key]}
                </label>
              ))}
            </div>
          );
        })}
      </Section>

      <Section title="Palette" subtitle="Drops a container on the lawn, selected">
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
                  layer: 'curtainWall',
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
    </div>
  );
}
