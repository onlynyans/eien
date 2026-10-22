// The seal is the app's icon (build/icons/seal.svg → `npm run icons`). Every
// platform wants its own sizes and shapes, and a missing one shows only as the
// default Electron or Capacitor icon on a writer's machine, so this checks each
// file is there, as big as its platform asks, and that the builds point at them.
// The files are made by scripts/icons/build.mjs, which needs Electron's window
// and so isn't run here; the numbers below are the platforms' own.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { builderConfig, ICONS } from '../electron-builder';

const ROOT = resolve(import.meta.dirname, '..');
const at = (path: string) => join(ROOT, path);
const read = (path: string) => readFileSync(at(path));
const text = (path: string) => readFileSync(at(path), 'utf8');

const SEAL = { ground: '#c4472d', ink: '#fbf8f2' };

/** A PNG's size and colour type (2 is RGB with no alpha, 6 is RGBA), read from its header. */
function pngInfo(bytes: Buffer) {
  expect(bytes.subarray(0, 8).toString('hex'), 'a PNG signature').toBe('89504e470d0a1a0a');
  expect(bytes.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colour: bytes[25] };
}
const square = (bytes: Buffer, size: number) => {
  const { width, height } = pngInfo(bytes);
  expect([width, height]).toEqual([size, size]);
};

describe('the seal, the source of every icon', () => {
  const svg = text('build/icons/seal.svg');

  it('is a vermilion square with 永 in the washi white, as the interface draws it', () => {
    expect(svg).toMatch(new RegExp(`<rect id="ground"[^>]*fill="${SEAL.ground}"`, 'u'));
    expect(svg).toMatch(new RegExp(`<path id="glyph"[^>]*fill="${SEAL.ink}"`, 'u'));
    const tokens = text('src/ui/theme/tokens.css');
    expect(tokens).toContain(`--eien-seal: light-dark(${SEAL.ground}`);
    expect(tokens).toContain(`--eien-on-seal: light-dark(${SEAL.ink}`);
  });

  it('draws the glyph as paths, so no font is needed to show it', () => {
    expect(svg).not.toMatch(/<text|font-family|<image/u);
    const d = /<path id="glyph"[^>]*\sd="([^"]+)"/u.exec(svg)?.[1] ?? '';
    expect(d.length).toBeGreaterThan(500);
    expect(d).toMatch(/^[MLQCZ\d\s.-]+$/u);
  });
});

describe('the macOS icon', () => {
  // An .icns is "icns", its length, then a type, a length and a PNG for each size.
  const file = read(ICONS.mac);
  const entries = new Map<string, Buffer>();
  for (let i = 8; i < file.length; ) {
    const length = file.readUInt32BE(i + 4);
    entries.set(file.subarray(i, i + 4).toString('ascii'), file.subarray(i + 8, i + length));
    i += length;
  }

  it('is a well-formed .icns', () => {
    expect(file.subarray(0, 4).toString('ascii')).toBe('icns');
    expect(file.readUInt32BE(4)).toBe(file.length);
  });

  it('has every size macOS draws: 16 to 512 pt, each at 1x and 2x', () => {
    const sizes = {
      ic07: 128,
      ic08: 256,
      ic09: 512,
      ic10: 1024,
      ic11: 32,
      ic12: 64,
      ic13: 256,
      ic14: 512,
    };
    for (const [type, size] of Object.entries(sizes)) {
      const png = entries.get(type);
      expect(png, `${type} (${size} px)`).toBeDefined();
      square(png as Buffer, size);
    }
  });
});

describe('the Windows icon', () => {
  // An .ico is a directory of sizes, each pointing at its image.
  const file = read(ICONS.win);
  const count = file.readUInt16LE(4);

  it('is a well-formed .ico', () => {
    expect([file.readUInt16LE(0), file.readUInt16LE(2)]).toEqual([0, 1]);
    expect(count).toBeGreaterThan(0);
  });

  it('has 16 to 256 px, so the taskbar, the title bar, Explorer and the installer each find theirs', () => {
    const sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const entry = 6 + 16 * i;
      const size = file[entry] || 256; // 0 stands for 256
      sizes.push(size);
      const length = file.readUInt32LE(entry + 8);
      const offset = file.readUInt32LE(entry + 12);
      square(file.subarray(offset, offset + length), size);
    }
    expect(sizes).toEqual(expect.arrayContaining([16, 24, 32, 48, 64, 128, 256]));
  });
});

