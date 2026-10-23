// The settings that are custom properties on <html> (spec §6): the interface
// font and its sizes, the Source font and its size, the weight of names, and
// the Running head's strip ground. Worked out here, without a window, so the
// rules are tested; ./look.ts sets them. A property at its default is taken
// off, so tokens.css's own value stands.

import { FACES, faceOf, type SettingValues } from '../../core/config';

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
  };
}
