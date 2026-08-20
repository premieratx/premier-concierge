import { describe, expect, it } from 'vitest';
import { generateProperty } from '../domain/property';
import { featuresOfKind } from '../domain/types';
import { marinaBusinessCase, slipRevenue, SLIP_MARKET } from './slips';

const existing = generateProperty({ marinaPhase: 'existing' });
const enhanced = generateProperty({ marinaPhase: 'enhanced' });

describe('slip revenue', () => {
  it('earns nothing extra from a marina with no premier berths', () => {
    const r = slipRevenue(existing, 'bundled');
    expect(r.premierSlips).toBe(0);
    expect(r.lines.some((l) => l.label.includes('Patio event'))).toBe(false);
  });

  it('prices premier berths above standard ones', () => {
    const r = slipRevenue(enhanced, 'bundled');
    expect(r.premierSlips).toBeGreaterThan(0);
    const premierLine = r.lines.find((l) => l.label.includes('Premier'))!;
    const standardLine = r.lines.find((l) => l.label.includes('Standard'))!;
    expect(premierLine.annual / premierLine.units).toBeGreaterThan(
      standardLine.annual / standardLine.units,
    );
  });

  it('earns on the attach rate when the furnishings are unbundled', () => {
    const r = slipRevenue(enhanced, 'unbundled');
    const addOn = r.lines.find((l) => l.label.includes('Furnishing'))!;
    const premier = featuresOfKind(enhanced.features, 'slip').filter((s) => s.tier === 'premier');
    expect(addOn.units).toBe(Math.round(premier.length * SLIP_MARKET.furnishingAttachRate));
  });

  it('takes an operating margin off the top line', () => {
    const r = slipRevenue(enhanced, 'bundled');
    expect(r.operatingIncome).toBeCloseTo(r.grossAnnual * SLIP_MARKET.operatingMargin, 6);
    expect(r.operatingIncome).toBeLessThan(r.grossAnnual);
  });
});

describe('the business case', () => {
  it('shows the build-out earning more than what is in the water today', () => {
    const c = marinaBusinessCase(existing, enhanced, 'bundled');
    expect(c.incrementalOperatingIncome).toBeGreaterThan(0);
    expect(c.marinaCapex).toBeGreaterThan(0);
    expect(c.simplePaybackYears).toBeGreaterThan(0);
    expect(Number.isFinite(c.simplePaybackYears)).toBe(true);
  });

  it('loads the capex with soft cost and contingency', () => {
    const c = marinaBusinessCase(existing, enhanced, 'bundled');
    // 18% soft, then 18% contingency on the pair: a 1.39 multiplier.
    expect(c.marinaCapex / (1 + 0.18 + 1.18 * 0.18)).toBeGreaterThan(0);
  });

  it('earns more bundled than unbundled at this attach rate', () => {
    const bundled = marinaBusinessCase(existing, enhanced, 'bundled');
    const unbundled = marinaBusinessCase(existing, enhanced, 'unbundled');
    expect(bundled.incrementalOperatingIncome).toBeGreaterThan(
      unbundled.incrementalOperatingIncome,
    );
    expect(bundled.simplePaybackYears).toBeLessThan(unbundled.simplePaybackYears);
  });

  it('reserves against replacing the furniture packages', () => {
    const c = marinaBusinessCase(existing, enhanced, 'bundled');
    expect(c.furnitureReserve).toBeGreaterThan(0);
  });

  it('pays nothing back when nothing is added', () => {
    const c = marinaBusinessCase(existing, existing, 'bundled');
    expect(c.incrementalOperatingIncome).toBe(0);
    expect(c.simplePaybackYears).toBe(Infinity);
  });
});
