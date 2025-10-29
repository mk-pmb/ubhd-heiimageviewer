import libRosetta from 'rosetta';

import defaultButtonIconsHtml from './buttonIcons.default.js';


const stone = libRosetta();
const i18n = stone.t;
i18n.learn = stone.set;
i18n.useLang = stone.locale;


// ===== Button icons ===== ===== ===== ===== ===== ===== ===== ===== =====

const buttonIconsHtml = { /*
  This dictionary holds the effective HTML codes used for the labels.
  Icon packs are supposed to monkey-patch this object before a viewer
  is initialized. */
  ...defaultButtonIconsHtml,
};

function fontAwesomeHelper(i) { return '<i class="fa fa-' + i + '"></i>'; }

Object.assign(i18n, {
  defaultButtonIconsHtml,
  buttonIconsHtml,

  buttonIconAndLabel(iconName, ontoDestElem, vocData) {
    let dest = ontoDestElem || 'button';
    if (dest.substr) { dest = document.createElement(dest); }
    let icon = buttonIconsHtml[iconName];
    if (icon.startsWith('>fa>')) { icon = fontAwesomeHelper(icon.slice(4)); }
    dest.innerHTML = icon;
    dest.title = i18n(iconName, vocData);
    return dest;
  },

});





export default i18n;
