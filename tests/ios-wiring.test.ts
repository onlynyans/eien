// Adversarial: the iOS app's wiring, which no unit test runs and the
// simulator's smoke test (scripts/ios/smoke.sh) can't tell apart.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('the iOS window', () => {
  it('is the view controller that registers Eien’s own plugin', () => {
    // Capacitor 8.5's UIScene setup: "The delegate creates the window and root view
    // controller in code; Main.storyboard no longer provides them" (capacitorjs.com/docs/
    // updating/8-5). SceneDelegate.swift makes a plain CAPBridgeViewController, so
    // MainViewController's capacitorDidLoad never runs and VaultFiles is never on the
    // bridge. capacitor-files.ts then quietly saves through the Filesystem plugin: writes
    // never flushed, and renames that delete the note at the new name before moving. A
    // save cut by a crash, or a move as Syncthing brings a note in, loses the note.
    const plugin = source('ios/App/App/VaultFilesPlugin.swift');
    const registrar =
      /class (\w+): CAPBridgeViewController[\s\S]*?registerPluginInstance\(VaultFilesPlugin\(\)\)/u.exec(
        plugin,
      )?.[1];
    expect(registrar).toBe('MainViewController');
    const scene = source('ios/App/App/SceneDelegate.swift');
    expect(scene).toMatch(new RegExp(`rootViewController\\s*=\\s*${registrar}\\(\\)`, 'u'));
  });

  it('is installed only on an iOS whose WebKit runs the page', () => {
    // The project installs from iOS 15.0 (IPHONEOS_DEPLOYMENT_TARGET), but the page uses
    // what WebKit has only from Safari 16.4: a lookbehind in a regular expression literal
    // (core/tags/tags.ts, kept as written in out/mobile: Vite 8 builds for safari16.4),
    // which older WebKit refuses as a syntax error before any of the page runs, and
    // String.isWellFormed / toWellFormed, which every vault path and every save calls. On
    // iOS 15.0 to 16.3 Eien installs and shows nothing: no vault, no note, nothing saved.
    const sixteenFour = ['src/core/tags/tags.ts', 'src/core/paths/names.ts'].some((file) =>
      /\(\?<[=!]|isWellFormed\(/u.test(source(file)),
    );
    expect(sixteenFour).toBe(true);
    const targets = [
      ...source('ios/App/App.xcodeproj/project.pbxproj').matchAll(
        /IPHONEOS_DEPLOYMENT_TARGET = ([\d.]+);/gu,
      ),
    ].map((match) => Number(match[1]));
    expect(targets.length).toBeGreaterThan(0);
    expect(Math.min(...targets)).toBeGreaterThanOrEqual(16.4);
  });
});

const hasJq = (() => {
  try {
    execFileSync('jq', ['--version']);
    return true;
  } catch {
    return false;
  }
})();

/** What scripts/ios/pick-simulator.sh (smoke.sh's choice) picks from simctl's runtimes. */
const pick = (runtimes: unknown): string =>
  execFileSync('bash', ['scripts/ios/pick-simulator.sh'], {
    input: JSON.stringify(runtimes),
    cwd: new URL('..', import.meta.url),
  })
    .toString()
    .trim();

const iPhone = (name: string, min: string) => ({
  productFamily: 'iPhone',
  identifier: `com.apple.CoreSimulator.SimDeviceType.${name.replace(/ /gu, '-')}`,
  name,
  minRuntimeVersionString: min,
  maxRuntimeVersionString: '65535.255.255',
});

describe('the simulator smoke.sh makes', () => {
  it.skipIf(!hasJq)('is a device the runtime it picks can run', () => {
    // CI run 39533209990 (phase-10c, macos-26 with Xcode 26): "Simulator:
    // com.apple.CoreSimulator.SimDeviceType.iPod-touch--7th-generation- on
    // com.apple.CoreSimulator.SimRuntime.iOS-26-5", then simctl create: "Incompatible
    // device" (code 403). An iPod touch is productFamily "iPhone" too, and it's last in
    // Xcode's list; it runs nothing past iOS 15. The job fails before it builds anything,
    // so nothing in it says whether Eien keeps a writer's words on iOS.
    const supported = [
      iPhone('iPhone 16e', '18.3.0'),
      iPhone('iPhone 17 Pro', '26.0.0'),
      {
        ...iPhone('iPod touch (7th generation)', '12.3.0'),
        identifier: 'com.apple.CoreSimulator.SimDeviceType.iPod-touch--7th-generation-',
      },
    ];
    const runtimes = {
      runtimes: [
        {
          platform: 'iOS',
          isAvailable: true,
          identifier: 'com.apple.CoreSimulator.SimRuntime.iOS-26-5',
          version: '26.5',
          supportedDeviceTypes: supported,
        },
      ],
    };
    const [runtime, device] = pick(runtimes).split(' ');
    const picked = runtimes.runtimes.find((entry) => entry.identifier === runtime);
    expect(picked?.supportedDeviceTypes.map((type) => type.identifier)).toContain(device);
    expect(device).toBe('com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro'); // never the iPod
  });
});
