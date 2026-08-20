import { useMemo } from 'react';
import {
  capacitySummary,
  LOAD_FACTOR_SQFT,
  propertyAreas,
  USE_COLOR,
  USE_LABEL,
  type OccupancyUse,
} from '../domain/areas';
import { LAYER_LABELS, useLayoutStore } from '../store/useLayoutStore';
import { Row, Section, num } from './primitives';

const USE_ORDER: OccupancyUse[] = [
  'assemblyStanding',
  'assemblyUnconcentrated',
  'assemblyConcentrated',
  'dock',
  'business',
  'lodging',
  'swim',
];

function Swatch({ use }: { use: OccupancyUse }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: USE_COLOR[use] }}
    />
  );
}

/**
 * Capacity by area, with the key the 3D labels are drawn from.
 *
 * Occupant load only. It says how many people the floor area allows and
 * nothing about whether the doors, the parking, the water or the septic can
 * match it — and on a site like this one of those will bind long before the
 * square footage does.
 */
export function CapacityPanel() {
  const layout = useLayoutStore((s) => s.layout);
  const layers = useLayoutStore((s) => s.layers);
  const toggleLayer = useLayoutStore((s) => s.toggleLayer);

  const areas = useMemo(() => propertyAreas(layout), [layout]);
  const summary = useMemo(() => capacitySummary(areas), [areas]);

  const byUse = useMemo(
    () =>
      USE_ORDER.map((use) => ({
        use,
        areas: areas.filter((a) => a.use === use),
      })).filter((g) => g.areas.length > 0),
    [areas],
  );

  return (
    <div className="space-y-6">
      <Section title="Totals">
        <Row label="Assembly, at once" value={num(summary.assembly)} emphasis />
        <Row label="Heads in beds" value={num(summary.beds)} />
        <Row label="On the docks" value={num(summary.dock)} />
        <Row label="Back of house" value={num(summary.business)} />
        <Row label="In the lagoons" value={num(summary.swim)} />
        <Row label="Areas measured" value={`${areas.length} · ${num(summary.totalSqFt)} sf`} />
      </Section>

      <Section title="Key" subtitle="Square feet per person, by use">
        {USE_ORDER.map((use) => (
          <div key={use} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-slate-300">
              <Swatch use={use} />
              {USE_LABEL[use]}
            </span>
            <span className="font-mono text-slate-400">
              {use === 'lodging' ? 'beds' : `${LOAD_FACTOR_SQFT[use]} sf/person`}
            </span>
          </div>
        ))}
      </Section>

      {byUse.map((group) => (
        <Section key={group.use} title={USE_LABEL[group.use]}>
          {group.areas.map((a) => (
            <div key={a.id} className="rounded border border-slate-800 bg-slate-900/50 p-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-slate-200">
                  <Swatch use={a.use} />
                  {a.name}
                </span>
                <span
                  className="font-mono text-base font-semibold tabular-nums"
                  style={{ color: USE_COLOR[a.use] }}
                >
                  {num(a.capacity)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {num(a.sqFt)} sf gross · {(a.usableFraction * 100).toFixed(0)}% occupiable
                {a.note ? ` · ${a.note}` : ''}
              </p>
              <button
                type="button"
                onClick={() => toggleLayer(a.layer)}
                className="mt-1.5 text-[11px] font-medium text-sky-400 hover:text-sky-300"
              >
                {layers[a.layer] ? 'Hide' : 'Show'} {LAYER_LABELS[a.layer]}
              </button>
            </div>
          ))}
        </Section>
      ))}

      <p className="text-[11px] leading-relaxed text-slate-600">
        Occupant load per IBC Table 1004.5. This is a check on the programme, not an egress
        design — door and stair widths, travel distances, parking, water and septic are all
        unmodelled, and one of them will cap this site well before the floor area does.
      </p>
    </div>
  );
}
