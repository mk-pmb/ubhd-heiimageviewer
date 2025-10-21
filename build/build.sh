#!/bin/bash
# -*- coding: utf-8, tab-width: 2 -*-


function build_cli_main () {
  export LANG{,UAGE}=en_US.UTF-8  # make error messages search engine-friendly
  set -o errexit -o pipefail
  local REPO_DIR="$(readlink -m -- "$BASH_SOURCE"/../..)"
  cd -- "$REPO_DIR" || return $?

  if [ "$(whoami):$REPO_DIR" == root:/app ]; then
    # Likely running in docker.
    git config --global --add safe.directory "$REPO_DIR"
  fi

  echo '===== vite build: ====='
  ./node_modules/.bin/vite build

  echo '===== Make language packs: ====='
  local HEI_PREFIX='dist/heiImageViewer.'
  local UMD_SUFFIX='.umd.min.js'
  local I18N_VOCAB= I18N_LANG= I18N_PACK=
  for I18N_VOCAB in i18n/*_*.js; do
    I18N_LANG="$(basename -- "$I18N_VOCAB" .js)"
    I18N_PACK="dist/langpack.$I18N_LANG.min.js"
    ./i18n/makelangpack.sed -- "$I18N_VOCAB" >"$I18N_PACK"
    cat -- "${HEI_PREFIX}base${UMD_SUFFIX}" "$I18N_PACK" \
      >"${HEI_PREFIX}${I18N_LANG}${UMD_SUFFIX}"
  done
  ./build/lint_lang_packs.sh || true

  [ "$(whoami)" != root ] || chown --reference . -R .

  echo '===== File sizes: ====='
  du --human-readable --apparent-size -- dist/*.*s
  echo '===== All done! ====='
}










build_cli_main "$@"; exit $?
