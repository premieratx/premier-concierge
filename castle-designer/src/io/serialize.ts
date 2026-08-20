import type { Layout } from '../domain/types';

export const LAYOUT_SCHEMA_VERSION = 1;

/** Pretty-printed JSON, so a layout file diffs usefully in git. */
export function serializeLayout(layout: Layout): string {
  return `${JSON.stringify(layout, null, 2)}\n`;
}

export class LayoutParseError extends Error {}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new LayoutParseError(`${field} must be an array`);
  return value;
}

/**
 * Parse a layout file.
 *
 * Deliberately forgiving about the newer collections — a layout saved before
 * decor, site features or the site definition existed still loads, it just
 * comes back with empty ones — and strict about the things that would make
 * the model meaningless, like the units.
 */
export function deserializeLayout(json: string): Layout {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    throw new LayoutParseError(`Not valid JSON: ${(error as Error).message}`);
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new LayoutParseError('Layout must be a JSON object');
  }

  const o = raw as Record<string, unknown>;
  if (o.units !== undefined && o.units !== 'ft') {
    throw new LayoutParseError(`Unsupported units: ${String(o.units)}. This tool works in feet.`);
  }
  if (typeof o.version === 'number' && o.version > LAYOUT_SCHEMA_VERSION) {
    throw new LayoutParseError(
      `Layout is version ${o.version}; this build understands up to ${LAYOUT_SCHEMA_VERSION}.`,
    );
  }

  const containers = requireArray(o.containers ?? [], 'containers');
  for (const [i, c] of containers.entries()) {
    const container = c as Record<string, unknown>;
    if (typeof container.id !== 'string') {
      throw new LayoutParseError(`containers[${i}] has no id`);
    }
    if (container.type !== '40HC' && container.type !== '20ST') {
      throw new LayoutParseError(`containers[${i}] has unknown type ${String(container.type)}`);
    }
    if (container.rotation !== 0 && container.rotation !== 90) {
      throw new LayoutParseError(
        `containers[${i}] rotation must be 0 or 90, got ${String(container.rotation)}`,
      );
    }
    if (!container.openings) container.openings = [];
  }

  return {
    version: typeof o.version === 'number' ? o.version : LAYOUT_SCHEMA_VERSION,
    id: typeof o.id === 'string' ? o.id : 'imported',
    name: typeof o.name === 'string' ? o.name : 'Imported layout',
    units: 'ft',
    containers: containers as Layout['containers'],
    decor: (o.decor ?? []) as Layout['decor'],
    features: (o.features ?? []) as Layout['features'],
    site: (o.site ?? {
      sizeX: 1000,
      sizeZ: 600,
      shorelineZ: 231,
      waterLevelFt: 0,
      marinaPhase: 'enhanced',
      terrain: 'cypressCreek',
    }) as Layout['site'],
    ...(typeof o.notes === 'string' ? { notes: o.notes } : {}),
  };
}

/** Trigger a browser download of the layout as a .json file. */
export function downloadLayout(layout: Layout, filename = `${layout.id}.json`): void {
  const blob = new Blob([serializeLayout(layout)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
