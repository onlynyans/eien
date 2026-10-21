// npm run icons: every icon the installers and the phone apps use, made from
// build/icons/seal.svg. Run it after changing the seal, and commit what it writes.
//
// It rasterizes with Electron itself (an offscreen window), so there is
// nothing to install and no system tool to depend on. It writes the .icns and
// .ico files itself (both just hold PNGs), and the PNG for iOS, which must
// have no alpha channel.
//
//   macOS    build/icons/icon.icns           the rounded-square template: 824 px of 1024, a soft shadow
//   Windows  build/icons/icon.ico            the full square, 16 to 256 px
//   Linux    build/icons/linux/<n>x<n>.png   the full square (the window's icon too)
//   Android  android/app/src/main/res        the adaptive icon (a vector glyph over a colour), the
//                                            themed (monochrome) icon, and the legacy square and round PNGs
//   iOS      ios/…/AppIcon.appiconset        the full square, 1024 px, no alpha

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { app, BrowserWindow } from 'electron';

const root = join(import.meta.dirname, '../..');
const out = (...path) => join(root, ...path);

// ── The source ───────────────────────────────────────────────────────────
const source = readFileSync(out('build/icons/seal.svg'), 'utf8');
const ground = /<rect id="ground"[^>]*fill="(#[0-9a-f]{6})"/u.exec(source)?.[1];
const ink = /<path id="glyph"[^>]*fill="(#[0-9a-f]{6})"/u.exec(source)?.[1];
const glyph = /<path id="glyph"[^>]*\sd="([^"]+)"/u.exec(source)?.[1];
if (!(ground && ink && glyph)) throw new Error('build/icons/seal.svg lost its ground or glyph');
if (/[^MLZ\d\s.-]/u.test(glyph)) throw new Error('the glyph may use only M, L and Z');

/** The glyph's outlines as lists of [x, y] points (1024 units). */
const outlines = glyph
  .split('Z')
  .filter((s) => s.trim())
  .map((s) =>
    s
      .replace(/[ML]/gu, ' ')
      .trim()
      .split(/\s+/u)
      .map(Number)
      .reduce((points, n, i) => {
        if (i % 2 === 0) points.push([n]);
        else points[points.length - 1].push(n);
        return points;
      }, []),
  );
/** The farthest any part of the glyph is from the middle, which is what a circular safe zone must hold. */
const reach = Math.max(...outlines.flat().map(([x, y]) => Math.hypot(x - 512, y - 512)));

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${defs}${body}</svg>`;
/** The glyph about the middle of the square, scaled. */
const mark = (scale) =>
  `<path fill="${ink}" transform="translate(512 512) scale(${scale}) translate(-512 -512)" d="${glyph}"/>`;
const square = (radius, scale = 1) =>
  svg(`<rect width="1024" height="1024" rx="${radius}" fill="${ground}"/>${mark(scale)}`);

/** Full bleed: Windows, Linux, iOS (the system rounds iOS's corners). */
const full = square(0);
/** macOS's template: the body 824 of 1024, corner radius 185.4, one soft shadow. */
const mac = svg(
  `<rect x="100" y="100" width="824" height="824" rx="185.4" fill="${ground}" filter="url(#lift)"/>${mark(824 / 1024)}`,
  '<defs><filter id="lift" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity="0.28"/></filter></defs>',
);
/** Android's older launchers: a rounded square, and a circle. */
const legacySquare = square(180);
const legacyRound = svg(`<circle cx="512" cy="512" r="512" fill="${ground}"/>${mark(1)}`);

// ── Rasterizing ──────────────────────────────────────────────────────────
app.commandLine.appendSwitch('force-device-scale-factor', '1');

/** One window for every size: a second offscreen window opened right after one closes fails to load. */
let window;

/** The SVG at `size` px square, as an image with transparency wherever the SVG paints none. */
async function render(markup, size) {
  window ??= new BrowserWindow({
    show: false,
    frame: false,
    transparent: true,
    width: size,
    height: size,
    useContentSize: true,
    webPreferences: { offscreen: true },
  });
  window.setContentSize(size, size);
  const page = `<!doctype html><style>html,body{margin:0;background:transparent;overflow:hidden}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`;
  await window
    .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(page)}`)
    .catch((error) => {
      throw new Error(`${size} px did not load: ${error.code}`);
    });
  await window.webContents.executeJavaScript(
    'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))',
  );
  const image = await window.webContents.capturePage();
  const { width, height } = image.getSize();
  if (width !== size || height !== size) throw new Error(`${size} px came out ${width}×${height}`);
  return image;
}
const png = async (markup, size) => (await render(markup, size)).toPNG();

