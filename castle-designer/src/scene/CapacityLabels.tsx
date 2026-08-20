import { Html } from '@react-three/drei';
import { useMemo } from 'react';
import { propertyAreas, USE_COLOR } from '../domain/areas';
import type { Layout, ModelLayer } from '../domain/types';

/**
 * Occupancy chips floating over each area, colour-coded by use so the
 * three-dimensional model and the key in the panel agree.
 *
 * A chip only appears when the layer its area belongs to is switched on —
 * turn off the marina and its capacities go with it, which is the point of
 * having the two systems share a layer vocabulary.
 */
export function CapacityLabels({
  layout,
  layers,
}: {
  layout: Layout;
  layers: Record<ModelLayer, boolean>;
}) {
  const areas = useMemo(() => propertyAreas(layout), [layout]);

  return (
    <group>
      {areas
        .filter((a) => layers[a.layer])
        .map((a) => (
          <Html
            key={a.id}
            position={[a.anchor.x, a.anchor.y, a.anchor.z]}
            center
            zIndexRange={[40, 0]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                padding: '3px 8px',
                borderRadius: 999,
                background: 'rgba(8,12,18,0.82)',
                border: `1px solid ${USE_COLOR[a.use]}`,
                color: '#e6edf5',
                font: '600 11px/1.1 ui-sans-serif, system-ui, sans-serif',
                letterSpacing: '0.01em',
                boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: USE_COLOR[a.use],
                  flex: '0 0 auto',
                }}
              />
              {a.name}
              <span style={{ color: USE_COLOR[a.use], fontVariantNumeric: 'tabular-nums' }}>
                {a.capacity.toLocaleString('en-US')}
              </span>
            </div>
          </Html>
        ))}
    </group>
  );
}
