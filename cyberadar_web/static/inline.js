(function disableTransitionOnLoad() {
    document.addEventListener('DOMContentLoaded', function () {
        var node = document.querySelector('.preload');
        if (node) {
            node.classList.remove('preload');
        }
    });
})();

function scrollFunction() {
    if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
        document.getElementById('navbar').classList.add('navbar-shadow');
    } else {
        document.getElementById('navbar').classList.remove('navbar-shadow');
    }
}

if (document.getElementById('navbar') !== null) {
    window.onscroll = function () {
        scrollFunction();
    };
}

function initAos() {
    if (typeof AOS !== 'undefined') {
        var aosCSS = document.createElement('link');
        aosCSS.setAttribute('rel', 'stylesheet');
        aosCSS.setAttribute('href', '/assets/css/lib/aos.css');
        document.body.appendChild(aosCSS);
        return AOS.init();
    }
    window.setTimeout(initAos, 100);
}
initAos();