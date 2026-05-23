/* ==============================================================================================================================
   MOSTRA Nº DE REGISTO
   ============================================================================================================================== */
$(document).ready(function () {
    if (window.location.pathname.match(/catalogue\/detail\.pl/)) {
        var params = new URLSearchParams(window.location.search);
        var bib = params.get("biblionumber");

        if (bib) {
            var linhaRegisto = $("<div>")
                .addClass("recordnumber")
                .css({
                    "font-weight": "bold",
                    "margin-top": "4px",
                    "color": "#003366"
                })
                .text("N.º de registo: " + bib);

            var colecao = $('.bibliodetails tr:contains("Coleção"), .bibliodetails div:contains("Coleção")').first();

            if (colecao.length) {
                colecao.after(linhaRegisto);
            } else {
                $(".bibliodetails, #catalogue_detail_biblio").append(linhaRegisto);
            }
        }
    }
});