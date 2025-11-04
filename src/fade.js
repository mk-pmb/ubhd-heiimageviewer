const EX = function fade(element) {
  let op = 1;  // initial opacity
  const elSt = element.style;
  const parSt = element.parentElement.style;

  function animationStep() {
    if (op <= 0.1) {
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
    setTimeout(animationStep, 50);
  }

  animationStep();
  // ^-- Not using IIFE because we'll have a "initialDelay" option later.
};


export default EX;
