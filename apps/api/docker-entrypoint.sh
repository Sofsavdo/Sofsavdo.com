#!/bin/sh
# Runs as root (the Dockerfile no longer sets USER before this) purely to fix up ownership of
# /app/apps/api/uploads, then immediately drops to the unprivileged `sofsavdo` user before
# actually running the app — never runs the Node process itself as root.
#
# Why this exists: the Dockerfile's build-time `RUN mkdir -p .../uploads && chown sofsavdo ...`
# only takes effect at IMAGE BUILD time. A Railway Volume mounted at that same path replaces
# whatever was there with a fresh, root-owned directory the moment the CONTAINER starts — after
# the build-time chown already ran, so it has no effect on the volume's actual contents. Without
# this re-chown at container start, LocalDiskStorage's runtime mkdir/writeFile (running as
# `sofsavdo`) would hit the exact same EACCES this project already hit once before (see
# DECISIONS.md ADR-046), just re-triggered by the volume mount instead of the original missing
# --chown on COPY.
set -e
mkdir -p /app/apps/api/uploads
chown -R sofsavdo:sofsavdo /app/apps/api/uploads
exec su-exec sofsavdo "$@"
