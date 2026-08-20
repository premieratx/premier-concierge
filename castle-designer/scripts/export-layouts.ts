/**
 * Writes the generated layouts to `layouts/` so they can be imported into the
 * app, diffed in git, or handed to somebody without the toolchain.
 *
 * Run with: npm run export:layouts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimateProperty } from '../src/cost/estimate';
import { generateProperty } from '../src/domain/property';
import { serializeLayout } from '../src/io/serialize';
import { runAllChecks } from '../src/rules';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, '..', 'layouts');
mkdirSync(outDir, { recursive: true });

const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

for (const phase of ['existing', 'enhanced'] as const) {
  const layout = generateProperty({ marinaPhase: phase });
  const file = join(outDir, `hcyc-${phase}-marina.json`);
  writeFileSync(file, serializeLayout(layout));

  const checks = runAllChecks(layout);
  const estimate = estimateProperty(layout, checks);
  console.log(
    [
      `${phase.padEnd(9)}`,
      `${String(layout.containers.length).padStart(4)} containers`,
      `${String(layout.decor.length).padStart(5)} decor`,
      `${String(layout.features.length).padStart(4)} features`,
      `${checks.errors.length} errors`,
      `${checks.warnings.length} warnings`,
      usd(estimate.total).padStart(13),
      `${usd(estimate.costPerSqFt)}/sf`,
    ].join('  '),
  );
}

// The castle on its own, which is what the reference cost validation is about.
const castleOnly = generateProperty({ includeLodging: false, includeLawn: false });
writeFileSync(join(outDir, 'reference-castle.json'), serializeLayout(castleOnly));
console.log(`castle     ${String(castleOnly.containers.length).padStart(4)} containers (reference-castle.json)`);
