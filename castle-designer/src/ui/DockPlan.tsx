import { useCallback, useMemo, useRef, useState } from 'react';
import { SITE_RATES } from '../cost/rates';
import {
  FLOAT,
  PV_WATTS_PER_SQFT,
  apothem,
  hexVertices,
  planHexMarina,
  type HexMarinaPlan,
  type HexModulePlan,
  type Point2,
} from '../domain/generators/hexMarina';
import { HEX_MARINA } from '../domain/property';
import { num, usd } from './primitives';

/* ------------------------------------------------------------------ *
 * A drawing, not a diagram.
 *
 * Everything here is projected straight off the same plan object the 3D model
 * is built from, at one SVG unit to one foot, so zooming in is genuinely more
 * information rather than a bigger picture of the same thing. Dimensions,
 * berth numbers and the float grid appear as the scale crosses the point where
 * they would be legible on paper.
 * ------------------------------------------------------------------ */

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

const COLORS = {
  ink: '#0f1620',
  deck: '#c9b48c',
  deckLine: '#8d7a58',
  water: '#dbe9f2',
  berth: '#eef4f8',
  berthLine: '#7f97a8',
  premier: '#ffe9bb',
  premierLine: '#c79a45',
  roof: '#9fc4d8',
  solar: '#1d2b4a',
  dim: '#c2452f',
  note: '#5a6675',
  walkway: '#b9a279',
  lagoon: '#bfe0e6',
};

function polyPath(points: Point2[]): string {
  return `${points
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${v.x.toFixed(2)},${v.z.toFixed(2)}`)
    .join(' ')} Z`;
}

function hexPath(centre: Point2, radius: number, rotation: number): string {
  return `${hexVertices(centre, radius, rotation)
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${v.x.toFixed(2)},${v.z.toFixed(2)}`)
    .join(' ')} Z`;
}

/** Berth rectangle, in the berth's own frame. */
function Berth({
  slip,
  showNumber,
}: {
  slip: HexModulePlan['slips'][number];
  showNumber: boolean;
}) {
  // rotationY points local +X inward; SVG is x/z so the same angle, negated.
  const deg = (-slip.rotationY * 180) / Math.PI;
  return (
    <g transform={`translate(${slip.center.x} ${slip.center.z}) rotate(${deg})`}>
      <rect
        x={-slip.lengthFt / 2}
        y={-slip.widthFt / 2}
        width={slip.lengthFt}
        height={slip.widthFt}
        fill={slip.premier ? COLORS.premier : COLORS.berth}
        stroke={slip.premier ? COLORS.premierLine : COLORS.berthLine}
        strokeWidth={0.5}
      />
      <line
        x1={-slip.lengthFt / 2}
        y1={-slip.widthFt / 2}
        x2={slip.lengthFt / 2}
        y2={-slip.widthFt / 2}
        stroke={COLORS.deckLine}
        strokeWidth={1.4}
      />
      {/* Bow end: the berth points inward, toward the turning basin. */}
      <path
        d={`M${slip.lengthFt / 2 - 4},${-slip.widthFt / 2 + 1.5} L${slip.lengthFt / 2 - 1},0 L${slip.lengthFt / 2 - 4},${slip.widthFt / 2 - 1.5}`}
        fill="none"
        stroke={COLORS.berthLine}
        strokeWidth={0.5}
      />
      {showNumber && (
        <text
          x={-1}
          y={2.4}
          fontSize={6}
          textAnchor="middle"
          fill={COLORS.note}
          fontFamily="ui-monospace, monospace"
        >
          {slip.slipNumber}
        </text>
      )}
    </g>
  );
}

