#!/bin/sed -urf
# -*- coding: UTF-8, tab-width: 2 -*-
1s~^export const (\S+) = ~;(function langpack_\1(i){i.learn(i.useLang('\1'),~
s~\s+~ ~g
s~^ ~~
$s~;?$~);}(heiImageViewer.i18n));~
