// The settings that are custom properties on <html> (spec §6): the machine
// voice's face and its sizes, the weight of names, and the Running head's
// strip ground. Worked out here, without a window, so the rules are tested;
// ./look.ts sets them. A property at its default is taken off, so
// tokens.css's own value stands.

import { faceOf, type MachineSizes, type SettingValues } from '../../core/config';

/** The heaviest weight the faces are drawn at. */
export const HEAVIEST = 700;

/** A chosen list title is a step heavier than the others, never past the heaviest. */
export const chosenTitleWeight = (weight: number): number => Math.min(weight + 100, HEAVIEST);

/** Each property's value, or null to take it off. */
export type LookProperties = Readonly<Record<string, string | null>>;

const px = (size: number) => `${size}px`;

/** The machine voice in `id`'s face and sizes; nothing for the mono, tokens.css's own. */
function machine(id: string): LookProperties {
  const face = faceOf(id);
  const set = face && !face.mono;
  const sizes: MachineSizes | undefined = set ? face.machine : undefined;
  return {
    '--eien-face-mono': set ? `var(--eien-family-${face.id})` : null,
    '--eien-size-meta': sizes ? px(sizes.meta) : null,
    '--eien-size-label': sizes ? px(sizes.label) : null,
    '--eien-size-source': sizes ? px(sizes.source) : null,
  };
}

export function lookProperties(values: SettingValues): LookProperties {
  const names = values['appearance.nameWeight'];
  const titles = values['appearance.titleWeight'];
  const ground = values['appearance.runheadGround'];
  return {
    ...machine(values['appearance.machineFace']),
    '--eien-weight-tree': names === 400 ? null : String(names),
    '--eien-weight-list': titles === 400 ? null : String(titles),
    '--eien-weight-list-chosen': titles === 400 ? null : String(chosenTitleWeight(titles)),
    // One of the theme's own surfaces, so the strip follows any theme.
    '--runhead-ground': ground === 'desk' ? null : `var(--eien-${ground})`,
  };
}