/** The 4 x 8 float grid under one run of deck, drawn as a callout. */
function FloatGrid({ module, spec }: { module: HexModulePlan; spec: HexMarinaPlan['spec'] }) {
  const cells = useMemo(() => {
    const a = module.vertices[0]!;
    const b = module.vertices[1]!;
    const run = Math.hypot(b.x - a.x, b.z - a.z);
    const ux = (b.x - a.x) / run;
    const uz = (b.z - a.z) / run;
    const nx = -uz;
    const nz = ux;
    // Inward is toward the module centre.
    const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    const toCentre = { x: module.centre.x - mid.x, z: module.centre.z - mid.z };
    const sign = nx * toCentre.x + nz * toCentre.z > 0 ? 1 : -1;

    const along = Math.floor(run / FLOAT.lengthFt);
    const across = Math.max(1, Math.round(spec.perimeterWalkFt / FLOAT.widthFt));
    const out: { points: string }[] = [];
    for (let i = 0; i < along; i++) {
      for (let j = 0; j < across; j++) {
        const p0 = {
          x: a.x + ux * (i * FLOAT.lengthFt) + sign * nx * (j * FLOAT.widthFt),
          z: a.z + uz * (i * FLOAT.lengthFt) + sign * nz * (j * FLOAT.widthFt),
        };
        const corners = [
          p0,
          { x: p0.x + ux * FLOAT.lengthFt, z: p0.z + uz * FLOAT.lengthFt },
          {
            x: p0.x + ux * FLOAT.lengthFt + sign * nx * FLOAT.widthFt,
            z: p0.z + uz * FLOAT.lengthFt + sign * nz * FLOAT.widthFt,
          },
          { x: p0.x + sign * nx * FLOAT.widthFt, z: p0.z + sign * nz * FLOAT.widthFt },
        ];
        out.push({ points: corners.map((c) => `${c.x.toFixed(2)},${c.z.toFixed(2)}`).join(' ') });
      }
    }
    return out;
  }, [module, spec.perimeterWalkFt]);

  return (
    <g>
      {cells.map((cell, i) => (
        <polygon
          key={i}
          points={cell.points}
          fill="none"
          stroke={COLORS.deckLine}
          strokeWidth={0.22}
          strokeDasharray="1.5 1.2"
        />
      ))}
    </g>
  );
}

