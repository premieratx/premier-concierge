/**
 * Build-time flags.
 *
 * The published single-file build runs inside a sandbox that blocks
 * page-initiated downloads, so the controls that hand the viewer a file are
 * hidden there rather than left to fail silently.
 */
export const IS_ARTIFACT = import.meta.env.VITE_ARTIFACT === '1';
