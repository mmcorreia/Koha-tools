(function () {
    'use strict';

    /*
     * N●MEN OPAC
     * Página pública de pesquisa e descoberta de autoridades
     * Versão 0.4, relacional
     *
     * Objetivo:
     * - manter a pesquisa funcional de autoridades do Koha;
     * - gerar a página a partir de dados relacionais;
     * - ligar autoridades ao catálogo bibliográfico;
     * - permitir automatização futura sem reescrever a interface;
     * - evitar alimentação manual diária.
     */

    const NOMEN_VERSION = '0.4-relacional-20260605';

    const NOMEN_CONFIG = {
        debug: true,

        paths: {
            authorityHome: '/cgi-bin/koha/opac-authorities-home.pl',
            biblioSearch: '/cgi-bin/koha/opac-search.pl'
        },

        labels: {
            pageEyebrow: 'Autoridades bibliográficas',
            titlePrefix: 'Descobrir',
            titleHighlight: 'autores, obras e temas',
            intro: 'Explore o catálogo através de pessoas, obras, lugares, temas e outras entidades. Cada autoridade funciona como uma porta de entrada para títulos disponíveis, relações relevantes e novos percursos de leitura.',
            searchPlaceholder: 'Pesquisar por autor, obra, tema, lugar ou entidade...',
            searchButton: 'Pesquisar'
        }
    };

    /*
     * Esta é a camada relacional.
     * Para já é declarada em JavaScript.
     * Mais tarde pode ser gerada por SQL, API, ficheiro JSON ou dados Koha + Wikidata.
     */

    const NOMEN_DATA = {
        destaque: {
            id: 'fernando-pessoa',
            label: 'Fernando Pessoa',
            initials: 'FP',
            type: 'Pessoa',
            description: 'Poeta, escritor e pensador central da literatura portuguesa. Explore obras, estudos críticos, heterónimos e temas relacionados disponíveis no catálogo.',
            authority: {
                q: 'Fernando Pessoa',
                marclist: 'mainentry'
            },
            biblio: {
                idx: 'au',
                q: 'Fernando Pessoa'
            },
            sources: ['Wikidata', 'VIAF', 'Wikipédia'],
            related: [
                { label: 'Álvaro de Campos', type: 'Pessoa', authority: { q: 'Álvaro de Campos' }, biblio: { idx: 'au', q: 'Álvaro de Campos' } },
                { label: 'Ricardo Reis', type: 'Pessoa', authority: { q: 'Ricardo Reis' }, biblio: { idx: 'au', q: 'Ricardo Reis' } },
                { label: 'Alberto Caeiro', type: 'Pessoa', authority: { q: 'Alberto Caeiro' }, biblio: { idx: 'au', q: 'Alberto Caeiro' } },
                { label: 'Modernismo', type: 'Assunto', authority: { q: 'Modernismo' }, biblio: { idx: 'su', q: 'Modernismo' } },
                { label: 'Poesia portuguesa', type: 'Assunto', authority: { q: 'Poesia portuguesa' }, biblio: { idx: 'su', q: 'Poesia portuguesa' } }
            ]
        },

        exemplosPesquisa: [
            { label: 'Fernando Pessoa', type: 'authority', q: 'Fernando Pessoa' },
            { label: 'Sophia de Mello Breyner Andresen', type: 'authority', q: 'Sophia de Mello Breyner Andresen' },
            { label: 'José Saramago', type: 'authority', q: 'José Saramago' },
            { label: 'Lisboa', type: 'authority', q: 'Lisboa' },
            { label: 'Modernismo', type: 'authority', q: 'Modernismo' }
        ],

        percursosDescoberta: [
            {
                id: 'pessoas',
                icon: 'P',
                title: 'Autores e artistas',
                description: 'Conheça autores, ilustradores, tradutores, músicos e outras pessoas ligadas às obras do catálogo.',
                linkLabel: 'Explorar entidades',
                target: {
                    type: 'authority',
                    q: 'Pessoa'
                }
            },
            {
                id: 'obras',
                icon: 'O',
                title: 'Obras e criações',
                description: 'Descubra obras, títulos, edições e expressões criativas existentes nas bibliotecas.',
                linkLabel: 'Pesquisar obras',
                target: {
                    type: 'biblio',
                    idx: 'ti',
                    q: ''
                }
            },
            {
                id: 'temas',
                icon: 'T',
                title: 'Temas e assuntos',
                description: 'Explore ideias, géneros, movimentos e assuntos que ajudam a organizar o conhecimento.',
                linkLabel: 'Explorar temas',
                target: {
                    type: 'authority',
                    q: 'Poesia portuguesa'
                }
            },
            {
                id: 'lugares',
                icon: 'L',
                title: 'Lugares e memórias',
                description: 'Viaje por cidades, territórios e lugares com presença no catálogo e na memória local.',
                linkLabel: 'Explorar lugares',
                target: {
                    type: 'authority',
                    q: 'Oeiras'
                }
            }
        ],

        percursosSugeridos: [
            {
                id: 'literatura-portuguesa-sec-xx',
                title: 'Literatura portuguesa do século XX',
                description: 'Autores, obras e movimentos que marcaram a escrita portuguesa contemporânea.',
                target: {
                    type: 'biblio',
                    idx: 'kw',
                    q: 'Literatura portuguesa século XX'
                },
                related: [
                    { label: 'Fernando Pessoa', type: 'authority', q: 'Fernando Pessoa' },
                    { label: 'Sophia de Mello Breyner Andresen', type: 'authority', q: 'Sophia de Mello Breyner Andresen' },
                    { label: 'José Saramago', type: 'authority', q: 'José Saramago' },
                    { label: 'Modernismo', type: 'authority', q: 'Modernismo' }
                ]
            },
            {
                id: 'autores-oeiras',
                title: 'Autores ligados a Oeiras',
                description: 'Pessoas, lugares e obras com ligação ao território e à memória local.',
                target: {
                    type: 'biblio',
                    idx: 'kw',
                    q: 'Oeiras'
                },
                related: [
                    { label: 'Oeiras', type: 'authority', q: 'Oeiras' },
                    { label: 'História local', type: 'biblio', idx: 'su', q: 'História local' },
                    { label: 'Literatura portuguesa', type: 'biblio', idx: 'su', q: 'Literatura portuguesa' }
                ]
            },
            {
                id: 'lisboa-literaria',
                title: 'Lisboa literária',
                description: 'Percorra a cidade através de livros, autores, bairros, memórias e personagens.',
                target: {
                    type: 'biblio',
                    idx: 'kw',
                    q: 'Lisboa literatura'
                },
                related: [
                    { label: 'Lisboa', type: 'authority', q: 'Lisboa' },
                    { label: 'Eça de Queirós', type: 'authority', q: 'Eça de Queirós' },
                    { label: 'Fernando Pessoa', type: 'authority', q: 'Fernando Pessoa' }
                ]
            },
            {
                id: 'livro-cinema',
                title: 'Do livro ao cinema',
                description: 'Obras literárias, adaptações cinematográficas e relações entre leitura e imagem.',
                target: {
                    type: 'biblio',
                    idx: 'kw',
                    q: 'cinema literatura adaptação'
                },
                related: [
                    { label: 'Cinema', type: 'biblio', idx: 'su', q: 'Cinema' },
                    { label: 'Adaptações cinematográficas', type: 'biblio', idx: 'su', q: 'Adaptações cinematográficas' },
                    { label: 'Literatura', type: 'biblio', idx: 'su', q: 'Literatura' }
                ]
            }
        ],

        entradasRapidas: [
            { label: 'Fernando Pessoa', type: 'biblio', idx: 'au', q: 'Fernando Pessoa' },
            { label: 'Sophia de Mello Breyner Andresen', type: 'biblio', idx: 'au', q: 'Sophia de Mello Breyner Andresen' },
            { label: 'José Saramago', type: 'biblio', idx: 'au', q: 'José Saramago' },
            { label: 'Os Lusíadas', type: 'biblio', idx: 'ti', q: 'Os Lusíadas' },
            { label: 'Modernismo', type: 'biblio', idx: 'su', q: 'Modernismo' },
            { label: 'Poesia portuguesa', type: 'biblio', idx: 'su', q: 'Poesia portuguesa' },
            { label: 'Lisboa', type: 'biblio', idx: 'su', q: 'Lisboa' }
        ]
    };

    function log(message) {
        if (NOMEN_CONFIG.debug && window.console) {
            console.log('[NOMEN OPAC ' + NOMEN_VERSION + ']', message);
        }
    }

    function enc(value) {
        return encodeURIComponent(value || '');
    }

    function isAuthorityPage() {
        return window.location.pathname.indexOf(NOMEN_CONFIG.paths.authorityHome) !== -1;
    }

    function authorityUrl(term, marclist) {
        return NOMEN_CONFIG.paths.authorityHome
            + '?op=do_search'
            + '&type=opac'
            + '&operator=contains'
            + '&marclist=' + enc(marclist || 'mainentry')
            + '&and_or=and'
            + '&orderby=HeadingAsc'
            + '&value=' + enc(term || '');
    }

    function biblioUrl(term, idx) {
        return NOMEN_CONFIG.paths.biblioSearch
            + '?idx=' + enc(idx || 'kw')
            + '&q=' + enc(term || '');
    }

    function targetUrl(target) {
        if (!target) {
            return '#';
        }

        if (target.type === 'authority') {
            return authorityUrl(target.q, target.marclist || 'mainentry');
        }

        if (target.type === 'biblio') {
            return biblioUrl(target.q, target.idx || 'kw');
        }

        return '#';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function addCss() {
        if (document.getElementById('nomen-auth-rel-css')) {
            return;
        }

        var css = `
            body.nomen-auth-page {
                background: #f4f5f5 !important;
            }

            body.nomen-auth-page #opac-main-search,
            body.nomen-auth-page #moresearches,
            body.nomen-auth-page #userauthhome,
            body.nomen-auth-page form#auth_search,
            body.nomen-auth-page form[name="f"],
            body.nomen-auth-page form[action*="opac-authorities-home.pl"]:not(#nomen-auth-search-rel) {
                display: none !important;
            }

            body.nomen-auth-page .breadcrumb {
                display: none !important;
            }

            #nomen-auth-home-rel {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                z-index: 20 !important;
                width: 100% !important;
                background: #f4f5f5 !important;
                padding: 34px 0 60px 0 !important;
                margin: 0 !important;
                color: #111111 !important;
                box-sizing: border-box !important;
                clear: both !important;
            }

            #nomen-auth-home-rel * {
                box-sizing: border-box !important;
            }

            .nomen-rel-wrap {
                max-width: 1220px;
                margin: 0 auto;
                padding: 0 24px;
                font-family: inherit;
            }

            .nomen-rel-hero {
                display: grid;
                grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr);
                gap: 26px;
                align-items: stretch;
            }

            .nomen-rel-card {
                background: #ffffff;
                border: 1px solid #dde2e2;
                border-radius: 22px;
                box-shadow: 0 10px 26px rgba(0,0,0,.06);
            }

            .nomen-rel-main {
                padding: 36px;
            }

            .nomen-rel-eyebrow {
                display: inline-flex;
                align-items: center;
                gap: 9px;
                margin-bottom: 14px;
                color: #005f66;
                font-size: 12px;
                font-weight: 900;
                letter-spacing: .08em;
                text-transform: uppercase;
            }

            .nomen-rel-eyebrow:before {
                content: "";
                width: 11px;
                height: 11px;
                display: inline-block;
                border-radius: 50%;
                background: #d7ef3f;
                box-shadow: 0 0 0 4px rgba(215,239,63,.25);
            }

            .nomen-rel-title {
                margin: 0 0 14px 0;
                font-size: 56px;
                line-height: 1.02;
                font-weight: 900;
                letter-spacing: -.045em;
                color: #111111;
            }

            .nomen-rel-title span {
                color: #007f89;
            }

            .nomen-rel-intro {
                margin: 0 0 26px 0;
                max-width: 760px;
                color: #4e5659;
                font-size: 17px;
                line-height: 1.55;
            }

            .nomen-rel-search {
                width: 100%;
                display: grid !important;
                grid-template-columns: 230px minmax(0, 1fr) 150px;
                gap: 0;
                align-items: stretch;
                background: #ffffff;
                border: 1px solid #d8dddd;
                border-radius: 0;
                overflow: hidden;
                min-height: 58px;
            }

            .nomen-rel-search select {
                width: 100%;
                height: 58px;
                border: 0;
                border-right: 1px solid #c9de3a;
                border-radius: 0;
                padding: 0 18px;
                background: #d7ef3f;
                color: #111111;
                font-size: 15px;
                font-weight: 900;
                outline: none;
                cursor: pointer;
            }

            .nomen-rel-search-field {
                position: relative;
                background: #ffffff;
            }

            .nomen-rel-search input[type="search"] {
                width: 100%;
                height: 58px;
                border: 0;
                border-radius: 0;
                padding: 0 48px 0 22px;
                background: #ffffff;
                color: #111111;
                font-size: 15px;
                outline: none;
            }

            .nomen-rel-search input::placeholder {
                color: #6f7a80;
            }

            .nomen-rel-clear {
                position: absolute;
                right: 14px;
                top: 50%;
                transform: translateY(-50%);
                width: 30px;
                height: 30px;
                border: 0;
                background: transparent;
                color: #111111;
                font-size: 22px;
                line-height: 1;
                cursor: pointer;
                opacity: .72;
            }

            .nomen-rel-clear:hover,
            .nomen-rel-clear:focus {
                opacity: 1;
                color: #007f89;
            }

            .nomen-rel-search button[type="submit"] {
                width: 100%;
                height: 58px;
                border: 0;
                border-radius: 0;
                background: #111111;
                color: #ffffff !important;
                font-size: 15px;
                font-weight: 900;
                cursor: pointer;
            }

            .nomen-rel-search button[type="submit"]:hover,
            .nomen-rel-search button[type="submit"]:focus {
                background: #007f89;
            }

            .nomen-rel-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 48px;
                padding: 0 18px;
                border-radius: 13px;
                border: 1px solid #111111;
                background: #111111;
                color: #ffffff !important;
                font-weight: 900;
                text-decoration: none !important;
                cursor: pointer;
            }

            .nomen-rel-btn:hover,
            .nomen-rel-btn:focus {
                background: #007f89;
                border-color: #007f89;
                color: #ffffff !important;
                text-decoration: none !important;
            }

            .nomen-rel-btn-light {
                background: #ffffff;
                color: #111111 !important;
                border-color: #cfd6d6;
            }

            .nomen-rel-btn-light:hover,
            .nomen-rel-btn-light:focus {
                background: #f4f5f5;
                border-color: #007f89;
                color: #007f89 !important;
            }

            .nomen-rel-examples,
            .nomen-rel-chips,
            .nomen-rel-related {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 16px;
                align-items: center;
            }

            .nomen-rel-examples strong,
            .nomen-rel-related strong {
                color: #5f666a;
                font-size: 12px;
                letter-spacing: .08em;
                text-transform: uppercase;
                margin-right: 4px;
            }

            .nomen-rel-chip {
                display: inline-flex;
                align-items: center;
                border: 1px solid #d5dddd;
                background: #ffffff;
                color: #005f66 !important;
                border-radius: 999px;
                padding: 8px 12px;
                font-size: 14px;
                font-weight: 800;
                text-decoration: none !important;
            }

            .nomen-rel-chip:hover,
            .nomen-rel-chip:focus {
                background: #d7ef3f;
                border-color: #c8df2f;
                color: #111111 !important;
                text-decoration: none !important;
            }

            .nomen-rel-feature {
                display: grid;
                grid-template-columns: 170px minmax(0,1fr);
                overflow: hidden;
            }

            .nomen-rel-feature-img {
                display: flex;
                align-items: center;
                justify-content: center;
                background:
                    radial-gradient(circle at 40% 35%, rgba(215,239,63,.52), transparent 35%),
                    linear-gradient(135deg, #e8eeee, #ffffff);
            }

            .nomen-rel-avatar {
                width: 126px;
                height: 126px;
                border-radius: 50%;
                background: #111111;
                color: #d7ef3f;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 48px;
                font-weight: 900;
                box-shadow: 0 14px 28px rgba(0,0,0,.16);
            }

            .nomen-rel-feature-body {
                padding: 28px;
            }

            .nomen-rel-kicker {
                color: #005f66;
                font-size: 12px;
                font-weight: 900;
                letter-spacing: .08em;
                text-transform: uppercase;
                margin-bottom: 8px;
            }

            .nomen-rel-feature-title {
                margin: 0 0 8px 0;
                color: #007f89;
                font-size: 32px;
                font-weight: 900;
                letter-spacing: -.025em;
            }

            .nomen-rel-feature-type {
                display: inline-flex;
                margin-bottom: 10px;
                padding: 4px 9px;
                border-radius: 999px;
                background: rgba(215,239,63,.45);
                color: #111111;
                font-size: 12px;
                font-weight: 900;
            }

            .nomen-rel-feature-text {
                color: #4e5659;
                line-height: 1.5;
                margin: 0 0 16px 0;
            }

            .nomen-rel-pills {
                display: flex;
                flex-wrap: wrap;
                gap: 7px;
                margin: 0 0 18px 0;
            }

            .nomen-rel-pill {
                display: inline-flex;
                align-items: center;
                border: 1px solid rgba(0,127,137,.25);
                color: #005f66;
                background: rgba(0,127,137,.06);
                border-radius: 999px;
                padding: 5px 9px;
                font-size: 12px;
                font-weight: 800;
            }

            .nomen-rel-actions {
                display: flex;
                gap: 9px;
                flex-wrap: wrap;
            }

            .nomen-rel-section {
                margin-top: 28px;
            }

            .nomen-rel-section h2 {
                margin: 0;
                font-size: 22px;
                font-weight: 900;
                color: #111111;
            }

            .nomen-rel-section p.nomen-rel-section-text {
                margin: 4px 0 14px 0;
                color: #5f666a;
                font-size: 15px;
            }

            .nomen-rel-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0,1fr));
                gap: 16px;
            }

            .nomen-rel-path {
                min-height: 170px;
                padding: 22px 20px;
                color: #111111 !important;
                text-decoration: none !important;
            }

            .nomen-rel-path:hover,
            .nomen-rel-path:focus,
            .nomen-rel-curated:hover,
            .nomen-rel-curated:focus {
                border-color: rgba(0,127,137,.42);
                box-shadow: 0 14px 30px rgba(0,0,0,.09);
                text-decoration: none !important;
            }

            .nomen-rel-icon {
                width: 44px;
                height: 44px;
                border-radius: 15px;
                background: #d7ef3f;
                color: #111111;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                margin-bottom: 14px;
            }

            .nomen-rel-path h3,
            .nomen-rel-curated h3,
            .nomen-rel-info h3 {
                margin: 0 0 8px 0;
                color: #111111;
                font-size: 18px;
                font-weight: 900;
            }

            .nomen-rel-path h3 {
                color: #007f89;
            }

            .nomen-rel-path p,
            .nomen-rel-curated p,
            .nomen-rel-info p {
                margin: 0;
                color: #4e5659;
                line-height: 1.45;
                font-size: 14px;
            }

            .nomen-rel-link {
                margin-top: 14px;
                color: #005f66;
                font-weight: 900;
                font-size: 14px;
            }

            .nomen-rel-curated {
                overflow: hidden;
                color: #111111 !important;
                text-decoration: none !important;
            }

            .nomen-rel-curated-img {
                height: 92px;
                background:
                    radial-gradient(circle at 20% 30%, rgba(215,239,63,.9), transparent 28%),
                    linear-gradient(135deg, #007f89, #111111);
            }

            .nomen-rel-curated-body {
                padding: 18px;
            }

            .nomen-rel-lower {
                display: grid;
                grid-template-columns: minmax(0, 1.1fr) minmax(300px, .9fr);
                gap: 16px;
                align-items: stretch;
            }

            .nomen-rel-info {
                padding: 22px;
            }

            .nomen-rel-info-blue {
                background: #eaf7f8;
                border-color: rgba(0,127,137,.18);
            }

            .nomen-rel-mini-link {
                display: inline-flex;
                margin-top: 12px;
                color: #005f66 !important;
                font-weight: 900;
                text-decoration: none !important;
            }

            @media (max-width: 1050px) {
                .nomen-rel-hero,
                .nomen-rel-lower {
                    grid-template-columns: 1fr;
                }

                .nomen-rel-grid {
                    grid-template-columns: repeat(2, minmax(0,1fr));
                }
            }

            @media (max-width: 680px) {
                .nomen-rel-title {
                    font-size: 38px;
                }

                .nomen-rel-search {
                    grid-template-columns: 1fr;
                }

                .nomen-rel-feature {
                    grid-template-columns: 1fr;
                }

                .nomen-rel-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;

        var style = document.createElement('style');
        style.id = 'nomen-auth-rel-css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    function renderChip(item) {
        var label = escapeHtml(item.label);
        var href;

        if (item.type === 'authority') {
            href = authorityUrl(item.q, item.marclist || 'mainentry');
        } else {
            href = biblioUrl(item.q, item.idx || 'kw');
        }

        return '<a class="nomen-rel-chip" href="' + href + '">⌕ ' + label + '</a>';
    }

    function renderSourcePills(sources) {
        return (sources || []).map(function (source) {
            return '<span class="nomen-rel-pill">' + escapeHtml(source) + '</span>';
        }).join('');
    }

    function renderRelatedChips(items) {
        return (items || []).map(function (item) {
            var target = item.biblio
                ? { type: 'biblio', idx: item.biblio.idx || 'kw', q: item.biblio.q || item.label }
                : { type: 'authority', q: item.q || item.label };

            return '<a class="nomen-rel-chip" href="' + targetUrl(target) + '">' + escapeHtml(item.label) + '</a>';
        }).join('');
    }

    function renderSearchExamples() {
        return NOMEN_DATA.exemplosPesquisa.map(renderChip).join('');
    }

    function renderPercursosDescoberta() {
        return NOMEN_DATA.percursosDescoberta.map(function (item) {
            return `
                <a class="nomen-rel-card nomen-rel-path" href="${targetUrl(item.target)}">
                    <div class="nomen-rel-icon">${escapeHtml(item.icon)}</div>
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>${escapeHtml(item.description)}</p>
                    <div class="nomen-rel-link">${escapeHtml(item.linkLabel)}</div>
                </a>
            `;
        }).join('');
    }

    function renderPercursosSugeridos() {
        return NOMEN_DATA.percursosSugeridos.map(function (item) {
            return `
                <a class="nomen-rel-card nomen-rel-curated" href="${targetUrl(item.target)}">
                    <div class="nomen-rel-curated-img"></div>
                    <div class="nomen-rel-curated-body">
                        <h3>${escapeHtml(item.title)}</h3>
                        <p>${escapeHtml(item.description)}</p>
                        <div class="nomen-rel-link">Explorar</div>
                    </div>
                </a>
            `;
        }).join('');
    }

    function renderEntradasRapidas() {
        return NOMEN_DATA.entradasRapidas.map(renderChip).join('');
    }

    function buildSearchForm() {
        return `
            <form
                class="nomen-rel-search"
                id="nomen-auth-search-rel"
                method="get"
                action="${NOMEN_CONFIG.paths.authorityHome}"
                role="search"
            >
                <input type="hidden" name="op" value="do_search">
                <input type="hidden" name="type" value="opac">
                <input type="hidden" name="operator" value="contains">
                <input type="hidden" name="and_or" value="and">
                <input type="hidden" name="orderby" value="HeadingAsc">

                <select name="marclist" id="nomen-auth-marclist-rel" aria-label="Tipo de entidade">
                    <option value="mainentry">Todas as entidades</option>
                    <option value="mainentry">Autores / Pessoas</option>
                    <option value="mainentry">Obras</option>
                    <option value="mainentry">Assuntos</option>
                    <option value="mainentry">Lugares</option>
                </select>

                <div class="nomen-rel-search-field">
                    <input
                        id="nomen-auth-query-rel"
                        name="value"
                        type="search"
                        autocomplete="off"
                        placeholder="${escapeHtml(NOMEN_CONFIG.labels.searchPlaceholder)}"
                        aria-label="Pesquisar autoridades"
                    >
                    <button class="nomen-rel-clear" type="button" aria-label="Limpar pesquisa">×</button>
                </div>

                <button type="submit">${escapeHtml(NOMEN_CONFIG.labels.searchButton)}</button>
            </form>
        `;
    }

    function buildHtml() {
        var destaque = NOMEN_DATA.destaque;

        return `
            <section id="nomen-auth-home-rel">
                <div class="nomen-rel-wrap">

                    <div class="nomen-rel-hero">

                        <div class="nomen-rel-card nomen-rel-main">
                            <div class="nomen-rel-eyebrow">${escapeHtml(NOMEN_CONFIG.labels.pageEyebrow)}</div>

                            <h1 class="nomen-rel-title">
                                ${escapeHtml(NOMEN_CONFIG.labels.titlePrefix)}
                                <span>${escapeHtml(NOMEN_CONFIG.labels.titleHighlight)}</span>
                            </h1>

                            <p class="nomen-rel-intro">
                                ${escapeHtml(NOMEN_CONFIG.labels.intro)}
                            </p>

                            ${buildSearchForm()}

                            <div class="nomen-rel-examples">
                                <strong>Exemplos</strong>
                                ${renderSearchExamples()}
                            </div>
                        </div>

                        <article class="nomen-rel-card nomen-rel-feature">
                            <div class="nomen-rel-feature-img">
                                <div class="nomen-rel-avatar">${escapeHtml(destaque.initials)}</div>
                            </div>

                            <div class="nomen-rel-feature-body">
                                <div class="nomen-rel-kicker">Em destaque este mês</div>
                                <h2 class="nomen-rel-feature-title">${escapeHtml(destaque.label)}</h2>
                                <div class="nomen-rel-feature-type">${escapeHtml(destaque.type)}</div>

                                <p class="nomen-rel-feature-text">
                                    ${escapeHtml(destaque.description)}
                                </p>

                                <div class="nomen-rel-pills">
                                    ${renderSourcePills(destaque.sources)}
                                </div>

                                <div class="nomen-rel-actions">
                                    <a class="nomen-rel-btn nomen-rel-btn-light" href="${authorityUrl(destaque.authority.q, destaque.authority.marclist || 'mainentry')}">
                                        Ver perfil
                                    </a>
                                    <a class="nomen-rel-btn" href="${biblioUrl(destaque.biblio.q, destaque.biblio.idx)}">
                                        Explorar títulos
                                    </a>
                                </div>

                                <div class="nomen-rel-related">
                                    <strong>Relações</strong>
                                    ${renderRelatedChips(destaque.related)}
                                </div>
                            </div>
                        </article>

                    </div>

                    <section class="nomen-rel-section">
                        <h2>Percursos de descoberta</h2>
                        <p class="nomen-rel-section-text">Entre no catálogo por pessoas, obras, temas ou lugares.</p>

                        <div class="nomen-rel-grid">
                            ${renderPercursosDescoberta()}
                        </div>
                    </section>

                    <section class="nomen-rel-section">
                        <h2>Percursos sugeridos</h2>
                        <p class="nomen-rel-section-text">Sugestões relacionais para começar uma exploração no catálogo.</p>

                        <div class="nomen-rel-grid">
                            ${renderPercursosSugeridos()}
                        </div>
                    </section>

                    <section class="nomen-rel-section nomen-rel-lower">
                        <div class="nomen-rel-card nomen-rel-info">
                            <h3>Comece por aqui</h3>
                            <p>Alguns pontos de entrada para explorar autores, obras, temas e relações no catálogo.</p>

                            <div class="nomen-rel-chips">
                                ${renderEntradasRapidas()}
                            </div>
                        </div>

                        <aside class="nomen-rel-card nomen-rel-info nomen-rel-info-blue">
                            <h3>Como esta página é gerada?</h3>
                            <p>
                                Esta página usa relações entre autoridades, assuntos, lugares e registos bibliográficos.
                                Os blocos são definidos por regras estáveis e podem evoluir para geração automática a partir do Koha,
                                dos identificadores externos e das ligações bibliográficas.
                            </p>

                            <a class="nomen-rel-mini-link" href="${authorityUrl(destaque.authority.q)}">
                                Ver exemplo de autoridade
                            </a>
                        </aside>
                    </section>

                </div>
            </section>
        `;
    }

    function insertHome() {
        if (document.getElementById('nomen-auth-home-rel')) {
            return;
        }

        var temp = document.createElement('div');
        temp.innerHTML = buildHtml();

        var block = temp.firstElementChild;

        var headerRegion = document.getElementById('header-region');
        var wrapper = document.getElementById('wrapper');

        if (headerRegion && headerRegion.parentNode) {
            headerRegion.parentNode.insertBefore(block, headerRegion.nextSibling);
            log('Página inserida depois de #header-region.');
            return;
        }

        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(block, wrapper);
            log('Página inserida antes de #wrapper.');
            return;
        }

        document.body.insertBefore(block, document.body.firstChild);
        log('Página inserida no início do body.');
    }

    function bindSearchEnhancements() {
        var input = document.getElementById('nomen-auth-query-rel');
        var clear = document.querySelector('.nomen-rel-clear');

        if (input && clear && clear.getAttribute('data-bound') !== '1') {
            clear.setAttribute('data-bound', '1');

            clear.addEventListener('click', function () {
                input.value = '';
                input.focus();
            });
        }
    }

    function hideNativeElements() {
        if (!document.getElementById('nomen-auth-home-rel')) {
            return;
        }

        var selectors = [
            '#opac-main-search',
            '#moresearches',
            '#userauthhome',
            'form#auth_search',
            'form[name="f"]',
            'form[action*="opac-authorities-home.pl"]:not(#nomen-auth-search-rel)'
        ];

        selectors.forEach(function (selector) {
            var nodes = document.querySelectorAll(selector);

            nodes.forEach(function (node) {
                if (!node.closest('#nomen-auth-home-rel')) {
                    node.style.display = 'none';
                }
            });
        });
    }

    function init() {
        if (!isAuthorityPage()) {
            return;
        }

        log('A iniciar.');

        document.body.classList.add('nomen-auth-page');

        addCss();
        insertHome();
        bindSearchEnhancements();
        hideNativeElements();

        window.setTimeout(function () {
            insertHome();
            bindSearchEnhancements();
            hideNativeElements();
        }, 800);

        log('Concluído.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
