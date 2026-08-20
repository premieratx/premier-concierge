import type { ContainerRole } from '../domain/types';

/**
 * Role-based colours. Deliberately flat and legible rather than photoreal —
 * the point of the 3D view is to read the massing, not to render corrugation.
 */
export const ROLE_COLOR: Record<ContainerRole, string> = {
  structural: '#8a8f98',
  sealed: '#9c8a5e',
  wall: '#79808c',
  tower: '#7b6a57',
};

export const SELECTED_COLOR = '#38bdf8';
export const VIOLATION_COLOR = '#dc2626';
export const EDGE_COLOR = '#101418';
export const SELECTED_EDGE_COLOR = '#0ea5e9';
