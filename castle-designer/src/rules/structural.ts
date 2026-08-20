import { RATES, SITE_RATES } from '../cost/rates';
import { dimsOf } from '../domain/dimensions';
import {
  boxOf,
  faceSqFt,
  findAdjacencies,
  findIntersections,
  findStackJoints,
  openingSqFt,
  planOverlapSqFt,
  stackDepths,
  supportOf,
  EPS,
  FLAT_GROUND,
  type GroundAt,
} from '../domain/geometry';
import { groundFunctionFor } from '../domain/terrain';
import type { Container, Decor, Layout, Opening } from '../domain/types';
import { openingsToEliminate, weldingTakeoff, WELDING_CAP_HOURS } from './welding';

export type Severity = 'pass' | 'warning' | 'error';

export type RuleId =
  | 'R0'
  | 'R1'
  | 'R2'
  | 'R3'
  | 'R4'
  | 'R5'
  | 'R6'
  | 'R7'
  | 'R8';

export interface Violation {
  id: string;
  rule: RuleId;
  title: string;
  severity: Severity;
  message: string;
  /** Containers to light up red in the 3D view. */
  containerIds: string[];
  /** Money this finding adds to the estimate, when it can be priced. */
  costImpact?: number;
}

export const RULE_TITLES: Record<RuleId, string> = {
  R0: 'Container overlap',
  R1: 'Corner casting alignment',
  R2: 'Stack height',
  R3: 'Opening area',
  R4: 'Opening reinforcement',
  R5: 'Welding budget',
  R6: 'Roof loads',
  R7: 'Cantilever',
  R8: 'Sealed envelope',
};

function pass(rule: RuleId, message: string): Violation {
  return {
    id: rule,
    rule,
    title: RULE_TITLES[rule],
    severity: 'pass',
    message,
    containerIds: [],
  };
}

/** Pick a transfer beam for a stack that has stepped off its corner castings. */
export function transferBeamFor(offsetFt: number): string {
  if (offsetFt <= 4) return 'W10x33 transfer beam with stiffened bearing plates';
  if (offsetFt <= 8) return 'W12x50 transfer beam with stiffened bearing plates';
  if (offsetFt <= 16) return 'W16x67 transfer beam on a braced column line';
  return 'HSS transfer truss on a braced column line';
}

/** R0 — two containers cannot occupy the same volume. Not a code rule, but if
 * this fires nothing downstream is meaningful. */
export function checkOverlap(containers: Container[]): Violation[] {
  const hits = findIntersections(containers);
  if (hits.length === 0) return [pass('R0', 'No containers share volume.')];
  return hits.map(([i, j], n) => {
    const a = containers[i]!;
    const b = containers[j]!;
    return {
      id: `R0-${n}`,
      rule: 'R0' as const,
      title: RULE_TITLES.R0,
      severity: 'error' as const,
      message: `${a.label ?? a.id} and ${b.label ?? b.id} occupy the same space. Move one before reading anything else on this list.`,
      containerIds: [a.id, b.id],
    };
  });
}

/**
 * R1 — stacked containers must land corner casting on corner casting. The
 * castings are the only rated load path; anywhere the stack steps, the load
 * has to be picked up by a transfer structure and carried back to a column.
 */
export function checkCornerAlignment(
  containers: Container[],
  groundAt: GroundAt = FLAT_GROUND,
): Violation[] {
  const joints = findStackJoints(containers, groundAt);
  const offenders = joints.filter((j) => j.offsetFt > EPS);
  if (offenders.length === 0) {
    return [pass('R1', `All ${joints.length} stack joints land casting on casting.`)];
  }
  return offenders.map((j, n) => {
    const upper = containers[j.upperIndex]!;
    const lower = containers[j.lowerIndex]!;
    return {
      id: `R1-${n}`,
      rule: 'R1' as const,
      title: RULE_TITLES.R1,
      severity: 'error' as const,
      message: `${upper.label ?? upper.id} sits ${j.offsetFt.toFixed(1)}′ off the castings of ${lower.label ?? lower.id}. Requires a ${transferBeamFor(j.offsetFt)}.`,
      containerIds: [upper.id, lower.id],
      costImpact: SITE_RATES.structural.transferBeamEach,
    };
  });
}

export const STACK_WARN_LEVELS = 3;
export const STACK_MAX_LEVELS = 4;

/**
 * R2 — four containers is the practical limit before the assembly needs
 * engineered lateral bracing. Three is where it stops being obvious.
 */
