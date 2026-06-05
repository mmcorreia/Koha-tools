(function () {
    'use strict';

    /*
     * N●MEN OPAC
     * Página inicial pública de autoridades
     * Objetivo:
     * Transformar a página de pesquisa de autoridades do Koha
     * numa página de descoberta para o leitor.
     */

    var NOMEN_AUTHORITY_HOME = {
        debug: true,

        paths: {
            authorityHome: '/cgi-bin/koha/opac-authorities-home.pl',
            authoritySearch: '/cgi-bin/koha/opac-authorities-home.pl',
            biblioSearch: '/cgi-bin/koha/opac-search.pl'
        },

        colors: {
            black: '#111111',
            lime: '#d7ef3f',
            teal: '#007f89',
            tealDark: '#005f66',
            grayBg: '#f4f5f5',
            grayText: '#5f666a',
            border: '#dde2e2',
            white: '#ffffff'
        }
    };

    function log(message) {
        if (NOMEN_AUTHORITY_HOME.debug && window.console) {
            console.log('[NOMEN OPAC]', message);
        }
    }

    function isAuthorityHomePage() {
        return window.location.pathname.indexOf(NOMEN_AUTHORITY_HOME.paths.authorityHome) !== -1;
    }

    function encode(value) {
        return encodeURIComponent(value || '');
    }

    function buildAuthoritySearchUrl(term, type) {
        var searchType = type || 'mainentry';

        return NOMEN_AUTHORITY_HOME.paths.authoritySearch +
            '?op=do_search' +
            '&type=opac' +
            '&operator=contains' +
            '&marclist=' + encode(searchType) +
            '&and_or=and' +
            '&orderby=HeadingAsc' +
            '&value=' + encode(term);
    }

    function buildBiblioSearchUrl(term, idx) {
        var index = idx || 'kw';

        return NOMEN_AUTHORITY_HOME.paths.biblioSearch +
            '?idx=' + encode(index) +
            '&q=' + encode(term);
    }

    function injectStyles() {
        if (document.getElementById('nomen-authority-home-style')) {
            return;
        }

        var css = `
            body.rbmo-authority-page #rbmo-custom-header .rbmo-search-area,
            body.rbmo-authority-page #opac-main-search,
            body.rbmo-authority-page #moresearches,
            body.rbmo-authority-page .breadcrumb,
            body.rbmo-authority-page .maincontent > h1,
            body.rbmo-authority-page #userauthhome,
            body.rbmo-authority-page form[action*="opac-authorities-home.pl"] {
                display: none !important;
            }

            body.rbmo-authority-page {
                background: #f4f5f5 !important;
            }

            body.rbmo-authority-page #maincontent,
            body.rbmo-authority-page .maincontent,
            body.rbmo-authority-page main {
                background: transparent !important;
            }

            .nomen-auth-home {
                font-family: inherit;
                color: #111111;
                margin: 0 auto 48px auto;
                max-width: 1220px;
                padding: 22px 18px 56px 18px;
            }

            .nomen-auth-hero {
                display: grid;
                grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
                gap: 26px;
                align-items: stretch;
                margin-bottom: 28px;
            }

            .nomen-auth-card {
                background: #ffffff;
                border: 1px solid #dde2e2;
                border-radius: 22px;
                box-shadow: 0 10px 26px rgba(0, 0, 0, 0.06);
            }

            .nomen-auth-hero-main {
                padding: 34px 36px 32px 36px;
                min-height: 330px;
            }

            .nomen-eyebrow {
                display: inline-flex;
                align-items: center;
                gap: 9px;
                font-size: 0.78rem;
                font-weight: 800;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #005f66;
                margin-bottom: 14px;
            }

            .nomen-eyebrow::before {
                content: "";
                display: inline-block;
                width: 11px;
                height: 11px;
                border-radius: 50%;
                background: #d7ef3f;
                box-shadow: 0 0 0 4px rgba(215, 239, 63, 0.25);
            }

            .nomen-auth-title {
                margin: 0 0 14px 0;
                font-size: clamp(2.1rem, 4vw, 4rem);
                line-height: 1.02;
                font-weight: 900;
                letter-spacing: -0.045em;
                color: #111111;
            }

            .nomen-auth-title .nomen-title-teal {
                color: #007f89;
            }

            .nomen-auth-intro {
                max-width: 760px;
                margin: 0 0 26px 0;
                color: #4e5659;
                font-size: 1.06rem;
                line-height: 1.55;
            }

            .nomen-auth-search {
                background: #f4f5f5;
                border: 1px solid #d8dddd;
                border-radius: 18px;
                padding: 10px;
                display: grid;
                grid-template-columns: 210px minmax(0, 1fr) 136px;
                gap: 10px;
                align-items: center;
            }

            .nomen-auth-search select,
            .nomen-auth-search input {
                width: 100%;
                height: 48px;
                border: 1px solid #cfd6d6;
                border-radius: 13px;
                padding: 0 15px;
                font-size: 0.98rem;
                background: #ffffff;
                color: #111111;
                outline: none;
            }

            .nomen-auth-search select {
                background: #d7ef3f;
                border-color: #c9de3a;
                font-weight: 800;
                cursor: pointer;
            }

            .nomen-auth-search input:focus {
                border-color: #007f89;
                box-shadow: 0 0 0 3px rgba(0, 127, 137, 0.14);
            }

            .nomen-auth-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                min-height: 46px;
                border-radius: 13px;
                padding: 0 18px;
                border: 1px solid #111111;
                background: #111111;
                color: #ffffff !important;
                font-weight: 800;
                text-decoration: none !important;
                cursor: pointer;
                transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
            }

            .nomen-auth-button:hover,
            .nomen-auth-button:focus {
                background: #007f89;
                border-color: #007f89;
                color: #ffffff !important;
                transform: translateY(-1px);
            }

            .nomen-auth-button-secondary {
                background: #ffffff;
                color: #111111 !important;
                border-color: #cfd6d6;
            }

            .nomen-auth-button-secondary:hover,
            .nomen-auth-button-secondary:focus {
                background: #f4f5f5;
                border-color: #007f89;
                color: #007f89 !important;
            }

            .nomen-search-examples {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 16px;
                align-items: center;
            }

            .nomen-search-examples strong {
                font-size: 0.78rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #5f666a;
                margin-right: 4px;
            }

            .nomen-chip {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                border: 1px solid #d5dddd;
                background: #ffffff;
                color: #005f66 !important;
                border-radius: 999px;
                padding: 8px 12px;
                font-size: 0.9rem;
                font-weight: 700;
                text-decoration: none !important;
                line-height: 1;
            }

            .nomen-chip:hover,
            .nomen-chip:focus {
                background: #d7ef3f;
                border-color: #c8df2f;
                color: #111111 !important;
            }

            .nomen-feature {
                overflow: hidden;
                display: grid;
                grid-template-columns: 180px minmax(0, 1fr);
                min-height: 330px;
            }

            .nomen-feature-image {
                background:
                    radial-gradient(circle at 40% 35%, rgba(215,239,63,0.52), transparent 35%),
                    linear-gradient(135deg, #e8eeee, #ffffff);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
            }

            .nomen-portrait {
                width: 132px;
                height: 132px;
                border-radius: 50%;
                background: #111111;
                color: #d7ef3f;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 3.4rem;
                font-weight: 900;
                box-shadow: 0 14px 28px rgba(0, 0, 0, 0.16);
            }

            .nomen-feature-content {
                padding: 28px 28px 26px 28px;
            }

            .nomen-feature-kicker {
                color: #005f66;
                font-size: 0.78rem;
                font-weight: 900;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                margin-bottom: 8px;
            }

            .nomen-feature-title {
                margin: 0 0 8px 0;
                color: #007f89;
                font-size: 2rem;
                font-weight: 900;
                letter-spacing: -0.025em;
            }

            .nomen-feature-text {
                color: #4e5659;
                line-height: 1.5;
                margin: 0 0 14px 0;
            }

            .nomen-id-pills {
                display: flex;
                flex-wrap: wrap;
                gap: 7px;
                margin: 14px 0 18px 0;
            }

            .nomen-id-pill {
                display: inline-flex;
                align-items: center;
                border: 1px solid rgba(0, 127, 137, 0.25);
                color: #005f66;
                background: rgba(0, 127, 137, 0.06);
                border-radius: 999px;
                padding: 5px 9px;
                font-size: 0.78rem;
                font-weight: 800;
            }

            .nomen-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 9px;
            }

            .nomen-section {
                margin-top: 28px;
            }

            .nomen-section-header {
                display: flex;
                align-items: flex-end;
                justify-content: space-between;
                gap: 18px;
                margin-bottom: 14px;
            }

            .nomen-section-title {
                margin: 0;
                font-size: 1.35rem;
                font-weight: 900;
                letter-spacing: -0.02em;
                color: #111111;
            }

            .nomen-section-text {
                margin: 4px 0 0 0;
                color: #5f666a;
                font-size: 0.96rem;
            }

            .nomen-path-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 16px;
            }

            .nomen-path-card {
                padding: 22px 20px;
                min-height: 178px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                text-decoration: none !important;
                color: #111111 !important;
                transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
            }

            .nomen-path-card:hover,
            .nomen-path-card:focus {
                transform: translateY(-2px);
                border-color: rgba(0, 127, 137, 0.42);
                box-shadow: 0 14px 30px rgba(0, 0, 0, 0.09);
            }

            .nomen-path-icon {
                width: 44px;
                height: 44px;
                border-radius: 15px;
                background: #d7ef3f;
                color: #111111;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.35rem;
                margin-bottom: 14px;
            }

            .nomen-path-card h3 {
                margin: 0 0 8px 0;
                color: #007f89;
                font-size: 1.15rem;
                font-weight: 900;
            }

            .nomen-path-card p {
                margin: 0;
                color: #4e5659;
                line-height: 1.45;
                font-size: 0.94rem;
            }

            .nomen-card-link {
                margin-top: 16px;
                color: #005f66;
                font-weight: 900;
                font-size: 0.92rem;
            }

            .nomen-curated-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 16px;
            }

            .nomen-curated-card {
                overflow: hidden;
                text-decoration: none !important;
                color: #111111 !important;
                transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
            }

            .nomen-curated-card:hover,
            .nomen-curated-card:focus {
                transform: translateY(-2px);
                border-color: rgba(0, 127, 137, 0.42);
                box-shadow: 0 14px 30px rgba(0, 0, 0, 0.09);
            }

            .nomen-curated-visual {
                height: 92px;
                background:
                    radial-gradient(circle at 20% 30%, rgba(215,239,63,0.9), transparent 28%),
                    linear-gradient(135deg, #007f89, #111111);
            }

            .nomen-curated-body {
                padding: 18px 18px 20px 18px;
            }

            .nomen-curated-body h3 {
                margin: 0 0 8px 0;
                font-size: 1.08rem;
                font-weight: 900;
                color: #111111;
                letter-spacing: -0.015em;
            }

            .nomen-curated-body p {
                margin: 0;
                color: #4e5659;
                line-height: 1.42;
                font-size: 0.92rem;
            }

            .nomen-lower-grid {
                display: grid;
                grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
                gap: 16px;
                align-items: stretch;
            }

            .nomen-start-card,
            .nomen-info-card {
                padding: 22px;
            }

            .nomen-start-list {
                display: flex;
                flex-wrap: wrap;
                gap: 9px;
                margin-top: 14px;
            }

            .nomen-info-card {
                background: #eaf7f8;
                border-color: rgba(0, 127, 137, 0.18);
            }

            .nomen-info-card h3,
            .nomen-start-card h3 {
                margin: 0 0 8px 0;
                font-size: 1.15rem;
                font-weight: 900;
                color: #111111;
            }

            .nomen-info-card p,
            .nomen-start-card p {
                margin: 0;
                color: #4e5659;
                line-height: 1.5;
            }

            .nomen-mini-link {
                display: inline-flex;
                margin-top: 12px;
                color: #005f66 !important;
                font-weight: 900;
                text-decoration: none !important;
            }

            @media (max-width: 1050px) {
                .nomen-auth-hero,
                .nomen-lower-grid {
                    grid-template-columns: 1fr;
                }

                .nomen-path-grid,
                .nomen-curated-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }

            @media (max-width: 680px) {
                .nomen-auth-home {
                    padding-left: 12px;
                    padding-right: 12px;
                }

                .nomen-auth-hero-main,
                .nomen-feature-content {
                    padding: 24px 20px;
                }

                .nomen-auth-search {
                    grid-template-columns: 1fr;
                }

                .nomen-feature {
                    grid-template-columns: 1fr;
                }

                .nomen-feature-image {
                    min-height: 180px;
                }

                .nomen-path-grid,
                .nomen-curated-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;

        var style = document.createElement('style');
        style.id = 'nomen-authority-home-style';
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    function hideNativeKohaAuthorityContent() {
        var selectors = [
            '#userauthhome',
            'form[action*="opac-authorities-home.pl"]',
            '#opac-main-search',
            '#moresearches'
        ];

        selectors.forEach(function (selector) {
            var nodes = document.querySelectorAll(selector);
            nodes.forEach(function (node) {
                node.style.display = 'none';
            });
        });
    }

    function getMountPoint() {
        return document.querySelector('#maincontent') ||
            document.querySelector('.maincontent') ||
            document.querySelector('main') ||
            document.querySelector('#content') ||
            document.body;
    }

    function createAuthorityChip(label, type) {
        return '<a class="nomen-chip" href="' + buildAuthoritySearchUrl(label, type || 'mainentry') + '">⌕ ' + label + '</a>';
    }

    function createBiblioChip(label, idx) {
        return '<a class="nomen-chip" href="' + buildBiblioSearchUrl(label, idx || 'kw') + '">⌕ ' + label + '</a>';
    }

    function buildMarkup() {
        return `
            <section class="nomen-auth-home" id="nomen-auth-home" aria-label="Descoberta de autoridades bibliográficas">

                <div class="nomen-auth-hero">

                    <div class="nomen-auth-card nomen-auth-hero-main">
                        <div class="nomen-eyebrow">Autoridades bibliográficas</div>

                        <h1 class="nomen-auth-title">
                            Descobrir <span class="nomen-title-teal">autores, obras e temas</span>
                        </h1>

                        <p class="nomen-auth-intro">
                            Explore o catálogo através de pessoas, obras, lugares, temas e outras entidades.
                            Cada autoridade funciona como uma porta de entrada para os títulos disponíveis,
                            para relações relevantes e para novas possibilidades de leitura.
                        </p>

                        <form class="nomen-auth-search" id="nomen-authority-search-form" role="search">
                            <label class="sr-only" for="nomen-authority-type">Tipo de entidade</label>
                            <select id="nomen-authority-type" name="nomen-authority-type">
                                <option value="mainentry">Todas as entidades</option>
                                <option value="mainentry">Pessoas e entidades</option>
                                <option value="match">Forma exata</option>
                                <option value="any">Qualquer campo</option>
                            </select>

                            <label class="sr-only" for="nomen-authority-query">Pesquisar autoridades</label>
                            <input
                                id="nomen-authority-query"
                                name="nomen-authority-query"
                                type="search"
                                autocomplete="off"
                                placeholder="Pesquisar por autor, obra, tema, lugar ou entidade"
                            >

                            <button class="nomen-auth-button" type="submit">
                                Pesquisar
                            </button>
                        </form>

                        <div class="nomen-search-examples" aria-label="Exemplos de pesquisa">
                            <strong>Exemplos</strong>
                            ${createAuthorityChip('Fernando Pessoa', 'mainentry')}
                            ${createAuthorityChip('Sophia de Mello Breyner Andresen', 'mainentry')}
                            ${createAuthorityChip('José Saramago', 'mainentry')}
                            ${createAuthorityChip('Lisboa', 'mainentry')}
                            ${createAuthorityChip('Modernismo', 'mainentry')}
                        </div>
                    </div>

                    <article class="nomen-auth-card nomen-feature">
                        <div class="nomen-feature-image" aria-hidden="true">
                            <div class="nomen-portrait">FP</div>
                        </div>

                        <div class="nomen-feature-content">
                            <div class="nomen-feature-kicker">Em destaque este mês</div>
                            <h2 class="nomen-feature-title">Fernando Pessoa</h2>

                            <p class="nomen-feature-text">
                                Poeta, escritor e pensador central da literatura portuguesa.
                                Explore obras, estudos críticos, heterónimos e temas relacionados
                                disponíveis no catálogo.
                            </p>

                            <div class="nomen-id-pills" aria-label="Fontes externas disponíveis">
                                <span class="nomen-id-pill">Wikidata</span>
                                <span class="nomen-id-pill">VIAF</span>
                                <span class="nomen-id-pill">Wikipédia</span>
                            </div>

                            <div class="nomen-actions">
                                <a class="nomen-auth-button-secondary nomen-auth-button"
                                   href="${buildAuthoritySearchUrl('Fernando Pessoa', 'mainentry')}">
                                    Ver perfil
                                </a>

                                <a class="nomen-auth-button"
                                   href="${buildBiblioSearchUrl('Fernando Pessoa', 'au')}">
                                    Explorar títulos
                                </a>
                            </div>
                        </div>
                    </article>

                </div>

                <section class="nomen-section" aria-labelledby="nomen-paths-title">
                    <div class="nomen-section-header">
                        <div>
                            <h2 class="nomen-section-title" id="nomen-paths-title">Percursos de descoberta</h2>
                            <p class="nomen-section-text">
                                Entre no catálogo por pessoas, obras, temas ou lugares.
                            </p>
                        </div>
                    </div>

                    <div class="nomen-path-grid">
                        <a class="nomen-auth-card nomen-path-card" href="${buildAuthoritySearchUrl('', 'mainentry')}">
                            <div>
                                <div class="nomen-path-icon">👤</div>
                                <h3>Autores e artistas</h3>
                                <p>Conheça autores, ilustradores, tradutores, músicos e outras pessoas ligadas às obras do catálogo.</p>
                            </div>
                            <div class="nomen-card-link">Explorar entidades</div>
                        </a>

                        <a class="nomen-auth-card nomen-path-card" href="${buildBiblioSearchUrl('', 'ti')}">
                            <div>
                                <div class="nomen-path-icon">📖</div>
                                <h3>Obras e criações</h3>
                                <p>Descubra obras, títulos, edições e expressões criativas existentes nas bibliotecas.</p>
                            </div>
                            <div class="nomen-card-link">Pesquisar obras</div>
                        </a>

                        <a class="nomen-auth-card nomen-path-card" href="${buildAuthoritySearchUrl('Poesia portuguesa', 'mainentry')}">
                            <div>
                                <div class="nomen-path-icon">🏷️</div>
                                <h3>Temas e assuntos</h3>
                                <p>Explore ideias, géneros, movimentos e assuntos que ajudam a organizar o conhecimento.</p>
                            </div>
                            <div class="nomen-card-link">Explorar temas</div>
                        </a>

                        <a class="nomen-auth-card nomen-path-card" href="${buildAuthoritySearchUrl('Oeiras', 'mainentry')}">
                            <div>
                                <div class="nomen-path-icon">📍</div>
                                <h3>Lugares e memórias</h3>
                                <p>Viaje por cidades, territórios e lugares com presença no catálogo e na memória local.</p>
                            </div>
                            <div class="nomen-card-link">Explorar lugares</div>
                        </a>
                    </div>
                </section>

                <section class="nomen-section" aria-labelledby="nomen-curated-title">
                    <div class="nomen-section-header">
                        <div>
                            <h2 class="nomen-section-title" id="nomen-curated-title">Percursos sugeridos</h2>
                            <p class="nomen-section-text">
                                Sugestões editoriais para começar uma exploração no catálogo.
                            </p>
                        </div>
                    </div>

                    <div class="nomen-curated-grid">
                        <a class="nomen-auth-card nomen-curated-card" href="${buildBiblioSearchUrl('Literatura portuguesa século XX', 'kw')}">
                            <div class="nomen-curated-visual"></div>
                            <div class="nomen-curated-body">
                                <h3>Literatura portuguesa do século XX</h3>
                                <p>Autores, obras e movimentos que marcaram a escrita portuguesa contemporânea.</p>
                                <div class="nomen-card-link">Explorar</div>
                            </div>
                        </a>

                        <a class="nomen-auth-card nomen-curated-card" href="${buildBiblioSearchUrl('Oeiras', 'kw')}">
                            <div class="nomen-curated-visual"></div>
                            <div class="nomen-curated-body">
                                <h3>Autores ligados a Oeiras</h3>
                                <p>Pessoas, lugares e obras com ligação ao território e à memória local.</p>
                                <div class="nomen-card-link">Explorar</div>
                            </div>
                        </a>

                        <a class="nomen-auth-card nomen-curated-card" href="${buildBiblioSearchUrl('Lisboa literatura', 'kw')}">
                            <div class="nomen-curated-visual"></div>
                            <div class="nomen-curated-body">
                                <h3>Lisboa literária</h3>
                                <p>Percorra a cidade através de livros, autores, bairros, memórias e personagens.</p>
                                <div class="nomen-card-link">Explorar</div>
                            </div>
                        </a>

                        <a class="nomen-auth-card nomen-curated-card" href="${buildBiblioSearchUrl('cinema literatura adaptação', 'kw')}">
                            <div class="nomen-curated-visual"></div>
                            <div class="nomen-curated-body">
                                <h3>Do livro ao cinema</h3>
                                <p>Obras literárias, adaptações cinematográficas e relações entre leitura e imagem.</p>
                                <div class="nomen-card-link">Explorar</div>
                            </div>
                        </a>
                    </div>
                </section>

                <section class="nomen-section nomen-lower-grid" aria-label="Sugestões e explicação">
                    <div class="nomen-auth-card nomen-start-card">
                        <h3>Comece por aqui</h3>
                        <p>
                            Alguns pontos de entrada para explorar autores, obras, temas e relações no catálogo.
                        </p>

                        <div class="nomen-start-list">
                            ${createBiblioChip('Fernando Pessoa', 'au')}
                            ${createBiblioChip('Sophia de Mello Breyner Andresen', 'au')}
                            ${createBiblioChip('José Saramago', 'au')}
                            ${createBiblioChip('Os Lusíadas', 'ti')}
                            ${createBiblioChip('Modernismo', 'su')}
                            ${createBiblioChip('Poesia portuguesa', 'su')}
                            ${createBiblioChip('Lisboa', 'su')}
                        </div>
                    </div>

                    <aside class="nomen-auth-card nomen-info-card">
                        <h3>O que são autoridades?</h3>
                        <p>
                            As autoridades bibliográficas reúnem diferentes formas de nomear uma pessoa,
                            obra, tema ou lugar. Nesta página, usamos essas entidades para facilitar
                            a descoberta dos títulos existentes no catálogo.
                        </p>

                        <a class="nomen-mini-link" href="${buildAuthoritySearchUrl('', 'mainentry')}">
                            Pesquisar autoridades
                        </a>
                    </aside>
                </section>

            </section>
        `;
    }

    function injectAuthorityHome() {
        if (document.getElementById('nomen-auth-home')) {
            return;
        }

        var mount = getMountPoint();

        if (!mount) {
            log('Não foi encontrado ponto de inserção para a página N●MEN.');
            return;
        }

        var wrapper = document.createElement('div');
        wrapper.innerHTML = buildMarkup();

        mount.insertBefore(wrapper.firstElementChild, mount.firstChild);

        log('Página pública de autoridades N●MEN inserida.');
    }

    function bindSearchForm() {
        var form = document.getElementById('nomen-authority-search-form');
        var input = document.getElementById('nomen-authority-query');
        var select = document.getElementById('nomen-authority-type');

        if (!form || !input || !select) {
            return;
        }

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            var term = input.value.trim();
            var type = select.value || 'mainentry';

            if (!term) {
                input.focus();
                return;
            }

            window.location.href = buildAuthoritySearchUrl(term, type);
        });
    }

    function init() {
        if (!isAuthorityHomePage()) {
            return;
        }

        document.body.classList.add('rbmo-authority-page');

        injectStyles();
        hideNativeKohaAuthorityContent();
        injectAuthorityHome();
        bindSearchForm();

        log('Página de pesquisa de autoridades configurada.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
