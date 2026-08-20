let counter = 0;

/**
 * Short, readable, collision-safe-enough ids for containers and openings.
 * Layouts are single-user JSON files, so a per-session counter plus a random
 * suffix is plenty — no need to drag in a uuid dependency.
 */
export function makeId(prefix: string): string {
  counter += 1;
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${prefix}-${counter}-${suffix}`;
}
