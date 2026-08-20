import { openingSqFt } from '../domain/geometry';
import type { Container, Opening } from '../domain/types';
import { RATES } from '../cost/rates';

/**
 * An opening counts as significant — and so as an 18-hour frame rather than a
 * 6-hour one — once it is larger than three feet in either direction. Below
 * that it is a porthole with a rolled collar; above it, it is a hole in the
 * shear diaphragm that needs a welded tube-steel frame carried to the
 * corner posts.
 */
export function isLargeOpening(opening: Pick<Opening, 'width' | 'height'>): boolean {
  return opening.width > 3 || opening.height > 3;
}

export function weldingHoursFor(opening: Pick<Opening, 'width' | 'height'>): number {
  return isLargeOpening(opening)
    ? RATES.welding.hoursPerLargeOpening
    : RATES.welding.hoursPerSmallOpening;
}

/** Hours the budget cap works out to: $50,000 at $95/hr. */
export const WELDING_CAP_HOURS = RATES.welding.budgetCap / RATES.welding.hourlyRate;

export interface OpeningEstimate {
  containerId: string;
  containerLabel: string;
  openingId: string;
  openingLabel: string;
  face: Opening['face'];
  sqFt: number;
  large: boolean;
  hours: number;
  cost: number;
}

export interface WeldingTakeoff {
  entries: OpeningEstimate[];
  openingCount: number;
  largeCount: number;
  smallCount: number;
  totalHours: number;
  totalCost: number;
  capHours: number;
  capCost: number;
  overBudget: boolean;
  /** Hours left before the cap. Negative once it is blown. */
  hoursRemaining: number;
  /** Fraction of the cap consumed. */
  utilisation: number;
}

/**
 * Every cut in the model, priced.
 *
 * This is the number the whole tool is built around. A container is cheap and
 * a hole in one is not: the frame, the fit-up and the weld-out are the line
 * item that decides whether the design is buildable inside the budget, and
 * watching it climb is meant to change how you draw.
 */
export function weldingTakeoff(containers: Container[]): WeldingTakeoff {
  const entries: OpeningEstimate[] = [];

  for (const c of containers) {
    for (const o of c.openings) {
      const large = isLargeOpening(o);
      const hours = weldingHoursFor(o);
      entries.push({
        containerId: c.id,
        containerLabel: c.label ?? c.id,
        openingId: o.id,
        openingLabel: o.label ?? o.id,
        face: o.face,
        sqFt: openingSqFt(o),
        large,
        hours,
        cost: hours * RATES.welding.hourlyRate,
      });
    }
  }

  const totalHours = entries.reduce((a, e) => a + e.hours, 0);
  const largeCount = entries.filter((e) => e.large).length;

  return {
    entries,
    openingCount: entries.length,
    largeCount,
    smallCount: entries.length - largeCount,
    totalHours,
    totalCost: totalHours * RATES.welding.hourlyRate,
    capHours: WELDING_CAP_HOURS,
    capCost: RATES.welding.budgetCap,
    overBudget: totalHours > WELDING_CAP_HOURS,
    hoursRemaining: WELDING_CAP_HOURS - totalHours,
    utilisation: totalHours / WELDING_CAP_HOURS,
  };
}

/**
 * The cheapest way back under the cap: drop the biggest openings first, since
 * they cost three times what a small one does for the same act of deleting.
 */
export function openingsToEliminate(takeoff: WeldingTakeoff): OpeningEstimate[] {
  if (!takeoff.overBudget) return [];
  const ordered = [...takeoff.entries].sort(
    (a, b) => b.hours - a.hours || b.sqFt - a.sqFt,
  );
  const cut: OpeningEstimate[] = [];
  let hours = takeoff.totalHours;
  for (const entry of ordered) {
    if (hours <= takeoff.capHours) break;
    cut.push(entry);
    hours -= entry.hours;
  }
  return cut;
}
