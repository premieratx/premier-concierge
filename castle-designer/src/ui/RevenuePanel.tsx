import { useMemo } from 'react';
import { generateProperty } from '../domain/property';
import { featuresOfKind } from '../domain/types';
import { marinaBusinessCase, SLIP_MARKET } from '../revenue/slips';
import { useLayoutStore } from '../store/useLayoutStore';
import { Button, Row, Section, num, usd } from './primitives';

/**
 * The marina business case.
 *
 * The interesting question is not what the build-out costs, it is whether the
 * over-slip patios pay for themselves — and whether the furnishings are better
 * sold as a premier rate or as a separate monthly add-on. Both are priced
 * here side by side.
 */
export function RevenuePanel() {
  const layout = useLayoutStore((s) => s.layout);
  const strategy = useLayoutStore((s) => s.pricingStrategy);
  const setStrategy = useLayoutStore((s) => s.setPricingStrategy);

  const existingLayout = useMemo(
    () => generateProperty({ marinaPhase: 'existing' }),
    [],
  );

  const bundled = useMemo(
    () => marinaBusinessCase(existingLayout, layout, 'bundled'),
    [existingLayout, layout],
  );
  const unbundled = useMemo(
    () => marinaBusinessCase(existingLayout, layout, 'unbundled'),
    [existingLayout, layout],
  );

  const active = strategy === 'bundled' ? bundled : unbundled;
  const slips = featuresOfKind(layout.features, 'slip');
  const premier = slips.filter((s) => s.tier === 'premier');
  // In the hexagonal scheme the amenities live on the roof decks, not on the
  // berths, so they are counted from the hexagons rather than from the slips.
  const hexDocks = featuresOfKind(layout.features, 'hexDock');
  const walkways = featuresOfKind(layout.features, 'walkway');
  const roofSqFt = hexDocks.reduce((a, d) => a + d.roofSqFt, 0);
  const amenity = (pick: (d: (typeof hexDocks)[number]) => boolean) =>
    hexDocks.filter(pick).length || 0;

  return (
    <div className="space-y-6">
      <Section title="Berths" subtitle="What is in the water in this scheme">
        <Row label="Slips, total" value={num(slips.length)} />
        <Row label="Premier" value={num(premier.length)} />
        <Row label="Standard" value={num(slips.length - premier.length)} />
        {hexDocks.length > 0 ? (
          <>
            <Row label="Hexagons" value={`${hexDocks.length} · 1 hub, ${hexDocks.length - 1} docks`} />
            <Row label="Retractable walkways" value={num(walkways.length)} />
            <Row label="Roof deck" value={`${num(roofSqFt)} sf`} />
            <Row label="Roof bars" value={num(amenity((d) => d.amenities.bar))} />
            <Row label="Jump platforms" value={num(amenity((d) => d.amenities.jumpPlatform))} />
            <Row label="Rope swings" value={num(amenity((d) => d.amenities.ropeSwing))} />
          </>
        ) : (
          <>
            <Row label="Over-slip patios" value={num(slips.filter((s) => s.patio).length)} />
            <Row label="Rope swings" value={num(slips.filter((s) => s.ropeSwing).length)} />
            <Row label="Jump platforms" value={num(slips.filter((s) => s.jumpPlatform).length)} />
            <Row label="Patio bars" value={num(slips.filter((s) => s.bar).length)} />
          </>
        )}
      </Section>

      <Section
        title="Pricing strategy"
        subtitle="Bundle the furnishings into a premier rate, or rent them as an add-on"
      >
        <div className="flex gap-2 pb-2">
          <Button active={strategy === 'bundled'} onClick={() => setStrategy('bundled')}>
            Bundled premier rate
          </Button>
          <Button active={strategy === 'unbundled'} onClick={() => setStrategy('unbundled')}>
            Furnishing add-on
          </Button>
        </div>
        {active.proposed.lines.map((l) => (
          <Row key={l.label} label={`${l.label} (${num(l.units)} ${l.unitLabel})`} value={`${usd(l.annual)}/yr`} />
        ))}
        <div className="my-2 h-px bg-slate-800" />
        <Row label="Gross revenue" value={`${usd(active.proposed.grossAnnual)}/yr`} />
        <Row label="Operating income" value={`${usd(active.proposed.operatingIncome)}/yr`} emphasis />
      </Section>

      <Section title="Against the existing marina">
        <Row label="Today, operating income" value={`${usd(active.existing.operatingIncome)}/yr`} />
        <Row label="Build-out, operating income" value={`${usd(active.proposed.operatingIncome)}/yr`} />
        <Row label="Incremental" value={`${usd(active.incrementalOperatingIncome)}/yr`} emphasis />
        <Row label="Marina capex" value={usd(active.marinaCapex)} />
        <Row
          label="Simple payback"
          value={
            Number.isFinite(active.simplePaybackYears)
              ? `${active.simplePaybackYears.toFixed(1)} yr`
              : 'n/a'
          }
          emphasis
        />
        <Row label="Furniture reserve" value={`${usd(active.furnitureReserve)}/yr`} muted />
      </Section>

      <Section title="Both strategies, side by side">
        <Row label="Bundled — incremental" value={`${usd(bundled.incrementalOperatingIncome)}/yr`} />
        <Row label="Bundled — payback" value={`${bundled.simplePaybackYears.toFixed(1)} yr`} />
        <Row label="Add-on — incremental" value={`${usd(unbundled.incrementalOperatingIncome)}/yr`} />
        <Row label="Add-on — payback" value={`${unbundled.simplePaybackYears.toFixed(1)} yr`} />
        <p className="pt-1 text-[11px] leading-relaxed text-slate-600">
          Bundling gets the whole premium from every premier berth and is simpler to sell. The
          add-on earns only on the {Math.round(SLIP_MARKET.furnishingAttachRate * 100)}% of
          tenants who take it, but it prices a thing no slip rental normally includes, so it
          can also be sold to standard berths later without repricing the lease.
        </p>
      </Section>

      <p className="text-[11px] leading-relaxed text-slate-600">
        Market assumptions — rates, occupancy, attach rate, operating margin — are placeholders
        in <span className="font-mono">src/revenue/slips.ts</span>. Replace them with real comps
        from the lake before anyone relies on the payback.
      </p>
    </div>
  );
}
