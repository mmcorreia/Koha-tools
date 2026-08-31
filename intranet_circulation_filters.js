/* ================================================================================
   INTRANET_CIRCULATION_FILTERS
   Versão 1.0
   Autor: Miguel Mimoso Correia
   Licença: CC-BY-NC-SA

   Finalidade
   ----------
   Adiciona filtros rápidos de disponibilidade e circulação ao interface
   dos técnicos do Koha.

   Páginas abrangidas
   ------------------
   1. Registo bibliográfico:
      /cgi-bin/koha/catalogue/detail.pl
      - Só disponíveis
      - Circulação

   2. Pesquisa bibliográfica / pesquisa para catalogação:
      /cgi-bin/koha/catalogue/search.pl
      /cgi-bin/koha/cataloguing/addbooks.pl
      - Só disponíveis
      - Circulação

   Lógica dos filtros
   ------------------
   Só disponíveis:
   - mostra apenas exemplares/localizações identificados como disponíveis.

   Circulação:
   - mantém disponíveis, emprestados, reservados e em trânsito;
   - exclui estados configurados como bloqueantes, como abatido,
     desaparecido, consulta local, tratamento técnico, etc.

   Robustez
   --------
   - normaliza maiúsculas/minúsculas, espaços e acentos;
   - suporta várias estruturas HTML usadas pelo Koha;
   - reage a redraws DataTables;
   - volta a aplicar os filtros após alterações dinâmicas ao DOM;
   - evita dupla inicialização e duplicação de botões/CSS.

   Instalação
   ----------
   Administração > Preferências do sistema > IntranetUserJS
   Inserir apenas o JavaScript, sem tags <script>.
   ================================================================================ */