export function checkStackHeight(
  containers: Container[],
  groundAt: GroundAt = FLAT_GROUND,
): Violation[] {
  const depths = stackDepths(containers, groundAt);
  const max = depths.reduce((a, b) => Math.max(a, b), 0);
  if (max < STACK_WARN_LEVELS) {
    return [pass('R2', `Tallest stack is ${max} container${max === 1 ? '' : 's'}.`)];
  }

  const tallest = containers.filter((_, i) => (depths[i] ?? 0) >= STACK_WARN_LEVELS);
  const ids = tallest.map((c) => c.id);

  if (max > STACK_MAX_LEVELS) {
    return [
      {
        id: 'R2',
        rule: 'R2',
        title: RULE_TITLES.R2,
        severity: 'error',
        message: `A stack runs ${max} containers deep. Above four you are past what a bolted assembly does on its own — this needs an engineered lateral system, stamped, before it is buildable.`,
        containerIds: ids,
      },
    ];
  }

  return [
    {
      id: 'R2',
      rule: 'R2',
      title: RULE_TITLES.R2,
      severity: 'warning',
      message: `${tallest.length} containers sit in stacks ${max} deep. Engineered lateral bracing is already carried in the estimate at ${RATES.structural.lateralBracingLumpSum.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`,
      containerIds: ids,
    },
  ];
}

export const OPENING_WARN_PCT = 0.3;
export const OPENING_ERROR_PCT = 0.5;

const SIDE_FACES: Opening['face'][] = ['sideA', 'sideB'];

/**
 * R3 — a container's side wall is its shear diaphragm. Cut a third of it away
 * and it needs help; cut half and there is nothing left to help.
 */
export function checkOpeningArea(containers: Container[]): Violation[] {
  const violations: Violation[] = [];

  for (const c of containers) {
    for (const face of SIDE_FACES) {
      const cuts = c.openings.filter((o) => o.face === face);
      if (cuts.length === 0) continue;
      const cutArea = cuts.reduce((a, o) => a + openingSqFt(o), 0);
      const wallArea = faceSqFt(c, face);
      const ratio = cutArea / wallArea;
      if (ratio <= OPENING_WARN_PCT) continue;

      const pct = (ratio * 100).toFixed(0);
      if (ratio > OPENING_ERROR_PCT) {
        violations.push({
          id: `R3-${c.id}-${face}`,
          rule: 'R3',
          title: RULE_TITLES.R3,
          severity: 'error',
          message: `${c.label ?? c.id}: ${pct}% of the ${face} wall is cut away. Past 50% the shear diaphragm is gone — this wall has to be rebuilt as a moment frame, welded full height to the corner posts, or the openings have to shrink.`,
          containerIds: [c.id],
        });
      } else {
        violations.push({
          id: `R3-${c.id}-${face}`,
          rule: 'R3',
          title: RULE_TITLES.R3,
          severity: 'warning',
          message: `${c.label ?? c.id}: ${pct}% of the ${face} wall is cut away. Needs continuous tube-steel jambs welded to the top and bottom rails to restore the diaphragm.`,
          containerIds: [c.id],
        });
      }
    }
  }

  if (violations.length === 0) {
    return [pass('R3', 'No side wall is cut past 30%.')];
  }
  return violations;
}

/** R4 — every opening gets a welded tube-steel frame. This is what feeds R5. */
export function checkOpeningReinforcement(containers: Container[]): Violation[] {
  const t = weldingTakeoff(containers);
  if (t.openingCount === 0) {
    return [pass('R4', 'No openings cut. Nothing to reinforce.')];
  }
  return [
    {
      id: 'R4',
      rule: 'R4',
      title: RULE_TITLES.R4,
      severity: 'pass',
      message: `${t.openingCount} openings need welded tube-steel frames: ${t.largeCount} large at ${RATES.welding.hoursPerLargeOpening} hrs and ${t.smallCount} small at ${RATES.welding.hoursPerSmallOpening} hrs — ${t.totalHours.toFixed(0)} hours in total.`,
      containerIds: [],
    },
  ];
}

/**
 * R5 — the welding budget. $50,000 at $95 an hour is 526 hours, and it is the
 * constraint that produced the whole design: keep the boxes intact and spend
 * the money on spans instead of on cuts.
 */
