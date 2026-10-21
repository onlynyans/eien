#!/usr/bin/env bash
# Eien on an iPhone simulator (spec §10, §11), in CI or on a Mac with Xcode
# (npm run ios first). It builds the app for the simulator, puts in its
# Documents/Vault what a crash leaves (a save's temp file, a rename cut
# between its steps), starts it, and passes only when Eien has recovered
# both: the window's storage, over Eien's own Swift plugin, end to end. The
# screen is saved to <out>/eien.png, and the app's log on a failure.
set -euo pipefail

OUT="${1:-out/ios-smoke}"
APP_ID=io.github.onlynyans.eien
mkdir -p "$OUT"

read -r runtime device_type < <(xcrun simctl list runtimes -j | bash scripts/ios/pick-simulator.sh) ||
  { echo "No iPhone simulator here."; exit 1; }
echo "Simulator: $device_type on $runtime"
udid=$(xcrun simctl create "Eien smoke" "$device_type" "$runtime")
trap 'xcrun simctl shutdown "$udid" >/dev/null 2>&1 || true; xcrun simctl delete "$udid" >/dev/null 2>&1 || true' EXIT
xcrun simctl boot "$udid"

xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -sdk iphonesimulator -destination "generic/platform=iOS Simulator" \
  -derivedDataPath "$OUT/derived" CODE_SIGNING_ALLOWED=NO build >"$OUT/build.log" 2>&1 ||
  { tail -60 "$OUT/build.log"; exit 1; }
xcrun simctl install "$udid" "$OUT/derived/Build/Products/Debug-iphonesimulator/App.app"

documents="$(xcrun simctl get_app_container "$udid" "$APP_ID" data)/Documents"
mkdir -p "$documents/Vault/Fic"
printf 'Mended, never renamed.' >"$documents/Vault/Fic/.Mend.md.eien.tmp"
printf 'Cut between the steps.' >"$documents/Vault/.Tear.md.eien-case"

xcrun simctl launch "$udid" "$APP_ID"
recovered=""
for _ in $(seq 1 90); do
  recovered=$(find "$documents/Vault/Fic" -maxdepth 1 -name 'Mend (recovered *).md' | head -1)
  [ -n "$recovered" ] && [ -f "$documents/Vault/Tear.md" ] && break
  sleep 1
done
sleep 2 # the screen settles
xcrun simctl io "$udid" screenshot "$OUT/eien.png" >/dev/null 2>&1 || true

fail() {
  echo "FAIL: $1"
  find "$documents" -print | sed "s|$documents|Documents|"
  xcrun simctl spawn "$udid" log show --last 3m --style compact \
    --predicate 'process == "App"' >"$OUT/app.log" 2>&1 || true
  tail -80 "$OUT/app.log"
  exit 1
}
[ -n "$recovered" ] || fail "the save's temp file wasn't recovered as a note"
[ "$(cat "$recovered")" = 'Mended, never renamed.' ] || fail "the recovered note lost its words"
[ ! -e "$documents/Vault/Fic/.Mend.md.eien.tmp" ] || fail "the temp file was left"
[ -f "$documents/Vault/Tear.md" ] || fail "the half-done rename wasn't put back"
[ "$(cat "$documents/Vault/Tear.md")" = 'Cut between the steps.' ] || fail "the note put back lost its words"
[ ! -e "$documents/Vault/.Tear.md.eien-case" ] || fail "the step was left"
echo "ok: Eien opened Documents/Vault on iOS, and recovered what the crash left"
