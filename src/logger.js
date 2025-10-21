const originHint = 'heiImageViewer:';

function c(m) { return console[m].bind(console, originHint); }

const EX = {
  cdbg: c('debug'),
  cerr: c('error'),
  clog: c('log'),
  cwarn: c('warn'),
};

EX.say = EX.log;

export default EX;
