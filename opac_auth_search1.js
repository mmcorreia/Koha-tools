(function () {
    'use strict';

    /*
     * N●MEN OPAC
     * Página inicial de pesquisa e descoberta de autoridades
     * Versão 0.3
     *
     * Pesquisa:
     * - mantém a caixa funcional em formato Koha;
     * - usa formulário GET real para opac-authorities-home.pl;
     * - mantém dropdown + campo + botão preto;
     * - liga sugestões ao catálogo bibliográfico.
     */

    function enc(value) {
        return encodeURIComponent(value || '');
    }

    function isAuthorityPage() {
        return window.location.pathname.indexOf('/cgi-bin/koha/opac-authorities-home.pl') !== -1;
    }

    function authorityUrl(term) {
        return '/cgi-bin/koha/opac-authorities-home.pl'
            + '?op=do_search'
            + '&type=opac'
            + '&operator=contains'
            + '&marclist=mainentry'
            + '&and_or=and'
            + '&orderby=HeadingAsc'
            + '&value=' + enc(term || '');
    }

    function biblioUrl(term, idx) {
        return '/cgi-bin/koha/opac-search.pl'
            + '?idx=' + enc(idx || 'kw')
            + '&q=' + enc(term || '');
    }

    function addCss() {
        if (document.getElementById('nomen-auth-v03-css')) {
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
            body.nomen-auth-page form[action*="opac-authorities-home.pl"]:not(#nomen-auth-search-v03) {
                display: none !important;
            }

            body.nomen-auth-page .breadcrumb {
                display: none !important;
            }

            #nomen-auth-home-v03 {
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

            #nomen-auth-home-v03 * {
                box-sizing: border-box !important;
            }

            .nomen-v03-wrap {
                max-width: 1220px;
                margin: 0 auto;
                padding: 0 24px;
                font-family: inherit;
            }

            .nomen-v03-hero {
                display: grid;
                grid-template-columns: minmax(0, 1.1fr) minmax(320px, .9fr);
                gap: 26px;
                align-items: stretch;
            }

            .nomen-v03-card {
                background: #ffffff;
                border: 1px solid #dde2e2;
                border-radius: 22px;
                box-shadow: 0 10px 26px rgba(0,0,0,.06);
            }

            .nomen-v03-main {
                padding: 36px;
            }

            .nomen-v03-eyebrow {
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

            .nomen-v03-eyebrow:before {
                content: "";
                width: 11px;
                height: 11px;
                display: inline-block;
                border-radius: 50%;
                background: #d7ef3f;
                box-shadow: 0 0 0 4px rgba(215,239,63,.25);
            }

            .nomen-v03-title {
                margin: 0 0 14px 0;
                font-size: 56px;
                line-height: 1.02;
                font-weight: 900;
                letter-spacing: -.045em;
                color: #111111;
            }

            .nomen-v03-title span {
                color: #007f89;
            }

            .nomen-v03-intro {
                margin: 0 0 26px 0;
                max-width: 760px;
                color: #4e5659;
                font-size: 17px;
                line-height: 1.55;
            }

            /*
             * Caixa de pesquisa igual à anterior funcional:
             * seletor à esquerda, input central, botão preto à direita.
             */
            .nomen-v03-search {
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

            .nomen-v03-search select {
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

            .nomen-v03-search-field {
                position: relative;
                background: #ffffff;
            }

            .nomen-v03-search input[type="text"],
            .nomen-v03-search input[type="search"] {
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

            .nomen-v03-search input::placeholder {
                color: #6f7a80;
            }

            .nomen-v03-clear {
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

            .nomen-v03-clear:hover,
            .nomen-v03-clear:focus {
                opacity: 1;
                color: #007f89;
            }

            .nomen-v03-search button[type="submit"] {
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

            .nomen-v03-search button[type="submit"]:hover,
            .nomen-v03-search button[type="submit"]:focus {
                background: #007f89;
            }

            .nomen-v03-btn {
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

            .nomen-v03-btn:hover,
            .nomen-v03-btn:focus {
                background: #007f89;
                border-color: #007f89;
                color: #ffffff !important;
                text-decoration: none !important;
            }

            .nomen-v03-btn-light {
                background: #ffffff;
                color: #111111 !important;
                border-color: #cfd6d6;
            }

            .nomen-v03-btn-light:hover,
            .nomen-v03-btn-light:focus {
                background: #f4f5f5;
                border-color: #007f89;
                color: #007f89 !important;
            }

            .nomen-v03-examples,
            .nomen-v03-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                margin-top: 16px;
                align-items: center;
            }

            .nomen-v03-examples strong {
                color: #5f666a;
                font-size: 12px;
                letter-spacing: .08em;
                text-transform: uppercase;
                margin-right: 4px;
            }

            .nomen-v03-chip {
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

            .nomen-v03-chip:hover,
            .nomen-v03-chip:focus {
                background: #d7ef3f;
                border-color: #c8df2f;
                color: #111111 !important;
                text-decoration: none !important;
            }

            .nomen-v03-feature {
                display: grid;
                grid-template-columns: 170px minmax(0,1fr);
                overflow: hidden;
            }

            .nomen-v03-feature-img {
                display: flex;
                align-items: center;
                justify-content: center;
                background:
                    radial-gradient(circle at 40% 35%, rgba(215,239,63,.52), transparent 35%),
                    linear-gradient(135deg, #e8eeee, #ffffff);
            }

            .nomen-v03-avatar {
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

            .nomen-v03-feature-body {
                padding: 28px;
            }

            .nomen-v03-kicker {
                color: #005f66;
                font-size: 12px;
                font-weight: 900;
                letter-spacing: .08em;
                text-transform: uppercase;
                margin-bottom: 8px;
            }

            .nomen-v03-feature-title {
                margin: 0 0 8px 0;
                color: #007f89;
                font-size: 32px;
                font-weight: 900;
                letter-spacing: -.025em;
            }

            .nomen-v03-feature-text {
                color: #4e5659;
                line-height: 1.5;
                margin: 0 0 16px 0;
            }

            .nomen-v03-pills {
                display: flex;
                flex-wrap: wrap;
                gap: 7px;
                margin: 0 0 18px 0;
            }

            .nomen-v03-pill {
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

            .nomen-v03-actions {
                display: flex;
                gap: 9px;
                flex-wrap: wrap;
            }

            .nomen-v03-section {
                margin-top: 28px;
            }

            .nomen-v03-section h2 {
                margin: 0;
                font-size: 22px;
                font-weight: 900;
                color: #111111;
            }

            .nomen-v03-section p.nomen-v03-section-text {
                margin: 4px 0 14px 0;
                color: #5f666a;
                font-size: 15px;
            }

            .nomen-v03-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0,1fr));
                gap: 16px;
            }

            .nomen-v03-path {
                min-height: 170px;
                padding: 22px 20px;
                color: #111111 !important;
                text-decoration: none !important;
            }

            .nomen-v03-path:hover,
            .nomen-v03-path:focus,
            .nomen-v03-curated:hover,
            .nomen-v03-curated:focus {
                border-color: rgba(0,127,137,.42);
                box-shadow: 0 14px 30px rgba(0,0,0,.09);
                text-decoration: none !important;
            }

            .nomen-v03-icon {
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

            .nomen-v03-path h3,
            .nomen-v03-curated h3,
            .nomen-v03-info h3 {
                margin: 0 0 8px 0;
                color: #111111;
                font-size: 18px;
                font-weight: 900;
            }

            .nomen-v03-path h3 {
                color: #007f89;
            }

            .nomen-v03-path p,
            .nomen-v03-curated p,
            .nomen-v03-info p {
                margin: 0;
                color: #4e5659;
                line-height: 1.45;
                font-size: 14px;
            }

            .nomen-v03-link {
                margin-top: 14px;
                color: #005f66;
                font-weight: 900;
                font-size: 14px;
            }

            .nomen-v03-curated {
                overflow: hidden;
                color: #111111 !important;
                text-decoration: none !important;
            }

            .nomen-v03-curated-img {
                height: 92px;
                background:
                    radial-gradient(circle at 20% 30%, rgba(215,239,63,.9), transparent 28%),
                    linear-gradient(135deg, #007f89, #111111);
            }

            .nomen-v03-curated-body {
                padding: 18px;
            }

            .nomen-v03-lower {
                display: grid;
                grid-template-columns: minmax(0, 1.1fr) minmax(300px, .9fr);
                gap: 16px;
                align-items: stretch;
            }

            .nomen-v03-info {
                padding: 22px;
            }

            .nomen-v03-info-blue {
                background: #eaf7f8;
                border-color: rgba(0,127,137,.18);
            }

            .nomen-v03-mini-link {
                display: inline-flex;
                margin-top: 12px;
                color: #005f66 !important;
                font-weight: 900;
                text-decoration: none !important;
            }

            @media (max-width: 1050px) {
                .nomen-v03-hero,
                .nomen-v03-lower {
                    grid-template-columns: 1fr;
                }

                .nomen-v03-grid {
                    grid-template-columns: repeat(2, minmax(0,1fr));
                }
            }

            @media (max-width: 680px) {
                .nomen-v03-title {
                    font-size: 38px;
                }

                .nomen-v03-search {
                    grid-template-columns: 1fr;
                }

                .nomen-v03-feature {
                    grid-template-columns: 1fr;
                }

                .nomen-v03-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;

        var style = document.createElement('style');
        style.id = 'nomen-auth-v03-css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    function chipAuthority(label) {
        return '<a class="nomen-v03-chip" href="' + authorityUrl(label) + '">⌕ ' + label + '</a>';
    }

    function chipBiblio(label, idx) {
        return '<a class="nomen-v03-chip" href="' + biblioUrl(label, idx) + '">⌕ ' + label + '</a>';
    }

    function buildHtml() {
        return `
            <section id="nomen-auth-home-v03">
                <div class="nomen-v03-wrap">

                    <div class="nomen-v03-hero">

                        <div class="nomen-v03-card nomen-v03-main">
                            <div class="nomen-v03-eyebrow">Autoridades bibliográficas</div>

                            <h1 class="nomen-v03-title">
                                Descobrir <span>autores, obras e temas</span>
                            </h1>

                            <p class="nomen-v03-intro">
                                Explore o catálogo através de pessoas, obras, lugares, temas e outras entidades.
                                Cada autoridade funciona como uma porta de entrada para títulos disponíveis,
                                relações relevantes e novos percursos de leitura.
                            </p>

                            <form
                                class="nomen-v03-search"
                                id="nomen-auth-search-v03"
                                method="get"
                                action="/cgi-bin/koha/opac-authorities-home.pl"
                                role="search"
                            >
                                <input type="hidden" name="op" value="do_search">
                                <input type="hidden" name="type" value="opac">
                                <input type="hidden" name="operator" value="contains">
                                <input type="hidden" name="and_or" value="and">
                                <input type="hidden" name="orderby" value="HeadingAsc">

                                <select name="marclist" id="nomen-auth-marclist-v03" aria-label="Tipo de entidade">
                                    <option value="mainentry">Todas as entidades</option>
                                    <option value="mainentry">Autores / Pessoas</option>
                                    <option value="mainentry">Obras</option>
                                    <option value="mainentry">Assuntos</option>
                                    <option value="mainentry">Lugares</option>
                                </select>

                                <div class="nomen-v03-search-field">
                                    <input
                                        id="nomen-auth-query-v03"
                                        name="value"
                                        type="search"
                                        autocomplete="off"
                                        placeholder="Pesquisar por autor, obra, tema, lugar ou entidade..."
                                        aria-label="Pesquisar autoridades"
                                    >
                                    <button class="nomen-v03-clear" type="button" aria-label="Limpar pesquisa">×</button>
                                </div>

                                <button type="submit">Pesquisar</button>
                            </form>

                            <div class="nomen-v03-examples">
                                <strong>Exemplos</strong>
                                ${chipAuthority('Fernando Pessoa')}
                                ${chipAuthority('Sophia de Mello Breyner Andresen')}
                                ${chipAuthority('José Saramago')}
                                ${chipAuthority('Lisboa')}
                                ${chipAuthority('Modernismo')}
                            </div>
                        </div>

                        <article class="nomen-v03-card nomen-v03-feature">
                            <div class="nomen-v03-feature-img">
                                <div class="nomen-v03-avatar">FP</div>
                            </div>

                            <div class="nomen-v03-feature-body">
                                <div class="nomen-v03-kicker">Em destaque este mês</div>
                                <h2 class="nomen-v03-feature-title">Fernando Pessoa</h2>

                                <p class="nomen-v03-feature-text">
                                    Poeta, escritor e pensador central da literatura portuguesa.
                                    Explore obras, estudos críticos, heterónimos e temas relacionados disponíveis no catálogo.
                                </p>

                                <div class="nomen-v03-pills">
                                    <span class="nomen-v03-pill">Wikidata</span>
                                    <span class="nomen-v03-pill">VIAF</span>
                                    <span class="nomen-v03-pill">Wikipédia</span>
                                </div>

                                <div class="nomen-v03-actions">
                                    <a class="nomen-v03-btn nomen-v03-btn-light" href="${authorityUrl('Fernando Pessoa')}">Ver perfil</a>
                                    <a class="nomen-v03-btn" href="${biblioUrl('Fernando Pessoa', 'au')}">Explorar títulos</a>
                                </div>
                            </div>
                        </article>

                    </div>

                    <section class="nomen-v03-section">
                        <h2>Percursos de descoberta</h2>
                        <p class="nomen-v03-section-text">Entre no catálogo por pessoas, obras, temas ou lugares.</p>

                        <div class="nomen-v03-grid">
                            <a class="nomen-v03-card nomen-v03-path" href="${authorityUrl('Pessoa')}">
                                <div class="nomen-v03-icon">P</div>
                                <h3>Autores e artistas</h3>
                                <p>Conheça autores, ilustradores, tradutores, músicos e outras pessoas ligadas às obras do catálogo.</p>
                                <div class="nomen-v03-link">Explorar entidades</div>
                            </a>

                            <a class="nomen-v03-card nomen-v03-path" href="${biblioUrl('', 'ti')}">
                                <div class="nomen-v03-icon">O</div>
                                <h3>Obras e criações</h3>
                                <p>Descubra obras, títulos, edições e expressões criativas existentes nas bibliotecas.</p>
                                <div class="nomen-v03-link">Pesquisar obras</div>
                            </a>

                            <a class="nomen-v03-card nomen-v03-path" href="${authorityUrl('Poesia portuguesa')}">
                                <div class="nomen-v03-icon">T</div>
                                <h3>Temas e assuntos</h3>
                                <p>Explore ideias, géneros, movimentos e assuntos que ajudam a organizar o conhecimento.</p>
                                <div class="nomen-v03-link">Explorar temas</div>
                            </a>

                            <a class="nomen-v03-card nomen-v03-path" href="${authorityUrl('Oeiras')}">
                                <div class="nomen-v03-icon">L</div>
                                <h3>Lugares e memórias</h3>
                                <p>Viaje por cidades, territórios e lugares com presença no catálogo e na memória local.</p>
                                <div class="nomen-v03-link">Explorar lugares</div>
                            </a>
                        </div>
                    </section>

                    <section class="nomen-v03-section">
                        <h2>Percursos sugeridos</h2>
                        <p class="nomen-v03-section-text">Sugestões editoriais para começar uma exploração no catálogo.</p>

                        <div class="nomen-v03-grid">
                            <a class="nomen-v03-card nomen-v03-curated" href="${biblioUrl('Literatura portuguesa século XX', 'kw')}">
                                <div class="nomen-v03-curated-img"></div>
                                <div class="nomen-v03-curated-body">
                                    <h3>Literatura portuguesa do século XX</h3>
                                    <p>Autores, obras e movimentos que marcaram a escrita portuguesa contemporânea.</p>
                                    <div class="nomen-v03-link">Explorar</div>
                                </div>
                            </a>

                            <a class="nomen-v03-card nomen-v03-curated" href="${biblioUrl('Oeiras', 'kw')}">
                                <div class="nomen-v03-curated-img"></div>
                                <div class="nomen-v03-curated-body">
                                    <h3>Autores ligados a Oeiras</h3>
                                    <p>Pessoas, lugares e obras com ligação ao território e à memória local.</p>
                                    <div class="nomen-v03-link">Explorar</div>
                                </div>
                            </a>

                            <a class="nomen-v03-card nomen-v03-curated" href="${biblioUrl('Lisboa literatura', 'kw')}">
                                <div class="nomen-v03-curated-img"></div>
                                <div class="nomen-v03-curated-body">
                                    <h3>Lisboa literária</h3>
                                    <p>Percorra a cidade através de livros, autores, bairros, memórias e personagens.</p>
                                    <div class="nomen-v03-link">Explorar</div>
                                </div>
                            </a>

                            <a class="nomen-v03-card nomen-v03-curated" href="${biblioUrl('cinema literatura adaptação', 'kw')}">
                                <div class="nomen-v03-curated-img"></div>
                                <div class="nomen-v03-curated-body">
                                    <h3>Do livro ao cinema</h3>
                                    <p>Obras literárias, adaptações cinematográficas e relações entre leitura e imagem.</p>
                                    <div class="nomen-v03-link">Explorar</div>
                                </div>
                            </a>
                        </div>
                    </section>

                    <section class="nomen-v03-section nomen-v03-lower">
                        <div class="nomen-v03-card nomen-v03-info">
                            <h3>Comece por aqui</h3>
                            <p>Alguns pontos de entrada para explorar autores, obras, temas e relações no catálogo.</p>

                            <div class="nomen-v03-chips">
                                ${chipBiblio('Fernando Pessoa', 'au')}
                                ${chipBiblio('Sophia de Mello Breyner Andresen', 'au')}
                                ${chipBiblio('José Saramago', 'au')}
                                ${chipBiblio('Os Lusíadas', 'ti')}
                                ${chipBiblio('Modernismo', 'su')}
                                ${chipBiblio('Poesia portuguesa', 'su')}
                                ${chipBiblio('Lisboa', 'su')}
                            </div>
                        </div>

                        <aside class="nomen-v03-card nomen-v03-info nomen-v03-info-blue">
                            <h3>O que são autoridades?</h3>
                            <p>
                                As autoridades bibliográficas reúnem diferentes formas de nomear uma pessoa,
                                obra, tema ou lugar. Nesta página, usamos essas entidades para facilitar
                                a descoberta dos títulos existentes no catálogo.
                            </p>

                            <a class="nomen-v03-mini-link" href="${authorityUrl('Fernando Pessoa')}">Ver exemplo de autoridade</a>
                        </aside>
                    </section>

                </div>
            </section>
        `;
    }

    function insertHome() {
        if (document.getElementById('nomen-auth-home-v03')) {
            return;
        }

        var temp = document.createElement('div');
        temp.innerHTML = buildHtml();

        var block = temp.firstElementChild;

        var headerRegion = document.getElementById('header-region');
        var wrapper = document.getElementById('wrapper');

        if (headerRegion && headerRegion.parentNode) {
            headerRegion.parentNode.insertBefore(block, headerRegion.nextSibling);
            return;
        }

        if (wrapper && wrapper.parentNode) {
            wrapper.parentNode.insertBefore(block, wrapper);
            return;
        }

        document.body.insertBefore(block, document.body.firstChild);
    }

    function bindSearchEnhancements() {
        var input = document.getElementById('nomen-auth-query-v03');
        var clear = document.querySelector('.nomen-v03-clear');

        if (input && clear && clear.getAttribute('data-bound') !== '1') {
            clear.setAttribute('data-bound', '1');

            clear.addEventListener('click', function () {
                input.value = '';
                input.focus();
            });
        }
    }

    function hideNativeElements() {
        if (!document.getElementById('nomen-auth-home-v03')) {
            return;
        }

        var selectors = [
            '#opac-main-search',
            '#moresearches',
            '#userauthhome',
            'form#auth_search',
            'form[name="f"]',
            'form[action*="opac-authorities-home.pl"]:not(#nomen-auth-search-v03)'
        ];

        selectors.forEach(function (selector) {
            var nodes = document.querySelectorAll(selector);

            nodes.forEach(function (node) {
                if (!node.closest('#nomen-auth-home-v03')) {
                    node.style.display = 'none';
                }
            });
        });
    }

    function init() {
        if (!isAuthorityPage()) {
            return;
        }

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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
