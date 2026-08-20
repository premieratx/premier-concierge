import { featuresOfKind } from '../domain/types';
import { earthwork } from '../domain/terrain';
import type { Layout } from '../domain/types';
import type { CheckResult } from '../rules/structural';
import { RATES, SITE_RATES } from './rates';
import { PIERS_PER_GROUND_CONTAINER, type Quantities, takeoff } from './takeoff';

export interface LineItem {
  group: string;
  label: string;
  qty: number;
  unit: string;
  rate: number;
  amount: number;
}

function line(
  group: string,
  label: string,
  qty: number,
  unit: string,
  rate: number,
): LineItem {
  return { group, label, qty, unit, rate, amount: qty * rate };
}

export interface Estimate {
  lines: LineItem[];
  hardCost: number;
  softCost: number;
  contingency: number;
  total: number;
  sealedSqFt: number;
  openAirSqFt: number;
  totalSqFt: number;
  costPerSqFt: number;
}

function assemble(lines: LineItem[], sealedSqFt: number, openAirSqFt: number): Estimate {
  const hardCost = lines.reduce((a, l) => a + l.amount, 0);
  const softCost = hardCost * RATES.soft.softCostPct;
  const contingency = (hardCost + softCost) * RATES.soft.contingencyPct;
  const total = hardCost + softCost + contingency;
  const totalSqFt = sealedSqFt + openAirSqFt;
  return {
    lines,
    hardCost,
    softCost,
    contingency,
    total,
    sealedSqFt,
    openAirSqFt,
    totalSqFt,
    costPerSqFt: totalSqFt > 0 ? total / totalSqFt : 0,
  };
}

/**
 * Turn a quantity takeoff into a line-item estimate.
 *
 * Soft costs run on the hard cost; contingency runs on hard plus soft, which
 * is how a contingency actually behaves — it has to cover the design fees on
 * whatever the scope change turns out to be, not just the steel.
 */
export function estimateFromQuantities(q: Quantities, extras: LineItem[] = []): Estimate {
  const lines: LineItem[] = [];

  lines.push(
    line('Containers', `40' High Cube`, q.containersByType['40HC'], 'ea', RATES.container['40HC']),
    line('Containers', `20' Standard`, q.containersByType['20ST'], 'ea', RATES.container['20ST']),
    line('Containers', 'Delivery', q.containerCount, 'ea', RATES.container.delivery),
  );

  const connections = q.stackConnections + q.adjacencyConnections;
  lines.push(
    line('Connections', 'Twistlocks', connections, 'ea', RATES.bolted.twistlockPerConnection),
    line('Connections', 'Connection plates', connections, 'ea', RATES.bolted.platePerConnection),
    line(
      'Connections',
      'Rigging labour',
      q.containerCount * RATES.bolted.riggingHoursPerContainer,
      'hr',
      RATES.bolted.riggerRate,
    ),
  );

  lines.push(line('Welding', 'Opening reinforcement', q.weldingHours, 'hr', RATES.welding.hourlyRate));

  lines.push(
    line(
      'Foundation',
      'Drilled piers',
      q.groundContainers * PIERS_PER_GROUND_CONTAINER,
      'ea',
      RATES.foundation.pierEach,
    ),
    line('Foundation', 'Grade beam', q.gradeBeamLf, 'lf', RATES.foundation.gradeBeamPerLf),
    line('Foundation', 'Slab on grade', q.slabSqFt, 'sf', RATES.foundation.slabPerSqFt),
  );

  const stoneSqFt = q.exteriorWallSqFt * q.stoneFraction;
  const paintedSqFt = q.exteriorWallSqFt - stoneSqFt;
  lines.push(
    line('Finish', 'Stone veneer', stoneSqFt, 'sf', RATES.finish.stoneVeneerPerSqFt),
    line('Finish', 'Prep and paint', paintedSqFt, 'sf', RATES.finish.paintPerSqFt + RATES.finish.prepPerSqFt),
  );

  lines.push(
    line('Roofing', 'Standing seam', q.standingSeamSqFt, 'sf', RATES.roofing.standingSeamPerSqFt),
    line('Roofing', 'Truss roof', q.trussRoofSqFt, 'sf', RATES.roofing.trussRoofPerSqFt),
    // Open-air container roofs still need prep and a coating; they are the
    // walking surface and the weather surface both.
    line(
      'Roofing',
      'Exposed roof coating',
      Math.max(0, q.exteriorRoofSqFt - q.standingSeamSqFt),
      'sf',
      RATES.finish.paintPerSqFt + RATES.finish.prepPerSqFt,
    ),
  );

  lines.push(
    line('Flooring', 'Stabilised decomposed granite', q.flooringDgSqFt, 'sf', RATES.flooring.stabilizedDgPerSqFt),
    line('Flooring', 'Limestone flagstone', q.flooringFlagstoneSqFt, 'sf', RATES.flooring.limestoneFlagstonePerSqFt),
    line('Flooring', 'Decking', q.flooringDeckingSqFt, 'sf', RATES.flooring.deckingPerSqFt),
  );

  lines.push(
    line('MEP', 'Sealed', q.sealedSqFt, 'sf', RATES.mep.sealedPerSqFt),
    line('MEP', 'Open air', q.openAirSqFt, 'sf', RATES.mep.openAirPerSqFt),
  );

  lines.push(
    line('Sealed envelope', 'Continuous insulation', q.sealedSqFt, 'sf', RATES.sealed.insulationPerSqFt),
    line('Sealed envelope', 'Interior finish', q.sealedSqFt, 'sf', RATES.sealed.interiorFinishPerSqFt),
  );

  if (q.needsLateralBracing) {
    // Rule R2: past two levels a bolted assembly needs an engineered lateral
    // system. It is carried here rather than as a rule surcharge so the
    // estimate is never quietly missing it.
    lines.push(
      line('Structure', 'Engineered lateral bracing', 1, 'ls', RATES.structural.lateralBracingLumpSum),
    );
  }

  lines.push(...extras);

  return assemble(lines, q.sealedSqFt, q.openAirSqFt);
}

