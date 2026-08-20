import { describe, expect, it } from 'vitest';
import { generateProperty } from '../domain/property';
import { runAllChecks } from '../rules';
import {
  estimateFromQuantities,
  estimateProperty,
  estimateSite,
  REFERENCE_QUANTITIES,
  REFERENCE_TARGET_PER_SQ_FT,
  REFERENCE_TARGET_TOTAL,
  dragonBudget,
} from './estimate';
import { RATES } from './rates';
import { takeoff } from './takeoff';

describe('the reference design', () => {
  const estimate = estimateFromQuantities(REFERENCE_QUANTITIES);

  it('lands within 3% of $6.3M', () => {
    const low = REFERENCE_TARGET_TOTAL * 0.97;
    const high = REFERENCE_TARGET_TOTAL * 1.03;
    expect(estimate.total).toBeGreaterThan(low);
    expect(estimate.total).toBeLessThan(high);
  });

  it('lands near $315 a square foot', () => {
    expect(estimate.costPerSqFt).toBeGreaterThan(REFERENCE_TARGET_PER_SQ_FT * 0.95);
    expect(estimate.costPerSqFt).toBeLessThan(REFERENCE_TARGET_PER_SQ_FT * 1.05);
  });

  it('is measured over 20,000 square feet of programme', () => {
    expect(estimate.totalSqFt).toBe(20_000);
  });

  it('applies soft cost to hard cost and contingency to both', () => {
    expect(estimate.softCost).toBeCloseTo(estimate.hardCost * RATES.soft.softCostPct, 6);
    expect(estimate.contingency).toBeCloseTo(
      (estimate.hardCost + estimate.softCost) * RATES.soft.contingencyPct,
      6,
    );
    expect(estimate.total).toBeCloseTo(
      estimate.hardCost + estimate.softCost + estimate.contingency,
      6,
    );
  });

  it('has no line item with a negative amount', () => {
    for (const l of estimate.lines) {
      expect(l.amount, `${l.group}/${l.label}`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('estimate scaling', () => {
  it('costs more when more is built', () => {
    const bigger = estimateFromQuantities({
      ...REFERENCE_QUANTITIES,
      containersByType: { '40HC': 90, '20ST': 40 },
      containerCount: 130,
      sealedSqFt: 8000,
    });
    expect(bigger.total).toBeGreaterThan(estimateFromQuantities(REFERENCE_QUANTITIES).total);
  });

  it('charges nothing for lateral bracing on a single-level layout', () => {
    const flat = estimateFromQuantities({
      ...REFERENCE_QUANTITIES,
      maxStackDepth: 1,
      needsLateralBracing: false,
    });
    expect(flat.lines.some((l) => l.label === 'Engineered lateral bracing')).toBe(false);
  });
});

describe('the generated property', () => {
  const layout = generateProperty({ marinaPhase: 'enhanced' });
  const checks = runAllChecks(layout);
  const estimate = estimateProperty(layout, checks);

  it('prices castle, lodging and site separately', () => {
    expect(estimate.castle.total).toBeGreaterThan(0);
    expect(estimate.lodging.total).toBeGreaterThan(0);
    expect(estimate.site.total).toBeGreaterThan(0);
    expect(estimate.total).toBeCloseTo(
      estimate.castle.total + estimate.lodging.total + estimate.site.total + estimate.ruleImpact,
      6,
    );
  });

  it('keeps the lodging zone out of the castle takeoff', () => {
    const castle = takeoff(layout, 'castle');
    const lodging = takeoff(layout, 'lodging');
    expect(castle.containerCount + lodging.containerCount).toBe(layout.containers.length);
    expect(lodging.containerCount).toBeGreaterThan(0);
  });

  it('does not invent paved courtyard or borrow the hall roof for lodging', () => {
    const lodging = takeoff(layout, 'lodging');
    const castle = takeoff(layout, 'castle');
    // The great hall's truss roof belongs to the castle and nowhere else.
    expect(castle.trussRoofSqFt).toBeGreaterThan(0);
    expect(lodging.trussRoofSqFt).toBe(0);
    // Lodging open-air is decks and tent platforms, not the gaps between cabins.
    expect(lodging.openAirSqFt).toBeLessThan(8000);
  });

  it('builds the dragon inside its $20,000 cap', () => {
    const budget = dragonBudget(layout);
    expect(budget.cost).toBe(20_000);
    expect(budget.withinCap).toBe(true);
  });

  it('drops the burner cost when the dragon is not breathing fire', () => {
    const cold = {
      ...layout,
      features: layout.features.map((f) =>
        f.kind === 'dragon' ? { ...f, breathingFire: false } : f,
      ),
    };
    expect(dragonBudget(cold).cost).toBe(16_500);
  });

  it('scales the material lines with the beast and blows the cap if it grows', () => {
    const huge = {
      ...layout,
      features: layout.features.map((f) =>
        f.kind === 'dragon' ? { ...f, lengthFt: 300 } : f,
      ),
    };
    const budget = dragonBudget(huge);
    expect(budget.withinCap).toBe(false);
    expect(budget.overBy).toBeGreaterThan(0);
  });

  it('costs more with the enhanced marina than with the existing one', () => {
    const existing = generateProperty({ marinaPhase: 'existing' });
    expect(estimateSite(layout).total).toBeGreaterThan(estimateSite(existing).total);
  });
});