(function () {
    "use strict";

    const COMPONENT = "intranet_circulation_filters";
    const VERSION = "1.0";

    if (window.INTRANET_CIRCULATION_FILTERS_ACTIVE) {
        return;
    }

    window.INTRANET_CIRCULATION_FILTERS_ACTIVE = true;
    window.INTRANET_CIRCULATION_FILTERS_VERSION = VERSION;

    /* ============================================================================
       CONFIGURAÇÃO
       ============================================================================ */

    const CONFIG = {
        debug: false,

        blockingStates: [
            "ABATIDO",
            "DESAPARECIDO",
            "NÃO ACESSÍVEL",
            "DESLOCADO",
            "NÃO DISPONÍVEL",
            "MAU ESTADO",
            "INVENTÁRIO",
            "GRUPO DE LEITORES",
            "ESCOLA",
            "UTIL. INTERNA",
            "UTILIZAÇÃO INTERNA",
            "EM RESTAURO",
            "CONSULTA LOCAL",
            "ENTIDADE EXTERNA",
            "TRATAMENTO TÉCNICO",
            "DIGITALIZADO",
            "EM AVALIAÇÃO"
        ],

        circulationTerms: [
            "EM TRÂNSITO",
            "EMPRESTADO",
            "EMPRÉSTIMO",
            "RESERVADO",
            "RESERVA",
            "IN TRANSIT",
            "ON LOAN",
            "CHECKED OUT",
            "ON HOLD",
            "HOLD"
        ],

        availableTerms: [
            "DISPONÍVEL",
            "AVAILABLE"
        ],

        unavailableTerms: [
            "NÃO DISPONÍVEL",
            "INDISPONÍVEL",
            "UNAVAILABLE",
            "NOT AVAILABLE"
        ],

        initAttempts: 40,
        initInterval: 250,
        redrawDelay: 30,
        clearDelay: 100,
        mutationDelay: 80
    };

    const STATE = {
        detailMode: "",
        searchMode: "",
        mutationTimer: null
    };

    /* ============================================================================
       UTILITÁRIOS
       ============================================================================ */

    function log() {
        if (!CONFIG.debug || !window.console) return;

        const args = Array.prototype.slice.call(arguments);
        args.unshift("[" + COMPONENT + " " + VERSION + "]");
        console.log.apply(console, args);
    }

    function norm(value) {
        let text = String(value == null ? "" : value)
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();

        if (typeof text.normalize === "function") {
            text = text
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");
        }

        return text;
    }

    function containsAny(text, terms) {
        const normalized = norm(text);

        return terms.some(function (term) {
            return normalized.includes(norm(term));
        });
    }

    function isDetailPage() {
        return /\/cgi-bin\/koha\/catalogue\/detail\.pl$/i.test(window.location.pathname) ||
               /\/catalogue\/detail\.pl$/i.test(window.location.pathname);
    }

    function isSearchPage() {
        return (
            /\/cgi-bin\/koha\/catalogue\/search\.pl$/i.test(window.location.pathname) ||
            /\/catalogue\/search\.pl$/i.test(window.location.pathname) ||
            /\/cgi-bin\/koha\/cataloguing\/addbooks\.pl$/i.test(window.location.pathname) ||
            /\/cataloguing\/addbooks\.pl$/i.test(window.location.pathname)
        );
    }

    function isCirculation(text) {
        return containsAny(text, CONFIG.circulationTerms);
    }

    function isBlocked(text) {
        return containsAny(text, CONFIG.blockingStates);
    }

    function isAvailable(text) {
        const normalized = norm(text);

        if (!normalized) {
            return false;
        }

        if (containsAny(normalized, CONFIG.unavailableTerms)) {
            return false;
        }

        return containsAny(normalized, CONFIG.availableTerms);
    }

    function debounceMutationRefresh() {
        if (STATE.mutationTimer) {
            window.clearTimeout(STATE.mutationTimer);
        }

        STATE.mutationTimer = window.setTimeout(function () {
            init();
            applyCurrentFilters();
        }, CONFIG.mutationDelay);
    }

    /* ============================================================================
       CSS
       ============================================================================ */

    function addCss() {
        if (document.getElementById("intranet-circulation-filters-css")) {
            return;
        }

        const style = document.createElement("style");
        style.id = "intranet-circulation-filters-css";

        style.textContent = `
            .intranet-circulation-filters-wrap {
                display: inline-flex;
                align-items: center;
                flex-wrap: wrap;
                gap: 6px;
            }

            .intranet-circulation-filters-detail {
                margin-right: 10px;
            }

            .intranet-circulation-filters-search {
                margin-left: 10px;
            }

            .intranet-circulation-filter-btn {
                display: inline-flex !important;
                align-items: center;
                gap: 6px;
                min-height: 30px;
                padding: 5px 10px !important;
                white-space: nowrap;
                text-decoration: none !important;
            }

            .intranet-circulation-filter-btn.ativo {
                background: #337ab7 !important;
                border-color: #2e6da4 !important;
                color: #ffffff !important;
            }

            .intranet-circulation-filter-btn.ativo i {
                color: #ffffff !important;
            }

            #holdings_table_wrapper .dt-buttons {
                display: flex !important;
                justify-content: flex-start !important;
                align-items: center !important;
                flex-wrap: wrap !important;
                gap: 6px !important;
            }

            #intranet-circulation-filters-detail-fallback {
                margin-bottom: 10px;
            }
        `;

        document.head.appendChild(style);
    }

    /* ============================================================================
       BOTÕES
       ============================================================================ */

    function createButton(id, iconClass, label, title) {
        return $("<a>", {
            id: id,
            href: "#",
            class: "btn btn-default intranet-circulation-filter-btn",
            title: title,
            "aria-pressed": "false",
            html:
                '<i class="' + iconClass + '" aria-hidden="true"></i>' +
                '<span>' + label + "</span>"
        });
    }

    function setButtonState($button, active) {
        $button
            .toggleClass("ativo", active)
            .attr("aria-pressed", active ? "true" : "false");
    }

    /* ============================================================================
       1. REGISTO BIBLIOGRÁFICO / HOLDINGS
       ============================================================================ */

    function getHoldingsTable() {
        return $("#holdings_table").first();
    }

    function getHoldingsRows() {
        const $table = getHoldingsTable();

        if (!$table.length) {
            return $();
        }

        return $table.find("tbody tr").filter(function () {
            const $row = $(this);

            return (
                !$row.hasClass("dtrg-group") &&
                !$row.hasClass("child") &&
                !$row.is("[role='rowgroup']")
            );
        });
    }

    function getHoldingStateText($row) {
        const selectors = [
            "td.status",
            "td .status",
            "td[data-colname='Estado']",
            "td[data-colname='Status']",
            "td[data-colname='Disponibilidade']",
            "td[data-colname='Availability']",
            "td[data-title='Estado']",
            "td[data-title='Status']",
            "td[data-title='Disponibilidade']",
            "td[data-title='Availability']"
        ];

        for (let i = 0; i < selectors.length; i++) {
            const $element = $row.find(selectors[i]).first();

            if ($element.length && norm($element.text())) {
                return $element.text();
            }
        }

        /*
         * Fallback deliberado:
         * em algumas versões/templates o estado não tem uma classe própria.
         * Nesse caso usa-se a linha completa para não perder a capacidade
         * de reconhecer estados conhecidos.
         */
        return $row.text();
    }

    function insertDetailButtons() {
        if (!isDetailPage()) return;
        if ($("#intranet-circ-detail-available").length) return;

        const $table = getHoldingsTable();
        if (!$table.length) return;

        let $toolbar = $("#holdings_table_wrapper .dt-buttons").first();

        if (!$toolbar.length) {
            $toolbar = $table
                .closest(".dataTables_wrapper")
                .find(".dt-buttons")
                .first();
        }

        if (!$toolbar.length) {
            $toolbar = $(".dt-buttons").first();
        }

        if (!$toolbar.length) {
            $toolbar = $("<div>", {
                id: "intranet-circulation-filters-detail-fallback",
                class:
                    "intranet-circulation-filters-wrap " +
                    "intranet-circulation-filters-detail"
            });

            $table.before($toolbar);
        }

        const $wrap = $("<span>", {
            id: "intranet-circulation-filters-detail",
            class:
                "intranet-circulation-filters-wrap " +
                "intranet-circulation-filters-detail"
        });

        const $available = createButton(
            "intranet-circ-detail-available",
            "fa fa-check fas fa-check",
            "Só disponíveis",
            "Mostrar apenas exemplares disponíveis"
        );

        const $circulation = createButton(
            "intranet-circ-detail-circulation",
            "fa fa-exchange fas fa-exchange-alt",
            "Circulação",
            "Mostrar exemplares disponíveis, emprestados, reservados e em trânsito"
        );

        $wrap.append($available, $circulation);
        $toolbar.prepend($wrap);

        updateDetailButtons();
    }

    function applyDetailFilter() {
        if (!isDetailPage()) return;

        getHoldingsRows().each(function () {
            const $row = $(this);
            const stateText = getHoldingStateText($row);

            if (STATE.detailMode === "AVAILABLE") {
                $row.toggle(isAvailable(stateText));
                return;
            }

            if (STATE.detailMode === "CIRCULATION") {
                const show =
                    isAvailable(stateText) ||
                    isCirculation(stateText) ||
                    !isBlocked(stateText);

                $row.toggle(show);
                return;
            }

            $row.show();
        });
    }

    function updateDetailButtons() {
        setButtonState(
            $("#intranet-circ-detail-available"),
            STATE.detailMode === "AVAILABLE"
        );

        setButtonState(
            $("#intranet-circ-detail-circulation"),
            STATE.detailMode === "CIRCULATION"
        );
    }

    function bindDetailDataTable() {
        const $table = getHoldingsTable();

        if (!$table.length) return;
        if ($table.data("intranet-circulation-filters-bound")) return;

        $table.on(
            "draw.dt.intranetCirculationFilters " +
            "page.dt.intranetCirculationFilters " +
            "order.dt.intranetCirculationFilters " +
            "search.dt.intranetCirculationFilters " +
            "length.dt.intranetCirculationFilters",
            function () {
                window.setTimeout(applyDetailFilter, CONFIG.redrawDelay);
            }
        );

        $table.data("intranet-circulation-filters-bound", true);
    }

    function initDetail() {
        if (!isDetailPage()) return;

        insertDetailButtons();
        bindDetailDataTable();
        updateDetailButtons();
        applyDetailFilter();
    }

    $(document).on(
        "click.intranetCirculationFilters",
        "#intranet-circ-detail-available",
        function (event) {
            event.preventDefault();

            STATE.detailMode =
                STATE.detailMode === "AVAILABLE" ? "" : "AVAILABLE";

            updateDetailButtons();
            applyDetailFilter();
        }
    );

    $(document).on(
        "click.intranetCirculationFilters",
        "#intranet-circ-detail-circulation",
        function (event) {
            event.preventDefault();

            STATE.detailMode =
                STATE.detailMode === "CIRCULATION" ? "" : "CIRCULATION";

            updateDetailButtons();
            applyDetailFilter();
        }
    );

    /* ============================================================================
       2. PESQUISA BIBLIOGRÁFICA
       ============================================================================ */

    function getSearchRows() {
        const selectors = [
            "#searchresults table tbody tr",
            "table#searchresults tbody tr",
            "#searchresults tbody tr",
            "tr:has(.availability)"
        ];

        for (let i = 0; i < selectors.length; i++) {
            const $rows = $(selectors[i]);

            if ($rows.length) {
                return $rows;
            }
        }

        return $();
    }

    function getAvailabilityBlock($row) {
        const selectors = [
            ".availability",
            "div.availability",
            "span.availability",
            "[data-colname='Disponibilidade']",
            "[data-colname='Availability']"
        ];

        for (let i = 0; i < selectors.length; i++) {
            const $element = $row.find(selectors[i]).first();

            if ($element.length) {
                return $element;
            }
        }

        return $();
    }

    function getAvailabilityEntries($availability) {
        let $entries = $availability.find("ul li");

        if (!$entries.length) {
            $entries = $availability.find("li");
        }

        return $entries;
    }

    function resetAvailability($availability) {
        $availability.show();
        $availability.find("ul, li, span.unavailable, span.available").show();
    }

    function filterAvailabilityEntries($availability, onlyAvailable) {
        const $entries = getAvailabilityEntries($availability);

        if (!$entries.length) {
            return;
        }

        $entries.each(function () {
            const $entry = $(this);
            const text = $entry.text();

            if (onlyAvailable) {
                $entry.toggle(isAvailable(text));
                return;
            }

            const show =
                isAvailable(text) ||
                isCirculation(text) ||
                !isBlocked(text);

            $entry.toggle(show);
        });

        const hasVisibleEntries = $entries.filter(":visible").length > 0;

        const $list = $entries.first().closest("ul");
        if ($list.length) {
            $list.toggle(hasVisibleEntries);
        }

        /*
         * Alguns templates usam span.unavailable como contentor/resumo
         * apesar de conterem uma lista mista de localizações.
         */
        $availability.find("span.unavailable").toggle(hasVisibleEntries);
    }

    function explicitlyNoAvailableItems($availability) {
        const summaryText = norm(
            $availability.find("strong").first().text()
        );

        const totalText = norm($availability.text());

        const noAvailableTerms = [
            "NENHUM DISPONIVEL",
            "0 DISPONIVEL",
            "NO ITEMS AVAILABLE",
            "NONE AVAILABLE"
        ];

        return (
            containsAny(summaryText, noAvailableTerms) ||
            containsAny(totalText, noAvailableTerms)
        );
    }

    function hasAvailableEntry($availability) {
        const $entries = getAvailabilityEntries($availability);

        if ($entries.length) {
            let found = false;

            $entries.each(function () {
                if (isAvailable($(this).text())) {
                    found = true;
                    return false;
                }
            });

            if (found) {
                return true;
            }
        }

        return isAvailable($availability.text());
    }

    function shouldShowSearchRowInCirculation(totalText) {
        return (
            isAvailable(totalText) ||
            isCirculation(totalText) ||
            !isBlocked(totalText)
        );
    }

    function applySearchFilter() {
        if (!isSearchPage()) return;

        getSearchRows().each(function () {
            const $row = $(this);
            const $availability = getAvailabilityBlock($row);

            if (!$availability.length) {
                /*
                 * Sem bloco de disponibilidade não há informação suficiente
                 * para excluir o resultado de forma segura.
                 */
                $row.show();
                return;
            }

            resetAvailability($availability);

            const totalText = $availability.text();

            if (STATE.searchMode === "AVAILABLE") {
                const noneAvailable = explicitlyNoAvailableItems($availability);
                const hasAvailable = !noneAvailable && hasAvailableEntry($availability);

                $row.toggle(hasAvailable);

                if (hasAvailable) {
                    filterAvailabilityEntries($availability, true);
                }

                return;
            }

            if (STATE.searchMode === "CIRCULATION") {
                const show = shouldShowSearchRowInCirculation(totalText);

                $row.toggle(show);

                if (show) {
                    filterAvailabilityEntries($availability, false);
                }

                return;
            }

            $row.show();
            resetAvailability($availability);
        });
    }

    function findSearchAnchor() {
        let $anchor = $("a, button").filter(function () {
            return norm($(this).text()) === "LIMPAR TODOS";
        }).first();

        if ($anchor.length) {
            return $anchor;
        }

        $anchor = $("a, button").filter(function () {
            const text = norm($(this).text());

            return (
                text === "CLEAR ALL" ||
                text.includes("LIMPAR TODOS") ||
                text.includes("CLEAR ALL")
            );
        }).first();

        if ($anchor.length) {
            return $anchor;
        }

        /*
         * Fallback para alterações do template:
         * procura a zona dos filtros/facetas e posiciona os botões aí.
         */
        return $(
            "#search-facets .btn-toolbar, " +
            "#search-facets, " +
            ".search-facets, " +
            "#searchresults"
        ).first();
    }

    function insertSearchButtons() {
        if (!isSearchPage()) return;
        if ($("#intranet-circ-search-available").length) return;

        const $anchor = findSearchAnchor();

        if (!$anchor.length) {
            return;
        }

        const $wrap = $("<span>", {
            id: "intranet-circulation-filters-search",
            class:
                "intranet-circulation-filters-wrap " +
                "intranet-circulation-filters-search"
        });

        const $available = createButton(
            "intranet-circ-search-available",
            "fa fa-check fas fa-check",
            "Só disponíveis",
            "Mostrar apenas títulos com exemplares disponíveis"
        );

        const $circulation = createButton(
            "intranet-circ-search-circulation",
            "fa fa-exchange fas fa-exchange-alt",
            "Circulação",
            "Mostrar títulos e localizações disponíveis ou em circulação"
        );

        $wrap.append($available, $circulation);

        if ($anchor.is("a, button")) {
            $anchor.after($wrap);
        } else {
            $anchor.prepend($wrap);
        }

        updateSearchButtons();
    }

    function updateSearchButtons() {
        setButtonState(
            $("#intranet-circ-search-available"),
            STATE.searchMode === "AVAILABLE"
        );

        setButtonState(
            $("#intranet-circ-search-circulation"),
            STATE.searchMode === "CIRCULATION"
        );
    }

    function bindSearchDataTables() {
        const $tables = $("#searchresults table, table#searchresults");

        $tables.each(function () {
            const $table = $(this);

            if ($table.data("intranet-circulation-filters-bound")) {
                return;
            }

            $table.on(
                "draw.dt.intranetCirculationFilters " +
                "page.dt.intranetCirculationFilters " +
                "order.dt.intranetCirculationFilters " +
                "search.dt.intranetCirculationFilters " +
                "length.dt.intranetCirculationFilters",
                function () {
                    window.setTimeout(applySearchFilter, CONFIG.redrawDelay);
                }
            );

            $table.data("intranet-circulation-filters-bound", true);
        });
    }

    function initSearch() {
        if (!isSearchPage()) return;

        insertSearchButtons();
        bindSearchDataTables();
        updateSearchButtons();
        applySearchFilter();
    }

    $(document).on(
        "click.intranetCirculationFilters",
        "#intranet-circ-search-available",
        function (event) {
            event.preventDefault();

            STATE.searchMode =
                STATE.searchMode === "AVAILABLE" ? "" : "AVAILABLE";

            updateSearchButtons();
            applySearchFilter();
        }
    );

    $(document).on(
        "click.intranetCirculationFilters",
        "#intranet-circ-search-circulation",
        function (event) {
            event.preventDefault();

            STATE.searchMode =
                STATE.searchMode === "CIRCULATION" ? "" : "CIRCULATION";

            updateSearchButtons();
            applySearchFilter();
        }
    );

    $(document).on(
        "click.intranetCirculationFilters",
        "a, button",
        function () {
            const text = norm($(this).text());

            if (
                text === "LIMPAR TODOS" ||
                text === "CLEAR ALL" ||
                text.includes("LIMPAR TODOS") ||
                text.includes("CLEAR ALL")
            ) {
                STATE.searchMode = "";
                updateSearchButtons();

                window.setTimeout(
                    applySearchFilter,
                    CONFIG.clearDelay
                );
            }
        }
    );

    /* ============================================================================
       ATUALIZAÇÕES DINÂMICAS
       ============================================================================ */

    function applyCurrentFilters() {
        if (isDetailPage()) {
            updateDetailButtons();
            applyDetailFilter();
        }

        if (isSearchPage()) {
            updateSearchButtons();
            applySearchFilter();
        }
    }

    function installMutationObserver() {
        if (window.INTRANET_CIRCULATION_FILTERS_OBSERVER) {
            return;
        }

        const observer = new MutationObserver(function (mutations) {
            let relevant = false;

            for (let i = 0; i < mutations.length; i++) {
                const mutation = mutations[i];

                if (
                    mutation.type === "childList" &&
                    (mutation.addedNodes.length || mutation.removedNodes.length)
                ) {
                    relevant = true;
                    break;
                }
            }

            if (relevant) {
                debounceMutationRefresh();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        window.INTRANET_CIRCULATION_FILTERS_OBSERVER = observer;
    }

    /* ============================================================================
       INICIALIZAÇÃO
       ============================================================================ */

    function init() {
        if (!isDetailPage() && !isSearchPage()) {
            return;
        }

        addCss();

        if (isDetailPage()) {
            initDetail();
        }

        if (isSearchPage()) {
            initSearch();
        }
    }

    $(document).ready(function () {
        init();
        installMutationObserver();
    });

    window.addEventListener("load", function () {
        init();
        applyCurrentFilters();
    });

    /*
     * Fallback temporário para elementos que o Koha/DataTables possa criar
     * depois do DOMContentLoaded. O intervalo termina automaticamente.
     */
    let attempts = 0;

    const initInterval = window.setInterval(function () {
        init();
        applyCurrentFilters();

        attempts++;

        if (attempts >= CONFIG.initAttempts) {
            window.clearInterval(initInterval);
            log("Inicialização concluída.");
        }
    }, CONFIG.initInterval);

})();
