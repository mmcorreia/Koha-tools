(function () {
    'use strict';

    function rbmoAjustarCabecalhoEmAutoridades() {
        var isAuthorityPage =
            window.location.pathname.indexOf('/cgi-bin/koha/opac-authorities-home.pl') !== -1;

        if (!isAuthorityPage) {
            return;
        }

        document.body.classList.add('rbmo-authority-page');

        var css = `
            body.rbmo-authority-page #rbmo-custom-header .rbmo-search-area {
                display: none !important;
            }

            body.rbmo-authority-page #opac-main-search {
                display: none !important;
            }
        `;

        var style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);

        console.log('[NOMEN] Pesquisa bibliográfica RBMO escondida na página de autoridades.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', rbmoAjustarCabecalhoEmAutoridades);
    } else {
        rbmoAjustarCabecalhoEmAutoridades();
    }
})();
