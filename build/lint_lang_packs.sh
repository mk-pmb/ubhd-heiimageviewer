#!/bin/bash
# -*- coding: utf-8, tab-width: 2 -*-


function lint_lang_packs_cli_init () {
  export LANG{,UAGE}=en_US.UTF-8  # make error messages search engine-friendly
  set -o errexit -o pipefail
  local REPO_DIR="$(readlink -m -- "$BASH_SOURCE"/../..)"
  cd -- "$REPO_DIR" || return $?

  local VOCLIST_SORT='sort --version-sort --unique'
  local SHAPENAMES_SED='s~^    shortName: \x27([a-z]+)\x27,$~\1~p'
  local VOCAB_SED='s~^\s+([A-Za-z]+):.*$~\1~p'
  local RGX='\bi18n(\.buttonIconAndLabel|)\(\x27[^\x27]+\x27'
  local VOCLIST_EXPECTED="$( (
    git grep -hoPe "$RGX" -- src/ | cut -d $'\x27' -sf 2
    sed -nre "$SHAPENAMES_SED" -- src/shapeDefs.js
    ) | grep . | $VOCLIST_SORT)"
  local I18N_VOCAB= I18N_LANG=
  local VOCLIST_FOUND= WARN= REPORT
  for I18N_VOCAB in i18n/*_*.js; do
    VOCLIST_FOUND="$(sed -nre "$VOCAB_SED" -- "$I18N_VOCAB" | $VOCLIST_SORT)"
    I18N_LANG="$(basename -- "$I18N_VOCAB" .js)"
    WARN="tmp.i18n.voclist-$I18N_LANG.warn"
    ( diff -U 1 --label 'voclist@src' <(echo "$VOCLIST_EXPECTED"
      ) --label "voclist@$I18N_VOCAB" <(echo "$VOCLIST_FOUND"
      ) || true ) >"$WARN"
    if [ -s "$WARN" ]; then
      echo W: "$I18N_LANG:$(
        sed -nre '1b;2b;s~^[+-]~ &~p' -- "$WARN" | tr -d '\n')"
    else
      rm -- "$WARN"
    fi
  done

  WARN="$(ls -1 -- tmp.i18n.voclist-*.warn 2>/dev/null)"
  WARN="${WARN//$'\n'/ }"
  [ -n "$WARN" ] || return 0
  echo E: "Found vocab anomalies. See: $WARN" >&2
  return 4
}










lint_lang_packs_cli_init "$@"; exit $?
