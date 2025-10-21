import libRosetta from 'rosetta';

const stone = libRosetta();
const i18n = stone.t;
i18n.learn = stone.set;
i18n.useLang = stone.locale;

export default i18n;
