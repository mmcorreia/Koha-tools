/* ============================================================
   N●MEN, OPAC, Pesquisa pública de entidades
   Transformação da página clássica de autoridades do Koha
   Página alvo: /cgi-bin/koha/opac-authorities-home.pl
   Versão: 1.3
   Compatível com OPACUserJS e $.getScript()
   ============================================================ */

(function () {
    'use strict';

    function initNomenAuthoritySearch() {

        var pathname = window.location.pathname || '';

        if (pathname.indexOf('/cgi-bin/koha/opac-authorities-home.pl') === -1) {
            return;
        }

        if (document.body.classList.contains('nomen-authorities-page-loaded')) {
            return;
        }

        document.body.classList.add('nomen-authorities-page-loaded');

        console.log('[NOMEN] A iniciar transformação da pesquisa de autoridades.');

        var NOMEN_CONFIG = {
            titulo: 'Explorar entidades do catálogo',
            subtitulo: 'Pesquise pessoas, autores, assuntos, obras, coletividades e lugares usados para organizar o catálogo.',
            placeholder: 'Pesquisar por pessoa, autor, assunto, obra, lugar ou entidade...',
            etiqueta: 'Catálogo de entidades',
            nota: 'A pesquisa é feita nas autoridades bibliográficas do catálogo. Os resultados mantêm a ligação aos registos bibliográficos associados quando existirem.'
        };

        function escapeHTML(value) {
            return String(value || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function normalizeText(value) {
            return String(value || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function makeInitials(text) {
            return String(text || '')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map(function (part) {
                    return part.charAt(0).toUpperCase();
                })
                .join('');
        }

        function findAuthorityForm() {
            var forms = Array.prototype.slice.call(document.querySelectorAll('form'));

            var candidates = forms.filter(function (form) {
                var action = form.getAttribute('action') || '';
                var hasAuthorityAction = action.indexOf('opac-authorities-home.pl') !== -1;
                var hasValueInput = !!form.querySelector('input[name="value"], input[name="marclist"], input[name="operator"], input[name="orderby"]');
                var hasAuthoritySelect = !!form.querySelector('select[name="authtypecode"], select[name="authtype"]');

                return hasAuthorityAction || hasValueInput || hasAuthoritySelect;
            });

            if (candidates.length) {
                return candidates[0];
            }

            return null;
        }

        var originalForm = findAuthorityForm();

        if (!originalForm) {
            console.warn('[NOMEN] Não foi encontrado o formulário de pesquisa de autoridades.');
            return;
        }

        console.log('[NOMEN] Formulário de autoridades encontrado:', originalForm);

        function findMainContainer() {
            return (
                document.querySelector('#userauthhome') ||
                originalForm.closest('#userauthhome') ||
                originalForm.closest('.maincontent') ||
                originalForm.closest('#maincontent') ||
                originalForm.closest('main') ||
                originalForm.parentElement
            );
        }

        var originalContainer = findMainContainer();

        if (!originalContainer || !originalContainer.parentElement) {
            console.warn('[NOMEN] Não foi encontrado o contentor principal da página de autoridades.');
            return;
        }

        function getTextInput() {
            return (
                originalForm.querySelector('input[name="value"]') ||
                originalForm.querySelector('input[type="text"]') ||
                originalForm.querySelector('input[type="search"]')
            );
        }

        function getAuthorityTypeSelect() {
            return (
                originalForm.querySelector('select[name="authtypecode"]') ||
                originalForm.querySelector('select[name="authtype"]')
            );
        }

        function getAuthorityOptions() {
            var select = getAuthorityTypeSelect();
            var options = [];

            if (!select) {
                return options;
            }

            Array.prototype.forEach.call(select.options, function (option) {
                var label = (option.textContent || '').replace(/\s+/g, ' ').trim();
                var value = option.value || '';

                if (!label) {
                    return;
                }

                options.push({
                    value: value,
                    originalLabel: label,
                    publicLabel: publicAuthorityLabel(label),
                    description: publicAuthorityDescription(label)
                });
            });

            return options;
        }

        function publicAuthorityLabel(label) {
            var n = normalizeText(label);

            if (n.indexOf('pessoa') !== -1 || n.indexOf('nome pessoal') !== -1 || n.indexOf('personal') !== -1 || n.indexOf('autor') !== -1) {
                return 'Pessoas';
            }

            if (n.indexOf('assunto') !== -1 || n.indexOf('topico') !== -1 || n.indexOf('topic') !== -1 || n.indexOf('termo') !== -1) {
                return 'Assuntos';
            }

            if (n.indexOf('coletividade') !== -1 || n.indexOf('colectividade') !== -1 || n.indexOf('corpor') !== -1 || n.indexOf('institu') !== -1) {
                return 'Coletividades';
            }

            if (n.indexOf('titulo') !== -1 || n.indexOf('title') !== -1 || n.indexOf('obra') !== -1) {
                return 'Obras';
            }

            if (n.indexOf('geograf') !== -1 || n.indexOf('geographic') !== -1 || n.indexOf('lugar') !== -1) {
                return 'Lugares';
            }

            if (n.indexOf('famil') !== -1 || n.indexOf('family') !== -1) {
                return 'Famílias';
            }

            return label;
        }

        function publicAuthorityDescription(label) {
            var p = publicAuthorityLabel(label);

            if (p === 'Pessoas') {
                return 'Autores, personalidades e nomes pessoais';
            }

            if (p === 'Assuntos') {
                return 'Temas, tópicos e conceitos';
            }

            if (p === 'Coletividades') {
                return 'Instituições, grupos e organizações';
            }

            if (p === 'Obras') {
                return 'Títulos, obras e expressões';
            }

            if (p === 'Lugares') {
                return 'Cidades, países e espaços geográficos';
            }

            if (p === 'Famílias') {
                return 'Famílias e linhagens';
            }

            return 'Tipo de autoridade existente no catálogo';
        }

        function uniqueAuthorityOptions(options) {
            var seen = {};
            var result = [];

            options.forEach(function (option) {
                var key = option.publicLabel;

                if (seen[key]) {
                    return;
                }

                seen[key] = true;
                result.push(option);
            });

            return result;
        }

        function setAuthorityType(value) {
            var select = getAuthorityTypeSelect();

            if (!select) {
                return;
            }

            if (value === null || value === undefined || value === '') {
                select.selectedIndex = 0;
                return;
            }

            select.value = value;
        }

        function submitAuthoritySearch(term, typeValue) {
            var cleanTerm = String(term || '').trim();

            if (!cleanTerm) {
                return;
            }

            var textInput = getTextInput();

            if (!textInput) {
                console.warn('[NOMEN] Não foi encontrado o campo de texto da pesquisa de autoridades.');
                return;
            }

            textInput.value = cleanTerm;

            if (typeValue !== undefined && typeValue !== null) {
                setAuthorityType(typeValue);
            }

            console.log('[NOMEN] A submeter pesquisa de autoridade:', cleanTerm, typeValue || '');

            if (typeof originalForm.requestSubmit === 'function') {
                originalForm.requestSubmit();
            } else {
                originalForm.submit();
            }
        }

        function addCSS() {
            var css = `
                body.nomen-authorities-page-loaded #opac-main-search,
                body.nomen-authorities-page-loaded .mastheadsearch,
                body.nomen-authorities-page-loaded #moresearches {
                    display: none !important;
                }

                .nomen-authority-old-interface {
                    display: none !important;
                }

                .nomen-advanced-open .nomen-authority-old-interface {
                    display: block !important;
                }

                .nomen-page {
                    max-width: 1180px;
                    margin: 0 auto 48px auto;
                    padding: 22px 20px 44px 20px;
                    color: #17212b;
                }

                .nomen-hero {
                    background: #ffffff;
                    border: 1px solid #e5e8eb;
                    border-radius: 18px;
                    padding: 34px 38px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.045);
                    margin-bottom: 28px;
                }

                .nomen-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.78rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: #4d5b66;
                    margin-bottom: 14px;
                }

                .nomen-label-dot {
                    width: 9px;
                    height: 9px;
                    border-radius: 50%;
                    background: #d7df2f;
                    display: inline-block;
                }

                .nomen-title {
                    font-size: 2.25rem;
                    line-height: 1.15;
                    margin: 0 0 10px 0;
                    font-weight: 800;
                    color: #17212b;
                }

                .nomen-subtitle {
                    font-size: 1.05rem;
                    line-height: 1.55;
                    color: #56636f;
                    max-width: 800px;
                    margin: 0 0 28px 0;
                }

                .nomen-search-panel {
                    position: relative;
                }

                .nomen-search-box {
                    display: flex;
                    align-items: stretch;
                    border: 2px solid #d7df2f;
                    border-radius: 12px;
                    overflow: hidden;
                    background: #ffffff;
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
                }

                .nomen-search-input {
                    flex: 1;
                    border: 0 !important;
                    box-shadow: none !important;
                    padding: 18px 20px !important;
                    font-size: 1.05rem !important;
                    min-height: 58px;
                    color: #17212b;
                    background: #ffffff;
                }

                .nomen-search-input:focus {
                    outline: none;
                    box-shadow: none !important;
                }

                .nomen-search-clear {
                    width: 48px;
                    border: 0;
                    background: #ffffff;
                    color: #63717c;
                    font-size: 1.5rem;
                    line-height: 1;
                    cursor: pointer;
                }

                .nomen-search-button {
                    min-width: 150px;
                    border: 0;
                    background: #22282d;
                    color: #ffffff;
                    font-weight: 700;
                    font-size: 0.98rem;
                    padding: 0 24px;
                    cursor: pointer;
                }

                .nomen-search-button:hover,
                .nomen-search-button:focus {
                    background: #11161a;
                    color: #ffffff;
                }

                .nomen-selected-type {
                    display: none;
                    align-items: center;
                    gap: 8px;
                    margin-top: 14px;
                    font-size: 0.92rem;
                    color: #39434b;
                }

                .nomen-selected-type.is-visible {
                    display: flex;
                }

                .nomen-selected-type strong {
                    color: #17212b;
                }

                .nomen-remove-type {
                    border: 1px solid #dce1e5;
                    background: #ffffff;
                    border-radius: 999px;
                    padding: 4px 10px;
                    color: #006f95;
                    cursor: pointer;
                    font-weight: 700;
                }

                .nomen-suggestions {
                    display: none;
                    position: absolute;
                    z-index: 40;
                    top: calc(100% + 8px);
                    left: 0;
                    right: 0;
                    background: #ffffff;
                    border: 1px solid #dce1e5;
                    border-radius: 14px;
                    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.12);
                    overflow: hidden;
                }

                .nomen-suggestions.is-visible {
                    display: block;
                }

                .nomen-suggestion {
                    display: flex;
                    justify-content: space-between;
                    gap: 18px;
                    width: 100%;
                    text-align: left;
                    padding: 14px 18px;
                    border: 0;
                    border-bottom: 1px solid #eef1f3;
                    cursor: pointer;
                    background: #ffffff;
                }

                .nomen-suggestion:last-child {
                    border-bottom: 0;
                }

                .nomen-suggestion:hover {
                    background: #f7f9fa;
                }

                .nomen-suggestion-title {
                    display: block;
                    font-weight: 800;
                    color: #17212b;
                    margin-bottom: 3px;
                }

                .nomen-suggestion-meta {
                    display: block;
                    font-size: 0.9rem;
                    color: #63717c;
                }

                .nomen-suggestion-action {
                    white-space: nowrap;
                    font-size: 0.88rem;
                    color: #006f95;
                    font-weight: 700;
                    align-self: center;
                }

                .nomen-advanced-toggle {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 16px;
                    font-weight: 700;
                    color: #006f95;
                    background: none;
                    border: 0;
                    padding: 0;
                    cursor: pointer;
                }

                .nomen-advanced-wrapper {
                    display: none;
                    margin-top: 20px;
                    border: 1px solid #e3e7ea;
                    border-radius: 14px;
                    background: #f8fafb;
                    padding: 20px;
                }

                .nomen-advanced-wrapper.is-visible {
                    display: block;
                }

                .nomen-advanced-wrapper h2 {
                    font-size: 1.05rem;
                    margin: 0 0 16px 0;
                    color: #17212b;
                }

                .nomen-grid {
                    display: grid;
                    grid-template-columns: 1.1fr 0.9fr;
                    gap: 24px;
                    margin-top: 24px;
                }

                .nomen-section {
                    background: #ffffff;
                    border: 1px solid #e5e8eb;
                    border-radius: 16px;
                    padding: 24px;
                    box-shadow: 0 5px 18px rgba(0, 0, 0, 0.035);
                }

                .nomen-section-title {
                    font-size: 1.15rem;
                    font-weight: 800;
                    margin: 0 0 18px 0;
                    color: #17212b;
                }

                .nomen-type-grid {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 14px;
                }

                .nomen-type-card {
                    border: 1px solid #e3e7ea;
                    border-radius: 14px;
                    background: #ffffff;
                    padding: 18px 16px;
                    min-height: 110px;
                    cursor: pointer;
                    text-align: left;
                    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
                }

                .nomen-type-card:hover,
                .nomen-type-card.is-active {
                    transform: translateY(-2px);
                    border-color: #d7df2f;
                    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
                }

                .nomen-type-icon {
                    width: 34px;
                    height: 34px;
                    border-radius: 12px;
                    background: #f0f3f5;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 12px;
                    font-weight: 800;
                    color: #22282d;
                }

                .nomen-type-name {
                    font-weight: 800;
                    color: #17212b;
                    margin-bottom: 4px;
                }

                .nomen-type-desc {
                    color: #63717c;
                    font-size: 0.9rem;
                    line-height: 1.35;
                }

                .nomen-help-list {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }

                .nomen-help-list li {
                    border-left: 4px solid #d7df2f;
                    padding: 4px 0 4px 14px;
                    color: #4d5b66;
                    line-height: 1.45;
                }

                .nomen-help-list strong {
                    color: #17212b;
                }

                .nomen-footnote {
                    margin-top: 24px;
                    border: 1px solid #edf0cf;
                    border-radius: 14px;
                    background: #fcfdf0;
                    padding: 14px 18px;
                    color: #4f5a32;
                    font-size: 0.92rem;
                }

                @media (max-width: 980px) {
                    .nomen-grid {
                        grid-template-columns: 1fr;
                    }

                    .nomen-type-grid {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                }

                @media (max-width: 640px) {
                    .nomen-hero {
                        padding: 24px 20px;
                    }

                    .nomen-title {
                        font-size: 1.65rem;
                    }

                    .nomen-search-box {
                        flex-wrap: wrap;
                    }

                    .nomen-search-input {
                        flex-basis: 100%;
                    }

                    .nomen-search-clear {
                        display: none;
                    }

                    .nomen-search-button {
                        width: 100%;
                        min-height: 48px;
                    }

                    .nomen-type-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `;

            var style = document.createElement('style');
            style.type = 'text/css';
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        }

        addCSS();

        var authorityOptions = uniqueAuthorityOptions(getAuthorityOptions());

        if (!authorityOptions.length) {
            authorityOptions = [
                {
                    value: '',
                    originalLabel: 'Todos',
                    publicLabel: 'Todos',
                    description: 'Pesquisar em todos os tipos de autoridade'
                }
            ];
        }

        var typeCardsHTML = authorityOptions.map(function (option) {
            return `
                <button class="nomen-type-card" type="button" data-nomen-type="${escapeHTML(option.value)}" data-nomen-label="${escapeHTML(option.publicLabel)}">
                    <div class="nomen-type-icon">${escapeHTML(makeInitials(option.publicLabel))}</div>
                    <div class="nomen-type-name">${escapeHTML(option.publicLabel)}</div>
                    <div class="nomen-type-desc">${escapeHTML(option.description)}</div>
                </button>
            `;
        }).join('');

        var nomenPage = document.createElement('div');
        nomenPage.className = 'nomen-page';

        nomenPage.innerHTML = `
            <section class="nomen-hero">
                <div class="nomen-label">
                    <span class="nomen-label-dot"></span>
                    <span>${escapeHTML(NOMEN_CONFIG.etiqueta)}</span>
                </div>

                <h1 class="nomen-title">${escapeHTML(NOMEN_CONFIG.titulo)}</h1>

                <p class="nomen-subtitle">${escapeHTML(NOMEN_CONFIG.subtitulo)}</p>

                <div class="nomen-search-panel">
                    <form class="nomen-public-search" autocomplete="off">
                        <div class="nomen-search-box">
                            <input class="nomen-search-input" type="search" placeholder="${escapeHTML(NOMEN_CONFIG.placeholder)}" aria-label="Pesquisar entidades do catálogo">
                            <button class="nomen-search-clear" type="button" aria-label="Limpar pesquisa">×</button>
                            <button class="nomen-search-button" type="submit">Pesquisar</button>
                        </div>

                        <div class="nomen-selected-type">
                            <span>A pesquisar em: <strong class="nomen-selected-type-label"></strong></span>
                            <button class="nomen-remove-type" type="button">Remover filtro</button>
                        </div>

                        <div class="nomen-suggestions" aria-label="Sugestões de pesquisa"></div>
                    </form>

                    <button class="nomen-advanced-toggle" type="button" aria-expanded="false">
                        Pesquisa avançada
                    </button>

                    <div class="nomen-advanced-wrapper" aria-hidden="true">
                        <h2>Pesquisa avançada de autoridades</h2>
                    </div>
                </div>
            </section>

            <div class="nomen-grid">
                <section class="nomen-section">
                    <h2 class="nomen-section-title">Limitar por tipo de entidade</h2>
                    <div class="nomen-type-grid">
                        ${typeCardsHTML}
                    </div>
                </section>

                <section class="nomen-section">
                    <h2 class="nomen-section-title">Como pesquisar</h2>
                    <ul class="nomen-help-list">
                        <li><strong>Pessoas:</strong> procure autores, personalidades ou nomes pessoais existentes nas autoridades.</li>
                        <li><strong>Assuntos:</strong> procure temas, tópicos ou conceitos usados para organizar os registos.</li>
                        <li><strong>Coletividades:</strong> procure instituições, grupos ou organizações.</li>
                        <li><strong>Obras e lugares:</strong> procure títulos controlados ou nomes geográficos, se existirem no catálogo.</li>
                    </ul>
                </section>
            </div>

            <div class="nomen-footnote">
                ${escapeHTML(NOMEN_CONFIG.nota)}
            </div>
        `;

        originalContainer.parentElement.insertBefore(nomenPage, originalContainer);

        originalContainer.classList.add('nomen-authority-old-interface');

        var advancedWrapper = nomenPage.querySelector('.nomen-advanced-wrapper');
        var publicForm = nomenPage.querySelector('.nomen-public-search');
        var publicInput = nomenPage.querySelector('.nomen-search-input');
        var clearButton = nomenPage.querySelector('.nomen-search-clear');
        var suggestionsBox = nomenPage.querySelector('.nomen-suggestions');
        var advancedToggle = nomenPage.querySelector('.nomen-advanced-toggle');
        var selectedTypeBox = nomenPage.querySelector('.nomen-selected-type');
        var selectedTypeLabel = nomenPage.querySelector('.nomen-selected-type-label');
        var removeTypeButton = nomenPage.querySelector('.nomen-remove-type');

        if (advancedWrapper) {
            advancedWrapper.appendChild(originalContainer);
        }

        var selectedTypeValue = '';
        var selectedTypePublicLabel = '';

        function updateSelectedTypeBox() {
            if (selectedTypeValue && selectedTypePublicLabel) {
                selectedTypeLabel.textContent = selectedTypePublicLabel;
                selectedTypeBox.classList.add('is-visible');
            } else {
                selectedTypeLabel.textContent = '';
                selectedTypeBox.classList.remove('is-visible');
            }

            nomenPage.querySelectorAll('.nomen-type-card').forEach(function (card) {
                if (card.getAttribute('data-nomen-type') === selectedTypeValue && selectedTypeValue) {
                    card.classList.add('is-active');
                } else {
                    card.classList.remove('is-active');
                }
            });
        }

        function renderSuggestions(query) {
            var q = String(query || '').trim();

            if (q.length < 2) {
                suggestionsBox.classList.remove('is-visible');
                suggestionsBox.innerHTML = '';
                return;
            }

            var suggestions = [];

            suggestions.push({
                label: 'Pesquisar “‘ + q + '” em todos os tipos de entidade',
                meta: 'Pesquisa nas autoridades bibliográficas',
                typeValue: selectedTypeValue || ''
            });

            authorityOptions.slice(0, 6).forEach(function (option) {
                if (selectedTypeValue && option.value === selectedTypeValue) {
                    return;
                }

                suggestions.push({
                    label: 'Pesquisar “‘ + q + '” em ' + option.publicLabel,
                    meta: option.description,
                    typeValue: option.value
                });
            });

            suggestionsBox.innerHTML = suggestions.slice(0, 7).map(function (item) {
                return `
                    <button class="nomen-suggestion" type="button" data-nomen-type="${escapeHTML(item.typeValue)}">
                        <span>
                            <span class="nomen-suggestion-title">${escapeHTML(item.label)}</span>
                            <span class="nomen-suggestion-meta">${escapeHTML(item.meta)}</span>
                        </span>
                        <span class="nomen-suggestion-action">Pesquisar</span>
                    </button>
                `;
            }).join('');

            suggestionsBox.classList.add('is-visible');

            suggestionsBox.querySelectorAll('.nomen-suggestion').forEach(function (button) {
                button.addEventListener('click', function () {
                    var typeValue = button.getAttribute('data-nomen-type') || '';
                    submitAuthoritySearch(q, typeValue);
                });
            });
        }

        publicForm.addEventListener('submit', function (event) {
            event.preventDefault();

            var term = publicInput.value.trim();

            if (!term) {
                publicInput.focus();
                return;
            }

            submitAuthoritySearch(term, selectedTypeValue);
        });

        publicInput.addEventListener('input', function () {
            renderSuggestions(publicInput.value);
        });

        clearButton.addEventListener('click', function () {
            publicInput.value = '';
            suggestionsBox.classList.remove('is-visible');
            suggestionsBox.innerHTML = '';
            publicInput.focus();
        });

        advancedToggle.addEventListener('click', function () {
            var visible = advancedWrapper.classList.toggle('is-visible');

            document.body.classList.toggle('nomen-advanced-open', visible);
            advancedWrapper.setAttribute('aria-hidden', visible ? 'false' : 'true');
            advancedToggle.setAttribute('aria-expanded', visible ? 'true' : 'false');
        });

        removeTypeButton.addEventListener('click', function () {
            selectedTypeValue = '';
            selectedTypePublicLabel = '';
            setAuthorityType('');
            updateSelectedTypeBox();
            renderSuggestions(publicInput.value);
            publicInput.focus();
        });

        nomenPage.querySelectorAll('.nomen-type-card').forEach(function (button) {
            button.addEventListener('click', function () {
                selectedTypeValue = button.getAttribute('data-nomen-type') || '';
                selectedTypePublicLabel = button.getAttribute('data-nomen-label') || '';

                setAuthorityType(selectedTypeValue);
                updateSelectedTypeBox();
                renderSuggestions(publicInput.value);
                publicInput.focus();
            });
        });

        document.addEventListener('click', function (event) {
            if (!nomenPage.contains(event.target)) {
                suggestionsBox.classList.remove('is-visible');
            }
        });

        updateSelectedTypeBox();

        console.log('[NOMEN] Transformação concluída.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initNomenAuthoritySearch);
    } else {
        initNomenAuthoritySearch();
    }

})();
