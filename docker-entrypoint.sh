#!/bin/sh
set -eu

# Railway mounts a durable volume at /app/data. On its first boot, carry the
# workspace from this machine into that empty volume; future deploys leave it
# untouched.
if [ ! -f /app/data/petals.db ] && [ -f /seed-data/petals.db ]; then
  cp -a /seed-data/. /app/data/
fi

exec "$@"
