#!/bin/sh
# -*- coding: utf-8, tab-width: 2 -*-
set -e
cd -- "$(readlink -m -- "$0"/../..)"
[ -f src/hei-image-viewer.css ] # ensure we're in the right directory
NODE_VER="$(grep -A 9009 -Fe '"engines":' -- package.json | tr '\n\r\t' ' ' |
  grep -m 1 -oPe '"node": *\x22>?=?\d+' | grep -oPe '\d+')"
docker run --rm --network none \
  --volume '.:/app:rw' --workdir /app \
  node:"${NODE_VER:-E_NO_NODE_VER}" \
  /app/build/build.sh "$@"
