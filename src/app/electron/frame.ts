// No title bar (spec §4): the panes take its space, and their top bands drag
// the window. On macOS the traffic lights sit over the sidebar's head; on
// Windows and Linux the system's own minimize, maximize and close are drawn
// over the page's band, in the band's colours, which the window reports
// (bridge.paintControls) whenever day, night or the palette changes.

import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import { CHANNEL, type ControlsPaint } from '../../platform/bridge';
import { answer } from './ipc';

/** The band's height at 100% (--band in ../../ui/shell/shell.css), until the window says what it is. */
const BAND = 56;

/**
 * The frame for `platform`, at the window's `zoom`. The overlay turns on the
 * window controls overlay's CSS variables (env(titlebar-area-x) and the
 * rest), which the bands use to keep clear of the controls, on macOS too.
 */
export function frameOptions(
  platform: NodeJS.Platform,
  zoom: number,
): BrowserWindowConstructorOptions {
  const height = Math.round(BAND * zoom);
  return platform === 'darwin'
    ? {
        titleBarStyle: 'hiddenInset',
        titleBarOverlay: true,
        trafficLightPosition: lightsIn(height),
      }
    : { titleBarStyle: 'hidden', titleBarOverlay: { height } };
}

/** macOS's traffic lights: their inset from the left, and how tall they stand (measured). */
const LIGHTS = { x: 20, height: 16 } as const;

/** Where the traffic lights go to sit in the middle of a band `height` tall on screen. */
export const lightsIn = (height: number): Electron.Point => ({
  x: LIGHTS.x,
  y: Math.max(0, Math.round((height - LIGHTS.height) / 2)),
});

/** A colour as Chromium computes one (rgb() or rgba()), and nothing else. */
const COMPUTED_COLOUR = /^rgba?\(\s*\d{1,3}(\s*,\s*\d{1,3}){2}(\s*,\s*(0|1|0?\.\d+))?\s*\)$/;

/** The band's height, in the page's pixels, within reason. */
const HEIGHT = { min: 16, max: 160 } as const;

/** `value`, checked: what the window sent, as ControlsPaint, or an error. */
export function controlsPaint(value: unknown): ControlsPaint {
  const { band, ink, height } = (value ?? {}) as Record<string, unknown>;
  for (const colour of [band, ink]) {
    if (typeof colour !== 'string' || !COMPUTED_COLOUR.test(colour)) {
      throw new TypeError('A colour must be rgb() or rgba().');
    }
  }
  if (typeof height !== 'number' || !(height >= HEIGHT.min && height <= HEIGHT.max)) {
    throw new TypeError(`The band’s height must be ${HEIGHT.min} to ${HEIGHT.max}.`);
  }
  return { band: band as string, ink: ink as string, height };
}

/** Each window's last paint, drawn again when its zoom changes the band's height on screen. */
const painted = new WeakMap<BrowserWindow, ControlsPaint>();

/**
 * Draw the system's controls as the band is: its colour, its ink, its height
 * on screen (the page's pixels times the window's zoom). macOS's traffic
 * lights take no colour: they're kept in the middle of the band.
 */
export function paintControls(window: BrowserWindow, paint: ControlsPaint): void {
  painted.set(window, paint);
  const height = Math.round(paint.height * window.webContents.getZoomFactor());
  if (process.platform === 'darwin') window.setWindowButtonPosition(lightsIn(height));
  else window.setTitleBarOverlay({ color: paint.band, symbolColor: paint.ink, height });
}

/** Zoom the whole window (every pane, as a browser zooms), the controls' band with it. */
export function zoomWindow(window: BrowserWindow, factor: number): void {
  if (window.webContents.getZoomFactor() === factor) return;
  window.webContents.setZoomFactor(factor);
  const paint = painted.get(window);
  if (paint) paintControls(window, paint);
}

/** Answer the window's paint for the controls drawn over it. */
export function serveFrame(window: BrowserWindow): void {
  answer(window, CHANNEL.paintControls, (paint) => paintControls(window, controlsPaint(paint)));
}
