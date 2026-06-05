(function () {
    'use strict';

    function init() {
        console.log('[NOMEN] ficheiro carregado e executado');

        if (window.location.pathname.indexOf('/cgi-bin/koha/opac-authorities-home.pl') === -1) {
            console.log('[NOMEN] não é página de autoridades');
            return;
        }

        console.log('[NOMEN] página de autoridades detetada');

        var target =
            document.querySelector('#userauthhome') ||
            document.querySelector('.maincontent') ||
            document.querySelector('#maincontent') ||
            document.querySelector('main') ||
            document.body;

        var box = document.createElement('div');
        box.style.border = '3px solid #d7df2f';
        box.style.background = '#ffffff';
        box.style.padding = '30px';
        box.style.margin = '30px';
        box.style.fontSize = '24px';
        box.style.fontWeight = '700';
        box.style.color = '#222';

        box.textContent = 'NOMEN: transformação ativa nesta página';

        target.parentNode.insertBefore(box, target);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
