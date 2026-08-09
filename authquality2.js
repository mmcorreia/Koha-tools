/* ==========================================================
   Painel de Qualidade — Visão de Conjunto das Autoridades
   Miguel Mimoso Correia | CC-BY-NC-SA

   Ferramenta autónoma, derivada do mesmo pensamento da Caixa
   de Autoridade, mas com objectivo e ciclo de vida diferentes:
   corre na página de PESQUISA/LISTA de autoridades do Koha
   (nunca na página de edição de uma autoridade individual),
   e serve para gerir uma fila de trabalho ao longo do tempo,
   não para diagnosticar um único registo.

   LEITURA/ESCRITA NO KOHA: nenhuma. Todos os pedidos de rede
   feitos por este script são GET (leitura). Nada aqui grava,
   submete formulários, nem altera a base de dados do Koha.

   PERSISTÊNCIA: tudo o que este script guarda vive em
   localStorage, por browser/máquina. Isto tem duas
   implicações assumidas de propósito:
   - os FACTOS sobre um registo (tem $9, tem Wikidata, etc.)
     nunca precisam de sincronização entre colegas, porque são
     lidos sempre da página viva do Koha em cada análise;
   - as DECISÕES humanas sobre falsos positivos do motor
     (não são factos, são leituras de contexto que o motor não
     consegue inferir sozinho) é que precisam de ser partilhadas
     manualmente entre a equipa, por exportação/importação de
     um ficheiro .json — não há servidor disponível para o
     fazer de outra forma.
   ========================================================== */

