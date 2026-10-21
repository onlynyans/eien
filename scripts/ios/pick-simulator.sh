#!/usr/bin/env bash
# The simulator Eien's iOS test runs on (./smoke.sh): the newest iOS runtime
# here, and the newest iPhone that runtime itself says it runs (never an
# iPod touch, which is "iPhone" family too). Reads `xcrun simctl list
# runtimes -j` on stdin; prints "<runtime> <device type>", or fails.
set -euo pipefail
jq -er '[.runtimes[] | select(.platform == "iOS" and .isAvailable)] | last |
  .identifier + " " + ([.supportedDeviceTypes[] |
    select(.productFamily == "iPhone" and (.name | startswith("iPhone")))] | last | .identifier)'