/**
 * The reference design the rate table was calibrated against: 95 containers,
 * 5,100 sq ft sealed, 14,900 sq ft open air. It should land near $6.3M, or
 * about $315 per square foot. If it does not, the rates are being applied
 * wrongly somewhere, and there is a test that says so.
 */
export const REFERENCE_QUANTITIES: Quantities = {
  containersByType: { '40HC': 60, '20ST': 35 },
  containerCount: 95,
  grossSqFt: 60 * 320 + 35 * 160,
  sealedSqFt: 5100,
  openAirSqFt: 14900,
  exteriorWallSqFt: 42000,
  exteriorRoofSqFt: 10000,
  stoneFraction: 0.5,
  stackConnections: 160,
  adjacencyConnections: 140,
  weldingHours: 480,
  groundContainers: 55,
  gradeBeamLf: 1600,
  slabSqFt: 5100,
  trussRoofSqFt: 7500,
  standingSeamSqFt: 8100,
  flooringDgSqFt: 14900 * 0.6,
  flooringFlagstoneSqFt: 14900 * 0.25,
  flooringDeckingSqFt: 14900 * 0.15,
  maxStackDepth: 4,
  needsLateralBracing: true,
};

export const REFERENCE_TARGET_TOTAL = 6_300_000;
export const REFERENCE_TARGET_PER_SQ_FT = 315;

/* ------------------------------------------------------------------ *
 * Site features: the dragon, the marina, the stages, the lights.
 * ------------------------------------------------------------------ */

export interface SiteEstimate extends Estimate {
  byGroup: { group: string; amount: number }[];
}