export function checkWeldingBudget(
  containers: Container[],
  otherZoneHours = 0,
): Violation[] {
  const t = weldingTakeoff(containers);
  const aside =
    otherZoneHours > 0
      ? ` A further ${otherZoneHours.toFixed(0)} hours sit outside the castle zone and are budgeted separately.`
      : '';
  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  if (!t.overBudget) {
    const pct = (t.utilisation * 100).toFixed(0);
    return [
      {
        id: 'R5',
        rule: 'R5',
        title: RULE_TITLES.R5,
        severity: t.utilisation > 0.8 ? 'warning' : 'pass',
        message: `${t.totalHours.toFixed(0)} of ${WELDING_CAP_HOURS.toFixed(0)} welding hours used (${pct}% of the ${fmt(RATES.welding.budgetCap)} cap) — ${fmt(t.totalCost)}.${aside}`,
        containerIds: [],
      },
    ];
  }

  const cuts = openingsToEliminate(t);
  const named = cuts
    .slice(0, 6)
    .map((c) => `${c.openingLabel} on ${c.containerLabel}`)
    .join(', ');
  const more = cuts.length > 6 ? ` and ${cuts.length - 6} more` : '';

  return [
    {
      id: 'R5',
      rule: 'R5',
      title: RULE_TITLES.R5,
      severity: 'error',
      message: `${t.totalHours.toFixed(0)} welding hours is ${fmt(t.totalCost)} — ${fmt(t.totalCost - RATES.welding.budgetCap)} over the cap. Eliminating ${cuts.length} opening${cuts.length === 1 ? '' : 's'} gets back under it: ${named}${more}.${aside}`,
      containerIds: [...new Set(cuts.map((c) => c.containerId))],
    },
  ];
}

/** Decor that puts people, furniture or snow load on a container roof. */
const OCCUPIED_DECOR: Decor['kind'][] = ['deck', 'walkway', 'pergola', 'tent'];

/**
 * R6 — a container roof is rated for snow, not for a party. Anything carrying
 * a deck or terrace above needs supplementary framing spanning between the
 * corner posts.
 */
export function checkRoofLoads(containers: Container[], decor: Decor[]): Violation[] {
  const loaded: { container: Container; sqFt: number }[] = [];

  for (const c of containers) {
    const roofY = boxOf(c).max.y;
    const b = boxOf(c);
    let area = 0;
    for (const d of decor) {
      if (!OCCUPIED_DECOR.includes(d.kind)) continue;
      const base = d.center.y - d.size.y / 2;
      if (Math.abs(base - roofY) > 1.5) continue;
      const ox = Math.max(
        0,
        Math.min(b.max.x, d.center.x + d.size.x / 2) -
          Math.max(b.min.x, d.center.x - d.size.x / 2),
      );
      const oz = Math.max(
        0,
        Math.min(b.max.z, d.center.z + d.size.z / 2) -
          Math.max(b.min.z, d.center.z - d.size.z / 2),
      );
      area += ox * oz;
    }
    if (area > 1) loaded.push({ container: c, sqFt: area });
  }

  if (loaded.length === 0) {
    return [pass('R6', 'No container roof is carrying occupancy.')];
  }

  const totalSqFt = loaded.reduce((a, l) => a + l.sqFt, 0);
  const cost = totalSqFt * SITE_RATES.structural.roofFramingPerSqFt;
  return [
    {
      id: 'R6',
      rule: 'R6',
      title: RULE_TITLES.R6,
      severity: 'warning',
      message: `${loaded.length} container roofs carry a deck or terrace — ${totalSqFt.toFixed(0)} sq ft. Container roofs are rated for snow, not occupancy, so supplementary framing is carried at ${cost.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}.`,
      containerIds: loaded.map((l) => l.container.id),
      costImpact: cost,
    },
  ];
}

export const CANTILEVER_LIMIT = 0.25;

/** R7 — no container may overhang more than a quarter of its length unsupported. */
export function checkCantilever(
  containers: Container[],
  groundAt: GroundAt = FLAT_GROUND,
): Violation[] {
  const violations: Violation[] = [];
  for (const c of containers) {
    const support = supportOf(c, containers, groundAt);
    if (support.endOverhangFraction <= CANTILEVER_LIMIT + EPS) continue;
    const d = dimsOf(c.type);
    const overhangFt = support.endOverhangFraction * d.length;
    violations.push({
      id: `R7-${c.id}`,
      rule: 'R7',
      title: RULE_TITLES.R7,
      severity: 'error',
      message: `${c.label ?? c.id} overhangs ${overhangFt.toFixed(0)}′ — ${(support.endOverhangFraction * 100).toFixed(0)}% of its length — with nothing under the castings. The limit is 25%. Add a column, a tower, or a transfer beam under the free end.`,
      containerIds: [c.id],
    });
  }
  if (violations.length === 0) {
    return [pass('R7', 'No container overhangs past 25% of its length.')];
  }
  return violations;
}

/**
 * R8 — a sealed container bolted straight to an open-air one is a continuous
 * steel path from conditioned space to a Texas summer. It needs a thermal
 * break at the joint or the envelope sweats and the mechanical load blows out.
 */
