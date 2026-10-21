// One setting as Settings draws it (settings.md): its name in the text
// face, what it does in pencil, then its control, by kind: choices in a
// segmented well, faces as cards set in each face, swatches of the theme's
// own surfaces, a weight's steps, or a stepper. Each control is a button or
// a group of them, so the keyboard reaches every one.

import {
  type ChoiceSetting,
  faceOf,
  type NumberSetting,
  type Setting,
  type SettingKey,
  type SettingValues,
  stepped,
} from '../../core/config';
import { h } from '../dom';
import { type IconName, icon } from '../icons';
import { chosenTitleWeight } from './look-properties';

export interface Row {
  readonly element: HTMLElement;
  /** Show the values now chosen. */
  show(values: SettingValues): void;
}

type Set = (key: SettingKey, value: string | number) => void;

/** Choices drawn as icons, with their names for the keyboard and the reader. */
const CHOICE_ICONS: Partial<Record<SettingKey, Readonly<Record<string, IconName>>>> = {
  'appearance.scheme': { day: 'sun', night: 'moon' },
  'layout.panes': { three: 'panes3', two: 'panes2' },
};

/** A sample to show each weight in. */
const WEIGHT_SAMPLES: Partial<Record<SettingKey, string>> = {
  'appearance.nameWeight': 'Beneath the Walls',
  'appearance.titleWeight': 'What the Recruits Say',
};

const chosenIn = (values: SettingValues, key: SettingKey): unknown =>
  (values as Record<string, unknown>)[key];

/** A setting's row: its name, what it does, its control. */
export function settingRow(setting: Setting, set: Set): Row {
  const labelId = `setting-${setting.key.replace('.', '-')}`;
  const control = controlFor(setting, labelId, set);
  const element = h(
    'div',
    { class: `setting setting--${kindOf(setting)}`, attrs: { 'data-setting': setting.key } },
    h('h3', { class: 'setting__label', text: setting.label, attrs: { id: labelId } }),
    h('p', { class: 'setting__about', text: setting.description }),
    control.element,
  );
  return { element, show: control.show };
}

type Kind = 'faces' | 'swatches' | 'weight' | 'stepper' | 'choice';

function kindOf(setting: Setting): Kind {
  if (setting.key === 'appearance.face' || setting.key === 'appearance.machineFace') return 'faces';
  if (setting.key === 'appearance.runheadGround') return 'swatches';
  if (setting.key in WEIGHT_SAMPLES) return 'weight';
  return setting.type === 'number' ? 'stepper' : 'choice';
}

function controlFor(setting: Setting, labelId: string, set: Set): Row {
  const kind = kindOf(setting);
  if (setting.type === 'number') {
    return kind === 'weight' ? weights(setting, labelId, set) : stepper(setting, labelId, set);
  }
  if (kind === 'faces') return faces(setting, labelId, set);
  if (kind === 'swatches') return swatches(setting, labelId, set);
  return choices(setting, labelId, set);
}

/** Buttons that each choose a value, the chosen one pressed. */
function pressed(
  buttons: readonly HTMLButtonElement[],
  container: HTMLElement,
  key: SettingKey,
): Row {
  return {
    element: container,
    show(values) {
      const chosen = String(chosenIn(values, key));
      for (const button of buttons) {
        button.setAttribute('aria-pressed', String(button.dataset.value === chosen));
      }
    },
  };
}

const group = (className: string, labelId: string, children: readonly Node[]) =>
  h('div', { class: className, attrs: { role: 'group', 'aria-labelledby': labelId } }, ...children);

function choiceButton(
  className: string,
  value: string,
  onPress: () => void,
  ...children: (Node | string)[]
): HTMLButtonElement {
  return h(
    'button',
    { class: className, attrs: { type: 'button', 'data-value': value }, on: { click: onPress } },
    ...children,
  );
}

function choices(setting: ChoiceSetting, labelId: string, set: Set): Row {
  const icons = CHOICE_ICONS[setting.key as SettingKey];
  const buttons = Object.entries(setting.choices).map(([value, name]) => {
    const drawn = icons?.[value];
    const choose = () => set(setting.key as SettingKey, value);
    if (!drawn) return choiceButton('word-button', value, choose, name);
    const button = choiceButton('icon-button', value, choose, icon(drawn));
    button.setAttribute('aria-label', name);
    button.title = name;
    return button;
  });
  return pressed(buttons, group('choices', labelId, buttons), setting.key as SettingKey);
}

