/**
 * Rate table for the castle itself.
 *
 * These are the client-supplied numbers and the basis of the reference
 * validation, so they are reproduced exactly as given. Anything added beyond
 * them lives in SITE_RATES below and is labelled as an assumption.
 */
export const RATES = {
  container: { '40HC': 3900, '20ST': 2600, delivery: 650 },
  bolted: {
    twistlockPerConnection: 65,
    platePerConnection: 180,
    riggingHoursPerContainer: 8,
    riggerRate: 65,
  },
  welding: {
    hourlyRate: 95,
    budgetCap: 50000,
    hoursPerLargeOpening: 18,
    hoursPerSmallOpening: 6,
  },
  structural: { lateralBracingLumpSum: 185000 },
  foundation: { pierEach: 1800, gradeBeamPerLf: 145, slabPerSqFt: 14 },
  finish: {
    paintPerSqFt: 6,
    prepPerSqFt: 3.5,
    stoneVeneerPerSqFt: 38,
    manufacturedStonePerSqFt: 24,
  },
  flooring: {
    stabilizedDgPerSqFt: 5,
    limestoneFlagstonePerSqFt: 24,
    deckingPerSqFt: 27,
  },
  roofing: { standingSeamPerSqFt: 18, trussRoofPerSqFt: 36 },
  mep: { sealedPerSqFt: 128, openAirPerSqFt: 18 },
  sealed: { insulationPerSqFt: 5.5, interiorFinishPerSqFt: 95 },
  soft: { softCostPct: 0.18, contingencyPct: 0.18 },
} as const;

/**
 * Everything the castle rate table does not cover: the dragon, the marina,
 * the stages, the fire pits, the party lighting.
 *
 * These are my assumptions, not client-supplied numbers, and they are the
 * first thing to challenge when a real estimator looks at this. They are
 * deliberately kept in a separate table so the castle's dollars per square
 * foot can still be checked against the reference design without the
 * spectacle muddying it.
 */
export const SITE_RATES = {
  dragon: {
    /** Fabricated, galvanised, erected art-grade steel armature. */
    armatureTonsPerLengthFt: 0.22,
    armaturePerTon: 28000,
    /** Formed and welded plate skin, finished. */
    skinPerSqFt: 95,
    /** LP supply, burners, ignition, flame safety interlocks, controls. */
    fireSystemLumpSum: 185000,
    /** Drilled piers and grade beam for an object this tall in Texas wind. */
    foundationLumpSum: 145000,
    /** Structural PE, wind analysis, and the artist's fee. */
    engineeringLumpSum: 160000,
  },
  firePit: {
    /** Burner, pan, media, stone surround, valve train. */
    each: 14000,
    /** Mineral-salt colour heads and the sequencer that drives them. */
    rainbowPremium: 6500,
    /** Trenched gas distribution across the lawn. */
    gasDistributionLumpSum: 65000,
  },
  stage: {
    deckPerSqFt: 95,
    trussRoofPerSqFt: 36,
    containerRoofPerSqFt: 22,
    /** Power, distro, and an audio rough-in per stage. */
    servicesEach: 18000,
  },
  marina: {
    floatingDeckPerSqFt: 145,
    fixedDeckPerSqFt: 118,
    gangwayEach: 18000,
    /** One guide pile per this much deck area. */
    deckSqFtPerPile: 250,
    pilePerEach: 4200,
    /** Cleats, power pedestal, potable water, per berth. */
    slipFitOutEach: 2800,
    /** Shade structure and deck built over a berth, per square foot. */
    overSlipPatioPerSqFt: 165,
    ropeSwingEach: 4500,
    jumpPlatformEach: 9500,
    patioBarEach: 22000,
    /** The rentable furniture package that goes with a premier slip. */
    furniturePackageEach: 7800,
    overwaterStagePerSqFt: 210,
    /** Power, water and fire line run out to the dock. */
    dockUtilitiesLumpSum: 120000,
  },
  lighting: {
    /** Commercial-grade catenary festoon, poles and drivers included. */
    stringLightsPerLf: 14,
    /** Colour-changing heads and the controller that runs the whole site. */
    rainbowControlLumpSum: 42000,
  },
  structural: {
    /** Supplementary framing when a container roof has to carry occupancy. */
    roofFramingPerSqFt: 28,
    /** Fabricated and installed transfer beam under a misaligned stack. */
    transferBeamEach: 6800,
  },
  lodging: {
    /** On top of the container fit-out already priced by RATES.sealed. */
    furnishingsPerKey: 9500,
    /** Tent, platform framing, and off-grid services per glamping key. */
    glampingPerKey: 34000,
  },
} as const;