export function checkSealedEnvelope(
  containers: Container[],
  groundAt: GroundAt = FLAT_GROUND,
): Violation[] {
  const pairs = findAdjacencies(containers);
  const flagged = new Map<string, Container>();

  for (const [i, j] of pairs) {
    const a = containers[i]!;
    const b = containers[j]!;
    const aSealed = a.role === 'sealed';
    const bSealed = b.role === 'sealed';
    if (aSealed === bSealed) continue;
    flagged.set(a.id, a);
    flagged.set(b.id, b);
  }

  // Stacks count too: a sealed box on an open-air one shares a full floor.
  for (const joint of findStackJoints(containers, groundAt)) {
    const lower = containers[joint.lowerIndex]!;
    const upper = containers[joint.upperIndex]!;
    if ((lower.role === 'sealed') === (upper.role === 'sealed')) continue;
    if (planOverlapSqFt(lower, upper) <= EPS) continue;
    flagged.set(lower.id, lower);
    flagged.set(upper.id, upper);
  }

  if (flagged.size === 0) {
    return [pass('R8', 'Every sealed container is thermally isolated.')];
  }

  const sealedCount = [...flagged.values()].filter((c) => c.role === 'sealed').length;
  return [
    {
      id: 'R8',
      rule: 'R8',
      title: RULE_TITLES.R8,
      severity: 'warning',
      message: `${sealedCount} sealed containers bear directly on open-air ones. Each junction needs a thermal break detail — a structural thermal pad at the castings and continuous exterior insulation past the joint — or the envelope condenses.`,
      containerIds: [...flagged.keys()],
    },
  ];
}

export interface CheckResult {
  violations: Violation[];
  errors: Violation[];
  warnings: Violation[];
  passes: Violation[];
  /** Container ids to draw red: errors only. */
  errorContainerIds: Set<string>;
  /** Container ids named by a warning. Not drawn red — see below. */
  warningContainerIds: Set<string>;
  /** Union of the two, for anything that wants "mentioned by a finding". */
  flaggedContainerIds: Set<string>;
  /** Money the findings add on top of the base estimate. */
  totalCostImpact: number;
}

/**
 * Run every rule against a layout.
 *
 * Only containers are checked — decor and site features are not structure.
 */
export function runAllChecks(layout: Layout): CheckResult {
  const c = layout.containers;
  // The layout declares which landform it stands on, so the rules can tell a
  // container bearing on a terrace from one hanging in the air.
  const groundAt = groundFunctionFor(layout.site.terrain);
  // The $50,000 cap is a constraint on the castle build. Lodging cabins are
  // ordinary container conversions carrying their own budget, so their cuts
  // are reported but not charged against the castle's cap.
  const castleOnly = c.filter((x) => (x.zone ?? 'castle') === 'castle');
  const otherZoneHours = weldingTakeoff(
    c.filter((x) => (x.zone ?? 'castle') !== 'castle'),
  ).totalHours;

  const violations = [
    ...checkOverlap(c),
    ...checkCornerAlignment(c, groundAt),
    ...checkStackHeight(c, groundAt),
    ...checkOpeningArea(c),
    ...checkOpeningReinforcement(c),
    ...checkWeldingBudget(castleOnly, otherZoneHours),
    ...checkRoofLoads(c, layout.decor),
    ...checkCantilever(c, groundAt),
    ...checkSealedEnvelope(c, groundAt),
  ];

  const errors = violations.filter((v) => v.severity === 'error');
  const warnings = violations.filter((v) => v.severity === 'warning');
  const passes = violations.filter((v) => v.severity === 'pass');

  // Only errors paint the model red. A rule like R6 legitimately names every
  // container under the wall walk, and turning the whole curtain wall red for
  // a priced, expected warning drowns out the findings that actually stop the
  // build. Warnings are surfaced by selecting them from the panel instead.
  const errorContainerIds = new Set<string>();
  for (const v of errors) for (const id of v.containerIds) errorContainerIds.add(id);

  const warningContainerIds = new Set<string>();
  for (const v of warnings) for (const id of v.containerIds) warningContainerIds.add(id);

  const flaggedContainerIds = new Set([...errorContainerIds, ...warningContainerIds]);

  // A rule that fires more than once must not bill its lump sum more than
  // once, so impacts are summed per rule at their maximum.
  const perRule = new Map<RuleId, number>();
  for (const v of [...errors, ...warnings]) {
    if (v.costImpact === undefined) continue;
    if (v.rule === 'R1') {
      perRule.set('R1', (perRule.get('R1') ?? 0) + v.costImpact);
    } else {
      perRule.set(v.rule, Math.max(perRule.get(v.rule) ?? 0, v.costImpact));
    }
  }

  return {
    violations,
    errors,
    warnings,
    passes,
    errorContainerIds,
    warningContainerIds,
    flaggedContainerIds,
    totalCostImpact: [...perRule.values()].reduce((a, b) => a + b, 0),
  };
}