(function () {
    "use strict";

    if (window.__frotaAutoridadesAtivo) return;
    window.__frotaAutoridadesAtivo = true;

    var LS_CACHE = "koreQC_frota_v1";
    var LS_MARCACOES = "koreQC_frota_marcacoes_v1";
    var LS_COLAPSADO = "koreQC_frota_colapsado_v1";
    var LOTE_DEFAULT = 10;
    var IDADE_MAXIMA_DIAS = 30;

    var ESTADO = {
        autoridades: [],
        tipoActivo: "todos"
    };

    $(document).ready(function () {
        if (!paginaEhListaDeAutoridades()) return;
        setTimeout(iniciar, 800);
    });

    // ---------- Guarda de página ----------

    function paginaEhListaDeAutoridades() {
        var path = window.location.pathname || "";
        var params = new URLSearchParams(window.location.search || "");
        var pareceAutoridades = path.indexOf("/cgi-bin/koha/authorities/") !== -1;
        var estaAEditarUma = !!params.get("authid");
        return pareceAutoridades && !estaAEditarUma;
    }

    function iniciar() {
        ESTADO.autoridades = recolherAutoridadesDaPagina();
        if (!ESTADO.autoridades.length) return;

        construirPainel();
        renderTudo();
    }

    // ---------- Utilitários ----------

    function limparTexto(txt) {
        return String(txt || "").replace(/\s+/g, " ").trim();
    }

    function escaparHTML(str) {
        return String(str || "").replace(/[&<>"']/g, function (m) {
            return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[m];
        });
    }

    function idadeEmDias(timestamp) {
        if (!timestamp) return Infinity;
        return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
    }

    function formatarData(timestamp) {
        if (!timestamp) return "—";
        try {
            var d = new Date(timestamp);
            return d.toLocaleDateString("pt-PT") + " " + d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
        } catch (e) {
            return "—";
        }
    }

    // Melhor esforço para identificar quem está a usar o Koha, só para
    // assinar as marcações partilhadas. Se a estrutura da página não
    // corresponder, cai num rótulo genérico em vez de falhar.
    function obterUtilizadorAtual() {
        var candidatos = [
            $("#logged-in-info-full").text(),
            $(".loggedinusername").text(),
            $("#header_user").text()
        ];

        for (var i = 0; i < candidatos.length; i++) {
            var t = limparTexto(candidatos[i]);
            if (t) return t.slice(0, 60);
        }

        return "Utilizador deste posto";
    }

    // ---------- Recolha das autoridades visíveis na página ----------
    // Lê directamente as linhas da tabela de resultados: além do authid
    // e do nome, lê também a coluna de tipo (ex.: "Assunto", "Pessoa
    // como Autor"), assumindo que é a segunda coluna da tabela, tal
    // como na listagem nativa do Koha no momento em que este script
    // foi escrito. Se o Koha mudar a ordem das colunas, o tipo pode
    // vir errado — vale a pena confirmar visualmente após actualizações
    // do Koha.

    function recolherAutoridadesDaPagina() {
        var vistos = {};
        var lista = [];

        $("table tr").each(function () {
            var $tr = $(this);
            var $link = $tr.find('a[href*="authid="]').first();
            if (!$link.length) return;

            var href = $link.attr("href") || "";
            var m = href.match(/[?&]authid=(\d+)/i);
            if (!m) return;

            var authid = m[1];
            if (vistos[authid]) return;
            vistos[authid] = true;

            var nome = limparTexto($link.text());
            if (!nome) return;

            var celulas = $tr.find("td");
            var tipo = celulas.length > 1 ? limparTexto($(celulas.get(1)).text()) : "";

            lista.push({
                authid: authid,
                nome: nome.slice(0, 160),
                tipo: tipo || "Não identificado"
            });
        });

        return lista;
    }

    function autoridadesFiltradas() {
        if (ESTADO.tipoActivo === "todos") return ESTADO.autoridades;
        return ESTADO.autoridades.filter(function (a) { return a.tipo === ESTADO.tipoActivo; });
    }

    function agruparPorTipo(autoridades) {
        var grupos = {};
        autoridades.forEach(function (a) {
            grupos[a.tipo] = (grupos[a.tipo] || 0) + 1;
        });
        return grupos;
    }

    // ---------- Persistência: cache de análise (factos) ----------

    function lerCache() {
        try {
            return JSON.parse(localStorage.getItem(LS_CACHE) || "{}");
        } catch (e) {
            return {};
        }
    }

    function gravarCache(cache) {
        try {
            localStorage.setItem(LS_CACHE, JSON.stringify(cache));
        } catch (e) {
            console.warn("Painel de qualidade: falha ao gravar cache local.", e);
        }
    }

    // ---------- Persistência: marcações partilháveis (falsos positivos) ----------

    function lerMarcacoes() {
        try {
            return JSON.parse(localStorage.getItem(LS_MARCACOES) || "{}");
        } catch (e) {
            return {};
        }
    }

    function gravarMarcacoes(marcacoes) {
        try {
            localStorage.setItem(LS_MARCACOES, JSON.stringify(marcacoes));
        } catch (e) {
            console.warn("Painel de qualidade: falha ao gravar marcações locais.", e);
        }
    }

    function marcarAutoridade(authid, estado, nota) {
        var marcacoes = lerMarcacoes();

        if (!estado) {
            delete marcacoes[authid];
        } else {
            marcacoes[authid] = {
                estado: estado,
                nota: nota || "",
                por: obterUtilizadorAtual(),
                em: Date.now()
            };
        }

        gravarMarcacoes(marcacoes);
        renderTudo();
    }

    function exportarMarcacoes() {
        var marcacoes = lerMarcacoes();
        var linhas = [];

        Object.keys(marcacoes).forEach(function (authid) {
            var m = marcacoes[authid];
            if (m.estado !== "falso_positivo") return;

            var autoridade = ESTADO.autoridades.filter(function (a) { return a.authid === authid; })[0];

            linhas.push({
                authid: authid,
                nome: autoridade ? autoridade.nome : "",
                estado: m.estado,
                nota: m.nota || "",
                por: m.por || "",
                em: m.em || Date.now()
            });
        });

        if (!linhas.length) {
            window.alert("Não há falsos positivos confirmados para exportar.");
            return;
        }

        var conteudo = JSON.stringify({ tipo: "koreQC_falsos_positivos", versao: 1, exportadoEm: Date.now(), itens: linhas }, null, 2);
        var blob = new Blob([conteudo], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        var dataFicheiro = new Date().toISOString().slice(0, 10);

        a.href = url;
        a.download = "falsos-positivos-autoridades-" + dataFicheiro + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importarMarcacoes(ficheiro) {
        var leitor = new FileReader();

        leitor.onload = function () {
            var dados;

            try {
                dados = JSON.parse(leitor.result);
            } catch (e) {
                window.alert("Não foi possível ler o ficheiro: não é um JSON válido.");
                return;
            }

            var itens = (dados && dados.itens) || [];
            if (!itens.length) {
                window.alert("O ficheiro não contém marcações reconhecíveis.");
                return;
            }

            var marcacoes = lerMarcacoes();
            var importados = 0;
            var ignorados = 0;

            itens.forEach(function (item) {
                if (!item || !item.authid || item.estado !== "falso_positivo") { ignorados++; return; }

                var existente = marcacoes[item.authid];

                // Em caso de conflito, mantém sempre a marcação mais recente.
                if (existente && existente.em && item.em && existente.em >= item.em) {
                    ignorados++;
                    return;
                }

                marcacoes[item.authid] = {
                    estado: "falso_positivo",
                    nota: item.nota || "",
                    por: item.por || "Importado",
                    em: item.em || Date.now()
                };
                importados++;
            });

            gravarMarcacoes(marcacoes);
            renderTudo();
            window.alert("Importação concluída: " + importados + " marcação(ões) aplicada(s), " + ignorados + " ignorada(s) (já mais recentes ou inválidas).");
        };

        leitor.readAsText(ficheiro);
    }

    // ---------- Colapsar / expandir ----------

    function lerColapsado() {
        try {
            return localStorage.getItem(LS_COLAPSADO) === "1";
        } catch (e) {
            return false;
        }
    }

    function gravarColapsado(valor) {
        try {
            localStorage.setItem(LS_COLAPSADO, valor ? "1" : "0");
        } catch (e) { /* silencioso: colapsar é conveniência, não é crítico */ }
    }

    // ---------- Construção da interface (estrutura fixa, uma vez) ----------

    function construirPainel() {
        var html = "";

        html += '<div id="frota-qc-painel">';

        html += '  <div id="frota-qc-header">';
        html += '    <div id="frota-qc-header-titulo">';
        html += '      <div id="frota-qc-icone">' + iconeOk() + '</div>';
        html += '      <div><strong>Painel de qualidade das autoridades</strong>';
        html += '      <p>Visão de conjunto das autoridades visíveis nesta pesquisa. Analisa em lotes pequenos, por pedido explícito, e guarda o progresso apenas neste browser.</p></div>';
        html += '    </div>';
        html += '    <div id="frota-qc-header-acoes">';
        html += '      <span id="frota-qc-aviso">' + iconeAviso() + ' Dados guardados só neste computador</span>';
        html += '      <button type="button" id="frota-qc-colapsar">' + iconeSeta() + ' <span id="frota-qc-colapsar-txt">Ocultar painel</span></button>';
        html += '    </div>';
        html += '  </div>';

        html += '  <div id="frota-qc-resumo-colapsado"></div>';

        html += '  <div id="frota-qc-corpo"><div id="frota-qc-corpo-inner">';

        html += '    <div id="frota-qc-tipos"></div>';
        html += '    <div id="frota-qc-partilha"></div>';
        html += '    <div id="frota-qc-cobertura"></div>';
        html += '    <div id="frota-qc-kpis"></div>';

        html += '    <div id="frota-qc-controlos">';
        html += '      <label id="frota-qc-lote-label">Analisar próximas <input type="number" id="frota-qc-lote" min="1" max="50" value="' + LOTE_DEFAULT + '"> autoridades por analisar ou desatualizadas</label>';
        html += '      <button type="button" id="frota-qc-analisar">' + iconePlay() + ' Analisar</button>';
        html += '      <button type="button" id="frota-qc-limpar">' + iconeReset() + ' Limpar cache local</button>';
        html += '      <span id="frota-qc-progresso"></span>';
        html += '    </div>';

        html += '    <div id="frota-qc-tabela-wrap">';
        html += '      <table id="frota-qc-tabela"><thead><tr>';
        html += '        <th>Authid</th><th>Nome</th><th>Tipo</th><th>200$a/$b</th><th>Wikidata</th><th>VIAF</th><th>400</th><th>500</th><th>Estado</th><th>Última análise</th><th></th>';
        html += '      </tr></thead><tbody></tbody></table>';
        html += '    </div>';

        html += '    <div id="frota-qc-rodape"></div>';

        html += '  </div></div>';

        html += '  <input type="file" id="frota-qc-ficheiro-importar" accept="application/json" style="display:none;">';

        html += '</div>';

        $("body").prepend(html);
        instalarEstilos();
        ligarEventos();

        if (lerColapsado()) aplicarColapso(true);
    }

    function ligarEventos() {
        $("#frota-qc-colapsar").on("click", function () {
            var painel = $("#frota-qc-painel");
            var colapsado = !painel.hasClass("colapsado");
            aplicarColapso(colapsado);
            gravarColapsado(colapsado);
        });

        $("#frota-qc-analisar").on("click", function () {
            var n = parseInt($("#frota-qc-lote").val(), 10) || LOTE_DEFAULT;
            analisarProximas(n);
        });

        $("#frota-qc-limpar").on("click", function () {
            if (!window.confirm('Apagar a cache local de análise neste browser? As marcações de falso positivo NÃO são apagadas, só o resultado da análise (200$a, Wikidata, VIAF, 400, 500).')) return;
            gravarCache({});
            renderTudo();
        });

        $(document).on("click", "#frota-qc-tipos .tipo-pill", function () {
            ESTADO.tipoActivo = $(this).data("tipo");
            renderTudo();
        });

        $("#frota-qc-partilha").on("click", "#frota-qc-exportar", exportarMarcacoes);

        $("#frota-qc-partilha").on("click", "#frota-qc-importar", function () {
            $("#frota-qc-ficheiro-importar").trigger("click");
        });

        $("#frota-qc-ficheiro-importar").on("change", function (e) {
            var ficheiro = e.target.files && e.target.files[0];
            if (ficheiro) importarMarcacoes(ficheiro);
            $(this).val("");
        });

        $("#frota-qc-tabela").on("click", ".frota-marcar-fp", function () {
            var authid = $(this).data("authid");
            marcarAutoridade(authid, "falso_positivo");
        });

        $("#frota-qc-tabela").on("click", ".frota-reabrir", function () {
            var authid = $(this).data("authid");
            marcarAutoridade(authid, null);
        });
    }

    function aplicarColapso(colapsado) {
        $("#frota-qc-painel").toggleClass("colapsado", colapsado);
        $("#frota-qc-colapsar-txt").text(colapsado ? "Mostrar painel" : "Ocultar painel");
    }

    // ---------- Renderização (chamada sempre que o estado muda) ----------

    function renderTudo() {
        var cache = lerCache();
        var marcacoes = lerMarcacoes();
        var visiveis = autoridadesFiltradas();

        renderTipos();
        renderPartilha(marcacoes);
        renderCobertura(visiveis, cache);
        renderKpis(visiveis, cache);
        renderResumoColapsado(visiveis, cache, marcacoes);
        renderTabela(visiveis, cache, marcacoes);
    }

    function renderTipos() {
        var grupos = agruparPorTipo(ESTADO.autoridades);
        var tipos = Object.keys(grupos).sort();

        var html = '<span class="tipos-rotulo">Tipologia</span>';
        html += '<button type="button" class="tipo-pill' + (ESTADO.tipoActivo === "todos" ? " ativo" : "") + '" data-tipo="todos">Todas <span class="contagem">' + ESTADO.autoridades.length + '</span></button>';

        tipos.forEach(function (tipo) {
            html += '<button type="button" class="tipo-pill' + (ESTADO.tipoActivo === tipo ? " ativo" : "") + '" data-tipo="' + escaparHTML(tipo) + '">' + escaparHTML(tipo) + ' <span class="contagem">' + grupos[tipo] + '</span></button>';
        });

        html += '<span class="tipo-origem">' + iconeInfo() + ' contagem só das autoridades visíveis nesta página de resultados</span>';

        $("#frota-qc-tipos").html(html);
    }

    function renderPartilha(marcacoes) {
        var falsosPositivos = Object.keys(marcacoes).filter(function (id) { return marcacoes[id].estado === "falso_positivo"; });
        var ultimaEm = 0;
        var ultimaPor = "";

        falsosPositivos.forEach(function (id) {
            if (marcacoes[id].em > ultimaEm) {
                ultimaEm = marcacoes[id].em;
                ultimaPor = marcacoes[id].por;
            }
        });

        var html = "";
        html += '<div class="partilha-info">';
        html += '  <div class="partilha-icone">' + iconePessoas() + '</div>';
        html += '  <div class="partilha-texto"><strong>' + falsosPositivos.length + ' falso(s) positivo(s) confirmado(s)</strong>';
        html += '  <span>Conhecimento partilhado sobre limites do motor — não altera nenhum registo, só evita repetir a mesma verificação</span></div>';
        html += '</div>';
        html += '<div class="partilha-acoes">';
        html += ultimaEm ? '<span class="partilha-ficheiro">' + iconeRelogio() + ' última marcação: ' + formatarData(ultimaEm) + (ultimaPor ? ", de " + escaparHTML(ultimaPor) : "") + '</span>' : '';
        html += '<button type="button" class="btn btn-roxo" id="frota-qc-exportar">' + iconeExportar() + ' Exportar</button>';
        html += '<button type="button" class="btn btn-roxo" id="frota-qc-importar">' + iconeImportar() + ' Importar</button>';
        html += '</div>';

        $("#frota-qc-partilha").html(html);
    }

    function renderCobertura(visiveis, cache) {
        var comAmbos = 0, comUm = 0, semNenhum = 0, analisadas = 0;

        visiveis.forEach(function (a) {
            var d = cache[a.authid];
            if (!d) return;
            analisadas++;
            if (d.temWikidata && d.temViaf) comAmbos++;
            else if (d.temWikidata || d.temViaf) comUm++;
            else semNenhum++;
        });

        var total = analisadas || 1; // evita divisão por zero na representação
        var pctAmbos = Math.round((comAmbos / total) * 100);
        var pctUm = Math.round((comUm / total) * 100);
        var pctNenhum = 100 - pctAmbos - pctUm;
        var pctCobertura = analisadas ? Math.round(((comAmbos + comUm) / analisadas) * 100) : 0;

        var circunferencia = 2 * Math.PI * 62;
        var offset = circunferencia - (circunferencia * pctCobertura / 100);

        var html = "";
        html += '<div class="anel-wrap"><svg viewBox="0 0 150 150" width="150" height="150">';
        html += '<circle cx="75" cy="75" r="62" fill="none" stroke="#eef1f4" stroke-width="14"/>';
        html += '<circle cx="75" cy="75" r="62" fill="none" stroke="url(#gradCobertura)" stroke-width="14" stroke-dasharray="' + circunferencia.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" stroke-linecap="round" transform="rotate(-90 75 75)"/>';
        html += '<defs><linearGradient id="gradCobertura" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1f7a4d"/><stop offset="100%" stop-color="#0f6e93"/></linearGradient></defs>';
        html += '</svg><div class="anel-numero"><strong>' + (analisadas ? pctCobertura + "%" : "—") + '</strong><span>com identificador</span></div></div>';

        html += '<div class="cobertura-legenda">';
        html += linhaCobertura("#1f7a4d", "Wikidata e VIAF", pctAmbos, comAmbos);
        html += linhaCobertura("#0f6e93", "Só um dos dois", pctUm, comUm);
        html += linhaCobertura("#c2cbd2", "Sem identificadores", pctNenhum < 0 ? 0 : pctNenhum, semNenhum);
        html += analisadas ? "" : '<div class="cobertura-vazia">' + escaparHTML("Ainda sem autoridades analisadas nesta categoria — clique em \"Analisar\" abaixo.") + '</div>';
        html += '</div>';

        $("#frota-qc-cobertura").html(html);
    }

    function linhaCobertura(cor, label, pct, n) {
        return '<div class="cobertura-linha"><span class="cobertura-chip" style="background:' + cor + '"></span>' +
            escaparHTML(label) +
            '<div class="cobertura-barra-wrap"><div class="cobertura-barra" style="width:' + pct + '%;background:' + cor + '"></div></div>' +
            '<b>' + n + '</b></div>';
    }

    function renderKpis(visiveis, cache) {
        var analisadas = 0, semA = 0, semIds = 0, completas = 0, desatualizadas = 0;

        visiveis.forEach(function (a) {
            var d = cache[a.authid];
            if (!d) return;
            analisadas++;
            if (!d.temNome) semA++;
            if (!d.temWikidata && !d.temViaf) semIds++;
            if (d.temNome && (d.temWikidata || d.temViaf)) completas++;
            if (idadeEmDias(d.actualizadoEm) > IDADE_MAXIMA_DIAS) desatualizadas++;
        });

        var html = "";
        html += kpiCard("cinza", iconeLista(), "Analisadas", analisadas, visiveis.length + " visíveis nesta pesquisa");
        html += kpiCard("vermelho", iconeAviso(), "200$a ausente", semA, "estrutura mínima incompleta");
        html += kpiCard("laranja", iconeLupa(), "Sem identificadores", semIds, "nem Wikidata nem VIAF no 017");
        html += kpiCard("verde", iconeOk(), "Completas", completas, "estrutura e identificador presentes");
        html += kpiCard("roxo", iconeRelogio(), "Desatualizadas", desatualizadas, "análise com mais de " + IDADE_MAXIMA_DIAS + " dias");

        $("#frota-qc-kpis").html(html);
    }

    function kpiCard(classe, icone, rotulo, valor, desc) {
        return '<div class="kpi kpi-' + classe + '"><div class="kpi-topo"><span class="kpi-rotulo">' + escaparHTML(rotulo) + '</span><span class="kpi-mini-icone">' + icone + '</span></div>' +
            '<div class="kpi-valor">' + valor + '</div><div class="kpi-desc">' + escaparHTML(desc) + '</div></div>';
    }

    function renderResumoColapsado(visiveis, cache, marcacoes) {
        var analisadas = 0, semIds = 0;
        visiveis.forEach(function (a) {
            var d = cache[a.authid];
            if (!d) return;
            analisadas++;
            if (!d.temWikidata && !d.temViaf) semIds++;
        });

        var fp = Object.keys(marcacoes).filter(function (id) { return marcacoes[id].estado === "falso_positivo"; }).length;

        var html = "";
        html += resumoItem("#9aa7b2", analisadas, "analisadas");
        html += resumoItem("#c67510", semIds, "sem identificadores");
        html += resumoItem("#6a3fb5", fp, "falsos positivos partilhados");

        $("#frota-qc-resumo-colapsado").html(html);
    }

    function resumoItem(cor, valor, rotulo) {
        return '<div class="resumo-item"><span class="resumo-dot" style="background:' + cor + '"></span><b>' + valor + '</b>&nbsp;' + escaparHTML(rotulo) + '</div>';
    }

    function renderTabela(visiveis, cache, marcacoes) {
        var corpo = $("#frota-qc-tabela tbody");
        var html = "";

        if (!visiveis.length) {
            corpo.html('<tr><td colspan="11" class="frota-vazio">Nenhuma autoridade visível para esta tipologia.</td></tr>');
            $("#frota-qc-rodape").text("");
            return;
        }

        visiveis.forEach(function (a) {
            var d = cache[a.authid];
            var marcacao = marcacoes[a.authid];

            html += "<tr>";
            html += '<td><a href="/cgi-bin/koha/authorities/authorities.pl?authid=' + encodeURIComponent(a.authid) + '" target="_blank" rel="noopener">' + escaparHTML(a.authid) + "</a></td>";
            html += "<td class=\"nome-cell\">" + escaparHTML(a.nome) + "</td>";
            html += "<td>" + escaparHTML(a.tipo) + "</td>";
            html += "<td>" + (d ? badge(d.temNome ? "ok" : "mau", d.temNome ? "Completo" : "Incompleto") : "—") + "</td>";
            html += "<td>" + (d ? badge(d.temWikidata ? "ok" : "nao", d.temWikidata ? "Sim" : "Não") : "—") + "</td>";
            html += "<td>" + (d ? badge(d.temViaf ? "ok" : "nao", d.temViaf ? "Sim" : "Não") : "—") + "</td>";
            html += "<td>" + (d ? d.n400 : "—") + "</td>";
            html += "<td>" + (d ? d.n500 : "—") + "</td>";
            html += "<td>" + celulaEstado(a, d, marcacao) + "</td>";
            html += "<td class=\"data-cell\">" + (d ? formatarData(d.actualizadoEm) : "—") + "</td>";
            html += "<td>" + celulaAcoes(a, marcacao) + "</td>";
            html += "</tr>";
        });

        corpo.html(html);

        var analisadasTotal = visiveis.filter(function (a) { return !!cache[a.authid]; }).length;
        var desatualizadasTotal = visiveis.filter(function (a) { return cache[a.authid] && idadeEmDias(cache[a.authid].actualizadoEm) > IDADE_MAXIMA_DIAS; }).length;
        var fpTotal = Object.keys(marcacoes).filter(function (id) { return marcacoes[id].estado === "falso_positivo"; }).length;

        $("#frota-qc-rodape").text(
            analisadasTotal + " de " + visiveis.length + " autoridades visíveis já analisadas nesta máquina" +
            (desatualizadasTotal ? " (" + desatualizadasTotal + " há mais de " + IDADE_MAXIMA_DIAS + " dias)" : "") +
            " · " + fpTotal + " falso(s) positivo(s) partilhado(s) aplicados nesta sessão."
        );
    }

    function badge(classe, texto) {
        return '<span class="mini-badge ' + classe + '">' + escaparHTML(texto) + '</span>';
    }

    function celulaEstado(a, d, marcacao) {
        if (marcacao && marcacao.estado === "falso_positivo") {
            return '<div class="estado-linha"><span class="estado-dot roxo"></span>Falso positivo<span class="estado-origem">· ' + escaparHTML(marcacao.por || "") + '</span></div>';
        }

        if (!d) return '<div class="estado-linha"><span class="estado-dot pendente"></span>Por analisar</div>';

        if (!d.temNome) return '<div class="estado-linha"><span class="estado-dot mau"></span>200$a ausente</div>';
        if (!d.temWikidata && !d.temViaf) return '<div class="estado-linha"><span class="estado-dot aviso"></span>Sem identificadores</div>';
        return '<div class="estado-linha"><span class="estado-dot ok"></span>Revisto</div>';
    }

    function celulaAcoes(a, marcacao) {
        if (marcacao && marcacao.estado === "falso_positivo") {
            return '<button type="button" class="btn-mini frota-reabrir" data-authid="' + escaparHTML(a.authid) + '">Reabrir</button>';
        }
        return '<button type="button" class="btn-mini frota-marcar-fp" data-authid="' + escaparHTML(a.authid) + '" title="O motor assinalou isto por engano; não é um erro real">Marcar falso positivo</button>';
    }

    // ---------- Varredura por lotes ----------

    function analisarProximas(n) {
        var cache = lerCache();
        var candidatos = autoridadesFiltradas();
        var pendentes = candidatos.filter(function (a) {
            var d = cache[a.authid];
            return !d || idadeEmDias(d.actualizadoEm) > IDADE_MAXIMA_DIAS;
        }).slice(0, n);

        if (!pendentes.length) {
            $("#frota-qc-progresso").text("Todas as autoridades visíveis nesta categoria já foram analisadas recentemente.");
            return;
        }

        var indice = 0;
        $("#frota-qc-analisar").prop("disabled", true);

        function seguinte() {
            if (indice >= pendentes.length) {
                $("#frota-qc-analisar").prop("disabled", false);
                $("#frota-qc-progresso").text("Concluído: " + pendentes.length + " autoridade(s) analisada(s) neste lote.");
                renderTudo();
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

        var temNomeA = campo200TemValorPreenchido(doc, "Palavra de ordem");
        var temNomeB = campo200TemValorPreenchido(doc, "Outra parte do nome");

        var temWikidata = /wikidata/i.test(texto) && /\bQ\d{3,}\b/.test(texto);
        var temViaf = /viaf/i.test(texto);

        var n400 = contarEtiquetaDeCampo(doc, "400");
        var n500 = contarEtiquetaDeCampo(doc, "500");

        return {
            temNome: temNomeA && temNomeB,
            temWikidata: temWikidata,
            temViaf: temViaf,
            n400: n400,
            n500: n500
        };
    }

    // Só considera preenchido um subcampo que pertença especificamente ao
    // campo 200 (forma autorizada). Procura apenas em <li>, cada um deles
    // um campo MARC completo na página de edição do Koha (o mesmo padrão já
    // validado na Caixa de Autoridade), e exige que "200" e a etiqueta do
    // subcampo apareçam no texto do MESMO <li>. Procurar em blocos maiores
    // (div, tr) foi tentado primeiro e revelou-se instável: um bloco maior
    // pode conter "200" e "Palavra de ordem" vindos de linhas diferentes e
    // sem relação entre si, dando falsos "completo".
    function campo200TemValorPreenchido(doc, etiqueta) {
        var encontrado = false;

        doc.find("li").each(function () {
            var li = $(this);
            var texto = limparTexto(li.text());
            if (texto.indexOf("200") === -1 || texto.indexOf(etiqueta) === -1) return;

            var input = li.find("input[type='text'], textarea").filter(function () {
                return limparTexto($(this).val()).length > 0;
            }).first();

            if (input.length) {
                encontrado = true;
                return false;
            }
        });

        return encontrado;
    }

    // Conta em li/div/tr, tal como a Caixa de Autoridade já faz para 400/500
    // (validado contra o Koha real da BMO). Ao contrário da disambiguação do
    // 200 acima, aqui não há risco de confundir campos diferentes, porque
    // "400" e "500" não aparecem nos blocos um do outro.
    function contarEtiquetaDeCampo(doc, etiquetaCampo) {
        var contagem = 0;
        var re = new RegExp("\\b" + etiquetaCampo + "\\b");

        doc.find("li, div, tr").each(function () {
            var texto = limparTexto($(this).text());
            if (re.test(texto) && texto.indexOf("Palavra de ordem") !== -1) contagem++;
        });

        return contagem;
    }

    // ---------- Ícones (SVG inline, sem dependências externas) ----------

    function svg(path) {
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
    }
    function iconeOk() { return svg('<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>'); }
    function iconeAviso() { return svg('<path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="9"/>'); }
    function iconeInfo() { return svg('<path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>'); }
    function iconeSeta() { return svg('<path d="M6 9l6 6 6-6"/>'); }
    function iconeLista() { return svg('<path d="M4 19V5M10 19V9M16 19v-7M22 19V4"/>'); }
    function iconeLupa() { return svg('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'); }
    function iconeRelogio() { return svg('<path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>'); }
    function iconePlay() { return svg('<path d="M5 3l14 9-14 9V3z"/>'); }
    function iconeReset() { return svg('<path d="M3 12a9 9 0 1 0 2.6-6.4M3 4v5h5"/>'); }
    function iconePessoas() { return svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'); }
    function iconeExportar() { return svg('<path d="M12 15V3M7 10l5 5 5-5M3 21h18"/>'); }
    function iconeImportar() { return svg('<path d="M12 3v12M7 10l5-5 5 5M3 21h18"/>'); }

    // ---------- Estilos ----------

    function instalarEstilos() {
        if ($("#frota-qc-estilos").length) return;

        var css = "" +
            ":root{--fq-azul:#0f6e93;--fq-azul-escuro:#0b4f6c;--fq-vermelho:#c4392b;--fq-vermelho-claro:#fdeeec;--fq-laranja:#c67510;--fq-laranja-claro:#fdf1e2;--fq-verde:#1f7a4d;--fq-verde-claro:#e9f7ef;--fq-roxo:#6a3fb5;--fq-roxo-claro:#f1ecfb;--fq-tinta:#16212c;--fq-tinta-suave:#5b6b78;--fq-linha:#dde4ea;}" +
            "#frota-qc-painel{font-family:Inter,Arial,sans-serif;font-size:12.5px;color:var(--fq-tinta);background:#fff;border:1px solid var(--fq-linha);border-radius:8px;box-shadow:0 1px 2px rgba(16,24,32,.04),0 8px 24px rgba(16,24,32,.05);overflow:hidden;margin:16px 0;}" +
            "#frota-qc-painel *{box-sizing:border-box;}" +
            "#frota-qc-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:16px 20px;border-bottom:1px solid var(--fq-linha);background:linear-gradient(180deg,#fff 0%,#fbfdfe 100%);}" +
            "#frota-qc-header-titulo{display:flex;gap:12px;align-items:flex-start;}" +
            "#frota-qc-icone{width:34px;height:34px;border-radius:8px;flex:0 0 34px;background:linear-gradient(135deg,var(--fq-azul) 0%,var(--fq-azul-escuro) 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(15,110,147,.25);}" +
            "#frota-qc-icone svg{width:18px;height:18px;stroke:#fff;}" +
            "#frota-qc-header-titulo strong{font-size:15px;font-weight:750;}" +
            "#frota-qc-header-titulo p{margin:3px 0 0 0;font-size:11.5px;color:var(--fq-tinta-suave);max-width:520px;line-height:1.4;}" +
            "#frota-qc-header-acoes{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}" +
            "#frota-qc-aviso{display:flex;align-items:center;gap:6px;font-size:10.5px;color:#8a6a1f;background:#fdf6e3;border:1px solid #f1e2b0;padding:5px 9px;border-radius:99px;white-space:nowrap;}" +
            "#frota-qc-aviso svg{width:12px;height:12px;}" +
            "#frota-qc-colapsar{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:6px;border:1px solid #c7d2da;background:#fff;font-size:11px;font-weight:650;color:var(--fq-tinta-suave);cursor:pointer;font-family:inherit;white-space:nowrap;}" +
            "#frota-qc-colapsar:hover{background:#f1f4f6;color:var(--fq-tinta);}" +
            "#frota-qc-colapsar svg{width:13px;height:13px;transition:transform .18s ease;}" +
            "#frota-qc-painel.colapsado #frota-qc-colapsar svg{transform:rotate(-90deg);}" +
            "#frota-qc-corpo{display:grid;grid-template-rows:1fr;transition:grid-template-rows .18s ease;}" +
            "#frota-qc-painel.colapsado #frota-qc-corpo{grid-template-rows:0fr;}" +
            "#frota-qc-corpo-inner{overflow:hidden;}" +
            "#frota-qc-resumo-colapsado{display:none;align-items:center;gap:18px;flex-wrap:wrap;padding:12px 20px;font-size:12px;color:var(--fq-tinta-suave);border-top:1px solid var(--fq-linha);background:#fbfcfd;}" +
            "#frota-qc-painel.colapsado #frota-qc-resumo-colapsado{display:flex;}" +
            ".resumo-item{display:flex;align-items:center;gap:6px;}" +
            ".resumo-item b{color:var(--fq-tinta);font-weight:700;}" +
            ".resumo-dot{width:7px;height:7px;border-radius:99px;flex:0 0 7px;}" +
            "#frota-qc-tipos{padding:11px 20px;border-bottom:1px solid var(--fq-linha);background:#fbfcfd;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}" +
            ".tipos-rotulo{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--fq-tinta-suave);margin-right:2px;}" +
            ".tipo-pill{border:1px solid #c7d2da;background:#fff;color:var(--fq-tinta-suave);padding:5px 11px;border-radius:99px;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-family:inherit;}" +
            ".tipo-pill .contagem{font-variant-numeric:tabular-nums;color:#98a4ae;font-weight:700;}" +
            ".tipo-pill.ativo{background:var(--fq-azul-escuro);border-color:var(--fq-azul-escuro);color:#fff;}" +
            ".tipo-pill.ativo .contagem{color:#bcd4e1;}" +
            ".tipo-pill:hover:not(.ativo){background:#f1f4f6;}" +
            ".tipo-origem{margin-left:auto;font-size:10px;color:#98a4ae;display:flex;align-items:center;gap:5px;}" +
            ".tipo-origem svg{width:11px;height:11px;}" +
            "#frota-qc-partilha{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 20px;border-bottom:1px solid var(--fq-linha);background:var(--fq-roxo-claro);}" +
            ".partilha-info{display:flex;align-items:center;gap:10px;flex:1;min-width:240px;}" +
            ".partilha-icone{width:28px;height:28px;border-radius:8px;background:#fff;flex:0 0 28px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(106,63,181,.15);}" +
            ".partilha-icone svg{width:14px;height:14px;stroke:var(--fq-roxo);}" +
            ".partilha-texto strong{display:block;font-size:12px;font-weight:700;color:#3c2470;}" +
            ".partilha-texto span{display:block;font-size:10.5px;color:#6b5596;margin-top:1px;}" +
            ".partilha-acoes{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}" +
            ".partilha-ficheiro{font-size:10px;color:#6b5596;display:flex;align-items:center;gap:5px;white-space:nowrap;}" +
            ".partilha-ficheiro svg{width:11px;height:11px;}" +
            ".btn{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:6px;border:1px solid transparent;font-size:11.5px;font-weight:650;cursor:pointer;font-family:inherit;}" +
            ".btn svg{width:12px;height:12px;}" +
            ".btn-roxo{background:#fff;color:var(--fq-roxo);border-color:#d9c9f2;}" +
            ".btn-roxo:hover{background:#faf7fe;}" +
            "#frota-qc-cobertura{display:grid;grid-template-columns:170px 1fr;gap:22px;align-items:center;padding:18px 20px;border-bottom:1px solid var(--fq-linha);}" +
            ".anel-wrap{position:relative;width:140px;height:140px;}" +
            ".anel-numero{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;}" +
            ".anel-numero strong{font-size:27px;font-weight:800;letter-spacing:-.02em;line-height:1;}" +
            ".anel-numero span{font-size:9.5px;color:var(--fq-tinta-suave);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;text-align:center;max-width:90px;}" +
            ".cobertura-legenda{display:flex;flex-direction:column;gap:9px;}" +
            ".cobertura-linha{display:flex;align-items:center;gap:9px;font-size:11.5px;}" +
            ".cobertura-chip{width:9px;height:9px;border-radius:3px;flex:0 0 9px;}" +
            ".cobertura-linha b{font-weight:700;margin-left:auto;font-variant-numeric:tabular-nums;}" +
            ".cobertura-barra-wrap{flex:1;height:6px;background:#eef1f4;border-radius:99px;overflow:hidden;margin:0 9px;}" +
            ".cobertura-barra{height:100%;border-radius:99px;}" +
            ".cobertura-vazia{font-size:11px;color:var(--fq-tinta-suave);font-style:italic;}" +
            "#frota-qc-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:var(--fq-linha);}" +
            ".kpi{background:#fff;padding:13px 14px;position:relative;}" +
            ".kpi::before{content:\"\";position:absolute;left:0;top:0;bottom:0;width:3px;}" +
            ".kpi-cinza::before{background:#9aa7b2;} .kpi-vermelho::before{background:var(--fq-vermelho);} .kpi-laranja::before{background:var(--fq-laranja);} .kpi-verde::before{background:var(--fq-verde);} .kpi-roxo::before{background:var(--fq-roxo);}" +
            ".kpi-topo{display:flex;justify-content:space-between;align-items:flex-start;}" +
            ".kpi-rotulo{font-size:10px;font-weight:650;color:var(--fq-tinta-suave);text-transform:uppercase;letter-spacing:.03em;}" +
            ".kpi-mini-icone{width:20px;height:20px;border-radius:6px;display:flex;align-items:center;justify-content:center;background:#eef1f4;}" +
            ".kpi-mini-icone svg{width:11px;height:11px;stroke:var(--fq-tinta-suave);}" +
            ".kpi-vermelho .kpi-mini-icone{background:var(--fq-vermelho-claro);} .kpi-vermelho .kpi-mini-icone svg{stroke:var(--fq-vermelho);}" +
            ".kpi-laranja .kpi-mini-icone{background:var(--fq-laranja-claro);} .kpi-laranja .kpi-mini-icone svg{stroke:var(--fq-laranja);}" +
            ".kpi-verde .kpi-mini-icone{background:var(--fq-verde-claro);} .kpi-verde .kpi-mini-icone svg{stroke:var(--fq-verde);}" +
            ".kpi-roxo .kpi-mini-icone{background:var(--fq-roxo-claro);} .kpi-roxo .kpi-mini-icone svg{stroke:var(--fq-roxo);}" +
            ".kpi-valor{font-size:22px;font-weight:800;letter-spacing:-.02em;margin-top:8px;}" +
            ".kpi-desc{font-size:10px;color:var(--fq-tinta-suave);margin-top:3px;line-height:1.3;}" +
            "#frota-qc-controlos{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 20px;background:#f8fafb;border-bottom:1px solid var(--fq-linha);}" +
            "#frota-qc-lote-label{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--fq-tinta-suave);}" +
            "#frota-qc-lote{width:50px;padding:5px 6px;border:1px solid #c7d2da;border-radius:5px;font-size:12px;text-align:center;font-family:inherit;}" +
            "#frota-qc-controlos button{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:6px;border:1px solid transparent;font-size:11.5px;font-weight:650;cursor:pointer;font-family:inherit;}" +
            "#frota-qc-controlos button svg{width:12px;height:12px;}" +
            "#frota-qc-analisar{background:var(--fq-azul-escuro);color:#fff;box-shadow:0 2px 6px rgba(11,79,108,.25);}" +
            "#frota-qc-analisar:hover{background:#0a4560;}" +
            "#frota-qc-analisar:disabled{opacity:.55;cursor:not-allowed;}" +
            "#frota-qc-limpar{background:#fff;color:var(--fq-tinta);border-color:#c7d2da;}" +
            "#frota-qc-limpar:hover{background:#f1f4f6;}" +
            "#frota-qc-progresso{font-size:11px;color:var(--fq-tinta-suave);}" +
            "#frota-qc-tabela-wrap{max-height:400px;overflow:auto;}" +
            "#frota-qc-tabela{width:100%;border-collapse:collapse;font-size:11.5px;}" +
            "#frota-qc-tabela thead th{position:sticky;top:0;background:#f8fafb;text-align:left;padding:8px 12px;border-bottom:1px solid var(--fq-linha);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;color:var(--fq-tinta-suave);z-index:2;}" +
            "#frota-qc-tabela tbody td{padding:8px 12px;border-bottom:1px solid #eef1f4;vertical-align:middle;}" +
            "#frota-qc-tabela tbody tr:hover td{background:#f9fbfc;}" +
            "#frota-qc-tabela a{color:var(--fq-azul-escuro);font-weight:650;text-decoration:none;}" +
            "#frota-qc-tabela a:hover{text-decoration:underline;}" +
            ".nome-cell{font-weight:600;}" +
            ".mini-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 8px;border-radius:99px;font-size:10px;font-weight:700;}" +
            ".mini-badge.ok{background:var(--fq-verde-claro);color:var(--fq-verde);}" +
            ".mini-badge.nao{background:#f1f3f5;color:#8a97a3;}" +
            ".mini-badge.mau{background:var(--fq-vermelho-claro);color:var(--fq-vermelho);}" +
            ".estado-linha{display:flex;align-items:center;gap:6px;white-space:nowrap;}" +
            ".estado-dot{width:7px;height:7px;border-radius:99px;flex:0 0 7px;}" +
            ".estado-dot.ok{background:var(--fq-verde);} .estado-dot.aviso{background:var(--fq-laranja);} .estado-dot.mau{background:var(--fq-vermelho);} .estado-dot.pendente{background:#c2cbd2;} .estado-dot.roxo{background:var(--fq-roxo);}" +
            ".estado-origem{font-size:9.5px;color:#98a4ae;margin-left:2px;}" +
            ".data-cell{color:var(--fq-tinta-suave);font-size:10.5px;font-variant-numeric:tabular-nums;white-space:nowrap;}" +
            ".btn-mini{border:1px solid #c7d2da;background:#fff;color:var(--fq-tinta-suave);padding:4px 9px;border-radius:5px;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit;}" +
            ".btn-mini:hover{background:#f1f4f6;color:var(--fq-tinta);}" +
            ".frota-reabrir{color:var(--fq-roxo);border-color:#d9c9f2;}" +
            ".frota-vazio{padding:16px;text-align:center;color:var(--fq-tinta-suave);font-style:italic;}" +
            "#frota-qc-rodape{padding:10px 20px;font-size:11px;color:var(--fq-tinta-suave);border-top:1px solid var(--fq-linha);background:#fbfcfd;}" +
            "@media(max-width:920px){#frota-qc-kpis{grid-template-columns:repeat(2,1fr);}#frota-qc-cobertura{grid-template-columns:1fr;}}";

        $("<style>").attr("id", "frota-qc-estilos").text(css).appendTo("head");
    }

})();
