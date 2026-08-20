import { useMemo } from 'react';
import { runAllChecks } from '../rules';
import type { Violation } from '../rules/structural';
import { useLayoutStore } from '../store/useLayoutStore';
import { Pill, Section } from './primitives';

function ViolationCard({ v }: { v: Violation }) {
  const selectMany = useLayoutStore((s) => s.selectMany);
  const tone = v.severity === 'error' ? 'error' : v.severity === 'warning' ? 'warning' : 'pass';
  const border =
    v.severity === 'error'
      ? 'border-rose-500/30'
      : v.severity === 'warning'
        ? 'border-amber-500/30'
        : 'border-slate-800';

  return (
    <div className={`rounded border ${border} bg-slate-900/60 p-3`}>
      <div className="mb-1.5 flex items-center gap-2">
        <Pill tone={tone}>{v.rule}</Pill>
        <span className="text-xs font-medium text-slate-300">{v.title}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-slate-400">{v.message}</p>
      {v.containerIds.length > 0 && (
        <button
          type="button"
          onClick={() => selectMany(v.containerIds)}
          className="mt-2 text-[11px] font-medium text-sky-400 hover:text-sky-300"
        >
          Highlight {v.containerIds.length} container{v.containerIds.length === 1 ? '' : 's'} →
        </button>
      )}
    </div>
  );
}

/**
 * The rule checker's findings, worst first. Offending containers are drawn red
 * in the model, so the list and the view always agree.
 */
export function WarningsPanel() {
  const layout = useLayoutStore((s) => s.layout);
  const checks = useMemo(() => runAllChecks(layout), [layout]);

  return (
    <div className="space-y-6">
      {checks.errors.length > 0 && (
        <Section title={`Errors (${checks.errors.length})`} subtitle="These stop the design being buildable as drawn">
          {checks.errors.map((v) => (
            <ViolationCard key={v.id} v={v} />
          ))}
        </Section>
      )}

      {checks.warnings.length > 0 && (
        <Section title={`Warnings (${checks.warnings.length})`} subtitle="Buildable, but each one costs money">
          {checks.warnings.map((v) => (
            <ViolationCard key={v.id} v={v} />
          ))}
        </Section>
      )}

      <Section title="Passing" subtitle="Rules the layout currently satisfies">
        {checks.passes.map((v) => (
          <ViolationCard key={v.id} v={v} />
        ))}
      </Section>

      <p className="text-[11px] leading-relaxed text-slate-600">
        These checks are a design aid, not an engineering review. A bolted multi-storey
        container assembly needs a structural engineer with container experience to stamp it,
        and this property needs a civil site capacity analysis and geotech borings before any
        of it is real. Impervious cover limits in the Highland Lakes watershed may cap the
        programme regardless of what the budget allows.
      </p>
    </div>
  );
}
