#!/bin/sh
if [ -z "$DEEPSEEK_ELECTRON_EXE" ]; then
  exit 1
fi
ELECTRON_RUN_AS_NODE=1 exec "$DEEPSEEK_ELECTRON_EXE" "$(dirname "$0")/git-askpass.cjs" "$@"
