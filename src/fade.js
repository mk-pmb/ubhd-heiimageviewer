const EX = function fade(element) {
  let op = 1;  // initial opacity
  const elSt = element.style;
  const parSt = element.parentElement.style;
  const timer = setInterval(function () {
    if (op <= 0.1) {
      clearInterval(timer);
      parSt.border = 'none';
      elSt.visibility = 'hidden';
      elSt.opacity = '0';
      return;
    }
    elSt.opacity = op;
    const border = '1px solid rgba(0,0,0,' + op + ')';
    parSt.borderBottom = border;
    parSt.borderRight = border;
    op -= op * 0.12;
  }, 50);
};


export default EX;