function Dimension({
  from,
  to,
  label,
  offset = 0,
  fontSize = 6.5,
}: {
  from: Point2;
  to: Point2;
  label: string;
  offset?: number;
  fontSize?: number;
}) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = (-dz / len) * offset;
  const nz = (dx / len) * offset;
  const a = { x: from.x + nx, z: from.z + nz };
  const b = { x: to.x + nx, z: to.z + nz };
  const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
  const deg = (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI;
  return (
    <g stroke={COLORS.dim} fill={COLORS.dim}>
      <line x1={a.x} y1={a.z} x2={b.x} y2={b.z} strokeWidth={0.4} />
      <circle cx={a.x} cy={a.z} r={fontSize * 0.14} />
      <circle cx={b.x} cy={b.z} r={fontSize * 0.14} />
      <text
        transform={`translate(${mid.x} ${mid.z}) rotate(${deg})`}
        y={-fontSize * 0.4}
        fontSize={fontSize}
        textAnchor="middle"
        stroke="none"
        fontFamily="ui-monospace, monospace"
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Section through a satellite: floats, deck, columns, array, clear deck — and
 * the lagoon and its net, which is the half of this design you cannot see in
 * plan.
 */
function Section({ plan }: { plan: HexMarinaPlan }) {
  const spec = plan.spec;
  const a = apothem(spec.sideFt);
  const lagoonHalf = a - spec.perimeterWalkFt;
  const deckOuter = a;
  const berthOuter = a + spec.slipLengthFt;
  const width = (berthOuter + 24) * 2;
  const half = width / 2;
  const deckY = 0;
  const roofY = -spec.roofHeightFt;
  const waterY = spec.freeboardFt;
  const netY = waterY + spec.swimNetDepthFt;

  return (
    <svg
      viewBox={`${-half} ${roofY - 26} ${width} ${spec.roofHeightFt + 26 + netY + 16}`}
      className="h-full w-full"
      role="img"
      aria-label="Section through one dock hexagon"
    >
      <rect x={-half} y={waterY} width={width} height={netY + 22} fill={COLORS.water} />
      <line x1={-half} y1={waterY} x2={half} y2={waterY} stroke="#5f89a6" strokeWidth={0.6} />

      {/* The lagoon: the same lake, but inside the ring and inside the net. */}
      <rect
        x={-lagoonHalf}
        y={waterY}
        width={lagoonHalf * 2}
        height={netY - waterY}
        fill="#c2e0e6"
      />
      <line
        x1={-lagoonHalf}
        y1={netY}
        x2={lagoonHalf}
        y2={netY}
        stroke="#3f7f8c"
        strokeWidth={0.7}
        strokeDasharray="2 1.4"
      />
      {[-1, 1].map((side) => (
        <line
          key={side}
          x1={side * lagoonHalf}
          y1={waterY}
          x2={side * lagoonHalf}
          y2={netY}
          stroke="#3f7f8c"
          strokeWidth={0.7}
          strokeDasharray="2 1.4"
        />
      ))}

      {/* Deck, floats, berth and roof, one run either side of the lagoon. */}
      {[-1, 1].map((side) => {
        const inner = side * lagoonHalf;
        const outer = side * deckOuter;
        const x = Math.min(inner, outer);
        const berthFrom = Math.min(side * deckOuter, side * berthOuter);
        return (
          <g key={side}>
            <rect x={x} y={deckY} width={spec.perimeterWalkFt} height={2.67} fill="#41474f" />
            <rect
              x={x - 0.4}
              y={deckY - 1.2}
              width={spec.perimeterWalkFt + 0.8}
              height={1.2}
              fill={COLORS.deck}
              stroke={COLORS.deckLine}
              strokeWidth={0.3}
            />
            {/* Column on the ring, and the outboard column on its pile. */}
            <rect x={side * (lagoonHalf + 6) - 0.8} y={roofY} width={1.6} height={spec.roofHeightFt - 1.2} fill="#8d949c" />
            <rect x={side * (berthOuter - 2) - 0.8} y={roofY} width={1.6} height={spec.roofHeightFt + netY + 6} fill="#8d949c" />

            {/* A boat in the berth, which is what the overhang is for. */}
            <path
              d={`M${berthFrom + 3},${waterY - 1} L${berthFrom + spec.slipLengthFt - 4},${waterY - 1} L${berthFrom + spec.slipLengthFt - 7},${waterY + 2.4} L${berthFrom + 5},${waterY + 2.4} Z`}
              fill="#eef4f8"
              stroke={COLORS.berthLine}
              strokeWidth={0.4}
            />

            {/* Roof: array under clear structural decking, rail on top. */}
            <rect
              x={Math.min(inner, side * berthOuter)}
              y={roofY - 1.4}
              width={berthOuter - lagoonHalf}
              height={1.4}
              fill={COLORS.roof}
              opacity={0.55}
            />
            <rect
              x={Math.min(inner, side * berthOuter) + 2}
              y={roofY - 0.2}
              width={berthOuter - lagoonHalf - 4}
              height={1.1}
              fill={COLORS.solar}
            />
            <line x1={inner} y1={roofY - 5} x2={inner} y2={roofY - 1.4} stroke="#5c6068" strokeWidth={0.5} />
            <line
              x1={side * berthOuter}
              y1={roofY - 5}
              x2={side * berthOuter}
              y2={roofY - 1.4}
              stroke="#5c6068"
              strokeWidth={0.5}
            />
            <line
              x1={inner}
              y1={roofY - 5}
              x2={side * berthOuter}
              y2={roofY - 5}
              stroke="#5c6068"
              strokeWidth={0.5}
            />
          </g>
        );
      })}

      <Dimension
        from={{ x: -lagoonHalf, z: netY + 6 }}
        to={{ x: lagoonHalf, z: netY + 6 }}
        label={`${num(plan.lagoonWidthFt, 0)}′ swim lagoon`}
        fontSize={4}
      />
      <Dimension
        from={{ x: lagoonHalf - 4, z: waterY }}
        to={{ x: lagoonHalf - 4, z: netY }}
        label={`${spec.swimNetDepthFt}′ net`}
        offset={-11}
        fontSize={3.4}
      />
      <Dimension
        from={{ x: deckOuter, z: roofY }}
        to={{ x: deckOuter, z: deckY }}
        label={`${spec.roofHeightFt}′ clear`}
        offset={-13}
        fontSize={3.4}
      />
      <Dimension
        from={{ x: -berthOuter, z: deckY + 2.67 }}
        to={{ x: -berthOuter, z: deckY }}
        label={`${FLOAT.depthIn}″ float`}
        offset={-9}
        fontSize={3.4}
      />
      <Dimension
        from={{ x: deckOuter, z: roofY - 8 }}
        to={{ x: berthOuter, z: roofY - 8 }}
        label={`${spec.slipLengthFt}′ berth, covered`}
        fontSize={3.4}
      />

      <text x={-half + 5} y={roofY - 14} fontSize={3.6} fill={COLORS.note} fontFamily="ui-sans-serif, system-ui">
        Clear structural decking over photovoltaic — the roof is the array,
      </text>
      <text x={-half + 5} y={roofY - 9.6} fontSize={3.6} fill={COLORS.note} fontFamily="ui-sans-serif, system-ui">
        the array is the shade, and the shade reaches out over every berth
      </text>
      <text x={-half + 5} y={netY + 14} fontSize={3.6} fill={COLORS.note} fontFamily="ui-sans-serif, system-ui">
        {`Net hung ${spec.swimNetDepthFt}′ down and skirted to the surface: nothing dropped in leaves the lagoon`}
      </text>
    </svg>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/60 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="font-mono text-lg tabular-nums text-slate-100">{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );
}

export function DockPlan() {
  const plan = useMemo(() => planHexMarina(HEX_MARINA), []);
  const spec = plan.spec;

  const extent = plan.extentFt * 1.08;
  const initial = useMemo<View>(
    () => ({
      x: spec.center.x - extent / 2,
      y: spec.center.z - extent / 2,
      w: extent,
      h: extent,
    }),
    [spec.center.x, spec.center.z, extent],
  );

  const [view, setView] = useState<View>(initial);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: View } | null>(null);

  /** How many feet one screen pixel covers — the drawing's scale. */
  const detail = extent / view.w;

  const zoomAbout = useCallback((factor: number, fx: number, fy: number) => {
    setView((v) => {
      const w = Math.min(extent * 2, Math.max(extent / 60, v.w * factor));
      const h = w;
      return { x: fx - (fx - v.x) * (w / v.w), y: fy - (fy - v.y) * (h / v.h), w, h };
    });
  }, [extent]);

  const toWorld = (clientX: number, clientY: number): Point2 => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: view.x, z: view.y };
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.w,
      z: view.y + ((clientY - rect.top) / rect.height) * view.h,
    };
  };

  const detailModule = plan.modules.find((m) => m.role === 'satellite')!;
  const showNumbers = detail > 2.2;
  const showDimensions = detail > 1.5;
  const showFloats = detail > 3.4;

  const marinaCost = useMemo(() => {
    const H = SITE_RATES.hexMarina;
    return (
      plan.floatCount * H.floatEach +
      plan.deckSqFt * H.frameworkPerSqFt +
      plan.roofSqFt * (H.roofStructurePerSqFt + H.clearDeckPerSqFt) +
      plan.solarKwDc * 1000 * H.solarPerWatt +
      plan.modules.length * H.pilesPerHexagon * H.mooringPileEach +
      plan.walkways.length * H.retractableWalkwayEach
    );
  }, [plan]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 bg-slate-950 p-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-50">
            Hexagonal marina — general arrangement
          </h2>
          <p className="text-[11px] text-slate-500">
            Seven hexagons, {spec.sideFt}′ a side · scroll to zoom, drag to pan · drawn at one
            unit to the foot from the same model the 3D view uses
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => zoomAbout(0.7, view.x + view.w / 2, view.y + view.h / 2)}
            className="rounded bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            Zoom in
          </button>
          <button
            type="button"
            onClick={() => zoomAbout(1.4, view.x + view.w / 2, view.y + view.h / 2)}
            className="rounded bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            Zoom out
          </button>
          <button
            type="button"
            onClick={() => setView(initial)}
            className="rounded bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
          >
            Fit
          </button>
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Berths" value={num(plan.slipCount)} sub={`${spec.slipWidthFt}′ × ${spec.slipLengthFt}′`} />
        <Stat label="Hexagons" value={`${plan.modules.length}`} sub="1 hub, 6 satellites" />
        <Stat label="Dock floats" value={num(plan.floatCount)} sub={`4′×8′×${FLOAT.depthIn}″`} />
        <Stat label="Floating deck" value={`${num(plan.deckSqFt)} sf`} />
        <Stat label="Roof deck" value={`${num(plan.roofSqFt)} sf`} sub="clear over array" />
        <Stat label="Solar" value={`${num(plan.solarKwDc)} kW`} sub={`${PV_WATTS_PER_SQFT} W/sf`} />
        <Stat label="Marina hard cost" value={usd(marinaCost)} sub="before soft and contingency" />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[3fr_2fr]">
        <div className="relative min-h-0 overflow-hidden rounded border border-slate-800 bg-[#f4f1e8]">
          <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
            className="h-full w-full cursor-grab active:cursor-grabbing"
            role="img"
            aria-label="Plan of the hexagonal marina"
            onWheel={(e) => {
              const p = toWorld(e.clientX, e.clientY);
              zoomAbout(e.deltaY > 0 ? 1.12 : 0.89, p.x, p.z);
            }}
            onPointerDown={(e) => {
              drag.current = { x: e.clientX, y: e.clientY, view };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const rect = svgRef.current?.getBoundingClientRect();
              if (!rect) return;
              const dx = ((e.clientX - d.x) / rect.width) * d.view.w;
              const dy = ((e.clientY - d.y) / rect.height) * d.view.h;
              setView({ ...d.view, x: d.view.x - dx, y: d.view.y - dy });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
          >
            <rect x={view.x} y={view.y} width={view.w} height={view.h} fill={COLORS.water} />

            {/* Retractable walkways. */}
            {plan.walkways.map((w) => {
              const dx = w.to.x - w.from.x;
              const dz = w.to.z - w.from.z;
              const len = Math.hypot(dx, dz);
              const deg = (Math.atan2(dz, dx) * 180) / Math.PI;
              return (
                <g key={w.id} transform={`translate(${w.from.x} ${w.from.z}) rotate(${deg})`}>
                  <rect
                    x={0}
                    y={-w.widthFt / 2}
                    width={len}
                    height={w.widthFt}
                    fill={COLORS.walkway}
                    stroke={COLORS.deckLine}
                    strokeWidth={0.4}
                  />
                  {showDimensions && (
                    <text
                      x={len / 2}
                      y={-w.widthFt / 2 - 2.5}
                      fontSize={5.5}
                      textAnchor="middle"
                      fill={COLORS.dim}
                      fontFamily="ui-monospace, monospace"
                    >
                      {`${w.lengthFt}′ retractable`}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Hexagons. */}
            {plan.modules.map((module) => (
              <g key={module.id}>
                {/* The roof: it reaches out over the berths and stops at the
                    lagoon, so it is bigger in plan than anything under it. */}
                {module.role === 'satellite' && (
                  <path
                    d={polyPath(module.roofOutline)}
                    fill={COLORS.roof}
                    fillOpacity={0.22}
                    stroke={COLORS.roof}
                    strokeWidth={0.6}
                    strokeDasharray="6 3"
                  />
                )}
                <path
                  d={hexPath(module.centre, spec.sideFt, spec.rotation)}
                  fill={COLORS.deck}
                  stroke={COLORS.deckLine}
                  strokeWidth={0.8}
                />
                {/* Inboard of the walkway: the swim lagoon on a satellite, and
                    on the hub, more deck, because the store stands on it. */}
                <path
                  d={hexPath(
                    module.centre,
                    // The offset hexagon keeps its orientation; only its
                    // apothem shrinks by the width of the walkway.
                    (apothem(spec.sideFt) - spec.perimeterWalkFt) / (Math.sqrt(3) / 2),
                    spec.rotation,
                  )}
                  fill={module.role === 'hub' ? COLORS.deck : COLORS.lagoon}
                  stroke={COLORS.deckLine}
                  strokeWidth={0.5}
                  strokeDasharray="3 2"
                />

                {module.role === 'satellite' && showDimensions && (
                  <>
                    <text
                      x={module.centre.x}
                      y={module.centre.z - 1}
                      fontSize={7}
                      textAnchor="middle"
                      fill="#31606b"
                      fontFamily="ui-sans-serif, system-ui"
                      fontWeight={600}
                    >
                      SWIM LAGOON
                    </text>
                    <text
                      x={module.centre.x}
                      y={module.centre.z + 8}
                      fontSize={5.4}
                      textAnchor="middle"
                      fill="#31606b"
                      fontFamily="ui-monospace, monospace"
                    >
                      {`${num(plan.lagoonWidthFt, 0)}′ · net ${spec.swimNetDepthFt}′ down`}
                    </text>
                  </>
                )}

                {/* The landing: the corner the walkway arrives on, kept clear
                    of berths on both of its edges. */}
                {module.role === 'satellite' && (
                  <circle
                    cx={module.vertices[module.walkwayVertex]!.x}
                    cy={module.vertices[module.walkwayVertex]!.z}
                    r={3.2}
                    fill="none"
                    stroke={COLORS.dim}
                    strokeWidth={0.6}
                  />
                )}

                {module.slips.map((slip) => (
                  <Berth key={slip.id} slip={slip} showNumber={showNumbers} />
                ))}

                {module.role === 'hub' && (
                  <>
                    <path
                      d={hexPath(module.centre, spec.sideFt * 0.62, spec.rotation)}
                      fill="#e2d7bd"
                      stroke={COLORS.deckLine}
                      strokeWidth={0.7}
                    />
                    <text
                      x={module.centre.x}
                      y={module.centre.z - 2}
                      fontSize={9}
                      textAnchor="middle"
                      fill={COLORS.ink}
                      fontFamily="ui-sans-serif, system-ui"
                      fontWeight={600}
                    >
                      SHIP STORE
                    </text>
                    <text
                      x={module.centre.x}
                      y={module.centre.z + 8}
                      fontSize={6}
                      textAnchor="middle"
                      fill={COLORS.note}
                      fontFamily="ui-sans-serif, system-ui"
                    >
                      stage over
                    </text>
                  </>
                )}

                {module.role === 'satellite' && !showNumbers && (
                  <text
                    x={module.centre.x}
                    y={module.centre.z + 3}
                    fontSize={11}
                    textAnchor="middle"
                    fill={COLORS.ink}
                    fontFamily="ui-sans-serif, system-ui"
                    fontWeight={600}
                  >
                    {module.slips.length}
                  </text>
                )}
              </g>
            ))}

            {showFloats && <FloatGrid module={detailModule} spec={spec} />}

            {showDimensions && (
              <g>
                <Dimension
                  from={detailModule.vertices[0]!}
                  to={detailModule.vertices[1]!}
                  label={`${spec.sideFt}′`}
                  offset={-10}
                />
                {detailModule.slips[0] && (
                  <Dimension
                    from={{
                      x: detailModule.slips[0].center.x,
                      z: detailModule.slips[0].center.z - spec.slipWidthFt / 2,
                    }}
                    to={{
                      x: detailModule.slips[0].center.x,
                      z: detailModule.slips[0].center.z + spec.slipWidthFt / 2,
                    }}
                    label={`${spec.slipWidthFt}′ × ${spec.slipLengthFt}′`}
                    offset={10}
                  />
                )}
              </g>
            )}

            {/* Scale bar, sized to the current zoom. */}
            <g transform={`translate(${view.x + view.w * 0.04} ${view.y + view.h * 0.94})`}>
              <rect x={0} y={-1.5} width={view.w * 0.12} height={3} fill={COLORS.ink} opacity={0.75} />
              <text
                x={0}
                y={-5}
                fontSize={view.w * 0.018}
                fill={COLORS.ink}
                fontFamily="ui-monospace, monospace"
              >
                {`${(view.w * 0.12).toFixed(0)}′`}
              </text>
            </g>
          </svg>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1 rounded border border-slate-800 bg-[#f4f1e8] p-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              Section through one hexagon
            </div>
            <div className="h-[calc(100%-1.25rem)]">
              <Section plan={plan} />
            </div>
          </div>

          <div className="shrink-0 space-y-1.5 rounded border border-slate-800 bg-slate-900/60 p-3 text-[12px] leading-relaxed text-slate-400">
            <p>
              <span className="font-semibold text-slate-200">Storm plan.</span> The six walkways
              retract at the hub end, leaving seven independent rafts on their own piles instead
              of one rigid structure trying to move as a single body. That is the difference
              between riding out a blow and rebuilding a marina.
            </p>
            <p>
              <span className="font-semibold text-slate-200">Berths.</span>{' '}
              {num(plan.slipCount)} at {spec.slipWidthFt}′ × {spec.slipLengthFt}′, hung off the{' '}
              <em>outside</em> of six satellites — {spec.walkwayClearBerths * 2} left out at the
              corner each walkway lands on. Turning the hexagon inside out costs nothing in berth
              count, because the outer perimeter is longer than the inner one, and every boat
              backs straight into open lake instead of a shared basin.
            </p>
            <p>
              <span className="font-semibold text-slate-200">Swim lagoon.</span>{' '}
              {num(plan.swimSqFt)} sf of sheltered water inside the six rings,{' '}
              {num(plan.lagoonWidthFt, 0)}′ across the flats. A net is hung{' '}
              {spec.swimNetDepthFt}′ down and skirted up to the surface all the way round: nobody
              gets deeper than {spec.swimNetDepthFt}′, and a phone that goes in comes back.
              That is {num(plan.netSqFt)} sf of netting to buy and to inspect.
            </p>
            <p>
              <span className="font-semibold text-slate-200">Roof.</span> {num(plan.roofSqFt)} sf
              of clear structural decking at {spec.roofHeightFt}′ — a ring that covers the walkway
              and every berth and leaves the lagoon open to the sky, clearing its neighbour by{' '}
              {num(plan.roofClearanceFt, 1)}′. Under it,{' '}
              {num(plan.solarSqFt)} sf of photovoltaic beneath it —{' '}
              {num(plan.solarKwDc)} kW, which is both the shade over every berth and the largest
              single revenue line the marina has that is not a lease.
            </p>
            <p className="text-slate-600">
              Float count is deck area over {FLOAT.widthFt}′ × {FLOAT.lengthFt}′, at{' '}
              {usd(SITE_RATES.hexMarina.floatEach)} each. Everything else on this sheet is
              derived from the same numbers the 3D model and the estimate use.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
