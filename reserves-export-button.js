/* ==========================================================
   Mover botão "Exportar" na página de reservas
   DBPL | Miguel Mimoso Correia CC-BY
   ========================================================== */

(function () {
    "use strict";

    function norm(txt) {
        return (txt || "")
            .replace(/\s+/g, " ")
            .trim()
            .toUpperCase();
    }

    function isPaginaReservas() {
        return /\/circ\//i.test(location.pathname) &&
               norm($("h1, h2").first().text()).includes("RESERVAS A PROCESSAR");
    }

    function moverExportarReservas() {
        if (!isPaginaReservas()) return;

        $(".dataTables_wrapper").each(function () {
            const $wrapper = $(this);

            const $toolbar = $wrapper.find(".rbmo-dt-toolbar-koha").first();
            const $buttons = $wrapper.find(".dt-buttons").filter(function () {
                return $(this).closest(".dt-button-collection").length === 0;
            }).first();

            if (!$buttons.length) return;

            const $exportar = $buttons.find("button, a").filter(function () {
                const t = norm($(this).text());
                return t.includes("EXPORTAR") || t.includes("EXPORT");
            }).first();

            if (!$exportar.length) return;

            $exportar.addClass("rbmo-exportar-reservas-destaque");

            if ($toolbar.length) {
                $buttons.prependTo($toolbar);
            } else {
                $buttons.prependTo($wrapper);
            }
        });
    }

    function addCssExportarReservas() {
        if ($("#rbmo-exportar-reservas-css").length) return;

        $("head").append(`
            <style id="rbmo-exportar-reservas-css">
                .rbmo-exportar-reservas-destaque {
                    background: #f0ad4e !important;
                    border-color: #eea236 !important;
                    color: #000 !important;
                    font-weight: bold !important;
                    padding: 7px 14px !important;
                    box-shadow: 0 2px 4px rgba(0,0,0,.25);
                }

                .rbmo-exportar-reservas-destaque i,
                .rbmo-exportar-reservas-destaque .fa,
                .rbmo-exportar-reservas-destaque .fas {
                    color: #000 !important;
                }

                .rbmo-dt-toolbar-koha > .dt-buttons {
                    order: 0 !important;
                }

                .dataTables_wrapper > .dt-buttons {
                    margin-bottom: 10px;
                    float: none !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 8px;
                }
            </style>
        `);
    }

    function init() {
        addCssExportarReservas();
        moverExportarReservas();
    }

    $(document).ready(function () {
        init();

        [300, 800, 1500, 3000].forEach(function (ms) {
            setTimeout(init, ms);
        });
    });

})();