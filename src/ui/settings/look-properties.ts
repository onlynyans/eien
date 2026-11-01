// The settings that are custom properties on <html> (spec §6): the interface
// font and its sizes, the Source font and its size, the weight of names, and
// the Running head's strip ground, and the steps of line spacing and page
// width over each face's own leading and measure. Worked out here, without a window, so the
// rules are tested; ./look.ts sets them. A property at its default is taken
// off, so tokens.css's own value stands.

import { epubLook, FACES, faceOf, type SettingValues } from '../../core/config';

/** The heaviest weight the faces are drawn at. */
export const HEAVIEST = 700;

/** A chosen list title is a step heavier than the others, never past the heaviest. */
export const chosenTitleWeight = (weight: number): number => Math.min(weight + 100, HEAVIEST);

/** Each property's value, or null to take it off. */
export type LookProperties = Readonly<Record<string, string | null>>;

const px = (size: number) => `${size}px`;

/** The face `id` names, unless it's the default, Plex Mono, whose family and sizes are tokens.css's. */
const chosen = (id: string) => {
  const face = faceOf(id);
  return face && face.id !== FACES[0].id ? face : undefined;
};

/** The interface in `id`'s face and sizes. */
function interfaceFace(id: string): LookProperties {
  const face = chosen(id);
  return {
    '--eien-face-mono': face ? `var(--eien-family-${face.id})` : null,
    '--eien-size-meta': face ? px(face.machine.meta) : null,
    '--eien-size-label': face ? px(face.machine.label) : null,
  };
}

/** The Source view, and code, in `id`'s face and size. */
function sourceFace(id: string): LookProperties {
  const face = chosen(id);
  return {
    '--eien-face-source': face ? `var(--eien-family-${face.id})` : null,
    '--eien-size-source': face ? px(face.machine.source) : null,
  };
}

/** Line spacing and page width: a step either side of the face's own leading and measure. */
const LEADING = { tight: 0.9, set: 1, loose: 1.12 } as const;
export const PAGE_WIDTH = { narrow: 0.84, set: 1, wide: 1.18 } as const;

/** A multiplier, taken off at 1, so `var(--look-…, 1)` stands. */
const times = (by: number) => (by === 1 ? null : String(by));

export function lookProperties(values: SettingValues): LookProperties {
  const names = values['appearance.nameWeight'];
  const titles = values['appearance.titleWeight'];
  const ground = values['appearance.runheadGround'];
  return {
    ...interfaceFace(values['appearance.interfaceFace']),
    ...sourceFace(values['appearance.sourceFace']),
    '--eien-weight-tree': names === 400 ? null : String(names),
    '--eien-weight-list': titles === 400 ? null : String(titles),
    '--eien-weight-list-chosen': titles === 400 ? null : String(chosenTitleWeight(titles)),
    // One of the theme's own surfaces, so the strip follows any theme.
    '--runhead-ground': ground === 'desk' ? null : `var(--eien-${ground})`,
    '--look-lead': times(LEADING[values['appearance.leading']]),
    '--look-width': times(PAGE_WIDTH[values['page.width']]),
  };
}

/**
 * A book's page's own look (#40), worn on its leaf rather than <html>: its
 * face and frame as data attributes, always set (a leaf without one would
 * take the notes'), and its text size, line spacing and width as the
 * properties the notes' are, from the shelf's settings.
 */
export function leafLook(values: SettingValues): {
  readonly face: string;
  readonly frame: string;
  readonly properties: Readonly<Record<string, string>>;
} {
  const worn = epubLook(values);
  return {
    face: worn['appearance.face'],
    frame: worn['appearance.frame'],
    properties: {
      '--eien-text-scale': String(worn['appearance.textSize'] / 100),
      '--look-lead': String(LEADING[worn['appearance.leading']]),
      '--look-width': String(PAGE_WIDTH[worn['page.width']]),
    },
  };
}
