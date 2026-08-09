/* ==========================================================
   Painel de Qualidade — Visão de Conjunto das Autoridades
   Miguel Mimoso Correia | CC-BY-NC-SA

   Ferramenta autónoma, derivada do mesmo pensamento da Caixa
   de Autoridade, mas com objectivo e ciclo de vida diferentes:
   corre na página de PESQUISA/LISTA de autoridades do Koha
   (nunca na página de edição de uma autoridade individual),
   e serve para gerir uma fila de trabalho ao longo do tempo,
   não para diagnosticar um único registo.

   Como só é possível actuar via JavaScript e leitura de DOM
   (sem acesso ao servidor nem a SQL), a varredura é feita por
   pedidos HTTP sucessivos à página de edição de cada
   autoridade, em lotes pequenos e por pedido explícito do
   utilizador — nunca de forma automática ou em massa — para
   não sobrecarregar o servidor da instituição.

   O estado de cada autoridade já analisada fica em
   localStorage, por máquina/browser. Isto é uma limitação
   assumida: não é uma base de dados partilhada pela equipa,
   é uma memória de trabalho pessoal. Duas pessoas na mesma
   equipa, em computadores diferentes, têm caches distintas.
   ========================================================== */

(function () {
    "use strict";

    if (window.__frotaAutoridadesAtivo) return;
    window.__frotaAutoridadesAtivo = true;

    var LS_KEY = "koreQC_frota_v1";
    var LOTE_DEFAULT = 10;
    var IDADE_MAXIMA_DIAS = 30; // acima disto, a autoridade é oferecida para reanálise

    $(document).ready(function () {
        if (!paginaEhListaDeAutoridades()) return;
        setTimeout(iniciar, 800);
    });

    function paginaEhListaDeAutoridades() {
        var path = window.location.pathname || "";
        var params = new URLSearchParams(window.location.search || "");
        var pareceAutoridades = path.indexOf("/cgi-bin/koha/authorities/") !== -1;
        var estaAEditarUma = !!params.get("authid");
        return pareceAutoridades && !estaAEditarUma;
    }

    function iniciar() {
        var autoridades = recolherAutoridadesDaPagina();
        if (!autoridades.length) return;
        construirPainel(autoridades);
    }

    // ---------- Recolha das autoridades visíveis na página ----------

    function recolherAutoridadesDaPagina() {
        var vistos = {};
        var lista = [];

        $('a[href*="authid="]').each(function () {
            var href = $(this).attr("href") || "";
            var m = href.match(/[?&]authid=(\d+)/i);
            if (!m) return;

            var authid = m[1];
            if (vistos[authid]) return;
            vistos[authid] = true;

            var linha = $(this).closest("tr, li");
            var nome = limparTexto(linha.length ? linha.text() : $(this).text());

            lista.push({ authid: authid, nome: nome.slice(0, 160) });
        });

        return lista;
    }

    function limparTexto(txt) {
        return String(txt || "").replace(/\s+/g, " ").trim();
    }

    function escaparHTML(str) {
        return String(str || "").replace(/[&<>"']/g, function (m) {
            return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m];
        });
    }

    // ---------- Persistência local ----------

    function lerCache() {
        try {
            return JSON.parse(localStorage.getItem(LS_KEY) || "{}");
        } catch (e) {
            return {};
        }
    }

    function gravarCache(cache) {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(cache));
        } catch (e) {
            console.warn("Painel de qualidade: falha ao gravar cache local (localStorage indisponível ou cheio).", e);
        }
    }

    function idadeEmDias(timestamp) {
        if (!timestamp) return Infinity;
        return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    }

    // ---------- Interface ----------

    function construirPainel(autoridades) {
        var html = "";

        html += '<div id="frota-qc-painel">';
        html += '  <div id="frota-qc-header">';
        html += '    <strong>Painel de qualidade das autoridades</strong>';
        html += '    <span id="frota-qc-resumo"></span>';
        html += '  </div>';
        html += '  <div id="frota-qc-nota">Ferramenta de trabalho pessoal: os resultados ficam guardados apenas neste browser, não são partilhados com outros catalogadores nem gravados no Koha.</div>';
        html += '  <div id="frota-qc-controlos">';
        html += '    <label>Analisar próximas <input type="number" id="frota-qc-lote" min="1" max="50" value="' + LOTE_DEFAULT + '"> autoridades por analisar ou desatualizadas</label>';
        html += '    <button type="button" id="frota-qc-analisar">Analisar</button>';
        html += '    <button type="button" id="frota-qc-limpar" title="Apaga a cache local desta página">Limpar cache local</button>';
        html += '    <span id="frota-qc-progresso"></span>';
        html += '  </div>';
        html += '  <div id="frota-qc-tabela-wrap">';
        html += '    <table id="frota-qc-tabela"><thead><tr>';
        html += '      <th>Authid</th><th>Nome</th><th>200$a/$b</th><th>Wikidata</th><th>VIAF</th><th>400</th><th>500</th><th>Estado</th><th>Última análise</th>';
        html += '    </tr></thead><tbody></tbody></table>';
        html += '  </div>';
        html += '</div>';

        $("body").prepend(html);
        instalarEstilos();

        $("#frota-qc-analisar").on("click", function () {
            var n = parseInt($("#frota-qc-lote").val(), 10) || LOTE_DEFAULT;
            analisarProximas(autoridades, n);
        });

        $("#frota-qc-limpar").on("click", function () {
            if (!window.confirm("Apagar a cache local do painel de qualidade neste browser? As autoridades voltam a aparecer como \"por analisar\".")) return;
            gravarCache({});
            renderTabela(autoridades, {});
        });

        renderTabela(autoridades, lerCache());
    }

    function renderTabela(autoridades, cache) {
        var corpo = $("#frota-qc-tabela tbody");
        var html = "";
        var analisadas = 0;
        var desatualizadas = 0;

        autoridades.forEach(function (a) {
            var dados = cache[a.authid];
            if (dados) {
                analisadas++;
                if (idadeEmDias(dados.actualizadoEm) > IDADE_MAXIMA_DIAS) desatualizadas++;
            }

            html += "<tr>";
            html += '<td><a href="/cgi-bin/koha/authorities/authorities.pl?authid=' + encodeURIComponent(a.authid) + '" target="_blank" rel="noopener">' + escaparHTML(a.authid) + "</a></td>";
            html += "<td>" + escaparHTML(a.nome) + "</td>";
            html += "<td>" + (dados ? (dados.temNome ? "Completo" : "Incompleto") : "—") + "</td>";
            html += "<td>" + (dados ? (dados.temWikidata ? "Sim" : "Não") : "—") + "</td>";
            html += "<td>" + (dados ? (dados.temViaf ? "Sim" : "Não") : "—") + "</td>";
            html += "<td>" + (dados ? dados.n400 : "—") + "</td>";
            html += "<td>" + (dados ? dados.n500 : "—") + "</td>";
            html += '<td><span class="frota-qc-badge frota-qc-badge-' + (dados ? classeEstado(dados.estado) : "neutro") + '">' + (dados ? escaparHTML(dados.estado) : "Por analisar") + "</span></td>";
            html += "<td>" + (dados ? formatarData(dados.actualizadoEm) + (idadeEmDias(dados.actualizadoEm) > IDADE_MAXIMA_DIAS ? " (desatualizado)" : "") : "—") + "</td>";
            html += "</tr>";
        });

        corpo.html(html);
        $("#frota-qc-resumo").text(
            analisadas + " de " + autoridades.length + " autoridades visíveis já analisadas nesta máquina" +
            (desatualizadas ? " (" + desatualizadas + " há mais de " + IDADE_MAXIMA_DIAS + " dias)" : "") + "."
        );
    }

    function classeEstado(estado) {
        if (estado === "Revisto") return "ok";
        if (estado === "Sem identificadores") return "warn";
        if (estado === "Erro de leitura") return "bad";
        if (estado === "200$a ausente") return "bad";
        return "neutro";
    }

    function formatarData(timestamp) {
        try {
            return new Date(timestamp).toLocaleDateString("pt-PT") + " " + new Date(timestamp).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
        } catch (e) {
            return "—";
        }
    }

    // ---------- Varredura por lotes ----------

    function analisarProximas(autoridades, n) {
        var cache = lerCache();
        var pendentes = autoridades.filter(function (a) {
            var dados = cache[a.authid];
            return !dados || idadeEmDias(dados.actualizadoEm) > IDADE_MAXIMA_DIAS;
        }).slice(0, n);

        if (!pendentes.length) {
            $("#frota-qc-progresso").text("Todas as autoridades visíveis nesta página já foram analisadas recentemente.");
            return;
        }

        var indice = 0;
        $("#frota-qc-analisar").prop("disabled", true);

        function seguinte() {
            if (indice >= pendentes.length) {
                $("#frota-qc-analisar").prop("disabled", false);
                $("#frota-qc-progresso").text("Concluído: " + pendentes.length + " autoridade(s) analisada(s) neste lote.");
                renderTabela(autoridades, lerCache());
                return;
            }

            var alvo = pendentes[indice];
            $("#frota-qc-progresso").text("A analisar " + (indice + 1) + " / " + pendentes.length + " — authid " + alvo.authid);

            analisarAutoridadeRemota(alvo.authid).always(function (resumo) {
                var cacheAtual = lerCache();
                cacheAtual[alvo.authid] = resumo;
                gravarCache(cacheAtual);
                indice++;
                seguinte();
            });
        }

        seguinte();
    }

    function analisarAutoridadeRemota(authid) {
        var deferred = $.Deferred();

        $.ajax({
            url: "/cgi-bin/koha/authorities/authorities.pl?authid=" + encodeURIComponent(authid),
            method: "GET",
            dataType: "html",
            timeout: 15000
        }).done(function (html) {
            var doc = $("<div>").append($.parseHTML(html, document, true));
            var resumo = extrairResumoAutoridade(doc);
            resumo.actualizadoEm = Date.now();
            deferred.resolve(resumo);
        }).fail(function () {
            deferred.resolve({
                temNome: false,
                temWikidata: false,
                temViaf: false,
                n400: 0,
                n500: 0,
                estado: "Erro de leitura",
                actualizadoEm: Date.now()
            });
        });

        return deferred.promise();
    }

    // Leitura simplificada e AUTÓNOMA da estrutura da autoridade.
    // Não reutiliza o motor da Caixa de Autoridade porque este foi
    // desenhado para ler um formulário aberto e ao vivo; aqui a
    // página é obtida remotamente, por isso a extracção é feita
    // à parte, sobre o HTML devolvido.
    function extrairResumoAutoridade(doc) {
        var texto = limparTexto(doc.text());

        var temNomeA = campoTemValorPreenchido(doc, "Palavra de ordem");
        var temNomeB = campoTemValorPreenchido(doc, "Outra parte do nome");

        var temWikidata = /wikidata/i.test(texto) && /\bQ\d{3,}\b/.test(texto);
        var temViaf = /viaf/i.test(texto);

        var n400 = contarEtiquetaDeCampo(doc, "400");
        var n500 = contarEtiquetaDeCampo(doc, "500");

        var estado = "Revisto";
        if (!temNomeA) estado = "200$a ausente";
        else if (!temWikidata && !temViaf) estado = "Sem identificadores";

        return {
            temNome: temNomeA && temNomeB,
            temWikidata: temWikidata,
            temViaf: temViaf,
            n400: n400,
            n500: n500,
            estado: estado
        };
    }

    function campoTemValorPreenchido(doc, etiqueta) {
        var encontrado = false;

        doc.find("li, div, tr").each(function () {
            var bloco = $(this);
            if (limparTexto(bloco.text()).indexOf(etiqueta) === -1) return;

            var input = bloco.find("input[type='text'], textarea").filter(function () {
                return limparTexto($(this).val()).length > 0;
            }).first();

            if (input.length) {
                encontrado = true;
                return false;
            }
        });

        return encontrado;
    }

    function contarEtiquetaDeCampo(doc, etiquetaCampo) {
        var contagem = 0;
        var re = new RegExp("\\b" + etiquetaCampo + "\\b");

        doc.find("li, div, tr").each(function () {
            var texto = limparTexto($(this).text());
            if (re.test(texto) && texto.indexOf("Palavra de ordem") !== -1) contagem++;
        });

        return contagem;
    }

    // ---------- Estilos ----------

    function instalarEstilos() {
        if ($("#frota-qc-estilos").length) return;

        var css = "" +
            "#frota-qc-painel{margin:14px 0;border:1px solid #d0d7de;border-radius:4px;background:#fff;font-family:Inter,Arial,sans-serif;font-size:12px;color:#1f2937;}" +
            "#frota-qc-header{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #e5e7eb;}" +
            "#frota-qc-header strong{font-size:14px;color:#111827;}" +
            "#frota-qc-resumo{color:#667085;font-size:11.5px;}" +
            "#frota-qc-nota{padding:6px 12px;background:#fffbeb;border-bottom:1px solid #fde68a;color:#92400e;font-size:11px;}" +
            "#frota-qc-controlos{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #e5e7eb;background:#f8fafc;}" +
            "#frota-qc-controlos input{width:52px;padding:3px 5px;border:1px solid #cbd5e1;border-radius:2px;}" +
            "#frota-qc-controlos button{padding:5px 10px;border:1px solid #cbd5e1;background:#fff;border-radius:2px;cursor:pointer;}" +
            "#frota-qc-controlos button:hover{background:#f1f5f9;}" +
            "#frota-qc-progresso{color:#475467;}" +
            "#frota-qc-tabela-wrap{max-height:440px;overflow:auto;}" +
            "#frota-qc-tabela{width:100%;border-collapse:collapse;}" +
            "#frota-qc-tabela th{position:sticky;top:0;background:#f8fafc;text-align:left;padding:6px 8px;border-bottom:1px solid #d0d7de;font-size:11px;}" +
            "#frota-qc-tabela td{padding:6px 8px;border-bottom:1px solid #edf0f2;}" +
            ".frota-qc-badge{display:inline-block;padding:2px 7px;border-radius:999px;font-size:10.5px;font-weight:700;}" +
            ".frota-qc-badge-ok{background:#ecfdf3;color:#05603a;}" +
            ".frota-qc-badge-warn{background:#fffaeb;color:#b54708;}" +
            ".frota-qc-badge-bad{background:#fef3f2;color:#b42318;}" +
            ".frota-qc-badge-neutro{background:#f1f5f9;color:#475467;}";

        $("<style>").attr("id", "frota-qc-estilos").text(css).appendTo("head");
    }

})();