/** A PNG with no alpha channel (colour type 2), from the image's opaque BGRA pixels. */
function opaquePng(image) {
  const { width, height } = image.getSize();
  const bgra = image.toBitmap();
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      if (bgra[at + 3] !== 255) throw new Error('the iOS icon must be fully opaque');
      rows[row + 1 + x * 3] = bgra[at + 2];
      rows[row + 2 + x * 3] = bgra[at + 1];
      rows[row + 3 + x * 3] = bgra[at];
    }
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc32(body));
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB, deflate, no filter, no interlace
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Containers ───────────────────────────────────────────────────────────
/** .ico: a directory, then each size as a PNG (0 stands for 256). */
function ico(images) {
  const head = Buffer.alloc(6 + 16 * images.length);
  head.writeUInt16LE(1, 2); // an icon
  head.writeUInt16LE(images.length, 4);
  let offset = head.length;
  images.forEach(({ size, data }, i) => {
    const at = 6 + 16 * i;
    head[at] = size % 256;
    head[at + 1] = size % 256;
    head.writeUInt16LE(1, at + 4); // planes
    head.writeUInt16LE(32, at + 6); // bits per pixel
    head.writeUInt32LE(data.length, at + 8);
    head.writeUInt32LE(offset, at + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...images.map(({ data }) => data)]);
}
/** .icns: 'icns', its length, then each image as a type, a length and a PNG. */
function icns(images) {
  const parts = images.map(({ type, data }) => {
    const head = Buffer.alloc(8);
    head.write(type, 0, 'ascii');
    head.writeUInt32BE(data.length + 8, 4);
    return Buffer.concat([head, data]);
  });
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(8);
  head.write('icns', 0, 'ascii');
  head.writeUInt32BE(body.length + 8, 4);
  return Buffer.concat([head, body]);
}

const write = (path, data) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log(path.slice(root.length + 1));
};

// ── Android's vector layers ──────────────────────────────────────────────
/**
 * The glyph as an Android vector drawable (108 dp), scaled about the middle to
 * fit a circle of `safe` dp: the adaptive icon's masks cut a circle of 66 dp
 * out of the 108 at the smallest.
 */
function vector(safe) {
  const k = ((safe / 2) * (1024 / 108)) / reach;
  const at = (v) => +((((v - 512) * k + 512) * 108) / 1024).toFixed(2);
  const path = outlines
    .map((points) => `M${points.map(([x, y]) => `${at(x)},${at(y)}`).join('L')}Z`)
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="${ink.toUpperCase()}"
        android:pathData="${path}" />
</vector>
`;
}
const adaptive = (extra) => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>${extra}
</adaptive-icon>
`;

// ── Writing everything ───────────────────────────────────────────────────
// (Not top-level await: Electron never starts its event loop under an ESM
// entry that waits for it.)
async function main() {
  // macOS
  const macSizes = [
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
    ['ic11', 32],
    ['ic12', 64],
    ['ic13', 256],
    ['ic14', 512],
  ];
  const macPngs = new Map();
  for (const size of new Set(macSizes.map(([, n]) => n))) macPngs.set(size, await png(mac, size));
  write(
    out('build/icons/icon.icns'),
    icns(macSizes.map(([type, size]) => ({ type, data: macPngs.get(size) }))),
  );

  // Windows
  const icoImages = [];
  for (const size of [16, 24, 32, 48, 64, 128, 256]) {
    icoImages.push({ size, data: await png(full, size) });
  }
  write(out('build/icons/icon.ico'), ico(icoImages));

  // Linux
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
    write(out(`build/icons/linux/${size}x${size}.png`), await png(full, size));
  }

  // Android
  const res = out('android/app/src/main/res');
  for (const [density, size] of [
    ['mdpi', 48],
    ['hdpi', 72],
    ['xhdpi', 96],
    ['xxhdpi', 144],
    ['xxxhdpi', 192],
  ]) {
    write(join(res, `mipmap-${density}/ic_launcher.png`), await png(legacySquare, size));
    write(join(res, `mipmap-${density}/ic_launcher_round.png`), await png(legacyRound, size));
    // The default project's foreground PNGs: the adaptive icon is a vector now.
    rmSync(join(res, `mipmap-${density}/ic_launcher_foreground.png`), { force: true });
  }
  rmSync(join(res, 'drawable-v24'), { recursive: true, force: true });
  rmSync(join(res, 'drawable/ic_launcher_background.xml'), { force: true });
  write(join(res, 'drawable/ic_launcher_foreground.xml'), vector(60));
  write(
    join(res, 'mipmap-anydpi-v26/ic_launcher.xml'),
    adaptive('\n    <monochrome android:drawable="@drawable/ic_launcher_foreground"/>'),
  );
  write(
    join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'),
    adaptive('\n    <monochrome android:drawable="@drawable/ic_launcher_foreground"/>'),
  );
  write(
    join(res, 'values/ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
  <resources>
      <color name="ic_launcher_background">${ground.toUpperCase()}</color>
  </resources>
  `,
  );

  // iOS
  write(
    out('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'),
    opaquePng(await render(full, 1024)),
  );
}

app.dock?.hide();
app
  .whenReady()
  .then(main)
  .then(
    () => app.quit(),
    (error) => {
      console.error(error);
      app.exit(1);
    },
  );
