// fade.js
export function fade(element) {
    var op = 1;  // initial opacity
    var timer = setInterval(function () {
        if (op <= 0.1){
            clearInterval(timer);
            element.parentElement.style.border = "none";
            element.style.visibility = 'hidden';
            element.style.opacity = '0';
            return
        }
        element.style.opacity = op;
        element.parentElement.style.borderBottom = "1px solid rgba(0,0,0, " + op + " )";
        element.parentElement.style.borderRight = "1px solid rgba(0,0,0, " + op + " )";
        op -= op * 0.12;
    }, 50);
}
