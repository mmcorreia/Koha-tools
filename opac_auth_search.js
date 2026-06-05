(function () {
    'use strict';

    /*
     * N●MEN OPAC
     * Página inicial de autoridades, versão isolada
     *
     * Esta versão:
     * - corre apenas em /cgi-bin/koha/opac-authorities-home.pl
     * - insere o bloco diretamente no body, fora dos contentores do Koha
     * - não esconde a pesquisa nativa nem outros elementos do Koha
     * - serve para confirmar que a interface aparece
     */

    var NOMEN_DEBUG = true;

    function log(msg) {
        if (NOMEN_DEBUG && window.console) {
            console.log('[NOMEN OPAC TESTE]', msg);
        }
    }

    function isAuthorityHomePage() {
        return window.location.pathname.indexOf('/cgi-bin/koha/opac-authorities-home.pl') !== -1;
    }

    function enc(value) {
        return encodeURIComponent(value || '');
    }

    function authoritySearchUrl(term) {
        return '/cgi-bin/koha/opac-authorities-home.pl'
            + '?op=do_search'
            + '&type=opac'
            + '&operator=contains'
            + '&marclist=mainentry'
            + '&and_or=and'
            + '&orderby=HeadingAsc'
            + '&value=' + enc(term || '');
    }

    function biblioSearchUrl(term, idx) {
        return '/cgi-bin/koha/opac-search.pl'
            + '?idx=' + enc(idx || 'kw')
            + '&q=' + enc(term || '');
    }

    function addStyles() {
        if (document.getElementById('nomen-authority-home-test-css')) {
            return;
        }

        var css = `
            #nomen-authority-home-test {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: relative !important;
                z-index: 50 !important;
                width: 100% !important;
                background: #f4f5f5 !important;
                padding: 28px 0 58px 0 !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                color: #111111 !important;
                clear: both !important;
            }

            #nomen-authority-home-test * {
                box-sizing: border-box !important;
            }

            .nomen-test-wrap {
                max-width: 1220px;
                margin: 0 auto;
                padding: 0 22px;
                font-family: inherit;
            }

            .nomen-test-alert {
                background: #111111;
                color: #d7ef3f;
                border-radius: 14px;
                padding: 10px 14px;
                margin: 0 0 18px 0;
                font-size: 13px;
                font-weight: 800;
                letter-spacing: 0.02em;
            }

            .nomen-test-hero {
                display: grid;
                grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
                gap: 26px;
                align-items: stretch;
                margin-bottom: 28px;
            }

            .nomen-test-card {
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                background: #ffffff;
                border: 1px solid #dde2e2;
                border-radius: 22px;
                box-shadow: 0 10px 26px rgba(0, 0, 0, 0.06);
            }

            .nomen-test-main-card {
                padding: 34px 36px 32px 36px;
            }

            .nomen-test-eyebrow {
                display: inline-flex;
                align-items: center;
                gap: 9px;
                margin-bottom: 14px;
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #005f66;
            }

            .nomen-test-eyebrow::before {
                content: "";
                width: 11px;
                height: 11px;
                border-radius: 50%;
                background: #d7ef3f;
                box-shadow: 0 0 0 4px rgba(215, 239, 63, 0.25);
            }

            .nomen-test-title {
                margin: 0 0 14px 0;
                font-size: 54px;
                line-height: 1.02;
                font-weight: 900;
                letter-spacing: -0.045em;
                color: #111111;
            }

            .nomen-test-title span {
                color: #007f89;
            }

            .nomen-test-intro {
                max-width: 760px;
                margin: 0 0 26px 0;
                color: #4e5659;
                font-size: 17px;
                line-height: 1.55;
            }

            .nomen-test-search {
                display: grid;
                grid-template-columns: 210px minmax(0, 1fr) 136px;
                gap: 10px;
                align-items: center;
                padding: 10px;
                background: #f4f5f5;
                border: 1px solid #d8dddd;
                border-radius: 18px;
            }

            .nomen-test-search select,
            .nomen-test-search input {
                width: 100%;
                height: 48px;
                border: 1px solid #cfd6d6;
                border-radius: 13px;
                padding: 0 15px;
                font-size: 15px;
                background: #ffffff;
                color: #111111;
                outline: none;
            }

            .nomen-test-search select {
                background: #d7ef3f;
                border-color: #c9de3a;
                font-weight: 800;
                cursor: pointer;
            }

            .nomen-test-search input:focus {
                border-color: #007f89;
                box-shadow: 0 0 0 3px rgba(0, 127, 137, 0.14);
            }

            .nomen-test-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 46px;
                border-radius: 13px;
                padding: 0 18px;
                border: 1px solid #111111;
                background: #111111;
                color: #ffffff !important;
                font-weight: 800;
                text-decoration: none !important;
                cursor: pointer;
            }

            .nomen-test-btn:hover,
            .nomen-test-btn:focus {
                background: #007f89;
                border-color: #007f89;
                color: #ffffff !important;
                text-decoration: none !important;
            }

            .nomen-test-btn-light {
                background: #ffffff;
                color: #111111 !important;
                border-color: #cfd6d6;
            }

            .nomen-test-btn-light:hover,
            .nomen-test-btn-light:focus {
                background: #f4f5f5;
                border-color: #007f89;
                color: #007f89 !important;
            }

            .nomen-test-examples,
            .nomen-test-chip-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 16px;
                align-items: center;
            }

            .nomen-test-examples strong {
                margin-right: 4px;
                font-size: 12px;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #5f666a;
            }

            .nomen-test-chip {
                display: inline-flex;
                align-items: center;
                border: 1px solid #d5dddd;
                background: #ffffff;
                color: #005f66 !important;
                border-radius: 999px;
                padding: 8px 12px;
                font-size: 14px;
                font-weight: 700;
                text-decoration: none !important;
                line-height: 1;
            }

            .nomen-test-chip:hover,
            .nomen-test-chip:focus {
                background: #d7ef3f;
                border-color: #c8df2f;
                color: #111111 !important;
                text-decoration: none !important;
            }

            .nomen-test-feature {
                overflow: hidden;
                display: grid !important;
                grid-template-columns: 170px minmax(0, 1fr);
            }

            .nomen-test-feature-image {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: radial-gradient(circle at 40% 35%, rgba(215,239,63,0.52), transparent 35%), linear-gradient(135deg, #e8eeee, #ffffff);
            }

            .nomen-test-portrait {
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
                box-shadow: 0 14px 28px rgba(0, 0, 0, 0.16);
            }

            .nomen-test-feature-content {
                padding: 28px 28px 26px 28px;
            }

            .nomen-test-kicker {
                color: #005f66;
                font-size: 12px;
                font-weight: 900;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                margin-bottom: 8px;
            }

            .nomen-test-feature-title {
                margin: 0 0 8px 0;
                color: #007f89;
                font-size: 32px;
                font-weight: 900;
                letter-spacing: -0.025em;
            }

            .nomen-test-feature-text {
                color: #4e5659;
                line-height: 1.5;
                margin: 0 0 14px 0;
            }

            .nomen-test-pill-list {
                display: flex;
                flex-wrap: wrap;
                gap: 7px;
                margin: 14px 0 18px 0;
            }

            .nomen-test-pill {
                display: inline-flex;
                align-items: center;
                border: 1px solid rgba(0, 127, 137, 0.25);
                color: #005f66;
                background: rgba(0, 127, 137, 0.06);
                border-radius: 999px;
                padding: 5px 9px;
                font-size: 12px;
                font-weight: 800;
            }

            .nomen-test-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 9px;
            }

            .nomen-test-section {
                margin-top: 28px;
            }

            .nomen-test-section-title {
                margin: 0;
                font-size: 22px;
                font-weight: 900;
                letter-spacing: -0.02em;
                color: #111111;
            }

            .nomen-test-section-text {
                margin: 4px 0 14px 0;
                color: #5f666a;
                font-size: 15px;
            }

            .nomen-test-grid-4 {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 16px;
            }

            .nomen-test-path-card {
                padding: 22px 20px;
                min-height: 178px;
                display: flex !important;
                flex-direction: column;
                justify-content: space-between;
                text-decoration: none !important;
                color: #111111 !important;
            }

            .nomen-test-path-card:hover,
            .nomen-test-curated-card:hover {
                border-color: rgba(0, 127, 137, 0.42);
                box-shadow: 0 14px 30px rgba(0, 0, 0, 0.09);
                text-decoration: none !important;
            }

            .nomen-test-icon {
                width: 44px;
                height: 44px;
                border-radius: 15px;
                background: #d7ef3f;
                color: #111111;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 22px;
                font-weight: 900;
                margin-bottom: 14px;
            }

            .nomen-test-path-card h3,
            .nomen-test-curated-card h3,
            .nomen-test-start h3,
            .nomen-test-info h3 {
                margin: 0 0 8px 0;
                color: #111111;
                font-size: 18px;
                font-weight: 900;
            }

            .nomen-test-path-card h3 {
                color: #007f89;
            }

            .nomen-test-path-card p,
            .nomen-test-curated-card p,
            .nomen-test-start p,
            .nomen-test-info p {
                margin: 0;
                color: #4e5659;
                line-height: 1.45;
                font-size: 14px;
            }

            .nomen-test-card-link {
                margin-top: 16px;
                color: #005f66;
                font-weight: 900;
                font-size: 14px;
            }

            .nomen-test-curated-card {
                overflow: hidden;
                text-decoration: none !important;
                color: #111111 !important;
            }

            .nomen-test-curated-visual {
                height: 92px;
                background: radial-gradient(circle at 20% 30%, rgba(215,239,63,0.9), transparent 28%), linear-gradient(135deg, #007f89, #111111);
            }

            .nomen-test-curated-body {
                padding: 18px 18px 20px 18px;
            }

            .nomen-test-lower {
                display: grid;
                grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);
                gap: 16px;
                align-items: stretch;
            }

            .nomen-test-start,
            .nomen-test-info {
                padding: 22px;
            }

            .nomen-test-info {
                background: #eaf7f8;
                border-color: rgba(0, 127, 137, 0.18);
            }

            .nomen-test-mini-link {
                display: inline-flex;
                margin-top: 12px;
                color: #005f66 !important;
                font-weight: 900;
                text-decoration: none !important;
            }

            @media (max-width: 1050px) {
                .nomen-test-hero,
                .nomen-test-lower {
                    grid-template-columns: 1fr;
                }

                .nomen-test-grid-4 {
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
            }

            @media (max-width: 680px) {
                .nomen-test-main-card,
                .nomen-test-feature-content {
                    padding: 24px 20px;
                }

                .nomen-test-title {
                    font-size: 38px;
                }

                .nomen-test-search {
                    grid-template-columns: 1fr;
                }

                .nomen-test-feature {
                    grid-template-columns: 1fr;
                }

                .nomen-test-feature-image {
                    min-height: 170px;
                }

                .nomen-test-grid-4 {
                    grid-template-columns: 1fr;
                }
            }
        `;

        var style = document.createElement('style');
        style.id = 'nomen-authority-home-test-css';
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);

        log('CSS inserido.');
    }

    function chipAuthority(label) {
        return '<a class="nomen-test-chip" href="' + authoritySearchUrl(label) + '">⌕ ' + label + '</a>';
    }

    function chipBiblio(label, idx) {
        return '<a class="nomen-test-chip" href="' + biblioSearchUrl(label, idx) + '">⌕ ' + label + '</a>';
    }

    function buildHtml() {
        return `
            <section id="nomen-authority-home-test">
                <div class="nomen-test-wrap">

                    <div class="nomen-test-alert">
                        N●MEN OPAC, bloco de teste carregado. Se estás a ver esta faixa, a inserção funciona.
                    </div>

                    <div class="nomen-test-hero">

                        <div class="nomen-test-card nomen-test-main-card">
                            <div class="nomen-test-eyebrow">Autoridades bibliográficas</div>

                            <h1 class="nomen-test-title">
                                Descobrir <span>autores, obras e temas</span>
                            </h1>

                            <p class="nomen-test-intro">
                                Explore o catálogo através de pessoas, obras, lugares, temas e outras entidades.
                                Cada autoridade funciona como uma porta de entrada para títulos disponíveis,
                                relações relevantes e novos percursos de leitura.
                            </p>

                            <form class="nomen-test-search" id="nomen-authority-search-form-test" role="search">
                                <select id="nomen-authority-type-test" aria-label="Tipo de pesquisa">
                                    <option value="mainentry">Todas as entidades</option>
                                    <option value="mainentry">Nome da entidade</option>
                                </select>

                                <input
                                    id="nomen-authority-query-test"
                                    type="search"
                                    autocomplete="off"
                                    placeholder="Pesquisar por autor, obra, tema, lugar ou entidade"
                                    aria-label="Pesquisar autoridades"
                                >

                                <button class="nomen-test-btn" type="submit">
                                    Pesquisar
                                </button>
                            </form>

                            <div class="nomen-test-examples">
                                <strong>Exemplos</strong>
                                ${chipAuthority('Fernando Pessoa')}
                                ${chipAuthority('Sophia de Mello Breyner Andresen')}
                                ${chipAuthority('José Saramago')}
                                ${chipAuthority('Lisboa')}
                                ${chipAuthority('Modernismo')}
                            </div>
                        </div>

                        <article class="nomen-test-card nomen-test-feature">
                            <div class="nomen-test-feature-image" aria-hidden="true">
                                <div class="nomen-test-portrait">FP</div>
                            </div>

                            <div class="nomen-test-feature-content">
                                <div class="nomen-test-kicker">Em destaque este mês</div>
                                <h2 class="nomen-test-feature-title">Fernando Pessoa</h2>

                                <p class="nomen-test-feature-text">
                                    Poeta, escritor e pensador central da literatura portuguesa.
                                    Explore obras, estudos críticos, heterónimos e temas relacionados
                                    disponíveis no catálogo.
                                </p>

                                <div class="nomen-test-pill-list">
                                    <span class="nomen-test-pill">Wikidata</span>
                                    <span class="nomen-test-pill">VIAF</span>
                                    <span class="nomen-test-pill">Wikipédia</span>
                                </div>

                                <div class="nomen-test-actions">
                                    <a class="nomen-test-btn nomen-test-btn-light" href="${authoritySearchUrl('Fernando Pessoa')}">
                                        Ver perfil
                                    </a>

                                    <a class="nomen-test-btn" href="${biblioSearchUrl('Fernando Pessoa', 'au')}">
                                        Explorar títulos
                                    </a>
                                </div>
                            </div>
                        </article>

                    </div>

                    <section class="nomen-test-section">
                        <h2 class="nomen-test-section-title">Percursos de descoberta</h2>
                        <p class="nomen-test-section-text">
                            Entre no catálogo por pessoas, obras, temas ou lugares.
                        </p>

                        <div class="nomen-test-grid-4">
                            <a class="nomen-test-card nomen-test-path-card" href="${authoritySearchUrl('Pessoa')}">
                                <div>
                                    <div class="nomen-test-icon">P</div>
                                    <h3>Autores e artistas</h3>
                                    <p>Conheça autores, ilustradores, tradutores, músicos e outras pessoas ligadas às obras do catálogo.</p>
                                </div>
                                <div class="nomen-test-card-link">Explorar entidades</div>
                            </a>

                            <a class="nomen-test-card nomen-test-path-card" href="${biblioSearchUrl('', 'ti')}">
                                <div>
                                    <div class="nomen-test-icon">O</div>
                                    <h3>Obras e criações</h3>
                                    <p>Descubra obras, títulos, edições e expressões criativas existentes nas bibliotecas.</p>
                                </div>
                                <div class="nomen-test-card-link">Pesquisar obras</div>
                            </a>

                            <a class="nomen-test-card nomen-test-path-card" href="${authoritySearchUrl('Poesia portuguesa')}">
                                <div>
                                    <div class="nomen-test-icon">T</div>
                                    <h3>Temas e assuntos</h3>
                                    <p>Explore ideias, géneros, movimentos e assuntos que ajudam a organizar o conhecimento.</p>
                                </div>
                                <div class="nomen-test-card-link">Explorar temas</div>
                            </a>

                            <a class="nomen-test-card nomen-test-path-card" href="${authoritySearchUrl('Oeiras')}">
                                <div>
                                    <div class="nomen-test-icon">L</div>
                                    <h3>Lugares e memórias</h3>
                                    <p>Viaje por cidades, territórios e lugares com presença no catálogo e na memória local.</p>
                                </div>
                                <div class="nomen-test-card-link">Explorar lugares</div>
                            </a>
                        </div>
                    </section>

                    <section class="nomen-test-section">
                        <h2 class="nomen-test-section-title">Percursos sugeridos</h2>
                        <p class="nomen-test-section-text">
                            Sugestões editoriais para começar uma exploração no catálogo.
                        </p>

                        <div class="nomen-test-grid-4">
                            <a class="nomen-test-card nomen-test-curated-card" href="${biblioSearchUrl('Literatura portuguesa século XX', 'kw')}">
                                <div class="nomen-test-curated-visual"></div>
                                <div class="nomen-test-curated-body">
                                    <h3>Literatura portuguesa do século XX</h3>
                                    <p>Autores, obras e movimentos que marcaram a escrita portuguesa contemporânea.</p>
                                    <div class="nomen-test-card-link">Explorar</div>
                                </div>
                            </a>

                            <a class="nomen-test-card nomen-test-curated-card" href="${biblioSearchUrl('Oeiras', 'kw')}">
                                <div class="nomen-test-curated-visual"></div>
                                <div class="nomen-test-curated-body">
                                    <h3>Autores ligados a Oeiras</h3>
                                    <p>Pessoas, lugares e obras com ligação ao território e à memória local.</p>
                                    <div class="nomen-test-card-link">Explorar</div>
                                </div>
                            </a>

                            <a class="nomen-test-card nomen-test-curated-card" href="${biblioSearchUrl('Lisboa literatura', 'kw')}">
                                <div class="nomen-test-curated-visual"></div>
                                <div class="nomen-test-curated-body">
                                    <h3>Lisboa literária</h3>
                                    <p>Percorra a cidade através de livros, autores, bairros, memórias e personagens.</p>
                                    <div class="nomen-test-card-link">Explorar</div>
                                </div>
                            </a>

                            <a class="nomen-test-card nomen-test-curated-card" href="${biblioSearchUrl('cinema literatura adaptação', 'kw')}">
                                <div class="nomen-test-curated-visual"></div>
                                <div class="nomen-test-curated-body">
                                    <h3>Do livro ao cinema</h3>
                                    <p>Obras literárias, adaptações cinematográficas e relações entre leitura e imagem.</p>
                                    <div class="nomen-test-card-link">Explorar</div>
                                </div>
                            </a>
                        </div>
                    </section>

                    <section class="nomen-test-section nomen-test-lower">
                        <div class="nomen-test-card nomen-test-start">
                            <h3>Comece por aqui</h3>
                            <p>
                                Alguns pontos de entrada para explorar autores, obras, temas e relações no catálogo.
                            </p>

                            <div class="nomen-test-chip-list">
                                ${chipBiblio('Fernando Pessoa', 'au')}
                                ${chipBiblio('Sophia de Mello Breyner Andresen', 'au')}
                                ${chipBiblio('José Saramago', 'au')}
                                ${chipBiblio('Os Lusíadas', 'ti')}
                                ${chipBiblio('Modernismo', 'su')}
                                ${chipBiblio('Poesia portuguesa', 'su')}
                                ${chipBiblio('Lisboa', 'su')}
                            </div>
                        </div>

                        <aside class="nomen-test-card nomen-test-info">
                            <h3>O que são autoridades?</h3>
                            <p>
                                As autoridades bibliográficas reúnem diferentes formas de nomear uma pessoa,
                                obra, tema ou lugar. Nesta página, usamos essas entidades para facilitar
                                a descoberta dos títulos existentes no catálogo.
                            </p>

                            <a class="nomen-test-mini-link" href="${authoritySearchUrl('Fernando Pessoa')}">
                                Ver exemplo de autoridade
                            </a>
                        </aside>
                    </section>

                </div>
            </section>
        `;
    }

    function insertBlock() {
        if (document.getElementById('nomen-authority-home-test')) {
            log('Bloco já existe.');
            return;
        }

        var temp = document.createElement('div');
        temp.innerHTML = buildHtml();

        var block = temp.firstElementChild;

        /*
         * Inserção direta no body, antes do wrapper do Koha se existir.
         * Assim evitamos contentores escondidos.
         */
        var wrapper = document.getElementById('wrapper');
        var mainContent = document.getElementById('maincontent');
        var headerRegion = document.getElementById('header-region');

        if (headerRegion && headerRegion.parentNode) {
            headerRegion.parentNode.insertBefore(block, headerRegion.nextSibling);
            log('Bloco inserido depois de #header-region.');
            return;
        }

        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(block, wrapper);
            log('Bloco inserido antes de #wrapper.');
            return;
        }

        if (mainContent && mainContent.parentNode) {
            mainContent.parentNode.insertBefore(block, mainContent);
            log('Bloco inserido antes de #maincontent.');
            return;
        }

        document.body.insertBefore(block, document.body.firstChild);
        log('Bloco inserido no início do body.');
    }

    function bindSearch() {
        var form = document.getElementById('nomen-authority-search-form-test');
        var input = document.getElementById('nomen-authority-query-test');

        if (!form || !input) {
            log('Formulário não encontrado.');
            return;
        }

        if (form.getAttribute('data-nomen-bound') === '1') {
            return;
        }

        form.setAttribute('data-nomen-bound', '1');

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            var term = input.value.replace(/^\s+|\s+$/g, '');

            if (!term) {
                input.focus();
                return;
            }

            window.location.href = authoritySearchUrl(term);
        });

        log('Pesquisa ligada.');
    }

    function init() {
        if (!isAuthorityHomePage()) {
            log('Não é a página de autoridades.');
            return;
        }

        document.body.classList.add('nomen-authority-page');

        addStyles();
        insertBlock();
        bindSearch();

        window.setTimeout(function () {
            insertBlock();
            bindSearch();
        }, 500);

        window.setTimeout(function () {
            insertBlock();
            bindSearch();
        }, 1500);

        log('Inicialização concluída.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
