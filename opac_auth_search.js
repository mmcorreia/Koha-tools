(function () {
    'use strict';

    /*
     * N●MEN OPAC
     * Página inicial de pesquisa e descoberta de autoridades
     * Versão simplificada e segura
     *
     * Esta versão:
     * 1. Só corre em opac-authorities-home.pl
     * 2. Insere o bloco N●MEN fora da área nativa do Koha
     * 3. Não esconde contentores estruturais
     * 4. Mantém ligações à pesquisa de autoridades e ao catálogo bibliográfico
     */

    var NOMEN_DEBUG = true;

    function log(msg) {
        if (NOMEN_DEBUG && window.console) {
            console.log('[NOMEN OPAC]', msg);
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
        if (document.getElementById('nomen-authority-home-css')) {
            return;
        }

        var css = [
            'body.nomen-authority-page {',
            '    background: #f4f5f5 !important;',
            '}',

            '#nomen-authority-home-root {',
            '    display: block !important;',
            '    width: 100%;',
            '    background: #f4f5f5;',
            '    padding: 24px 0 56px 0;',
            '    box-sizing: border-box;',
            '}',

            '#nomen-authority-home-root * {',
            '    box-sizing: border-box;',
            '}',

            '.nomen-wrap {',
            '    max-width: 1220px;',
            '    margin: 0 auto;',
            '    padding: 0 18px;',
            '    color: #111111;',
            '    font-family: inherit;',
            '}',

            '.nomen-hero {',
            '    display: grid;',
            '    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);',
            '    gap: 26px;',
            '    align-items: stretch;',
            '}',

            '.nomen-card {',
            '    background: #ffffff;',
            '    border: 1px solid #dde2e2;',
            '    border-radius: 22px;',
            '    box-shadow: 0 10px 26px rgba(0, 0, 0, 0.06);',
            '}',

            '.nomen-main-card {',
            '    padding: 34px 36px 32px 36px;',
            '}',

            '.nomen-eyebrow {',
            '    display: inline-flex;',
            '    align-items: center;',
            '    gap: 9px;',
            '    margin-bottom: 14px;',
            '    font-size: 12px;',
            '    font-weight: 800;',
            '    letter-spacing: 0.08em;',
            '    text-transform: uppercase;',
            '    color: #005f66;',
            '}',

            '.nomen-eyebrow:before {',
            '    content: "";',
            '    display: inline-block;',
            '    width: 11px;',
            '    height: 11px;',
            '    border-radius: 50%;',
            '    background: #d7ef3f;',
            '    box-shadow: 0 0 0 4px rgba(215, 239, 63, 0.25);',
            '}',

            '.nomen-title {',
            '    margin: 0 0 14px 0;',
            '    font-size: 54px;',
            '    line-height: 1.02;',
            '    font-weight: 900;',
            '    letter-spacing: -0.045em;',
            '    color: #111111;',
            '}',

            '.nomen-title span {',
            '    color: #007f89;',
            '}',

            '.nomen-intro {',
            '    max-width: 760px;',
            '    margin: 0 0 26px 0;',
            '    color: #4e5659;',
            '    font-size: 17px;',
            '    line-height: 1.55;',
            '}',

            '.nomen-search {',
            '    display: grid;',
            '    grid-template-columns: 210px minmax(0, 1fr) 136px;',
            '    gap: 10px;',
            '    align-items: center;',
            '    padding: 10px;',
            '    background: #f4f5f5;',
            '    border: 1px solid #d8dddd;',
            '    border-radius: 18px;',
            '}',

            '.nomen-search select,',
            '.nomen-search input {',
            '    width: 100%;',
            '    height: 48px;',
            '    border: 1px solid #cfd6d6;',
            '    border-radius: 13px;',
            '    padding: 0 15px;',
            '    font-size: 15px;',
            '    background: #ffffff;',
            '    color: #111111;',
            '    outline: none;',
            '}',

            '.nomen-search select {',
            '    background: #d7ef3f;',
            '    border-color: #c9de3a;',
            '    font-weight: 800;',
            '    cursor: pointer;',
            '}',

            '.nomen-search input:focus {',
            '    border-color: #007f89;',
            '    box-shadow: 0 0 0 3px rgba(0, 127, 137, 0.14);',
            '}',

            '.nomen-btn {',
            '    display: inline-flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '    min-height: 46px;',
            '    border-radius: 13px;',
            '    padding: 0 18px;',
            '    border: 1px solid #111111;',
            '    background: #111111;',
            '    color: #ffffff !important;',
            '    font-weight: 800;',
            '    text-decoration: none !important;',
            '    cursor: pointer;',
            '}',

            '.nomen-btn:hover,',
            '.nomen-btn:focus {',
            '    background: #007f89;',
            '    border-color: #007f89;',
            '    color: #ffffff !important;',
            '    text-decoration: none !important;',
            '}',

            '.nomen-btn-light {',
            '    background: #ffffff;',
            '    color: #111111 !important;',
            '    border-color: #cfd6d6;',
            '}',

            '.nomen-btn-light:hover,',
            '.nomen-btn-light:focus {',
            '    background: #f4f5f5;',
            '    border-color: #007f89;',
            '    color: #007f89 !important;',
            '}',

            '.nomen-examples,',
            '.nomen-chip-list {',
            '    display: flex;',
            '    flex-wrap: wrap;',
            '    gap: 8px;',
            '    margin-top: 16px;',
            '    align-items: center;',
            '}',

            '.nomen-examples strong {',
            '    margin-right: 4px;',
            '    font-size: 12px;',
            '    letter-spacing: 0.08em;',
            '    text-transform: uppercase;',
            '    color: #5f666a;',
            '}',

            '.nomen-chip {',
            '    display: inline-flex;',
            '    align-items: center;',
            '    border: 1px solid #d5dddd;',
            '    background: #ffffff;',
            '    color: #005f66 !important;',
            '    border-radius: 999px;',
            '    padding: 8px 12px;',
            '    font-size: 14px;',
            '    font-weight: 700;',
            '    text-decoration: none !important;',
            '    line-height: 1;',
            '}',

            '.nomen-chip:hover,',
            '.nomen-chip:focus {',
            '    background: #d7ef3f;',
            '    border-color: #c8df2f;',
            '    color: #111111 !important;',
            '    text-decoration: none !important;',
            '}',

            '.nomen-feature {',
            '    overflow: hidden;',
            '    display: grid;',
            '    grid-template-columns: 170px minmax(0, 1fr);',
            '}',

            '.nomen-feature-image {',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '    padding: 24px;',
            '    background: radial-gradient(circle at 40% 35%, rgba(215,239,63,0.52), transparent 35%), linear-gradient(135deg, #e8eeee, #ffffff);',
            '}',

            '.nomen-portrait {',
            '    width: 126px;',
            '    height: 126px;',
            '    border-radius: 50%;',
            '    background: #111111;',
            '    color: #d7ef3f;',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '    font-size: 48px;',
            '    font-weight: 900;',
            '    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.16);',
            '}',

            '.nomen-feature-content {',
            '    padding: 28px 28px 26px 28px;',
            '}',

            '.nomen-kicker {',
            '    color: #005f66;',
            '    font-size: 12px;',
            '    font-weight: 900;',
            '    letter-spacing: 0.08em;',
            '    text-transform: uppercase;',
            '    margin-bottom: 8px;',
            '}',

            '.nomen-feature-title {',
            '    margin: 0 0 8px 0;',
            '    color: #007f89;',
            '    font-size: 32px;',
            '    font-weight: 900;',
            '    letter-spacing: -0.025em;',
            '}',

            '.nomen-feature-text {',
            '    color: #4e5659;',
            '    line-height: 1.5;',
            '    margin: 0 0 14px 0;',
            '}',

            '.nomen-pill-list {',
            '    display: flex;',
            '    flex-wrap: wrap;',
            '    gap: 7px;',
            '    margin: 14px 0 18px 0;',
            '}',

            '.nomen-pill {',
            '    display: inline-flex;',
            '    align-items: center;',
            '    border: 1px solid rgba(0, 127, 137, 0.25);',
            '    color: #005f66;',
            '    background: rgba(0, 127, 137, 0.06);',
            '    border-radius: 999px;',
            '    padding: 5px 9px;',
            '    font-size: 12px;',
            '    font-weight: 800;',
            '}',

            '.nomen-actions {',
            '    display: flex;',
            '    flex-wrap: wrap;',
            '    gap: 9px;',
            '}',

            '.nomen-section {',
            '    margin-top: 28px;',
            '}',

            '.nomen-section-title {',
            '    margin: 0;',
            '    font-size: 22px;',
            '    font-weight: 900;',
            '    letter-spacing: -0.02em;',
            '    color: #111111;',
            '}',

            '.nomen-section-text {',
            '    margin: 4px 0 14px 0;',
            '    color: #5f666a;',
            '    font-size: 15px;',
            '}',

            '.nomen-grid-4 {',
            '    display: grid;',
            '    grid-template-columns: repeat(4, minmax(0, 1fr));',
            '    gap: 16px;',
            '}',

            '.nomen-path-card {',
            '    padding: 22px 20px;',
            '    min-height: 178px;',
            '    display: flex;',
            '    flex-direction: column;',
            '    justify-content: space-between;',
            '    text-decoration: none !important;',
            '    color: #111111 !important;',
            '}',

            '.nomen-path-card:hover,',
            '.nomen-curated-card:hover {',
            '    border-color: rgba(0, 127, 137, 0.42);',
            '    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.09);',
            '    text-decoration: none !important;',
            '}',

            '.nomen-icon {',
            '    width: 44px;',
            '    height: 44px;',
            '    border-radius: 15px;',
            '    background: #d7ef3f;',
            '    color: #111111;',
            '    display: flex;',
            '    align-items: center;',
            '    justify-content: center;',
            '    font-size: 22px;',
            '    margin-bottom: 14px;',
            '}',

            '.nomen-path-card h3,',
            '.nomen-curated-card h3,',
            '.nomen-start h3,',
            '.nomen-info h3 {',
            '    margin: 0 0 8px 0;',
            '    color: #111111;',
            '    font-size: 18px;',
            '    font-weight: 900;',
            '}',

            '.nomen-path-card h3 {',
            '    color: #007f89;',
            '}',

            '.nomen-path-card p,',
            '.nomen-curated-card p,',
            '.nomen-start p,',
            '.nomen-info p {',
            '    margin: 0;',
            '    color: #4e5659;',
            '    line-height: 1.45;',
            '    font-size: 14px;',
            '}',

            '.nomen-card-link {',
            '    margin-top: 16px;',
            '    color: #005f66;',
            '    font-weight: 900;',
            '    font-size: 14px;',
            '}',

            '.nomen-curated-card {',
            '    overflow: hidden;',
            '    text-decoration: none !important;',
            '    color: #111111 !important;',
            '}',

            '.nomen-curated-visual {',
            '    height: 92px;',
            '    background: radial-gradient(circle at 20% 30%, rgba(215,239,63,0.9), transparent 28%), linear-gradient(135deg, #007f89, #111111);',
            '}',

            '.nomen-curated-body {',
            '    padding: 18px 18px 20px 18px;',
            '}',

            '.nomen-lower {',
            '    display: grid;',
            '    grid-template-columns: minmax(0, 1.1fr) minmax(300px, 0.9fr);',
            '    gap: 16px;',
            '    align-items: stretch;',
            '}',

            '.nomen-start,',
            '.nomen-info {',
            '    padding: 22px;',
            '}',

            '.nomen-info {',
            '    background: #eaf7f8;',
            '    border-color: rgba(0, 127, 137, 0.18);',
            '}',

            '.nomen-mini-link {',
            '    display: inline-flex;',
            '    margin-top: 12px;',
            '    color: #005f66 !important;',
            '    font-weight: 900;',
            '    text-decoration: none !important;',
            '}',

            '@media (max-width: 1050px) {',
            '    .nomen-hero, .nomen-lower {',
            '        grid-template-columns: 1fr;',
            '    }',
            '',
            '    .nomen-grid-4 {',
            '        grid-template-columns: repeat(2, minmax(0, 1fr));',
            '    }',
            '}',

            '@media (max-width: 680px) {',
            '    .nomen-main-card, .nomen-feature-content {',
            '        padding: 24px 20px;',
            '    }',
            '',
            '    .nomen-title {',
            '        font-size: 38px;',
            '    }',
            '',
            '    .nomen-search {',
            '        grid-template-columns: 1fr;',
            '    }',
            '',
            '    .nomen-feature {',
            '        grid-template-columns: 1fr;',
            '    }',
            '',
            '    .nomen-feature-image {',
            '        min-height: 170px;',
            '    }',
            '',
            '    .nomen-grid-4 {',
            '        grid-template-columns: 1fr;',
            '    }',
            '}'
        ].join('\n');

        var style = document.createElement('style');
        style.id = 'nomen-authority-home-css';
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);

        log('CSS inserido.');
    }

    function chipAuthority(label) {
        return '<a class="nomen-chip" href="' + authoritySearchUrl(label) + '">⌕ ' + label + '</a>';
    }

    function chipBiblio(label, idx) {
        return '<a class="nomen-chip" href="' + biblioSearchUrl(label, idx) + '">⌕ ' + label + '</a>';
    }

    function buildHtml() {
        return [
            '<div id="nomen-authority-home-root">',
            '    <div class="nomen-wrap">',

            '        <div class="nomen-hero">',

            '            <div class="nomen-card nomen-main-card">',
            '                <div class="nomen-eyebrow">Autoridades bibliográficas</div>',
            '                <h1 class="nomen-title">Descobrir <span>autores, obras e temas</span></h1>',
            '                <p class="nomen-intro">',
            '                    Explore o catálogo através de pessoas, obras, lugares, temas e outras entidades.',
            '                    Cada autoridade funciona como uma porta de entrada para títulos disponíveis,',
            '                    relações relevantes e novos percursos de leitura.',
            '                </p>',

            '                <form class="nomen-search" id="nomen-authority-search-form" role="search">',
            '                    <select id="nomen-authority-type" aria-label="Tipo de pesquisa">',
            '                        <option value="mainentry">Todas as entidades</option>',
            '                        <option value="mainentry">Nome da entidade</option>',
            '                    </select>',
            '                    <input id="nomen-authority-query" type="search" autocomplete="off" placeholder="Pesquisar por autor, obra, tema, lugar ou entidade" aria-label="Pesquisar autoridades">',
            '                    <button class="nomen-btn" type="submit">Pesquisar</button>',
            '                </form>',

            '                <div class="nomen-examples">',
            '                    <strong>Exemplos</strong>',
            '                    ' + chipAuthority('Fernando Pessoa'),
            '                    ' + chipAuthority('Sophia de Mello Breyner Andresen'),
            '                    ' + chipAuthority('José Saramago'),
            '                    ' + chipAuthority('Lisboa'),
            '                    ' + chipAuthority('Modernismo'),
            '                </div>',
            '            </div>',

            '            <article class="nomen-card nomen-feature">',
            '                <div class="nomen-feature-image" aria-hidden="true">',
            '                    <div class="nomen-portrait">FP</div>',
            '                </div>',
            '                <div class="nomen-feature-content">',
            '                    <div class="nomen-kicker">Em destaque este mês</div>',
            '                    <h2 class="nomen-feature-title">Fernando Pessoa</h2>',
            '                    <p class="nomen-feature-text">',
            '                        Poeta, escritor e pensador central da literatura portuguesa.',
            '                        Explore obras, estudos críticos, heterónimos e temas relacionados disponíveis no catálogo.',
            '                    </p>',
            '                    <div class="nomen-pill-list">',
            '                        <span class="nomen-pill">Wikidata</span>',
            '                        <span class="nomen-pill">VIAF</span>',
            '                        <span class="nomen-pill">Wikipédia</span>',
            '                    </div>',
            '                    <div class="nomen-actions">',
            '                        <a class="nomen-btn nomen-btn-light" href="' + authoritySearchUrl('Fernando Pessoa') + '">Ver perfil</a>',
            '                        <a class="nomen-btn" href="' + biblioSearchUrl('Fernando Pessoa', 'au') + '">Explorar títulos</a>',
            '                    </div>',
            '                </div>',
            '            </article>',

            '        </div>',

            '        <section class="nomen-section">',
            '            <h2 class="nomen-section-title">Percursos de descoberta</h2>',
            '            <p class="nomen-section-text">Entre no catálogo por pessoas, obras, temas ou lugares.</p>',

            '            <div class="nomen-grid-4">',
            '                <a class="nomen-card nomen-path-card" href="' + authoritySearchUrl('Pessoa') + '">',
            '                    <div>',
            '                        <div class="nomen-icon">P</div>',
            '                        <h3>Autores e artistas</h3>',
            '                        <p>Conheça autores, ilustradores, tradutores, músicos e outras pessoas ligadas às obras do catálogo.</p>',
            '                    </div>',
            '                    <div class="nomen-card-link">Explorar entidades</div>',
            '                </a>',

            '                <a class="nomen-card nomen-path-card" href="' + biblioSearchUrl('', 'ti') + '">',
            '                    <div>',
            '                        <div class="nomen-icon">O</div>',
            '                        <h3>Obras e criações</h3>',
            '                        <p>Descubra obras, títulos, edições e expressões criativas existentes nas bibliotecas.</p>',
            '                    </div>',
            '                    <div class="nomen-card-link">Pesquisar obras</div>',
            '                </a>',

            '                <a class="nomen-card nomen-path-card" href="' + authoritySearchUrl('Poesia portuguesa') + '">',
            '                    <div>',
            '                        <div class="nomen-icon">T</div>',
            '                        <h3>Temas e assuntos</h3>',
            '                        <p>Explore ideias, géneros, movimentos e assuntos que ajudam a organizar o conhecimento.</p>',
            '                    </div>',
            '                    <div class="nomen-card-link">Explorar temas</div>',
            '                </a>',

            '                <a class="nomen-card nomen-path-card" href="' + authoritySearchUrl('Oeiras') + '">',
            '                    <div>',
            '                        <div class="nomen-icon">L</div>',
            '                        <h3>Lugares e memórias</h3>',
            '                        <p>Viaje por cidades, territórios e lugares com presença no catálogo e na memória local.</p>',
            '                    </div>',
            '                    <div class="nomen-card-link">Explorar lugares</div>',
            '                </a>',
            '            </div>',
            '        </section>',

            '        <section class="nomen-section">',
            '            <h2 class="nomen-section-title">Percursos sugeridos</h2>',
            '            <p class="nomen-section-text">Sugestões editoriais para começar uma exploração no catálogo.</p>',

            '            <div class="nomen-grid-4">',
            '                <a class="nomen-card nomen-curated-card" href="' + biblioSearchUrl('Literatura portuguesa século XX', 'kw') + '">',
            '                    <div class="nomen-curated-visual"></div>',
            '                    <div class="nomen-curated-body">',
            '                        <h3>Literatura portuguesa do século XX</h3>',
            '                        <p>Autores, obras e movimentos que marcaram a escrita portuguesa contemporânea.</p>',
            '                        <div class="nomen-card-link">Explorar</div>',
            '                    </div>',
            '                </a>',

            '                <a class="nomen-card nomen-curated-card" href="' + biblioSearchUrl('Oeiras', 'kw') + '">',
            '                    <div class="nomen-curated-visual"></div>',
            '                    <div class="nomen-curated-body">',
            '                        <h3>Autores ligados a Oeiras</h3>',
            '                        <p>Pessoas, lugares e obras com ligação ao território e à memória local.</p>',
            '                        <div class="nomen-card-link">Explorar</div>',
            '                    </div>',
            '                </a>',

            '                <a class="nomen-card nomen-curated-card" href="' + biblioSearchUrl('Lisboa literatura', 'kw') + '">',
            '                    <div class="nomen-curated-visual"></div>',
            '                    <div class="nomen-curated-body">',
            '                        <h3>Lisboa literária</h3>',
            '                        <p>Percorra a cidade através de livros, autores, bairros, memórias e personagens.</p>',
            '                        <div class="nomen-card-link">Explorar</div>',
            '                    </div>',
            '                </a>',

            '                <a class="nomen-card nomen-curated-card" href="' + biblioSearchUrl('cinema literatura adaptação', 'kw') + '">',
            '                    <div class="nomen-curated-visual"></div>',
            '                    <div class="nomen-curated-body">',
            '                        <h3>Do livro ao cinema</h3>',
            '                        <p>Obras literárias, adaptações cinematográficas e relações entre leitura e imagem.</p>',
            '                        <div class="nomen-card-link">Explorar</div>',
            '                    </div>',
            '                </a>',
            '            </div>',
            '        </section>',

            '        <section class="nomen-section nomen-lower">',
            '            <div class="nomen-card nomen-start">',
            '                <h3>Comece por aqui</h3>',
            '                <p>Alguns pontos de entrada para explorar autores, obras, temas e relações no catálogo.</p>',
            '                <div class="nomen-chip-list">',
            '                    ' + chipBiblio('Fernando Pessoa', 'au'),
            '                    ' + chipBiblio('Sophia de Mello Breyner Andresen', 'au'),
            '                    ' + chipBiblio('José Saramago', 'au'),
            '                    ' + chipBiblio('Os Lusíadas', 'ti'),
            '                    ' + chipBiblio('Modernismo', 'su'),
            '                    ' + chipBiblio('Poesia portuguesa', 'su'),
            '                    ' + chipBiblio('Lisboa', 'su'),
            '                </div>',
            '            </div>',

            '            <aside class="nomen-card nomen-info">',
            '                <h3>O que são autoridades?</h3>',
            '                <p>',
            '                    As autoridades bibliográficas reúnem diferentes formas de nomear uma pessoa, obra, tema ou lugar.',
            '                    Nesta página, usamos essas entidades para facilitar a descoberta dos títulos existentes no catálogo.',
            '                </p>',
            '                <a class="nomen-mini-link" href="' + authoritySearchUrl('Fernando Pessoa') + '">Ver exemplo de autoridade</a>',
            '            </aside>',
            '        </section>',

            '    </div>',
            '</div>'
        ].join('\n');
    }

    function findInsertionPoint() {
        /*
         * Inserir fora da zona de conteúdo do Koha.
         * Preferência: depois do cabeçalho customizado ou depois do header-region.
         */

        var customHeader = document.getElementById('rbmo-custom-header');
        if (customHeader && customHeader.parentNode) {
            return {
                parent: customHeader.parentNode,
                before: customHeader.nextSibling
            };
        }

        var headerRegion = document.getElementById('header-region');
        if (headerRegion && headerRegion.parentNode) {
            return {
                parent: headerRegion.parentNode,
                before: headerRegion.nextSibling
            };
        }

        var wrapper = document.getElementById('wrapper');
        if (wrapper && wrapper.parentNode) {
            return {
                parent: wrapper.parentNode,
                before: wrapper
            };
        }

        return {
            parent: document.body,
            before: document.body.firstChild
        };
    }

    function insertNomenHome() {
        if (document.getElementById('nomen-authority-home-root')) {
            log('Bloco N●MEN já existe.');
            return;
        }

        var point = findInsertionPoint();
        var temp = document.createElement('div');

        temp.innerHTML = buildHtml();

        point.parent.insertBefore(temp.firstChild, point.before);

        log('Bloco N●MEN inserido.');
    }

    function hideNativeAuthoritySearch() {
        /*
         * Só escondemos depois de confirmar que o bloco N●MEN existe.
         * Não se escondem contentores estruturais.
         */

        if (!document.getElementById('nomen-authority-home-root')) {
            log('Bloco N●MEN não encontrado. Não vou esconder elementos nativos.');
            return;
        }

        var selectors = [
            '#opac-main-search',
            '#moresearches',
            '#userauthhome',
            'form#auth_search',
            'form[name="f"]'
        ];

        selectors.forEach(function (selector) {
            var nodes = document.querySelectorAll(selector);

            Array.prototype.forEach.call(nodes, function (node) {
                if (!node.closest('#nomen-authority-home-root')) {
                    node.style.display = 'none';
                }
            });
        });

        log('Elementos nativos escondidos.');
    }

    function bindSearch() {
        var form = document.getElementById('nomen-authority-search-form');
        var input = document.getElementById('nomen-authority-query');

        if (!form || !input) {
            log('Formulário N●MEN não encontrado.');
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

        log('Pesquisa N●MEN ligada.');
    }

    function init() {
        if (!isAuthorityHomePage()) {
            log('Não é a página de autoridades. Script não executado.');
            return;
        }

        document.body.className += ' nomen-authority-page';

        addStyles();
        insertNomenHome();
        bindSearch();

        /*
         * Esconder elementos nativos com atraso curto.
         * Isto evita que o Koha apague/reestruture a página antes de inserirmos o N●MEN.
         */
        window.setTimeout(function () {
            hideNativeAuthoritySearch();
            bindSearch();
        }, 300);

        window.setTimeout(function () {
            insertNomenHome();
            hideNativeAuthoritySearch();
            bindSearch();
        }, 1200);

        log('N●MEN Authority Home inicializado.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
