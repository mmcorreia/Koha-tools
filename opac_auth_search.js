(function () {
    'use strict';

    function isAuthorityHomePage() {
        return window.location.pathname.indexOf('/cgi-bin/koha/opac-authorities-home.pl') !== -1;
    }

    function insertTestBlock() {
        if (!isAuthorityHomePage()) {
            console.log('[NOMEN TESTE] Não é a página de autoridades.');
            return;
        }

        if (document.getElementById('nomen-debug-visible-block')) {
            return;
        }

        var block = document.createElement('div');
        block.id = 'nomen-debug-visible-block';

        block.setAttribute(
            'style',
            [
                'display:block',
                'visibility:visible',
                'opacity:1',
                'position:fixed',
                'z-index:999999',
                'right:20px',
                'bottom:20px',
                'width:360px',
                'background:#111111',
                'color:#d7ef3f',
                'padding:18px 20px',
                'border-radius:14px',
                'box-shadow:0 12px 32px rgba(0,0,0,.35)',
                'font-family:Arial,sans-serif',
                'font-size:15px',
                'line-height:1.45'
            ].join(';')
        );

        block.innerHTML =
            '<strong>N●MEN TESTE VISÍVEL</strong><br>' +
            'Se estás a ver esta caixa, o JavaScript está a inserir conteúdo na página.<br>' +
            '<button id="nomen-debug-close" style="margin-top:12px;background:#d7ef3f;color:#111;border:0;border-radius:8px;padding:8px 12px;font-weight:bold;cursor:pointer;">Fechar</button>';

        document.body.appendChild(block);

        var close = document.getElementById('nomen-debug-close');
        if (close) {
            close.addEventListener('click', function () {
                block.remove();
            });
        }

        console.log('[NOMEN TESTE] Bloco fixo inserido no body.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', insertTestBlock);
    } else {
        insertTestBlock();
    }

    window.setTimeout(insertTestBlock, 1000);
    window.setTimeout(insertTestBlock, 2500);

})();
