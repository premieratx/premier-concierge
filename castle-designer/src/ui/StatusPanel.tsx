import { dimsOf } from '../domain/dimensions';
import { boxOf } from '../domain/geometry';
import type { ContainerType } from '../domain/types';
import { useLayoutStore } from '../store/useLayoutStore';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-100">{value}</span>
    </div>
  );
}

/**
 * Phase 1 readout: enough to confirm the model matches the data, no more.
 * The bill of materials, cost, and warnings panels arrive in Phases 3 and 4.
 */
export function StatusPanel() {
  const layout = useLayoutStore((s) => s.layout);
  const selectedIds = useLayoutStore((s) => s.selectedIds);
  const showEdges = useLayoutStore((s) => s.showEdges);
  const setShowEdges = useLayoutStore((s) => s.setShowEdges);
  const resetToSeed = useLayoutStore((s) => s.resetToSeed);

  const counts = layout.containers.reduce<Record<ContainerType, number>>(
    (acc, c) => {
      acc[c.type] += 1;
      return acc;
    },
    { '40HC': 0, '20ST': 0 },
  );

  const selected = layout.containers.find((c) => c.id === selectedIds[0]);

  return (
    <aside className="flex w-80 shrink-0 flex-col gap-5 overflow-y-auto border-r border-slate-800 bg-slate-950/95 p-5">
      <header>
        <h1 className="text-base font-semibold tracking-tight text-slate-50">
          Container Castle Designer
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Phase 1 — foundation. Units are feet; 1 world unit = 1 foot.
        </p>
      </header>

      <section className="space-y-1">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Layout
        </h2>
        <Row label="Name" value={layout.name} />
        <Row label="Containers" value={String(layout.containers.length)} />
        <Row label="40' High Cube" value={String(counts['40HC'])} />
        <Row label="20' Standard" value={String(counts['20ST'])} />
      </section>

      <section className="space-y-1">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Selection
        </h2>
        {selected ? (
          <>
            <Row label="Id" value={selected.id} />
            <Row label="Label" value={selected.label ?? '—'} />
            <Row label="Type" value={dimsOf(selected.type).label} />
            <Row label="Role" value={selected.role} />
            <Row label="Finish" value={selected.finish} />
            <Row label="Rotation" value={`${selected.rotation}°`} />
            <Row
              label="Min corner"
              value={`${selected.position.x}, ${selected.position.y}, ${selected.position.z}`}
            />
            <Row
              label="Max corner"
              value={(() => {
                const b = boxOf(selected);
                return `${b.max.x}, ${b.max.y}, ${b.max.z}`;
              })()}
            />
            <Row label="Openings" value={String(selected.openings.length)} />
          </>
        ) : (
          <p className="text-sm text-slate-500">
            Click a container to select it. Click empty space to clear.
          </p>
        )}
      </section>

      <section className="mt-auto space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={showEdges}
            onChange={(e) => setShowEdges(e.target.checked)}
            className="size-4 accent-sky-500"
          />
          Edge outlines
        </label>
        <button
          type="button"
          onClick={resetToSeed}
          className="w-full rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:border-slate-500 hover:text-slate-50"
        >
          Reset to seed layout
        </button>
      </section>
    </aside>
  );
}
