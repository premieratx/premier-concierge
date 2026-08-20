import { useMemo } from 'react';
import { estimateProperty, REFERENCE_TARGET_PER_SQ_FT } from '../cost/estimate';
import { takeoff } from '../cost/takeoff';
import { dimsOf } from '../domain/dimensions';
import { runAllChecks } from '../rules';
import { weldingTakeoff, WELDING_CAP_HOURS } from '../rules/welding';
import { useLayoutStore } from '../store/useLayoutStore';
import { Meter, Row, Section, num, usd } from './primitives';

/**
 * The live bill of materials and estimate.
 *
 * The welding meter sits at the top on purpose. It is the constraint that
 * produced the design, and it is the number that has to hurt when you cut
 * another hole.
 */
export function CostPanel() {
  const layout = useLayoutStore((s) => s.layout);

  const { checks, estimate, castleQ, lodgingQ, welding } = useMemo(() => {
    const c = runAllChecks(layout);
    return {
      checks: c,
      estimate: estimateProperty(layout, c),
      castleQ: takeoff(layout, 'castle'),
      lodgingQ: takeoff(layout, 'lodging'),
      welding: weldingTakeoff(
        layout.containers.filter((x) => (x.zone ?? 'castle') === 'castle'),
      ),
    };
  }, [layout]);

  const groups = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of [...estimate.castle.lines, ...estimate.lodging.lines]) {
      map.set(l.group, (map.get(l.group) ?? 0) + l.amount);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [estimate]);

  const totalContainers = layout.containers.length;

  return (
    <div className="space-y-6">
      <Section
        title="Welding budget"
        subtitle="Every cut needs a welded tube-steel frame. This is the cap that shapes the design."
      >
        <Meter
          value={welding.utilisation}
          label={`${num(welding.totalHours)} of ${num(WELDING_CAP_HOURS)} hours`}
          detail={`${usd(welding.totalCost)} / ${usd(welding.capCost)}`}
          danger={welding.overBudget}
        />
        <Row label="Large openings (>3′)" value={`${welding.largeCount} × 18 hr`} />
        <Row label="Small openings" value={`${welding.smallCount} × 6 hr`} />
        <Row
          label="Hours remaining"
          value={num(welding.hoursRemaining)}
          emphasis={welding.overBudget}
        />
      </Section>

      <Section title="Bill of materials" subtitle="Castle and lodging containers">
        <Row label="Containers, total" value={num(totalContainers)} />
        <Row label="— castle" value={num(castleQ.containerCount)} />
        <Row label="— lodging" value={num(lodgingQ.containerCount)} />
        <Row
          label={`40' High Cube`}
          value={num(castleQ.containersByType['40HC'] + lodgingQ.containersByType['40HC'])}
        />
        <Row
          label={`20' Standard`}
          value={num(castleQ.containersByType['20ST'] + lodgingQ.containersByType['20ST'])}
        />
        <Row label="Gross container area" value={`${num(castleQ.grossSqFt + lodgingQ.grossSqFt)} sf`} />
        <Row label="Exterior surface" value={`${num(castleQ.exteriorWallSqFt + castleQ.exteriorRoofSqFt)} sf`} />
        <Row label="Interior clear width" value={`7′ 8″`} muted />
      </Section>

      <Section title="Area" subtitle="Sealed envelope against open-air venue">
        <Row label="Sealed" value={`${num(castleQ.sealedSqFt + lodgingQ.sealedSqFt)} sf`} />
        <Row label="Open air" value={`${num(castleQ.openAirSqFt + lodgingQ.openAirSqFt)} sf`} />
        <Row label="Total built" value={`${num(estimate.totalSqFt)} sf`} emphasis />
      </Section>

      <Section title="Estimate" subtitle="Hard cost, soft cost at 18%, contingency at 18%">
        {groups.map(([group, amount]) => (
          <Row key={group} label={group} value={usd(amount)} />
        ))}
        <div className="my-2 h-px bg-slate-800" />
        <Row label="Castle" value={usd(estimate.castle.total)} />
        <Row label="Lodging" value={usd(estimate.lodging.total)} />
        <Row label="Site and spectacle" value={usd(estimate.site.total)} />
        {estimate.ruleImpact > 0 && (
          <Row label="Rule-driven additions" value={usd(estimate.ruleImpact)} />
        )}
        <div className="my-2 h-px bg-slate-800" />
        <Row label="Project total" value={usd(estimate.total)} emphasis />
        <Row label="Per built square foot" value={`${usd(estimate.costPerSqFt)}/sf`} />
        <Row
          label="Castle only"
          value={`${usd(estimate.castle.total)} · ${usd(estimate.castle.costPerSqFt)}/sf`}
        />
        <p className="pt-1 text-[11px] leading-relaxed text-slate-600">
          The rate table was calibrated so a 95-container reference castle lands near{' '}
          {usd(REFERENCE_TARGET_PER_SQ_FT)}/sf. A castle figure far off that means the rates
          are being applied wrongly, and there is a test that says so.
        </p>
      </Section>

      <Section title="Site and spectacle" subtitle="Not covered by the castle rate table">
        {estimate.site.byGroup.map((g) => (
          <Row key={g.group} label={g.group} value={usd(g.amount)} />
        ))}
        <div className="my-2 h-px bg-slate-800" />
        <Row label="Site total" value={usd(estimate.site.total)} emphasis />
      </Section>

      <Section title="Checks">
        <Row label="Errors" value={num(checks.errors.length)} emphasis={checks.errors.length > 0} />
        <Row label="Warnings" value={num(checks.warnings.length)} />
        <Row
          label="Tallest stack"
          value={`${castleQ.maxStackDepth} × ${num(dimsOf('40HC').height, 1)}′`}
        />
      </Section>
    </div>
  );
}
