import { useMemo } from 'react';
import { dimsOf, INTERIOR_WIDTH_FT } from '../domain/dimensions';
import { boxOf, faceSqFt, openingSqFt } from '../domain/geometry';
import type { ContainerRole, Finish, Opening, WallFace } from '../domain/types';
import { isLargeOpening, weldingHoursFor } from '../rules/welding';
import { useLayoutStore } from '../store/useLayoutStore';
import { Button, Row, Section, num } from './primitives';

const ROLES: ContainerRole[] = ['structural', 'sealed', 'wall', 'tower'];
const FINISHES: Finish[] = ['painted', 'stone'];

/**
 * Stock openings, sized the way they are actually drawn.
 *
 * Anything over three feet in either direction is an eighteen-hour frame, so
 * the arrow slit is genuinely three times cheaper than the window next to it —
 * which is the lesson.
 */
const OPENING_PRESETS: { label: string; face: WallFace; width: number; height: number }[] = [
  { label: 'Arrow slit 1′×3′', face: 'sideA', width: 1, height: 3 },
  { label: 'Porthole 2′×2′', face: 'sideA', width: 2, height: 2 },
  { label: 'Window 4′×4′', face: 'sideA', width: 4, height: 4 },
  { label: 'Door 3½′×7′', face: 'sideA', width: 3.5, height: 7 },
  { label: 'Glazing 10′×7′', face: 'sideB', width: 10, height: 7 },
  { label: 'Great opening 20′×8′', face: 'sideB', width: 20, height: 8 },
];

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange(v: number): void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-right font-mono text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
      />
    </label>
  );
}

function OpeningRow({ containerId, opening, wallSqFt }: { containerId: string; opening: Opening; wallSqFt: number }) {
  const removeOpening = useLayoutStore((s) => s.removeOpening);
  const area = openingSqFt(opening);
  const hours = weldingHoursFor(opening);

  return (
    <div className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900/50 px-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-xs text-slate-300">
          {opening.label ?? `${opening.width}′ × ${opening.height}′`}
        </p>
        <p className="text-[11px] text-slate-500">
          {opening.face} · {num(area)} sf · {((area / wallSqFt) * 100).toFixed(0)}% of wall ·{' '}
          <span className={isLargeOpening(opening) ? 'text-amber-400' : 'text-emerald-400'}>
            {hours} hr
          </span>
        </p>
      </div>
      <button
        type="button"
        onClick={() => removeOpening(containerId, opening.id)}
        className="shrink-0 text-[11px] text-slate-500 hover:text-rose-400"
      >
        Remove
      </button>
    </div>
  );
}

export function Inspector() {
  const layout = useLayoutStore((s) => s.layout);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const updateContainer = useLayoutStore((s) => s.updateContainer);
  const moveContainer = useLayoutStore((s) => s.moveContainer);
  const rotateSelected = useLayoutStore((s) => s.rotateSelected);
  const duplicateSelected = useLayoutStore((s) => s.duplicateSelected);
  const removeSelected = useLayoutStore((s) => s.removeSelected);
  const addOpening = useLayoutStore((s) => s.addOpening);

  const selected = useMemo(
    () => layout.containers.find((c) => c.id === selectedIds[0]),
    [layout.containers, selectedIds],
  );

  if (!selected) {
    return (
      <div className="space-y-4">
        <Section title="Nothing selected" subtitle="Click a container in the model">
          <p className="text-sm leading-relaxed text-slate-500">
            Shift-click to add to the selection. Arrow keys nudge on the grid, R rotates,
            Ctrl+D duplicates, Delete removes, Ctrl+Z undoes.
          </p>
        </Section>
        <Section title="Interior clear width" subtitle="The number that governs every room">
          <Row label="Outside" value={`8′ 0″`} />
          <Row label="Inside, after the corrugation" value={`7′ 8″`} emphasis />
          <p className="pt-1 text-[11px] leading-relaxed text-slate-600">
            There is no such thing as an eight-foot-wide container room. Every plan this tool
            can produce is {num(INTERIOR_WIDTH_FT, 2)} feet across or a multiple of boxes.
          </p>
        </Section>
      </div>
    );
  }

  const d = dimsOf(selected.type);
  const b = boxOf(selected);

  return (
    <div className="space-y-6">
      <Section title="Container" subtitle={selected.label ?? selected.id}>
        <Row label="Type" value={d.label} />
        <Row label="Zone" value={selected.zone ?? 'castle'} />
        <Row label="Size" value={`${d.length}′ × ${d.width}′ × ${num(d.height, 1)}′`} />
        <Row label="Tare" value={`${num(d.tareLb)} lb`} />
        <Row label="Max corner" value={`${num(b.max.x)}, ${num(b.max.y, 1)}, ${num(b.max.z)}`} />
      </Section>

      <Section title="Placement">
        <NumberField
          label="X (ft)"
          value={selected.position.x}
          step={8}
          onChange={(x) => moveContainer(selected.id, { ...selected.position, x })}
        />
        <NumberField
          label="Y (ft)"
          value={selected.position.y}
          step={d.height}
          onChange={(y) => moveContainer(selected.id, { ...selected.position, y }, false)}
        />
        <NumberField
          label="Z (ft)"
          value={selected.position.z}
          step={8}
          onChange={(z) => moveContainer(selected.id, { ...selected.position, z })}
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button onClick={rotateSelected}>Rotate to {selected.rotation === 0 ? '90°' : '0°'}</Button>
          <Button onClick={duplicateSelected}>Duplicate</Button>
          <Button onClick={removeSelected}>Delete</Button>
        </div>
      </Section>

      <Section title="Role and finish">
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map((role) => (
            <Button
              key={role}
              active={selected.role === role}
              onClick={() => updateContainer(selected.id, { role })}
            >
              {role}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {FINISHES.map((finish) => (
            <Button
              key={finish}
              active={selected.finish === finish}
              onClick={() => updateContainer(selected.id, { finish })}
              tone="accent"
            >
              {finish}
            </Button>
          ))}
        </div>
      </Section>

      <Section
        title={`Openings (${selected.openings.length})`}
        subtitle="Each one is a welded frame and a hole in the shear diaphragm"
      >
        {selected.openings.length === 0 && (
          <p className="text-sm text-slate-500">Intact. This is the cheap state.</p>
        )}
        {selected.openings.map((o) => (
          <OpeningRow
            key={o.id}
            containerId={selected.id}
            opening={o}
            wallSqFt={faceSqFt(selected, o.face)}
          />
        ))}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {OPENING_PRESETS.map((p) => (
            <Button
              key={p.label}
              onClick={() =>
                addOpening(selected.id, {
                  face: p.face,
                  width: p.width,
                  height: p.height,
                  offsetU: Math.max(1, (d.length - p.width) / 2),
                  offsetV: p.height >= 7 ? 0 : 3,
                  label: p.label,
                })
              }
            >
              + {p.label}
            </Button>
          ))}
        </div>
      </Section>
    </div>
  );
}
