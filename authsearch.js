/* ==========================================================
   AUTHSEARCH — Pesquisa de identificadores Wikidata / VIAF
   Miguel Mimoso Correia | CC-BY-NC-SA

   Corre na página de edição de uma autoridade do Koha
   (intranet). Pesquisa pessoas humanas no Wikidata (filtradas
   por P31 = Q5) e registos no VIAF, e permite aplicar o
   identificador escolhido ao campo 017 da autoridade.

   É o ÚNICO dos dois ficheiros (authbox.js / authsearch.js)
   que escreve num campo do formulário. A escrita fica sempre
   confinada ao preenchimento de inputs já existentes no
   formulário do Koha, tal como se o catalogador os tivesse
   preenchido à mão; a gravação continua a depender sempre do
   botão nativo "Gravar" do Koha.
   ========================================================== */

(function () {
    "use strict";

    if (window.__authsearchAtivo) return;
    window.__authsearchAtivo = true;

    $(document).ready(function () {
        if (!paginaAtualEhEditorAutoridade()) return;

        var CONFIG = { maxResultadosWikidata: 50, maxMostrarWikidata: 8, maxResultadosVIAF: 8 };

        $("#authsearch").remove();
        construirInterface();
        instalarEstilos();
        preencherTermoInicial();
        atualizarLinksExternos();
        ligarEventos();

        // ---------------------------------------------------------------
        // Guarda de página e utilitários
        // ---------------------------------------------------------------

        function paginaAtualEhEditorAutoridade() {
            var path = window.location.pathname || "";
            var params = new URLSearchParams(window.location.search || "");
            var paginaAutoridade =
                path.indexOf("/cgi-bin/koha/authorities/authorities.pl") !== -1 ||
                path.indexOf("/authorities/authorities.pl") !== -1;
            if (!paginaAutoridade) return false;
            return !!params.get("authid") || params.has("authtypecode");
        }

        function limparTexto(txt) { return String(txt || "").replace(/\s+/g, " ").trim(); }

        function escaparHTML(txt) {
            return String(txt || "")
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }

        function escaparSelector(txt) {
            if ($.escapeSelector) return $.escapeSelector(txt);
            return String(txt || "").replace(/([ #;?%&,.+*~':"!^$[\]()=>|\/@])/g, "\\$1");
        }

        function removerDuplicados(lista) {
            var vistos = {}; var resultado = [];
            $.each(lista || [], function (i, v) { v = limparTexto(v); if (!v || vistos[v]) return; vistos[v] = true; resultado.push(v); });
            return resultado;
        }

        // ---------------------------------------------------------------
        // Leitura mínima do 200, só para pré-preencher o termo de pesquisa
        // ---------------------------------------------------------------

        function obterNomeAtualDaAutoridade() {
            var campo = $();
            $("li").each(function () {
                var li = $(this);
                var texto = limparTexto(li.text());
                if (texto.indexOf("200") !== -1 && texto.indexOf("Palavra de ordem") !== -1) { campo = li; return false; }
            });
            if (!campo.length) return "";

            var nomeA = obterValorSubcampo(campo, "Palavra de ordem");
            var nomeB = obterValorSubcampo(campo, "Outra parte do nome");
            return limparTexto([nomeB, nomeA].filter(Boolean).join(" "));
        }

        function obterValorSubcampo(campo, etiqueta) {
            var valor = "";
            campo.find("li, div, p, tr").each(function () {
                var linha = $(this);
                if (limparTexto(linha.text()).indexOf(etiqueta) === -1) return;
                var input = linha.find("input[type='text'], textarea").filter(function () {
                    return $(this).is(":visible") && $(this).outerWidth() > 70;
                }).last();
                if (input.length) { valor = limparTexto(input.val()); return false; }
            });
            return valor;
        }

        function preencherTermoInicial() {
            var nome = obterNomeAtualDaAutoridade();
            if (nome) $("#authsearch-termo").val(nome);
        }

        // ---------------------------------------------------------------
        // Localização e escrita do campo 017 (única escrita deste conjunto
        // de ferramentas)
        // ---------------------------------------------------------------

        function encontrarCampos017() {
            var campos = []; var vistos = {};
            $("li, div, tr").each(function () {
                var bloco = $(this);
                var texto = limparTexto(bloco.text());
                if (texto.indexOf("017") === -1 || texto.indexOf("Identificador") === -1 || texto.indexOf("Sistema de codificação") === -1) return;

                var campoA = encontrarCampoPorEtiqueta(bloco, "Identificador");
                var campo2 = encontrarCampoPorEtiqueta(bloco, "Sistema de codificação");
                if (!campoA.length || !campo2.length) return;

                var chave = (campoA.attr("id") || campoA.attr("name") || "") + "|" + (campo2.attr("id") || campo2.attr("name") || "");
                if (!chave || vistos[chave]) return;
                vistos[chave] = true;

                campos.push({ campoA: campoA, campo2: campo2, indicador1: encontrarIndicador017(bloco) });
            });
            return campos;
        }

        function encontrarCampoPorEtiqueta(bloco, etiqueta) {
            var resultado = $();
            bloco.find("label").each(function () {
                var label = $(this);
                if (limparTexto(label.text()).indexOf(etiqueta) === -1) return;
                var idCampo = label.attr("for");
                if (idCampo && $("#" + escaparSelector(idCampo)).length) { resultado = $("#" + escaparSelector(idCampo)); return false; }
                var linha = label.closest("li, div, tr, p");
                var input = linha.find("input[type='text'], textarea").filter(function () {
                    var valor = limparTexto($(this).val());
                    var largura = $(this).outerWidth();
                    return largura > 100 && valor !== "a" && valor !== "2" && valor !== "017";
                }).first();
                if (input.length) { resultado = input; return false; }
            });
            return resultado;
        }

        function encontrarIndicador017(bloco) {
            var indicador = $();
            bloco.find("input[type='text']").each(function () {
                var input = $(this);
                var valor = limparTexto(input.val());
                var largura = input.outerWidth();
                if (largura <= 45 && (valor === "" || valor === "7" || valor.length === 1)) { indicador = input; return false; }
            });
            return indicador;
        }

        function aplicarNoCampo017(valor, fonte) {
            var campos = encontrarCampos017();
            var escolhido = null;

            $.each(campos, function (i, campo) {
                var valorA = campo.campoA.length ? limparTexto(campo.campoA.val()) : "";
                var valor2 = campo.campo2.length ? limparTexto(campo.campo2.val()) : "";
                if (!valorA && !valor2) { escolhido = campo; return false; }
            });

            if (!escolhido) {
                $("#authsearch-estado").text("Não existe campo 017 livre. Adicione um novo campo 017 vazio e volte a aplicar.");
                return;
            }

            if (escolhido.indicador1.length) escolhido.indicador1.val("7").trigger("input").trigger("change");
            escolhido.campoA.val(valor).trigger("input").trigger("change");
            escolhido.campo2.val(fonte).trigger("input").trigger("change");

            $("#authsearch-estado").html('Aplicado no 017: indicador 1 = 7, 017$a = <strong>' + escaparHTML(valor) + '</strong>, 017$2 = <strong>' + escaparHTML(fonte) + '</strong>. A gravação continua a exigir o botão "Gravar" do Koha.');
        }

        // ---------------------------------------------------------------
        // Interface
        // ---------------------------------------------------------------

        function construirInterface() {
            var html = "";
            html += '<div id="authsearch">';
            html += '  <div id="authsearch-header">';
            html += '    <div id="authsearch-header-titulo"><div id="authsearch-icone">' + iconeLupa() + '</div>';
            html += '      <div><strong>Pesquisa de identificadores</strong><p>Wikidata e VIAF. Confirme sempre os resultados antes de aplicar.</p></div></div>';
            html += '    <button type="button" id="authsearch-colapsar">' + iconeSeta() + ' <span id="authsearch-colapsar-txt">Ocultar</span></button>';
            html += '  </div>';
            html += '  <div id="authsearch-corpo"><div id="authsearch-corpo-inner">';
            html += '    <div id="authsearch-linha-pesquisa">';
            html += '      <input type="text" id="authsearch-termo" placeholder="Nome a pesquisar">';
            html += '      <button type="button" id="authsearch-pesquisar">Pesquisar</button>';
            html += '      <a href="#" target="_blank" rel="noopener" id="authsearch-link-wikidata">Wikidata ↗</a>';
            html += '      <a href="#" target="_blank" rel="noopener" id="authsearch-link-viaf">VIAF ↗</a>';
            html += '    </div>';
            html += '    <div id="authsearch-estado"></div>';
            html += '    <div id="authsearch-grid">';
            html += '      <div class="authsearch-coluna"><h3>Wikidata</h3><div id="authsearch-resultados-wikidata"></div></div>';
            html += '      <div class="authsearch-coluna"><h3>VIAF</h3><div id="authsearch-resultados-viaf"></div></div>';
            html += '    </div>';
            html += '    <div id="authsearch-rodape"><a href="https://www.wikidata.org/wiki/Special:NewItem" target="_blank" rel="noopener">Criar item novo no Wikidata ↗</a></div>';
            html += '  </div></div>';
            html += '</div>';

            var $alvo = $("#authbox").length ? $("#authbox") :
                $("h1").first().length ? $("h1").first() :
                $("#main_intranet-main").first().length ? $("#main_intranet-main").first() :
                $("#main").first().length ? $("#main").first() : $("body").first();

            $alvo.after(html);
        }

        function ligarEventos() {
            $("#authsearch-colapsar").on("click", function () {
                var colapsado = !$("#authsearch").hasClass("colapsado");
                $("#authsearch").toggleClass("colapsado", colapsado);
                $("#authsearch-colapsar-txt").text(colapsado ? "Mostrar" : "Ocultar");
            });

            $("#authsearch-termo").on("input", atualizarLinksExternos);
            $("#authsearch-termo").on("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("#authsearch-pesquisar").click(); } });

            $("#authsearch-pesquisar").on("click", function () {
                var termo = limparTexto($("#authsearch-termo").val());
                if (!termo) { $("#authsearch-estado").text("Indique um termo de pesquisa."); return; }
                $("#authsearch-estado").text("Pesquisa enviada. Confirme sempre os resultados antes de aplicar identificadores.");
                pesquisarWikidata(termo);
                pesquisarVIAF(termo);
            });

            $(document).on("click.authsearch", ".authsearch-copiar", function () {
                var valor = $(this).data("valor"); var $btn = $(this); var original = $btn.text();
                if (!valor) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(valor).then(function () { $btn.text("Copiado"); setTimeout(function () { $btn.text(original); }, 1200); });
                } else { $("#authsearch-estado").text("Copie manualmente: " + valor); }
            });

            $(document).on("click.authsearch", ".authsearch-aplicar", function () {
                var valor = $(this).data("valor"); var fonte = $(this).data("fonte");
                if (!valor || !fonte) return;
                aplicarNoCampo017(valor, fonte);
            });
        }

        function atualizarLinksExternos() {
            var termo = limparTexto($("#authsearch-termo").val());
            var termoURL = encodeURIComponent(termo);
            $("#authsearch-link-wikidata").attr("href", termo ? "https://www.wikidata.org/w/index.php?search=" + termoURL : "https://www.wikidata.org/");
            $("#authsearch-link-viaf").attr("href", termo ? "https://viaf.org/viaf/search?query=local.names+all+%22" + termoURL + "%22&sortKeys=holdingscount&recordSchema=BriefVIAF" : "https://viaf.org/");
        }

        // ---------------------------------------------------------------
        // Pesquisa Wikidata (filtrada por P31 = Q5, pessoa humana)
        // ---------------------------------------------------------------

        function pesquisarWikidata(termo) {
            $("#authsearch-resultados-wikidata").html("<p class=\"authsearch-msg\">A pesquisar...</p>");

            $.ajax({
                url: "https://www.wikidata.org/w/api.php", dataType: "jsonp",
                data: { action: "wbsearchentities", format: "json", language: "pt", uselang: "pt", type: "item", limit: CONFIG.maxResultadosWikidata, search: termo }
            }).done(function (dados) {
                if (!dados.search || !dados.search.length) { $("#authsearch-resultados-wikidata").html("<p class=\"authsearch-msg\">Sem resultados.</p>"); return; }

                var ids = $.map(dados.search, function (i) { return i.id; }).join("|");

                $.ajax({
                    url: "https://www.wikidata.org/w/api.php", dataType: "jsonp",
                    data: { action: "wbgetentities", format: "json", ids: ids, props: "labels|descriptions|aliases|claims", languages: "pt|en" }
                }).done(function (detalhes) {
                    var humanas = {}; var lista = [];
                    $.each(dados.search, function (i, item) {
                        var entidade = detalhes.entities[item.id];
                        if (!entidade || !ehPessoaHumana(entidade)) return;
                        humanas[item.id] = entidade;
                        lista.push({ id: item.id, label: obterLabel(entidade) || item.label || "", description: obterDescricao(entidade) || item.description || "" });
                    });

                    if (!lista.length) { $("#authsearch-resultados-wikidata").html("<p class=\"authsearch-msg\">Sem resultados confirmados como pessoa humana (P31 = Q5).</p>"); return; }

                    lista = lista.slice(0, CONFIG.maxMostrarWikidata);
                    var entidadesLimitadas = {};
                    lista.forEach(function (item) { entidadesLimitadas[item.id] = humanas[item.id]; });
                    enriquecerEApresentarWikidata(lista, entidadesLimitadas);
                }).fail(function () { $("#authsearch-resultados-wikidata").html("<p class=\"authsearch-msg\">Erro ao obter detalhes do Wikidata.</p>"); });
            }).fail(function () { $("#authsearch-resultados-wikidata").html("<p class=\"authsearch-msg\">Erro ao consultar o Wikidata.</p>"); });
        }

        function ehPessoaHumana(entidade) {
            if (!entidade || !entidade.claims || !entidade.claims.P31) return false;
            var humano = false;
            $.each(entidade.claims.P31, function (i, claim) {
                try { if (claim.mainsnak.datavalue.value.id === "Q5") { humano = true; return false; } } catch (e) {}
            });
            return humano;
        }

        function enriquecerEApresentarWikidata(resultados, entidades) {
            var idsRelacionados = [];
            $.each(entidades, function (qid, entidade) {
                idsRelacionados = idsRelacionados.concat(obterIdsClaims(entidade, "P27"), obterIdsClaims(entidade, "P106"));
            });
            idsRelacionados = removerDuplicados(idsRelacionados);

            if (!idsRelacionados.length) { apresentarResultadosWikidata(resultados, entidades, {}); return; }

            $.ajax({
                url: "https://www.wikidata.org/w/api.php", dataType: "jsonp",
                data: { action: "wbgetentities", format: "json", ids: idsRelacionados.join("|"), props: "labels", languages: "pt|en" }
            }).done(function (labels) { apresentarResultadosWikidata(resultados, entidades, labels.entities || {}); })
              .fail(function () { apresentarResultadosWikidata(resultados, entidades, {}); });
        }

        function apresentarResultadosWikidata(resultados, entidades, relacionadas) {
            var html = "";
            $.each(resultados, function (i, item) {
                var qid = item.id || "";
                var entidade = entidades[qid] || {};
                var label = obterLabel(entidade) || item.label || "";
                var descricao = obterDescricao(entidade) || item.description || "";
                var imagem = obterImagemWikidata(entidade);
                var paises = obterLabelsClaims(entidade, "P27", relacionadas);
                var nascimento = obterData(entidade, "P569");
                var morte = obterData(entidade, "P570");
                var ocupacoes = obterLabelsClaims(entidade, "P106", relacionadas);

                html += '<div class="authsearch-item">';
                html += '<div class="authsearch-item-layout' + (imagem ? '' : ' sem-imagem') + '">';
                html += imagem ? ('<img class="authsearch-item-img" src="' + escaparHTML(imagem) + '" alt="">') : '<div class="authsearch-item-img-vazia"></div>';
                html += '<div class="authsearch-item-info">';
                html += '<div class="authsearch-item-label">' + escaparHTML(label) + '</div>';
                if (descricao) html += '<div class="authsearch-item-desc">' + escaparHTML(descricao) + '</div>';
                html += '<div class="authsearch-item-id">' + escaparHTML(qid) + '</div>';
                if (paises.length) html += '<div class="authsearch-item-meta"><strong>País:</strong> ' + escaparHTML(paises.join(", ")) + '</div>';
                if (nascimento) html += '<div class="authsearch-item-meta"><strong>Nascimento:</strong> ' + escaparHTML(nascimento) + '</div>';
                if (morte) html += '<div class="authsearch-item-meta"><strong>Morte:</strong> ' + escaparHTML(morte) + '</div>';
                if (ocupacoes.length) html += '<div class="authsearch-item-meta"><strong>Ocupação:</strong> ' + escaparHTML(ocupacoes.join(", ")) + '</div>';
                html += '<div class="authsearch-item-acoes">';
                html += '<a class="authsearch-btn" href="https://www.wikidata.org/wiki/' + encodeURIComponent(qid) + '" target="_blank" rel="noopener">Abrir</a>';
                html += '<button type="button" class="authsearch-btn authsearch-copiar" data-valor="' + escaparHTML(qid) + '">Copiar QID</button>';
                html += '<button type="button" class="authsearch-btn authsearch-btn-aplicar authsearch-aplicar" data-valor="' + escaparHTML(qid) + '" data-fonte="wikidata">Aplicar ao 017</button>';
                html += '</div></div></div></div>';
            });
            $("#authsearch-resultados-wikidata").html(html);
        }

        function obterImagemWikidata(entidade) {
            if (!entidade || !entidade.claims || !entidade.claims.P18 || !entidade.claims.P18.length) return "";
            try {
                var ficheiro = entidade.claims.P18[0].mainsnak.datavalue.value;
                return ficheiro ? "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(ficheiro) + "?width=180" : "";
            } catch (e) { return ""; }
        }

        function obterIdsClaims(entidade, prop) {
            var ids = [];
            if (!entidade || !entidade.claims || !entidade.claims[prop]) return ids;
            $.each(entidade.claims[prop], function (i, claim) {
                try { var id = claim.mainsnak.datavalue.value.id; if (id) ids.push(id); } catch (e) {}
            });
            return ids;
        }

        function obterLabelsClaims(entidade, prop, relacionadas) {
            var labels = [];
            obterIdsClaims(entidade, prop).forEach(function (id) { var l = obterLabel(relacionadas[id]); if (l) labels.push(l); });
            return removerDuplicados(labels);
        }

        function obterLabel(entidade) {
            if (!entidade || !entidade.labels) return "";
            if (entidade.labels.pt) return entidade.labels.pt.value;
            if (entidade.labels.en) return entidade.labels.en.value;
            return "";
        }

        function obterDescricao(entidade) {
            if (!entidade || !entidade.descriptions) return "";
            if (entidade.descriptions.pt) return entidade.descriptions.pt.value;
            if (entidade.descriptions.en) return entidade.descriptions.en.value;
            return "";
        }

        function obterData(entidade, prop) {
            if (!entidade || !entidade.claims || !entidade.claims[prop] || !entidade.claims[prop].length) return "";
            try {
                var v = entidade.claims[prop][0].mainsnak.datavalue.value;
                var data = v.time.replace("+", "").replace("Z", "");
                var partes = data.split("T")[0].split("-");
                if (partes.length < 3) return "";
                if (partes[1] === "00") return partes[0];
                if (partes[2] === "00") return partes[1] + "/" + partes[0];
                return partes[2] + "/" + partes[1] + "/" + partes[0];
            } catch (e) { return ""; }
        }

        // ---------------------------------------------------------------
        // Pesquisa VIAF
        // ---------------------------------------------------------------

        function pesquisarVIAF(termo) {
            $("#authsearch-resultados-viaf").html("<p class=\"authsearch-msg\">A pesquisar...</p>");

            $.ajax({ url: "https://viaf.org/viaf/AutoSuggest?query=" + encodeURIComponent(termo), dataType: "json" })
                .done(function (dados) {
                    if (!dados.result || !dados.result.length) { $("#authsearch-resultados-viaf").html("<p class=\"authsearch-msg\">Sem resultados.</p>"); return; }

                    var html = "";
                    $.each(dados.result.slice(0, CONFIG.maxResultadosVIAF), function (i, item) {
                        var viafid = item.viafid || "";
                        var termoResultado = item.term || item.displayForm || "";
                        html += '<div class="authsearch-item"><div class="authsearch-item-label">' + escaparHTML(termoResultado) + '</div>';
                        html += '<div class="authsearch-item-id">VIAF ' + escaparHTML(viafid) + '</div>';
                        html += '<div class="authsearch-item-acoes">';
                        html += '<a class="authsearch-btn" href="https://viaf.org/viaf/' + encodeURIComponent(viafid) + '" target="_blank" rel="noopener">Abrir</a>';
                        html += '<button type="button" class="authsearch-btn authsearch-copiar" data-valor="' + escaparHTML(viafid) + '">Copiar VIAF</button>';
                        html += '<button type="button" class="authsearch-btn authsearch-btn-aplicar authsearch-aplicar" data-valor="' + escaparHTML(viafid) + '" data-fonte="viaf">Aplicar ao 017</button>';
                        html += '</div></div>';
                    });
                    $("#authsearch-resultados-viaf").html(html);
                })
                .fail(function () {
                    var link = "https://viaf.org/viaf/search?query=local.names+all+%22" + encodeURIComponent(termo) + "%22&sortKeys=holdingscount&recordSchema=BriefVIAF";
                    $("#authsearch-resultados-viaf").html('<p class="authsearch-msg">Erro ao consultar automaticamente o VIAF.</p><p><a class="authsearch-btn" href="' + link + '" target="_blank" rel="noopener">Pesquisar directamente no VIAF</a></p>');
                });
        }

        // ---------------------------------------------------------------
        // Ícones
        // ---------------------------------------------------------------

        function svg(path) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>'; }
        function iconeLupa() { return svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'); }
        function iconeSeta() { return svg('<path d="M6 9l6 6 6-6"/>'); }

        // ---------------------------------------------------------------
        // Estilos
        // ---------------------------------------------------------------

        function instalarEstilos() {
            if ($("#authsearch-estilos").length) return;
            var css = "" +
                "#authsearch{font-family:Inter,Arial,sans-serif;font-size:12.5px;color:#16212c;background:#fff;border:1px solid #d9e2ea;border-radius:8px;box-shadow:0 1px 2px rgba(16,24,32,.04),0 8px 20px rgba(16,24,32,.045);overflow:hidden;margin:14px 0;}" +
                "#authsearch *{box-sizing:border-box;}" +
                "#authsearch-header{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:14px 18px;border-bottom:1px solid #e5ebf0;background:linear-gradient(180deg,#fff 0%,#fbfdfe 100%);}" +
                "#authsearch-header-titulo{display:flex;gap:11px;align-items:flex-start;}" +
                "#authsearch-icone{width:32px;height:32px;border-radius:8px;flex:0 0 32px;background:linear-gradient(135deg,#6a3fb5 0%,#4c2a86 100%);display:flex;align-items:center;justify-content:center;}" +
                "#authsearch-icone svg{width:16px;height:16px;stroke:#fff;}" +
                "#authsearch-header-titulo strong{font-size:14.5px;font-weight:750;}" +
                "#authsearch-header-titulo p{margin:2px 0 0;font-size:11px;color:#5b6b78;}" +
                "#authsearch-colapsar{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:6px;border:1px solid #c7d2da;background:#fff;font-size:11px;font-weight:650;color:#5b6b78;cursor:pointer;font-family:inherit;}" +
                "#authsearch-colapsar svg{width:12px;height:12px;transition:transform .15s ease;}" +
                "#authsearch.colapsado #authsearch-colapsar svg{transform:rotate(-90deg);}" +
                "#authsearch-corpo{display:grid;grid-template-rows:1fr;transition:grid-template-rows .15s ease;}" +
                "#authsearch.colapsado #authsearch-corpo{grid-template-rows:0fr;}" +
                "#authsearch-corpo-inner{overflow:hidden;}" +
                "#authsearch-linha-pesquisa{display:flex;gap:8px;align-items:center;padding:14px 18px 8px;flex-wrap:wrap;}" +
                "#authsearch-termo{flex:1;min-width:260px;padding:8px 10px;border:1px solid #c7d2da;border-radius:6px;font-size:13px;font-family:inherit;}" +
                "#authsearch-pesquisar{padding:8px 15px;border-radius:6px;border:1px solid transparent;background:#0b4f6c;color:#fff;font-size:12px;font-weight:650;cursor:pointer;font-family:inherit;}" +
                "#authsearch-link-wikidata,#authsearch-link-viaf{padding:8px 12px;border-radius:6px;border:1px solid #c7d2da;background:#fff;color:#5b6b78;font-size:11.5px;font-weight:650;text-decoration:none;}" +
                "#authsearch-estado{padding:0 18px 8px;font-size:11.5px;color:#5b6b78;}" +
                "#authsearch-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:0 18px 14px;}" +
                "@media(max-width:820px){#authsearch-grid{grid-template-columns:1fr;}}" +
                ".authsearch-coluna{border:1px solid #e5ebf0;border-radius:6px;padding:12px;background:#fbfcfd;}" +
                ".authsearch-coluna h3{margin:0 0 9px;font-size:12.5px;font-weight:700;}" +
                ".authsearch-msg{color:#5b6b78;font-size:12px;}" +
                ".authsearch-item{padding:9px 0;border-top:1px solid #edf0f2;}" +
                ".authsearch-item:first-child{border-top:none;}" +
                ".authsearch-item-layout{display:grid;grid-template-columns:60px 1fr;gap:10px;align-items:start;}" +
                ".authsearch-item-layout.sem-imagem{grid-template-columns:1fr;}" +
                ".authsearch-item-img{width:60px;height:78px;object-fit:cover;border:1px solid #d9e2ea;border-radius:4px;}" +
                ".authsearch-item-img-vazia{width:60px;height:78px;background:#eef2f5;border-radius:4px;}" +
                ".authsearch-item-label{font-weight:700;font-size:13px;}" +
                ".authsearch-item-desc{font-size:11.5px;color:#5b6b78;margin-top:2px;}" +
                ".authsearch-item-id{font-family:ui-monospace,Consolas,monospace;font-size:11.5px;color:#0b4f6c;margin-top:4px;}" +
                ".authsearch-item-meta{font-size:11px;color:#374151;margin-top:3px;}" +
                ".authsearch-item-meta strong{font-weight:700;color:#16212c;}" +
                ".authsearch-item-acoes{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;}" +
                ".authsearch-btn{display:inline-flex;align-items:center;padding:5px 10px;border:1px solid #c7d2da;background:#fff;border-radius:5px;font-size:10.5px;font-weight:650;color:#374151;text-decoration:none;cursor:pointer;font-family:inherit;}" +
                ".authsearch-btn:hover{background:#f1f4f6;}" +
                ".authsearch-btn-aplicar{background:#0b4f6c;border-color:#0b4f6c;color:#fff;}" +
                ".authsearch-btn-aplicar:hover{background:#0a4560;}" +
                "#authsearch-rodape{padding:0 18px 14px;}" +
                "#authsearch-rodape a{font-size:11.5px;color:#0b4f6c;font-weight:650;text-decoration:none;}";

            $("<style>").attr("id", "authsearch-estilos").text(css).appendTo("head");
        }

    });

})();
