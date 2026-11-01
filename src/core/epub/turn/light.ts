// The light on a curling page (#40, Phase 3): the one place Eien's paper
// carries light, and only while it moves (.interface-design/system.md,
// Depth's exception). Each strip of the roll is shaded by how it faces you,
// edge-on darkest and facing you not at all, with a glint where its back
// tops the roll; ramped across the strip from one edge's angle to the
// other's, so the roll reads as one curve, not bands. A strip always spans
// the same angles of the roll, so its light is the same at every moment:
// drawn once, it only moves with its strip (./band.ts). The inks are the
// theme's tokens (--eien-curl-shade, --eien-curl-light); here a light is
// only how strong, at a strip's first edge and its last.

import { CURL_STRIPS } from './curl';

/** A ramp across a strip: the ink's strength (0 to 1) at its first edge, nearer the fold, and its last. */
export type Ramp = readonly [number, number];

/** Where past the crest the glint sits, of a half turn. */
const GLINT_AT = 0.78;
/** How tight the glint is: the power its falloff is raised to. */
const GLINT_TIGHT = 6;

/** A strip `angle` round the roll (0 lying flat, π back over): its shade, edge-on darkest. */
export const shadeAt = (angle: number): number => 1 - Math.abs(Math.cos(angle));

/** The glint where the back catches the light, just past the crest; none elsewhere. */
export const glintAt = (angle: number): number =>
  Math.max(0, Math.cos(angle - GLINT_AT * Math.PI)) ** GLINT_TIGHT;

/** Whether the `i`th strip is the roll's back, coming over. */
export const isBack = (i: number): boolean => i >= CURL_STRIPS / 2;

/** The `i`th strip's light: its shade, and on the back its glint. */
export function stripLight(i: number): { readonly shade: Ramp; readonly glint: Ramp | null } {
  const [start, end] = [(i * Math.PI) / CURL_STRIPS, ((i + 1) * Math.PI) / CURL_STRIPS];
  return {
    shade: [shadeAt(start), shadeAt(end)],
    glint: isBack(i) ? [glintAt(start), glintAt(end)] : null,
  };
}
