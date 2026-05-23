/* ================================================================================
   RBMO / KOHA 24 / FILTROS STAFF
   Filtros rápidos de disponibilidade e circulação
   Miguel Mimoso Correia | CC-BY-NC-SA
   ================================================================================ */

(function () {
    "use strict";

    const ESTADOS_BLOQUEANTES = [
        "ABATIDO",
        "DESAPARECIDO",
        "NÃO ACESSÍVEL",
        "NAO ACESSIVEL",
        "DESLOCADO",
        "NÃO DISPONÍVEL",
        "NAO DISPONIVEL",
        "MAU ESTADO",
        "INVENTÁRIO",
        "INVENTARIO",
        "GRUPO DE LEITORES",
        "ESCOLA",
        "UTIL.INTERNA",
        "UTIL. INTERNA",
        "EM RESTAURO",
        "CONSULTA LOCAL",
        "ENTIDADE EXTERNA",
        "TRATAMENTO TÉCNICO",
        "TRATAMENTO TECNICO",
        "DIGITALIZADO",
        "EM AVALIAÇÃO",
        "EM AVALIACAO"
    ];

    let modoRegisto = "";
    let modoPesquisa = "";

    $(init);
    window.addEventListener("load", init);

    let tentativas = 0;
    const intervalo = setInterval(function () {
        init();
        tentativas++;

        if (tentativas > 40) {
            clearInterval(intervalo);
        }
    }, 250);

    function init() {
        addCss();

        if (isDetail()) {
            initRegisto();
        }

        if (isSearch()) {
            initPesquisa();
        }
    }

    function addCss() {
        if ($("#rbmo-filtros-css").length) return;

        $("head").append(`
            <style id="rbmo-filtros-css">
                .btn-filtro-circulacao {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 5px 10px;
                    margin-left: 6px;
                    background: transparent;
                    border: 1px solid #cfd6dd;
                    border-radius: 2px;
                    color: #253f6d;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    text-decoration: none;
                    white-space: nowrap;
                }

                .btn-filtro-circulacao:hover {
                    background: #f8fafc;
                    border-color: #253f6d;
                    text-decoration: none;
                }

                .btn-filtro-circulacao.ativo {
                    background: #eef4ff;
                    border-color: #253f6d;
                    color: #1d3557;
                }

                .rbmo-filtros-registo-wrap,
                .rbmo-filtros-pesquisa-wrap {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                .rbmo-filtros-registo-wrap {
                    margin-right: 10px;
                }

                .rbmo-filtros-pesquisa-wrap {
                    margin-left: 10px;
                }

                #holdings_table_wrapper .dt-buttons {
                    display: flex !important;
                    justify-content: flex-start !important;
                    align-items: center !important;
                    flex-wrap: wrap;
                    gap: 6px;
                }
            </style>
        `);
    }

    function norm(txt) {
        return String(txt || "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();
    }

    function isDetail() {
        return /\/catalogue\/detail\.pl/i.test(location.pathname);
    }

    function isSearch() {
        return (
            /\/catalogue\/search\.pl/i.test(location.pathname) ||
            /\/cataloguing\/addbooks\.pl/i.test(location.pathname)
        );
    }

    function isCirculacao(txt) {
        const t = norm(txt);

        return (
            t.includes("EM TRÂNSITO") ||
            t.includes("EM TRANSITO") ||
            t.includes("EMPREST") ||
            t.includes("RESERV")
        );
    }

    function isBloqueado(txt) {
        const t = norm(txt);

        return ESTADOS_BLOQUEANTES.some(function (estado) {
            return t.includes(norm(estado));
        });
    }

    function isDisponivel(txt) {
        const t = norm(txt);

        const temDisponivel =
            t.includes("DISPONÍVEL") ||
            t.includes("DISPONIVEL") ||
            t.includes("AVAILABLE");

        const temNaoDisponivel =
            t.includes("NÃO DISPONÍVEL") ||
            t.includes("NAO DISPONIVEL") ||
            t.includes("UNAVAILABLE");

        return temDisponivel && !temNaoDisponivel;
    }

    function getHoldingsTable() {
        return $("#holdings_table").first();
    }

    function getHoldingsRows() {
        const $table = getHoldingsTable();

        if (!$table.length) return $();

        return $table.find("tbody tr").filter(function () {
            return !$(this).hasClass("dtrg-group");
        });
    }

    function getEstadoRegisto($tr) {
        const seletores = [
            "td.status",
            "td .status",
            "td[data-colname='Estado']",
            "td[data-colname='Status']",
            "td[data-colname='Disponibilidade']",
            "td[data-colname='Availability']"
        ];

        for (let i = 0; i < seletores.length; i++) {
            const $el = $tr.find(seletores[i]).first();

            if ($el.length && norm($el.text())) {
                return $el.text();
            }
        }

        return $tr.text();
    }

    function inserirBotoesRegisto() {
        if (!isDetail()) return;
        if ($("#btn-reg-disp").length) return;

        const $table = getHoldingsTable();
        if (!$table.length) return;

        let $zona = $("#holdings_table_wrapper .dt-buttons").first();

        if (!$zona.length) {
            $zona = $(".dt-buttons").first();
        }

        if (!$zona.length) {
            $zona = $("<div>", {
                id: "rbmo-holdings-filtros-fallback",
                class: "rbmo-filtros-registo-wrap",
                style: "margin-bottom:10px;"
            });

            $table.before($zona);
        }

        const $wrap = $("<span>", {
            id: "rbmo-filtros-registo-wrap",
            class: "rbmo-filtros-registo-wrap"
        });

        const $btnDisp = $("<a>", {
            id: "btn-reg-disp",
            href: "#",
            class: "btn-filtro-circulacao",
            html: '<i class="fa fa-check fas fa-check" aria-hidden="true"></i> Só disponíveis',
            title: "Mostrar apenas exemplares disponíveis"
        });

        const $btnCirc = $("<a>", {
            id: "btn-reg-circ",
            href: "#",
            class: "btn-filtro-circulacao",
            html: '<i class="fa fa-exchange fas fa-exchange-alt" aria-hidden="true"></i> Circulação',
            title: "Mostrar exemplares disponíveis, emprestados, reservados e em trânsito"
        });

        $wrap.append($btnDisp, $btnCirc);
        $zona.prepend($wrap);
    }

    function aplicarRegisto() {
        if (!isDetail()) return;

        getHoldingsRows().each(function () {
            const $tr = $(this);
            const estado = getEstadoRegisto($tr);

            if (modoRegisto === "DISP") {
                $tr.toggle(isDisponivel(estado));
                return;
            }

            if (modoRegisto === "CIRC") {
                $tr.toggle(isCirculacao(estado) || !isBloqueado(estado));
                return;
            }

            $tr.show();
        });
    }

    function atualizarBotoesRegisto() {
        $("#btn-reg-disp").toggleClass("ativo", modoRegisto === "DISP");
        $("#btn-reg-circ").toggleClass("ativo", modoRegisto === "CIRC");
    }

    function bindDataTablesRegisto() {
        const $table = getHoldingsTable();

        if (!$table.length) return;
        if ($table.data("rbmo-filtros-bound")) return;

        $table.on("draw.dt", function () {
            setTimeout(aplicarRegisto, 30);
        });

        $table.data("rbmo-filtros-bound", true);
    }

    function initRegisto() {
        inserirBotoesRegisto();
        bindDataTablesRegisto();
        atualizarBotoesRegisto();
        aplicarRegisto();
    }

    $(document).on("click", "#btn-reg-disp", function (e) {
        e.preventDefault();

        modoRegisto = modoRegisto === "DISP" ? "" : "DISP";

        atualizarBotoesRegisto();
        aplicarRegisto();
    });

    $(document).on("click", "#btn-reg-circ", function (e) {
        e.preventDefault();

        modoRegisto = modoRegisto === "CIRC" ? "" : "CIRC";

        atualizarBotoesRegisto();
        aplicarRegisto();
    });

    function getSearchRows() {
        let $rows = $("#searchresults table tbody tr");

        if (!$rows.length) {
            $rows = $("table#searchresults tbody tr");
        }

        if (!$rows.length) {
            $rows = $("tr").has(".availability");
        }

        return $rows;
    }

    function getAvailability($tr) {
        return $tr.find("div.availability, span.availability, .availability").first();
    }

    function resetAvailability($availability) {
        $availability.find("ul li").show();
        $availability.find("span.unavailable, ul").show();
    }

    function filtrarLocalizacoesPesquisa($availability, apenasDisponiveis) {
        const $lis = $availability.find("ul li");

        if (!$lis.length) return;

        $lis.each(function () {
            const $li = $(this);
            const texto = $li.text();

            if (apenasDisponiveis) {
                $li.toggle(isDisponivel(texto));
                return;
            }

            $li.toggle(isCirculacao(texto) || !isBloqueado(texto));
        });

        const algumVisivel = $lis.filter(":visible").length > 0;

        $availability.find("span.unavailable").toggle(algumVisivel);
        $availability.find("ul").toggle(algumVisivel);
    }

    function aplicarPesquisa() {
        if (!isSearch()) return;

        getSearchRows().each(function () {
            const $tr = $(this);
            const $availability = getAvailability($tr);

            if (!$availability.length) {
                $tr.show();
                return;
            }

            resetAvailability($availability);

            const textoResumo = norm($availability.find("strong").first().text());
            const textoTotal = norm($availability.text());

            const nenhumDisponivel =
                textoResumo.includes("NENHUM DISPONÍVEL") ||
                textoResumo.includes("NENHUM DISPONIVEL") ||
                textoResumo.includes("0 DISPONÍVEL") ||
                textoResumo.includes("0 DISPONIVEL") ||
                textoTotal.includes("NENHUM DISPONÍVEL") ||
                textoTotal.includes("NENHUM DISPONIVEL") ||
                textoTotal.includes("NO ITEMS AVAILABLE");

            if (modoPesquisa === "DISP") {
                $tr.toggle(!nenhumDisponivel);

                if (!nenhumDisponivel) {
                    filtrarLocalizacoesPesquisa($availability, true);
                }

                return;
            }

            if (modoPesquisa === "CIRC") {
                const mostrar = isCirculacao(textoTotal) || !isBloqueado(textoTotal);

                $tr.toggle(mostrar);

                if (mostrar) {
                    filtrarLocalizacoesPesquisa($availability, false);
                }

                return;
            }

            $tr.show();
            resetAvailability($availability);
        });
    }

    function encontrarAncoraPesquisa() {
        let $ancora = $("a").filter(function () {
            return norm($(this).text()) === "LIMPAR TODOS";
        }).first();

        if ($ancora.length) return $ancora;

        return $("a, button").filter(function () {
            const t = norm($(this).text());

            return t.includes("LIMPAR") || t.includes("CLEAR");
        }).first();
    }

    function inserirBotoesPesquisa() {
        if (!isSearch()) return;
        if ($("#btn-pesq-disp").length) return;

        const $ancora = encontrarAncoraPesquisa();
        if (!$ancora.length) return;

        const $wrap = $("<span>", {
            id: "rbmo-filtros-pesquisa-wrap",
            class: "rbmo-filtros-pesquisa-wrap"
        });

        const $btnDisp = $("<a>", {
            id: "btn-pesq-disp",
            href: "#",
            class: "btn-filtro-circulacao",
            html: '<i class="fa fa-check fas fa-check" aria-hidden="true"></i> Só disponíveis',
            title: "Mostrar apenas títulos com exemplares disponíveis"
        });

        const $btnCirc = $("<a>", {
            id: "btn-pesq-circ",
            href: "#",
            class: "btn-filtro-circulacao",
            html: '<i class="fa fa-exchange fas fa-exchange-alt" aria-hidden="true"></i> Circulação',
            title: "Mostrar títulos e localizações em circulação"
        });

        $wrap.append($btnDisp, $btnCirc);
        $ancora.after($wrap);
    }

    function atualizarBotoesPesquisa() {
        $("#btn-pesq-disp").toggleClass("ativo", modoPesquisa === "DISP");
        $("#btn-pesq-circ").toggleClass("ativo", modoPesquisa === "CIRC");
    }

    function initPesquisa() {
        inserirBotoesPesquisa();
        atualizarBotoesPesquisa();
        aplicarPesquisa();
    }

    $(document).on("click", "#btn-pesq-disp", function (e) {
        e.preventDefault();

        modoPesquisa = modoPesquisa === "DISP" ? "" : "DISP";

        atualizarBotoesPesquisa();
        aplicarPesquisa();
    });

    $(document).on("click", "#btn-pesq-circ", function (e) {
        e.preventDefault();

        modoPesquisa = modoPesquisa === "CIRC" ? "" : "CIRC";

        atualizarBotoesPesquisa();
        aplicarPesquisa();
    });

    $(document).on("click", "a, button", function () {
        const texto = norm($(this).text());

        if (texto === "LIMPAR TODOS" || texto.includes("CLEAR ALL")) {
            modoPesquisa = "";
            atualizarBotoesPesquisa();

            setTimeout(aplicarPesquisa, 100);
        }
    });

})();