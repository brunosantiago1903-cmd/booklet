#!/usr/bin/env bash
# Encerra GoTrue, PostgREST e gateway iniciados por e2e/start.sh.
cd "$(dirname "$0")/.cache" 2>/dev/null || exit 0
for name in gotrue postgrest gateway; do
  if [[ -f "$name.pid" ]]; then
    kill "$(cat "$name.pid")" 2>/dev/null || true
    rm -f "$name.pid"
  fi
done
echo "serviços do e2e encerrados"
