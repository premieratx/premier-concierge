import { featuresOfKind } from '../domain/types';
import type { Layout, SlipFeature } from '../domain/types';
import { estimateSite } from '../cost/estimate';
import { PV_WATTS_PER_SQFT } from '../domain/generators/hexMarina';
import { SITE_RATES } from '../cost/rates';

/**
 * Assumptions for the slip revenue model.
 *
 * Every one of these is a market number, not a construction number, and they
 * are the first thing to replace with real comps from the lake. They are
 * gathered here so that replacing them is a single edit.
 */
export const SLIP_MARKET = {
  /** Monthly lease on a plain covered berth. */
  standardMonthly: 625,
  /**
   * Monthly lease on a premier berth with the patio, the shade, the bar and
   * the swim toys built in. This is the bundled play.
   */
  premierMonthly: 1450,
  /**
   * Monthly add-on when the furnishings are rented separately against a
   * standard berth instead. This is the unbundled play, and it is the one
   * almost nobody in a marina sells today.
   */
  furnishingMonthly: 385,
  standardOccupancy: 0.88,
  premierOccupancy: 0.94,
  /** Share of standard-slip tenants who take the furnishing add-on. */
  furnishingAttachRate: 0.55,
  /** Nights a premier patio gets booked out for an event on top of the lease. */
  eventNightsPerYear: 40,
  eventNightlyRate: 450,
  /** Operating margin on marina revenue, before debt service. */
  operatingMargin: 0.72,
  /** Annual replacement reserve on a furniture package, as a share of cost. */
  furnitureReserveRate: 0.2,
  /** Central Texas yield for a fixed array, kilowatt-hours per kilowatt-year. */
  solarYieldKwhPerKwYear: 1550,
  /** Blended retail rate the array offsets or sells back at. */
  solarValuePerKwh: 0.115,
} as const;

export type PricingStrategy = 'bundled' | 'unbundled';

export interface RevenueLine {
  label: string;
  units: number;
  unitLabel: string;
  annual: number;
}

export interface SlipRevenue {
  strategy: PricingStrategy;
  standardSlips: number;
  premierSlips: number;
  furnishedSlips: number;
  lines: RevenueLine[];
  grossAnnual: number;
  operatingIncome: number;
}

function countSlips(slips: SlipFeature[]) {
  const premier = slips.filter((s) => s.tier === 'premier');
  return {
    standard: slips.length - premier.length,
    premier: premier.length,
    furnished: slips.filter((s) => s.furnished).length,
  };
}

/**
 * Annual revenue from the berths under one of the two pricing strategies.
 *
 * Bundled: the patio, the furniture and the toys are baked into a premier
 * rate. Simple to sell, and the tenant never sees a line item they can decline.
 *
 * Unbundled: every berth is priced as standard and the furnishing package is
 * a separate monthly add-on. Lower headline rate, and the add-on is pure
 * margin on an asset that is already built — but it only earns on the slips
 * whose tenants actually take it.
 */
export function slipRevenue(
  layout: Layout,
  strategy: PricingStrategy = 'bundled',
): SlipRevenue {
  const slips = featuresOfKind(layout.features, 'slip');
  const { standard, premier, furnished } = countSlips(slips);
  const m = SLIP_MARKET;
  const lines: RevenueLine[] = [];

  if (strategy === 'bundled') {
    lines.push({
      label: 'Standard berth leases',
      units: standard,
      unitLabel: 'slips',
      annual: standard * m.standardMonthly * 12 * m.standardOccupancy,
    });
    lines.push({
      label: 'Premier berth leases',
      units: premier,
      unitLabel: 'slips',
      annual: premier * m.premierMonthly * 12 * m.premierOccupancy,
    });
  } else {
    const allStandard = standard + premier;
    lines.push({
      label: 'Berth leases at the standard rate',
      units: allStandard,
      unitLabel: 'slips',
      annual: allStandard * m.standardMonthly * 12 * m.standardOccupancy,
    });
    const attached = Math.round(premier * m.furnishingAttachRate);
    lines.push({
      label: 'Furnishing package rentals',
      units: attached,
      unitLabel: 'packages',
      annual: attached * m.furnishingMonthly * 12,
    });
  }

  if (premier > 0) {
    lines.push({
      label: 'Patio and roof-deck bookings',
      units: premier,
      unitLabel: 'berths',
      annual: premier * m.eventNightsPerYear * m.eventNightlyRate,
    });
  }

  // The roof is an array as well as a deck, and what it generates is marina
  // income whether it is sold back or simply not bought.
  const solarKw = featuresOfKind(layout.features, 'hexDock').reduce(
    (a, d) => a + (d.solarSqFt * PV_WATTS_PER_SQFT) / 1000,
    0,
  );
  if (solarKw > 0) {
    lines.push({
      label: 'Roof solar generation',
      units: Math.round(solarKw),
      unitLabel: 'kW',
      annual: solarKw * m.solarYieldKwhPerKwYear * m.solarValuePerKwh,
    });
  }

  const grossAnnual = lines.reduce((a, l) => a + l.annual, 0);

  return {
    strategy,
    standardSlips: standard,
    premierSlips: premier,
    furnishedSlips: furnished,
    lines,
    grossAnnual,
    operatingIncome: grossAnnual * m.operatingMargin,
  };
}

export interface MarinaBusinessCase {
  existing: SlipRevenue;
  proposed: SlipRevenue;
  /** Extra operating income the build-out earns each year. */
  incrementalOperatingIncome: number;
  /** What the marina scope costs to build, all in. */
  marinaCapex: number;
  /** Years to pay the build-out back out of the incremental income. */
  simplePaybackYears: number;
  /** Annual replacement reserve on the furniture packages. */
  furnitureReserve: number;
}

/**
 * The enhanced marina against the one that is already in the water.
 *
 * Payback is simple payback on operating income — no debt, no discounting, no
 * tax. It is a first look, not an underwriting.
 */
export function marinaBusinessCase(
  existingLayout: Layout,
  proposedLayout: Layout,
  strategy: PricingStrategy = 'bundled',
): MarinaBusinessCase {
  const existing = slipRevenue(existingLayout, strategy);
  const proposed = slipRevenue(proposedLayout, strategy);

  const marinaGroups = new Set(['Marina', 'Premier slips', 'Roof and solar']);
  const proposedSite = estimateSite(proposedLayout);
  const existingSite = estimateSite(existingLayout);
  const groupTotal = (est: typeof proposedSite) =>
    est.byGroup.filter((g) => marinaGroups.has(g.group)).reduce((a, g) => a + g.amount, 0);

  // Hard cost carries the same soft-cost and contingency load as everything
  // else, so the payback is measured against what actually gets written.
  const load = 1 + 0.18 + (1 + 0.18) * 0.18;
  const marinaCapex = (groupTotal(proposedSite) - groupTotal(existingSite)) * load;

  const incremental = proposed.operatingIncome - existing.operatingIncome;
  const furnitureReserve =
    proposed.furnishedSlips *
    SITE_RATES.marina.furniturePackageEach *
    SLIP_MARKET.furnitureReserveRate;

  return {
    existing,
    proposed,
    incrementalOperatingIncome: incremental,
    marinaCapex,
    simplePaybackYears: incremental > 0 ? marinaCapex / incremental : Infinity,
    furnitureReserve,
  };
}