/** Each face as a card set in itself: a text face's sample in its own sizes, the machine's in capitals. */
function faces(setting: ChoiceSetting, labelId: string, set: Set): Row {
  const machine = setting.key === 'appearance.machineFace';
  const buttons = Object.entries(setting.choices).map(([value, name]) => {
    const sample = h('span', {
      class: `face__sample${machine ? ' face__sample--machine' : ''}`,
      text: machine ? '312 notes · 4m' : 'Aa Gg',
    });
    if (machine) sample.style.setProperty('font-family', `var(--eien-family-${value})`);
    const card = choiceButton(
      'face',
      value,
      () => set(setting.key as SettingKey, value),
      sample,
      h('span', { class: 'face__name', text: name }),
    );
    card.setAttribute('aria-label', name);
    // A text face's sizes come with it: the tokens apply inside any element that names it.
    if (!machine && faceOf(value)) card.dataset.face = value;
    return card;
  });
  return pressed(buttons, group('faces', labelId, buttons), setting.key as SettingKey);
}

/** The theme's own surfaces, each a swatch in its colour, so they follow any theme. */
function swatches(setting: ChoiceSetting, labelId: string, set: Set): Row {
  const buttons = Object.entries(setting.choices).map(([value, name]) => {
    const chip = h('i', { class: 'swatch__chip' });
    chip.style.setProperty('background', `var(--eien-${value})`);
    const button = choiceButton(
      'swatch',
      value,
      () => set(setting.key as SettingKey, value),
      chip,
      h('span', { class: 'swatch__name', text: name }),
    );
    button.setAttribute('aria-label', name);
    return button;
  });
  return pressed(buttons, group('swatches', labelId, buttons), setting.key as SettingKey);
}

/** Each weight in itself, then a sample at the weight chosen (a chosen list title, a step heavier). */
function weights(setting: NumberSetting, labelId: string, set: Set): Row {
  const key = setting.key as SettingKey;
  const steps: number[] = [];
  for (let weight = setting.min; weight <= setting.max; weight += setting.step) steps.push(weight);
  const buttons = steps.map((weight) => {
    const button = choiceButton(
      'word-button',
      String(weight),
      () => set(key, weight),
      String(weight),
    );
    button.style.setProperty('font-weight', String(weight));
    return button;
  });
  const sample = h('span', { class: 'weight__sample', text: WEIGHT_SAMPLES[key] ?? '' });
  const marks = pressed(buttons, group('choices', labelId, buttons), key);
  return {
    element: h('div', { class: 'weight' }, marks.element, sample),
    show(values) {
      marks.show(values);
      const weight = Number(chosenIn(values, key));
      const shown = key === 'appearance.titleWeight' ? chosenTitleWeight(weight) : weight;
      sample.style.setProperty('font-weight', String(shown));
    },
  };
}

function stepper(setting: NumberSetting, labelId: string, set: Set): Row {
  const key = setting.key as SettingKey;
  let current = setting.default;
  const step = (by: number) => () => set(key, stepped(setting, current, by));
  const smaller = h(
    'button',
    {
      class: 'icon-button',
      attrs: { type: 'button', 'aria-label': 'Smaller', title: 'Smaller' },
      on: { click: step(-1) },
    },
    icon('down'),
  );
  const larger = h(
    'button',
    {
      class: 'icon-button',
      attrs: { type: 'button', 'aria-label': 'Larger', title: 'Larger' },
      on: { click: step(1) },
    },
    icon('up'),
  );
  const shown = h('output', { class: 'count setting__value', attrs: { 'aria-live': 'polite' } });
  return {
    element: group('stepper', labelId, [smaller, shown, larger]),
    show(values) {
      current = Number(chosenIn(values, key));
      shown.textContent = `${current}%`;
      smaller.disabled = current <= setting.min;
      larger.disabled = current >= setting.max;
    },
  };
}