function groupTotals(lines: LineItem[]): { group: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const l of lines) map.set(l.group, (map.get(l.group) ?? 0) + l.amount);
  return [...map.entries()]
    .map(([group, amount]) => ({ group, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Length of the switchback drive from the road down to the gate terrace. */
const DRIVE_LENGTH_LF = 980;

export function estimateSite(layout: Layout): SiteEstimate {
  const lines: LineItem[] = [];
  const R = SITE_RATES;

  /* Earthwork ----------------------------------------------------- */
  if (layout.site.terrain === 'cypressCreek') {
    const dirt = earthwork();
    lines.push(
      line('Earthwork', 'Excavation', dirt.cutCy, 'cy', R.earthwork.cutPerCy),
      line('Earthwork', 'Engineered fill', dirt.fillCy, 'cy', R.earthwork.fillPerCy),
      line('Earthwork', 'Haul imbalance', Math.abs(dirt.importCy), 'cy', R.earthwork.haulPerCy),
      line(
        'Earthwork',
        'Retaining walls',
        dirt.retainingSqFt,
        'sf',
        R.earthwork.retainingWallPerSqFt,
      ),
      line('Earthwork', 'Erosion control', 1, 'ls', R.earthwork.erosionControlLumpSum),
      line('Earthwork', 'Switchback drive', DRIVE_LENGTH_LF, 'lf', R.earthwork.drivePerLf),
    );
  }

  for (const dragon of featuresOfKind(layout.features, 'dragon')) {
    // Parts, consumables and rigging scale with the beast; the plinth and the
    // burner train do not care how long it is.
    const scale = dragon.lengthFt / R.dragon.referenceLengthFt;
    lines.push(
      line('Dragon', 'Donor car parts and yard scrap, hauled', scale, 'ls', R.dragon.donorPartsLumpSum),
      line('Dragon', 'Used pipe and beam for the spine', scale, 'ls', R.dragon.structuralCoreLumpSum),
      line('Dragon', 'Welding consumables and abrasives', scale, 'ls', R.dragon.weldingConsumablesLumpSum),
      line('Dragon', 'Fasteners, chain and hardware', scale, 'ls', R.dragon.hardwareLumpSum),
      line('Dragon', 'Telehandler and rigging', scale, 'ls', R.dragon.riggingLumpSum),
      line('Dragon', 'Plinth, anchors and embed plate', 1, 'ls', R.dragon.plinthAndAnchorsLumpSum),
    );
    if (dragon.breathingFire) {
      lines.push(line('Dragon', 'Burner, ignition and flame safety', 1, 'ls', R.dragon.fireSystemLumpSum));
    }
  }

  const pits = featuresOfKind(layout.features, 'firePit');
  if (pits.length > 0) {
    lines.push(line('Fire', 'Gas fire pits', pits.length, 'ea', R.firePit.each));
    const rainbow = pits.filter((p) => p.rainbow).length;
    if (rainbow > 0) {
      lines.push(line('Fire', 'Colour burner heads', rainbow, 'ea', R.firePit.rainbowPremium));
    }
    lines.push(line('Fire', 'Gas distribution', 1, 'ls', R.firePit.gasDistributionLumpSum));
  }

  const stages = featuresOfKind(layout.features, 'stage');
  for (const s of stages) {
    const area = s.widthFt * s.depthFt;
    lines.push(line('Stages', `${s.name} deck`, area, 'sf', R.stage.deckPerSqFt));
    if (s.roof === 'truss') {
      lines.push(line('Stages', `${s.name} truss roof`, area * 1.3, 'sf', R.stage.trussRoofPerSqFt));
    } else if (s.roof === 'container') {
      lines.push(line('Stages', `${s.name} container roof`, area * 1.2, 'sf', R.stage.containerRoofPerSqFt));
    }
  }
  if (stages.length > 0) {
    lines.push(line('Stages', 'Power and audio rough-in', stages.length, 'ea', R.stage.servicesEach));
  }

  /* Marina ------------------------------------------------------- */
  const docks = featuresOfKind(layout.features, 'dock');
  let deckSqFt = 0;
  for (const d of docks) {
    const area = d.lengthFt * d.widthFt;
    if (d.role === 'gangway') {
      lines.push(line('Marina', 'Gangway', 1, 'ea', R.marina.gangwayEach));
      continue;
    }
    deckSqFt += area;
  }
  if (deckSqFt > 0) {
    lines.push(line('Marina', 'Floating deck', deckSqFt, 'sf', R.marina.floatingDeckPerSqFt));
    lines.push(
      line(
        'Marina',
        'Guide piles',
        Math.ceil(deckSqFt / R.marina.deckSqFtPerPile),
        'ea',
        R.marina.pilePerEach,
      ),
    );
    lines.push(line('Marina', 'Dock utilities', 1, 'ls', R.marina.dockUtilitiesLumpSum));
  }

  const slips = featuresOfKind(layout.features, 'slip');
  if (slips.length > 0) {
    lines.push(line('Marina', 'Slip fit-out', slips.length, 'ea', R.marina.slipFitOutEach));
  }
  const patios = slips.filter((s) => s.patio);
  if (patios.length > 0) {
    const patioSqFt = patios.reduce((a, s) => a + s.widthFt * s.lengthFt, 0);
    lines.push(line('Premier slips', 'Over-slip patio and shade', patioSqFt, 'sf', R.marina.overSlipPatioPerSqFt));
  }
  const swings = slips.filter((s) => s.ropeSwing).length;
  if (swings > 0) lines.push(line('Premier slips', 'Rope swings', swings, 'ea', R.marina.ropeSwingEach));
  const jumps = slips.filter((s) => s.jumpPlatform).length;
  if (jumps > 0) lines.push(line('Premier slips', 'Jump platforms', jumps, 'ea', R.marina.jumpPlatformEach));
  const slipBars = slips.filter((s) => s.bar).length;
  const deckBars = featuresOfKind(layout.features, 'patioBar').length;
  if (slipBars + deckBars > 0) {
    lines.push(line('Premier slips', 'Patio bars', slipBars + deckBars, 'ea', R.marina.patioBarEach));
  }
  const furnished = slips.filter((s) => s.furnished).length;
  if (furnished > 0) {
    lines.push(line('Premier slips', 'Furniture packages', furnished, 'ea', R.marina.furniturePackageEach));
  }

  for (const s of featuresOfKind(layout.features, 'overwaterStage')) {
    lines.push(
      line('Marina', s.name, s.widthFt * s.depthFt, 'sf', R.marina.overwaterStagePerSqFt),
    );
    if (s.roof === 'truss') {
      lines.push(line('Marina', `${s.name} roof`, s.widthFt * s.depthFt * 1.3, 'sf', R.stage.trussRoofPerSqFt));
    }
  }

  /* Lighting ----------------------------------------------------- */
  const runs = featuresOfKind(layout.features, 'stringLights');
  if (runs.length > 0) {
    const lf = runs.reduce(
      (a, r) => a + Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y, r.to.z - r.from.z),
      0,
    );
    lines.push(line('Lighting', 'Festoon lighting', lf, 'lf', R.lighting.stringLightsPerLf));
    if (runs.some((r) => r.rainbow)) {
      lines.push(line('Lighting', 'Colour control system', 1, 'ls', R.lighting.rainbowControlLumpSum));
    }
  }

  /* Lodging extras ------------------------------------------------ */
  const lodging = featuresOfKind(layout.features, 'accommodation');
  const keys = lodging
    .filter((l) => l.style !== 'glamping')
    .reduce((a, l) => a + l.units, 0);
  if (keys > 0) {
    lines.push(line('Lodging', 'Furniture, fixtures and equipment', keys, 'key', R.lodging.furnishingsPerKey));
  }
  const glampingKeys = lodging
    .filter((l) => l.style === 'glamping')
    .reduce((a, l) => a + l.units, 0);
  if (glampingKeys > 0) {
    lines.push(line('Lodging', 'Canvas platforms', glampingKeys, 'key', R.lodging.glampingPerKey));
  }

  const estimate = assemble(lines, 0, 0);
  return { ...estimate, byGroup: groupTotals(lines) };
}

export interface DragonBudget {
  cost: number;
  cap: number;
  /** Dollars past the cap. Zero or negative when it fits. */
  overBy: number;
  withinCap: boolean;
}

/**
 * The dragon against its own budget.
 *
 * The cap is an owner decision, not a market rate, so it gets its own readout
 * rather than being buried in the site total.
 */
export function dragonBudget(layout: Layout): DragonBudget {
  const cost = estimateSite(layout)
    .lines.filter((l) => l.group === 'Dragon')
    .reduce((a, l) => a + l.amount, 0);
  const cap = SITE_RATES.dragon.budgetCap;
  return { cost, cap, overBy: cost - cap, withinCap: cost <= cap };
}

export interface PropertyEstimate {
  castle: Estimate;
  lodging: Estimate;
  site: SiteEstimate;
  /** Cost the rule checker adds: bracing, transfer beams, roof framing. */
  ruleImpact: number;
  total: number;
  /** Built area across castle and lodging. */
  totalSqFt: number;
  costPerSqFt: number;
}

/** Everything, priced: castle, lodging, and the site build-out. */
export function estimateProperty(layout: Layout, checks?: CheckResult): PropertyEstimate {
  const castleQ = takeoff(layout, 'castle');
  const lodgingQ = takeoff(layout, 'lodging');

  const castle = estimateFromQuantities(castleQ);
  const lodging = estimateFromQuantities(lodgingQ);
  const site = estimateSite(layout);
  const ruleImpact = checks?.totalCostImpact ?? 0;

  const total = castle.total + lodging.total + site.total + ruleImpact;
  const totalSqFt = castle.totalSqFt + lodging.totalSqFt;

  return {
    castle,
    lodging,
    site,
    ruleImpact,
    total,
    totalSqFt,
    costPerSqFt: totalSqFt > 0 ? total / totalSqFt : 0,
  };
}