describe('the Linux icons', () => {
  it('are the full square at the sizes desktops ask for, up to 512', () => {
    for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
      square(read(`${ICONS.linux}/${size}x${size}.png`), size);
    }
  });

  it('include the window’s own icon, which the app packs beside itself', () => {
    expect(ICONS.linuxWindow).toBe(`${ICONS.linux}/512x512.png`);
    const window = text('src/app/electron/window.ts');
    expect(window).toContain(ICONS.linuxWindow.replace('build/', '../../build/'));
    expect(window).toContain("join(process.resourcesPath, 'icon.png')");
  });
});

describe('the Android icon', () => {
  const res = 'android/app/src/main/res';

  it('has the legacy square and round PNGs at each density (48 dp)', () => {
    const sizes = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
    for (const [density, size] of Object.entries(sizes)) {
      for (const name of ['ic_launcher', 'ic_launcher_round']) {
        square(read(`${res}/mipmap-${density}/${name}.png`), size);
      }
    }
  });

  it('is an adaptive icon: the glyph as a 108 dp vector over the seal’s colour, and a themed one', () => {
    for (const name of ['ic_launcher', 'ic_launcher_round']) {
      const xml = text(`${res}/mipmap-anydpi-v26/${name}.xml`);
      expect(xml).toContain('<background android:drawable="@color/ic_launcher_background"/>');
      expect(xml).toContain('<foreground android:drawable="@drawable/ic_launcher_foreground"/>');
      expect(xml).toContain('<monochrome android:drawable="@drawable/ic_launcher_foreground"/>');
    }
    const vector = text(`${res}/drawable/ic_launcher_foreground.xml`);
    expect(vector).toContain('android:viewportWidth="108"');
    expect(vector).toContain('android:fillColor="#FBF8F2"');
    expect(text(`${res}/values/ic_launcher_background.xml`).toLowerCase()).toContain(SEAL.ground);
  });

  it('keeps the glyph inside the 66 dp circle that every launcher mask shows', () => {
    const d =
      /android:pathData="([^"]+)"/u.exec(text(`${res}/drawable/ic_launcher_foreground.xml`))?.[1] ??
      '';
    const numbers = (d.match(/-?[\d.]+/gu) ?? []).map(Number);
    expect(numbers.length).toBeGreaterThan(200);
    for (let i = 0; i < numbers.length; i += 2) {
      const [x = 0, y = 0] = numbers.slice(i, i + 2);
      expect(Math.hypot(x - 54, y - 54)).toBeLessThanOrEqual(33);
    }
  });

  it('leaves none of the default project’s icon behind', () => {
    for (const path of [
      `${res}/drawable-v24/ic_launcher_foreground.xml`,
      `${res}/drawable/ic_launcher_background.xml`,
      `${res}/mipmap-xxxhdpi/ic_launcher_foreground.png`,
    ]) {
      expect(existsSync(at(path)), path).toBe(false);
    }
  });

  it('is the one the manifest names', () => {
    const manifest = text('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain('android:icon="@mipmap/ic_launcher"');
    expect(manifest).toContain('android:roundIcon="@mipmap/ic_launcher_round"');
  });
});

describe('the iOS icon', () => {
  const set = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';

  it('is one 1024 px square with no alpha channel, which the App Store refuses', () => {
    const contents = JSON.parse(text(`${set}/Contents.json`));
    expect(contents.images).toHaveLength(1);
    expect(contents.images[0]).toMatchObject({ size: '1024x1024', platform: 'ios' });
    const bytes = read(`${set}/${contents.images[0].filename}`);
    square(bytes, 1024);
    expect(pngInfo(bytes).colour).toBe(2);
  });
});

describe('the installers', () => {
  for (const portable of [false, true]) {
    const config = builderConfig(portable);
    const kind = portable ? 'portable copies' : 'installers';

    it(`give the ${kind} the seal`, () => {
      expect(config.mac?.icon).toBe(ICONS.mac);
      expect(config.win?.icon).toBe(ICONS.win);
      expect(config.linux?.icon).toBe(ICONS.linux);
      for (const path of [ICONS.mac, ICONS.win, ICONS.linux])
        expect(existsSync(at(path))).toBe(true);
    });

    it(`pack the Linux window's icon beside the ${kind}' app`, () => {
      expect(config.extraResources).toEqual([{ from: ICONS.linuxWindow, to: 'icon.png' }]);
    });
  }
});
