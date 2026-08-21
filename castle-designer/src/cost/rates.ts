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
  /**
   * The dragon is a scrap build on a $20,000 budget, not a commissioned
   * sculpture.
   *
   * Nothing about it is a custom fabricated component: it is donor car parts
   * and yard steel — hoods and doors for the wing membrane, wheel rims for the
   * joints, leaf springs for the ribs and legs, exhaust pipe for the neck,
   * brake discs for the feet, headlights for the eyes — cut and welded onto a
   * used-pipe spine. The parts cost what scrap costs. The labour is donated,
   * and that is the only reason this number works.
   *
   * Parts, consumables and rigging scale with length; the plinth and the
   * burner train do not. At the reference length the lines below sum to
   * exactly the cap.
   */
  dragon: {
    budgetCap: 20000,
    /** Length the lump sums below are quoted at, in feet. */
    referenceLengthFt: 48,
    /** Donor hoods, doors, rims, springs, exhaust and discs, hauled. */
    donorPartsLumpSum: 4800,
    /** Used pipe and beam for the spine and the internal frame. */
    structuralCoreLumpSum: 2600,
    /** Wire, gas, cutting discs, grinding discs, primer. */
    weldingConsumablesLumpSum: 2100,
    /** Fasteners, chain and hardware. */
    hardwareLumpSum: 900,
    /** Telehandler and rigging, two days. */
    riggingLumpSum: 3400,
    /** Concrete plinth, anchor bolts and the embed plate. */
    plinthAndAnchorsLumpSum: 2700,
    /** Propane train, burner, ignition and the flame safety interlock. */
    fireSystemLumpSum: 3500,
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
  /**
   * The hexagonal marina.
   *
   * Priced the way a floating dock is actually bought — by the float, by the
   * square foot of framework, and by the watt — rather than as one number per
   * berth. The roof is the biggest line in it by a distance, which is what you
   * would expect once you decide to put a structural deck sixteen feet above
   * open water.
   */
  hexMarina: {
    /** One 4 x 8 x 32-inch dock float. */
    floatEach: 700,
    /** Aluminium frame, decking, hardware and connectors over the floats. */
    frameworkPerSqFt: 42,
    /** Steel roof structure standing sixteen feet over the water. */
    roofStructurePerSqFt: 46,
    /** Structural clear polycarbonate decking you can walk on. */
    clearDeckPerSqFt: 34,
    /** Panels, racking, inverters and the DC run, per watt of array. */
    solarPerWatt: 2.15,
    /** Two-level ship store and service counter on a floating deck. */
    shipStorePerSqFt: 265,
    /** Share of the hub hexagon the store building occupies. */
    shipStoreFootprintShare: 0.6,
    /** Hinged, winched and storm-rated, one per satellite. */
    retractableWalkwayEach: 46000,
    /** Guide piles holding a hexagon on station. */
    mooringPileEach: 6800,
    pilesPerHexagon: 6,
  },
  /**
   * The outer works: enceinte, moat, crossings, guard and torches.
   *
   * The moat is the number to look at. A ring of water round a castle on flat
   * ground is a trench and a liner. On a hillside that falls sixty feet across
   * the ring it is six separate basins, five weirs between them, and a pump
   * that lifts the whole thing back up to the top basin — and the pump is not
   * optional, because without it the top basin is empty by August.
   */
  outerWorks: {
    /** Gabion core on a strip footing, per foot of wall run. */
    wallPerLf: 620,
    /** Stone facing, both sides, per square foot of face. */
    wallFacingPerSqFt: 24,
    /** Wall walk, parapet and crenellation, per foot of run. */
    wallWalkPerLf: 155,
    /** One corner drum, thirty feet to the parapet. */
    cornerDrumEach: 148000,
    /** Gate piers, arch, portcullis frame and the winch loft over it. */
    gatehouseEach: 96000,
    /** Fixed timber bridge, deck and trestles, per square foot. */
    timberBridgePerSqFt: 78,
    /**
     * Drawbridge mechanism: oak leaf on gudgeons, the gaff, the chain, the
     * counterweight crate and its guide frame.
     */
    drawbridgeMechanismEach: 62000,
    /** Sandbags, filled and stacked into the crate. */
    sandbagEach: 6,
    /** Moat excavation, shaped and compacted, per cubic yard. */
    moatCutPerCy: 11,
    /** Clay core and geomembrane under the wetted area, per square foot. */
    moatLinerPerSqFt: 9,
    /** Weir between two basins, per foot of head it holds. */
    weirPerFtOfHead: 3400,
    /** Wet well, pumps and the return main back up to the top basin. */
    moatRecirculationLumpSum: 186000,
    /** Torch and post, plumbed to the kerosene ring main. */
    torchEach: 2400,
    /** Kerosene tank, ring main, pumps and the fire-safety interlock. */
    kerosenePlantLumpSum: 78000,
    /** Mineral-salt colour cartridge and its holder, per rainbow torch. */
    rainbowWickEach: 340,
    /** Armour, arms and the stand for one guard. */
    knightKitEach: 3800,
  },
  lighting: {
    /** Commercial-grade catenary festoon, poles and drivers included. */
    stringLightsPerLf: 14,
    /** Colour-changing heads and the controller that runs the whole site. */
    rainbowControlLumpSum: 42000,
  },
  /**
   * Earthwork.
   *
   * On a flat pad this table would not exist. On a hillside it is one of the
   * largest numbers in the job, and it is spent before a single container
   * arrives — which is exactly the sort of thing a site model should surface
   * rather than let somebody discover at bid.
   */
  earthwork: {
    /** Excavate, in place. */
    cutPerCy: 9,
    /** Place and compact engineered fill. */
    fillPerCy: 22,
    /** Haul the imbalance on or off site. */
    haulPerCy: 14,
    /** Segmental gravity wall, engineered, drained and backfilled. */
    retainingWallPerSqFt: 78,
    /** Silt fence, rock berms, stabilised entrance and inspections. */
    erosionControlLumpSum: 68000,
    /** Switchback drive down the hill: subgrade, base and chip seal. */
    drivePerLf: 145,
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
