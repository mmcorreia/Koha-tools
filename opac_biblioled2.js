/* ==========================================================
   K●RE IDENTIDADE / KOHA INTRANET AUTHORITY MODULE
   Miguel Mimoso Correia | CC-BY-NC-SA

   Versão v6.1, limpeza visual conservadora
   - Motor bibliográfico preservado.
   - Pesquisa Wikidata/VIAF preservada.
   - Aplicação assistida do UNIMARC 017 preservada.
   - Carregamento e análise de registos bibliográficos preservados.
   - CSS consolidado e redundâncias visuais removidas.
   ========================================================== */

(function () {
    "use strict";

    if (window.KORE_IDENTIDADE_V600_ATIVO) return;
    window.KORE_IDENTIDADE_V600_ATIVO = true;

    $(document).ready(function () {

        var CONFIG = {
            maxResultadosWikidata: 50,
            maxMostrarWikidata: 8,
            maxResultadosVIAF: 8,
            maxCandidatosValidacao: 180,
            pageSizeIntervencao: 999999,
            timeoutMARC: 12000,
            camposAutoria: ["700", "701", "702"],
            camposAssunto: ["600", "601", "602", "604", "605", "606", "607", "608"]
        };

        var STATE = {
            authority: null,
            candidatos: [],
            ocorrencias: [],
            diagnostics: [],
            score: 0,
            filtroIntervencao: "problema:Falta $9",
            contextoSelecionado: "",
            imagemWikidata: "",
            imagemWikidataQid: "",
            imagemWikidataLoading: "",
            problemaSelecionado: "",
            limiteIntervencao: 20,
            dashboardExecutada: false,
            dashboardEmCurso: false,
            dashboardToken: 0,
            xhrDashboard: [],
            suspenderEventos017: false
        };

        if (!paginaAtualEhEditorAutoridade()) return;

        $("#kore-identidade").remove();

        garantirFontAwesome();
        construirInterface();
        atualizarAuthorityState();
        preencherPesquisa();
        atualizarLinksPesquisa();
        renderDashboard();
        koreV45AjustesFinais();
        

        $(document)
            .off(".koreidentidade")

            .on("click.koreidentidade", ".kore-tab", function () {
                ativarAba($(this).data("tab"));
            })

            .on("click.koreidentidade", "#kore-toggle-corpo", function () {
                var $corpo = $("#kore-corpo");
                var fechado = $corpo.hasClass("kore-corpo-fechado");

                if (fechado) {
                    $corpo.removeClass("kore-corpo-fechado");
                    $(this).text("Ocultar painel");
                } else {
                    $corpo.addClass("kore-corpo-fechado");
                    $(this).text("Mostrar painel");
                }
            })

            .on("input change.koreidentidade", "input[type='text'], textarea, select", function () {
                if ($(this).closest("#kore-identidade").length) return;
                if (STATE.suspenderEventos017) return;

                atualizarAuthorityState();
                preencherPesquisa();
                atualizarLinksPesquisa();
                renderDashboard();
                koreV45AjustesFinais();
                
            })

            .on("input.koreidentidade", "#kore-termo", function () {
                atualizarLinksPesquisa();
            })

            .on("keydown.koreidentidade", "#kore-termo", function (e) {
                if (e.key === "Enter") {
                    e.preventDefault();
                    $("#kore-pesquisar").click();
                }
            })

            .on("click.koreidentidade", "#kore-pesquisar", function () {
                var termo = limparTexto($("#kore-termo").val());

                if (!termo) {
                    $("#kore-estado").text("Indique um termo de pesquisa.");
                    return;
                }

                $("#kore-estado").text("Pesquisa enviada. Confirme sempre os resultados antes de aplicar identificadores.");

                pesquisarWikidata(termo);
                pesquisarVIAF(termo);
            })

            .on("click.koreidentidade", ".kore-copiar", function () {
                var valor = $(this).data("valor");
                var $btn = $(this);
                var textoOriginal = $btn.text();

                if (!valor) return;

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(valor).then(function () {
                        $btn.text("Copiado");
                        setTimeout(function () {
                            $btn.text(textoOriginal);
                        }, 1200);
                    });
                } else {
                    $("#kore-estado").text("Copie manualmente: " + valor);
                }
            })

            .on("click.koreidentidade", ".kore-aplicar-017", function () {
                var valor = $(this).attr("data-valor") || $(this).data("valor");
                var fonte = $(this).attr("data-fonte") || $(this).data("fonte");

                if (!valor || !fonte) return;

                aplicarNoCampo017(valor, fonte);
                
            })

            .on("click.koreidentidade", "#kore-dashboard-atualizar", function () {
                executarDashboardCompleto();
                setTimeout(koreV45AjustesFinais, 250);
                
            })

            .on("click.koreidentidade", ".kore-metric-click", function () {
                var filtro = $(this).data("filtro");

                if (!filtro) return;

                STATE.filtroIntervencao = filtro;
                STATE.contextoSelecionado = "";
                STATE.problemaSelecionado = "";
                STATE.limiteIntervencao = CONFIG.pageSizeIntervencao;

                $(".kore-filtro-intervencao").removeClass("kore-filtro-ativo");
                $('.kore-filtro-intervencao[data-filtro="' + filtro + '"]').addClass("kore-filtro-ativo");

                renderTabelaIntervencao();
                koreV45AjustesFinais();
                

                if ($("#kore-area-intervencao").length) {
                    $("html, body").animate({
                        scrollTop: $("#kore-area-intervencao").offset().top - 80
                    }, 250);
                }
            })

            .on("click.koreidentidade", "#kore-toggle-variants-box", function () {
                var $body = $("#kore-variants-body");
                var fechado = $body.hasClass("kore-fechado");

                if (fechado) {
                    $body.removeClass("kore-fechado");
                    $(this).text("Ocultar variantes");
                } else {
                    $body.addClass("kore-fechado");
                    $(this).text("Mostrar variantes");
                }
            })

            .on("click.koreidentidade", ".kore-toggle-400", function () {
                var $lista = $("#kore-variant-list");
                var expandida = $lista.hasClass("kore-variant-expanded");

                if (expandida) {
                    $lista.removeClass("kore-variant-expanded").addClass("kore-variant-compact");
                    $(this).text("Ver todas as variantes");
                } else {
                    $lista.removeClass("kore-variant-compact").addClass("kore-variant-expanded");
                    $(this).text("Recolher variantes");
                }
            })

            .on("click.koreidentidade", "#kore-toggle-analytics", function () {
                var $body = $("#kore-analytics-body");
                var fechado = $body.hasClass("kore-fechado");

                if (fechado) {
                    $body.removeClass("kore-fechado");
                    $(this).text("Ocultar leitura");
                } else {
                    $body.addClass("kore-fechado");
                    $(this).text("Mostrar leitura");
                }
            })

            .on("click.koreidentidade", ".kore-problem-card", function () {
                var problema = $(this).data("problema") || "";
                if (problema) filtrarPorProblema(problema);
            })

            .on("click.koreidentidade", ".kore-contexto-click", function () {
                var natureza = $(this).data("natureza") || "";

                STATE.filtroIntervencao = "contexto";
                STATE.contextoSelecionado = natureza;
                STATE.limiteIntervencao = CONFIG.pageSizeIntervencao;

                $(".kore-filtro-intervencao").removeClass("kore-filtro-ativo");
                $('.kore-filtro-intervencao[data-filtro="contexto"]').addClass("kore-filtro-ativo");

                renderTabelaIntervencao();
                koreV45AjustesFinais();
                

                if ($("#kore-area-intervencao").length) {
                    $("html, body").animate({
                        scrollTop: $("#kore-area-intervencao").offset().top - 80
                    }, 250);
                }
            })

            .on("click.koreidentidade", ".kore-filtro-intervencao", function () {
                STATE.filtroIntervencao = $(this).data("filtro");
                STATE.contextoSelecionado = "";
                STATE.problemaSelecionado = "";
                STATE.limiteIntervencao = CONFIG.pageSizeIntervencao;

                $(".kore-filtro-intervencao").removeClass("kore-filtro-ativo");
                $(this).addClass("kore-filtro-ativo");

                renderTabelaIntervencao();
                koreV45AjustesFinais();
                
            })

            .on("click.koreidentidade", ".kore-status-action", function () {
                var filtro = $(this).data("filtro") || "todos";
                var natureza = $(this).data("natureza") || "";
                var problema = $(this).data("problema") || "";

                STATE.filtroIntervencao = filtro;
                STATE.contextoSelecionado = natureza;
                STATE.problemaSelecionado = problema;
                STATE.limiteIntervencao = CONFIG.pageSizeIntervencao;

                $(".kore-filtro-intervencao").removeClass("kore-filtro-ativo");
                $('.kore-filtro-intervencao[data-filtro="' + filtro + '"]').addClass("kore-filtro-ativo");

                renderTabelaIntervencao();
                koreV45AjustesFinais();
                

                if ($("#kore-area-intervencao").length) {
                    $("html, body").animate({
                        scrollTop: $("#kore-area-intervencao").offset().top - 80
                    }, 250);
                }
            })

            ;


        function koreMoverContadorOcorrencias() {
            try {
                var $root = $("#kore-identidade");
                var total = 0;

                if (STATE && STATE.ocorrencias && STATE.ocorrencias.length >= 0) {
                    total = STATE.ocorrenciasFiltradasTotal || 0;
                    if (!total && STATE.filtroIntervencao) {
                        total = obterOcorrenciasFiltradas ? obterOcorrenciasFiltradas().length : 0;
                    }
                }

                var texto = total + " ocorrência(s)";
                var $linha = $root.find(".kore-dashboard-actions").first();

                if (!$linha.length) return;

                var $pill = $linha.find(".kore-v80-ocorrencias-pill");
                if (!$pill.length) {
                    $pill = $('<button type="button" class="kore-v80-ocorrencias-pill kore-status-action" data-filtro="todos"></button>');
                    $linha.append($pill);
                }

                $pill.text(texto);

                $root.find(".kore-panel-head, .kore-correction-head, .kore-secondary-head").each(function () {
                    var $h = $(this);
                    var t = $.trim($h.text() || "");
                    if (/^\d+\s+ocorrência\(s\)$/i.test(t) || t.indexOf("ocorrência(s)") !== -1) {
                        $h.addClass("kore-v80-hide-occ-head");
                    }
                });

                $root.find(".kore-panel-head .kore-status-action, .kore-correction-head .kore-status-action, .kore-secondary-head .kore-status-action").each(function () {
                    var t = $.trim($(this).text() || "");
                    if (t.indexOf("ocorrência(s)") !== -1) $(this).addClass("kore-v80-hide-occ-original");
                });
            } catch (e) {
                if (window.console && console.warn) console.warn("K●RE mover ocorrências:", e);
            }
        }

        function koreV45AjustesFinais() {
            try {
                var $root = $("#kore-identidade");

                /* Cartão de identidade: remover painéis não pretendidos */
                $root.find(".kore-v34-field, .kore-authority-detail, .kore-modern-stat, .kore-v34-mini-alert").each(function () {
                    var t = $.trim($(this).text() || "");
                    if (
                        t.indexOf("200$f") !== -1 ||
                        t.indexOf("400") === 0 ||
                        t.indexOf("Formas variantes") !== -1 ||
                        t.indexOf("Ligados:") !== -1 ||
                        t.indexOf("A corrigir:") !== -1
                    ) {
                        $(this).addClass("kore-hide-identity-extra");
                    }
                });

                /* Linha principal: nome + datas, Authid a bold, Qualidade com cor, sem Ligados/A corrigir */
                $root.find(".kore-v34-line, .kore-authority-sub, .kore-modern-sub").each(function () {
                    var raw = $.trim($(this).text() || "");
                    if (!raw) return;

                    raw = raw
                        .replace(/Índice\s*K●RE\s*:/g, "Qualidade:")
                        .replace(/Índice\s*KoRE\s*:/g, "Qualidade:")
                        .replace(/Índice\s*:/g, "Qualidade:")
                        .replace(/\s*\|\s*Ligados\s*:\s*\d+/g, "")
                        .replace(/\s*\|\s*A corrigir\s*:\s*\d+/g, "")
                        .replace(/\s*·\s*Ligados\s*:\s*\d+/g, "")
                        .replace(/\s*·\s*A corrigir\s*:\s*\d+/g, "");

                    var authidMatch = raw.match(/Authid\s*:?\s*(\d+)/i);
                    var qualidadeMatch = raw.match(/Qualidade\s*:?\s*(\d+)?\s*[\·\-]?\s*([A-Za-zÀ-ÿ]+)/i);

                    var authid = authidMatch ? authidMatch[1] : (obterAuthidAtual ? obterAuthidAtual() : "");
                    var qualidadeNum = qualidadeMatch && qualidadeMatch[1] ? parseInt(qualidadeMatch[1], 10) : null;
                    var qualidadeEstado = qualidadeMatch && qualidadeMatch[2] ? qualidadeMatch[2] : "";

                    var cls = "kore-v45-score-critical";
                    if (qualidadeNum !== null && qualidadeNum >= 80) cls = "kore-v45-score-good";
                    else if (qualidadeNum !== null && qualidadeNum >= 55) cls = "kore-v45-score-warning";

                    var partes = [];
                    if (authid) partes.push('<span class="kore-v45-authid"><strong>Authid:</strong> ' + escaparHTML(authid) + '</span>');
                    if (qualidadeEstado) {
                        var labelQual = qualidadeNum !== null ? qualidadeNum + " · " + qualidadeEstado : qualidadeEstado;
                        partes.push('<span class="kore-v45-score ' + cls + '"><strong>Qualidade:</strong> ' + escaparHTML(labelQual) + '</span>');
                    }

                    if (partes.length) $(this).html(partes.join('<span class="kore-v45-sep">|</span>'));
                });

                /* Nome: acrescentar datas, quando existam, ao lado do nome */
                var a = STATE && STATE.authority ? STATE.authority : null;
                if (a && a.nome) {
                    var datas = "";
                    var dataN = limparTexto(a.dataNascimento || a.nascimento || a.dataInicio || "");
                    var dataM = limparTexto(a.dataMorte || a.morte || a.dataFim || "");
                    if (dataN || dataM) datas = " (" + dataN + (dataN || dataM ? " - " : "") + dataM + ")";
                    $root.find(".kore-v34-name, .kore-authority-title, .kore-modern-name").first().html(escaparHTML(a.nome + datas));
                }

                /* Menus: preservar labels com dígitos, como $9, $4 e 200$f.
                   Não voltar a interpretar texto já estruturado, porque isso fazia desaparecer
                   o 9 e o 4 quando o contador era concatenado pelo .text(). */
                $root.find(".kore-filtro-intervencao, .kore-problem-menu button").each(function () {
                    var $btn = $(this);

                    if ($btn.find(".kore-menu-label").length && $btn.find(".kore-problem-count").length) {
                        var $count = $btn.find(".kore-problem-count").first();
                        var c = $.trim($count.text() || "");
                        if (!c || c === "-" || c === "—" || c === "NaN" || c === "undefined") $count.text("0");
                        return;
                    }

                    var label = $.trim($btn.attr("data-label") || $btn.text() || "");
                    var n = $.trim($btn.attr("data-count") || "0");
                    if (!n || n === "-" || n === "—" || n === "NaN" || n === "undefined") n = "0";

                    $btn.html(
                        '<span class="kore-menu-label">' + escaparHTML(label) + '</span>' +
                        '<span class="kore-problem-count">' + escaparHTML(n) + '</span>'
                    );
                });

                /* Alinhar títulos das boxes KPI à direita */
                $root.find(".kore-v34-kpi, .kore-modern-kpi, .kore-metric-card").addClass("kore-v45-kpi-right");

                /* Garantir 0 em contadores vazios */
                $root.find(".kore-problem-count, .kore-v34-kpi-value, .kore-modern-kpi-total, .kore-metric-value").each(function () {
                    var t = $.trim($(this).text() || "");
                    if (!t || t === "-" || t === "—" || t === "NaN" || t === "undefined") $(this).text("0");
                });
            } catch (e) {
                if (window.console && console.warn) console.warn("K●RE v4.5 ajustes finais:", e);
            }
        }

        function paginaAtualEhEditorAutoridade() {
            var path = window.location.pathname || "";
            var params = new URLSearchParams(window.location.search || "");

            var paginaAutoridade =
                path.indexOf("/cgi-bin/koha/authorities/authorities.pl") !== -1 ||
                path.indexOf("/authorities/authorities.pl") !== -1;

            if (!paginaAutoridade) return false;

            return !!params.get("authid") || params.has("authtypecode");
        }

        function obterAuthidAtual() {
            var params = new URLSearchParams(window.location.search || "");
            var authid = params.get("authid");

            if (authid && /^\d+$/.test(authid)) return authid;

            return "";
        }

        function limparTexto(txt) {
            return $.trim(String(txt || "").replace(/\s+/g, " "));
        }


        function limparValorMARCOperacional(txt) {
            var valor = limparTexto(txt);
            if (!valor) return "";

            valor = valor
                .replace(/\u00a0/g, " ")
                .replace(/‡/g, "$")
                .replace(/ǂ/g, "$")
                .replace(/^Primeira menção de responsabilidade\s+/i, "")
                .replace(/^Menção de responsabilidade\s+/i, "");

            var m = valor.match(/^(.+?)\s+Autoridade\s+Outra parte do nome não tomada para palavra de ordem\s+(.+?)(?:\s+Datas\s+(.+))?$/i);
            if (m) {
                valor = limparTexto(m[1]) + ", " + limparTexto(m[2]) + (m[3] ? " " + limparTexto(m[3]) : "");
                return valor;
            }

            m = valor.match(/^(.+?)\s+Outra parte do nome não tomada para palavra de ordem\s+(.+?)(?:\s+Datas\s+(.+))?$/i);
            if (m) {
                valor = limparTexto(m[1]) + ", " + limparTexto(m[2]) + (m[3] ? " " + limparTexto(m[3]) : "");
                return valor;
            }

            m = valor.match(/^(.+?)\s+Autoridade\s+Outra parte do nome não tomada para\s+(.+?)\s+((?:\d{4}|\?{4}|[ca]\.\s*\d{4}).*)$/i);
            if (m) {
                valor = limparTexto(m[1]) + ", " + limparTexto(m[2]) + " " + limparTexto(m[3]);
                return valor;
            }

            m = valor.match(/^(.+?)\s+Outra parte do nome não tomada para\s+(.+?)\s+((?:\d{4}|\?{4}|[ca]\.\s*\d{4}).*)$/i);
            if (m) {
                valor = limparTexto(m[1]) + ", " + limparTexto(m[2]) + " " + limparTexto(m[3]);
                return valor;
            }

            m = valor.match(/^(.+?)\s+Autoridade\s+Outra parte do nome não tomada para\s+(.+)$/i);
            if (m) {
                valor = limparTexto(m[1]) + ", " + limparTexto(m[2]);
                return valor;
            }

            m = valor.match(/^(.+?)\s+Outra parte do nome não tomada para\s+(.+)$/i);
            if (m) {
                valor = limparTexto(m[1]) + ", " + limparTexto(m[2]);
                return valor;
            }

            valor = valor
                .replace(/\bPalavra de ordem\b\s*/ig, "")
                .replace(/\bAutoridade\b\s*/ig, "")
                .replace(/\bOutra parte do nome não tomada para palavra de ordem\b\s*/ig, ", ")
                .replace(/\bOutra parte do nome não tomada para\b\s*/ig, ", ")
                .replace(/\bDatas\b\s*/ig, " ")
                .replace(/\s+,\s+/g, ", ")
                .replace(/\s+/g, " ")
                .trim();

            return valor;
        }

        function ausencia9(o) {
            return o && (o.problema === "Falta $9" || o.problema === "Falta $9 e $4");
        }

        function ausencia4(o) {
            return o && (o.problema === "Falta $4" || o.problema === "Falta $9 e $4");
        }

        function codigo4Valido(valor) {
            valor = limparTexto(valor || "");
            return !!valor && valor !== "0" && valor !== "—" && valor !== "-";
        }

        function escaparHTML(txt) {
            return String(txt || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function garantirFontAwesome() {
            if ($('link[data-kore-fontawesome="1"]').length) return;
            if ($('link[href*="font-awesome"], link[href*="fontawesome"]').length) return;

            $('<link>', {
                rel: 'stylesheet',
                href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css',
                'data-kore-fontawesome': '1'
            }).appendTo('head');
        }

        function escaparRegex(txt) {
            return String(txt || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }

        function escaparSelector(txt) {
            if ($.escapeSelector) return $.escapeSelector(txt);
            return String(txt || "").replace(/([ #;?%&,.+*~':"!^$[\]()=>|\/@])/g, "\\$1");
        }

        function normalizar(txt) {
            return String(txt || "")
                .toLowerCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .replace(/[^\w\s]/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        }

        function removerDuplicados(lista) {
            var vistos = {};
            var resultado = [];

            $.each(lista || [], function (i, valor) {
                valor = limparTexto(valor);

                if (!valor || vistos[valor]) return;

                vistos[valor] = true;
                resultado.push(valor);
            });

            return resultado;
        }



        function koreLogoWikidata() {
            return '<span class="kore-logo-wikidata" aria-label="Wikidata"><img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Wikidata-logo-en.svg" alt="Wikidata"></span>';
        }

        function koreLogoVIAF() {
            return '<span class="kore-logo-viaf" aria-label="VIAF"><img src="https://commons.wikimedia.org/wiki/Special:Redirect/file/VIAF_icon.svg" alt="VIAF"></span>';
        }

        function koreIconDashboard() {
            return '<span class="kore-logo-dashboard" aria-hidden="true"><svg viewBox="0 0 48 48"><rect x="8" y="26" width="7" height="14" rx="2"></rect><rect x="20" y="16" width="7" height="24" rx="2"></rect><rect x="32" y="9" width="7" height="31" rx="2"></rect></svg></span>';
        }


        function koreLogoWikidataImg() {
            return '<img class="kore-official-logo kore-official-logo-wikidata" src="https://commons.wikimedia.org/wiki/Special:Redirect/file/Wikidata-logo-en.svg" alt="Wikidata">';
        }

        function koreLogoViafImg() {
            return '<img class="kore-official-logo kore-official-logo-viaf" src="https://commons.wikimedia.org/wiki/Special:Redirect/file/VIAF_icon.svg" alt="VIAF">';
        }

        function construirInterface() {
            var html = "";

            html += '<div id="kore-identidade">';
            html += construirEstilos();

            html += '<div class="kore-header kore-header-minimal">';
            html += '<div class="kore-header-actions kore-source-tabs"><button type="button" class="kore-tab kore-source-card" data-tab="identificadores" title="Abrir Wikidata e VIAF"><span>Wikidata / VIAF</span></button><button type="button" class="kore-tab kore-source-card kore-tab-ativa" data-tab="dashboard" title="Abrir Dashboard"><span>Dashboard</span></button></div>';
            html += '<p class="kore-header-desc">Identidade, validação da autoridade, ligação bibliográfica e mapa de menções.</p>';
            html += '</div>';

            html += '<div id="kore-corpo" class="kore-corpo-fechado">';

            html += '<div class="kore-tabs kore-tabs-hidden"></div>'; 

            html += '<div id="kore-tab-dashboard" class="kore-tab-panel kore-tab-panel-ativo">';
            html += construirAbaDashboard();
            html += '</div>';

            html += '<div id="kore-tab-identificadores" class="kore-tab-panel">';
            html += construirAbaIdentificadores();
            html += '</div>';

            html += '</div>';
            html += '</div>';

            var $alvo =
                $("h1").first().length ? $("h1").first() :
                $("#main_intranet-main").first().length ? $("#main_intranet-main").first() :
                $("#main").first().length ? $("#main").first() :
                $(".main").first().length ? $(".main").first() :
                $("body").first();

            if ($alvo.is("h1")) {
                $alvo.after(html);
            } else {
                $alvo.prepend(html);
            }
        }

        
        function construirEstilos() {
            var css = "";

            css += '<style>';

            css += '#kore-identidade{margin:14px 0;border:1px solid #d0d7de;background:#fff;border-radius:3px;overflow:hidden;}';
            css += '#kore-identidade *{box-sizing:border-box;}';
            css += '#kore-identidade h2{margin:0;font-size:17px;font-weight:800;color:#111827;}';
            css += '#kore-identidade h2 span{color:#007fae;}';
            css += '#kore-identidade h3{margin:0 0 5px 0;font-size:14px;font-weight:750;color:#111827;}';
            css += '#kore-identidade p{margin:3px 0 0 0;color:#667085;font-size:12px;line-height:1.3;}';

            css += '.kore-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:11px 14px;background:#fff;border-bottom:1px solid #e5e7eb;}';
            css += '#kore-corpo.kore-corpo-fechado{display:none;}';

            css += '#kore-identidade button,#kore-identidade a.kore-btn{padding:5px 8px!important;border:1px solid #cbd5e1!important;background:#fff!important;border-radius:2px!important;color:#374151!important;text-decoration:none!important;cursor:pointer!important;font-size:12px!important;line-height:1.25!important;font-weight:500!important;box-shadow:none!important;text-shadow:none!important;}';
            css += '#kore-identidade button:hover,#kore-identidade a.kore-btn:hover{background:#f8fafc!important;border-color:#94a3b8!important;text-decoration:none!important;color:#111827!important;}';
            css += '#kore-identidade button:disabled{opacity:.45;cursor:not-allowed;}';

            css += '.kore-tabs{display:flex;gap:7px;border-bottom:1px solid #e5e7eb;background:#fff;padding:9px 14px;}';
            css += '.kore-tab-ativa{border-color:#007fae!important;color:#007fae!important;background:#f5fbfd!important;}';
            css += '.kore-tab-panel{display:none;padding:11px 14px;background:#fcfcfd;}';
            css += '.kore-tab-panel-ativo{display:block;}';

            css += '.kore-linha-pesquisa{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0 12px 0;}';
            css += '#kore-termo{flex:1;min-width:340px;padding:7px 9px;border:1px solid #cbd5e1;border-radius:2px;font-size:13px;}';
            css += '#kore-estado{margin:8px 0 12px 0;color:#555;font-size:13px;}';

            css += '.kore-grid-identificadores{display:grid;grid-template-columns:1fr 1fr;gap:12px;}';
            css += '@media(max-width:1000px){.kore-grid-identificadores{grid-template-columns:1fr;}}';
            css += '.kore-coluna{background:#fff;border:1px solid #e5e7eb;border-radius:3px;padding:12px;}';
            css += '.kore-item{padding:9px 0;border-top:1px solid #edf0f2;}';
            css += '.kore-item:first-child{border-top:none;}';
            css += '.kore-wd-layout{display:grid;grid-template-columns:82px 1fr;gap:11px;align-items:flex-start;}';
            css += '.kore-wd-layout-sem-imagem{grid-template-columns:82px 1fr;}';
            css += '.kore-wd-imgbox{width:82px;min-height:104px;}';
            css += '.kore-wd-img{width:82px;height:104px;object-fit:cover;border:1px solid #e5e7eb;background:#f8fafc;}';
            css += '.kore-wd-placeholder{width:82px;height:104px;border:1px solid #edf0f2;background:#f8fafc;}';
            css += '.kore-wd-info{min-width:0;}';
            css += '.kore-label{font-weight:700;color:#111827;font-size:14px;}';
            css += '.kore-desc{margin-top:4px;font-size:13px;color:#4b5563;line-height:1.35;}';
            css += '.kore-id{margin-top:5px;font-family:monospace;font-size:13px;color:#14376b;}';
            css += '.kore-meta{margin-top:5px;font-size:13px;color:#374151;line-height:1.4;}';
            css += '.kore-meta strong{font-weight:700;color:#111827;}';
            css += '.kore-acoes{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px;}';

            css += '.kore-dashboard-actions{display:flex;gap:8px;flex-wrap:wrap;margin:7px 0 10px 0;}';
            css += '.kore-dashboard-top{display:grid;grid-template-columns:130px repeat(6,minmax(105px,1fr));gap:7px;margin-bottom:9px;}';
            css += '@media(max-width:1300px){.kore-dashboard-top{grid-template-columns:1fr 1fr 1fr;}}';
            css += '.kore-score-card,.kore-metric-card{background:#fff;border:1px solid #e5e7eb;border-radius:2px;padding:9px 11px;text-align:left;min-height:66px;box-shadow:none;}';
            css += '.kore-score-card:hover,.kore-metric-card:hover{background:#f8fafc;border-color:#94a3b8;}';
            css += '.kore-score-value{display:block;font-size:27px;line-height:1;font-weight:850;color:#111827;}';
            css += '.kore-score-label{display:block;font-size:11px;color:#475467;margin-top:4px;}';
            css += '.kore-score-state{display:inline-flex;margin-top:5px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:800;}';
            css += '.kore-state-good{background:#ecfdf3;color:#05603a;}';
            css += '.kore-state-warning{background:#fffaeb;color:#b54708;}';
            css += '.kore-state-critical{background:#fef3f2;color:#d92d20;}';
            css += '.kore-metric-value{display:block;font-size:21px;font-weight:850;color:#111827;line-height:1;}';
            css += '.kore-metric-label{display:block;font-size:12px;color:#1f2937;font-weight:750;margin-top:5px;}';
            css += '.kore-metric-help{display:block;font-size:11px;color:#667085;margin-top:3px;line-height:1.25;}';
            css += '.kore-metric-click{cursor:pointer;}';

            css += '.kore-operational-hero{display:grid;grid-template-columns:1.15fr 2fr;gap:10px;margin-bottom:10px;}';
            css += '@media(max-width:1200px){.kore-operational-hero{grid-template-columns:1fr;}}';
            css += '.kore-authority-card{background:#fff;border:1px solid #e5e7eb;border-radius:3px;padding:11px;}';

            css += '.kore-authority-card{display:grid;grid-template-columns:92px 1fr;gap:11px;align-items:flex-start;}';
            css += '.kore-authority-card.sem-foto{grid-template-columns:1fr;}';
            css += '.kore-authority-photo{width:92px;height:118px;object-fit:cover;border:1px solid #e5e7eb;background:#f8fafc;}';
            css += '.kore-authority-photo-wrap{width:92px;min-height:118px;}';

            css += '.kore-authority-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 8px;margin-top:9px;}';
            css += '.kore-authority-detail{border:1px solid #edf0f2;background:#fcfcfd;padding:5px 7px;font-size:11px;line-height:1.25;}';
            css += '.kore-authority-detail strong{display:block;color:#111827;font-size:11px;margin-bottom:2px;}';
            css += '.kore-chip-score-good{background:#ecfdf3!important;color:#05603a!important;border-color:#abefc6!important;}';
            css += '.kore-chip-score-warning{background:#fffaeb!important;color:#b54708!important;border-color:#fedf89!important;}';
            css += '.kore-chip-score-critical{background:#fef3f2!important;color:#b42318!important;border-color:#fecdca!important;}';

            css += '.kore-authority-alerts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:9px;}';
            css += '.kore-authority-alert{border:1px solid #e5e7eb;padding:6px 8px;font-size:11px;line-height:1.25;background:#fff;}';
            css += '.kore-authority-alert strong{display:block;font-size:11px;margin-bottom:2px;color:#111827;}';
            css += '.kore-alert-ok{background:#ecfdf3!important;border-color:#abefc6!important;color:#05603a!important;}';
            css += '.kore-alert-warn{background:#fffaeb!important;border-color:#fedf89!important;color:#b54708!important;}';
            css += '.kore-alert-bad{background:#fef3f2!important;border-color:#fecdca!important;color:#b42318!important;}';
            css += '.kore-variant-list{grid-column:1/-1;border:1px solid #edf0f2;background:#fcfcfd;padding:6px 8px;font-size:11px;line-height:1.35;}';
            css += '.kore-variant-list strong{display:block;font-size:11px;color:#111827;margin-bottom:3px;}';
            css += '.kore-variant-muted{color:#667085;}';

            css += '.kore-variant-list.kore-variant-compact{max-height:78px;overflow:hidden;position:relative;}';
            css += '.kore-variant-list.kore-variant-expanded{max-height:190px;overflow:auto;}';
            css += '.kore-variant-toggle{margin-top:6px!important;padding:3px 7px!important;font-size:11px!important;}';
            css += '.kore-variant-item{display:inline;}';
            css += '.kore-variant-item:not(:last-child):after{content:" · ";color:#98a2b3;}';

            css += '.kore-variants-box{background:#fff;border:1px solid #e5e7eb;border-radius:3px;margin:10px 0;overflow:hidden;}';
            css += '.kore-variants-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:9px 11px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-variants-head h3{margin:0;font-size:14px;font-weight:800;color:#111827;}';
            css += '.kore-variants-head p{margin:2px 0 0 0;font-size:11px;color:#667085;}';
            css += '.kore-variants-body{padding:9px 11px;}';
            css += '.kore-variants-body.kore-fechado{display:none;}';
            css += '.kore-variants-list{max-height:160px;overflow:auto;border:1px solid #edf0f2;background:#fcfcfd;padding:8px;font-size:12px;line-height:1.45;}';
            css += '.kore-variants-list ul{margin:0;padding-left:18px;}';
            css += '.kore-variants-list li{margin:2px 0;}';
            css += '.kore-variants-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px;}';






            css += '.kore-authority-title{font-size:16px;font-weight:850;color:#111827;margin-bottom:4px;}';
            css += '.kore-authority-sub{font-size:12px;color:#667085;line-height:1.35;}';
            css += '.kore-authority-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px;}';
            css += '.kore-chip{display:inline-flex;align-items:center;gap:4px;border:1px solid #e5e7eb;background:#f8fafc;color:#344054;padding:3px 7px;font-size:11px;font-weight:650;}';
            css += '.kore-action-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;}';
            css += '@media(max-width:1200px){.kore-action-board{grid-template-columns:1fr;}}';
            css += '.kore-action-card{background:#fff;border:1px solid #e5e7eb;border-left:4px solid #98a2b3;border-radius:2px;padding:10px;text-align:left;min-height:98px;}';
            css += '.kore-action-card:hover{background:#f8fafc;border-color:#94a3b8;}';
            css += '.kore-action-critical{border-left-color:#d92d20;}';
            css += '.kore-action-review{border-left-color:#f79009;}';
            css += '.kore-action-context{border-left-color:#007fae;}';
            css += '.kore-action-number{display:block;font-size:24px;line-height:1;font-weight:900;color:#111827;}';
            css += '.kore-action-title{display:block;font-size:13px;font-weight:800;color:#111827;margin-top:6px;}';
            css += '.kore-action-text{display:block;font-size:11px;color:#667085;line-height:1.3;margin-top:4px;}';
            css += '.kore-dashboard-grid{display:grid;grid-template-columns:1.1fr 1fr 1fr;gap:9px;margin-bottom:9px;align-items:start;}';
            css += '@media(max-width:1600px){.kore-dashboard-grid{grid-template-columns:1fr 1fr;}}';
            css += '@media(max-width:900px){.kore-dashboard-grid{grid-template-columns:1fr;}}';
            css += '.kore-panel{background:#fff;border:1px solid #e5e7eb;border-radius:3px;overflow:hidden;margin-bottom:9px;}';
            css += '.kore-panel-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:9px 11px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-panel-body{padding:9px 11px;}';

            css += '.kore-status-list{display:grid;gap:6px;}';
            css += '.kore-status-row{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:flex-start;padding:7px 8px;border:1px solid #edf0f2;border-radius:2px;background:#fff;width:100%;text-align:left;}';
            css += 'button.kore-status-row{cursor:pointer;font:inherit;color:inherit;}';
            css += 'button.kore-status-row:hover{background:#f8fafc!important;border-color:#94a3b8!important;}';
            css += '.kore-status-action-note{display:block;font-size:10px;color:#007fae;margin-top:4px;font-weight:700;}';
            css += '.kore-dot{width:8px;height:8px;border-radius:999px;background:#667085;margin-top:4px;}';
            css += '.kore-dot-ok{background:#12b76a;}';
            css += '.kore-dot-warn{background:#f79009;}';
            css += '.kore-dot-bad{background:#d92d20;}';
            css += '.kore-status-title{font-size:12px;font-weight:700;color:#111827;display:block;}';
            css += '.kore-status-text{font-size:11px;color:#667085;margin-top:2px;display:block;}';

            css += '.kore-issue{border-top:1px solid #edf0f2;padding:8px 0;}';
            css += '.kore-issue:first-child{border-top:none;padding-top:0;}';
            css += '.kore-badge{display:inline-flex;align-items:center;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:800;}';
            css += '.kore-badge-critical{background:#fef3f2;color:#d92d20;}';
            css += '.kore-badge-review{background:#fffaeb;color:#b54708;}';
            css += '.kore-badge-info{background:#f2f4f7;color:#344054;}';
            css += '.kore-issue-title{margin-top:5px;font-size:12px;font-weight:750;color:#111827;}';
            css += '.kore-issue-text{margin-top:3px;font-size:11px;color:#667085;line-height:1.35;}';

            css += '.kore-vazio{padding:10px;color:#667085;font-style:italic;font-size:12px;}';

            css += '.kore-intervencao-filtros{display:flex;gap:7px;flex-wrap:wrap;padding:9px 11px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-filtro-ativo{border-color:#007fae!important;color:#007fae!important;background:#f5fbfd!important;}';
            css += '.kore-table-wrap{width:100%;overflow:auto;}';
            css += '.kore-table{width:100%;border-collapse:collapse;background:#fff;font-size:12px;}';
            css += '.kore-table th{position:sticky;top:0;background:#f8fafc;border-bottom:1px solid #d0d7de;color:#374151;text-align:left;padding:7px;font-weight:750;white-space:nowrap;}';
            css += '.kore-table td{border-bottom:1px solid #edf0f2;padding:7px;vertical-align:top;color:#374151;}';
            css += '.kore-table tr:hover td{background:#fbfdff;}';
            css += '.kore-table td.kore-title-cell{min-width:220px;color:#111827;font-weight:650;}';
            css += '.kore-table td.kore-small-cell{white-space:nowrap;}';
            css += '.kore-priority-critical{color:#d92d20;font-weight:800;}';
            css += '.kore-priority-review{color:#b54708;font-weight:800;}';
            css += '.kore-priority-info{color:#344054;font-weight:700;}';
            css += '.kore-action-detail{color:#667085;font-size:11px;margin-top:4px;line-height:1.35;}';
            css += '.kore-table-links{display:flex;gap:5px;flex-wrap:wrap;}';
            css += '.kore-table-links a{padding:4px 6px!important;font-size:11px!important;}';
            css += '.kore-table-footer{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 11px;border-top:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-natureza{font-weight:650;color:#344054;}';

            css += '.kore-operational-sections{display:grid;grid-template-columns:1fr;gap:10px;margin-top:10px;}';
            css += '.kore-correction-box{background:#fff;border:1px solid #e5e7eb;border-left:4px solid #d92d20;border-radius:3px;overflow:hidden;}';
            css += '.kore-correction-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-correction-head h3{margin:0;font-size:15px;font-weight:850;color:#111827;}';
            css += '.kore-correction-head p{margin:3px 0 0 0;font-size:12px;color:#667085;}';
            css += '.kore-correction-body{padding:10px 12px;}';
            css += '.kore-problem-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}';
            css += '@media(max-width:1400px){.kore-problem-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}';
            css += '@media(max-width:800px){.kore-problem-grid{grid-template-columns:1fr;}}';
            css += '.kore-problem-card{border:1px solid #e5e7eb;background:#fcfcfd;padding:9px;text-align:left;border-radius:2px;cursor:pointer;}';
            css += '.kore-problem-card:hover{background:#f8fafc;border-color:#94a3b8;}';
            css += '.kore-problem-card strong{display:block;font-size:20px;line-height:1;color:#111827;}';
            css += '.kore-problem-card span{display:block;font-size:12px;font-weight:800;color:#111827;margin-top:5px;}';
            css += '.kore-problem-card small{display:block;font-size:11px;color:#667085;line-height:1.3;margin-top:3px;}';
            css += '.kore-problem-critical{border-left:4px solid #d92d20;}';
            css += '.kore-problem-review{border-left:4px solid #f79009;}';
            css += '.kore-problem-info{border-left:4px solid #007fae;}';
            css += '.kore-split-horizontal{display:grid;grid-template-columns:1fr 1fr;gap:10px;}';
            css += '@media(max-width:1000px){.kore-split-horizontal{grid-template-columns:1fr;}}';
            css += '.kore-secondary-box{background:#fff;border:1px solid #e5e7eb;border-radius:3px;overflow:hidden;}';
            css += '.kore-secondary-head{display:flex;justify-content:space-between;gap:10px;padding:9px 11px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-secondary-head h3{margin:0;font-size:14px;font-weight:800;color:#111827;}';
            css += '.kore-secondary-head p{margin:2px 0 0 0;font-size:11px;color:#667085;}';
            css += '.kore-secondary-body{padding:9px 11px;}';
            css += '.kore-summary-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:9px;}';
            css += '.kore-summary-tile{border:1px solid #e5e7eb;background:#fcfcfd;padding:7px 8px;font-size:11px;line-height:1.25;}';
            css += '.kore-summary-tile strong{display:block;font-size:16px;color:#111827;line-height:1;}';
            css += '.kore-summary-tile span{display:block;margin-top:3px;color:#667085;}';
            css += '.kore-priority-pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800;}';
            css += '.kore-priority-pill:before{content:"";width:7px;height:7px;border-radius:999px;display:inline-block;}';
            css += '.kore-pill-critical{background:#fef3f2;color:#b42318;}';
            css += '.kore-pill-critical:before{background:#d92d20;}';
            css += '.kore-pill-review{background:#fffaeb;color:#b54708;}';
            css += '.kore-pill-review:before{background:#f79009;}';
            css += '.kore-pill-info{background:#f2f4f7;color:#344054;}';
            css += '.kore-pill-info:before{background:#667085;}';
            css += '.kore-row-critical td{border-left:3px solid #d92d20;}';
            css += '.kore-row-review td{border-left:3px solid #f79009;}';
            css += '.kore-row-info td{border-left:3px solid #98a2b3;}';
            css += '.kore-link-primary{font-weight:750!important;border-color:#94a3b8!important;background:#f8fafc!important;}';
            css += '.kore-table-scroll{max-height:560px;overflow:auto;background:#fff;}';
            css += '.kore-table-scroll .kore-table th{top:0;z-index:2;}';

            css += '.kore-modern-wrap{display:grid;grid-template-columns:1.55fr 1fr;gap:14px;margin:14px 0;}';
            css += '@media(max-width:1200px){.kore-modern-wrap{grid-template-columns:1fr;}}';
            css += '.kore-modern-identity{background:#fff;border:1px solid #dbe3ec;border-radius:10px;box-shadow:0 6px 18px rgba(15,23,42,.06);padding:14px;}';
            css += '.kore-modern-identity-main{display:grid;grid-template-columns:118px 1fr;gap:16px;align-items:start;}';
            css += '.kore-modern-photo{width:118px;height:154px;object-fit:cover;border-radius:6px;border:1px solid #d0d7de;background:#f8fafc;}';
            css += '.kore-modern-name{font-size:24px;font-weight:900;color:#0f172a;line-height:1.1;margin-bottom:5px;}';
            css += '.kore-modern-sub{font-size:13px;color:#475467;margin-bottom:10px;}';
            css += '.kore-modern-meta{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 10px 0;}';
            css += '.kore-modern-pill{display:inline-flex;align-items:center;gap:5px;border:1px solid #dbe3ec;background:#f8fafc;color:#344054;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700;}';
            css += '.kore-modern-pill-ok{background:#ecfdf3;color:#05603a;border-color:#abefc6;}';
            css += '.kore-modern-pill-warn{background:#fffaeb;color:#b54708;border-color:#fedf89;}';
            css += '.kore-modern-pill-bad{background:#fef3f2;color:#b42318;border-color:#fecdca;}';
            css += '.kore-modern-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:13px;border-top:1px solid #edf2f7;padding-top:12px;}';
            css += '.kore-modern-stat{background:#fbfdff;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px;text-align:center;}';
            css += '.kore-modern-stat strong{display:block;font-size:22px;line-height:1;color:#0f172a;}';
            css += '.kore-modern-stat span{display:block;font-size:11px;color:#667085;text-transform:uppercase;font-weight:800;margin-top:4px;}';
            css += '.kore-modern-variants{background:#fff;border:1px solid #dbe3ec;border-radius:10px;box-shadow:0 6px 18px rgba(15,23,42,.06);overflow:hidden;}';
            css += '.kore-modern-variants-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 13px;border-bottom:1px solid #edf2f7;}';
            css += '.kore-modern-variants-head h3{font-size:15px;margin:0;font-weight:850;color:#111827;}';
            css += '.kore-modern-variants-head span{font-size:12px;color:#667085;font-weight:700;}';
            css += '.kore-modern-variants-list{max-height:150px;overflow:auto;padding:10px 15px;font-size:12px;line-height:1.45;}';
            css += '.kore-modern-variants-list ul{margin:0;padding-left:18px;}';
            css += '.kore-modern-variants-list li{margin:2px 0;}';
            css += '.kore-modern-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0;}';
            css += '@media(max-width:1200px){.kore-modern-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}}';
            css += '@media(max-width:800px){.kore-modern-kpis{grid-template-columns:1fr;}}';
            css += '.kore-modern-kpi{background:#fff;border:1px solid #dbe3ec;border-radius:10px;box-shadow:0 6px 18px rgba(15,23,42,.05);padding:14px;min-height:150px;position:relative;overflow:hidden;}';
            css += '.kore-modern-kpi:before{content:"";position:absolute;left:0;top:0;right:0;height:4px;background:#98a2b3;}';
            css += '.kore-modern-kpi.kpi-red:before{background:#d92d20;}';
            css += '.kore-modern-kpi.kpi-orange:before{background:#f79009;}';
            css += '.kore-modern-kpi.kpi-blue:before{background:#007fae;}';
            css += '.kore-modern-kpi.kpi-green:before{background:#12b76a;}';
            css += '.kore-modern-kpi h3{font-size:16px;margin:0 0 3px 0;font-weight:850;color:#111827;}';
            css += '.kore-modern-kpi p{font-size:12px;color:#667085;margin:0 0 10px 0;}';
            css += '.kore-modern-kpi-total{font-size:34px;font-weight:950;color:#0f172a;line-height:1;margin:6px 0;}';
            css += '.kore-modern-kpi-total span{font-size:11px;color:#667085;font-weight:800;text-transform:uppercase;margin-left:4px;}';
            css += '.kore-modern-submetric{display:grid;grid-template-columns:42px 1fr;gap:9px;align-items:center;border:1px solid #edf2f7;background:#fbfdff;border-radius:7px;padding:7px 8px;margin-top:7px;cursor:pointer;}';
            css += '.kore-modern-submetric:hover{border-color:#94a3b8;background:#f8fafc;}';
            css += '.kore-modern-submetric strong{font-size:20px;line-height:1;color:#111827;}';
            css += '.kore-modern-submetric span{display:block;font-size:12px;font-weight:850;color:#111827;}';
            css += '.kore-modern-submetric small{display:block;font-size:10px;color:#667085;line-height:1.25;text-transform:uppercase;}';
            css += '.kore-problem-menu{display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-problem-menu button{border-radius:8px!important;padding:7px 10px!important;background:#fff!important;}';
            css += '.kore-problem-count{font-weight:950;color:#111827;margin-right:3px;}';
            css += '.kore-menu-critical{border-left:4px solid #d92d20!important;}';
            css += '.kore-menu-review{border-left:4px solid #f79009!important;}';
            css += '.kore-menu-context{border-left:4px solid #007fae!important;}';
            css += '.kore-menu-ok{border-left:4px solid #12b76a!important;}';
            css += '.kore-menu-neutral{border-left:4px solid #98a2b3!important;}';
            css += '.kore-table-intro{padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#fcfcfd;}';
            css += '.kore-table-intro strong{display:block;font-size:13px;color:#111827;margin-bottom:2px;}';
            css += '.kore-table-intro span{display:block;font-size:12px;color:#667085;}';
            css += '.kore-table th{font-size:11px!important;text-transform:uppercase;letter-spacing:.02em;background:#f8fafc!important;}';
            css += '.kore-table td{font-size:12px!important;}';
            css += '.kore-table-links{gap:4px!important;}';
            css += '.kore-table-scroll{max-height:540px;overflow:auto;background:#fff;}';


            css += '.kore-top-workbench{display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr 1fr;gap:10px;margin:12px 0;align-items:stretch;}';
            css += '@media(max-width:1400px){.kore-top-workbench{grid-template-columns:1fr 1fr;}}';
            css += '@media(max-width:800px){.kore-top-workbench{grid-template-columns:1fr;}}';
            css += '.kore-workbench-card{background:#fff;border:1px solid #d0d7de;border-radius:3px;overflow:hidden;min-height:160px;}';
            css += '.kore-workbench-head{padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-workbench-head h3{margin:0;font-size:15px;font-weight:850;color:#111827;}';
            css += '.kore-workbench-head p{margin:3px 0 0 0;font-size:11px;color:#667085;line-height:1.35;}';
            css += '.kore-workbench-body{padding:10px 12px;}';
            css += '.kore-mini-metric{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border:1px solid #e5e7eb;background:#fcfcfd;padding:8px 9px;margin-bottom:7px;cursor:pointer;text-align:left;width:100%;}';
            css += '.kore-mini-metric:hover{background:#f8fafc;border-color:#94a3b8;}';
            css += '.kore-mini-metric strong{display:block;font-size:22px;line-height:1;color:#111827;}';
            css += '.kore-mini-metric span{display:block;font-size:12px;font-weight:800;color:#111827;text-transform:uppercase;line-height:1.2;}';
            css += '.kore-mini-metric small{display:block;font-size:11px;color:#667085;line-height:1.25;margin-top:2px;}';
            css += '.kore-mini-critical{border-left:4px solid #d92d20;}';
            css += '.kore-mini-review{border-left:4px solid #f79009;}';
            css += '.kore-mini-context{border-left:4px solid #007fae;}';
            css += '.kore-mini-ok{border-left:4px solid #12b76a;}';
            css += '.kore-authority-compact{display:flex;gap:12px;}';
            css += '.kore-authority-compact img{width:82px;height:112px;object-fit:cover;border:1px solid #d0d7de;background:#f5f5f5;}';
            css += '.kore-authority-compact-meta{font-size:12px;line-height:1.4;color:#344054;}';
            css += '.kore-authority-compact-meta strong{display:block;font-size:13px;color:#111827;margin-bottom:2px;}';
            css += '.kore-variant-box-list{max-height:108px;overflow:auto;border:1px solid #edf0f2;background:#fcfcfd;padding:7px 10px;font-size:11px;line-height:1.45;}';
            css += '.kore-variant-box-list ul{margin:0;padding-left:18px;}';
            css += '.kore-variant-box-list li{margin:2px 0;}';

            css += '.kore-authority-alert-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:8px;}';
            css += '.kore-alert-mini{border:1px solid #e5e7eb;padding:5px 6px;font-size:10px;line-height:1.2;font-weight:750;text-align:center;}';
            css += '.kore-alert-mini-ok{background:#ecfdf3;color:#05603a;border-color:#abefc6;}';
            css += '.kore-alert-mini-warn{background:#fffaeb;color:#b54708;border-color:#fedf89;}';
            css += '.kore-alert-mini-bad{background:#fef3f2;color:#b42318;border-color:#fecdca;}';
            css += '.kore-workbench-total{font-size:26px;font-weight:900;color:#111827;line-height:1;margin:0 0 8px 0;}';
            css += '.kore-workbench-total span{font-size:11px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:.02em;margin-left:4px;}';
            css += '.kore-workbench-card.kore-card-critical{border-top:4px solid #d92d20;}';
            css += '.kore-workbench-card.kore-card-review{border-top:4px solid #f79009;}';
            css += '.kore-workbench-card.kore-card-context{border-top:4px solid #007fae;}';
            css += '.kore-workbench-card.kore-card-ok{border-top:4px solid #12b76a;}';
            css += '.kore-workbench-card.kore-card-neutral{border-top:4px solid #98a2b3;}';
            css += '.kore-authority-status-line{margin-top:7px;font-size:11px;color:#667085;line-height:1.35;}';

            css += '.kore-mini-metric{align-items:center!important;text-align:left!important;}';
            css += '.kore-mini-metric > div:first-child{min-width:42px;text-align:left;}';
            css += '.kore-mini-metric > div:last-child{flex:1;text-align:left;}';
            css += '.kore-mini-metric span{display:block;text-align:left;}';
            css += '.kore-mini-metric small{display:block;text-align:left;}';
            css += '.kore-problem-menu{display:flex;gap:7px;flex-wrap:wrap;padding:9px 11px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-problem-menu button{display:inline-flex!important;align-items:center!important;gap:6px!important;font-size:12px!important;}';
            css += '.kore-problem-count{font-weight:850;color:#111827;}';
            css += '.kore-menu-critical{border-left:4px solid #d92d20!important;}';
            css += '.kore-menu-review{border-left:4px solid #f79009!important;}';
            css += '.kore-menu-context{border-left:4px solid #007fae!important;}';
            css += '.kore-menu-ok{border-left:4px solid #12b76a!important;}';
            css += '.kore-menu-neutral{border-left:4px solid #98a2b3!important;}';
            css += '.kore-table-intro{padding:9px 11px;border-bottom:1px solid #e5e7eb;background:#fcfcfd;}';
            css += '.kore-table-intro strong{display:block;font-size:13px;color:#111827;margin-bottom:2px;}';
            css += '.kore-table-intro span{display:block;font-size:12px;color:#667085;}';





            css += '.kore-panel-compact .kore-panel-head{padding:8px 10px;}';
            css += '.kore-panel-compact .kore-panel-body{padding:8px 10px;}';
            css += '.kore-status-row-click{cursor:pointer;border-color:#d0d7de!important;}';
            css += '.kore-status-row-click:hover{background:#f8fafc!important;border-color:#94a3b8!important;}';
            css += '.kore-workspace-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;}';
            css += '.kore-workspace-title h3{margin-bottom:2px;}';

            css += '.kore-analytics-block{background:#fff;border:1px solid #e5e7eb;border-radius:3px;margin-bottom:10px;overflow:hidden;}';
            css += '.kore-analytics-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-analytics-head h3{margin:0;font-size:14px;font-weight:800;color:#111827;}';
            css += '.kore-analytics-head p{margin:2px 0 0 0;font-size:11px;color:#667085;}';
            css += '.kore-analytics-body{padding:10px;}';
            css += '.kore-analytics-body.kore-fechado{display:none;}';
            css += '.kore-table-scroll{max-height:420px;overflow:auto;background:#fff;}';
            css += '.kore-table-scroll .kore-table th{top:0;z-index:2;}';

            css += '.kore-modern-wrap{display:grid;grid-template-columns:1.55fr 1fr;gap:14px;margin:14px 0;}';
            css += '@media(max-width:1200px){.kore-modern-wrap{grid-template-columns:1fr;}}';
            css += '.kore-modern-identity{background:#fff;border:1px solid #dbe3ec;border-radius:10px;box-shadow:0 6px 18px rgba(15,23,42,.06);padding:14px;}';
            css += '.kore-modern-identity-main{display:grid;grid-template-columns:118px 1fr;gap:16px;align-items:start;}';
            css += '.kore-modern-photo{width:118px;height:154px;object-fit:cover;border-radius:6px;border:1px solid #d0d7de;background:#f8fafc;}';
            css += '.kore-modern-name{font-size:24px;font-weight:900;color:#0f172a;line-height:1.1;margin-bottom:5px;}';
            css += '.kore-modern-sub{font-size:13px;color:#475467;margin-bottom:10px;}';
            css += '.kore-modern-meta{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 10px 0;}';
            css += '.kore-modern-pill{display:inline-flex;align-items:center;gap:5px;border:1px solid #dbe3ec;background:#f8fafc;color:#344054;border-radius:999px;padding:4px 9px;font-size:12px;font-weight:700;}';
            css += '.kore-modern-pill-ok{background:#ecfdf3;color:#05603a;border-color:#abefc6;}';
            css += '.kore-modern-pill-warn{background:#fffaeb;color:#b54708;border-color:#fedf89;}';
            css += '.kore-modern-pill-bad{background:#fef3f2;color:#b42318;border-color:#fecdca;}';
            css += '.kore-modern-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:13px;border-top:1px solid #edf2f7;padding-top:12px;}';
            css += '.kore-modern-stat{background:#fbfdff;border:1px solid #e5e7eb;border-radius:7px;padding:8px 10px;text-align:center;}';
            css += '.kore-modern-stat strong{display:block;font-size:22px;line-height:1;color:#0f172a;}';
            css += '.kore-modern-stat span{display:block;font-size:11px;color:#667085;text-transform:uppercase;font-weight:800;margin-top:4px;}';
            css += '.kore-modern-variants{background:#fff;border:1px solid #dbe3ec;border-radius:10px;box-shadow:0 6px 18px rgba(15,23,42,.06);overflow:hidden;}';
            css += '.kore-modern-variants-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 13px;border-bottom:1px solid #edf2f7;}';
            css += '.kore-modern-variants-head h3{font-size:15px;margin:0;font-weight:850;color:#111827;}';
            css += '.kore-modern-variants-head span{font-size:12px;color:#667085;font-weight:700;}';
            css += '.kore-modern-variants-list{max-height:150px;overflow:auto;padding:10px 15px;font-size:12px;line-height:1.45;}';
            css += '.kore-modern-variants-list ul{margin:0;padding-left:18px;}';
            css += '.kore-modern-variants-list li{margin:2px 0;}';
            css += '.kore-modern-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0;}';
            css += '@media(max-width:1200px){.kore-modern-kpis{grid-template-columns:repeat(2,minmax(0,1fr));}}';
            css += '@media(max-width:800px){.kore-modern-kpis{grid-template-columns:1fr;}}';
            css += '.kore-modern-kpi{background:#fff;border:1px solid #dbe3ec;border-radius:10px;box-shadow:0 6px 18px rgba(15,23,42,.05);padding:14px;min-height:150px;position:relative;overflow:hidden;}';
            css += '.kore-modern-kpi:before{content:"";position:absolute;left:0;top:0;right:0;height:4px;background:#98a2b3;}';
            css += '.kore-modern-kpi.kpi-red:before{background:#d92d20;}';
            css += '.kore-modern-kpi.kpi-orange:before{background:#f79009;}';
            css += '.kore-modern-kpi.kpi-blue:before{background:#007fae;}';
            css += '.kore-modern-kpi.kpi-green:before{background:#12b76a;}';
            css += '.kore-modern-kpi h3{font-size:16px;margin:0 0 3px 0;font-weight:850;color:#111827;}';
            css += '.kore-modern-kpi p{font-size:12px;color:#667085;margin:0 0 10px 0;}';
            css += '.kore-modern-kpi-total{font-size:34px;font-weight:950;color:#0f172a;line-height:1;margin:6px 0;}';
            css += '.kore-modern-kpi-total span{font-size:11px;color:#667085;font-weight:800;text-transform:uppercase;margin-left:4px;}';
            css += '.kore-modern-submetric{display:grid;grid-template-columns:42px 1fr;gap:9px;align-items:center;border:1px solid #edf2f7;background:#fbfdff;border-radius:7px;padding:7px 8px;margin-top:7px;cursor:pointer;}';
            css += '.kore-modern-submetric:hover{border-color:#94a3b8;background:#f8fafc;}';
            css += '.kore-modern-submetric strong{font-size:20px;line-height:1;color:#111827;}';
            css += '.kore-modern-submetric span{display:block;font-size:12px;font-weight:850;color:#111827;}';
            css += '.kore-modern-submetric small{display:block;font-size:10px;color:#667085;line-height:1.25;text-transform:uppercase;}';
            css += '.kore-problem-menu{display:flex;gap:8px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-problem-menu button{border-radius:8px!important;padding:7px 10px!important;background:#fff!important;}';
            css += '.kore-problem-count{font-weight:950;color:#111827;margin-right:3px;}';
            css += '.kore-menu-critical{border-left:4px solid #d92d20!important;}';
            css += '.kore-menu-review{border-left:4px solid #f79009!important;}';
            css += '.kore-menu-context{border-left:4px solid #007fae!important;}';
            css += '.kore-menu-ok{border-left:4px solid #12b76a!important;}';
            css += '.kore-menu-neutral{border-left:4px solid #98a2b3!important;}';
            css += '.kore-table-intro{padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#fcfcfd;}';
            css += '.kore-table-intro strong{display:block;font-size:13px;color:#111827;margin-bottom:2px;}';
            css += '.kore-table-intro span{display:block;font-size:12px;color:#667085;}';
            css += '.kore-table th{font-size:11px!important;text-transform:uppercase;letter-spacing:.02em;background:#f8fafc!important;}';
            css += '.kore-table td{font-size:12px!important;}';
            css += '.kore-table-links{gap:4px!important;}';
            css += '.kore-table-scroll{max-height:540px;overflow:auto;background:#fff;}';


            css += '.kore-top-workbench{display:grid;grid-template-columns:1.25fr 1fr 1fr 1fr 1fr;gap:10px;margin:12px 0;align-items:stretch;}';
            css += '@media(max-width:1400px){.kore-top-workbench{grid-template-columns:1fr 1fr;}}';
            css += '@media(max-width:800px){.kore-top-workbench{grid-template-columns:1fr;}}';
            css += '.kore-workbench-card{background:#fff;border:1px solid #d0d7de;border-radius:3px;overflow:hidden;min-height:160px;}';
            css += '.kore-workbench-head{padding:10px 12px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-workbench-head h3{margin:0;font-size:15px;font-weight:850;color:#111827;}';
            css += '.kore-workbench-head p{margin:3px 0 0 0;font-size:11px;color:#667085;line-height:1.35;}';
            css += '.kore-workbench-body{padding:10px 12px;}';
            css += '.kore-mini-metric{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;border:1px solid #e5e7eb;background:#fcfcfd;padding:8px 9px;margin-bottom:7px;cursor:pointer;text-align:left;width:100%;}';
            css += '.kore-mini-metric:hover{background:#f8fafc;border-color:#94a3b8;}';
            css += '.kore-mini-metric strong{display:block;font-size:22px;line-height:1;color:#111827;}';
            css += '.kore-mini-metric span{display:block;font-size:12px;font-weight:800;color:#111827;text-transform:uppercase;line-height:1.2;}';
            css += '.kore-mini-metric small{display:block;font-size:11px;color:#667085;line-height:1.25;margin-top:2px;}';
            css += '.kore-mini-critical{border-left:4px solid #d92d20;}';
            css += '.kore-mini-review{border-left:4px solid #f79009;}';
            css += '.kore-mini-context{border-left:4px solid #007fae;}';
            css += '.kore-mini-ok{border-left:4px solid #12b76a;}';
            css += '.kore-authority-compact{display:flex;gap:12px;}';
            css += '.kore-authority-compact img{width:82px;height:112px;object-fit:cover;border:1px solid #d0d7de;background:#f5f5f5;}';
            css += '.kore-authority-compact-meta{font-size:12px;line-height:1.4;color:#344054;}';
            css += '.kore-authority-compact-meta strong{display:block;font-size:13px;color:#111827;margin-bottom:2px;}';
            css += '.kore-variant-box-list{max-height:108px;overflow:auto;border:1px solid #edf0f2;background:#fcfcfd;padding:7px 10px;font-size:11px;line-height:1.45;}';
            css += '.kore-variant-box-list ul{margin:0;padding-left:18px;}';
            css += '.kore-variant-box-list li{margin:2px 0;}';

            css += '.kore-authority-alert-mini{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:8px;}';
            css += '.kore-alert-mini{border:1px solid #e5e7eb;padding:5px 6px;font-size:10px;line-height:1.2;font-weight:750;text-align:center;}';
            css += '.kore-alert-mini-ok{background:#ecfdf3;color:#05603a;border-color:#abefc6;}';
            css += '.kore-alert-mini-warn{background:#fffaeb;color:#b54708;border-color:#fedf89;}';
            css += '.kore-alert-mini-bad{background:#fef3f2;color:#b42318;border-color:#fecdca;}';
            css += '.kore-workbench-total{font-size:26px;font-weight:900;color:#111827;line-height:1;margin:0 0 8px 0;}';
            css += '.kore-workbench-total span{font-size:11px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:.02em;margin-left:4px;}';
            css += '.kore-workbench-card.kore-card-critical{border-top:4px solid #d92d20;}';
            css += '.kore-workbench-card.kore-card-review{border-top:4px solid #f79009;}';
            css += '.kore-workbench-card.kore-card-context{border-top:4px solid #007fae;}';
            css += '.kore-workbench-card.kore-card-ok{border-top:4px solid #12b76a;}';
            css += '.kore-workbench-card.kore-card-neutral{border-top:4px solid #98a2b3;}';
            css += '.kore-authority-status-line{margin-top:7px;font-size:11px;color:#667085;line-height:1.35;}';

            css += '.kore-mini-metric{align-items:center!important;text-align:left!important;}';
            css += '.kore-mini-metric > div:first-child{min-width:42px;text-align:left;}';
            css += '.kore-mini-metric > div:last-child{flex:1;text-align:left;}';
            css += '.kore-mini-metric span{display:block;text-align:left;}';
            css += '.kore-mini-metric small{display:block;text-align:left;}';
            css += '.kore-problem-menu{display:flex;gap:7px;flex-wrap:wrap;padding:9px 11px;border-bottom:1px solid #e5e7eb;background:#fff;}';
            css += '.kore-problem-menu button{display:inline-flex!important;align-items:center!important;gap:6px!important;font-size:12px!important;}';
            css += '.kore-problem-count{font-weight:850;color:#111827;}';
            css += '.kore-menu-critical{border-left:4px solid #d92d20!important;}';
            css += '.kore-menu-review{border-left:4px solid #f79009!important;}';
            css += '.kore-menu-context{border-left:4px solid #007fae!important;}';
            css += '.kore-menu-ok{border-left:4px solid #12b76a!important;}';
            css += '.kore-menu-neutral{border-left:4px solid #98a2b3!important;}';
            css += '.kore-table-intro{padding:9px 11px;border-bottom:1px solid #e5e7eb;background:#fcfcfd;}';
            css += '.kore-table-intro strong{display:block;font-size:13px;color:#111827;margin-bottom:2px;}';
            css += '.kore-table-intro span{display:block;font-size:12px;color:#667085;}';




            css += '.kore-priority-pill{display:inline-flex;align-items:center;gap:5px;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:800;}';
            css += '.kore-priority-pill:before{content:"";width:7px;height:7px;border-radius:999px;display:inline-block;}';
            css += '.kore-pill-critical{background:#fef3f2;color:#b42318;}';
            css += '.kore-pill-critical:before{background:#d92d20;}';
            css += '.kore-pill-review{background:#fffaeb;color:#b54708;}';
            css += '.kore-pill-review:before{background:#f79009;}';
            css += '.kore-pill-info{background:#f2f4f7;color:#344054;}';
            css += '.kore-pill-info:before{background:#667085;}';
            css += '.kore-row-critical td{border-left:3px solid #d92d20;}';
            css += '.kore-row-review td{border-left:3px solid #f79009;}';
            css += '.kore-row-info td{border-left:3px solid #98a2b3;}';
            css += '.kore-link-primary{font-weight:750!important;border-color:#94a3b8!important;background:#f8fafc!important;}';


            css += '.kore-table-caption{font-size:12px;color:#667085;line-height:1.35;}';



            css += '/* K●RE Identidade v3.4, camada visual aproximada ao modelo */';
            css += '#kore-identidade{font-family:Inter,"Segoe UI",Roboto,Arial,sans-serif!important;background:#f8fbff!important;border:1px solid #dbe5f0!important;border-radius:18px!important;box-shadow:0 14px 38px rgba(15,23,42,.10)!important;overflow:hidden!important;}';
            css += '#kore-identidade .kore-header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:16px!important;padding:16px 22px!important;background:linear-gradient(180deg,#fbfdff 0%,#f4f8fe 100%)!important;border-bottom:1px solid #dce6f2!important;}';
            css += '#kore-identidade .kore-header h2{font-size:28px!important;line-height:1!important;font-weight:950!important;letter-spacing:-.04em!important;color:#07152e!important;}';
            css += '#kore-identidade .kore-header h2:before{content:"☰";font-size:23px;margin-right:18px;color:#0f172a;font-weight:800;}';
            css += '#kore-identidade .kore-header h2 span{color:#1167d8!important;}';
            css += '#kore-identidade .kore-header p{font-size:13px!important;color:#253858!important;margin:6px 0 0 49px!important;}';
            css += '#kore-identidade .kore-header-actions{display:flex!important;gap:12px!important;align-items:center!important;flex-wrap:wrap!important;}';
            css += '#kore-identidade button,#kore-identidade a.kore-btn{border-radius:10px!important;border:1px solid #d8e2ee!important;background:#fff!important;color:#0f1e3a!important;box-shadow:0 4px 10px rgba(15,23,42,.06)!important;font-size:13px!important;font-weight:760!important;padding:10px 14px!important;line-height:1.1!important;}';
            css += '#kore-identidade button:hover,#kore-identidade a.kore-btn:hover{background:#f8fbff!important;border-color:#9fb3cc!important;color:#06152d!important;}';
            css += '#kore-identidade .kore-tab-ativa{border-color:#d8e2ee!important;background:#fff!important;color:#0f1e3a!important;}';
            css += '#kore-identidade .kore-tabs-hidden{display:none!important;}';
            css += '#kore-identidade .kore-tab-panel{padding:18px 20px 22px!important;background:#f8fbff!important;}';
            css += '#kore-identidade .kore-dashboard-actions{display:none!important;}';
            css += '#kore-identidade #kore-dashboard-status{display:none!important;}';
            css += '.kore-v34-top{display:grid;grid-template-columns:1.18fr 1.82fr;gap:22px;align-items:stretch;margin-bottom:20px;}';
            css += '@media(max-width:1350px){.kore-v34-top{grid-template-columns:1fr;}.kore-v34-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important;}}';
            css += '@media(max-width:760px){.kore-v34-kpis{grid-template-columns:1fr!important;}.kore-v34-identity-main{grid-template-columns:1fr!important;}.kore-v34-photo{width:100%!important;height:180px!important;}}';
            css += '.kore-v34-identity{background:#fff;border:1px solid #dbe5f0;border-radius:10px;box-shadow:0 10px 24px rgba(15,23,42,.06);padding:16px 18px;}';
            css += '.kore-v34-identity-main{display:grid;grid-template-columns:118px 1fr;gap:18px;align-items:start;}';
            css += '.kore-v34-photo{width:118px;height:154px;border-radius:4px;object-fit:cover;background:#eef2f7;border:1px solid #cdd8e5;}';
            css += '.kore-v34-photo-empty{display:flex;align-items:center;justify-content:center;color:#98a2b3;font-size:38px;}';
            css += '.kore-v34-name{font-size:26px;font-weight:950;letter-spacing:-.035em;line-height:1.1;color:#07152e;margin:0 0 9px;}';
            css += '.kore-v34-line{display:flex;flex-wrap:wrap;gap:0;align-items:center;color:#344054;font-size:13px;margin:8px 0;}';
            css += '.kore-v34-line span{display:inline-flex;align-items:center;gap:5px;padding-right:13px;margin-right:13px;border-right:1px solid #d5deea;}';
            css += '.kore-v34-line span:last-child{border-right:0;margin-right:0;padding-right:0;}';
            css += '.kore-v34-link{color:#1167d8;font-weight:760;text-decoration:none;}';
            css += '.kore-v34-badges{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px;}';
            css += '.kore-v34-badge{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:850;border:1px solid #dbe5f0;background:#f8fbff;}';
            css += '.kore-v34-ok{background:#e9f9ef;color:#05703c;border-color:#bfeacb;}.kore-v34-warn{background:#fff5e4;color:#b45309;border-color:#fed7aa;}.kore-v34-bad{background:#fff0f0;color:#c92121;border-color:#fecaca;}';
            css += '.kore-v34-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;}';
            css += '.kore-v34-kpi{position:relative;overflow:hidden;background:#fff;border:1px solid #dbe5f0;border-radius:10px;box-shadow:0 10px 24px rgba(15,23,42,.055);padding:17px 14px 12px;min-height:174px;text-align:left!important;}';
            css += '.kore-v34-kpi:after{content:"";position:absolute;left:14px;right:14px;bottom:10px;height:7px;border-radius:999px;background:#e9eef5;}';
            css += '.kore-v34-kpi:before{content:"";position:absolute;left:14px;bottom:10px;height:7px;width:45%;border-radius:999px;background:#98a2b3;z-index:1;}';
            css += '.kore-v34-kpi-red{background:linear-gradient(135deg,#fff 0%,#fff7f7 100%);border-color:#f3cbcb!important;}.kore-v34-kpi-red:before{background:#e73333;}';
            css += '.kore-v34-kpi-orange{background:linear-gradient(135deg,#fff 0%,#fff9ef 100%);border-color:#f4dfbf!important;}.kore-v34-kpi-orange:before{background:#f59e0b;}';
            css += '.kore-v34-kpi-green{background:linear-gradient(135deg,#fff 0%,#f0fff7 100%);border-color:#c9ead8!important;}.kore-v34-kpi-green:before{background:#18a766;}';
            css += '.kore-v34-kpi-blue{background:linear-gradient(135deg,#fff 0%,#f0f7ff 100%);border-color:#c9dcf7!important;}.kore-v34-kpi-blue:before{background:#1d69d8;}';
            css += '.kore-v34-kpi-purple{background:linear-gradient(135deg,#fff 0%,#f8f1ff 100%);border-color:#decdf9!important;}.kore-v34-kpi-purple:before{background:#8b3fe6;}';
            css += '.kore-v34-kpi-head{display:flex;gap:10px;align-items:center;margin-bottom:8px;}';
            css += '.kore-v34-icon{width:38px;height:38px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:19px;box-shadow:0 7px 14px rgba(15,23,42,.08);background:#eef2f7;}';
            css += '.kore-v34-kpi-title{font-size:14px;font-weight:950;margin:0;}.kore-v34-kpi-red .kore-v34-kpi-title{color:#dc2626;}.kore-v34-kpi-orange .kore-v34-kpi-title{color:#d97706;}.kore-v34-kpi-green .kore-v34-kpi-title{color:#078348;}.kore-v34-kpi-blue .kore-v34-kpi-title{color:#1d5bc7;}.kore-v34-kpi-purple .kore-v34-kpi-title{color:#7137c7;}';
            css += '.kore-v34-kpi-value{font-size:38px;font-weight:950;letter-spacing:-.05em;color:#07152e;line-height:1;margin:4px 0 10px;}';
            css += '.kore-v34-kpi-detail{font-size:12px;line-height:1.45;color:#13223b;font-weight:700;margin-bottom:20px;}';
            css += '.kore-v34-kpi-detail b{font-size:14px;color:#07152e;margin-right:6px;}';
            css += '.kore-v34-problems{background:#fff;border:1px solid #dbe5f0;border-radius:10px;box-shadow:0 10px 24px rgba(15,23,42,.055);padding:16px 18px;margin-bottom:18px;}';
            css += '.kore-v34-problems h3{font-size:18px!important;font-weight:950!important;color:#07152e!important;margin:0 0 14px!important;}';
            css += '.kore-problem-menu{display:flex!important;gap:10px!important;flex-wrap:wrap!important;padding:0!important;border:0!important;background:transparent!important;}';
            css += '.kore-problem-menu button{display:inline-flex!important;align-items:center!important;gap:8px!important;border-radius:10px!important;padding:10px 13px!important;background:#fff!important;border:1px solid #dbe5f0!important;box-shadow:0 4px 10px rgba(15,23,42,.045)!important;}';
            css += '.kore-menu-critical{color:#b42318!important;background:#fff7f7!important;border-color:#fecaca!important;}.kore-menu-review{color:#a15c07!important;background:#fff8eb!important;border-color:#fed7aa!important;}.kore-menu-ok{color:#05703c!important;background:#effcf4!important;border-color:#bfeacb!important;}.kore-menu-context{color:#124fb3!important;background:#eff6ff!important;border-color:#bfdbfe!important;}.kore-menu-neutral{color:#4b2e83!important;background:#f7f1ff!important;border-color:#decdf9!important;}';
            css += '.kore-filtro-ativo{outline:2px solid rgba(17,103,216,.20)!important;border-color:#1167d8!important;}';
            css += '.kore-problem-count{font-weight:950!important;color:inherit!important;}';
            css += '.kore-v34-alert{display:flex;align-items:center;gap:9px;border:1px solid #fecaca;background:#fff7f7;color:#7f1d1d;border-radius:9px;padding:12px 14px;margin:0 0 14px;font-size:13px;font-weight:700;}';
            css += '.kore-v34-toolbar{display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-bottom:14px;}';
            css += '.kore-table-wrap{border:1px solid #dbe5f0!important;border-radius:10px!important;overflow:auto!important;background:#fff!important;}';
            css += '.kore-table{font-size:12px!important;border-collapse:separate!important;border-spacing:0!important;background:#fff!important;}';
            css += '.kore-table th{position:sticky;top:0;z-index:2;background:#f6f9fe!important;color:#17233b!important;border-bottom:1px solid #dbe5f0!important;font-size:11px!important;text-transform:none!important;letter-spacing:0!important;font-weight:900!important;padding:12px 10px!important;}';
            css += '.kore-table td{border-bottom:1px solid #e8eef6!important;color:#1f2937!important;padding:12px 10px!important;vertical-align:middle!important;background:#fff!important;}';
            css += '.kore-table tr:hover td{background:#fbfdff!important;}';
            css += '.kore-title-cell{font-weight:820!important;color:#07152e!important;min-width:160px!important;}';
            css += '.kore-marc-chip,.kore-occurrence-chip{display:inline-block;background:#f2f5fa;border-radius:7px;padding:5px 7px;color:#17233b;line-height:1.35;}';
            css += '.kore-priority-pill{border-radius:8px!important;padding:7px 10px!important;font-size:12px!important;}';
            css += '.kore-table-footer{border-top:0!important;background:transparent!important;padding:14px 4px 0!important;color:#475467!important;}';
            css += '.kore-link-primary{color:#b42318!important;background:#fff7f7!important;border-color:#fecaca!important;}';


            /* Ajuste v3.6: desenho mais Koha, menos arredondado, botões discretos e carregamento bibliográfico reposicionado */
            css += '#kore-identidade{font-weight:400;}';
            css += '#kore-identidade h2{font-weight:650!important;}';
            css += '#kore-identidade h3{font-weight:600!important;}';
            css += '#kore-identidade button,#kore-identidade a.kore-btn{font-weight:500!important;}';
            css += '.kore-header-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;}';
            css += '.kore-header-actions .kore-tab{border-radius:8px!important;padding:10px 16px!important;font-weight:550!important;}';
            css += '.kore-v34-name{font-weight:700!important;letter-spacing:-.02em!important;}';
            css += '.kore-v34-line{font-weight:400!important;}';
            css += '.kore-v34-link{font-weight:550!important;}';
            css += '.kore-v34-badge{font-weight:550!important;padding:7px 10px!important;}';
            css += '.kore-v34-kpi-title{font-weight:650!important;}';
            css += '.kore-v34-kpi-value{font-weight:720!important;letter-spacing:-.03em!important;}';
            css += '.kore-v34-kpi-detail{font-weight:400!important;color:#344054!important;}';
            css += '.kore-v34-kpi-detail b{font-weight:650!important;}';
            css += '.kore-v34-problems h3{font-weight:650!important;}';
            css += '.kore-problem-menu button{font-weight:500!important;}';
            css += '.kore-problem-count{font-weight:650!important;}';
            css += '.kore-table th{font-weight:600!important;}';
            css += '.kore-table td.kore-title-cell,.kore-title-cell{font-weight:520!important;}';
            css += '.kore-priority-pill{font-weight:550!important;}';
            css += '.kore-v34-alert{font-weight:450!important;}';
            css += '.kore-load-bib-btn{background:#0f172a!important;color:#fff!important;border-color:#0f172a!important;border-radius:8px!important;padding:9px 14px!important;font-weight:600!important;}';
            css += '.kore-load-bib-btn:hover{background:#1e293b!important;color:#fff!important;border-color:#1e293b!important;}';
            css += '.kore-load-bib-help{font-size:12px;color:#667085;align-self:center;}';


            /* Ajuste visual v3.6, mais próximo do Koha: superfícies discretas, cantos menores e menos ênfase tipográfica */
            css += '#kore-identidade{border-radius:2px!important;box-shadow:none!important;border-color:#cfd8e3!important;background:#fff!important;}';
            css += '.kore-header{background:#f7f8fa!important;border-bottom:1px solid #d8dee6!important;padding:10px 13px!important;}';
            css += '#kore-identidade h2{font-size:16px!important;font-weight:600!important;letter-spacing:0!important;}';
            css += '#kore-identidade h3{font-weight:560!important;}';
            css += '#kore-identidade button,#kore-identidade a.kore-btn{border-radius:3px!important;font-weight:450!important;box-shadow:none!important;}';
            css += '.kore-header-actions .kore-tab{border-radius:3px!important;padding:8px 12px!important;background:#fff!important;border-color:#cfd8e3!important;color:#1f2937!important;font-weight:500!important;}';
            css += '.kore-header-actions .kore-tab.kore-tab-ativa{background:#eef4fb!important;border-color:#9fb9d7!important;color:#123b68!important;}';
            css += '.kore-tab-panel{background:#fff!important;}';
            css += '.kore-v34-main{gap:12px!important;}';
            css += '.kore-v34-identity,.kore-v34-kpi,.kore-v34-problems,.kore-table-wrap,.kore-dashboard-controlbar{border-radius:4px!important;box-shadow:none!important;border-color:#d8dee6!important;}';
            css += '.kore-v34-photo{border-radius:3px!important;}';
            css += '.kore-v34-name{font-size:22px!important;font-weight:620!important;letter-spacing:-.01em!important;}';
            css += '.kore-v34-line{font-size:12px!important;color:#344054!important;}';
            css += '.kore-v34-badge{border-radius:3px!important;font-weight:500!important;padding:6px 9px!important;}';
            css += '.kore-v34-kpis{gap:10px!important;}';
            css += '.kore-v34-kpi{min-height:142px!important;padding:13px 12px 10px!important;border-radius:4px!important;background:#fff!important;}';
            css += '.kore-v34-kpi:after{height:4px!important;border-radius:2px!important;left:12px!important;right:12px!important;bottom:9px!important;}';
            css += '.kore-v34-kpi:before{height:4px!important;border-radius:2px!important;left:12px!important;bottom:9px!important;}';
            css += '.kore-v34-kpi-head{margin-bottom:5px!important;}';
            css += '.kore-v34-icon{width:31px!important;height:31px!important;border-radius:3px!important;font-size:16px!important;box-shadow:none!important;}';
            css += '.kore-v34-kpi-title{font-size:13px!important;font-weight:560!important;}';
            css += '.kore-v34-kpi-value{font-size:31px!important;font-weight:620!important;letter-spacing:-.02em!important;}';
            css += '.kore-v34-kpi-detail{font-size:12px!important;font-weight:400!important;line-height:1.35!important;margin-bottom:15px!important;}';
            css += '.kore-v34-problems{padding:12px 13px!important;margin-bottom:12px!important;background:#fff!important;}';
            css += '.kore-v34-problems h3{font-size:15px!important;font-weight:560!important;margin:0 0 10px!important;}';
            css += '.kore-problem-menu{gap:6px!important;padding:0!important;}';
            css += '.kore-problem-menu button{border-radius:3px!important;padding:6px 9px!important;background:#f9fafb!important;border-color:#d8dee6!important;box-shadow:none!important;color:#344054!important;font-weight:450!important;}';
            css += '.kore-problem-menu button:hover{background:#eef4fb!important;border-color:#aab7c4!important;color:#111827!important;}';
            css += '.kore-problem-count{font-weight:560!important;color:#1f2937!important;}';
            css += '.kore-menu-critical,.kore-menu-review,.kore-menu-context,.kore-menu-ok,.kore-menu-neutral{background:#f9fafb!important;border-color:#d8dee6!important;}';
            css += '.kore-filtro-ativo{outline:0!important;background:#eef4fb!important;border-color:#7da2c8!important;color:#123b68!important;}';
            css += '.kore-v34-alert{border-radius:3px!important;background:#fff8f8!important;padding:9px 11px!important;font-size:12px!important;font-weight:400!important;margin-bottom:10px!important;}';
            css += '.kore-table-wrap{border-radius:3px!important;}';
            css += '.kore-table th{font-weight:560!important;padding:9px 8px!important;background:#f3f5f7!important;color:#1f2937!important;}';
            css += '.kore-table td{padding:9px 8px!important;vertical-align:top!important;}';
            css += '.kore-title-cell{font-weight:500!important;}';
            css += '.kore-marc-chip,.kore-occurrence-chip{border-radius:3px!important;padding:4px 6px!important;background:#f3f5f7!important;}';
            css += '.kore-priority-pill{border-radius:3px!important;padding:5px 8px!important;font-weight:500!important;}';
            css += '.kore-dashboard-controlbar{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#f7f8fa;border:1px solid #d8dee6;padding:10px 12px;margin-bottom:10px;}';
            css += '.kore-dashboard-controltext strong{display:block;font-size:13px;font-weight:560;color:#111827;margin-bottom:2px;}';
            css += '.kore-dashboard-controltext span{display:block;font-size:12px;color:#667085;line-height:1.3;}';
            css += '.kore-load-bib-btn{background:#eef4fb!important;color:#123b68!important;border-color:#9fb9d7!important;border-radius:3px!important;padding:7px 11px!important;font-weight:500!important;white-space:nowrap;}';
            css += '.kore-load-bib-btn:hover{background:#dfeaf6!important;color:#0f2f52!important;border-color:#7da2c8!important;}';
            css += '.kore-dashboard-statusline{border-radius:3px!important;background:#fff!important;border:1px solid #e1e7ef!important;margin:0 0 10px 0!important;}';
            css += '.kore-dashboard-progress{border:1px solid #d8dee6;background:#fff;border-radius:3px;padding:8px 10px;margin:0 0 10px 0;}';
            css += '.kore-dashboard-progress.kore-fechado{display:none;}';
            css += '.kore-dashboard-progressbar{height:6px;background:#e9eef5;border-radius:2px;overflow:hidden;}';
            css += '.kore-dashboard-progressbar span{display:block;height:100%;width:0;background:#7da2c8;border-radius:2px;transition:width .18s ease;}';
            css += '.kore-dashboard-progresslabel{font-size:12px;color:#475467;margin-top:5px;}';
            css += '.kore-table-footer{padding:10px 2px 0!important;}';



            /* v3.8, topo alinhado, identidade mais limpa e botões discretos */
            css += '.kore-v34-top{display:grid!important;grid-template-columns:minmax(520px,1.08fr) minmax(620px,1.42fr)!important;gap:12px!important;align-items:stretch!important;margin:10px 0 12px!important;}';
            css += '.kore-v34-identity{height:100%!important;border-radius:3px!important;box-shadow:none!important;border-color:#d8dee6!important;padding:12px 13px!important;background:#fff!important;}';
            css += '.kore-v34-identity-main{grid-template-columns:104px 1fr!important;gap:12px!important;align-items:start!important;}';
            css += '.kore-v34-photo{width:104px!important;height:138px!important;border-radius:2px!important;border-color:#cfd8e3!important;}';
            css += '.kore-v34-name{font-size:19px!important;font-weight:620!important;letter-spacing:-.01em!important;margin:0 0 4px!important;color:#111827!important;}';
            css += '.kore-v34-line{font-size:12px!important;margin:5px 0!important;color:#344054!important;line-height:1.35!important;}';
            css += '.kore-v34-line span{padding-right:10px!important;margin-right:10px!important;border-color:#e5e7eb!important;}';
            css += '.kore-v34-fieldgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px 7px;margin-top:8px;}';
            css += '.kore-v34-field{border:1px solid #e5e7eb;background:#fbfcfe;border-radius:2px;padding:5px 7px;min-height:40px;font-size:11px;line-height:1.25;color:#111827;}';
            css += '.kore-v34-field strong{display:block;font-size:11px;font-weight:600;color:#111827;margin-bottom:2px;}';
            css += '.kore-v34-field a{font-weight:500!important;color:#1167d8!important;text-decoration:none!important;}';
            css += '.kore-v34-alertgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:9px;}';
            css += '.kore-v34-mini-alert{border:1px solid #e5e7eb;border-radius:2px;padding:7px 8px;font-size:11px;line-height:1.3;background:#fcfcfd;color:#344054;}';
            css += '.kore-v34-mini-alert strong{display:block;font-size:11px;font-weight:600;margin-bottom:2px;}';
            css += '.kore-v34-mini-alert.kore-v34-ok{background:#f0fdf4!important;color:#06633a!important;border-color:#bbf7d0!important;}';
            css += '.kore-v34-mini-alert.kore-v34-warn{background:#fffbeb!important;color:#92400e!important;border-color:#fde68a!important;}';
            css += '.kore-v34-mini-alert.kore-v34-bad{background:#fff7ed!important;color:#b45309!important;border-color:#fed7aa!important;}';
            css += '.kore-v34-badges{display:none!important;}';
            css += '.kore-v34-kpis{height:100%!important;display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important;align-items:stretch!important;margin:0!important;}';
            css += '.kore-v34-kpi{min-height:0!important;height:100%!important;border-radius:3px!important;box-shadow:none!important;padding:12px 11px 11px!important;background:#fff!important;}';
            css += '.kore-v34-kpi-head{gap:7px!important;margin-bottom:8px!important;}';
            css += '.kore-v34-icon{width:28px!important;height:28px!important;border-radius:2px!important;box-shadow:none!important;font-size:14px!important;}';
            css += '.kore-v34-kpi-title{font-size:12px!important;font-weight:560!important;}';
            css += '.kore-v34-kpi-value{font-size:28px!important;font-weight:560!important;letter-spacing:-.02em!important;margin:7px 0 9px!important;}';
            css += '.kore-v34-kpi-detail{font-size:11.5px!important;font-weight:400!important;line-height:1.35!important;color:#344054!important;margin-bottom:16px!important;}';
            css += '.kore-v34-kpi-detail b{font-size:12px!important;font-weight:560!important;color:#111827!important;}';
            css += '.kore-v34-kpi:after{height:3px!important;border-radius:1px!important;left:11px!important;right:11px!important;bottom:8px!important;}';
            css += '.kore-v34-kpi:before{height:3px!important;border-radius:1px!important;left:11px!important;bottom:8px!important;}';
            css += '.kore-v34-problems{border-radius:3px!important;box-shadow:none!important;padding:10px 11px!important;margin-bottom:10px!important;}';
            css += '.kore-v34-problems h3{font-size:14px!important;font-weight:560!important;margin:0 0 8px!important;color:#111827!important;}';
            css += '.kore-problem-menu{gap:5px!important;padding:0!important;}';
            css += '.kore-problem-menu button{border-radius:2px!important;padding:5px 8px!important;background:#fafbfc!important;border-color:#d8dee6!important;box-shadow:none!important;color:#344054!important;font-weight:400!important;font-size:11.5px!important;gap:5px!important;}';
            css += '.kore-problem-menu button:hover{background:#eef3f8!important;border-color:#aeb8c4!important;color:#111827!important;}';
            css += '.kore-problem-count{font-weight:500!important;color:#1f2937!important;}';
            css += '.kore-menu-critical,.kore-menu-review,.kore-menu-context,.kore-menu-ok,.kore-menu-neutral{border-left-width:2px!important;background:#fafbfc!important;}';
            css += '.kore-v34-alert{display:none!important;}';
            css += '@media(max-width:1300px){.kore-v34-top{grid-template-columns:1fr!important}.kore-v34-kpis{grid-template-columns:repeat(3,minmax(0,1fr))!important;}.kore-v34-fieldgrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;}}';
            css += '@media(max-width:760px){.kore-v34-kpis{grid-template-columns:1fr!important;}.kore-v34-identity-main{grid-template-columns:1fr!important;}.kore-v34-photo{width:100%!important;height:180px!important;}.kore-v34-fieldgrid,.kore-v34-alertgrid{grid-template-columns:1fr!important;}}';


            /* v3.9, afinação final: topo alinhado, contagens sempre a 0 e menus operacionais discretos */
            css += '.kore-v34-top{grid-template-columns:minmax(560px,1.05fr) minmax(620px,1.45fr)!important;gap:10px!important;align-items:stretch!important;}';
            css += '.kore-v34-identity,.kore-v34-kpi,.kore-v34-problems,.kore-table-wrap{border-radius:2px!important;box-shadow:none!important;}';
            css += '.kore-v34-identity{padding:11px 12px!important;}';
            css += '.kore-v34-name{font-size:18px!important;font-weight:600!important;}';
            css += '.kore-v34-line span{font-weight:400!important;}';
            css += '.kore-v34-field{min-height:38px!important;background:#fbfcfe!important;}';
            css += '.kore-v34-field strong,.kore-v34-mini-alert strong{font-weight:560!important;}';
            css += '.kore-v34-kpi{padding:11px 10px 10px!important;min-height:136px!important;}';
            css += '.kore-v34-kpi-head{margin-bottom:6px!important;}';
            css += '.kore-v34-icon{width:24px!important;height:24px!important;font-size:12px!important;background:#f1f5f9!important;color:#344054!important;}';
            css += '.kore-v34-kpi-title{font-size:11.5px!important;font-weight:560!important;text-transform:uppercase!important;letter-spacing:.01em!important;}';
            css += '.kore-v34-kpi-value{font-size:26px!important;font-weight:560!important;margin:6px 0 8px!important;}';
            css += '.kore-v34-kpi-detail{font-size:11px!important;font-weight:400!important;color:#344054!important;text-transform:uppercase!important;}';
            css += '.kore-v34-kpi-detail b{font-size:11.5px!important;font-weight:560!important;}';
            css += '.kore-v34-kpi:before,.kore-v34-kpi:after{height:2px!important;bottom:7px!important;}';
            css += '.kore-v34-problems{padding:9px 10px!important;}';
            css += '.kore-v34-problems h3{font-size:13px!important;font-weight:560!important;margin:0 0 8px!important;}';
            css += '.kore-problem-menu{gap:4px!important;padding:0!important;align-items:center!important;}';
            css += '.kore-problem-menu button{min-height:27px!important;border-radius:2px!important;padding:4px 7px!important;background:#fff!important;border:1px solid #d8dee6!important;box-shadow:none!important;color:#334155!important;font-size:11px!important;font-weight:400!important;line-height:1.1!important;gap:4px!important;text-transform:uppercase!important;}';
            css += '.kore-problem-menu button:hover{background:#f6f8fa!important;border-color:#aeb8c4!important;color:#111827!important;}';
            css += '.kore-menu-icon{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:16px!important;height:16px!important;border-radius:2px!important;background:#f1f5f9!important;color:#475569!important;font-size:10px!important;font-weight:500!important;}';
            css += '.kore-menu-label{font-weight:400!important;}';
            css += '.kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:18px!important;height:16px!important;margin-left:2px!important;padding:0 4px!important;border-radius:2px!important;background:#f1f5f9!important;color:#334155!important;font-weight:500!important;font-size:10.5px!important;}';
            css += '.kore-menu-critical,.kore-menu-review,.kore-menu-context,.kore-menu-ok,.kore-menu-neutral{border-left-width:1px!important;background:#fff!important;}';
            css += '.kore-menu-critical .kore-menu-icon{color:#b42318!important;background:#fff5f5!important;}';
            css += '.kore-menu-review .kore-menu-icon{color:#92400e!important;background:#fffbeb!important;}';
            css += '.kore-menu-ok .kore-menu-icon{color:#067647!important;background:#f0fdf4!important;}';
            css += '.kore-menu-context .kore-menu-icon{color:#1d4ed8!important;background:#eff6ff!important;}';
            css += '.kore-menu-neutral .kore-menu-icon{color:#475569!important;background:#f1f5f9!important;}';
            css += '.kore-filtro-ativo{background:#eef4fb!important;border-color:#7da2c8!important;color:#123b68!important;outline:0!important;}';
            css += '.kore-filtro-ativo .kore-problem-count,.kore-filtro-ativo .kore-menu-icon{background:#dceaf7!important;color:#123b68!important;}';
            css += '.kore-table th{font-weight:560!important;padding:8px 7px!important;}';
            css += '.kore-table td{padding:8px 7px!important;}';



            /* ==========================================================
               v4.2 AJUSTES VISUAIS
               Menus minimalistas, sem cores agressivas, texto menor,
               cantos menos arredondados e leitura mais próxima do Koha.
               21. v4.15: corrige coerência dos filtros $9/$4, limpa leitura MARC operacional e evita redundância $4 ausente/$4 —
   ========================================================== */
            css += '#kore-identidade{border-radius:2px!important;box-shadow:none!important;}';
            css += '#kore-identidade h2{font-size:16px!important;font-weight:650!important;}';
            css += '#kore-identidade h3{font-size:13px!important;font-weight:650!important;}';
            css += '#kore-identidade p{font-size:11px!important;}';
            css += '.kore-header{padding:9px 12px!important;}';
            css += '.kore-header-actions{display:flex;gap:5px;align-items:center;}';
            css += '#kore-identidade button,#kore-identidade a.kore-btn{border-radius:2px!important;font-size:11px!important;font-weight:500!important;padding:4px 7px!important;}';
            css += '.kore-tab{font-size:11px!important;font-weight:500!important;}';
            css += '.kore-tab-ativa{background:#f6f8fa!important;border-color:#98a2b3!important;color:#24292f!important;}';
            css += '.kore-tab-panel{padding:10px 12px!important;}';
            css += '.kore-v34-main{display:grid!important;grid-template-columns:1fr 1fr 1fr 1fr!important;gap:8px!important;align-items:stretch!important;}';
            css += '.kore-v34-identity,.kore-v34-card{border:1px solid #d0d7de!important;border-radius:2px!important;box-shadow:none!important;background:#fff!important;min-height:128px!important;}';
            css += '.kore-v34-identity{padding:10px!important;}';
            css += '.kore-v34-photo{width:78px!important;height:104px!important;border-radius:2px!important;}';
            css += '.kore-v34-name{font-size:18px!important;font-weight:650!important;line-height:1.15!important;}';
            css += '.kore-v34-sub{font-size:11px!important;color:#667085!important;}';
            css += '.kore-v34-fields{gap:4px!important;margin-top:7px!important;}';
            css += '.kore-v34-field{font-size:10px!important;padding:4px 5px!important;border-radius:2px!important;background:#f8fafc!important;}';
            css += '.kore-v34-field strong{font-size:10px!important;font-weight:600!important;}';
            css += '.kore-v34-card{padding:10px!important;}';
            css += '.kore-v34-card h3{font-size:12px!important;font-weight:650!important;margin-bottom:5px!important;}';
            css += '.kore-v34-number{font-size:25px!important;font-weight:700!important;}';
            css += '.kore-v34-card small{font-size:10px!important;}';
            css += '.kore-modern-wrap{grid-template-columns:1fr!important;gap:8px!important;margin:10px 0!important;}';
            css += '.kore-modern-identity,.kore-modern-kpi,.kore-modern-variants,.kore-workbench-card,.kore-panel,.kore-secondary-box,.kore-correction-box{border-radius:2px!important;box-shadow:none!important;border-color:#d0d7de!important;}';
            css += '.kore-modern-kpis{grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important;margin:10px 0!important;}';
            css += '.kore-modern-kpi{padding:10px!important;min-height:auto!important;}';
            css += '.kore-modern-kpi:before{display:none!important;}';
            css += '.kore-modern-kpi h3{font-size:12px!important;font-weight:650!important;}';
            css += '.kore-modern-kpi p{font-size:10px!important;margin-bottom:5px!important;}';
            css += '.kore-modern-kpi-total{font-size:24px!important;font-weight:700!important;margin:3px 0!important;}';
            css += '.kore-modern-kpi-total span{font-size:9px!important;font-weight:600!important;}';
            css += '.kore-modern-submetric{grid-template-columns:32px 1fr!important;gap:6px!important;border-radius:2px!important;padding:5px 6px!important;margin-top:5px!important;background:#fff!important;}';
            css += '.kore-modern-submetric strong{font-size:15px!important;font-weight:650!important;}';
            css += '.kore-modern-submetric span{font-size:10px!important;font-weight:600!important;}';
            css += '.kore-modern-submetric small{font-size:9px!important;text-transform:none!important;}';
            css += '.kore-problem-menu{display:flex!important;gap:5px!important;flex-wrap:wrap!important;padding:7px 9px!important;border-bottom:1px solid #e5e7eb!important;background:#fff!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{display:inline-flex!important;align-items:center!important;gap:4px!important;padding:3px 7px!important;border:1px solid #d0d7de!important;background:#fff!important;border-radius:2px!important;font-size:10px!important;line-height:1.2!important;font-weight:500!important;color:#344054!important;box-shadow:none!important;text-transform:none!important;min-height:auto!important;}';
            css += '.kore-problem-menu button:hover,.kore-filtro-intervencao:hover{background:#f6f8fa!important;border-color:#98a2b3!important;color:#111827!important;}';
            css += '.kore-problem-menu i,.kore-problem-menu svg{width:9px!important;height:9px!important;font-size:9px!important;opacity:.65!important;color:#667085!important;}';
            css += '.kore-problem-count{font-size:10px!important;font-weight:600!important;color:#111827!important;margin-right:2px!important;}';
            css += '.kore-menu-critical,.kore-menu-review,.kore-menu-context,.kore-menu-ok,.kore-menu-neutral{border-left:1px solid #d0d7de!important;}';
            css += '.kore-filtro-ativo{border-color:#98a2b3!important;background:#f6f8fa!important;color:#111827!important;}';
            css += '.kore-table-intro{padding:7px 9px!important;background:#fff!important;}';
            css += '.kore-table-intro strong{font-size:12px!important;font-weight:650!important;}';
            css += '.kore-table-intro span{font-size:10px!important;}';
            css += '.kore-table th{font-size:10px!important;font-weight:600!important;text-transform:none!important;letter-spacing:0!important;padding:6px!important;}';
            css += '.kore-table td{font-size:11px!important;padding:6px!important;}';
            css += '.kore-table td.kore-title-cell{font-weight:600!important;}';
            css += '.kore-priority-critical,.kore-priority-review,.kore-priority-info{font-weight:600!important;}';
            css += '.kore-priority-pill{border-radius:2px!important;font-size:10px!important;font-weight:600!important;padding:2px 5px!important;background:#fff!important;border:1px solid #d0d7de!important;color:#344054!important;}';
            css += '.kore-priority-pill:before{width:5px!important;height:5px!important;}';
            css += '.kore-badge{border-radius:2px!important;font-size:9px!important;font-weight:600!important;}';
            css += '.kore-vazio{font-size:11px!important;font-style:normal!important;color:#667085!important;}';
            css += '@media(max-width:1200px){.kore-v34-main,.kore-modern-kpis{grid-template-columns:1fr 1fr!important;}}';
            css += '@media(max-width:800px){.kore-v34-main,.kore-modern-kpis{grid-template-columns:1fr!important;}}';


            /* ==========================================================
               v4.3 AJUSTES FINOS
               Logo preto, botões superiores maiores, texto ligeiramente maior,
               menus discretos e ícones de ação mais claros.
               21. v4.15: corrige coerência dos filtros $9/$4, limpa leitura MARC operacional e evita redundância $4 ausente/$4 —
   ========================================================== */
            css += '#kore-identidade{font-size:12px!important;}';
            css += '#kore-identidade .kore-header h2,#kore-identidade h2{font-size:20px!important;font-weight:400!important;letter-spacing:-.015em!important;color:#111827!important;}';
            css += '#kore-identidade .kore-header h2 span,#kore-identidade h2 span{color:#111827!important;font-weight:400!important;}';
            css += '#kore-identidade .kore-header h2:before{font-size:18px!important;font-weight:400!important;color:#111827!important;margin-right:12px!important;}';
            css += '#kore-identidade .kore-header p{font-size:12px!important;color:#475467!important;margin-top:4px!important;}';
            css += '#kore-identidade .kore-header-actions .kore-tab{font-size:12px!important;font-weight:500!important;padding:7px 11px!important;min-height:30px!important;border-radius:2px!important;}';
            css += '#kore-identidade .kore-header-actions .kore-tab.kore-tab-ativa{background:#f6f8fa!important;border-color:#8c9bab!important;color:#111827!important;}';

            css += '.kore-v34-name{font-size:19px!important;font-weight:650!important;}';
            css += '.kore-v34-line{font-size:12px!important;}';
            css += '.kore-v34-field{font-size:11px!important;}';
            css += '.kore-v34-field strong{font-size:10.5px!important;}';
            css += '.kore-v34-mini-alert{font-size:11px!important;}';
            css += '.kore-v34-mini-alert strong{font-size:11px!important;}';

            css += '.kore-v34-kpi-title{font-size:12px!important;font-weight:650!important;color:#111827!important;}';
            css += '.kore-v34-kpi-value{font-size:28px!important;font-weight:760!important;}';
            css += '.kore-v34-kpi-detail{font-size:11px!important;font-weight:500!important;}';
            css += '.kore-v34-kpi-detail b{font-size:12px!important;font-weight:650!important;}';
            css += '.kore-v34-icon{width:22px!important;height:22px!important;border-radius:2px!important;font-size:12px!important;box-shadow:none!important;background:#f3f5f7!important;color:#344054!important;}';

            css += '.kore-v34-problems h3{font-size:13px!important;font-weight:650!important;}';
            css += '.kore-problem-menu{gap:5px!important;padding:6px 7px!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{font-size:10.5px!important;font-weight:450!important;padding:4px 7px!important;color:#344054!important;background:#fff!important;border-color:#cfd8e3!important;}';
            css += '.kore-problem-menu button:hover,.kore-filtro-intervencao:hover{background:#f6f8fa!important;color:#111827!important;}';
            css += '.kore-menu-icon{width:14px!important;height:14px!important;min-width:14px!important;font-size:9px!important;background:#f3f5f7!important;color:#667085!important;}';
            css += '.kore-menu-label{font-size:10.5px!important;font-weight:450!important;}';
            css += '.kore-problem-count{font-size:10.5px!important;font-weight:550!important;background:#f6f8fa!important;color:#344054!important;}';

            css += '.kore-table th{font-size:11px!important;font-weight:600!important;padding:7px!important;}';
            css += '.kore-table td{font-size:12px!important;padding:7px!important;}';
            css += '.kore-action-detail{font-size:11px!important;}';
            css += '.kore-table td.kore-title-cell{font-weight:600!important;}';

            css += '.kore-table-links{display:flex!important;gap:4px!important;align-items:center!important;flex-wrap:nowrap!important;}';
            css += '.kore-table-links a.kore-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:24px!important;height:23px!important;min-width:24px!important;padding:0!important;font-size:11px!important;font-weight:500!important;line-height:1!important;border-radius:2px!important;background:#fff!important;border:1px solid #cfd8e3!important;color:#1f2937!important;box-shadow:none!important;text-align:center!important;}';
            css += '.kore-table-links a.kore-btn:hover{background:#f6f8fa!important;border-color:#8c9bab!important;color:#111827!important;}';
            css += '.kore-table-links .kore-link-edit{font-size:13px!important;}';
            css += '.kore-table-links .kore-link-record{font-size:12px!important;}';
            css += '.kore-table-links .kore-link-marc{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;font-size:10.5px!important;font-weight:650!important;}';
            css += '.kore-table-links .kore-link-opac{font-size:12px!important;}';

            css += '.kore-vazio{font-size:12px!important;}';


            /* ==========================================================
               v4.4 AJUSTES PEDIDOS
               - índice com cor e designação simples
               - remove painéis 200$f, 400 e formas variantes do cartão de identidade
               - menus sem ícones à esquerda
               - contadores vazios apresentados como 0
               21. v4.15: corrige coerência dos filtros $9/$4, limpa leitura MARC operacional e evita redundância $4 ausente/$4 —
   ========================================================== */
            css += '.kore-v34-field:has(strong:contains("200$f")), .kore-v34-field:has(strong:contains("400")){display:none!important;}';
            css += '.kore-v34-mini-alert:has(strong:contains("Formas variantes")){display:none!important;}';

            /* fallback sem :has, aplicado por JS no fim de cada render */
            css += '.kore-hide-identity-extra{display:none!important;}';

            css += '.kore-v34-score-good{background:#eaf7ef!important;border-color:#b7e4c7!important;color:#05603a!important;}';
            css += '.kore-v34-score-warning{background:#fff7e6!important;border-color:#ffd8a8!important;color:#b54708!important;}';
            css += '.kore-v34-score-critical{background:#fff1f0!important;border-color:#ffc9c4!important;color:#b42318!important;}';
            css += '.kore-v34-line .kore-score-inline{display:inline-flex!important;align-items:center!important;padding:2px 7px!important;border:1px solid #d0d7de!important;border-radius:2px!important;font-size:12px!important;font-weight:600!important;line-height:1.25!important;}';

            css += '.kore-menu-icon{display:none!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{gap:3px!important;font-size:10.5px!important;}';
            css += '.kore-menu-label{font-size:10.5px!important;}';

            css += '.kore-empty-count::after{content:"0";}';


            /* ==========================================================
               v4.5 AJUSTES PEDIDOS
               - cartão de identidade simplificado
               - Qualidade com cor
               - menus com label e número separados
               - KPI alinhado à direita
               - ligações uniformes e símbolos claros
               21. v4.15: corrige coerência dos filtros $9/$4, limpa leitura MARC operacional e evita redundância $4 ausente/$4 —
   ========================================================== */
            css += '.kore-hide-identity-extra{display:none!important;}';

            css += '.kore-v34-identity{align-items:start!important;}';
            css += '.kore-v34-name,.kore-authority-title,.kore-modern-name{font-size:20px!important;font-weight:650!important;line-height:1.15!important;margin-bottom:6px!important;color:#111827!important;}';
            css += '.kore-v34-line,.kore-authority-sub,.kore-modern-sub{display:flex!important;gap:8px!important;align-items:center!important;flex-wrap:wrap!important;font-size:12px!important;color:#344054!important;}';
            css += '.kore-v45-authid strong,.kore-v45-score strong{font-weight:700!important;}';
            css += '.kore-v45-sep{color:#c7ced8!important;}';
            css += '.kore-v45-score{display:inline-flex!important;align-items:center!important;padding:2px 7px!important;border:1px solid #d0d7de!important;border-radius:2px!important;font-size:12px!important;font-weight:500!important;line-height:1.25!important;background:#fff!important;}';
            css += '.kore-v45-score-good{background:#ecfdf3!important;border-color:#abefc6!important;color:#05603a!important;}';
            css += '.kore-v45-score-warning{background:#fffaeb!important;border-color:#fedf89!important;color:#b54708!important;}';
            css += '.kore-v45-score-critical{background:#fff1f0!important;border-color:#ffc9c4!important;color:#b42318!important;}';

            css += '.kore-v34-fields{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;}';
            css += '.kore-v34-field{min-height:38px!important;padding:6px 8px!important;display:flex!important;flex-direction:column!important;justify-content:flex-start!important;text-align:left!important;}';
            css += '.kore-v34-field strong{font-size:11px!important;font-weight:700!important;color:#111827!important;margin-bottom:2px!important;}';
            css += '.kore-v34-field span,.kore-v34-field a{font-size:11.5px!important;line-height:1.25!important;}';
            css += '.kore-v34-alerts{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;}';
            css += '.kore-v34-mini-alert{min-height:38px!important;padding:7px 8px!important;text-align:left!important;}';
            css += '.kore-v34-mini-alert strong{font-size:11px!important;font-weight:700!important;margin-bottom:2px!important;}';

            css += '.kore-v45-kpi-right{text-align:right!important;}';
            css += '.kore-v45-kpi-right .kore-v34-kpi-title,.kore-v45-kpi-right h3,.kore-v45-kpi-right .kore-metric-label{text-align:right!important;}';
            css += '.kore-v45-kpi-right .kore-v34-kpi-value,.kore-v45-kpi-right .kore-modern-kpi-total,.kore-v45-kpi-right .kore-metric-value{text-align:right!important;}';
            css += '.kore-v45-kpi-right .kore-v34-kpi-detail,.kore-v45-kpi-right p,.kore-v45-kpi-right .kore-metric-help{text-align:right!important;}';

            css += '.kore-problem-menu{display:flex!important;gap:8px!important;flex-wrap:wrap!important;padding:8px 10px!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{display:inline-flex!important;align-items:center!important;gap:5px!important;padding:4px 7px!important;background:#fff!important;border:1px solid #cfd8e3!important;border-radius:2px!important;box-shadow:none!important;color:#344054!important;font-size:11px!important;font-weight:500!important;line-height:1.2!important;}';
            css += '.kore-problem-menu button:hover,.kore-filtro-intervencao:hover{background:#f6f8fa!important;border-color:#98a2b3!important;color:#111827!important;}';
            css += '.kore-menu-icon{display:none!important;}';
            css += '.kore-menu-label{display:inline-flex!important;align-items:center!important;font-size:11px!important;font-weight:500!important;white-space:nowrap!important;}';
            css += '.kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:18px!important;height:18px!important;padding:0 5px!important;margin-left:3px!important;border:1px solid #d0d7de!important;background:#f8fafc!important;border-radius:2px!important;font-size:10.5px!important;font-weight:600!important;color:#344054!important;line-height:1!important;}';

            css += '.kore-table-links{display:grid!important;grid-template-columns:repeat(2,26px)!important;gap:4px!important;align-items:center!important;justify-content:end!important;}';
            css += '.kore-table-links a.kore-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:26px!important;height:25px!important;min-width:26px!important;padding:0!important;font-size:12px!important;font-weight:500!important;line-height:1!important;border-radius:2px!important;background:#fff!important;border:1px solid #cfd8e3!important;color:#111827!important;box-shadow:none!important;text-align:center!important;}';
            css += '.kore-table-links a.kore-btn:hover{background:#f6f8fa!important;border-color:#8c9bab!important;color:#000!important;}';
            css += '.kore-table-links .kore-link-edit{font-size:14px!important;}';
            css += '.kore-table-links .kore-link-record{font-size:13px!important;}';
            css += '.kore-table-links .kore-link-marc{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;font-size:11px!important;font-weight:700!important;}';
            css += '.kore-table-links .kore-link-opac{font-size:13px!important;}';

            css += '.kore-table th{font-size:11.5px!important;font-weight:600!important;}';
            css += '.kore-table td{font-size:12px!important;}';


            css += '#kore-identidade .kore-header h2{font-size:15px!important;font-weight:900!important;line-height:1.1!important;letter-spacing:.01em!important;}';
            css += '#kore-identidade .kore-header p{font-size:12px!important;text-align:left!important;margin-top:3px!important;}';
            css += '#kore-identidade .kore-header{align-items:flex-start!important;padding:10px 12px!important;}';
            css += '#kore-identidade .kore-v34-top{grid-template-columns:minmax(420px,.95fr) minmax(520px,1.55fr)!important;gap:14px!important;margin-bottom:12px!important;}';
            css += '#kore-identidade .kore-v34-identity{padding:12px 14px!important;border-radius:4px!important;box-shadow:none!important;}';
            css += '#kore-identidade .kore-v34-identity-main{grid-template-columns:136px 1fr!important;gap:15px!important;}';
            css += '#kore-identidade .kore-v34-photo{width:136px!important;height:176px!important;border-radius:3px!important;}';
            css += '#kore-identidade .kore-v34-name{font-size:19px!important;line-height:1.16!important;margin-bottom:7px!important;}';
            css += '#kore-identidade .kore-v34-line{font-size:13px!important;display:flex!important;flex-wrap:wrap!important;gap:8px!important;align-items:center!important;margin-bottom:8px!important;}';
            css += '#kore-identidade .kore-v34-line span{border:0!important;margin:0!important;padding:0!important;}';
            css += '#kore-identidade .kore-v45-authid strong,#kore-identidade .kore-v45-score strong{font-weight:900!important;color:inherit!important;}';
            css += '#kore-identidade .kore-v45-score{display:inline-flex!important;gap:5px!important;align-items:center!important;border:1px solid #e5e7eb!important;border-radius:2px!important;padding:3px 7px!important;font-size:12px!important;font-weight:800!important;}';
            css += '#kore-identidade .kore-v45-score-good{background:#ecfdf3!important;border-color:#abefc6!important;color:#05603a!important;}';
            css += '#kore-identidade .kore-v45-score-warning{background:#fffaeb!important;border-color:#fedf89!important;color:#b54708!important;}';
            css += '#kore-identidade .kore-v45-score-critical{background:#fef3f2!important;border-color:#fecdca!important;color:#b42318!important;}';
            css += '#kore-identidade .kore-v34-fieldgrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;margin-top:8px!important;}';
            css += '#kore-identidade .kore-v34-alertgrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;margin-top:7px!important;}';
            css += '#kore-identidade .kore-v34-kpis{display:grid!important;grid-template-columns:repeat(5,minmax(104px,1fr))!important;gap:8px!important;}';
            css += '#kore-identidade .kore-v34-kpi{min-height:86px!important;padding:10px!important;border-radius:3px!important;text-align:right!important;}';
            css += '#kore-identidade .kore-v34-kpi-head{justify-content:flex-end!important;text-align:right!important;gap:0!important;}';
            css += '#kore-identidade .kore-v34-kpi-title{font-size:19px!important;font-weight:900!important;line-height:1.1!important;text-align:right!important;}';
            css += '#kore-identidade .kore-v34-kpi-value{font-size:24px!important;font-weight:950!important;text-align:right!important;margin-top:6px!important;}';
            css += '#kore-identidade .kore-v34-kpi-detail{font-size:12px!important;line-height:1.35!important;text-align:right!important;margin-top:5px!important;}';
            css += '#kore-identidade .kore-v34-icon,.kore-menu-icon{display:none!important;}';
            css += '#kore-identidade .kore-problem-menu{gap:8px!important;padding:9px 10px!important;}';
            css += '#kore-identidade .kore-problem-menu button{display:inline-flex!important;align-items:center!important;gap:9px!important;border-radius:2px!important;padding:6px 9px!important;font-size:13px!important;min-height:31px!important;}';
            css += '#kore-identidade .kore-menu-label{font-size:13px!important;font-weight:700!important;white-space:nowrap!important;}';
            css += '#kore-identidade .kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:28px!important;height:20px!important;padding:0 6px!important;margin:0!important;border:1px solid #dbe3ec!important;background:#f8fafc!important;font-size:12px!important;font-weight:900!important;color:#111827!important;}';
            css += '#kore-identidade .kore-table td{font-size:13px!important;line-height:1.35!important;}';
            css += '#kore-identidade .kore-table th{font-size:12px!important;}';
            css += '#kore-identidade .kore-hide-identity-extra{display:none!important;}';


            /* v4.7, menus operacionais: sem ícones, sem barras laterais e com labels estáveis */
            css += '.kore-problem-menu{display:flex!important;gap:9px!important;flex-wrap:wrap!important;padding:10px 12px!important;border-bottom:1px solid #e5e7eb!important;background:#fff!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{display:inline-flex!important;align-items:center!important;gap:8px!important;border:1px solid #cbd5e1!important;border-left:1px solid #cbd5e1!important;border-radius:2px!important;background:#fff!important;padding:7px 10px!important;min-height:32px!important;line-height:1.2!important;}';
            css += '.kore-problem-menu button:before,.kore-filtro-intervencao:before{content:none!important;display:none!important;}';
            css += '.kore-menu-label{font-size:13px!important;font-weight:700!important;color:#111827!important;white-space:nowrap!important;}';
            css += '.kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:28px!important;height:20px!important;margin:0!important;padding:1px 7px!important;border:1px solid #dbe3ec!important;background:#f8fafc!important;color:#111827!important;font-size:12px!important;font-weight:850!important;line-height:1!important;}';
            css += '.kore-filtro-ativo{border-color:#007fae!important;background:#f5fbfd!important;}';
            css += '.kore-table td{font-size:13px!important;}';
            css += '.kore-table th{font-size:12px!important;}';


            /* ==========================================================
               v4.8 UX CONTROLADA
               Regressa à base visual v4.7, sem redesenho radical.
               Objetivo: mais hierarquia, menos ruído, mantendo o motor
               bibliográfico e a estrutura operacional estáveis.
               21. v4.15: corrige coerência dos filtros $9/$4, limpa leitura MARC operacional e evita redundância $4 ausente/$4 —
   ========================================================== */
            css += '#kore-identidade{background:#f7f9fc!important;border-color:#cfd8e3!important;}';
            css += '#kore-identidade .kore-header{background:#fff!important;border-bottom:1px solid #d8e0ea!important;padding:10px 13px!important;}';
            css += '#kore-identidade .kore-header h2{font-size:19px!important;font-weight:700!important;letter-spacing:-.02em!important;}';
            css += '#kore-identidade .kore-header p{font-size:12px!important;color:#334155!important;}';
            css += '#kore-identidade .kore-tab-panel{background:#f7f9fc!important;padding:12px 13px!important;}';

            css += '.kore-dashboard-controlbar,.kore-panel,.kore-analytics-block,.kore-variants-box,.kore-correction-box,.kore-secondary-box{border-color:#d8e0ea!important;border-radius:3px!important;box-shadow:none!important;background:#fff!important;}';
            css += '.kore-dashboard-controlbar{margin-bottom:10px!important;}';

            css += '.kore-v34-top{display:grid!important;grid-template-columns:minmax(560px,1.12fr) minmax(680px,1.55fr)!important;gap:12px!important;align-items:stretch!important;margin:10px 0 12px!important;}';
            css += '.kore-v34-identity{border:1px solid #d8e0ea!important;border-radius:3px!important;background:#fff!important;padding:13px!important;box-shadow:none!important;}';
            css += '.kore-v34-identity-main{grid-template-columns:108px 1fr!important;gap:13px!important;}';
            css += '.kore-v34-photo{width:108px!important;height:144px!important;border-radius:2px!important;border-color:#c8d3df!important;background:#eef2f7!important;}';
            css += '.kore-v34-name{font-size:20px!important;font-weight:750!important;color:#0f172a!important;line-height:1.12!important;margin:0 0 5px!important;}';
            css += '.kore-v34-line{font-size:12px!important;color:#334155!important;margin:5px 0 8px!important;}';
            css += '.kore-v45-authid strong,.kore-v45-score strong{font-weight:750!important;color:#0f172a!important;}';
            css += '.kore-v45-score{border-radius:999px!important;padding:3px 8px!important;border:1px solid #d8e0ea!important;}';
            css += '.kore-v45-score-good{background:#ecfdf3!important;color:#05603a!important;border-color:#abefc6!important;}';
            css += '.kore-v45-score-warning{background:#fffaeb!important;color:#b54708!important;border-color:#fedf89!important;}';
            css += '.kore-v45-score-critical{background:#fef3f2!important;color:#b42318!important;border-color:#fecdca!important;}';
            css += '.kore-v34-fieldgrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;margin-top:9px!important;}';
            css += '.kore-v34-field{min-height:42px!important;border:1px solid #e2e8f0!important;background:#fbfdff!important;border-radius:2px!important;padding:6px 8px!important;font-size:11.5px!important;line-height:1.28!important;}';
            css += '.kore-v34-field strong{font-size:11px!important;font-weight:750!important;color:#0f172a!important;text-transform:uppercase!important;letter-spacing:.02em!important;}';
            css += '.kore-v34-alertgrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;margin-top:8px!important;}';
            css += '.kore-v34-mini-alert{border-radius:2px!important;padding:7px 8px!important;font-size:11.5px!important;}';
            css += '.kore-v34-mini-alert strong{font-size:11px!important;font-weight:750!important;text-transform:uppercase!important;letter-spacing:.02em!important;}';

            css += '.kore-v34-kpis{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:10px!important;height:100%!important;}';
            css += '.kore-v34-kpi{min-height:144px!important;border-radius:3px!important;border:1px solid #d8e0ea!important;background:#fff!important;box-shadow:none!important;padding:13px 12px 13px!important;text-align:right!important;}';
            css += '.kore-v34-kpi:hover{background:#fbfdff!important;border-color:#aab8c6!important;}';
            css += '.kore-v34-kpi-title{font-size:12px!important;font-weight:800!important;text-transform:uppercase!important;letter-spacing:.04em!important;color:#1e293b!important;}';
            css += '.kore-v34-kpi-value{font-size:33px!important;font-weight:850!important;letter-spacing:-.04em!important;color:#0f172a!important;line-height:1!important;margin:8px 0 9px!important;}';
            css += '.kore-v34-kpi-detail{font-size:11.5px!important;font-weight:500!important;line-height:1.35!important;color:#334155!important;text-transform:none!important;margin-bottom:16px!important;}';
            css += '.kore-v34-kpi-detail b{font-size:12.5px!important;font-weight:800!important;color:#0f172a!important;}';
            css += '.kore-v34-kpi:after{height:3px!important;left:12px!important;right:12px!important;bottom:9px!important;border-radius:1px!important;background:#e5ebf2!important;}';
            css += '.kore-v34-kpi:before{height:3px!important;left:12px!important;bottom:9px!important;border-radius:1px!important;width:50%!important;}';

            css += '.kore-problem-menu,.kore-intervencao-filtros{background:#fff!important;border-bottom:1px solid #e2e8f0!important;padding:8px 10px!important;gap:7px!important;}';
            css += '.kore-menu-icon{display:none!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{display:inline-flex!important;align-items:center!important;gap:7px!important;border:1px solid #cfd8e3!important;background:#fff!important;border-radius:2px!important;color:#1e293b!important;font-size:12px!important;font-weight:650!important;min-height:31px!important;padding:5px 9px!important;text-transform:none!important;}';
            css += '.kore-problem-menu button:hover,.kore-filtro-intervencao:hover{background:#f8fafc!important;border-color:#94a3b8!important;color:#0f172a!important;}';
            css += '.kore-filtro-ativo{background:#eef6ff!important;border-color:#7aa5d8!important;color:#123b68!important;}';
            css += '.kore-menu-label{font-size:12px!important;font-weight:650!important;white-space:nowrap!important;}';
            css += '.kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:24px!important;height:20px!important;padding:0 6px!important;margin-left:3px!important;border:1px solid #d8e0ea!important;border-radius:2px!important;background:#f1f5f9!important;color:#0f172a!important;font-size:11.5px!important;font-weight:800!important;}';
            css += '.kore-filtro-ativo .kore-problem-count{background:#dcecff!important;border-color:#b9d6f5!important;color:#123b68!important;}';

            css += '.kore-table-wrap{border:1px solid #d8e0ea!important;border-radius:3px!important;background:#fff!important;box-shadow:none!important;}';
            css += '.kore-table-intro{background:#fff!important;border-bottom:1px solid #e2e8f0!important;padding:9px 11px!important;}';
            css += '.kore-table-intro strong{font-size:13px!important;font-weight:800!important;color:#0f172a!important;}';
            css += '.kore-table-intro span{font-size:11.5px!important;color:#475569!important;}';
            css += '.kore-table-scroll{max-height:560px!important;overflow:auto!important;background:#fff!important;}';
            css += '.kore-table{font-size:12px!important;}';
            css += '.kore-table th{position:sticky!important;top:0!important;z-index:2!important;background:#f8fafc!important;color:#334155!important;border-bottom:1px solid #cfd8e3!important;font-size:11px!important;font-weight:800!important;text-transform:none!important;letter-spacing:0!important;padding:8px 7px!important;}';
            css += '.kore-table td{font-size:12px!important;padding:8px 7px!important;border-bottom:1px solid #edf2f7!important;color:#334155!important;}';
            css += '.kore-table tr:hover td{background:#fbfdff!important;}';
            css += '.kore-table td.kore-title-cell{font-weight:750!important;color:#0f172a!important;min-width:230px!important;}';
            css += '.kore-marc-chip,.kore-occurrence-chip{display:inline-block!important;border:1px solid #e2e8f0!important;background:#f8fafc!important;border-radius:2px!important;padding:2px 5px!important;color:#0f172a!important;}';
            css += '.kore-action-detail{font-size:11px!important;line-height:1.35!important;color:#64748b!important;margin-top:4px!important;max-width:360px!important;}';
            css += '.kore-priority-pill{border-radius:2px!important;font-size:10.5px!important;font-weight:750!important;padding:2px 6px!important;}';
            css += '.kore-table-links{display:flex!important;gap:5px!important;align-items:center!important;flex-wrap:nowrap!important;}';
            css += '.kore-table-links a.kore-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:25px!important;height:24px!important;padding:0 6px!important;border-radius:2px!important;border-color:#cfd8e3!important;background:#fff!important;color:#111827!important;font-size:11px!important;font-weight:700!important;}';
            css += '.kore-table-links a.kore-btn:hover{background:#f8fafc!important;border-color:#94a3b8!important;}';
            css += '.kore-vazio{font-size:12px!important;color:#475569!important;background:#fbfdff!important;font-style:normal!important;}';

            css += '@media(max-width:1350px){.kore-v34-top{grid-template-columns:1fr!important;}.kore-v34-kpis{grid-template-columns:repeat(5,minmax(0,1fr))!important;}}';
            css += '@media(max-width:950px){.kore-v34-kpis{grid-template-columns:repeat(2,minmax(0,1fr))!important;}.kore-v34-fieldgrid,.kore-v34-alertgrid{grid-template-columns:1fr!important;}}';
            css += '@media(max-width:650px){.kore-v34-identity-main{grid-template-columns:1fr!important;}.kore-v34-photo{width:100%!important;height:180px!important;}.kore-v34-kpis{grid-template-columns:1fr!important;}}';



            /* ==============================================================================================================
               K●RE v4.9, menu operacional integrado sobre base visual estável
               Mantém o desenho da v4.8 e incorpora o avanço do menu em tabs agrupadas.
               ============================================================================================================== */
            css += '.kore-operational-head{display:flex!important;justify-content:space-between!important;gap:12px!important;align-items:flex-start!important;padding:10px 12px 8px!important;border-bottom:1px solid #e5e7eb!important;background:#fff!important;}';
            css += '.kore-operational-head h3{margin:0!important;font-size:14px!important;font-weight:850!important;color:#0f172a!important;}';
            css += '.kore-operational-head p{margin:3px 0 0!important;font-size:11.5px!important;line-height:1.35!important;color:#64748b!important;}';
            css += '.kore-operational-badge{display:inline-flex!important;align-items:center!important;white-space:nowrap!important;border:1px solid #d8e0ea!important;background:#f8fafc!important;border-radius:2px!important;padding:4px 8px!important;font-size:11.5px!important;font-weight:750!important;color:#334155!important;}';
            css += '.kore-problem-menu{display:flex!important;align-items:center!important;flex-wrap:wrap!important;gap:6px!important;padding:9px 12px!important;border-bottom:1px solid #e5e7eb!important;background:#fff!important;}';
            css += '.kore-menu-group{display:inline-flex!important;align-items:center!important;height:28px!important;margin:0 2px 0 4px!important;padding:0 2px!important;font-size:10px!important;font-weight:850!important;letter-spacing:.055em!important;text-transform:uppercase!important;color:#64748b!important;}';
            css += '.kore-menu-group:first-child{margin-left:0!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{position:relative!important;display:inline-flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;min-height:30px!important;padding:5px 8px!important;border:1px solid #cfd8e3!important;border-radius:2px!important;background:#fff!important;color:#1e293b!important;box-shadow:none!important;text-transform:none!important;line-height:1.15!important;}';
            css += '.kore-problem-menu button:hover,.kore-filtro-intervencao:hover{background:#f8fafc!important;border-color:#94a3b8!important;color:#0f172a!important;}';
            css += '.kore-problem-menu button:after,.kore-filtro-intervencao:after{content:""!important;position:absolute!important;left:0!important;right:0!important;bottom:-1px!important;height:2px!important;background:transparent!important;}';
            css += '.kore-menu-critical:after{background:#d92d20!important;}';
            css += '.kore-menu-review:after{background:#f79009!important;}';
            css += '.kore-menu-context:after{background:#007fae!important;}';
            css += '.kore-menu-ok:after{background:#12b76a!important;}';
            css += '.kore-menu-neutral:after{background:#98a2b3!important;}';
            css += '.kore-filtro-ativo{background:#eef6ff!important;border-color:#7aa5d8!important;color:#123b68!important;}';
            css += '.kore-filtro-ativo:before{content:""!important;position:absolute!important;left:-1px!important;top:-1px!important;bottom:-1px!important;width:3px!important;background:#007fae!important;border-radius:2px 0 0 2px!important;}';
            css += '.kore-menu-label{display:inline-flex!important;align-items:center!important;white-space:nowrap!important;font-size:12px!important;font-weight:700!important;color:inherit!important;}';
            css += '.kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:25px!important;height:20px!important;margin:0!important;padding:0 6px!important;border:1px solid #d8e0ea!important;border-radius:2px!important;background:#f1f5f9!important;color:#0f172a!important;font-size:11.5px!important;font-weight:850!important;line-height:1!important;}';
            css += '.kore-filtro-ativo .kore-problem-count{background:#dcecff!important;border-color:#b9d6f5!important;color:#123b68!important;}';
            css += '.kore-menu-critical .kore-problem-count{background:#fff1f0!important;border-color:#fecdca!important;color:#b42318!important;}';
            css += '.kore-menu-review .kore-problem-count{background:#fff7e6!important;border-color:#fedf89!important;color:#b54708!important;}';
            css += '.kore-menu-ok .kore-problem-count{background:#ecfdf3!important;border-color:#abefc6!important;color:#05603a!important;}';
            css += '.kore-menu-context .kore-problem-count{background:#eaf7fb!important;border-color:#b9e5ef!important;color:#075985!important;}';
            css += '.kore-v34-alert{border:1px solid #d8e0ea!important;border-top:0!important;background:#fbfdff!important;padding:8px 11px!important;font-size:12px!important;color:#334155!important;}';
            css += '@media(max-width:900px){.kore-operational-head{display:block!important}.kore-operational-badge{margin-top:6px!important}.kore-menu-group{width:100%!important;height:auto!important;margin:7px 0 0!important}.kore-problem-menu button,.kore-filtro-intervencao{flex:1 1 auto!important;}}';

            css += '.kore-menu-group{display:none!important;}';
            css += '.kore-problem-menu{display:flex!important;flex-wrap:wrap!important;gap:8px!important;padding:10px 12px!important;border-top:1px solid #eef2f6!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{display:inline-flex!important;align-items:center!important;justify-content:space-between!important;gap:9px!important;padding:6px 10px!important;min-height:32px!important;border-radius:3px!important;font-size:12px!important;font-weight:650!important;line-height:1.2!important;}';
            css += '.kore-menu-ok{background:#ecfdf3!important;border-color:#abefc6!important;color:#05603a!important;}';
            css += '.kore-menu-ok .kore-problem-count,.kore-menu-ok .kore-menu-label{color:#05603a!important;}';
            css += '.kore-menu-critical,.kore-menu-review{background:#fef2f2!important;border-color:#fecaca!important;color:#b91c1c!important;}';
            css += '.kore-menu-critical .kore-problem-count,.kore-menu-critical .kore-menu-label,.kore-menu-review .kore-problem-count,.kore-menu-review .kore-menu-label{color:#b91c1c!important;}';
            css += '.kore-menu-context{background:#f5f3ff!important;border-color:#ddd6fe!important;color:#6d28d9!important;}';
            css += '.kore-menu-context .kore-problem-count,.kore-menu-context .kore-menu-label{color:#6d28d9!important;}';
            css += '.kore-menu-neutral{background:#fff!important;border-color:#cfd8e3!important;color:#334155!important;}';
            css += '.kore-menu-neutral .kore-problem-count,.kore-menu-neutral .kore-menu-label{color:#334155!important;}';
            css += '.kore-filtro-ativo{box-shadow:inset 0 0 0 2px rgba(15,23,42,.18)!important;border-color:#0f172a!important;}';
            css += '.kore-operational-head p{margin-top:2px!important;}';
            css += '.kore-table th,.kore-table td{font-weight:400!important;}';
            css += '.kore-table td.kore-title-cell,.kore-table td.kore-title-cell a{font-weight:700!important;color:#111827!important;}';
            css += '.kore-action-cell strong{font-weight:700!important;color:#111827!important;}';
            css += '.kore-natureza,.kore-small-cell,.kore-table td .kore-occurrence-chip,.kore-table td .kore-marc-chip{font-weight:400!important;}';
            css += '.kore-table td .kore-priority-pill,.kore-table td .kore-badge{font-weight:800!important;}';
            css += '.kore-table-links{display:flex!important;gap:4px!important;flex-wrap:wrap!important;}';
            css += '.kore-table-links a{min-width:28px!important;text-align:center!important;color:#111827!important;border-color:#d0d7de!important;background:#fff!important;padding:4px 6px!important;font-size:12px!important;line-height:1!important;}';
            css += '.kore-table-links a:hover{background:#f8fafc!important;color:#111827!important;border-color:#94a3b8!important;}';
            css += '.kore-link-icon{font-size:13px!important;color:#111827!important;}';
            css += '.kore-link-aicon{display:inline-block!important;font-size:12px!important;font-weight:800!important;line-height:1!important;color:#111827!important;}';
            css += '.kore-occ-main{display:block;font-weight:400!important;color:#1f2937!important;line-height:1.35!important;}';
            css += '.kore-occ-sub{display:block;font-size:11px!important;color:#667085!important;line-height:1.35!important;margin-top:3px!important;}';
            css += '.kore-action-detail{margin-top:4px!important;font-size:11px!important;line-height:1.4!important;color:#475467!important;}';
            css += '.kore-v34-problems{background:#fff!important;border:1px solid #d7dee8!important;border-radius:3px!important;}';
            css += '.kore-v34-alert{background:#f8fafc!important;border-top:1px solid #e5e7eb!important;border-bottom:1px solid #e5e7eb!important;color:#475467!important;}';
            css += '.kore-table th{background:#f8fafc!important;color:#344054!important;font-size:11px!important;font-weight:650!important;text-transform:none!important;letter-spacing:0!important;border-bottom:1px solid #d7dee8!important;}';
            css += '.kore-table td{border-bottom:1px solid #edf2f7!important;line-height:1.42!important;}';
            css += '.kore-table tr:hover td{background:#fbfdff!important;}';
            css += '.kore-marc-chip{border:1px solid #d7dee8!important;background:#f8fafc!important;border-radius:2px!important;padding:3px 6px!important;font-weight:500!important;color:#344054!important;}';
            css += '.kore-occ-main strong,.kore-occ-sub strong{font-weight:700!important;color:#111827!important;}';
            css += '.kore-occ-main{font-size:12px!important;color:#111827!important;}';
            css += '.kore-occ-sub{font-size:11px!important;color:#5b667a!important;margin-top:3px!important;}';
            css += '.kore-action-cell{min-width:170px!important;}';
            css += '.kore-action-cell strong{font-size:12px!important;}';
            css += '.kore-action-detail{max-width:260px!important;}';
            css += '.kore-problem-menu{background:#fff!important;padding:10px 11px!important;gap:8px!important;}';
            css += '.kore-filtro-intervencao{box-shadow:none!important;}';
            css += '.kore-problem-count{background:rgba(255,255,255,.65)!important;border:1px solid rgba(15,23,42,.10)!important;border-radius:2px!important;padding:1px 6px!important;min-width:24px!important;text-align:center!important;}';
            css += '.kore-v34-kpi{background:#fff!important;border-color:#d7dee8!important;}';
            css += '.kore-v34-kpi-value{letter-spacing:-.03em!important;}';
            css += '.kore-v413-soft #kore-identidade{}';
            css += '#kore-identidade{border-color:#d9e1ea!important;background:#fff!important;}';
            css += '.kore-header{background:#fff!important;border-bottom:1px solid #e6ebf1!important;padding:12px 15px!important;}';
            css += '.kore-header h2{font-size:16px!important;letter-spacing:.01em!important;}';
            css += '.kore-header p{font-size:12px!important;color:#667085!important;}';
            css += '.kore-score-card,.kore-metric-card,.kore-v34-kpi,.kore-modern-kpi,.kore-workbench-card,.kore-authority-card,.kore-panel,.kore-v34-problems{border-color:#dbe3ec!important;box-shadow:0 1px 2px rgba(15,23,42,.035)!important;border-radius:4px!important;}';
            css += '.kore-authority-detail,.kore-summary-tile,.kore-modern-stat{border-color:#eef2f6!important;background:#f8fafc!important;border-radius:3px!important;}';
            css += '.kore-problem-menu{background:#fff!important;border-top:1px solid #eef2f6!important;border-bottom:1px solid #eef2f6!important;padding:10px 12px!important;gap:7px!important;}';
            css += '.kore-menu-group{display:none!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{border-radius:4px!important;border-width:1px!important;box-shadow:none!important;min-height:31px!important;padding:6px 10px!important;font-size:12px!important;font-weight:650!important;}';
            css += '.kore-menu-ok{background:#ecfdf3!important;border-color:#abefc6!important;color:#05603a!important;}';
            css += '.kore-menu-critical,.kore-menu-review{background:#fef3f2!important;border-color:#fecdca!important;color:#b42318!important;}';
            css += '.kore-menu-context{background:#f5f3ff!important;border-color:#ddd6fe!important;color:#6d28d9!important;}';
            css += '.kore-menu-neutral{background:#f8fafc!important;border-color:#d7dee8!important;color:#344054!important;}';
            css += '.kore-problem-count{border:0!important;background:rgba(255,255,255,.72)!important;border-radius:999px!important;min-width:24px!important;height:20px!important;font-weight:850!important;}';
            css += '.kore-filtro-ativo{box-shadow:inset 0 0 0 2px rgba(15,23,42,.16)!important;border-color:#0f172a!important;}';
            css += '.kore-table-wrap{border-top:0!important;}';
            css += '.kore-table{font-size:12px!important;border-collapse:separate!important;border-spacing:0!important;}';
            css += '.kore-table th{background:#f8fafc!important;color:#475467!important;font-size:11px!important;font-weight:650!important;text-transform:none!important;letter-spacing:0!important;border-bottom:1px solid #dbe3ec!important;padding:8px 8px!important;}';
            css += '.kore-table td{border-bottom:1px solid #eef2f6!important;padding:8px 8px!important;line-height:1.45!important;font-weight:400!important;color:#344054!important;}';
            css += '.kore-table tr:hover td{background:#fbfdff!important;}';
            css += '.kore-table td.kore-title-cell,.kore-table td.kore-title-cell a{font-weight:700!important;color:#111827!important;}';
            css += '.kore-action-cell{min-width:190px!important;}';
            css += '.kore-action-cell strong{display:block!important;font-size:12.5px!important;font-weight:750!important;color:#111827!important;margin-bottom:2px!important;}';
            css += '.kore-action-detail{font-size:11.5px!important;line-height:1.42!important;color:#475467!important;max-width:310px!important;}';
            css += '.kore-occ-main{display:block!important;font-size:12px!important;font-weight:400!important;color:#111827!important;line-height:1.38!important;}';
            css += '.kore-occ-sub{display:block!important;font-size:11.5px!important;font-weight:400!important;color:#5f6b7a!important;line-height:1.38!important;margin-top:3px!important;}';
            css += '.kore-occ-main strong,.kore-occ-sub strong{font-size:10.5px!important;font-weight:750!important;color:#667085!important;text-transform:uppercase!important;letter-spacing:.02em!important;margin-right:4px!important;}';
            css += '.kore-marc-chip{border:0!important;background:#eef2f6!important;border-radius:999px!important;padding:3px 7px!important;font-size:11.5px!important;font-weight:650!important;color:#344054!important;}';
            css += '.kore-priority-pill,.kore-badge{border:0!important;border-radius:999px!important;padding:3px 8px!important;font-size:10.5px!important;font-weight:800!important;}';
            css += '.kore-table-links{display:flex!important;gap:5px!important;flex-wrap:nowrap!important;}';
            css += '.kore-table-links a{min-width:29px!important;height:26px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:3px!important;border:1px solid #d7dee8!important;background:#fff!important;color:#111827!important;padding:0!important;}';
            css += '.kore-table-links a:hover{background:#f8fafc!important;border-color:#98a2b3!important;color:#111827!important;}';
            css += '.kore-link-icon{font-size:13px!important;color:#111827!important;}';
            css += '.kore-link-aicon{font-size:12px!important;font-weight:850!important;color:#111827!important;}';
            css += '.kore-v34-alert{background:#fbfdff!important;border-color:#e6ebf1!important;color:#475467!important;font-size:12px!important;}';
            css += '/* K●RE v4.14, refinamento visual final, sem alteração do motor bibliográfico */';
            css += '#kore-identidade{background:#fbfcfe!important;border-color:#dbe3ec!important;}';
            css += '#kore-identidade .kore-header{background:#ffffff!important;border-bottom-color:#edf1f5!important;}';
            css += '#kore-identidade h2{letter-spacing:0!important;}';
            css += '#kore-identidade p{color:#53657d!important;}';
            css += '#kore-identidade button,#kore-identidade a.kore-btn{border-color:#d8e1eb!important;background:#fff!important;color:#1f2937!important;}';
            css += '#kore-identidade button:hover,#kore-identidade a.kore-btn:hover{background:#f8fafc!important;border-color:#b9c6d4!important;}';

            css += '.kore-v34-card,.kore-v34-problems,.kore-v34-topbar,.kore-v34-authority-card,.kore-v34-kpi{border-color:#dfe7f0!important;background:#fff!important;box-shadow:none!important;border-radius:4px!important;}';
            css += '.kore-v34-field,.kore-authority-detail{background:#fafcff!important;border-color:#e7edf3!important;border-radius:4px!important;}';
            css += '.kore-v34-field strong,.kore-authority-detail strong{font-weight:650!important;color:#26364a!important;text-transform:none!important;letter-spacing:0!important;}';
            css += '.kore-v34-ok,.kore-alert-ok{background:#f0fdf4!important;border-color:#bbf7d0!important;color:#166534!important;}';

            css += '#kore-identidade .kore-v34-kpi-title{font-size:18px!important;font-weight:750!important;letter-spacing:0!important;text-transform:none!important;color:#182235!important;text-align:right!important;}';
            css += '#kore-identidade .kore-v34-kpi-value{font-size:25px!important;font-weight:850!important;line-height:1.05!important;color:#050b18!important;text-align:right!important;}';
            css += '#kore-identidade .kore-v34-kpi-sub{font-size:12px!important;line-height:1.28!important;color:#2e3d52!important;text-align:right!important;font-weight:400!important;}';
            css += '.kore-v34-kpi-red .kore-v34-kpi-title,.kore-v34-kpi-orange .kore-v34-kpi-title,.kore-v34-kpi-green .kore-v34-kpi-title,.kore-v34-kpi-blue .kore-v34-kpi-title,.kore-v34-kpi-purple .kore-v34-kpi-title{color:#182235!important;}';
            css += '.kore-v34-kpi-bar{height:3px!important;border-radius:999px!important;opacity:.9!important;}';

            css += '.kore-operational-head{padding:12px 13px 9px!important;border-bottom:1px solid #edf1f5!important;}';
            css += '.kore-operational-head h3{font-size:14px!important;font-weight:750!important;color:#111827!important;}';
            css += '.kore-operational-head p{font-size:11.5px!important;color:#64748b!important;}';
            css += '.kore-operational-badge{border-color:#dbe3ec!important;background:#f8fafc!important;color:#1e293b!important;font-weight:650!important;border-radius:4px!important;}';
            css += '.kore-problem-menu{background:#fbfcfe!important;border-top:0!important;border-bottom:1px solid #edf1f5!important;padding:10px 12px!important;gap:7px!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{border-radius:4px!important;box-shadow:none!important;font-weight:600!important;font-size:12px!important;padding:6px 9px!important;min-height:31px!important;}';
            css += '.kore-menu-ok{background:#f0fdf4!important;border-color:#bbf7d0!important;color:#166534!important;}';
            css += '.kore-menu-critical,.kore-menu-review{background:#fff5f5!important;border-color:#fecaca!important;color:#991b1b!important;}';
            css += '.kore-menu-context{background:#f7f2ff!important;border-color:#ddd6fe!important;color:#5b21b6!important;}';
            css += '.kore-menu-neutral{background:#fff!important;border-color:#dbe3ec!important;color:#334155!important;}';
            css += '.kore-menu-label{font-weight:600!important;}';
            css += '.kore-problem-count{background:#fff!important;border:1px solid rgba(148,163,184,.35)!important;border-radius:999px!important;min-width:24px!important;text-align:center!important;padding:1px 6px!important;font-weight:750!important;color:inherit!important;}';
            css += '.kore-filtro-ativo{background:#ffffff!important;border-color:#64748b!important;box-shadow:inset 0 -2px 0 rgba(15,23,42,.32)!important;}';

            css += '.kore-table-wrap{overflow-x:hidden!important;width:100%!important;}';
            css += '.kore-table-scroll{overflow-x:hidden!important;max-height:520px!important;}';
            css += '.kore-table{table-layout:fixed!important;width:100%!important;font-size:12px!important;border-collapse:separate!important;border-spacing:0!important;}';
            css += '.kore-table th{position:sticky!important;top:0!important;z-index:3!important;background:#f8fafc!important;color:#334155!important;border-bottom:1px solid #dbe3ec!important;text-transform:none!important;letter-spacing:0!important;font-size:11.5px!important;font-weight:650!important;padding:8px 8px!important;}';
            css += '.kore-table td{border-bottom:1px solid #eef2f6!important;padding:9px 8px!important;vertical-align:top!important;color:#26364a!important;font-size:12px!important;line-height:1.35!important;}';
            css += '.kore-table tr:hover td{background:#fbfdff!important;}';
            css += '.kore-table th:nth-child(1),.kore-table td:nth-child(1){width:7%!important;}';
            css += '.kore-table th:nth-child(2),.kore-table td:nth-child(2){width:15%!important;}';
            css += '.kore-table th:nth-child(3),.kore-table td:nth-child(3){width:6%!important;}';
            css += '.kore-table th:nth-child(4),.kore-table td:nth-child(4){width:10%!important;}';
            css += '.kore-table th:nth-child(5),.kore-table td:nth-child(5){width:24%!important;}';
            css += '.kore-table th:nth-child(6),.kore-table td:nth-child(6){width:7%!important;}';
            css += '.kore-table th:nth-child(7),.kore-table td:nth-child(7){width:14%!important;}';
            css += '.kore-table th:nth-child(8),.kore-table td:nth-child(8){width:13%!important;}';
            css += '.kore-table th:nth-child(9),.kore-table td:nth-child(9){width:4%!important;}';
            css += '.kore-title-cell,.kore-title-cell a{font-weight:700!important;color:#0f172a!important;}';
            css += '.kore-marc-chip{background:#f1f5f9!important;border:1px solid #dbe3ec!important;border-radius:999px!important;padding:2px 7px!important;font-weight:500!important;color:#334155!important;}';
            css += '.kore-occ-main{font-size:12px!important;line-height:1.35!important;color:#1f2937!important;font-weight:400!important;}';
            css += '.kore-occ-sub{font-size:11px!important;color:#64748b!important;line-height:1.35!important;margin-top:4px!important;}';
            css += '.kore-diagnostico{font-size:11.5px!important;line-height:1.35!important;color:#334155!important;}';
            css += '.kore-diagnostico-main{display:block!important;color:#1f2937!important;}';
            css += '.kore-diagnostico-sub{display:block!important;color:#64748b!important;margin-top:3px!important;}';
            css += '.kore-action-cell strong{font-size:12.5px!important;font-weight:750!important;color:#0f172a!important;}';
            css += '.kore-action-detail{font-size:11.5px!important;line-height:1.35!important;color:#52637a!important;margin-top:4px!important;}';
            css += '.kore-priority-pill,.kore-badge{font-size:10.5px!important;font-weight:650!important;border-radius:999px!important;padding:2px 7px!important;border:0!important;}';
            css += '.kore-table-links{display:flex!important;flex-direction:column!important;gap:5px!important;align-items:center!important;justify-content:flex-start!important;min-width:34px!important;}';
            css += '.kore-table-links a.kore-btn,.kore-table-links a{width:28px!important;height:27px!important;min-width:28px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;border-radius:4px!important;border:1px solid #dbe3ec!important;background:#fff!important;color:#111827!important;font-size:13px!important;line-height:1!important;}';
            css += '.kore-table-links a:hover{background:#f8fafc!important;border-color:#94a3b8!important;color:#000!important;}';
            css += '.kore-link-aicon{font-size:11.5px!important;font-weight:800!important;color:#111827!important;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;}';
            css += '.kore-v34-alert{background:#fbfcfe!important;border-color:#edf1f5!important;color:#52637a!important;}';
            css += '.kore-table{table-layout:fixed!important;width:100%!important;}';
            css += '.kore-table th:nth-child(1),.kore-table td:nth-child(1){width:78px!important;}';
            css += '.kore-table th:nth-child(2),.kore-table td:nth-child(2){width:210px!important;}';
            css += '.kore-table th:nth-child(3),.kore-table td:nth-child(3){width:78px!important;}';
            css += '.kore-table th:nth-child(4),.kore-table td:nth-child(4){width:118px!important;}';
            css += '.kore-table th:nth-child(5),.kore-table td:nth-child(5){width:auto!important;}';
            css += '.kore-table th:nth-child(6),.kore-table td:nth-child(6){width:92px!important;}';
            css += '.kore-table th:nth-child(7),.kore-table td:nth-child(7){width:170px!important;}';
            css += '.kore-table th:nth-child(8),.kore-table td:nth-child(8){width:210px!important;}';
            css += '.kore-table th:nth-child(9),.kore-table td:nth-child(9){width:112px!important;}';
            css += '.kore-table-links{display:grid!important;grid-template-columns:repeat(2,28px)!important;gap:4px!important;min-width:60px!important;}';
            css += '.kore-header-minimal{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:6px!important;padding:10px 12px!important;background:#fff!important;border-bottom:1px solid #edf1f5!important;}';
            css += '.kore-header-minimal h2{display:none!important;}';
            css += '.kore-header-minimal .kore-header-actions{order:1!important;display:flex!important;gap:8px!important;justify-content:flex-start!important;align-items:center!important;}';
            css += '.kore-header-minimal .kore-header-desc{order:2!important;margin:0!important;font-size:12px!important;color:#667085!important;}';
            css += '.kore-header-actions .kore-tab,.kore-load-bib-btn,#kore-identidade a.kore-btn,#kore-identidade button.kore-btn{min-height:30px!important;height:30px!important;padding:6px 12px!important;border-radius:2px!important;font-size:12px!important;font-weight:550!important;line-height:1!important;}';
            css += '.kore-dashboard-controlbar-minimal{justify-content:flex-start!important;padding:10px 12px!important;background:#fff!important;border:1px solid #e6ebf1!important;}';
            css += '.kore-dashboard-controlbar-minimal .kore-load-bib-btn{margin-left:0!important;}';
            css += '.kore-source-logo{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:18px!important;height:18px!important;border-radius:3px!important;font-size:11px!important;font-weight:850!important;margin-right:6px!important;vertical-align:middle!important;}';
            css += '.kore-source-wd{background:#f8fafc!important;color:#111827!important;border:1px solid #cbd5e1!important;}';
            css += '.kore-source-viaf{background:#eef6ff!important;color:#0f4c81!important;border:1px solid #bfdbfe!important;}';
            css += '.kore-identificadores-footer{margin-top:10px!important;display:flex!important;justify-content:flex-start!important;}';
            css += '.kore-v34-kpi-title,.kore-modern-kpi h3,.kore-metric-label{text-transform:none!important;letter-spacing:0!important;}';
            css += '.kore-v34-kpi-title{font-size:17px!important;font-weight:700!important;}';
            css += '.kore-v34-kpi-value{font-size:28px!important;font-weight:850!important;}';
            css += '.kore-problem-menu{display:flex!important;flex-wrap:wrap!important;gap:8px!important;padding:10px 12px!important;background:#fbfcfe!important;border-top:1px solid #edf1f5!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{height:30px!important;min-height:30px!important;padding:5px 10px!important;border-radius:3px!important;border:1px solid #e1e7ef!important;background:#fff!important;box-shadow:none!important;font-size:12px!important;font-weight:600!important;line-height:1!important;}';
            css += '.kore-filtro-intervencao .kore-menu-label{font-weight:650!important;}';
            css += '.kore-filtro-intervencao .kore-problem-count{margin-left:6px!important;padding:1px 7px!important;border-radius:999px!important;background:rgba(255,255,255,.72)!important;border:1px solid rgba(15,23,42,.08)!important;font-weight:750!important;}';
            css += '.kore-menu-critical{background:#fff7f7!important;border-color:#f4c7c7!important;color:#b42318!important;}';
            css += '.kore-menu-review{background:#fff8ed!important;border-color:#fed7aa!important;color:#b45309!important;}';
            css += '.kore-menu-context{background:#f6f2ff!important;border-color:#ddd6fe!important;color:#6d28d9!important;}';
            css += '.kore-menu-ok{background:#f0fbf4!important;border-color:#bbf7d0!important;color:#047857!important;}';
            css += '.kore-menu-neutral{background:#f8fafc!important;border-color:#dbe3ec!important;color:#334155!important;}';
            css += '.kore-filtro-ativo{background:#fff!important;border-color:currentColor!important;box-shadow:inset 0 -2px 0 currentColor!important;}';
            css += '.kore-table{table-layout:fixed!important;width:100%!important;}';
            css += '.kore-table th,.kore-table td{word-break:normal!important;overflow-wrap:break-word!important;hyphens:none!important;}';
            css += '.kore-table th:nth-child(1),.kore-table td:nth-child(1){width:76px!important;}';
            css += '.kore-table th:nth-child(2),.kore-table td:nth-child(2){width:170px!important;}';
            css += '.kore-table th:nth-child(3),.kore-table td:nth-child(3){width:66px!important;}';
            css += '.kore-table th:nth-child(4),.kore-table td:nth-child(4){width:112px!important;}';
            css += '.kore-table th:nth-child(5),.kore-table td:nth-child(5){width:auto!important;}';
            css += '.kore-table th:nth-child(6),.kore-table td:nth-child(6){width:86px!important;}';
            css += '.kore-table th:nth-child(7),.kore-table td:nth-child(7){width:150px!important;}';
            css += '.kore-table th:nth-child(8),.kore-table td:nth-child(8){width:190px!important;}';
            css += '.kore-table th:nth-child(9),.kore-table td:nth-child(9){width:92px!important;}';
            css += '.kore-table-wrap{overflow-x:hidden!important;}';
            css += '.kore-table-scroll{overflow-x:hidden!important;}';
            css += '.kore-occ-block{display:block!important;margin-bottom:6px!important;}';
            css += '.kore-occ-label{display:block!important;font-size:10px!important;font-weight:800!important;text-transform:none!important;color:#64748b!important;letter-spacing:.01em!important;margin-bottom:2px!important;}';
            css += '.kore-occ-value{display:block!important;font-size:12px!important;line-height:1.35!important;color:#111827!important;}';
            css += '.kore-occ-meta{display:block!important;font-size:11px!important;line-height:1.35!important;color:#475467!important;margin-top:2px!important;}';
            css += '.kore-occ-line{display:block!important;}';
            css += '.kore-table-links{display:grid!important;grid-template-columns:repeat(2,28px)!important;gap:4px!important;min-width:60px!important;}';
            css += '.kore-table-links a{width:28px!important;height:26px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;}';
            /* v4.21, camada visual final, JS-only */
            css += '#kore-identidade{border-color:#e5ebf2!important;background:#fff!important;}';
            css += '#kore-identidade .kore-header-minimal{align-items:flex-start!important;padding:10px 12px 9px!important;gap:7px!important;background:#fff!important;}';
            css += '#kore-identidade .kore-header-minimal .kore-header-actions{display:flex!important;justify-content:flex-start!important;align-items:center!important;gap:8px!important;width:auto!important;}';
            css += '#kore-identidade .kore-header-minimal .kore-header-desc{text-align:left!important;margin:0!important;padding:0!important;color:#667085!important;font-size:12px!important;line-height:1.35!important;}';
            css += '#kore-identidade .kore-tab,#kore-identidade .kore-load-bib-btn,#kore-identidade .kore-btn{height:31px!important;min-height:31px!important;display:inline-flex!important;align-items:center!important;gap:6px!important;padding:6px 12px!important;border-radius:3px!important;border:1px solid #d8e0ea!important;background:#fff!important;color:#243447!important;font-size:12px!important;font-weight:600!important;line-height:1!important;box-shadow:none!important;transition:background .15s ease,border-color .15s ease,color .15s ease!important;}';
            css += '#kore-identidade .kore-tab:hover,#kore-identidade .kore-load-bib-btn:hover,#kore-identidade .kore-btn:hover{background:#f8fafc!important;border-color:#aeb8c6!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-tab-ativa{background:#f1f6fb!important;border-color:#9fb4ca!important;color:#102a43!important;}';
            css += '#kore-identidade .kore-dashboard-controlbar-minimal{justify-content:flex-start!important;align-items:center!important;padding:8px 10px!important;margin-bottom:9px!important;background:#fff!important;border:1px solid #e6ebf1!important;border-radius:4px!important;}';
            css += '#kore-identidade .kore-dashboard-statusline{display:none!important;}';
            css += '#kore-identidade .kore-v34-identity,#kore-identidade .kore-v34-kpi,#kore-identidade .kore-v34-problems,#kore-identidade .kore-table-wrap{border-color:#e3eaf2!important;border-radius:5px!important;box-shadow:none!important;}';
            css += '#kore-identidade .kore-v34-identity{background:#fff!important;padding:12px!important;}';
            css += '#kore-identidade .kore-v34-field,#kore-identidade .kore-authority-detail{background:#fbfcfe!important;border-color:#edf1f5!important;border-radius:4px!important;padding:8px 9px!important;line-height:1.4!important;}';
            css += '#kore-identidade .kore-v34-kpis{gap:9px!important;}';
            css += '#kore-identidade .kore-v34-kpi{min-height:104px!important;padding:12px 13px!important;background:#fff!important;position:relative!important;overflow:hidden!important;}';
            css += '#kore-identidade .kore-v34-kpi-title{text-transform:none!important;letter-spacing:0!important;font-size:15px!important;font-weight:700!important;color:#1f2937!important;margin-bottom:5px!important;}';
            css += '#kore-identidade .kore-v34-kpi-value{font-size:28px!important;font-weight:850!important;line-height:1!important;color:#0f172a!important;margin:3px 0 7px!important;}';
            css += '#kore-identidade .kore-v34-kpi-detail{font-size:11.5px!important;color:#667085!important;line-height:1.35!important;}';
            css += '#kore-identidade .kore-v34-kpi-red{border-bottom:3px solid #d92d20!important;}';
            css += '#kore-identidade .kore-v34-kpi-orange{border-bottom:3px solid #d97706!important;}';
            css += '#kore-identidade .kore-v34-kpi-green{border-bottom:3px solid #039855!important;}';
            css += '#kore-identidade .kore-v34-kpi-blue{border-bottom:3px solid #6d28d9!important;}';
            css += '#kore-identidade .kore-v34-kpi-purple{border-bottom:3px solid #7c3aed!important;}';
            css += '#kore-identidade .kore-operational-head{padding:10px 12px!important;background:#fff!important;border-bottom:1px solid #edf1f5!important;}';
            css += '#kore-identidade .kore-operational-head h3{font-size:15px!important;font-weight:750!important;text-transform:none!important;letter-spacing:0!important;}';
            css += '#kore-identidade .kore-operational-head p{display:none!important;}';
            css += '#kore-identidade .kore-problem-menu{background:#fbfcfe!important;border-top:0!important;border-bottom:1px solid #edf1f5!important;padding:10px 12px!important;gap:8px!important;}';
            css += '#kore-identidade .kore-problem-menu button,#kore-identidade .kore-filtro-intervencao{height:32px!important;min-height:32px!important;border-radius:5px!important;padding:5px 10px!important;font-size:12px!important;font-weight:650!important;line-height:1!important;box-shadow:none!important;transition:background .15s ease,border-color .15s ease,box-shadow .15s ease!important;}';
            css += '#kore-identidade .kore-filtro-intervencao .kore-menu-label{font-weight:650!important;}';
            css += '#kore-identidade .kore-filtro-intervencao .kore-problem-count{margin-left:6px!important;padding:1px 7px!important;border-radius:999px!important;background:rgba(255,255,255,.72)!important;border:1px solid rgba(15,23,42,.08)!important;font-weight:750!important;}';
            css += '#kore-identidade .kore-menu-critical{background:#fff5f5!important;border-color:#f4c7c7!important;color:#b42318!important;}';
            css += '#kore-identidade .kore-menu-review{background:#fff8ed!important;border-color:#fed7aa!important;color:#b45309!important;}';
            css += '#kore-identidade .kore-menu-context{background:#f6f2ff!important;border-color:#ddd6fe!important;color:#6d28d9!important;}';
            css += '#kore-identidade .kore-menu-ok{background:#f0fbf4!important;border-color:#bbf7d0!important;color:#047857!important;}';
            css += '#kore-identidade .kore-menu-neutral{background:#f8fafc!important;border-color:#dbe3ec!important;color:#334155!important;}';
            css += '#kore-identidade .kore-filtro-ativo{background:#fff!important;border-color:currentColor!important;box-shadow:inset 0 -2px 0 currentColor!important;}';
            css += '#kore-identidade .kore-table-wrap{overflow-x:hidden!important;width:100%!important;border-color:#e3eaf2!important;border-radius:5px!important;}';
            css += '#kore-identidade .kore-table-scroll{overflow-x:hidden!important;max-height:560px!important;}';
            css += '#kore-identidade .kore-table{table-layout:fixed!important;width:100%!important;border-collapse:separate!important;border-spacing:0!important;}';
            css += '#kore-identidade .kore-table th{position:sticky!important;top:0!important;z-index:4!important;background:#f8fafc!important;color:#475467!important;border-bottom:1px solid #dbe3ec!important;text-transform:none!important;letter-spacing:0!important;font-size:11px!important;font-weight:650!important;padding:8px 8px!important;}';
            css += '#kore-identidade .kore-table td{border-bottom:1px solid #eef2f6!important;padding:9px 8px!important;vertical-align:top!important;color:#26364a!important;font-size:12px!important;line-height:1.38!important;word-break:normal!important;overflow-wrap:break-word!important;hyphens:none!important;}';
            css += '#kore-identidade .kore-table tr:nth-child(even) td{background:#fdfefe!important;}';
            css += '#kore-identidade .kore-table tr:hover td{background:#f7fbff!important;}';
            css += '#kore-identidade .kore-table th:nth-child(1),#kore-identidade .kore-table td:nth-child(1){width:70px!important;}';
            css += '#kore-identidade .kore-table th:nth-child(2),#kore-identidade .kore-table td:nth-child(2){width:16%!important;}';
            css += '#kore-identidade .kore-table th:nth-child(3),#kore-identidade .kore-table td:nth-child(3){width:62px!important;}';
            css += '#kore-identidade .kore-table th:nth-child(4),#kore-identidade .kore-table td:nth-child(4){width:102px!important;}';
            css += '#kore-identidade .kore-table th:nth-child(5),#kore-identidade .kore-table td:nth-child(5){width:31%!important;}';
            css += '#kore-identidade .kore-table th:nth-child(6),#kore-identidade .kore-table td:nth-child(6){width:82px!important;}';
            css += '#kore-identidade .kore-table th:nth-child(7),#kore-identidade .kore-table td:nth-child(7){width:14%!important;}';
            css += '#kore-identidade .kore-table th:nth-child(8),#kore-identidade .kore-table td:nth-child(8){width:18%!important;}';
            css += '#kore-identidade .kore-table th:nth-child(9),#kore-identidade .kore-table td:nth-child(9){width:64px!important;}';
            css += '#kore-identidade .kore-title-cell,#kore-identidade .kore-title-cell a{font-weight:700!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-occ-block{display:block!important;margin-bottom:7px!important;}';
            css += '#kore-identidade .kore-occ-label{display:block!important;font-size:10px!important;font-weight:750!important;text-transform:none!important;color:#667085!important;letter-spacing:0!important;margin-bottom:2px!important;}';
            css += '#kore-identidade .kore-occ-value,#kore-identidade .kore-occ-name{display:block!important;font-size:12px!important;line-height:1.35!important;color:#111827!important;font-weight:500!important;}';
            css += '#kore-identidade .kore-occ-field{display:block!important;font-size:11px!important;color:#475467!important;font-weight:700!important;margin-bottom:1px!important;}';
            css += '#kore-identidade .kore-occ-meta-line{display:block!important;font-size:11px!important;color:#64748b!important;line-height:1.35!important;}';
            css += '#kore-identidade .kore-occ-empty{display:block!important;color:#64748b!important;font-style:italic!important;}';
            css += '#kore-identidade .kore-occ-reading{background:#fffbeb!important;border-left:3px solid #f59e0b!important;padding:6px 7px!important;border-radius:3px!important;}';
            css += '#kore-identidade .kore-diagnostico-main{display:block!important;color:#1f2937!important;font-size:11.5px!important;line-height:1.35!important;}';
            css += '#kore-identidade .kore-diagnostico-sub{display:block!important;color:#64748b!important;font-size:11px!important;line-height:1.35!important;margin-top:3px!important;}';
            css += '#kore-identidade .kore-action-cell strong{font-size:12.5px!important;font-weight:750!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-action-detail{font-size:11.3px!important;line-height:1.35!important;color:#52637a!important;margin-top:4px!important;}';
            css += '#kore-identidade .kore-priority-pill,#kore-identidade .kore-badge{font-size:10.5px!important;font-weight:650!important;border-radius:999px!important;padding:2px 7px!important;border:0!important;}';
            css += '#kore-identidade .kore-table-links{display:grid!important;grid-template-columns:repeat(2,27px)!important;gap:4px!important;min-width:58px!important;align-items:start!important;justify-content:center!important;}';
            css += '#kore-identidade .kore-table-links a.kore-btn,#kore-identidade .kore-table-links a{width:27px!important;height:26px!important;min-width:27px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;border-radius:4px!important;border:1px solid #dbe3ec!important;background:#fff!important;color:#111827!important;font-size:12px!important;line-height:1!important;}';
            css += '#kore-identidade .kore-table-links a:hover{background:#f8fafc!important;border-color:#94a3b8!important;color:#000!important;}';
            css += '#kore-identidade .kore-link-aicon{font-size:11px!important;font-weight:800!important;color:#111827!important;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;}';
            css += '#kore-identidade .kore-vazio{background:#fbfcfe!important;color:#667085!important;border:1px dashed #dbe3ec!important;border-radius:4px!important;}';


            /* K●RE v6.1 UX refinement requested after visual review */
            css += '#kore-identidade .kore-header-actions.kore-source-tabs{display:flex!important;gap:8px!important;align-items:center!important;}';
            css += '#kore-identidade .kore-header-actions .kore-source-card{height:28px!important;min-width:0!important;border-radius:2px!important;padding:5px 10px!important;font-weight:650!important;text-transform:uppercase!important;letter-spacing:.01em!important;background:#fff!important;}';
            css += '#kore-identidade .kore-header-actions .kore-source-card .kore-logo-wikidata,#kore-identidade .kore-header-actions .kore-source-card .kore-logo-viaf,#kore-identidade .kore-header-actions .kore-source-card .kore-logo-dashboard{display:none!important;}';
            css += '#kore-identidade .kore-source-open{height:30px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;border-radius:2px!important;padding:5px 10px!important;font-weight:650!important;}';
            css += '#kore-identidade #kore-pesquisar{height:30px!important;border-radius:2px!important;padding:5px 12px!important;font-weight:650!important;text-transform:uppercase!important;background:#fff!important;}';
            css += '#kore-identidade .kore-source-panel h3{height:34px!important;display:flex!important;align-items:center!important;margin-bottom:12px!important;}';
            css += '#kore-identidade .kore-create-new{margin-top:10px!important;}';

            css += '#kore-identidade .kore-dashboard-controlbar{display:grid!important;grid-template-columns:auto minmax(240px,1fr) auto!important;gap:12px!important;align-items:center!important;background:#fff!important;border:1px solid #dbe3ec!important;border-radius:3px!important;padding:8px 10px!important;margin-bottom:10px!important;}';
            css += '#kore-identidade .kore-dashboard-progress{height:14px!important;display:block!important;border:1px solid #9fb4c2!important;border-radius:2px!important;background:#f2f6f8!important;padding:1px!important;box-shadow:inset 0 1px 2px rgba(15,23,42,.12)!important;}';
            css += '#kore-identidade .kore-dashboard-progress.kore-fechado{display:block!important;}';
            css += '#kore-identidade .kore-dashboard-progressbar{height:10px!important;background:#edf2f7!important;border-radius:1px!important;overflow:hidden!important;}';
            css += '#kore-identidade #kore-dashboard-progressbar-fill{height:10px!important;border-radius:1px!important;background:#0080a3!important;box-shadow:none!important;}';
            css += '#kore-identidade .kore-dashboard-progresslabel{white-space:nowrap!important;font-size:12px!important;font-weight:650!important;color:#334155!important;}';

            css += '#kore-identidade .kore-v34-top{display:grid!important;grid-template-columns:minmax(480px,1.15fr) repeat(5,minmax(125px,.7fr))!important;gap:10px!important;align-items:stretch!important;margin:10px 0 14px 0!important;}';
            css += '#kore-identidade .kore-v34-identity{position:relative!important;overflow:hidden!important;border:1px solid #dbe3ec!important;border-radius:6px!important;background:linear-gradient(135deg,#ffffff 0%,#f7fbfd 48%,#eef8fb 100%)!important;box-shadow:0 5px 16px rgba(15,23,42,.05)!important;}';
            css += '#kore-identidade .kore-v34-identity:before{content:""!important;position:absolute!important;left:18px!important;top:18px!important;width:190px!important;height:165px!important;background:radial-gradient(circle at 20px 20px,#0080a3 0 3px,transparent 4px),radial-gradient(circle at 145px 36px,#dbde48 0 4px,transparent 5px),radial-gradient(circle at 78px 112px,#7c3aed 0 3px,transparent 4px),linear-gradient(28deg,transparent 47%,rgba(0,128,163,.18) 48%,rgba(0,128,163,.18) 50%,transparent 51%),linear-gradient(146deg,transparent 46%,rgba(124,58,237,.14) 47%,rgba(124,58,237,.14) 49%,transparent 50%)!important;opacity:.75!important;pointer-events:none!important;}';
            css += '#kore-identidade .kore-v34-identity-main{position:relative!important;z-index:1!important;grid-template-columns:134px 1fr!important;gap:16px!important;padding:2px!important;}';
            css += '#kore-identidade .kore-v34-photo{width:134px!important;height:176px!important;border-radius:4px!important;border:1px solid #cbd5e1!important;box-shadow:0 8px 18px rgba(15,23,42,.13)!important;background:#f8fafc!important;}';
            css += '#kore-identidade .kore-v34-name{font-size:19px!important;font-weight:850!important;line-height:1.15!important;margin-bottom:6px!important;}';
            css += '#kore-identidade .kore-v34-fieldgrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;margin-top:10px!important;}';
            css += '#kore-identidade .kore-v34-field{border:0!important;border-left:3px solid #dbe3ec!important;background:rgba(255,255,255,.78)!important;border-radius:3px!important;padding:7px 9px!important;min-height:44px!important;box-shadow:0 1px 0 rgba(15,23,42,.04)!important;}';
            css += '#kore-identidade .kore-v34-field strong{font-size:10.5px!important;text-transform:none!important;letter-spacing:0!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-v34-alertgrid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;margin-top:7px!important;}';
            css += '#kore-identidade .kore-v34-mini-alert{border:0!important;border-left:3px solid currentColor!important;border-radius:3px!important;padding:7px 9px!important;min-height:42px!important;box-shadow:0 1px 0 rgba(15,23,42,.04)!important;}';
            css += '#kore-identidade .kore-v34-mini-alert strong{font-size:10.5px!important;text-transform:none!important;letter-spacing:0!important;}';
            css += '#kore-identidade .kore-v34-kpis{display:contents!important;}';
            css += '#kore-identidade .kore-v34-kpi{border-radius:5px!important;border:1px solid #dbe3ec!important;background:#fff!important;box-shadow:0 5px 16px rgba(15,23,42,.045)!important;min-height:170px!important;padding:14px 12px!important;text-align:right!important;position:relative!important;overflow:hidden!important;}';
            css += '#kore-identidade .kore-v34-kpi:before{content:""!important;position:absolute!important;left:12px!important;top:14px!important;width:34px!important;height:34px!important;border-radius:999px!important;background:#f2f4f7!important;}';
            css += '#kore-identidade .kore-v34-kpi:after{content:""!important;position:absolute!important;left:24px!important;top:22px!important;width:10px!important;height:18px!important;border-radius:2px!important;background:#98a2b3!important;box-shadow:10px -6px 0 #cbd5e1,20px 3px 0 #e5e7eb!important;}';
            css += '#kore-identidade .kore-v34-kpi-red:before{background:#fff1f1!important;}#kore-identidade .kore-v34-kpi-red:after{background:#d92d20!important;box-shadow:10px -6px 0 #f97066,20px 3px 0 #fecdca!important;}';
            css += '#kore-identidade .kore-v34-kpi-orange:before{background:#fff7ed!important;}#kore-identidade .kore-v34-kpi-orange:after{background:#f79009!important;box-shadow:10px -6px 0 #fdb022,20px 3px 0 #fedf89!important;}';
            css += '#kore-identidade .kore-v34-kpi-green:before{background:#ecfdf3!important;}#kore-identidade .kore-v34-kpi-green:after{background:#12b76a!important;box-shadow:10px -6px 0 #32d583,20px 3px 0 #abefc6!important;}';
            css += '#kore-identidade .kore-v34-kpi-blue:before{background:#eff8ff!important;}#kore-identidade .kore-v34-kpi-blue:after{background:#0080a3!important;box-shadow:10px -6px 0 #53b1fd,20px 3px 0 #b9e6fe!important;}';
            css += '#kore-identidade .kore-v34-kpi-purple:before{background:#f5f3ff!important;}#kore-identidade .kore-v34-kpi-purple:after{background:#7c3aed!important;box-shadow:10px -6px 0 #a78bfa,20px 3px 0 #ddd6fe!important;}';
            css += '#kore-identidade .kore-v34-kpi-title{font-size:14px!important;font-weight:800!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-v34-kpi-value{font-size:30px!important;line-height:1!important;margin-top:12px!important;}';
            css += '#kore-identidade .kore-v34-kpi-detail{font-size:11px!important;line-height:1.25!important;color:#475467!important;margin-top:8px!important;}';
            css += '#kore-identidade .kore-v34-kpi-detail br{display:none!important;}';

            css += '#kore-identidade .kore-operational-head{padding:8px 12px 7px 12px!important;border-bottom:1px solid #e5e7eb!important;background:#fff!important;}';
            css += '#kore-identidade .kore-operational-title-hidden{display:none!important;}';
            css += '#kore-identidade .kore-operational-head p{margin:0!important;font-size:11.5px!important;color:#64748b!important;}';
            css += '#kore-identidade .kore-operational-head .kore-count-pill{margin-left:auto!important;}';
            css += '#kore-identidade .kore-problem-menu{display:flex!important;justify-content:flex-start!important;align-items:center!important;gap:6px!important;flex-wrap:wrap!important;padding:8px 12px!important;background:#fff!important;}';
            css += '#kore-identidade .kore-problem-menu button.kore-filtro-intervencao{flex:0 0 auto!important;width:auto!important;min-width:0!important;border-radius:3px!important;padding:5px 8px!important;background:#fff!important;box-shadow:none!important;height:28px!important;}';
            css += '#kore-identidade .kore-problem-menu .kore-menu-label{font-size:11.5px!important;font-weight:650!important;margin-right:9px!important;}';
            css += '#kore-identidade .kore-problem-menu .kore-problem-count{font-size:11px!important;line-height:1!important;border:1px solid #e5e7eb!important;border-radius:999px!important;background:#fff!important;padding:2px 7px!important;margin:0!important;}';
            css += '#kore-identidade .kore-menu-critical{border-left:3px solid #d92d20!important;}#kore-identidade .kore-menu-review{border-left:3px solid #f79009!important;}#kore-identidade .kore-menu-context{border-left:3px solid #0080a3!important;}#kore-identidade .kore-menu-ok{border-left:3px solid #12b76a!important;}#kore-identidade .kore-menu-neutral{border-left:3px solid #7c3aed!important;}';
            css += '#kore-identidade .kore-filtro-ativo{background:#f8fbfd!important;border-color:#7aaec0!important;color:#0f172a!important;box-shadow:inset 0 -2px 0 rgba(0,128,163,.35)!important;}';

            css += '#kore-identidade .kore-table-wrap,#kore-identidade .kore-table-scroll{padding-right:18px!important;}';
            css += '#kore-identidade .kore-table{min-width:1540px!important;}';
            css += '#kore-identidade .kore-table th:first-child,#kore-identidade .kore-table td:first-child{min-width:76px!important;width:76px!important;white-space:nowrap!important;}';
            css += '#kore-identidade .kore-table th:nth-child(5),#kore-identidade .kore-table td:nth-child(5){min-width:560px!important;width:560px!important;}';
            css += '#kore-identidade .kore-table th:last-child,#kore-identidade .kore-table td:last-child{min-width:92px!important;width:92px!important;padding-right:22px!important;}';
            css += '#kore-identidade .kore-table-links{justify-content:flex-start!important;margin-right:14px!important;}';
            css += '#kore-identidade .kore-v6-occ-card{border-radius:5px!important;border:1px solid #dbe3ec!important;background:#fff!important;padding:9px!important;}';
            css += '#kore-identidade .kore-v6-occ-top{border-bottom:1px solid #eef2f7!important;padding-bottom:7px!important;margin-bottom:7px!important;}';
            css += '#kore-identidade .kore-v6-occ-lines{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important;margin-bottom:7px!important;}';
            css += '#kore-identidade .kore-v6-line{border:0!important;border-left:3px solid #dbe3ec!important;background:#fbfcfe!important;border-radius:3px!important;padding:5px 7px!important;}';
            css += '#kore-identidade .kore-v6-semantic{display:grid!important;grid-template-columns:1.2fr 1fr 1fr 1fr 1.2fr!important;gap:6px!important;border-top:0!important;margin-top:7px!important;}';
            css += '#kore-identidade .kore-v6-semantic>div{border:0!important;border-left:3px solid #cbd5e1!important;background:#f8fafc!important;border-radius:3px!important;padding:7px 8px!important;min-height:72px!important;}';
            css += '#kore-identidade .kore-v6-semantic>div:first-child{background:#f0f9ff!important;border-left-color:#0080a3!important;}';
            css += '#kore-identidade .kore-v6-semantic>div:last-child{background:#fff7ed!important;border-left-color:#f79009!important;}';
            css += '#kore-identidade .kore-v6-semantic strong{font-size:10px!important;letter-spacing:.02em!important;text-transform:uppercase!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-v6-semantic-note{font-size:10.5px!important;line-height:1.25!important;color:#475467!important;}';

            css += '.kore-official-logo{display:block;object-fit:contain;}';
            css += '.kore-official-logo-wikidata{width:92px;height:auto;max-height:42px;}';
            css += '.kore-official-logo-viaf{width:54px;height:auto;max-height:42px;}';
            css += '.kore-source-logo-wikidata,.kore-source-logo-viaf{display:flex!important;align-items:center!important;justify-content:flex-start!important;margin:0 8px 8px 0!important;}';
            css += '.kore-source-btn-wikidata,.kore-source-btn-viaf{min-width:106px;text-align:center;font-weight:700!important;}';


            css += '#kore-identidade .kore-source-open#kore-link-wikidata,#kore-identidade .kore-source-open#kore-link-viaf{min-width:92px!important;height:30px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-weight:700!important;text-transform:none!important;letter-spacing:0!important;}';
            css += '#kore-identidade .kore-logo-wikidata,#kore-identidade .kore-logo-viaf{display:inline-flex!important;align-items:center!important;justify-content:flex-start!important;margin:0!important;padding:0!important;}';
            css += '#kore-identidade .kore-logo-wikidata img{display:block!important;width:116px!important;height:auto!important;max-height:42px!important;object-fit:contain!important;}';
            css += '#kore-identidade .kore-logo-viaf img{display:block!important;width:50px!important;height:auto!important;max-height:42px!important;object-fit:contain!important;}';
            css += '#kore-identidade .kore-source-panel h3{height:44px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;margin:0 0 12px 0!important;}';


            css += '/* K●RE v7.2, dashboard reconstruída com Font Awesome */';
            css += '#kore-identidade{background:#f6f8fb!important;border:1px solid #dbe4ef!important;border-radius:0!important;color:#10213f!important;}';
            css += '#kore-identidade .kore-tab-panel{background:#f6f8fb!important;padding:14px!important;}';
            css += '#kore-identidade .kore-dashboard-actions{display:grid!important;grid-template-columns:auto 1fr auto!important;gap:12px!important;align-items:center!important;background:#fff!important;border:1px solid #dbe4ef!important;border-radius:6px!important;padding:10px 12px!important;margin:0 0 10px 0!important;box-shadow:none!important;}';
            css += '#kore-identidade #kore-dashboard-atualizar{height:34px!important;border-radius:6px!important;padding:0 14px!important;background:#fff!important;border:1px solid #cbd8e8!important;font-size:12px!important;font-weight:750!important;}';
            css += '#kore-identidade .kore-progress,#kore-identidade .kore-dashboard-progress{height:10px!important;border:1px solid #d8e4f0!important;background:#f8fafc!important;border-radius:2px!important;box-shadow:none!important;overflow:hidden!important;}';
            css += '#kore-identidade .kore-progress-bar,#kore-identidade .kore-dashboard-progress-bar{height:100%!important;background:#84bdd8!important;border-radius:0!important;}';

            css += '#kore-identidade .kmod-dashboard{display:grid!important;grid-template-columns:minmax(410px,1.75fr) repeat(5,minmax(128px,.72fr))!important;gap:8px!important;align-items:stretch!important;margin:0 0 12px 0!important;}';
            css += '#kore-identidade .kmod-kpis{display:contents!important;}';
            css += '#kore-identidade .kmod-dashboard *{box-sizing:border-box!important;}';

            css += '#kore-identidade .kmod-identity-card{background:#fff!important;border:1px solid #dbe4ef!important;border-radius:6px!important;box-shadow:0 2px 7px rgba(15,23,42,.035)!important;padding:14px!important;display:grid!important;grid-template-columns:126px 1fr!important;gap:14px!important;min-height:196px!important;}';
            css += '#kore-identidade .kmod-photo{width:126px!important;height:174px!important;border-radius:4px!important;object-fit:cover!important;border:1px solid #dbe4ef!important;box-shadow:0 2px 7px rgba(15,23,42,.08)!important;background:#eef2f7!important;}';
            css += '#kore-identidade .kmod-photo-empty{display:flex!important;align-items:center!important;justify-content:center!important;color:#94a3b8!important;font-size:34px!important;}';
            css += '#kore-identidade .kmod-name{font-size:19px!important;line-height:1.15!important;font-weight:900!important;color:#0f172a!important;margin:0 0 2px 0!important;}';
            css += '#kore-identidade .kmod-dates{font-size:15px!important;color:#334155!important;margin:0 0 8px 0!important;}';
            css += '#kore-identidade .kmod-badges{display:flex!important;gap:6px!important;flex-wrap:wrap!important;margin:0 0 8px 0!important;}';
            css += '#kore-identidade .kmod-badge{display:inline-flex!important;gap:5px!important;align-items:center!important;height:22px!important;border-radius:999px!important;padding:0 8px!important;font-size:11px!important;font-weight:700!important;border:1px solid #dbe4ef!important;background:#f8fafc!important;color:#334155!important;}';
            css += '#kore-identidade .kmod-authid{background:#ecfdf5!important;border-color:#bbf7d0!important;color:#166534!important;}';
            css += '#kore-identidade .kmod-score-bad{background:#fef2f2!important;border-color:#fecaca!important;color:#dc2626!important;}';
            css += '#kore-identidade .kmod-score-warn{background:#fffbeb!important;border-color:#fde68a!important;color:#b45309!important;}';
            css += '#kore-identidade .kmod-score-ok{background:#ecfdf5!important;border-color:#bbf7d0!important;color:#166534!important;}';
            css += '#kore-identidade .kmod-fieldgrid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;margin-top:8px!important;}';
            css += '#kore-identidade .kmod-field{border:1px solid #e4edf6!important;background:#fbfdff!important;border-radius:4px!important;padding:7px 8px!important;min-height:50px!important;}';
            css += '#kore-identidade .kmod-field strong{display:block!important;font-size:11px!important;font-weight:850!important;color:#0f172a!important;margin:0 0 3px 0!important;}';
            css += '#kore-identidade .kmod-field span{display:block!important;font-size:11px!important;line-height:1.25!important;color:#10213f!important;word-break:break-word!important;}';
            css += '#kore-identidade .kmod-field a{color:#005fcc!important;text-decoration:none!important;}';
            css += '#kore-identidade .kmod-alertgrid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;margin-top:8px!important;}';
            css += '#kore-identidade .kmod-alert{display:grid!important;grid-template-columns:22px 1fr!important;gap:7px!important;align-items:center!important;border-radius:4px!important;padding:8px 9px!important;font-size:11px!important;line-height:1.25!important;border-left:3px solid #059669!important;background:#ecfdf5!important;color:#065f46!important;}';
            css += '#kore-identidade .kmod-alert i{font-size:14px!important;}';
            css += '#kore-identidade .kmod-alert strong{display:block!important;font-weight:850!important;}';
            css += '#kore-identidade .kmod-alert span{display:block!important;margin-top:2px!important;}';
            css += '#kore-identidade .kmod-alert.kmod-warn{border-left-color:#d97706!important;background:#fffbeb!important;color:#92400e!important;}';
            css += '#kore-identidade .kmod-alert.kmod-bad{border-left-color:#dc2626!important;background:#fef2f2!important;color:#991b1b!important;}';

            css += '#kore-identidade .kmod-kpi{background:#fff!important;border:1px solid #dbe4ef!important;border-radius:6px!important;box-shadow:0 2px 7px rgba(15,23,42,.035)!important;min-height:196px!important;padding:16px 14px!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;text-align:left!important;position:relative!important;overflow:hidden!important;}';
            css += '#kore-identidade .kmod-kpi:before,#kore-identidade .kmod-kpi:after{display:none!important;content:none!important;}';
            css += '#kore-identidade .kmod-icon{width:36px!important;height:36px!important;border-radius:8px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:18px!important;margin:0 0 24px 0!important;}';
            css += '#kore-identidade .kmod-title{font-size:14px!important;font-weight:900!important;color:#0f172a!important;margin:0 0 13px 0!important;line-height:1.2!important;text-align:left!important;}';
            css += '#kore-identidade .kmod-value{font-size:31px!important;line-height:1!important;font-weight:500!important;color:#1e3658!important;margin:0 0 14px 0!important;display:block!important;text-align:left!important;}';
            css += '#kore-identidade .kmod-detail{font-size:11px!important;color:#53657d!important;line-height:1.45!important;margin:0!important;text-align:left!important;display:flex!important;flex-direction:column!important;gap:4px!important;}';
            css += '#kore-identidade .kmod-detail span{display:flex!important;justify-content:space-between!important;gap:18px!important;min-width:104px!important;}';
            css += '#kore-identidade .kmod-detail b{font-size:11px!important;font-weight:850!important;color:#0f172a!important;}';
            css += '#kore-identidade .kmod-red .kmod-icon{background:#ffe4e6!important;color:#dc2626!important;}';
            css += '#kore-identidade .kmod-orange .kmod-icon{background:#fff7ed!important;color:#ea580c!important;}';
            css += '#kore-identidade .kmod-green .kmod-icon{background:#ecfdf5!important;color:#16a34a!important;}';
            css += '#kore-identidade .kmod-blue .kmod-icon{background:#eff6ff!important;color:#2563eb!important;}';
            css += '#kore-identidade .kmod-purple .kmod-icon{background:#f5f3ff!important;color:#7c3aed!important;}';

            css += '#kore-identidade .kore-v45-kpi-right .kmod-title,#kore-identidade .kore-v45-kpi-right .kmod-value,#kore-identidade .kore-v45-kpi-right .kmod-detail{text-align:left!important;}';
            css += '#kore-identidade .kore-v45-kpi-right{align-items:flex-start!important;text-align:left!important;}';

            css += '#kore-identidade .kore-intervencao-filtros,#kore-identidade .kore-problem-menu{background:#fff!important;border:1px solid #dbe4ef!important;border-radius:6px!important;margin:0 0 10px 0!important;padding:10px 12px!important;display:flex!important;justify-content:flex-start!important;align-items:center!important;gap:6px!important;flex-wrap:wrap!important;}';
            css += '#kore-identidade .kore-filtro-intervencao,#kore-identidade .kore-problem-menu button{height:28px!important;width:auto!important;min-width:auto!important;border-radius:4px!important;padding:4px 9px!important;background:#fff!important;border:1px solid #d5e1ef!important;display:inline-flex!important;align-items:center!important;gap:8px!important;font-size:11px!important;font-weight:750!important;text-align:left!important;}';
            css += '#kore-identidade .kore-menu-label{white-space:nowrap!important;font-weight:800!important;color:#10213f!important;}';
            css += '#kore-identidade .kore-problem-count{min-width:22px!important;height:18px!important;border-radius:999px!important;background:#f8fafc!important;border:1px solid #dbe4ef!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:10px!important;font-weight:900!important;margin:0!important;}';
            css += '#kore-identidade .kore-menu-critical{border-left:3px solid #dc2626!important;}';
            css += '#kore-identidade .kore-menu-review{border-left:3px solid #f59e0b!important;}';
            css += '#kore-identidade .kore-menu-ok{border-left:3px solid #16a34a!important;}';
            css += '#kore-identidade .kore-menu-context{border-left:3px solid #2563eb!important;}';
            css += '#kore-identidade .kore-menu-neutral{border-left:3px solid #94a3b8!important;}';

            css += '#kore-identidade .kore-panel,#kore-identidade .kore-correction-box,#kore-identidade .kore-secondary-box{border-radius:6px!important;border:1px solid #dbe4ef!important;background:#fff!important;box-shadow:0 2px 7px rgba(15,23,42,.025)!important;}';
            css += '#kore-identidade .kore-table th{background:#f8fbff!important;font-size:11px!important;font-weight:850!important;color:#475569!important;text-transform:none!important;letter-spacing:0!important;padding:10px!important;}';
            css += '#kore-identidade .kore-table td{font-size:12px!important;padding:10px!important;border-bottom:1px solid #edf3fa!important;}';
            css += '#kore-identidade .kore-table th:last-child,#kore-identidade .kore-table td:last-child{padding-right:28px!important;}';
            css += '#kore-identidade .kore-table-wrap{padding-right:18px!important;}';
            css += '#kore-identidade .kore-table-links{gap:7px!important;padding-right:10px!important;}';

            css += '@media(max-width:1250px){#kore-identidade .kmod-dashboard{grid-template-columns:1fr repeat(2,minmax(128px,.72fr))!important;}}';
            css += '@media(max-width:900px){#kore-identidade .kmod-dashboard{grid-template-columns:1fr!important;}#kore-identidade .kmod-identity-card{grid-template-columns:1fr!important;}#kore-identidade .kmod-photo{width:100%!important;height:190px!important;}}';


            css += '/* K●RE v7.3, ajustes finais de alinhamento, números e logos */';
            css += '#kore-identidade .kmod-logo-row,#kore-identidade .kore-coluna h3,#kore-identidade .kore-source-panel h3{min-height:56px!important;height:56px!important;display:flex!important;align-items:flex-start!important;justify-content:flex-start!important;}';
            css += '#kore-identidade .kore-logo-wikidata,#kore-identidade .kore-logo-viaf{height:42px!important;display:flex!important;align-items:flex-start!important;justify-content:flex-start!important;margin:0!important;padding:0!important;}';
            css += '#kore-identidade .kore-logo-wikidata img{height:42px!important;width:auto!important;max-height:42px!important;object-fit:contain!important;margin:0!important;}';
            css += '#kore-identidade .kore-logo-viaf img{height:42px!important;width:auto!important;max-height:42px!important;object-fit:contain!important;margin:0!important;}';

            css += '#kore-identidade .kmod-value{font-weight:850!important;color:#0f172a!important;letter-spacing:-.02em!important;}';
            css += '#kore-identidade .kmod-detail{width:100%!important;display:grid!important;gap:5px!important;align-items:start!important;}';
            css += '#kore-identidade .kmod-detail span{display:grid!important;grid-template-columns:auto 1fr!important;gap:6px!important;align-items:start!important;min-width:0!important;width:100%!important;justify-content:start!important;}';
            css += '#kore-identidade .kmod-detail b{font-weight:900!important;min-width:18px!important;text-align:left!important;color:#0f172a!important;}';
            css += '#kore-identidade .kmod-title{margin-bottom:12px!important;}';

            css += '#kore-identidade .kmod-photo-wrap{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:8px!important;}';
            css += '#kore-identidade .kmod-wikipedia-link{display:inline-flex!important;align-items:center!important;gap:6px!important;height:28px!important;border:1px solid #dbe4ef!important;background:#fff!important;border-radius:6px!important;padding:0 10px!important;font-size:11px!important;font-weight:800!important;color:#1d4ed8!important;text-decoration:none!important;}';
            css += '#kore-identidade .kmod-wikipedia-link:before{content:"\\f266";font-family:FontAwesome!important;font-size:13px!important;color:#1d4ed8!important;}';
            css += '#kore-identidade .kmod-wikipedia-link:hover{background:#eff6ff!important;border-color:#93c5fd!important;text-decoration:none!important;}';

            css += '#kore-identidade .kmod-fieldgrid{align-items:stretch!important;}';
            css += '#kore-identidade .kmod-alertgrid{align-items:stretch!important;}';
            css += '#kore-identidade .kmod-alert{min-height:46px!important;}';


            css += '/* K●RE v7.4, refinamento tabela, menu, Wikipédia e alinhamentos */';

            css += '#kore-identidade .kmod-value{font-weight:900!important;color:#06172f!important;letter-spacing:-.025em!important;}';
            css += '#kore-identidade .kmod-detail{width:100%!important;display:flex!important;flex-direction:column!important;gap:5px!important;align-items:stretch!important;}';
            css += '#kore-identidade .kmod-detail span{display:grid!important;grid-template-columns:auto 1fr!important;gap:7px!important;align-items:start!important;min-width:0!important;width:100%!important;text-align:left!important;}';
            css += '#kore-identidade .kmod-detail b{font-weight:950!important;min-width:20px!important;text-align:left!important;color:#0f172a!important;}';

            css += '#kore-identidade .kore-logo-wikidata,#kore-identidade .kore-logo-viaf{height:42px!important;display:flex!important;align-items:flex-start!important;justify-content:flex-start!important;}';
            css += '#kore-identidade .kore-logo-wikidata img,#kore-identidade .kore-logo-viaf img{height:42px!important;width:auto!important;max-height:42px!important;object-fit:contain!important;margin:0!important;}';

            css += '#kore-identidade .kmod-photo-wrap{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:8px!important;}';
            css += '#kore-identidade .kmod-wikipedia-link{display:inline-flex!important;align-items:center!important;justify-content:center!important;height:24px!important;min-width:74px!important;border:1px solid #d5e1ef!important;background:#fff!important;border-radius:6px!important;padding:0 8px!important;font-size:10.5px!important;font-weight:850!important;color:#1d4ed8!important;text-decoration:none!important;line-height:1!important;box-shadow:none!important;}';
            css += '#kore-identidade .kmod-wikipedia-link:before{content:"\\f266";font-family:FontAwesome!important;font-size:12px!important;color:#1d4ed8!important;margin-right:5px!important;}';
            css += '#kore-identidade .kmod-wikipedia-link:hover{background:#eff6ff!important;border-color:#93c5fd!important;text-decoration:none!important;}';
            css += '#kore-identidade .kmod-wikipedia-loading{opacity:.55!important;cursor:default!important;}';

            css += '#kore-identidade .kore-intervencao-filtros,#kore-identidade .kore-problem-menu{background:#fff!important;border:1px solid #dbe4ef!important;border-radius:6px!important;margin:0 0 10px 0!important;padding:8px 10px!important;display:flex!important;justify-content:flex-start!important;align-items:center!important;gap:6px!important;flex-wrap:nowrap!important;overflow-x:auto!important;white-space:nowrap!important;}';
            css += '#kore-identidade .kore-filtro-intervencao,#kore-identidade .kore-problem-menu button{height:27px!important;width:auto!important;min-width:auto!important;border-radius:4px!important;padding:4px 9px!important;background:#fff!important;border:1px solid #d5e1ef!important;display:inline-flex!important;align-items:center!important;gap:8px!important;font-size:11px!important;font-weight:800!important;text-align:left!important;flex:0 0 auto!important;}';
            css += '#kore-identidade .kore-menu-label{white-space:nowrap!important;font-weight:850!important;color:#10213f!important;}';
            css += '#kore-identidade .kore-problem-count{min-width:22px!important;height:18px!important;border-radius:999px!important;background:#f8fafc!important;border:1px solid #dbe4ef!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:10px!important;font-weight:950!important;margin:0!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-menu-critical{border-left:3px solid #dc2626!important;}';
            css += '#kore-identidade .kore-menu-review{border-left:3px solid #f59e0b!important;}';
            css += '#kore-identidade .kore-menu-ok{border-left:3px solid #16a34a!important;}';
            css += '#kore-identidade .kore-menu-context{border-left:3px solid #2563eb!important;}';
            css += '#kore-identidade .kore-menu-neutral{border-left:3px solid #8b5cf6!important;}';
            css += '#kore-identidade .kore-filtro-ativo{background:#f8fbff!important;border-color:#7aa7d9!important;box-shadow:none!important;}';

            css += '#kore-identidade .kore-table th:nth-child(6),#kore-identidade .kore-table td:nth-child(6),#kore-identidade .kore-table th:nth-child(7),#kore-identidade .kore-table td:nth-child(7){display:none!important;}';
            css += '#kore-identidade .kore-table th:first-child,#kore-identidade .kore-table td:first-child{min-width:78px!important;white-space:nowrap!important;}';
            css += '#kore-identidade .kore-table td:first-child a,#kore-identidade .kore-title-cell{font-size:14px!important;line-height:1.25!important;font-weight:900!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-table td:first-child a{color:#005fcc!important;text-decoration:none!important;}';
            css += '#kore-identidade .kore-table th{background:#f8fbff!important;font-size:11px!important;font-weight:850!important;color:#475569!important;text-transform:none!important;letter-spacing:0!important;padding:10px!important;}';
            css += '#kore-identidade .kore-table td{font-size:12px!important;padding:10px!important;border-bottom:1px solid #edf3fa!important;vertical-align:top!important;}';
            css += '#kore-identidade .kore-table th:last-child,#kore-identidade .kore-table td:last-child{padding-right:32px!important;min-width:112px!important;}';
            css += '#kore-identidade .kore-table-wrap{padding-right:22px!important;}';
            css += '#kore-identidade .kore-table-links{gap:7px!important;padding-right:12px!important;}';

            css += '#kore-identidade .kore-v6-occ-card{border-radius:8px!important;border:1px solid #dbe4ef!important;background:#fff!important;padding:10px!important;}';
            css += '#kore-identidade .kore-v6-occ-title{font-size:14px!important;line-height:1.25!important;font-weight:900!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-v6-occ-meta{font-size:11px!important;color:#53657d!important;}';
            css += '#kore-identidade .kore-v6-occ-top{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;}';
            css += '#kore-identidade .kore-v6-occ-grid{display:flex!important;gap:6px!important;align-items:stretch!important;margin-top:8px!important;}';
            css += '#kore-identidade .kore-v6-occ-box{min-width:98px!important;flex:1 1 0!important;border:1px solid #e5edf7!important;border-left:3px solid #dbe4ef!important;background:#fbfdff!important;border-radius:0!important;padding:8px!important;}';
            css += '#kore-identidade .kore-v6-occ-box strong{font-size:10.5px!important;font-weight:950!important;color:#0f172a!important;text-transform:uppercase!important;letter-spacing:.01em!important;}';
            css += '#kore-identidade .kore-v6-occ-box span{font-size:11px!important;line-height:1.35!important;color:#334155!important;}';
            css += '#kore-identidade .kore-v6-impact{background:#fff7ed!important;border-color:#fed7aa!important;border-left-color:#f59e0b!important;}';
            css += '#kore-identidade .kore-v6-badge-critical,#kore-identidade .kore-v6-badge-review,#kore-identidade .kore-v6-badge-info,#kore-identidade .kore-v6-badge-ok{font-size:11px!important;font-weight:950!important;border-radius:999px!important;padding:3px 9px!important;}';
            css += '#kore-identidade .kore-action-cell strong,#kore-identidade .kore-v6-action{font-size:12.5px!important;font-weight:900!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-action-cell small,#kore-identidade .kore-v6-action small{display:block!important;font-size:11.5px!important;color:#53657d!important;line-height:1.38!important;margin-top:4px!important;}';


            css += '/* K●RE v7.5, botão Wikipédia compacto */';
            css += '#kore-identidade .kmod-wikipedia-link{display:inline-flex!important;align-items:center!important;justify-content:center!important;height:20px!important;min-width:60px!important;border:1px solid #dbe4ef!important;background:#fff!important;border-radius:5px!important;padding:0 7px!important;font-size:9.5px!important;font-weight:500!important;color:#334155!important;text-decoration:none!important;line-height:1!important;box-shadow:none!important;letter-spacing:0!important;}';
            css += '#kore-identidade .kmod-wikipedia-link:before{content:"\\f266";font-family:FontAwesome!important;font-size:10px!important;color:#64748b!important;margin-right:4px!important;font-weight:400!important;}';
            css += '#kore-identidade .kmod-wikipedia-link:hover{background:#f8fafc!important;border-color:#cbd5e1!important;color:#0f172a!important;text-decoration:none!important;}';
            css += '#kore-identidade .kmod-wikipedia-loading{opacity:.9!important;}';


            css += '/* K●RE v7.6, botão Wikipédia mais presente */';
            css += '#kore-identidade .kmod-wikipedia-link{display:inline-flex!important;align-items:center!important;justify-content:center!important;height:21px!important;min-width:64px!important;border:1px solid #94a3b8!important;background:#eef2f7!important;border-radius:3px!important;padding:0 8px!important;font-size:9.5px!important;font-weight:600!important;color:#1e293b!important;text-decoration:none!important;line-height:1!important;box-shadow:none!important;letter-spacing:0!important;}';
            css += '#kore-identidade .kmod-wikipedia-link:before{content:"\\f266";font-family:FontAwesome!important;font-size:10px!important;color:#334155!important;margin-right:4px!important;font-weight:400!important;}';
            css += '#kore-identidade .kmod-wikipedia-link:hover{background:#e2e8f0!important;border-color:#64748b!important;color:#0f172a!important;text-decoration:none!important;}';


            css += '/* K●RE v7.7, menus compactos numa linha */';

            css += '#kore-identidade .kore-intervencao-filtros,#kore-identidade .kore-problem-menu{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;padding:8px 10px!important;background:#fff!important;border:1px solid #dbe4ef!important;border-radius:6px!important;}';

            css += '#kore-identidade .kore-filtro-intervencao,#kore-identidade .kore-problem-menu button{height:24px!important;min-width:auto!important;width:auto!important;border-radius:999px!important;padding:0 10px!important;font-size:10.5px!important;font-weight:700!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;line-height:1!important;box-shadow:none!important;flex:0 0 auto!important;border:1px solid transparent!important;}';

            css += '#kore-identidade .kore-menu-label{font-weight:800!important;white-space:nowrap!important;line-height:1!important;}';

            css += '#kore-identidade .kore-problem-count{min-width:18px!important;height:18px!important;border-radius:999px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:9.5px!important;font-weight:900!important;background:rgba(255,255,255,.75)!important;border:0!important;padding:0 5px!important;line-height:1!important;}';

            css += '#kore-identidade .kore-menu-critical{background:#fef2f2!important;border-color:#fecaca!important;color:#b91c1c!important;}';
            css += '#kore-identidade .kore-menu-critical .kore-problem-count{color:#991b1b!important;background:#fff!important;}';

            css += '#kore-identidade .kore-menu-review{background:#fffbeb!important;border-color:#fde68a!important;color:#b45309!important;}';
            css += '#kore-identidade .kore-menu-review .kore-problem-count{color:#92400e!important;background:#fff!important;}';

            css += '#kore-identidade .kore-menu-ok{background:#ecfdf5!important;border-color:#bbf7d0!important;color:#166534!important;}';
            css += '#kore-identidade .kore-menu-ok .kore-problem-count{color:#166534!important;background:#fff!important;}';

            css += '#kore-identidade .kore-menu-context{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important;}';
            css += '#kore-identidade .kore-menu-context .kore-problem-count{color:#1d4ed8!important;background:#fff!important;}';

            css += '#kore-identidade .kore-menu-neutral{background:#f5f3ff!important;border-color:#ddd6fe!important;color:#6d28d9!important;}';
            css += '#kore-identidade .kore-menu-neutral .kore-problem-count{color:#5b21b6!important;background:#fff!important;}';

            css += '#kore-identidade .kore-filtro-ativo{box-shadow:inset 0 0 0 1px rgba(15,23,42,.12)!important;transform:none!important;}';

            css += '#kore-identidade .kore-intervencao-filtros::-webkit-scrollbar,#kore-identidade .kore-problem-menu::-webkit-scrollbar{height:5px!important;}';
            css += '#kore-identidade .kore-intervencao-filtros::-webkit-scrollbar-thumb,#kore-identidade .kore-problem-menu::-webkit-scrollbar-thumb{background:#cbd5e1!important;border-radius:999px!important;}';


            css += '/* K●RE v7.8, menu e ocorrências numa linha real */';

            css += '#kore-identidade .kore-intervencao-filtros,#kore-identidade .kore-problem-menu{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-start!important;gap:5px!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;padding:7px 9px!important;background:#fff!important;border:1px solid #dbe4ef!important;border-radius:6px!important;}';

            css += '#kore-identidade .kore-filtro-intervencao,#kore-identidade .kore-problem-menu button{display:inline-flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:center!important;gap:6px!important;height:23px!important;min-height:23px!important;max-height:23px!important;line-height:1!important;white-space:nowrap!important;word-break:keep-all!important;overflow:hidden!important;text-overflow:ellipsis!important;flex:0 0 auto!important;width:auto!important;max-width:none!important;padding:0 9px!important;border-radius:999px!important;font-size:10px!important;font-weight:750!important;}';

            css += '#kore-identidade .kore-menu-label{display:inline!important;white-space:nowrap!important;line-height:1!important;font-size:10px!important;font-weight:800!important;margin:0!important;padding:0!important;}';

            css += '#kore-identidade .kore-problem-count{display:inline-flex!important;flex:0 0 auto!important;min-width:17px!important;height:17px!important;max-height:17px!important;line-height:17px!important;border-radius:999px!important;align-items:center!important;justify-content:center!important;font-size:9px!important;font-weight:900!important;padding:0 4px!important;margin:0!important;white-space:nowrap!important;}';

            css += '#kore-identidade .kore-filtro-intervencao *{white-space:nowrap!important;word-break:keep-all!important;}';

            css += '#kore-identidade .kore-v6-occ-grid{display:flex!important;flex-wrap:nowrap!important;align-items:stretch!important;justify-content:flex-start!important;gap:5px!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;}';

            css += '#kore-identidade .kore-v6-occ-box{display:flex!important;flex-direction:column!important;justify-content:flex-start!important;flex:0 0 118px!important;min-width:118px!important;max-width:118px!important;white-space:normal!important;word-break:break-word!important;padding:7px!important;border-radius:0!important;}';

            css += '#kore-identidade .kore-v6-occ-box strong{display:block!important;font-size:10px!important;line-height:1.1!important;margin:0 0 4px 0!important;}';

            css += '#kore-identidade .kore-v6-occ-box span{display:block!important;font-size:10.5px!important;line-height:1.25!important;}';

            css += '#kore-identidade .kore-v6-occ-grid::-webkit-scrollbar,#kore-identidade .kore-intervencao-filtros::-webkit-scrollbar,#kore-identidade .kore-problem-menu::-webkit-scrollbar{height:5px!important;}';

            css += '#kore-identidade .kore-v6-occ-grid::-webkit-scrollbar-thumb,#kore-identidade .kore-intervencao-filtros::-webkit-scrollbar-thumb,#kore-identidade .kore-problem-menu::-webkit-scrollbar-thumb{background:#cbd5e1!important;border-radius:999px!important;}';


            css += '/* K●RE v7.9, filtros em linha única sem caixa alta */';

            css += '#kore-identidade .kore-area-filtros,#kore-identidade .kore-intervencao-filtros,#kore-identidade .kore-problem-menu{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-start!important;gap:5px!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;margin:0!important;padding:6px 8px!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;}';

            css += '#kore-identidade .kore-area-filtros{border-top:1px solid #e5edf7!important;border-bottom:1px solid #e5edf7!important;background:#fff!important;}';

            css += '#kore-identidade .kore-filtro-intervencao,#kore-identidade .kore-problem-menu button{display:inline-flex!important;flex:0 0 auto!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:center!important;gap:5px!important;width:auto!important;min-width:0!important;max-width:none!important;height:21px!important;min-height:21px!important;max-height:21px!important;padding:0 7px!important;margin:0!important;border-radius:3px!important;border:1px solid #cbd5e1!important;background:#f8fafc!important;box-shadow:none!important;text-shadow:none!important;font-size:10px!important;font-weight:600!important;line-height:1!important;color:#334155!important;text-align:left!important;white-space:nowrap!important;word-break:keep-all!important;overflow:visible!important;}';

            css += '#kore-identidade .kore-filtro-intervencao *,#kore-identidade .kore-problem-menu button *{display:inline-flex!important;align-items:center!important;white-space:nowrap!important;word-break:keep-all!important;line-height:1!important;margin:0!important;padding:0!important;}';

            css += '#kore-identidade .kore-menu-label{font-size:10px!important;font-weight:600!important;color:inherit!important;text-transform:none!important;letter-spacing:0!important;}';

            css += '#kore-identidade .kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;min-width:16px!important;width:auto!important;height:16px!important;max-height:16px!important;border-radius:3px!important;padding:0 4px!important;border:1px solid rgba(15,23,42,.10)!important;background:#fff!important;font-size:9px!important;font-weight:600!important;line-height:1!important;color:inherit!important;}';

            css += '#kore-identidade .kore-menu-critical{background:#fef2f2!important;border-color:#fecaca!important;color:#991b1b!important;}';
            css += '#kore-identidade .kore-menu-review{background:#fffbeb!important;border-color:#fde68a!important;color:#92400e!important;}';
            css += '#kore-identidade .kore-menu-neutral{background:#f5f3ff!important;border-color:#ddd6fe!important;color:#5b21b6!important;}';
            css += '#kore-identidade .kore-menu-context{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important;}';
            css += '#kore-identidade .kore-menu-ok{background:#ecfdf5!important;border-color:#bbf7d0!important;color:#166534!important;}';

            css += '#kore-identidade .kore-filtro-ativo{background:#e2e8f0!important;border-color:#94a3b8!important;color:#0f172a!important;box-shadow:none!important;}';

            css += '#kore-identidade .kore-intervencao-filtros::-webkit-scrollbar,#kore-identidade .kore-problem-menu::-webkit-scrollbar{height:4px!important;}';
            css += '#kore-identidade .kore-intervencao-filtros::-webkit-scrollbar-thumb,#kore-identidade .kore-problem-menu::-webkit-scrollbar-thumb{background:#cbd5e1!important;border-radius:999px!important;}';

            css += '#kore-identidade .kore-panel-head:empty,#kore-identidade .kore-correction-head:empty{display:none!important;}';
            css += '#kore-identidade .kore-panel-head,#kore-identidade .kore-correction-head{min-height:0!important;}';

            css += '#kore-identidade .kore-v6-occ-grid{display:flex!important;flex-wrap:nowrap!important;align-items:stretch!important;gap:5px!important;overflow-x:auto!important;white-space:nowrap!important;}';
            css += '#kore-identidade .kore-v6-occ-box{flex:0 0 118px!important;min-width:118px!important;max-width:118px!important;white-space:normal!important;}';


            css += '/* K●RE v8.0, tabs tipo pill e contador de ocorrências na barra de progresso */';

            css += '#kore-identidade .kore-dashboard-actions{display:grid!important;grid-template-columns:auto 1fr auto auto!important;gap:10px!important;align-items:center!important;background:#fff!important;border:1px solid #dbe4ef!important;border-radius:6px!important;padding:10px 12px!important;margin:0 0 10px 0!important;}';

            css += '#kore-identidade .kore-v80-ocorrencias-pill{height:24px!important;min-width:108px!important;border-radius:999px!important;border:1px solid #cbd5e1!important;background:#f8fafc!important;color:#0f172a!important;padding:0 11px!important;font-size:11px!important;font-weight:850!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;white-space:nowrap!important;}';
            css += '#kore-identidade .kore-v80-ocorrencias-pill:hover{background:#eff6ff!important;border-color:#93c5fd!important;color:#1d4ed8!important;}';

            css += '#kore-identidade .kore-v80-hide-occ-original{display:none!important;}';
            css += '#kore-identidade .kore-v80-hide-occ-head{display:none!important;}';
            css += '#kore-identidade .kore-panel-head:has(.kore-v80-hide-occ-original),#kore-identidade .kore-correction-head:has(.kore-v80-hide-occ-original),#kore-identidade .kore-secondary-head:has(.kore-v80-hide-occ-original){display:none!important;}';

            css += '#kore-identidade .kore-intervencao-filtros,#kore-identidade .kore-problem-menu{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-start!important;gap:6px!important;width:100%!important;max-width:100%!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;margin:0!important;padding:8px 10px!important;background:#fff!important;border:1px solid #dbe4ef!important;border-radius:6px!important;box-shadow:none!important;}';

            css += '#kore-identidade .kore-filtro-intervencao,#kore-identidade .kore-problem-menu button{display:inline-flex!important;flex:0 0 auto!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:center!important;gap:6px!important;width:auto!important;min-width:0!important;height:23px!important;min-height:23px!important;max-height:23px!important;margin:0!important;padding:0 9px!important;border-radius:999px!important;border:1px solid transparent!important;box-shadow:none!important;text-shadow:none!important;font-size:10.5px!important;font-weight:750!important;line-height:1!important;text-align:left!important;white-space:nowrap!important;word-break:keep-all!important;}';

            css += '#kore-identidade .kore-menu-label{display:inline-flex!important;align-items:center!important;white-space:nowrap!important;word-break:keep-all!important;font-size:10.5px!important;font-weight:800!important;line-height:1!important;color:inherit!important;margin:0!important;padding:0!important;}';

            css += '#kore-identidade .kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:18px!important;height:18px!important;border-radius:999px!important;padding:0 5px!important;border:1px solid rgba(15,23,42,.08)!important;background:rgba(255,255,255,.78)!important;font-size:9.5px!important;font-weight:850!important;line-height:1!important;color:inherit!important;margin:0!important;}';

            css += '#kore-identidade .kore-menu-critical{background:#fef2f2!important;border-color:#fecaca!important;color:#b91c1c!important;}';
            css += '#kore-identidade .kore-menu-review{background:#fffbeb!important;border-color:#fde68a!important;color:#b45309!important;}';
            css += '#kore-identidade .kore-menu-neutral{background:#f5f3ff!important;border-color:#ddd6fe!important;color:#6d28d9!important;}';
            css += '#kore-identidade .kore-menu-context{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important;}';
            css += '#kore-identidade .kore-menu-ok{background:#ecfdf5!important;border-color:#bbf7d0!important;color:#166534!important;}';

            css += '#kore-identidade .kore-filtro-ativo{box-shadow:inset 0 0 0 1px rgba(15,23,42,.14)!important;background:#eef2f7!important;border-color:#94a3b8!important;color:#0f172a!important;}';

            css += '#kore-identidade .kore-intervencao-filtros::-webkit-scrollbar,#kore-identidade .kore-problem-menu::-webkit-scrollbar{height:4px!important;}';
            css += '#kore-identidade .kore-intervencao-filtros::-webkit-scrollbar-thumb,#kore-identidade .kore-problem-menu::-webkit-scrollbar-thumb{background:#cbd5e1!important;border-radius:999px!important;}';

            css += '#kore-identidade .kore-panel-body{padding-top:10px!important;}';


            css += '/* v6.3: ajustes cirúrgicos, sem alterar motor bibliográfico */';
            css += '#kore-identidade .kore-acoes a.kore-btn,#kore-identidade .kore-acoes button{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:30px!important;padding:5px 10px!important;border:1px solid #cfd8e3!important;border-radius:2px!important;background:#fff!important;color:#1f2937!important;font-size:11px!important;font-weight:600!important;line-height:1.2!important;text-transform:none!important;box-shadow:none!important;}';
            css += '#kore-identidade .kore-acoes a.kore-btn:hover,#kore-identidade .kore-acoes button:hover{background:#f8fafc!important;border-color:#94a3b8!important;color:#111827!important;}';
            css += '#kore-identidade .kore-aplicar-017{font-weight:600!important;}';
            css += '#kore-identidade .kore-017-aplicado{background:#ecfdf3!important;border-color:#12b76a!important;box-shadow:0 0 0 2px rgba(18,183,106,.16)!important;}';
            css += '#kore-identidade .kmod-icon{width:52px!important;height:52px!important;border-radius:12px!important;font-size:26px!important;margin-bottom:22px!important;}';
            css += '#kore-identidade .kmod-icon .fa{font-size:26px!important;line-height:1!important;}';
            css += '#kore-identidade .kore-table-links{display:flex!important;gap:5px!important;align-items:center!important;justify-content:flex-end!important;flex-wrap:nowrap!important;}';
            css += '#kore-identidade .kore-table-links a.kore-btn{width:25px!important;height:24px!important;min-width:25px!important;max-width:25px!important;padding:0!important;font-size:12px!important;border-radius:2px!important;}';
            css += '#kore-identidade .kore-table-links .kore-link-edit,#kore-identidade .kore-table-links .kore-link-record,#kore-identidade .kore-table-links .kore-link-opac{font-size:12px!important;}';
            css += '#kore-identidade .kore-table-links .kore-link-marc{font-size:10px!important;font-weight:700!important;}';
            css += '#kore-identidade .kore-operational-box{border:0!important;background:transparent!important;box-shadow:none!important;}';
            css += '#kore-identidade .kore-problem-menu,#kore-identidade .kore-intervencao-filtros{border:0!important;border-bottom:1px solid #e5e7eb!important;background:transparent!important;padding:8px 0 10px 0!important;margin:0 0 8px 0!important;gap:8px!important;}';
            css += '#kore-identidade .kore-problem-menu button,#kore-identidade .kore-filtro-intervencao{display:inline-flex!important;align-items:center!important;gap:8px!important;min-height:25px!important;padding:3px 8px!important;border-radius:999px!important;border:1px solid #d8dee6!important;background:#fff!important;color:#1f2937!important;font-size:11px!important;font-weight:600!important;box-shadow:none!important;}';
            css += '#kore-identidade .kore-menu-label{font-size:11px!important;font-weight:600!important;color:inherit!important;}';
            css += '#kore-identidade .kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:20px!important;height:17px!important;padding:0 6px!important;border-radius:999px!important;background:#f8fafc!important;border:1px solid #e5e7eb!important;font-size:10px!important;font-weight:700!important;line-height:1!important;color:inherit!important;}';
            css += '#kore-identidade .kore-menu-critical{background:#fff7f7!important;border-color:#fecaca!important;color:#b42318!important;}';
            css += '#kore-identidade .kore-menu-review{background:#fffbeb!important;border-color:#fedf89!important;color:#92400e!important;}';
            css += '#kore-identidade .kore-menu-context{background:#eff6ff!important;border-color:#bfdbfe!important;color:#1d4ed8!important;}';
            css += '#kore-identidade .kore-menu-ok{background:#ecfdf3!important;border-color:#abefc6!important;color:#05603a!important;}';
            css += '#kore-identidade .kore-menu-neutral{background:#f8fafc!important;border-color:#d8dee6!important;color:#344054!important;}';
            css += '#kore-identidade .kore-filtro-ativo{box-shadow:inset 0 -2px 0 currentColor!important;}';



            /* ==========================================================
               v6.4 refinamento final controlado
               Mantém motor bibliográfico. Apenas corrige desempenho do 017,
               proporção dos ícones e menu/badges discretos.
               ========================================================== */
            css += '#kore-identidade .kore-aplicar-017{font-weight:500!important;text-transform:none!important;letter-spacing:0!important;background:#fff!important;color:#111827!important;border:1px solid #cfd8e3!important;border-radius:2px!important;padding:4px 8px!important;min-height:28px!important;box-shadow:none!important;}';
            css += '#kore-identidade .kore-aplicar-017:hover{background:#f6f8fa!important;border-color:#8c9bab!important;color:#111827!important;}';

            css += '.kore-v45-authid,.kore-v45-score{display:inline-flex!important;align-items:center!important;gap:4px!important;border-radius:999px!important;padding:3px 9px!important;font-size:11px!important;line-height:1.2!important;font-weight:650!important;border:1px solid transparent!important;}';
            css += '.kore-v45-authid{background:#ecfdf3!important;color:#067647!important;border-color:#abefc6!important;}';
            css += '.kore-v45-score-critical{background:#fef3f2!important;color:#b42318!important;border-color:#fecdca!important;}';
            css += '.kore-v45-score-warning{background:#fffaeb!important;color:#b54708!important;border-color:#fedf89!important;}';
            css += '.kore-v45-score-good{background:#ecfdf3!important;color:#05603a!important;border-color:#abefc6!important;}';
            css += '.kore-v45-sep{display:none!important;}';

            css += '.kore-v34-icon{width:88px!important;height:88px!important;min-width:88px!important;border-radius:12px!important;font-size:42px!important;display:flex!important;align-items:center!important;justify-content:center!important;}';
            css += '.kore-v34-icon .fa,.kore-v34-icon i{font-size:42px!important;line-height:1!important;}';
            css += '.kore-v34-kpi{min-height:210px!important;padding:20px 18px!important;}';
            css += '.kore-v34-kpi-title{font-size:15px!important;margin-top:14px!important;}';
            css += '.kore-v34-kpi-value{font-size:42px!important;line-height:1!important;margin:12px 0 14px!important;}';

            css += '.kore-v34-problems,.kore-problem-menu-wrap,.kore-intervencao-filtros{background:transparent!important;border:0!important;box-shadow:none!important;padding:4px 0 9px!important;margin:0!important;}';
            css += '.kore-problem-menu{display:flex!important;gap:18px!important;align-items:center!important;flex-wrap:wrap!important;padding:0!important;border:0!important;background:transparent!important;}';
            css += '.kore-problem-menu button,.kore-filtro-intervencao{display:inline-flex!important;align-items:center!important;gap:7px!important;border:0!important;background:transparent!important;border-radius:999px!important;box-shadow:none!important;padding:4px 5px!important;color:#0f172a!important;font-size:12px!important;font-weight:650!important;text-transform:none!important;min-height:24px!important;}';
            css += '.kore-problem-menu button:hover,.kore-filtro-intervencao:hover{background:#f8fafc!important;color:#111827!important;}';
            css += '.kore-filtro-ativo{background:#f8fafc!important;color:#111827!important;}';
            css += '.kore-menu-label{font-size:12px!important;font-weight:650!important;color:#0f172a!important;}';
            css += '.kore-menu-icon{display:none!important;}';
            css += '.kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:24px!important;height:17px!important;padding:0 7px!important;margin-left:4px!important;border-radius:999px!important;border:1px solid #dbe5f0!important;background:#fff!important;font-size:11px!important;font-weight:650!important;line-height:1!important;}';
            css += '.kore-menu-critical .kore-problem-count,.kore-filtro-intervencao[data-filtro*="Falta $9"] .kore-problem-count{color:#d92d20!important;background:#fff1f3!important;border-color:#ffd2da!important;}';
            css += '.kore-menu-review .kore-problem-count,.kore-filtro-intervencao[data-filtro*="Falta $4"] .kore-problem-count{color:#b54708!important;background:#fff7ed!important;border-color:#fed7aa!important;}';
            css += '.kore-menu-context .kore-problem-count{color:#175cd3!important;background:#eff6ff!important;border-color:#bfdbfe!important;}';
            css += '.kore-menu-ok .kore-problem-count{color:#067647!important;background:#ecfdf3!important;border-color:#abefc6!important;}';
            css += '.kore-menu-neutral .kore-problem-count{color:#6941c6!important;background:#f4f3ff!important;border-color:#d9d6fe!important;}';

            css += '.kore-table-links{display:flex!important;gap:4px!important;align-items:center!important;flex-wrap:nowrap!important;}';
            css += '.kore-table-links a.kore-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:24px!important;height:23px!important;min-width:24px!important;padding:0!important;font-size:11px!important;line-height:1!important;border-radius:2px!important;background:#fff!important;border:1px solid #cfd8e3!important;color:#1f2937!important;box-shadow:none!important;}';
            css += '.kore-table-links a.kore-btn i,.kore-table-links a.kore-btn .fa{font-size:11px!important;line-height:1!important;}';
            css += '.kore-table-links .kore-link-edit i,.kore-table-links .kore-link-edit .fa{font-size:12px!important;}';
            css += '.kore-table-links .kore-link-record i,.kore-table-links .kore-link-record .fa,.kore-table-links .kore-link-opac i,.kore-table-links .kore-link-opac .fa{font-size:11px!important;}';
            css += '.kore-table-links .kore-link-marc{font-size:10.5px!important;font-weight:650!important;}';


            /* ==========================================================
               v6.5 limpeza visual final, motor bibliográfico intacto
               Corrige menu, proporção de ícones, links e leitura da tabela.
               ========================================================== */
            css += '#kore-identidade .kore-operational-head{display:none!important;}';
            css += '#kore-identidade .kore-v34-problems{border:0!important;background:transparent!important;box-shadow:none!important;border-radius:0!important;margin:8px 0 0!important;padding:0!important;overflow:visible!important;}';
            css += '#kore-identidade .kore-problem-menu,#kore-identidade .kore-intervencao-filtros{display:flex!important;flex-wrap:wrap!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important;width:auto!important;max-width:none!important;overflow:visible!important;margin:0 0 10px 0!important;padding:0!important;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;white-space:normal!important;}';
            css += '#kore-identidade .kore-problem-menu button,#kore-identidade .kore-filtro-intervencao{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;height:24px!important;min-height:24px!important;max-height:24px!important;padding:0 9px!important;border-radius:999px!important;border:1px solid transparent!important;box-shadow:none!important;text-shadow:none!important;font-size:11px!important;font-weight:650!important;line-height:1!important;text-transform:none!important;white-space:nowrap!important;background:#f8fafc!important;color:#344054!important;}';
            css += '#kore-identidade .kore-problem-menu button:hover,#kore-identidade .kore-filtro-intervencao:hover{filter:brightness(.985)!important;border-color:rgba(15,23,42,.12)!important;}';
            css += '#kore-identidade .kore-problem-menu button.kore-filtro-ativo,#kore-identidade .kore-filtro-intervencao.kore-filtro-ativo{box-shadow:inset 0 0 0 1px currentColor!important;}';
            css += '#kore-identidade .kore-menu-label{display:inline-flex!important;align-items:center!important;font-size:11px!important;font-weight:700!important;line-height:1!important;margin:0!important;padding:0!important;color:inherit!important;white-space:nowrap!important;}';
            css += '#kore-identidade .kore-problem-count{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:20px!important;height:16px!important;padding:0 6px!important;margin-left:3px!important;border-radius:999px!important;border:1px solid rgba(15,23,42,.09)!important;background:rgba(255,255,255,.8)!important;font-size:10px!important;font-weight:750!important;line-height:1!important;color:inherit!important;}';
            css += '#kore-identidade .kore-menu-critical{background:#fef3f2!important;color:#b42318!important;border-color:#fecdca!important;}';
            css += '#kore-identidade .kore-menu-review{background:#fffaeb!important;color:#b54708!important;border-color:#fedf89!important;}';
            css += '#kore-identidade .kore-menu-neutral{background:#f4f3ff!important;color:#6941c6!important;border-color:#d9d6fe!important;}';
            css += '#kore-identidade .kore-menu-context{background:#eff8ff!important;color:#175cd3!important;border-color:#b2ddff!important;}';
            css += '#kore-identidade .kore-menu-ok{background:#ecfdf3!important;color:#05603a!important;border-color:#abefc6!important;}';

            css += '#kore-identidade .kmod-icon{width:104px!important;height:104px!important;min-width:104px!important;border-radius:22px!important;font-size:52px!important;margin-bottom:18px!important;display:flex!important;align-items:center!important;justify-content:center!important;}';
            css += '#kore-identidade .kmod-icon .fa,#kore-identidade .kmod-icon i{font-size:52px!important;line-height:1!important;}';
            css += '#kore-identidade .kmod-kpi{min-height:250px!important;padding:26px 18px 18px!important;}';
            css += '#kore-identidade .kmod-title{font-size:15px!important;margin-top:8px!important;}';
            css += '#kore-identidade .kmod-value{font-size:42px!important;line-height:1!important;margin:12px 0 14px!important;}';

            css += '#kore-identidade .kore-table td.kore-small-cell:first-child,#kore-identidade .kore-table td.kore-small-cell:first-child a{font-weight:500!important;font-size:13px!important;color:#175cd3!important;text-decoration:none!important;}';
            css += '#kore-identidade .kore-table td.kore-small-cell:first-child a:hover{text-decoration:underline!important;}';
            css += '#kore-identidade .kore-table td.kore-title-cell{font-size:13px!important;font-weight:800!important;line-height:1.25!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-v6-occ-title{font-size:13px!important;font-weight:800!important;line-height:1.25!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-v6-occ-card{border:1px solid #dbe4ef!important;border-radius:6px!important;background:#fff!important;padding:8px!important;box-shadow:none!important;}';
            css += '#kore-identidade .kore-v6-occ-grid{gap:6px!important;display:grid!important;grid-template-columns:repeat(5,minmax(95px,1fr))!important;align-items:stretch!important;}';
            css += '#kore-identidade .kore-v6-occ-box{min-width:0!important;max-width:none!important;flex:auto!important;border:1px solid #e5e7eb!important;border-left-width:3px!important;border-radius:4px!important;padding:7px 8px!important;background:#fcfcfd!important;}';
            css += '#kore-identidade .kore-v6-occ-box strong{display:block!important;font-size:10px!important;font-weight:800!important;letter-spacing:.02em!important;text-transform:uppercase!important;margin-bottom:5px!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-v6-occ-box span,#kore-identidade .kore-v6-occ-box small{display:block!important;font-size:11px!important;line-height:1.35!important;color:#334155!important;}';

            css += '#kore-identidade .kore-action-cell .kore-v6-action{border:1px solid #dbe4ef!important;border-radius:6px!important;background:#fff!important;padding:8px 9px!important;font-size:13px!important;line-height:1.3!important;font-weight:800!important;color:#0f172a!important;}';
            css += '#kore-identidade .kore-action-cell .kore-v6-action small{display:block!important;margin-top:4px!important;font-size:11px!important;font-weight:500!important;line-height:1.35!important;color:#475467!important;}';

            css += '#kore-identidade .kore-table-links{display:flex!important;gap:4px!important;align-items:center!important;justify-content:flex-end!important;flex-wrap:nowrap!important;}';
            css += '#kore-identidade .kore-table-links a.kore-btn,#kore-identidade .kore-table-links a{width:22px!important;height:21px!important;min-width:22px!important;max-width:22px!important;padding:0!important;border-radius:3px!important;border:1px solid #dbe4ef!important;background:#fff!important;color:#1f2937!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;box-shadow:none!important;line-height:1!important;}';
            css += '#kore-identidade .kore-table-links a.kore-btn:hover,#kore-identidade .kore-table-links a:hover{background:#f8fafc!important;border-color:#94a3b8!important;color:#111827!important;}';
            css += '#kore-identidade .kore-table-links a.kore-btn i,#kore-identidade .kore-table-links a.kore-btn .fa,#kore-identidade .kore-table-links .kore-link-icon{font-size:10px!important;line-height:1!important;color:#1f2937!important;}';
            css += '#kore-identidade .kore-table-links .kore-link-edit i,#kore-identidade .kore-table-links .kore-link-edit .fa{font-size:10.5px!important;}';
            css += '#kore-identidade .kore-table-links .kore-link-marc,#kore-identidade .kore-table-links .kore-link-aicon{font-size:9px!important;font-weight:650!important;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;}';


            css += '</style>';

            return css;
        }


        function construirAbaDashboard() {
            var html = "";

            html += '<div class="kore-dashboard-controlbar kore-dashboard-controlbar-minimal">';
            html += '<button type="button" id="kore-dashboard-atualizar" class="kore-load-bib-btn">Carregar bibliográficos</button>';
            html += '<div id="kore-dashboard-progress" class="kore-dashboard-progress kore-fechado"><div class="kore-dashboard-progressbar"><span id="kore-dashboard-progressbar-fill"></span></div></div>';
            html += '<div id="kore-dashboard-progresslabel" class="kore-dashboard-progresslabel">Registos processados: 0 / 0 (0%)</div>';
            html += '</div>';
            html += '<div id="kore-dashboard-status" class="kore-vazio kore-dashboard-statusline">Aguardando carregamento bibliográfico. As contagens permanecem a 0 até iniciar a análise.</div>';
            html += '<div id="kore-dashboard-output"></div>';

            return html;
        }

        function construirAbaIdentificadores() {
            var html = "";

            html += '<div class="kore-linha-pesquisa">';
            html += '<input type="text" id="kore-termo" placeholder="200$b seguido de 200$a">';
            html += '<button type="button" id="kore-pesquisar">Pesquisar</button>';
            html += '<a href="#" target="_blank" rel="noopener" class="kore-btn kore-source-open" id="kore-link-wikidata">Wikidata</a>';
            html += '<a href="#" target="_blank" rel="noopener" class="kore-btn kore-source-open" id="kore-link-viaf">VIAF</a>';
            html += '</div>';

            html += '<div id="kore-estado"></div>';

            html += '<div class="kore-grid-identificadores">';
            html += '<div class="kore-coluna kore-source-panel"><h3>' + koreLogoWikidata() + '</h3><div id="kore-wikidata"></div></div>';
            html += '<div class="kore-coluna kore-source-panel"><h3>' + koreLogoVIAF() + '</h3><div id="kore-viaf"></div></div>';
            html += '</div>';
            html += '<div class="kore-identificadores-footer"><a class="kore-btn kore-source-open kore-create-new" href="https://www.wikidata.org/wiki/Special:NewItem" target="_blank" rel="noopener"><span>Criar registo novo</span></a></div>';

            return html;
        }

        function ativarAba(nome) {
            var $corpo = $("#kore-corpo");
            var $tab = $('.kore-tab[data-tab="' + nome + '"]');
            var painelAberto = !$corpo.hasClass("kore-corpo-fechado");
            var mesmaAbaAtiva = $tab.hasClass("kore-tab-ativa") && $("#kore-tab-" + nome).hasClass("kore-tab-panel-ativo");

            /*
               Comportamento de colapso:
               - Ao entrar, o painel fica fechado.
               - Clicar em Wikidata / VIAF abre essa área.
               - Clicar em Dashboard abre essa área.
               - Clicar novamente na aba ativa fecha o painel.
               Assim, não é necessário um botão adicional de "Painel".
            */
            if (painelAberto && mesmaAbaAtiva) {
                $corpo.addClass("kore-corpo-fechado");
                return;
            }

            $corpo.removeClass("kore-corpo-fechado");
            $(".kore-tab").removeClass("kore-tab-ativa");
            $tab.addClass("kore-tab-ativa");

            $(".kore-tab-panel").removeClass("kore-tab-panel-ativo");
            $("#kore-tab-" + nome).addClass("kore-tab-panel-ativo");
        }

        function atualizarAuthorityState() {
            STATE.authority = obterDadosAutoridade();
            STATE.diagnostics = diagnosticarAutoridade(STATE.authority);
            STATE.score = calcularScore();
        }

        function obterDadosAutoridade() {
            var campo200 = obterCampo200Autoridade();
            var nomeB = obterValorSubcampo(campo200, "Outra parte do nome");
            var nomeA = obterValorSubcampo(campo200, "Palavra de ordem");
            var datas = obterValorSubcampo(campo200, "Datas");
            var nome = limparTexto([nomeB, nomeA].filter(Boolean).join(" "));
            var ids017 = obterIdentificadores017Atuais();

            return {
                authid: obterAuthidAtual(),
                campo200: campo200,
                nomeA: nomeA,
                nomeB: nomeB,
                nome: nome,
                datas: datas,
                ids017: ids017,
                wikidata: ids017.filter(function (id) { return id.tipo === "wikidata"; }),
                viaf: ids017.filter(function (id) { return id.tipo === "viaf"; }),
                variantes400: obterVariantes400Autoridade(),
                relacionadas500: obterRelacionadas500Autoridade()
            };
        }

        function obterCampo200Autoridade() {
            var campo = $();

            $("li").each(function () {
                var li = $(this);
                var texto = limparTexto(li.text());

                if (texto.indexOf("200") !== -1 && texto.indexOf("Palavra de ordem") !== -1) {
                    campo = li;
                    return false;
                }
            });

            return campo;
        }


        function obterVariantes400Autoridade() {
            var variantes = [];
            var vistos = {};

            $("li, div, tr").each(function () {
                var bloco = $(this);
                var texto = limparTexto(bloco.text());

                if (texto.indexOf("400") === -1) return;
                if (
                    texto.indexOf("Palavra de ordem") === -1 &&
                    texto.indexOf("Outra parte do nome") === -1 &&
                    texto.indexOf("Forma variante") === -1 &&
                    texto.indexOf("Ver também") === -1
                ) return;

                var nomeA = obterValorSubcampo(bloco, "Palavra de ordem");
                var nomeB = obterValorSubcampo(bloco, "Outra parte do nome");
                var datas = obterValorSubcampo(bloco, "Datas");

                var formas = [];

                if (nomeB || nomeA) {
                    formas.push(limparTexto([nomeB, nomeA].filter(Boolean).join(" ")));
                    formas.push(limparTexto([nomeA, nomeB].filter(Boolean).join(" ")));
                }

                if (!formas.length) {
                    var bruto = limparTexto(
                        texto
                            .replace(/^.*?\b400\b/, "")
                            .replace(/Palavra de ordem|Outra parte do nome|Datas|Forma variante|Ver também/gi, " ")
                    );
                    if (bruto && bruto.length < 180) formas.push(bruto);
                }

                formas.forEach(function (forma) {
                    forma = limparTexto(forma);
                    if (!forma || forma.length < 3) return;

                    var chave = normalizar(forma);
                    if (!chave || vistos[chave]) return;

                    vistos[chave] = true;
                    variantes.push({
                        forma: forma,
                        nomeA: nomeA || "",
                        nomeB: nomeB || "",
                        datas: datas || ""
                    });
                });
            });

            return variantes;
        }

        function obterRelacionadas500Autoridade() {
            var relacionadas = [];
            var vistos = {};

            $("li, div, tr").each(function () {
                var bloco = $(this);
                var texto = limparTexto(bloco.text());

                if (texto.indexOf("500") === -1) return;
                if (
                    texto.indexOf("Palavra de ordem") === -1 &&
                    texto.indexOf("Outra parte do nome") === -1 &&
                    texto.indexOf("Forma relacionada") === -1 &&
                    texto.indexOf("Ver também") === -1
                ) return;

                var nomeA = obterValorSubcampo(bloco, "Palavra de ordem");
                var nomeB = obterValorSubcampo(bloco, "Outra parte do nome");
                var datas = obterValorSubcampo(bloco, "Datas");
                var relacao5 = obterValorSubcampoPorCodigoAutoridade(bloco, "5") || obterValorSubcampo(bloco, "Código de relação") || obterValorSubcampo(bloco, "Relação");

                var formas = [];

                if (nomeB || nomeA) {
                    formas.push(limparTexto([nomeB, nomeA].filter(Boolean).join(" ")));
                    formas.push(limparTexto([nomeA, nomeB].filter(Boolean).join(" ")));
                }

                if (!formas.length) {
                    var bruto = limparTexto(
                        texto
                            .replace(/^.*?\b500\b/, "")
                            .replace(/Palavra de ordem|Outra parte do nome|Datas|Forma relacionada|Ver também/gi, " ")
                    );
                    if (bruto && bruto.length < 180) formas.push(bruto);
                }

                formas.forEach(function (forma) {
                    forma = limparTexto(forma);
                    if (!forma || forma.length < 3) return;

                    var chave = normalizar(forma);
                    if (!chave || vistos[chave]) return;

                    vistos[chave] = true;
                    relacionadas.push({
                        forma: forma,
                        nomeA: nomeA || "",
                        nomeB: nomeB || "",
                        datas: datas || "",
                        relacao5: relacao5 || ""
                    });
                });
            });

            return relacionadas;
        }

        function construirUniversoIdentitario(authority) {
            var termos = [];

            if (!authority) return termos;

            if (authority.nome) termos.push(authority.nome);
            if (authority.nomeA && authority.nomeB) {
                termos.push(limparTexto(authority.nomeA + " " + authority.nomeB));
                termos.push(limparTexto(authority.nomeB + " " + authority.nomeA));
            }

            (authority.variantes400 || []).forEach(function (v) {
                if (v && v.forma) termos.push(v.forma);
            });

            return removerDuplicados(termos).map(function (termo) {
                return normalizar(termo);
            }).filter(Boolean);
        }

        function analisarEstadoDatas(datas) {
            var d = limparTexto(datas || "");

            if (!d) {
                return {
                    estado: "bad",
                    label: "Datas ausentes",
                    detalhe: "Campo 200$f ausente ou sem datas.",
                    classe: "kore-alert-bad"
                };
            }

            var texto = d
                .replace(/\u2010|\u2011|\u2012|\u2013|\u2014|\u2212/g, "-")
                .replace(/\s+/g, " ")
                .trim();

            var numeros = texto.match(/\d{3,4}/g) || [];
            var intervaloFechado = /\d{3,4}\s*-\s*\d{3,4}/.test(texto);
            var intervaloAbertoDepois = /\d{3,4}\s*-\s*$/.test(texto);
            var intervaloAbertoAntes = /^-\s*\d{3,4}/.test(texto);

            if (intervaloFechado || numeros.length >= 2) {
                return {
                    estado: "ok",
                    label: "Datas completas",
                    detalhe: d,
                    classe: "kore-alert-ok"
                };
            }

            if (intervaloAbertoDepois && numeros.length === 1) {
                return {
                    estado: "warn",
                    label: "Falta data de morte",
                    detalhe: d,
                    classe: "kore-alert-warn"
                };
            }

            if (intervaloAbertoAntes && numeros.length === 1) {
                return {
                    estado: "warn",
                    label: "Falta data de nascimento",
                    detalhe: d,
                    classe: "kore-alert-warn"
                };
            }

            if (numeros.length === 1) {
                return {
                    estado: "warn",
                    label: "Data única",
                    detalhe: d,
                    classe: "kore-alert-warn"
                };
            }

            return {
                estado: "bad",
                label: "Datas não interpretadas",
                detalhe: d,
                classe: "kore-alert-bad"
            };
        }

        function analisarEstadoIdentificadores(authority) {
            var temWikidata = authority && authority.wikidata && authority.wikidata.length;
            var temVIAF = authority && authority.viaf && authority.viaf.length;

            if (temWikidata && temVIAF) {
                return {
                    label: "Wikidata + VIAF",
                    detalhe: "Identificação externa completa.",
                    classe: "kore-alert-ok"
                };
            }

            if (temWikidata || temVIAF) {
                return {
                    label: "Identificação parcial",
                    detalhe: temWikidata ? "Existe Wikidata, falta VIAF." : "Existe VIAF, falta Wikidata.",
                    classe: "kore-alert-warn"
                };
            }

            return {
                label: "Sem identificadores",
                detalhe: "Não foram encontrados Wikidata nem VIAF.",
                classe: "kore-alert-bad"
            };
        }


        function obterValorSubcampo(campo, etiqueta) {
            var valor = "";

            if (!campo.length) return "";

            campo.find("li, div, p, tr").each(function () {
                var linha = $(this);
                var texto = limparTexto(linha.text());

                if (texto.indexOf(etiqueta) !== -1) {
                    var input = linha.find("input[type='text'], textarea").filter(function () {
                        return $(this).is(":visible") && $(this).outerWidth() > 70;
                    }).last();

                    if (input.length) {
                        valor = limparTexto(input.val());
                        return false;
                    }
                }
            });

            return valor;
        }

        function obterValorSubcampoPorCodigoAutoridade(campo, codigo) {
            var valor = "";
            codigo = String(codigo || "").replace(/^\$/, "").toLowerCase();

            if (!campo || !campo.length || !codigo) return "";

            campo.find("input[type='text'], textarea, select").each(function () {
                var el = $(this);
                var id = String(el.attr("id") || "").toLowerCase();
                var name = String(el.attr("name") || "").toLowerCase();
                var cls = String(el.attr("class") || "").toLowerCase();
                var contexto = limparTexto(el.closest("li, div, p, tr").text()).toLowerCase();
                var corresponde =
                    id.indexOf("subfield_" + codigo) !== -1 ||
                    name.indexOf("subfield_" + codigo) !== -1 ||
                    id.match(new RegExp("_" + codigo + "($|_)", "i")) ||
                    name.match(new RegExp("_" + codigo + "($|_)", "i")) ||
                    cls.indexOf("subfield_" + codigo) !== -1 ||
                    contexto.indexOf("$" + codigo) !== -1;

                if (!corresponde) return;

                var v = limparTexto(el.val());
                if (v) {
                    valor = v;
                    return false;
                }
            });

            if (valor) return valor;

            var texto = limparTexto(campo.text());
            var re = new RegExp("\\$" + codigo + "\\s*[:=]?\\s*([^$]+)", "i");
            var m = texto.match(re);
            if (m && m[1]) valor = limparTexto(m[1]);

            return valor;
        }

        function estadoCompletude400(item, authority) {
            var forma = limparTexto(item && item.forma || "");
            var datas = limparTexto(item && item.datas || "");
            var temDatasAutoridade = !!limparTexto(authority && authority.datas || "");
            var problemas = [];

            if (!forma) problemas.push("forma vazia");
            if (temDatasAutoridade && !datas) problemas.push("datas vazias");

            if (!problemas.length) {
                return {
                    estado: "ok",
                    titulo: "400 completo",
                    detalhe: "Forma variante preenchida e coerente com a estrutura mínima da autoridade.",
                    problemas: []
                };
            }

            return {
                estado: "warn",
                titulo: "Completar 400",
                detalhe: "Campo 400 incompleto: " + problemas.join(" · ") + ".",
                problemas: problemas
            };
        }

        function estadoCompletude500(item, authority) {
            var forma = limparTexto(item && item.forma || "");
            var datas = limparTexto(item && item.datas || "");
            var relacao5 = limparTexto(item && item.relacao5 || "");
            var temDatasAutoridade = !!limparTexto(authority && authority.datas || "");
            var problemas = [];

            if (!forma) problemas.push("forma vazia");
            if (temDatasAutoridade && !datas) problemas.push("datas vazias");
            if (!relacao5) problemas.push("$5 vazio");

            if (!problemas.length) {
                return {
                    estado: "ok",
                    titulo: "500 completo",
                    detalhe: "Forma relacionada preenchida e relação qualificada no $5.",
                    problemas: []
                };
            }

            return {
                estado: "warn",
                titulo: "Qualificar 500",
                detalhe: "Campo 500 incompleto: " + problemas.join(" · ") + ".",
                problemas: problemas
            };
        }

        function formatarRelacao5(valor) {
            valor = limparTexto(valor || "");
            if (!valor) return "$5 vazio";

            var mapa = {
                "a": "nome anterior",
                "b": "nome posterior",
                "c": "nome real",
                "d": "pseudónimo",
                "e": "heterónimo",
                "f": "identidade relacionada",
                "g": "forma associada",
                "h": "entidade relacionada"
            };
            var k = valor.toLowerCase();
            return mapa[k] ? (mapa[k] + " [$5 " + valor + "]") : ("$5 " + valor);
        }

        function diagnosticarAutoridade(authority) {
            var issues = [];

            if (!authority.authid) {
                issues.push(issue("critical", "Autoridade sem authid", "A validação bibliográfica completa só fica disponível depois de gravar a autoridade.", "Gravar a autoridade antes de validar relações bibliográficas."));
            }

            if (!authority.nomeA) {
                issues.push(issue("critical", "200$a ausente", "A palavra de ordem não foi identificada.", "Completar o campo 200$a."));
            }

            if (!authority.nomeB) {
                issues.push(issue("review", "200$b ausente", "A outra parte do nome não foi identificada.", "Confirmar a estrutura do nome."));
            }
            if (!authority.wikidata.length) {
                issues.push(issue("review", "Wikidata ausente", "Não foi encontrado QID no campo 017.", "Pesquisar e aplicar QID no 017."));
            }

            if (!authority.viaf.length) {
                issues.push(issue("review", "VIAF ausente", "Não foi encontrado identificador VIAF no campo 017.", "Pesquisar e aplicar VIAF no 017."));
            }

            authority.wikidata.forEach(function (id) {
                if (!/^Q\d+$/i.test(id.valor)) {
                    issues.push(issue("critical", "QID inválido", "O valor " + id.valor + " não tem formato QID válido.", "Corrigir 017$a para um identificador Wikidata do tipo Q123."));
                }
            });

            authority.viaf.forEach(function (id) {
                if (!/^\d+$/.test(id.valor)) {
                    issues.push(issue("critical", "VIAF inválido", "O valor " + id.valor + " não tem formato numérico.", "Corrigir 017$a para o identificador VIAF numérico."));
                }
            });

            if (authority.wikidata.length > 1) {
                issues.push(issue("critical", "Múltiplos QID", "A autoridade tem mais do que um identificador Wikidata real no 017.", "Confirmar identidade e remover identificadores indevidos."));
            }

            if (authority.viaf.length > 1) {
                issues.push(issue("review", "Múltiplos VIAF", "A autoridade tem mais do que um identificador VIAF real no 017.", "Confirmar se todos correspondem à mesma entidade."));
            }

            
            var estadoDatas = analisarEstadoDatas(authority.datas);

            if (estadoDatas.estado === "bad") {
                issues.push(issue("review", estadoDatas.label, estadoDatas.detalhe, "Completar o campo 200$f quando as datas forem conhecidas."));
            } else if (estadoDatas.estado === "warn") {
                issues.push(issue("review", estadoDatas.label, estadoDatas.detalhe, "Confirmar se é possível completar a informação cronológica."));
            }

            if (!authority.variantes400 || !authority.variantes400.length) {
                issues.push(issue("info", "Campo 400 ausente", "A autoridade não apresenta formas variantes registadas.", "Adicionar variantes quando existirem formas alternativas relevantes, pseudónimos ou formas de remissão."));
            }

            (authority.variantes400 || []).forEach(function (v) {
                var estado400 = estadoCompletude400(v, authority);
                if (estado400.estado !== "ok") {
                    issues.push(issue("review", estado400.titulo, estado400.detalhe, "Completar o campo 400 antes de usar a variante como referência de validação."));
                }
            });

            (authority.relacionadas500 || []).forEach(function (v) {
                var estado500 = estadoCompletude500(v, authority);
                if (estado500.estado !== "ok") {
                    issues.push(issue("review", estado500.titulo, estado500.detalhe, "Confirmar a forma relacionada e preencher o $5 para qualificar a relação."));
                }
            });

return issues;
        }

        function issue(severity, title, text, action) {
            return {
                severity: severity,
                title: title,
                text: text,
                action: action
            };
        }

        function calcularScore() {
            var authority = STATE.authority;
            var diagnostics = STATE.diagnostics || [];
            var ocorrencias = STATE.ocorrencias || [];
            var score = 100;

            diagnostics.forEach(function (item) {
                if (item.severity === "critical") score -= 14;
                if (item.severity === "review") score -= 6;
                if (item.severity === "info") score -= 2;
            });

            var imediatas = ocorrencias.filter(function (o) { return o.grupo === "imediata"; }).length;
            var manuais = ocorrencias.filter(function (o) { return o.grupo === "manual"; }).length;

            score -= Math.min(38, imediatas * 4);
            score -= Math.min(22, manuais * 3);

            if (authority && !authority.authid) score -= 20;

            return Math.max(0, Math.min(100, score));
        }

        function estadoScore(score) {
            if (score >= 80) return { label: "Bom", classe: "kore-state-good" };
            if (score >= 55) return { label: "A rever", classe: "kore-state-warning" };
            return { label: "Crítico", classe: "kore-state-critical" };
        }

        
        function obterImagemDashboard() {
            if (STATE.imagemWikidata) return STATE.imagemWikidata;

            var authority = STATE.authority || {};
            var qid = "";

            if (authority.wikidata && authority.wikidata.length) {
                qid = authority.wikidata[0].valor || "";
            }

            if (qid && /^Q\d+$/i.test(qid)) {
                carregarImagemWikidataPorQid(qid);
            }

            return "";
        }


        function obterWikipediaUrlDaEntidade(entidade) {
            var sites = entidade && entidade.sitelinks ? entidade.sitelinks : {};
            var ordem = ["ptwiki", "enwiki", "frwiki", "eswiki"];

            for (var i = 0; i < ordem.length; i++) {
                var sl = sites[ordem[i]];
                if (sl && sl.url) return sl.url;
            }

            return "";
        }

        function carregarImagemWikidataPorQid(qid) {
            qid = String(qid || "").toUpperCase();

            if (!qid || !/^Q\d+$/.test(qid)) return;
            if (STATE.imagemWikidataQid === qid || STATE.imagemWikidataLoading === qid) return;

            STATE.imagemWikidataLoading = qid;

            $.ajax({
                url: "https://www.wikidata.org/wiki/Special:EntityData/" + encodeURIComponent(qid) + ".json",
                method: "GET",
                dataType: "json",
                timeout: 9000
            }).done(function (data) {
                var entidade = data && data.entities ? data.entities[qid] : null;
                var imagem = obterImagemWikidata(entidade);

                if (imagem) {
                    STATE.imagemWikidata = imagem;
                    STATE.imagemWikidataQid = qid;
                    renderDashboard();
                koreV45AjustesFinais();
                
                }
            }).always(function () {
                STATE.imagemWikidataLoading = "";
            });
        }


        function classeChipScore(score) {
            if (score >= 80) return "kore-chip-score-good";
            if (score >= 55) return "kore-chip-score-warning";
            return "kore-chip-score-critical";
        }


        function prioridadePill(prioridade) {
            var classe = "kore-pill-info";
            if (prioridade === "Crítica") classe = "kore-pill-critical";
            if (prioridade === "Revisão" || prioridade === "Atenção" || prioridade === "Média") classe = "kore-pill-review";
            if (prioridade === "OK" || prioridade === "Baixo risco") classe = "kore-pill-info";
            return '<span class="kore-priority-pill ' + classe + '">' + escaparHTML(prioridade || "Informativa") + '</span>';
        }

        function classeLinhaPrioridade(prioridade) {
            if (prioridade === "Crítica") return "kore-row-critical";
            if (prioridade === "Revisão" || prioridade === "Atenção" || prioridade === "Média") return "kore-row-review";
            return "kore-row-info";
        }

        function classeChipScore(score) {
            if (score >= 80) return "kore-chip-score-good";
            if (score >= 55) return "kore-chip-score-warning";
            return "kore-chip-score-critical";
        }

        function renderProblemaCard(qtd, titulo, texto, problema, classe) {
            return '' +
                '<button type="button" class="kore-problem-card ' + escaparHTML(classe || "kore-problem-info") + '" data-problema="' + escaparHTML(problema) + '">' +
                '<strong>' + escaparHTML(qtd) + '</strong>' +
                '<span>' + escaparHTML(titulo) + '</span>' +
                '<small>' + escaparHTML(texto) + '</small>' +
                '</button>';
        }

        function renderResumoOperacional(authority, score, estado, ligado, corrigir, rever, mencoes, tecnicos) {
            var foto = obterImagemDashboard();
            var variantes = authority.variantes400 || [];
            var html = "";

            html += '<div class="kore-operational-hero">';
            html += '<div class="kore-authority-card' + (foto ? '' : ' sem-foto') + '">';

            if (foto) {
                html += '<div class="kore-authority-photo-wrap"><img class="kore-authority-photo" src="' + escaparHTML(foto) + '" alt="' + escaparHTML(authority.nome || "Imagem Wikidata") + '"></div>';
            }

            html += '<div>';
            html += '<div class="kore-authority-title">' + escaparHTML(authority.nome || "Autoridade sem nome identificado") + '</div>';
            html += '<div class="kore-authority-sub">Resumo operacional da autoridade e dos registos bibliográficos associados.</div>';
            html += '<div class="kore-authority-meta">';
            html += '<span class="kore-chip">Authid: ' + escaparHTML(authority.authid || "por gravar") + '</span>';
            html += '<span class="kore-chip ' + classeChipScore(score) + '">Qualidade: ' + score + ' · ' + escaparHTML(estado.label) + '</span>';
            html += '<span class="kore-chip">400: ' + escaparHTML(variantes.length ? variantes.length + " variante(s)" : "sem variantes") + '</span>';
            html += '<span class="kore-chip">Wikidata: ' + escaparHTML(authority.wikidata.length ? authority.wikidata.map(function (i) { return i.valor; }).join(", ") : "0") + '</span>';
            html += '<span class="kore-chip">VIAF: ' + escaparHTML(authority.viaf.length ? authority.viaf.map(function (i) { return i.valor; }).join(", ") : "0") + '</span>';
            html += '</div>';

            html += '<div class="kore-summary-strip">';
            html += '<button type="button" class="kore-summary-tile kore-metric-click" data-filtro="ligados"><strong>' + ligado + '</strong><span>Ligações confirmadas</span></button>';
            html += '<button type="button" class="kore-summary-tile kore-metric-click" data-filtro="imediata"><strong>' + corrigir + '</strong><span>Problemas estruturais</span></button>';
            html += '<button type="button" class="kore-summary-tile kore-metric-click" data-filtro="manual"><strong>' + rever + '</strong><span>A rever</span></button>';
            html += '<button type="button" class="kore-summary-tile kore-metric-click" data-filtro="contexto"><strong>' + mencoes + '</strong><span>Menções</span></button>';
            html += '</div>';

            html += '</div>';
            html += '</div>';
            html += '</div>';

            return html;
        }

        function renderCaixaVariantes400(authority) {
            var variantes = (authority && authority.variantes400) ? authority.variantes400 : [];
            var relacionadas = (authority && authority.relacionadas500) ? authority.relacionadas500 : [];
            var html = "";

            html += '<div class="kore-variants-box">';
            html += '<div class="kore-variants-head">';
            html += '<div><h3>Formas 400/500</h3><p>400 = variantes; 500 = formas relacionadas. Ajudam a distinguir variante, relação e possível erro de ligação.</p></div>';
            html += '<button type="button" id="kore-toggle-variants-box">' + ((variantes.length || relacionadas.length) ? "Ocultar formas" : "Mostrar formas") + '</button>';
            html += '</div>';
            html += '<div class="kore-variants-body' + ((variantes.length || relacionadas.length) ? "" : " kore-fechado") + '" id="kore-variants-body">';

            if (!variantes.length && !relacionadas.length) {
                html += '<div class="kore-vazio">0 formas variantes no campo 400 e 0 formas relacionadas no campo 500.</div>';
            } else {
                html += '<div class="kore-variants-list"><ul>';
                variantes.forEach(function (v) {
                    html += '<li><strong>400</strong> ' + escaparHTML(v.forma || "");
                    if (v.datas) html += ' <span class="kore-variant-muted">(' + escaparHTML(v.datas) + ')</span>';
                    html += '</li>';
                });
                relacionadas.forEach(function (v) {
                    html += '<li><strong>500</strong> ' + escaparHTML(v.forma || "");
                    if (v.datas) html += ' <span class="kore-variant-muted">(' + escaparHTML(v.datas) + ')</span>';
                    html += '</li>';
                });
                html += '</ul></div>';
            }

            html += '</div>';
            html += '</div>';

            return html;
        }

        function renderCaixaCorrigir() {
            var falta9e4 = contarPorProblema("Falta $9 e $4");
            var falta9 = contarPorProblema("Falta $9");
            var falta4 = contarPorProblema("Falta $4");
            var outro = contarPorProblema("Outro authid");

            var total = falta9e4 + falta9 + falta4 + outro;
            var html = "";

            html += '<div class="kore-correction-box">';
            html += '<div class="kore-correction-head">';
            html += '<div><h3>A corrigir</h3><p>Problemas estruturais nos campos 700, 701 e 702. O foco principal é confirmar a ligação por $9 e a função por $4.</p></div>';
            html += '<button type="button" class="kore-filtro-intervencao" data-filtro="imediata">Abrir listagem (' + total + ')</button>';
            html += '</div>';
            html += '<div class="kore-correction-body">';
            html += '<div class="kore-problem-grid">';
            html += renderProblemaCard(falta9e4, "Falta $9 e $4", "Ponto de acesso compatível sem ligação à autoridade nem código de função.", "Falta $9 e $4", "kore-problem-critical");
            html += renderProblemaCard(falta9, "Falta $9", "Existe ponto de acesso compatível, mas sem ligação estrutural à autoridade.", "Falta $9", "kore-problem-critical");
            html += renderProblemaCard(falta4, "Falta $4", "Existe $9 correto, mas falta código de função/responsabilidade.", "Falta $4", "kore-problem-review");
            html += renderProblemaCard(outro, "Outro authid", "O nome parece compatível, mas está ligado a outra autoridade.", "Outro authid", "kore-problem-critical");
            html += '</div>';
            html += '</div>';
            html += '</div>';

            return html;
        }

        function renderCaixasReverMencoes() {
            var responsabilidade = contarPorProblema("Menção de responsabilidade");
            var naoMapeada = contarPorProblema("Menção encontrada fora dos padrões principais");
            var contexto = (STATE.ocorrencias || []).filter(function (o) { return o.grupo === "contexto"; }).length;
            var tecnicos = (STATE.ocorrencias || []).filter(function (o) { return o.grupo === "sem"; }).length;

            var html = "";

            html += '<div class="kore-split-horizontal">';

            html += '<div class="kore-secondary-box">';
            html += '<div class="kore-secondary-head"><div><h3>A rever</h3><p>Casos que podem exigir decisão catalográfica, mas não são necessariamente erro.</p></div></div>';
            html += '<div class="kore-secondary-body">';
            html += '<div class="kore-problem-grid">';
            html += renderProblemaCard(responsabilidade, "200$f sem correspondência clara", "Menção de responsabilidade compatível. Pode justificar 7xx, mas nem sempre é significativo.", "Menção de responsabilidade", "kore-problem-review");
            html += renderProblemaCard(naoMapeada, "Menção não mapeada", "Nome encontrado no MARC fora dos padrões principais de autoria.", "Menção encontrada fora dos padrões principais", "kore-problem-review");
            html += '</div>';
            html += '</div>';
            html += '</div>';

            html += '<div class="kore-secondary-box">';
            html += '<div class="kore-secondary-head"><div><h3>Menções</h3><p>Contexto bibliográfico, assuntos, notas e ocorrências sem correção direta.</p></div></div>';
            html += '<div class="kore-secondary-body">';
            html += renderMapaMencoes();
            html += '<div style="margin-top:8px;">';
            html += '<button type="button" class="kore-filtro-intervencao" data-filtro="contexto">Abrir menções (' + contexto + ')</button> ';
            html += '<button type="button" class="kore-filtro-intervencao" data-filtro="sem">Candidatos técnicos (' + tecnicos + ')</button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';

            html += '</div>';

            return html;
        }


        function miniMetric(numero, titulo, descricao, filtro, classe) {
            var valor = valorOuPorAnalisar(numero);
            var desc = STATE.dashboardExecutada ? descricao : "Por analisar.";

            return '' +
                '<button type="button" class="kore-mini-metric ' + escaparHTML(classe || "") + ' kore-metric-click" data-filtro="' + escaparHTML(filtro || "") + '">' +
                '<div><strong>' + escaparHTML(valor) + '</strong></div>' +
                '<div><span>' + escaparHTML(titulo) + '</span><small>' + escaparHTML(desc) + '</small></div>' +
                '</button>';
        }

        
        function estadoMiniClasse(tipo) {
            if (tipo === "ok") return "kore-alert-mini-ok";
            if (tipo === "warn") return "kore-alert-mini-warn";
            return "kore-alert-mini-bad";
        }

        function estadoDatasMini(authority) {
            var estado = analisarEstadoDatas(authority.datas);

            if (estado.estado === "ok") return { tipo: "ok", texto: "Datas OK" };
            if (estado.label === "Falta data de morte") return { tipo: "warn", texto: "Falta morte" };
            if (estado.label === "Falta data de nascimento") return { tipo: "warn", texto: "Falta nasc." };
            if (estado.estado === "warn") return { tipo: "warn", texto: "Datas parciais" };

            return { tipo: "bad", texto: "Sem datas" };
        }

        function estadoWikidataMini(authority) {
            return authority.wikidata && authority.wikidata.length
                ? { tipo: "ok", texto: "Wikidata OK" }
                : { tipo: "bad", texto: "Sem Wikidata" };
        }

        function estadoVIAFMini(authority) {
            return authority.viaf && authority.viaf.length
                ? { tipo: "ok", texto: "VIAF OK" }
                : { tipo: "warn", texto: "Sem VIAF" };
        }

        function miniAlerta(estado) {
            return '<div class="kore-alert-mini ' + estadoMiniClasse(estado.tipo) + '">' + escaparHTML(estado.texto) + '</div>';
        }

        function totalCorrigirOperacional() {
            return contarPorProblema("Falta $9") + contarPorProblema("Falta $4") + contarPorProblema("Falta $9 e $4");
        }

        function totalReverOperacional() {
            return contarPorProblema("Outro authid") + contarPorProblema("Menção de responsabilidade");
        }

        function totalMencoesOperacional() {
            return STATE.ocorrencias.filter(function (o) { return o.grupo === "contexto"; }).length +
                   STATE.ocorrencias.filter(function (o) { return o.grupo === "sem"; }).length;
        }


        function valorOuPorAnalisar(numero) {
            if (!STATE.dashboardExecutada) return 0;
            return numero || 0;
        }

        function textoEstadoAnalise() {
            return STATE.dashboardExecutada ? "" : "Por analisar. Clique em “Carregar bibliográficos”.";
        }

function renderWorkbenchSuperior(authority, score, estado) {
            var foto = obterImagemDashboard();
            var variantes = authority.variantes400 || [];
            var sem9 = contarPorProblema("Falta $9");
            var sem4 = contarPorProblema("Falta $4");
            var sem9e4 = contarPorProblema("Falta $9 e $4");
            var outroAuth = contarPorProblema("Outro authid");
            var responsabilidade = contarPorProblema("Menção de responsabilidade");
            var contexto = STATE.ocorrencias.filter(function (o) { return o.grupo === "contexto"; }).length;
            var tecnicos = STATE.ocorrencias.filter(function (o) { return o.grupo === "sem"; }).length;
            var ligados = STATE.ocorrencias.filter(function (o) { return o.problema === "Ligação correta"; }).length;
            var naoLigados = sem9 + sem4 + sem9e4 + outroAuth + responsabilidade;

            var totalCorrigir = totalCorrigirOperacional();
            var totalRever = totalReverOperacional();
            var totalMencoes = totalMencoesOperacional();

            var estadoDatas = estadoDatasMini(authority);
            var estadoWD = estadoWikidataMini(authority);
            var estadoVIAF = estadoVIAFMini(authority);

            var html = "";

            html += '<div class="kore-top-workbench">';

            html += '<div class="kore-workbench-card ' + (naoLigados ? 'kore-card-review' : 'kore-card-ok') + '">';
            html += '<div class="kore-workbench-head"><h3>' + escaparHTML(authority.nome || "Autoridade") + '</h3><p>Identidade, identificadores e ligação bibliográfica.</p></div>';
            html += '<div class="kore-workbench-body">';
            html += '<div class="kore-authority-compact">';
            if (foto) {
                html += '<img src="' + escaparHTML(foto) + '" alt="' + escaparHTML(authority.nome || "") + '">';
            }
            html += '<div class="kore-authority-compact-meta">';
            html += '<strong>Authid ' + escaparHTML(authority.authid || "0") + '</strong>';
            html += '<div>Datas: ' + escaparHTML(authority.datas || "sem datas") + '</div>';
            html += '<div>Qualidade: ' + escaparHTML(score + " · " + estado.label) + '</div>';
            html += '<div>Wikidata: ' + escaparHTML(authority.wikidata.length ? authority.wikidata[0].valor : "0") + '</div>';
            html += '<div>VIAF: ' + escaparHTML(authority.viaf.length ? authority.viaf[0].valor : "0") + '</div>';
            html += '<div class="kore-authority-status-line">' + (STATE.dashboardExecutada ? (ligados + ' registo(s) associado(s) · ' + naoLigados + ' problema(s) de ligação/representação') : 'Ligações bibliográficas ainda não analisadas.') + '</div>';
            html += '</div>';
            html += '</div>';
            html += '<div class="kore-authority-alert-mini">';
            html += miniAlerta(estadoDatas);
            html += miniAlerta(estadoWD);
            html += miniAlerta(estadoVIAF);
            html += '</div>';
            html += '</div>';
            html += '</div>';

            html += '<div class="kore-workbench-card kore-card-neutral">';
            html += '<div class="kore-workbench-head"><h3>Variantes</h3><p>Campo 400 e formas de remissão.</p></div>';
            html += '<div class="kore-workbench-body">';
            html += '<div class="kore-workbench-total">' + variantes.length + '<span>formas</span></div>';
            html += '<div class="kore-variant-box-list">';
            if (!variantes.length) {
                html += 'Sem variantes registadas.';
            } else {
                html += '<ul>';
                variantes.slice(0, 14).forEach(function (v) {
                    html += '<li>' + escaparHTML(v.forma || "") + '</li>';
                });
                if (variantes.length > 14) {
                    html += '<li><strong>+' + (variantes.length - 14) + ' variantes</strong></li>';
                }
                html += '</ul>';
            }
            html += '</div>';
            html += '</div>';
            html += '</div>';

            html += '<div class="kore-workbench-card ' + (totalCorrigir ? 'kore-card-critical' : 'kore-card-ok') + '">';
            html += '<div class="kore-workbench-head"><h3>Corrigir</h3><p>Problemas estruturais prioritários.</p></div>';
            html += '<div class="kore-workbench-body">';
            html += '<div class="kore-workbench-total">' + valorOuPorAnalisar(totalCorrigir) + '<span>problemas</span></div>';
            html += miniMetric(sem9, "Sem $9", "Ponto de acesso sem ligação à autoridade.", "problema:Falta $9", "kore-mini-critical");
            html += miniMetric(sem4, "Sem $4", "Código de função ausente.", "problema:Falta $4", "kore-mini-critical");
            html += miniMetric(sem9e4, "Sem $9 e $4", "Sem ligação nem função.", "problema:Falta $9 e $4", "kore-mini-critical");
            html += '</div>';
            html += '</div>';

            html += '<div class="kore-workbench-card ' + (totalRever ? 'kore-card-review' : 'kore-card-ok') + '">';
            html += '<div class="kore-workbench-head"><h3>Rever</h3><p>Casos ambíguos ou divergentes.</p></div>';
            html += '<div class="kore-workbench-body">';
            html += '<div class="kore-workbench-total">' + valorOuPorAnalisar(totalRever) + '<span>casos</span></div>';
            html += miniMetric(outroAuth, "Outro authid", "Ligação a autoridade diferente.", "problema:Outro authid", "kore-mini-review");
            html += miniMetric(responsabilidade, "200$f vs. 7xx", "Comparar menção, ponto de acesso e 400.", "problema:Menção de responsabilidade", "kore-mini-review");
            html += '</div>';
            html += '</div>';

            html += '<div class="kore-workbench-card ' + (totalMencoes ? 'kore-card-context' : 'kore-card-ok') + '">';
            html += '<div class="kore-workbench-head"><h3>Menções</h3><p>Contexto bibliográfico sem correção direta.</p></div>';
            html += '<div class="kore-workbench-body">';
            html += '<div class="kore-workbench-total">' + valorOuPorAnalisar(totalMencoes) + '<span>ocorrências</span></div>';
            html += miniMetric(contexto, "Menções", "Assuntos, notas e texto livre.", "contexto", "kore-mini-context");
            html += miniMetric(tecnicos, "Candidatos", "Recuperados sem confirmação MARC.", "sem", "kore-mini-ok");
            html += '</div>';
            html += '</div>';

            html += '</div>';

            return html;
        }

        
        function kpiSubmetric(numero, titulo, subtitulo, filtro) {
            return '' +
                '<button type="button" class="kore-modern-submetric kore-metric-click" data-filtro="' + escaparHTML(filtro || "") + '">' +
                '<strong>' + escaparHTML(valorOuPorAnalisar ? valorOuPorAnalisar(numero) : numero) + '</strong>' +
                '<span>' + escaparHTML(titulo) + '<small>' + escaparHTML(subtitulo || "") + '</small></span>' +
                '</button>';
        }

        function renderDashboardModerno(authority, score, estado) {
            var foto = obterImagemDashboard();
            var sem9 = contarPorProblema("Falta $9");
            var sem4 = contarPorProblema("Falta $4");
            var sem9e4 = contarPorProblema("Falta $9 e $4");
            var outroAuth = contarPorProblema("Outro authid");
            var responsabilidade = contarPorProblema("Menção de responsabilidade");
            var mencoes = STATE.ocorrencias.filter(function (o) { return o.grupo === "contexto"; }).length;
            var candidatos = STATE.ocorrencias.filter(function (o) { return o.grupo === "sem"; }).length;
            var ligados = STATE.ocorrencias.filter(function (o) { return o.problema === "Ligação correta"; }).length;
            var totalCorrigir = sem9 + sem4 + sem9e4;
            var totalRever = outroAuth + responsabilidade;
            var datasEstado = analisarEstadoDatas(authority.datas);
            var datasClasse = datasEstado.estado === "ok" ? "kmod-ok" : (datasEstado.estado === "warn" ? "kmod-warn" : "kmod-bad");
            var wd = authority.wikidata.length ? authority.wikidata[0].valor : "";
            var viaf = authority.viaf.length ? authority.viaf[0].valor : "";
            var nomeLimpo = authority.nome || "Autoridade";
            var datas = authority.datas || "";
            var scoreClasse = score >= 80 ? "kmod-score-ok" : (score >= 55 ? "kmod-score-warn" : "kmod-score-bad");

            var html = "";

            html += '<div class="kmod-dashboard">';
            html += '<section class="kmod-identity-card">';
            html += '<div class="kmod-photo-wrap">';
            if (foto) {
                html += '<img class="kmod-photo" src="' + escaparHTML(foto) + '" alt="' + escaparHTML(nomeLimpo) + '">';
            } else {
                html += '<div class="kmod-photo kmod-photo-empty"><i class="fa fa-user-o" aria-hidden="true"></i></div>';
            }
            if (wd) {
                var wikiHref = (STATE.wikipediaUrl && STATE.wikipediaUrlQid === String(wd || "").toUpperCase()) ? STATE.wikipediaUrl : "";
                if (wikiHref) {
                    html += '<a class="kmod-wikipedia-link" target="_blank" rel="noopener" href="' + escaparHTML(wikiHref) + '">Wikipedia</a>';
                } else {
                    carregarImagemWikidataPorQid(wd);

                    var termoPesquisaWiki = authority.nome || authority.nomeA || "";
                    var pesquisaWiki = "https://pt.wikipedia.org/w/index.php?search=" + encodeURIComponent(termoPesquisaWiki);

                    html += '<a class="kmod-wikipedia-link kmod-wikipedia-loading" target="_blank" rel="noopener" href="' + escaparHTML(pesquisaWiki) + '">Wikipedia</a>';
                }
            }
            html += '</div>';

            html += '<div class="kmod-identity-main">';
            html += '<div class="kmod-name">' + escaparHTML(nomeLimpo) + '</div>';
            if (datas) html += '<div class="kmod-dates">' + escaparHTML(datas) + '</div>';

            html += '<div class="kmod-badges">';
            html += '<span class="kmod-badge kmod-authid"><strong>AuthId</strong> ' + escaparHTML(authority.authid || "0") + '</span>';
            html += '<span class="kmod-badge ' + scoreClasse + '"><strong>Qualidade</strong> ' + escaparHTML(score + " · " + estado.label) + '</span>';
            html += '</div>';

            html += '<div class="kmod-fieldgrid">';
            html += '<div class="kmod-field"><strong>200$a</strong><span>' + escaparHTML(authority.nomeA || "0") + '</span></div>';
            html += '<div class="kmod-field"><strong>200$b</strong><span>' + escaparHTML(authority.nomeB || "0") + '</span></div>';
            html += '<div class="kmod-field"><strong>Wikidata</strong><span>' + (wd ? '<a target="_blank" rel="noopener" href="https://www.wikidata.org/wiki/' + escaparHTML(wd) + '">' + escaparHTML(wd) + ' ↗</a>' : '0') + '</span></div>';
            html += '<div class="kmod-field"><strong>VIAF</strong><span>' + (viaf ? '<a target="_blank" rel="noopener" href="https://viaf.org/viaf/' + escaparHTML(viaf) + '">' + escaparHTML(viaf) + ' ↗</a>' : '0') + '</span></div>';
            html += '</div>';

            html += '<div class="kmod-alertgrid">';
            html += '<div class="kmod-alert ' + datasClasse + '"><i class="fa fa-calendar-check-o" aria-hidden="true"></i><div><strong>Estado cronológico</strong><span>' + escaparHTML(datasEstado.label) + '</span></div></div>';
            html += '<div class="kmod-alert ' + (wd && viaf ? 'kmod-ok' : 'kmod-warn') + '"><i class="fa fa-check-circle-o" aria-hidden="true"></i><div><strong>Identificadores presentes</strong><span>' + escaparHTML((wd ? 'Wikidata' : 'Sem Wikidata') + ' · ' + (viaf ? 'VIAF' : 'Sem VIAF')) + '</span></div></div>';
            html += '</div>';

            html += '</div>';
            html += '</section>';

            html += '<div class="kmod-kpis">';
            html += kpiV34('kmod-red', 'fa-pencil', 'Corrigir', totalCorrigir, '<span><b>' + valorOuPorAnalisar(sem9) + '</b> Sem $9</span><span><b>' + valorOuPorAnalisar(sem4) + '</b> Sem $4</span>', 'problema:Falta $9');
            html += kpiV34('kmod-orange', 'fa-eye', 'Rever', totalRever, '<span><b>' + valorOuPorAnalisar(outroAuth) + '</b> Outro authId</span><span><b>' + valorOuPorAnalisar(responsabilidade) + '</b> 200$f vs. 7xx</span>', 'problema:Outro authid');
            html += kpiV34('kmod-green', 'fa-link', 'Ligados', ligados, '<span>Ligados à autoridade</span>', 'ligados');
            html += kpiV34('kmod-blue', 'fa-book', 'Contexto', mencoes, '<span>Assuntos, notas, texto livre</span>', 'contexto');
            html += kpiV34('kmod-purple', 'fa-users', 'Candidatos', candidatos, '<span>Sem confirmação MARC</span>', 'sem');
            html += '</div>';
            html += '</div>';

            return html;
        }

        function kpiV34(classe, icone, titulo, valor, detalheHtml, filtro) {
            return '' +
                '<button type="button" class="kore-v34-kpi kmod-kpi kore-metric-click ' + escaparHTML(classe) + '" data-filtro="' + escaparHTML(filtro || 'todos') + '">' +
                '<span class="kmod-icon"><i class="fa ' + escaparHTML(icone || "fa-circle-o") + '" aria-hidden="true"></i></span>' +
                '<span class="kmod-title">' + escaparHTML(titulo) + '</span>' +
                '<span class="kmod-value">' + escaparHTML(valorOuPorAnalisar(valor)) + '</span>' +
                '<span class="kmod-detail">' + detalheHtml + '</span>' +
                '</button>';
        }


function renderDashboard() {
            atualizarAuthorityState();

            var output = $("#kore-dashboard-output");
            var authority = STATE.authority;
            var score = calcularScore();
            STATE.score = score;
            var estado = estadoScore(score);

            var html = "";

            html += renderDashboardModerno(authority, score, estado);
            html += renderAreaIntervencao();

            output.html(html);
            renderTabelaIntervencao();
        }

        function actionCard(valor, titulo, texto, filtro, tipo) {
            return '' +
                '<button type="button" class="kore-action-card kore-action-' + escaparHTML(tipo) + ' kore-metric-click" data-filtro="' + escaparHTML(filtro) + '">' +
                '<span class="kore-action-number">' + escaparHTML(valor) + '</span>' +
                '<span class="kore-action-title">' + escaparHTML(titulo) + '</span>' +
                '<span class="kore-action-text">' + escaparHTML(texto) + '</span>' +
                '</button>';
        }

        function renderEstadoEstruturalOperacional() {
            if (!STATE.ocorrencias.length) {
                return '<div class="kore-vazio">Clique em “Carregar bibliográficos” para construir a lista de trabalho.</div>';
            }

            var ok = STATE.ocorrencias.filter(function (o) { return o.problema === "Ligação correta"; }).length;
            var sem9 = STATE.ocorrencias.filter(function (o) { return o.problema === "Falta $9"; }).length;
            var outro = STATE.ocorrencias.filter(function (o) { return o.problema === "Outro authid"; }).length;
            var f200 = STATE.ocorrencias.filter(function (o) { return o.problema === "Menção de responsabilidade"; }).length;

            var rows = [];
            rows.push(statusRow(ok ? "ok" : "warn", "Registos ligados", ok + " registo(s) com ponto de acesso ligado à autoridade."));
            rows.push(statusRow(sem9 ? "bad" : "ok", "A corrigir", sem9 + " ponto(s) de acesso sem ligação estrutural."));
            rows.push(statusRow(outro ? "bad" : "ok", "Ligação divergente", outro + " ocorrência(s) ligada(s) a outro authid."));
            rows.push(statusRow(f200 ? "warn" : "ok", "Menção em responsabilidade", f200 + " menção(ões) em 200$f a avaliar."));

            return '<div class="kore-status-list">' + rows.join("") + '</div>';
        }

        function renderProximaAcao(imediata, manual, contexto, sem, total) {
            if (!total) {
                return '<div class="kore-vazio">Comece por carregar os bibliográficos para obter registos candidatos.</div>';
            }

            var rows = [];

            if (imediata) {
                rows.push(statusRow("bad", "Começar por intervenção direta", imediata + " registo(s) têm evidência suficiente para correção prioritária."));
            } else if (manual) {
                rows.push(statusRow("warn", "Começar por revisão", manual + " registo(s) exigem validação humana antes de correção."));
            } else if (contexto) {
                rows.push(statusRow("info", "Explorar contexto", contexto + " menção(ões) ajudam a compreender a presença da entidade no catálogo."));
            } else {
                rows.push(statusRow("ok", "Verificar origem", "Não foram encontrados problemas estruturais nesta leitura."));
            }

            rows.push(statusRow("info", "Lista de trabalho", "Use os botões acima ou os filtros da tabela para corrigir por lotes."));

            return '<div class="kore-status-list">' + rows.join("") + '</div>';
        }

        function metricCard(valor, label, help, filtro) {
            var classe = filtro ? " kore-metric-click" : "";
            var data = filtro ? ' data-filtro="' + escaparHTML(filtro) + '"' : "";

            return '' +
                '<button type="button" class="kore-metric-card' + classe + '"' + data + '>' +
                '<span class="kore-metric-value">' + escaparHTML(valor) + '</span>' +
                '<span class="kore-metric-label">' + escaparHTML(label) + '</span>' +
                '<span class="kore-metric-help">' + escaparHTML(help) + '</span>' +
                '</button>';
        }

        function renderEstadoAutoridade(authority) {
            var rows = [];

            rows.push(statusRow(authority.nomeA ? "ok" : "bad", "200$a", authority.nomeA ? authority.nomeA : "Ausente"));
            rows.push(statusRow(authority.nomeB ? "ok" : "warn", "200$b", authority.nomeB ? authority.nomeB : "Ausente ou não identificado"));
            rows.push(statusRow(authority.datas ? "ok" : "warn", "200$f", authority.datas ? authority.datas : "Datas ausentes"));
            rows.push(statusRow(authority.wikidata.length ? "ok" : "warn", "Wikidata", authority.wikidata.length ? authority.wikidata.map(function (i) { return i.valor; }).join(", ") : "Ausente"));
            rows.push(statusRow(authority.viaf.length ? "ok" : "warn", "VIAF", authority.viaf.length ? authority.viaf.map(function (i) { return i.valor; }).join(", ") : "Ausente"));

            return '<div class="kore-status-list">' + rows.join("") + '</div>';
        }

        function renderEstadoBibliografico() {
            if (!STATE.ocorrencias.length) {
                return '<div class="kore-vazio">Ainda não foi feita análise bibliográfica. Clique em “Carregar bibliográficos”.</div>';
            }

            var ok = STATE.ocorrencias.filter(function (o) { return o.problema === "Ligação correta"; }).length;
            var sem9 = STATE.ocorrencias.filter(function (o) { return o.problema === "Falta $9"; }).length;
            var outro = STATE.ocorrencias.filter(function (o) { return o.problema === "Outro authid"; }).length;
            var f200 = STATE.ocorrencias.filter(function (o) { return o.problema === "Menção de responsabilidade"; }).length;
            var an = STATE.ocorrencias.filter(function (o) { return String(o.origemRelacao || "").indexOf("Pesquisa an") !== -1; }).length;

            var rows = [];
            rows.push(statusActionRow(an ? "ok" : "warn", "Registos ligados à autoridade", an + " registo(s) recuperado(s) através da ligação estrutural à autoridade.", "ligados", "", "Ligação correta", "Ver registos ligados"));
            rows.push(statusActionRow(ok ? "ok" : "warn", "7xx com $9 correto", ok + " ponto(s) de acesso estão ligados ao authid esperado.", "ligados", "", "Ligação correta", "Ver ligações corretas"));
            rows.push(statusActionRow(sem9 ? "bad" : "ok", "7xx sem $9", sem9 + " ponto(s) de acesso têm nome compatível, mas ainda não estão ligados à autoridade.", "imediata", "", "Falta $9", "Corrigir estes registos"));
            rows.push(statusActionRow(outro ? "bad" : "ok", "7xx com outro authid", outro + " ocorrência(s) parecem estar ligadas a outra autoridade.", "manual", "", "Outro authid", "Rever ligações"));
            rows.push(statusActionRow(f200 ? "warn" : "ok", "200$f", f200 + " menção(ões) de responsabilidade podem justificar ponto de acesso estruturado.", "manual", "", "Menção de responsabilidade", "Ver menções em 200$f"));

            return '<div class="kore-status-list">' + rows.join("") + '</div>';
        }

        function renderMapaMencoes() {
            if (!STATE.ocorrencias.length) {
                return '<div class="kore-vazio">O mapa será construído depois da análise.</div>';
            }

            var grupos = {};
            STATE.ocorrencias.forEach(function (o) {
                if (o.grupo !== "contexto") return;
                if (!o.natureza) return;
                if (!grupos[o.natureza]) grupos[o.natureza] = 0;
                grupos[o.natureza]++;
            });

            var rows = [];
            Object.keys(grupos).sort().forEach(function (natureza) {
                rows.push(
                    '<button type="button" class="kore-status-row kore-status-row-click kore-contexto-click" data-natureza="' + escaparHTML(natureza) + '">' +
                    '<span class="kore-dot"></span>' +
                    '<span><span class="kore-status-title">' + escaparHTML(natureza) + '</span><span class="kore-status-text">' + grupos[natureza] + ' ocorrência(s). Clicar para abrir a lista.</span></span>' +
                    '</button>'
                );
            });

            if (!rows.length) {
                return '<div class="kore-vazio">0 menções contextuais identificadas.</div>';
            }

            return '<div class="kore-status-list">' + rows.join("") + '</div>';
        }

        function statusRow(tipo, titulo, texto) {
            var cls = "kore-dot";
            if (tipo === "ok") cls += " kore-dot-ok";
            if (tipo === "warn") cls += " kore-dot-warn";
            if (tipo === "bad") cls += " kore-dot-bad";

            return '' +
                '<div class="kore-status-row">' +
                '<span class="' + cls + '"></span>' +
                '<span><span class="kore-status-title">' + escaparHTML(titulo) + '</span><span class="kore-status-text">' + escaparHTML(texto) + '</span></span>' +
                '</div>';
        }

        function statusActionRow(tipo, titulo, texto, filtro, natureza, problema, nota) {
            var cls = "kore-dot";
            if (tipo === "ok") cls += " kore-dot-ok";
            if (tipo === "warn") cls += " kore-dot-warn";
            if (tipo === "bad") cls += " kore-dot-bad";

            return '' +
                '<button type="button" class="kore-status-row kore-status-action" data-filtro="' + escaparHTML(filtro || "todos") + '" data-natureza="' + escaparHTML(natureza || "") + '" data-problema="' + escaparHTML(problema || "") + '">' +
                '<span class="' + cls + '"></span>' +
                '<span><span class="kore-status-title">' + escaparHTML(titulo) + '</span><span class="kore-status-text">' + escaparHTML(texto) + '</span><span class="kore-status-action-note">' + escaparHTML(nota || "Abrir lista") + '</span></span>' +
                '</button>';
        }

        function obterProblemasCriticos() {
            var problemas = [];

            STATE.diagnostics.forEach(function (item) {
                if (item.severity === "critical") problemas.push(item);
            });

            var sem9 = STATE.ocorrencias.filter(function (o) { return o.problema === "Falta $9"; }).length;
            var outro = STATE.ocorrencias.filter(function (o) { return o.problema === "Outro authid"; }).length;

            if (sem9) {
                problemas.push(issue("critical", "Pontos de acesso 7xx sem $9", sem9 + " ocorrência(s) têm nome compatível, mas não estão ligadas à autoridade.", "Abrir os registos e preencher o subcampo $9 com o authid correto, quando aplicável."));
            }

            if (outro) {
                problemas.push(issue("critical", "Pontos de acesso 7xx com outro authid", outro + " ocorrência(s) parecem estar associadas a outra autoridade.", "Confirmar se existe duplicação de autoridade ou ligação indevida."));
            }

            if (!problemas.length) {
                problemas.push(issue("info", "Sem problemas críticos detetados", "Não foram identificados problemas estruturais nos 7xx nesta leitura.", "Manter monitorização."));
            }

            return problemas;
        }

        function renderIssues(lista) {
            return lista.map(function (item) {
                return '' +
                    '<div class="kore-issue">' +
                    '<span class="kore-badge kore-badge-' + escaparHTML(item.severity) + '">' + labelSeverity(item.severity) + '</span>' +
                    '<div class="kore-issue-title">' + escaparHTML(item.title) + '</div>' +
                    '<div class="kore-issue-text">' + escaparHTML(item.text) + '</div>' +
                    '<div class="kore-issue-text"><strong>Ação:</strong> ' + escaparHTML(item.action) + '</div>' +
                    '</div>';
            }).join("");
        }

        function labelSeverity(severity) {
            if (severity === "critical") return "Crítico";
            if (severity === "review") return "Rever";
            return "Informativo";
        }

        
        function countByFiltroOperacional(filtro) {
            if (filtro === "variantes400") return ((STATE.authority && STATE.authority.variantes400) ? STATE.authority.variantes400.length : 0) + ((STATE.authority && STATE.authority.relacionadas500) ? STATE.authority.relacionadas500.length : 0);
            if (!STATE.dashboardExecutada) return 0;

            return (STATE.ocorrencias || []).filter(function (o) {
                if (filtro === "todos") return true;
                if (filtro === "ligados") return o.problema === "Ligação correta";
                if (filtro === "sem") return o.grupo === "sem";
                if (filtro === "contexto") return o.grupo === "contexto";
                if (String(filtro).indexOf("problema:") === 0) {
                    var problemaFiltro = String(filtro).replace("problema:", "");
                    if (problemaFiltro === "Falta $9") return ausencia9(o);
                    if (problemaFiltro === "Falta $4") return ausencia4(o);
                    return o.problema === problemaFiltro;
                }
                return o.grupo === filtro;
            }).length;
        }

        function menuProblemaBotao(filtro, label, classe) {
            var n = Number(countByFiltroOperacional(filtro) || 0);
            if (!isFinite(n) || n < 0) n = 0;

            var ativo = (STATE.filtroIntervencao || "problema:Falta $9") === filtro ? " kore-filtro-ativo" : "";

            return '<button type="button" class="kore-filtro-intervencao ' + escaparHTML(classe || "") + ativo + '" data-filtro="' + escaparHTML(filtro) + '" data-label="' + escaparHTML(label) + '" data-count="' + n + '">' +
                '<span class="kore-menu-label">' + escaparHTML(label) + '</span>' +
                '<span class="kore-problem-count">' + n + '</span>' +
                '</button>';
        }

        function tituloFiltroOperacional(filtro) {
            if (filtro === "problema:Falta $9") return "Sem $9";
            if (filtro === "problema:Falta $4") return "Sem $4";
            if (filtro === "problema:Menção de responsabilidade") return "200$f vs. 7xx";
            if (filtro === "problema:Outro authid") return "Outro authid";
            if (filtro === "problema:Falta $9 e $4") return "Sem $9 e $4";
            if (filtro === "ligados") return "Registos ligados";
            if (filtro === "contexto") return "Menções";
            if (filtro === "sem") return "Não confirmados";
            if (filtro === "variantes400") return "400/500";
            if (filtro === "todos") return "Todos";
            return "Lista operacional";
        }

        function descricaoFiltroOperacional(filtro) {
            if (filtro === "problema:Falta $9") return "Pontos de acesso sem ligação estrutural à autoridade, incluindo os que também não têm $4.";
            if (filtro === "problema:Falta $4") return "Pontos de acesso sem código de função/responsabilidade, incluindo os que também não têm $9.";
            if (filtro === "problema:Menção de responsabilidade") return "Revisão entre 200$f, 7xx e 400, para confirmar variante, ponto de acesso ou entidade distinta.";
            if (filtro === "problema:Outro authid") return "Pontos de acesso compatíveis ligados a outro identificador de autoridade.";
            if (filtro === "problema:Falta $9 e $4") return "Pontos de acesso compatíveis sem ligação à autoridade e sem código de função.";
            if (filtro === "ligados") return "Registos com ligação estrutural confirmada à autoridade.";
            if (filtro === "contexto") return "Menções contextuais sem correção estrutural imediata.";
            if (filtro === "sem") return "Candidatos recuperados pelos índices, mas sem ocorrência MARC confirmada.";
            if (filtro === "variantes400") return "Formas variantes 400 e formas relacionadas 500 da autoridade.";
            if (filtro === "todos") return "Conjunto completo das ocorrências identificadas.";
            return "Selecione um problema para trabalhar a lista.";
        }

        function extrairSegmentoComparacao(texto, prefixo) {
            if (!texto) return "";
            var partes = String(texto).split(" || ");
            var alvo = "";
            var prefixoNorm = String(prefixo || "").toLowerCase();
            $.each(partes, function (i, parte) {
                var p = limparTexto(parte);
                if (p.toLowerCase().indexOf(prefixoNorm) === 0) {
                    alvo = limparTexto(p.substring(String(prefixo || "").length));
                    return false;
                }
            });
            return alvo;
        }

        function obterResumo7xxParaComparacao(obra, nomeNorm) {
            var blocos = (obra && obra._koreBlocos) ? obra._koreBlocos : [];
            var candidatos = [];

            $.each(blocos, function (i, bloco) {
                if (CONFIG.camposAutoria.indexOf(bloco.campo) === -1) return;
                var valor = limparTexto(extrairValorAutoria(bloco) || bloco.texto || "");
                if (!valor) return;
                var authids = extrairAuthidsDoBlocoMARC(bloco);
                var codigos4 = extrairCodigosFuncaoDoBlocoMARC(bloco);
                candidatos.push({
                    campo: bloco.campo,
                    valor: valor,
                    detalhe9: authids.length ? ("$9 " + authids.join(", ")) : "$9 vazio",
                    detalhe4: codigos4.length ? ("$4 " + codigos4.join(", ")) : "$4 vazio",
                    compativel: textoAutoriaCompativel(valor || bloco.texto || "", nomeNorm)
                });
            });

            if (!candidatos.length) return "não foi identificado qualquer ponto de acesso 7xx.";

            var lista = candidatos.filter(function (c) { return c.compativel; });
            if (!lista.length) lista = candidatos;

            return lista.slice(0, 2).map(function (c) {
                return c.campo + ': ' + c.valor + ' [' + c.detalhe9 + ' · ' + c.detalhe4 + ']';
            }).join(' | ');
        }

        function obterLeitura400ParaComparacao(valor200f) {
            var valor = limparTexto(valor200f || "");
            var valorNorm = normalizar(valor);
            var authority = STATE && STATE.authority ? STATE.authority : null;
            var variantes = authority && authority.variantes400 ? authority.variantes400 : [];
            var relacionadas500 = authority && authority.relacionadas500 ? authority.relacionadas500 : [];
            var nomeAutorizado = authority && authority.nome ? authority.nome : "";
            var formasAutorizadas = [];

            if (!valorNorm) {
                return {
                    estado: "sem_valor",
                    resumo: "sem valor comparável",
                    forma: "",
                    acao: "sem acção",
                    detalhe: "Não foi possível isolar uma forma textual no 200$f para comparar com o 400."
                };
            }

            if (nomeAutorizado) formasAutorizadas.push(nomeAutorizado);
            if (authority && authority.nomeA && authority.nomeB) {
                formasAutorizadas.push(limparTexto(authority.nomeB + " " + authority.nomeA));
                formasAutorizadas.push(limparTexto(authority.nomeA + " " + authority.nomeB));
            }

            var matchAutorizado = formasAutorizadas.some(function (forma) {
                var nf = normalizar(forma);
                return nf && (nf === valorNorm || textoAutoriaCompativel(valor, nf));
            });

            if (matchAutorizado) {
                return {
                    estado: "forma_autorizada",
                    resumo: "coincide com a forma autorizada",
                    forma: nomeAutorizado || valor,
                    acao: "não criar 400",
                    detalhe: "A forma do 200$f coincide com a forma autorizada da autoridade. A divergência, se existir, deve ser avaliada sobretudo contra a estrutura 7xx."
                };
            }

            var match400 = null;
            $.each(variantes, function (i, variante) {
                var forma = variante && variante.forma ? variante.forma : "";
                var nf = normalizar(forma);
                if (!nf) return;
                if (nf === valorNorm || textoAutoriaCompativel(valor, nf) || textoAutoriaCompativel(forma, valorNorm)) {
                    match400 = variante;
                    return false;
                }
            });

            if (match400) {
                return {
                    estado: "variante_400_existente",
                    resumo: "variante 400 existente: " + match400.forma,
                    forma: match400.forma,
                    acao: "validar com 400 existente",
                    detalhe: "200$f previsto no 400. Confirmar se o 7xx está corretamente ligado à autoridade principal."
                };
            }

            var match500 = null;
            $.each(relacionadas500, function (i, rel) {
                var forma = rel && rel.forma ? rel.forma : "";
                var nf = normalizar(forma);
                if (!nf) return;
                if (nf === valorNorm || textoAutoriaCompativel(valor, nf) || textoAutoriaCompativel(forma, valorNorm)) {
                    match500 = rel;
                    return false;
                }
            });

            if (match500) {
                return {
                    estado: "relacionada_500_existente",
                    resumo: "forma relacionada 500: " + match500.forma,
                    forma: match500.forma,
                    acao: "rever relação 500",
                    detalhe: "200$f corresponde a uma forma relacionada 500. Não tratar automaticamente como variante 400; confirmar se o 7xx deve apontar para outra autoridade relacionada."
                };
            }

            return {
                estado: "avaliar_400",
                resumo: "sem correspondência no 400",
                forma: valor,
                acao: "avaliar criação de 400",
                detalhe: "200$f sem correspondência na forma autorizada, no 400 ou no 500. Validar se é variante em falta, forma textual, forma relacionada ou entidade distinta."
            };
        }

        function classificarCenario200f(valor200f, resumo7xx, leitura400) {
            var tem7xx = resumo7xx && resumo7xx.indexOf("não foi identificado qualquer ponto de acesso 7xx") === -1;
            var estado400 = leitura400 && leitura400.estado ? leitura400.estado : "avaliar_400";

            if (!tem7xx && estado400 === "forma_autorizada") return "200$f corresponde à forma autorizada, mas não há 7xx compatível";
            if (!tem7xx && estado400 === "variante_400_existente") return "200$f corresponde a variante 400, mas não há 7xx compatível";
            if (!tem7xx && estado400 === "relacionada_500_existente") return "200$f corresponde a forma relacionada 500, sem 7xx compatível";
            if (!tem7xx && estado400 === "avaliar_400") return "200$f sem 7xx compatível e sem variante 400/500";

            if (tem7xx && estado400 === "forma_autorizada") return "200$f compatível com a forma autorizada";
            if (tem7xx && estado400 === "variante_400_existente") return "200$f previsto no 400";
            if (tem7xx && estado400 === "relacionada_500_existente") return "200$f coincide com forma relacionada 500";
            if (tem7xx && estado400 === "avaliar_400") return "200$f divergente, sem 400/500 correspondente";

            return "200$f a validar";
        }


        function formatarResumo7xxEmBlocos(resumo) {
            resumo = limparTexto(resumo || "");
            if (!resumo || resumo.indexOf("não foi identificado") !== -1) {
                return '<span class="kore-occ-empty">sem ponto de acesso compatível identificado</span>';
            }

            var primeiro = resumo.split(" | ")[0];
            var campo = "7xx";
            var valor = primeiro;
            var meta = "";

            var m = primeiro.match(/^(\d{3})\s*:\s*(.*?)(?:\s*\[(.*?)\])?$/);
            if (m) {
                campo = m[1];
                valor = formatarNomeDatas(m[2] || "");
                meta = limparTexto(m[3] || "");
            }

            var authid = "";
            var funcao = "";
            var m9 = meta.match(/\$9\s*([^·\]]+)/i);
            var m4 = meta.match(/\$4\s*([^·\]]+)/i);
            if (m9) authid = limparTexto(m9[1]).replace(/^:/, "");
            if (m4) funcao = limparTexto(m4[1]).replace(/^:/, "");

            var html = '';
            html += '<span class="kore-occ-entity"><span class="kore-occ-field">' + escaparHTML(campo) + '</span><span class="kore-occ-name">' + escaparHTML(valor || "sem forma legível") + '</span></span>';
            html += '<span class="kore-occ-meta-line">' + escaparHTML(authid && authid.toLowerCase() !== "vazio" ? "$9 " + authid : "$9 vazio") + '</span>';
            html += '<span class="kore-occ-meta-line">' + escaparHTML(funcao && funcao.toLowerCase() !== "vazio" ? "$4 " + formatarCodigoFuncao4(funcao, false) : "$4 vazio") + '</span>';
            return html;
        }

        function formatar400Bloco(valor400) {
            valor400 = limparTexto(valor400 || "");
            if (!valor400) return "sem correspondência verificada";
            return valor400.replace(/^coincide/i, "Coincide").replace(/^sem/i, "Sem");
        }

        function formatarNomeDatas(valor) {
            valor = limparValorMARCOperacional(valor || "");
            if (!valor) return "";

            valor = valor
                .replace(/\s*\[.*?\]\s*$/g, "")
                .replace(/\s+/g, " ")
                .trim();

            var m = valor.match(/^(.+?)\s+((?:\d{4}|\?{4}|ca?\.?\s*\d{3,4}|c\.\s*\d{3,4}).*)$/i);
            if (m && m[1].indexOf(",") !== -1) {
                return limparTexto(m[1]) + ". " + limparTexto(m[2]);
            }

            return valor;
        }

        function impactoOperacional(o) {
            if (!o) return "";
            if (o.problema === "Falta $9" || o.problema === "Falta $9 e $4") return "Impacto: autoridade, agregação OPAC e enriquecimento.";
            if (o.problema === "Falta $4") return "Impacto: função/responsabilidade incompleta.";
            if (o.problema === "Outro authid") return "Impacto: possível entidade errada ou duplicada.";
            if (o.problema === "Menção de responsabilidade") return "Impacto: coerência entre menção, 7xx e autoridade.";
            if (o.problema === "Menção contextual") return "Impacto: contexto informativo, sem correção imediata.";
            if (o.problema === "Ligação correta") return "Impacto: estrutura validada.";
            return "";
        }

        function formatarOcorrenciaTabela(o) {
            var principal = limparValorMARCOperacional(o.valorEncontrado || "") || "Sem detalhe";
            var secundarios = [];

            if (o.problema === "Menção de responsabilidade") {
                var f200 = formatarNomeDatas(extrairSegmentoComparacao(principal, '200$f:'));
                var v7xx = extrairSegmentoComparacao(principal, '7xx:');
                var v400 = formatar400Bloco(limparValorMARCOperacional(extrairSegmentoComparacao(principal, '400:')));
                var leitura400 = obterLeitura400ParaComparacao(f200);
                var cenario = limparValorMARCOperacional(extrairSegmentoComparacao(principal, 'Cenário:'));
                var mostrarLeitura = cenario && !/compat[ií]vel com a forma autorizada/i.test(cenario);
                var html = '';
                html += '<span class="kore-occ-block"><span class="kore-occ-label">200$f</span><span class="kore-occ-value">' + escaparHTML(f200 || principal) + '</span></span>';
                html += '<span class="kore-occ-block"><span class="kore-occ-label">7xx</span>' + formatarResumo7xxEmBlocos(v7xx) + '</span>';
                html += '<span class="kore-occ-block"><span class="kore-occ-label">400</span><span class="kore-occ-value">' + escaparHTML(v400 || 'Sem correspondência verificada') + '</span></span>';
                if (leitura400 && leitura400.estado === 'relacionada_500_existente') {
                    html += '<span class="kore-occ-block"><span class="kore-occ-label">500</span><span class="kore-occ-value">' + escaparHTML(formatarNomeDatas(leitura400.forma || 'Forma relacionada existente')) + '</span></span>';
                }
                if (mostrarLeitura) html += '<span class="kore-occ-block kore-occ-reading"><span class="kore-occ-label">Diagnóstico</span><span class="kore-occ-value">' + escaparHTML(cenario) + '</span></span>';
                return html;
            }

            var tem9 = o.authidEncontrado && String(o.authidEncontrado) !== "0";
            var tem4 = codigo4Valido(o.codigoFuncao);
            var valorPrincipal = formatarNomeDatas(principal);

            secundarios.push(tem9 ? ('$9: ' + o.authidEncontrado) : '$9 vazio');
            secundarios.push(tem4 ? ('$4: ' + formatarCodigoFuncao4(o.codigoFuncao, false)) : '$4 vazio');

            return '<span class="kore-occ-main">' + escaparHTML(valorPrincipal) + '</span>' +
                '<span class="kore-occ-sub">' + secundarios.map(function(s){return escaparHTML(s);}).join('<br>') + '</span>';
        }

        function formatarAcaoTabela(o) {
            var titulo = o.acaoCurta || 'Analisar';
            var detalhe = o.acaoDetalhada || '';
            var authidEsperado = o.authidEsperado || '0';
            var authidEncontrado = o.authidEncontrado || '0';
            var campo = String(o.campo || '7xx').replace(/\$9|\$4/g, '');

            if (o.problema === 'Falta $9') {
                titulo = 'Ligar autoridade';
                detalhe = campo + ' compatível. Preencher $9 com o authid ' + authidEsperado + '.';
            } else if (o.problema === 'Falta $4') {
                titulo = 'Completar função';
                detalhe = 'Ligação presente. Confirmar função e preencher $4.';
            } else if (o.problema === 'Falta $9 e $4') {
                titulo = 'Ligar e completar função';
                detalhe = campo + ' compatível. Preencher $9 com ' + authidEsperado + ' e completar $4.';
            } else if (o.problema === 'Outro authid') {
                titulo = 'Rever entidade ligada';
                detalhe = 'Encontrado authid ' + authidEncontrado + '; esperado ' + authidEsperado + '. Confirmar duplicação ou ligação errada.';
            } else if (o.problema === 'Menção de responsabilidade') {
                var f200 = formatarNomeDatas(extrairSegmentoComparacao(o.valorEncontrado || '', '200$f:'));
                var v7xx = limparValorMARCOperacional(extrairSegmentoComparacao(o.valorEncontrado || '', '7xx:'));
                var leitura400 = obterLeitura400ParaComparacao(f200);
                var sem7xx = !v7xx || v7xx.indexOf('não foi identificado qualquer ponto de acesso 7xx') !== -1;

                if (leitura400.estado === 'relacionada_500_existente' && sem7xx) {
                    titulo = 'Rever autoridade relacionada';
                    detalhe = '200$f coincide com 500. Confirmar se deve existir 7xx para autoridade relacionada.';
                } else if (leitura400.estado === 'relacionada_500_existente') {
                    titulo = 'Rever relação 500';
                    detalhe = '200$f coincide com forma relacionada. Validar se o 7xx aponta para a entidade correta.';
                } else if (leitura400.estado === 'variante_400_existente' && sem7xx) {
                    titulo = 'Criar ou corrigir 7xx';
                    detalhe = '200$f previsto no 400. Confirmar ponto de acesso ligado ao authid ' + authidEsperado + '.';
                } else if (leitura400.estado === 'variante_400_existente') {
                    titulo = 'Validar variante 400';
                    detalhe = '200$f corresponde a variante registada. Confirmar se o 7xx está correto.';
                } else if (leitura400.estado === 'forma_autorizada' && sem7xx) {
                    titulo = 'Criar 7xx';
                    detalhe = '200$f coincide com a autoridade, mas falta 7xx compatível.';
                } else if (leitura400.estado === 'forma_autorizada') {
                    titulo = 'Validar 7xx';
                    detalhe = '200$f compatível. Confirmar ponto de acesso e função.';
                } else if (sem7xx) {
                    titulo = 'Avaliar 7xx e 400';
                    detalhe = 'Sem 7xx compatível nem 400/500 correspondente. Confirmar ponto de acesso, variante ou entidade distinta.';
                } else {
                    titulo = 'Avaliar variante ou entidade';
                    detalhe = '200$f divergente. Confirmar se falta 400 ou se há entidade diferente.';
                }
            } else if (o.problema === 'Menção contextual') {
                titulo = 'Menção contextual';
                detalhe = 'Sem impacto estrutural imediato.';
            } else if (o.problema === 'Ligação correta') {
                titulo = 'Sem intervenção';
                detalhe = 'Ponto de acesso ligado à autoridade esperada.';
            } else if (o.problema === 'Sem menção identificada') {
                titulo = 'Sem evidência MARC';
                detalhe = 'Registo recuperado pela pesquisa, mas sem ocorrência confirmada.';
            }

            var impacto = impactoOperacional(o);
            if (impacto) detalhe += ' ' + impacto;

            return { titulo: titulo, detalhe: detalhe };
        }


        function formatarDiagnosticoTabela(o) {
            var esperado = limparTexto(o.authidEsperado || "0");
            var encontrado = limparTexto(o.authidEncontrado || "0");
            var funcao = limparTexto(o.codigoFuncao || "0");
            var origem = limparTexto(traduzirOrigemRelacao(o.origemRelacao || ""));
            var confianca = limparTexto(o.confianca || "");
            var linhas = [];

            if (esperado && esperado !== "0") linhas.push("Esperado: " + esperado);
            if (encontrado && encontrado !== "0") linhas.push("Encontrado: " + encontrado);
            else if (ausencia9(o)) linhas.push("$9 vazio");
            if (codigo4Valido(funcao)) linhas.push("$4: " + formatarCodigoFuncao4(funcao, true));
            else if (ausencia4(o)) linhas.push("$4 vazio");

            var topo = linhas.length ? linhas.join(" · ") : "Sem anomalia estrutural";
            var baixo = [];
            if (origem) baixo.push(origem);
            if (confianca) baixo.push("Confiança: " + confianca);

            return '<span class="kore-diagnostico"><span class="kore-diagnostico-main">' + escaparHTML(topo) + '</span>' +
                (baixo.length ? '<span class="kore-diagnostico-sub">' + escaparHTML(baixo.join(" · ")) + '</span>' : '') + '</span>';
        }

function renderAreaIntervencao() {
            var html = "";

            html += '<div class="kore-v34-problems" id="kore-area-intervencao">';
            html += '<div class="kore-operational-head">';
            html += '<div>';
            html += '<h3>Lista operacional de correção</h3>';
            html += '<p>Selecione uma categoria para trabalhar registo a registo.</p>';
            html += '</div>';
            html += '</div>';
            html += '<div class="kore-problem-menu" role="tablist" aria-label="Filtros operacionais KORE">';
            html += menuProblemaBotao("problema:Falta $9", "Sem $9", "kore-menu-critical");
            html += menuProblemaBotao("problema:Falta $4", "Sem $4", "kore-menu-critical");
            html += menuProblemaBotao("problema:Outro authid", "Outro authid", "kore-menu-review");
            html += menuProblemaBotao("problema:Menção de responsabilidade", "200$f vs. 7xx", "kore-menu-review");
            html += menuProblemaBotao("contexto", "Menções", "kore-menu-context");
            html += menuProblemaBotao("sem", "Candidatos", "kore-menu-context");
            html += menuProblemaBotao("ligados", "Ligados", "kore-menu-ok");
            html += menuProblemaBotao("variantes400", "400/500", "kore-menu-ok");
            html += menuProblemaBotao("todos", "Todos", "kore-menu-neutral");
            html += '</div>';
            html += '</div>';

            html += '<div class="kore-v34-alert" id="kore-lista-alerta">ⓘ <span id="kore-tabela-contexto">Selecione um problema para trabalhar registo a registo.</span></div>';
            html += '<div class="kore-table-wrap kore-table-scroll">';
            html += '<table class="kore-table">';
            html += '<thead><tr>';
            html += '<th>Bib#</th><th>Título</th><th>Campo</th><th>Natureza</th><th>Ocorrência encontrada</th><th>Prioridade</th><th>Diagnóstico</th><th>Ação</th><th>Ligações</th>';
            html += '</tr></thead>';
            html += '<tbody id="kore-tabela-intervencao"></tbody>';
            html += '</table>';
            html += '</div>';
            html += '<div class="kore-table-footer"><span id="kore-tabela-resumo" class="kore-status-text"></span></div>';
            return html;
        }

        function renderTabelaIntervencao() {
            var filtro = STATE.filtroIntervencao || "problema:Falta $9";
            var contextoSelecionado = STATE.contextoSelecionado || "";

            var lista = STATE.ocorrencias.filter(function (o) {
                if (filtro === "todos") return true;
                if (filtro === "ligados") return o.problema === "Ligação correta";
                if (filtro === "imediata") return ["Falta $9 e $4", "Falta $9", "Falta $4", "Outro authid"].indexOf(o.problema) !== -1;
                if (filtro === "manual") return o.grupo === "manual";
                if (filtro === "sem") return o.grupo === "sem";
                if (filtro.indexOf("problema:") === 0) {
                    var problemaFiltro = filtro.replace("problema:", "");
                    if (problemaFiltro === "Falta $9") return ausencia9(o);
                    if (problemaFiltro === "Falta $4") return ausencia4(o);
                    return o.problema === problemaFiltro;
                }
                if (filtro === "contexto" && contextoSelecionado) return o.grupo === "contexto" && o.natureza === contextoSelecionado;
                if (filtro === "contexto") return o.grupo === "contexto";
                return o.grupo === filtro;
            });

            STATE.limiteIntervencao = 999999;
            var visiveis = lista.slice(0, STATE.limiteIntervencao);
            var html = "";

            if (filtro === "variantes400") {
                var variantes = (STATE.authority && STATE.authority.variantes400) ? STATE.authority.variantes400 : [];
                var relacionadas = (STATE.authority && STATE.authority.relacionadas500) ? STATE.authority.relacionadas500 : [];
                var listaFormas = [];
                variantes.forEach(function(v){ listaFormas.push({campo:"400", natureza:"Forma variante", item:v}); });
                relacionadas.forEach(function(v){ listaFormas.push({campo:"500", natureza:"Forma relacionada", item:v}); });

                if (!listaFormas.length) {
                    html += '<tr><td colspan="9" class="kore-vazio">0 formas variantes 400 e 0 formas relacionadas 500.</td></tr>';
                } else {
                    listaFormas.forEach(function (linha) {
                        var v = linha.item || {};
                        html += '<tr class="kore-row-info">';
                        html += '<td class="kore-small-cell">' + escaparHTML(STATE.authority.authid || "0") + '</td>';
                        html += '<td class="kore-title-cell">' + escaparHTML(STATE.authority.nome || "Autoridade") + '</td>';
                        html += '<td class="kore-small-cell"><span class="kore-marc-chip">' + escaparHTML(linha.campo) + '</span></td>';
                        html += '<td>' + escaparHTML(linha.natureza) + '</td>';
                        var forma = formatarNomeDatas(limparValorMARCOperacional(v.forma || ""));
                        var estadoForma = linha.campo === "500" ? estadoCompletude500(v, STATE.authority || {}) : estadoCompletude400(v, STATE.authority || {});
                        var sublinhas = [];
                        if (linha.campo === "500") sublinhas.push(formatarRelacao5(v.relacao5));
                        sublinhas.push(v.datas ? ("Datas: " + v.datas) : "Sem datas");
                        html += '<td><span class="kore-occ-main">' + escaparHTML(forma || "") + '</span><span class="kore-occ-sub">' + escaparHTML(sublinhas.join(" · ")) + '</span></td>';
                        html += '<td>' + prioridadePill(estadoForma.estado === "ok" ? "Informativa" : "Revisão") + '</td>';
                        html += '<td><span class="kore-diagnostico"><span class="kore-diagnostico-main">' + escaparHTML(estadoForma.titulo) + '</span><span class="kore-diagnostico-sub">' + escaparHTML(estadoForma.detalhe) + '</span></span></td>';
                        html += '<td class="kore-action-cell"><strong>' + escaparHTML(estadoForma.estado === "ok" ? (linha.campo === "500" ? "Relação qualificada" : "Variante completa") : estadoForma.titulo) + '</strong><div class="kore-action-detail">' + escaparHTML(linha.campo === "500" ? (estadoForma.estado === "ok" ? "500 preenchido e qualificado. Usar como relação entre entidades, não como variante 400." : "Completar a relação 500. O $5 deve qualificar a natureza da relação entre autoridades.") : (estadoForma.estado === "ok" ? "400 utilizável na deteção de variantes e menções bibliográficas." : "Completar o 400 antes de o usar como variante segura.")) + '</div></td>';
                        html += '<td class="kore-table-links">0</td>';
                        html += '</tr>';
                    });
                }
                $("#kore-tabela-intervencao").html(html);
                $("#kore-tabela-contexto").text(variantes.length + " forma(s) variante(s) 400 e " + relacionadas.length + " forma(s) relacionada(s) 500.");
                $("#kore-tabela-resumo").text("Mostrando " + listaFormas.length + " forma(s).");
                return;
            }

            if (!visiveis.length) {
                html += '<tr><td colspan="9" class="kore-vazio">0 ocorrências nesta categoria. Clique em “Carregar bibliográficos” no topo do dashboard para iniciar o motor bibliográfico.</td></tr>';
            } else {
                visiveis.forEach(function (o) {
                    var links = o.links || {};
                    var acao = formatarAcaoTabela(o);
                    html += '<tr class="' + classeLinhaPrioridade(o.prioridade) + '">';
                    html += '<td class="kore-small-cell"><a class="kore-v34-link" href="' + escaparHTML(links.detalhe || '#') + '" target="_blank" rel="noopener">' + escaparHTML(o.biblionumber) + '</a></td>';
                    html += '<td class="kore-title-cell">' + escaparHTML(o.titulo) + '</td>';
                    html += '<td class="kore-small-cell"><span class="kore-marc-chip">' + escaparHTML(o.campo || "0") + '</span></td>';
                    html += '<td>' + escaparHTML(o.natureza || "") + '</td>';
                    html += '<td>' + formatarOcorrenciaTabela(o) + '</td>';
                    html += '<td>' + prioridadePill(prioridadeOperacional) + '</td>';
                    html += '<td>' + formatarDiagnosticoTabela(o) + '</td>';
                    html += '<td class="kore-action-cell"><strong>' + escaparHTML(acao.titulo || "Analisar") + '</strong><div class="kore-action-detail">' + escaparHTML(acao.detalhe || "") + '</div></td>';
                    html += '<td><div class="kore-table-links">';
                    html += '<a class="kore-btn kore-link-edit" title="Editar registo bibliográfico" href="' + escaparHTML(links.editar || links.detalhe || '#') + '" target="_blank" rel="noopener"><i class="fa fa-pencil kore-link-icon" aria-hidden="true"></i></a>';
                    html += '<a class="kore-btn kore-link-record" title="Ver registo" href="' + escaparHTML(links.detalhe || '#') + '" target="_blank" rel="noopener"><i class="fa fa-file-text-o kore-link-icon" aria-hidden="true"></i></a>';
                    html += '<a class="kore-btn kore-link-marc" title="Ver MARC" href="' + escaparHTML(links.marc || '#') + '" target="_blank" rel="noopener"><span class="kore-link-aicon">$a</span></a>';
                    html += '<a class="kore-btn kore-link-opac" title="Abrir no OPAC" href="' + escaparHTML(links.opac || '#') + '" target="_blank" rel="noopener"><i class="fa fa-globe kore-link-icon" aria-hidden="true"></i></a>';
                    html += '</div></td>';
                    html += '</tr>';
                });
            }

            $("#kore-tabela-intervencao").html(html);
            $("#kore-tabela-resumo").text("Mostrando " + (visiveis.length ? "1 a " + visiveis.length : "0") + " de " + lista.length + " registo(s).");
            $("#kore-lista-titulo").text(tituloFiltroOperacional(filtro));
            $("#kore-lista-descricao").text(descricaoFiltroOperacional(filtro));
            $(".kore-filtro-intervencao").removeClass("kore-filtro-ativo");
            $(".kore-filtro-intervencao").filter(function(){ return $(this).data("filtro") === filtro; }).addClass("kore-filtro-ativo");
            var legenda = legendaFiltroOperacional(filtro, contextoSelecionado, lista.length);
            $("#kore-tabela-contexto").text(legenda);
        }

        function traduzirOrigemRelacao(origem) {
            if (!origem) return "";
            return String(origem)
                .replace(/Pesquisa an/g, "Ligação à autoridade")
                .replace(/Pesquisa autor/g, "Pesquisa por autor")
                .replace(/Pesquisa livre/g, "Pesquisa livre");
        }

        function legendaFiltroOperacional(filtro, contextoSelecionado, total) {
            if (filtro === "imediata") return total + " problema(s) estrutural(is) nos campos 700/701/702, com foco em $9 e $4.";
            if (filtro === "manual") return total + " ocorrência(s) para revisão catalográfica antes de qualquer correção.";
            if (filtro.indexOf("problema:") === 0) return total + " ocorrência(s) de “" + filtro.replace("problema:", "") + "”.";
            if (filtro === "contexto" && contextoSelecionado) return total + " ocorrência(s) em “" + contextoSelecionado + "”.";
            if (filtro === "contexto") return total + " menção(ões) contextuais para exploração.";
            if (filtro === "ligados") return total + " registo(s) com ligação estrutural confirmada por $9 e função $4 presente.";
            if (filtro === "sem") return total + " candidato(s) técnico(s): recuperados pelos índices, mas sem ocorrência MARC confirmada.";
            return total + " ocorrência(s) no conjunto selecionado.";
        }

        function classePrioridade(prioridade) {
            if (prioridade === "Crítica") return "kore-priority-critical";
            if (prioridade === "Revisão") return "kore-priority-review";
            return "kore-priority-info";
        }

        function obterIdentificadores017Atuais() {
            var identificadores = [];
            var vistos = {};
            var campos017 = encontrarCampos017ParaAplicacao();

            $.each(campos017, function (i, campo) {
                var valorA = campo.campoA.length ? limparTexto(campo.campoA.val()) : "";
                var valor2 = campo.campo2.length ? limparTexto(campo.campo2.val()).toLowerCase() : "";

                if (!valorA && !valor2) return;

                var chave = valorA + "|" + valor2;

                if (vistos[chave]) return;
                vistos[chave] = true;

                identificadores.push({
                    valor: valorA,
                    fonte: valor2,
                    tipo: classificarIdentificador017(valorA, valor2)
                });
            });

            return identificadores;
        }

        function encontrarCampos017ParaAplicacao() {
            var campos = [];
            var vistos = {};

            $("li, div, tr").each(function () {
                var bloco = $(this);
                var texto = limparTexto(bloco.text());

                if (texto.indexOf("017") === -1) return;
                if (texto.indexOf("Identificador") === -1) return;
                if (texto.indexOf("Sistema de codificação") === -1) return;

                var campoA = encontrarCampoPorEtiquetaRobusto(bloco, "Identificador");
                var campo2 = encontrarCampoPorEtiquetaRobusto(bloco, "Sistema de codificação");

                if (!campoA.length || !campo2.length) return;

                var idA = campoA.attr("id") || campoA.attr("name") || "";
                var id2 = campo2.attr("id") || campo2.attr("name") || "";
                var chave = idA + "|" + id2;

                if (!chave || vistos[chave]) return;
                vistos[chave] = true;

                var indicador1 = encontrarIndicador017Robusto(bloco);

                campos.push({
                    bloco: bloco,
                    campoA: campoA,
                    campo2: campo2,
                    indicador1: indicador1
                });
            });

            return campos;
        }

        function encontrarCampoPorEtiquetaRobusto(bloco, etiqueta) {
            var resultado = $();

            bloco.find("label").each(function () {
                var label = $(this);
                var texto = limparTexto(label.text());

                if (texto.indexOf(etiqueta) === -1) return;

                var idCampo = label.attr("for");

                if (idCampo && $("#" + escaparSelector(idCampo)).length) {
                    resultado = $("#" + escaparSelector(idCampo));
                    return false;
                }

                var linha = label.closest("li, div, tr, p");

                var input = linha.find("input[type='text'], textarea").filter(function () {
                    var valor = limparTexto($(this).val());
                    var largura = $(this).outerWidth();

                    return largura > 100 && valor !== "a" && valor !== "2" && valor !== "017";
                }).first();

                if (input.length) {
                    resultado = input;
                    return false;
                }
            });

            return resultado;
        }

        function encontrarIndicador017Robusto(bloco) {
            var indicador = $();

            bloco.find("input[type='text']").each(function () {
                var input = $(this);
                var valor = limparTexto(input.val());
                var largura = input.outerWidth();

                if (largura <= 45 && (valor === "" || valor === "7" || valor.length === 1)) {
                    indicador = input;
                    return false;
                }
            });

            return indicador;
        }

        function classificarIdentificador017(valor, fonte) {
            var v = String(valor || "").trim();
            var f = String(fonte || "").toLowerCase();

            if (/^Q\d+$/i.test(v) || f.indexOf("wikidata") !== -1) return "wikidata";
            if (/^\d+$/.test(v) && f.indexOf("viaf") !== -1) return "viaf";

            return "outro";
        }

        function aplicarNoCampo017(valor, fonte) {
            valor = limparTexto(valor);
            fonte = limparTexto(fonte).toLowerCase();

            if (!valor || !fonte) {
                $("#kore-estado").text("Não foi possível aplicar o identificador: valor ou fonte em falta.");
                return;
            }

            function escrever($campo, novoValor) {
                if (!$campo || !$campo.length) return;
                var el = $campo.get(0);
                try {
                    var proto = Object.getPrototypeOf(el);
                    var desc = proto && Object.getOwnPropertyDescriptor(proto, "value");
                    if (desc && desc.set) desc.set.call(el, novoValor);
                    else el.value = novoValor;
                } catch (e) {
                    el.value = novoValor;
                }
                $campo.val(novoValor);
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
            }

            var campos = encontrarCampos017ParaAplicacao();
            var escolhido = null;

            $.each(campos, function (i, campo) {
                var valorA = campo.campoA.length ? limparTexto(campo.campoA.val()) : "";
                var valor2 = campo.campo2.length ? limparTexto(campo.campo2.val()).toLowerCase() : "";

                if (valorA === valor && valor2 === fonte) {
                    escolhido = campo;
                    return false;
                }
            });

            if (!escolhido) {
                $.each(campos, function (i, campo) {
                    var valorA = campo.campoA.length ? limparTexto(campo.campoA.val()) : "";
                    var valor2 = campo.campo2.length ? limparTexto(campo.campo2.val()).toLowerCase() : "";

                    if (!valorA && !valor2) {
                        escolhido = campo;
                        return false;
                    }
                });
            }

            if (!escolhido) {
                $.each(campos, function (i, campo) {
                    var valor2 = campo.campo2.length ? limparTexto(campo.campo2.val()).toLowerCase() : "";

                    if (valor2 === fonte) {
                        escolhido = campo;
                        return false;
                    }
                });
            }

            if (!escolhido && campos.length) escolhido = campos[0];

            if (!escolhido || !escolhido.campoA.length || !escolhido.campo2.length) {
                escolhido = encontrarCampo017PorFallbackDOM();
            }

            if (!escolhido || !escolhido.campoA.length || !escolhido.campo2.length) {
                $("#kore-estado").html(
                    '<span style="color:#b42318;font-weight:700;">Não encontrei um campo 017 editável.</span> ' +
                    'Abra ou adicione um campo 017 e volte a preencher.'
                );
                return;
            }

            STATE.suspenderEventos017 = true;
            if (escolhido.indicador1 && escolhido.indicador1.length) escrever(escolhido.indicador1, "7");
            escrever(escolhido.campoA, valor);
            escrever(escolhido.campo2, fonte);
            STATE.suspenderEventos017 = false;

            escolhido.campoA.add(escolhido.campo2).addClass("kore-017-aplicado");
            setTimeout(function () {
                escolhido.campoA.add(escolhido.campo2).removeClass("kore-017-aplicado");
            }, 900);

            $("#kore-estado").html(
                'Preenchido no 017: indicador 1 = 7, 017$a = <strong>' +
                escaparHTML(valor) +
                '</strong>, 017$2 = <strong>' +
                escaparHTML(fonte) +
                '</strong>.'
            );

            atualizarAuthorityState();
            atualizarLinksPesquisa();
        }

        function encontrarCampo017PorFallbackDOM() {
            var candidatos = [];

            $("li, div, tr, fieldset").each(function () {
                var bloco = $(this);
                var texto = limparTexto(bloco.text());
                var tem017 = /(^|\s)017(\s|$)/.test(texto) || /017/.test(String(bloco.attr("id") || "") + " " + String(bloco.attr("class") || ""));
                if (!tem017) return;

                var inputs = bloco.find("input[type='text'], textarea").filter(function () {
                    return !$(this).prop("disabled") && !$(this).prop("readonly");
                });
                if (!inputs.length) return;

                var campoA = $();
                var campo2 = $();
                var indicador1 = $();

                bloco.find("label").each(function () {
                    var label = $(this);
                    var t = limparTexto(label.text()).toLowerCase();
                    var id = label.attr("for");
                    var input = id && $("#" + escaparSelector(id)).length ? $("#" + escaparSelector(id)) : label.closest("li, div, tr, p").find("input[type='text'], textarea").first();
                    if (!input.length) return;

                    if (!campoA.length && (t.indexOf("identificador") !== -1 || /\$?a\b/.test(t))) campoA = input;
                    if (!campo2.length && (t.indexOf("sistema") !== -1 || t.indexOf("codifica") !== -1 || /\$?2\b/.test(t))) campo2 = input;
                });

                if (!campoA.length) {
                    campoA = inputs.filter(function () {
                        var info = (String(this.id || "") + " " + String(this.name || "") + " " + limparTexto($(this).closest("li, div, tr, p").text())).toLowerCase();
                        return info.indexOf("identificador") !== -1 || /subfield[_-]?a/.test(info) || /\$a/.test(info);
                    }).first();
                }

                if (!campo2.length) {
                    campo2 = inputs.filter(function () {
                        var info = (String(this.id || "") + " " + String(this.name || "") + " " + limparTexto($(this).closest("li, div, tr, p").text())).toLowerCase();
                        return info.indexOf("sistema") !== -1 || info.indexOf("codifica") !== -1 || /subfield[_-]?2/.test(info) || /\$2/.test(info);
                    }).first();
                }

                indicador1 = inputs.filter(function () {
                    var v = limparTexto($(this).val());
                    return $(this).outerWidth() <= 55 && (v === "" || v === "7" || v.length === 1);
                }).first();

                if (campoA.length && campo2.length) {
                    candidatos.push({ bloco: bloco, campoA: campoA, campo2: campo2, indicador1: indicador1 });
                }
            });

            candidatos.sort(function (x, y) {
                var xv = (limparTexto(x.campoA.val()) ? 1 : 0) + (limparTexto(x.campo2.val()) ? 1 : 0);
                var yv = (limparTexto(y.campoA.val()) ? 1 : 0) + (limparTexto(y.campo2.val()) ? 1 : 0);
                return xv - yv;
            });

            return candidatos.length ? candidatos[0] : null;
        }

        function preencherPesquisa() {
            if (STATE.authority && STATE.authority.nome) {
                $("#kore-termo").val(STATE.authority.nome);
            }
        }

        function atualizarLinksPesquisa() {
            var termo = limparTexto($("#kore-termo").val());
            var termoURL = encodeURIComponent(termo);

            $("#kore-link-wikidata").attr(
                "href",
                termo ? "https://www.wikidata.org/w/index.php?search=" + termoURL : "https://www.wikidata.org/"
            );

            $("#kore-link-viaf").attr(
                "href",
                termo ? "https://viaf.org/viaf/search?query=local.names+all+%22" + termoURL + "%22&sortKeys=holdingscount&recordSchema=BriefVIAF" : "https://viaf.org/"
            );
        }

        function executarDashboardCompleto() {
            atualizarAuthorityState();

            if (STATE.dashboardEmCurso) {
                $("#kore-dashboard-status").text("A análise bibliográfica já está em curso. Aguarde pela conclusão.");
                return;
            }

            if (!STATE.authority.authid) {
                $("#kore-dashboard-status").text("A autoridade ainda não tem authid. Grave primeiro para validar a ligação bibliográfica.");
                ocultarProgressoDashboard();
                renderDashboard();
                koreV45AjustesFinais();

                return;
            }

            if (STATE.xhrDashboard && STATE.xhrDashboard.length) {
                STATE.xhrDashboard.forEach(function (xhr) {
                    try { if (xhr && xhr.readyState !== 4) xhr.abort(); } catch (e) {}
                });
            }

            STATE.dashboardToken++;
            STATE.dashboardEmCurso = true;
            STATE.xhrDashboard = [];
            $("#kore-dashboard-atualizar").prop("disabled", true).text("A carregar bibliográficos...");

            atualizarProgressoDashboard(0, 0, "A pesquisar registos por autoridade e por nome...");
            STATE.dashboardExecutada = false;
            STATE.candidatos = [];
            STATE.ocorrencias = [];
            STATE.limiteIntervencao = CONFIG.pageSizeIntervencao;
            STATE.filtroIntervencao = "problema:Falta $9";
            STATE.contextoSelecionado = "";
            STATE.problemaSelecionado = "";
            renderDashboard();

            pesquisarCandidatosValidacao(STATE.authority.authid, STATE.authority.nome, STATE.dashboardToken);
        }

        function koreV61AtualizarEtiquetaProgresso(atual, total, percentagem) {
            var ocorrencias = (STATE && STATE.ocorrencias && STATE.ocorrencias.length) ? STATE.ocorrencias.length : 0;
            var base = total ? ("Registos processados: " + atual + " / " + total + " (" + percentagem + "%)") : "Registos processados: 0 / 0 (0%)";
            $("#kore-dashboard-progresslabel").text(base + " · " + ocorrencias + " ocorrência(s)");
        }

        function atualizarProgressoDashboard(atual, total, mensagem) {
            var percentagem = total ? Math.round((atual / total) * 100) : 0;
            $("#kore-dashboard-status").text(mensagem || "A preparar análise bibliográfica...");
            $("#kore-dashboard-progress").removeClass("kore-fechado");
            $("#kore-dashboard-progressbar-fill").css("width", percentagem + "%");
            koreV61AtualizarEtiquetaProgresso(atual, total, percentagem);
        }

        function ocultarProgressoDashboard() {
            $("#kore-dashboard-progress").addClass("kore-fechado");
            $("#kore-dashboard-progressbar-fill").css("width", "0");
            koreV61AtualizarEtiquetaProgresso(0, 0, 0);
            STATE.dashboardEmCurso = false;
            STATE.xhrDashboard = [];
            $("#kore-dashboard-atualizar").prop("disabled", false).text("Carregar bibliográficos");
        }

        function pesquisarCandidatosValidacao(authid, nome, token) {
            var pesquisas = [];

            pesquisas.push({
                origem: "Pesquisa an",
                tipo: "authid",
                url: "/cgi-bin/koha/catalogue/search.pl?idx=an&q=" + encodeURIComponent(authid)
            });

            if (nome) {
                pesquisas.push({
                    origem: "Pesquisa autor",
                    tipo: "nome_autor",
                    url: "/cgi-bin/koha/catalogue/search.pl?idx=au&q=" + encodeURIComponent(nome)
                });

                pesquisas.push({
                    origem: "Pesquisa livre",
                    tipo: "nome_livre",
                    url: "/cgi-bin/koha/catalogue/search.pl?q=" + encodeURIComponent(nome)
                });
            }

            var pedidos = $.map(pesquisas, function (pesquisa) {
                var xhr = $.ajax({
                    url: pesquisa.url,
                    method: "GET",
                    dataType: "html"
                }).then(function (html) {
                    return {
                        origem: pesquisa.origem,
                        tipo: pesquisa.tipo,
                        html: html,
                        erro: false
                    };
                }, function () {
                    return {
                        origem: pesquisa.origem,
                        tipo: pesquisa.tipo,
                        html: "",
                        erro: true
                    };
                });
                STATE.xhrDashboard.push(xhr);
                return xhr;
            });

            $.when.apply($, pedidos).done(function () {
                if (token !== STATE.dashboardToken) return;
                var respostas = Array.prototype.slice.call(arguments);

                if (pedidos.length === 1) respostas = [arguments[0]];

                var candidatos = fundirCandidatos(respostas);

                if (!candidatos.length) {
                    $("#kore-dashboard-status").text("Não foram encontrados registos candidatos para validação.");
                    ocultarProgressoDashboard();
                    STATE.candidatos = [];
                    STATE.ocorrencias = [];
                    STATE.dashboardExecutada = true;
                    renderDashboard();
                koreV45AjustesFinais();
                
                    return;
                }

                STATE.candidatos = candidatos;
                validarCandidatos(candidatos, authid, nome, token);
            });
        }

        function fundirCandidatos(respostas) {
            var vistos = {};
            var candidatos = [];

            $.each(respostas, function (i, resposta) {
                if (!resposta || resposta.erro) return;

                var obras = extrairObrasDaPesquisa(resposta.html);

                $.each(obras, function (j, obra) {
                    if (!obra.biblionumber) return;

                    if (!vistos[obra.biblionumber]) {
                        vistos[obra.biblionumber] = obra;
                        obra.origens = [];
                        obra.tiposOrigem = [];
                        candidatos.push(obra);
                    }

                    vistos[obra.biblionumber].origens.push(resposta.origem);
                    vistos[obra.biblionumber].origens = removerDuplicados(vistos[obra.biblionumber].origens);

                    vistos[obra.biblionumber].tiposOrigem.push(resposta.tipo);
                    vistos[obra.biblionumber].tiposOrigem = removerDuplicados(vistos[obra.biblionumber].tiposOrigem);
                });
            });

            return candidatos.slice(0, CONFIG.maxCandidatosValidacao);
        }

        function extrairObrasDaPesquisa(html) {
            var obras = [];
            var vistos = {};
            var doc = $("<div>").append($.parseHTML(html, document, true));

            doc.find('a[href*="detail.pl?biblionumber="], a[href*="addbiblio.pl?biblionumber="]').each(function () {
                var a = $(this);
                var href = a.attr("href") || "";
                var biblionumber = obterBiblionumberDeURL(href);

                if (!biblionumber || vistos[biblionumber]) return;

                vistos[biblionumber] = true;

                var bloco =
                    a.closest("tr").length ? a.closest("tr") :
                    a.closest(".searchresults").length ? a.closest(".searchresults") :
                    a.closest(".result").length ? a.closest(".result") :
                    a.closest("li").length ? a.closest("li") :
                    a.parent();

                obras.push({
                    biblionumber: biblionumber,
                    titulo: obterTituloLimpoDoResultado(bloco, biblionumber),
                    detalhe: "/cgi-bin/koha/catalogue/detail.pl?biblionumber=" + encodeURIComponent(biblionumber),
                    editar: "/cgi-bin/koha/cataloguing/addbiblio.pl?biblionumber=" + encodeURIComponent(biblionumber),
                    marc: "/cgi-bin/koha/catalogue/MARCdetail.pl?biblionumber=" + encodeURIComponent(biblionumber),
                    origens: [],
                    tiposOrigem: []
                });
            });

            return obras;
        }

        function obterBiblionumberDeURL(url) {
            if (!url) return "";

            try {
                var u = new URL(url, window.location.origin);
                var biblionumber = u.searchParams.get("biblionumber");

                if (biblionumber && /^\d+$/.test(biblionumber)) return biblionumber;
            } catch (e) {}

            var match = String(url).match(/[?&]biblionumber=(\d+)/i);
            return match ? match[1] : "";
        }

        function obterTituloLimpoDoResultado(bloco, biblionumber) {
            var titulo = "";

            var seletoresTitulo = [
                'a.title[href*="detail.pl?biblionumber="]',
                '.title a[href*="detail.pl?biblionumber="]',
                'h2 a[href*="detail.pl?biblionumber="]',
                'h3 a[href*="detail.pl?biblionumber="]',
                'a[href*="detail.pl?biblionumber="]'
            ];

            for (var i = 0; i < seletoresTitulo.length; i++) {
                bloco.find(seletoresTitulo[i]).each(function () {
                    var txt = limparTexto($(this).text());

                    if (txt && txt.length > 2 && !textoEhRuidoResultado(txt)) {
                        titulo = txt;
                        return false;
                    }
                });

                if (titulo) break;
            }

            return titulo || "Registo bibliográfico " + biblionumber;
        }

        function textoEhRuidoResultado(txt) {
            var t = normalizar(txt);

            return (
                !t ||
                t === "imagem local de capa" ||
                t === "reservas" ||
                t === "adicionar ao carrinho" ||
                t === "modificar o registo" ||
                t === "editar exemplares" ||
                t === "vista opac" ||
                t === "ver detalhe" ||
                t === "ver marc"
            );
        }

        function validarCandidatos(candidatos, authid, nomeAutoridade, token) {
            var ocorrencias = [];
            var indice = 0;

            function progresso() {
                if (token !== STATE.dashboardToken) return;
                var obraAtual = candidatos[indice] || {};
                var detalhe = obraAtual.biblionumber ? (" · " + obraAtual.biblionumber + " · " + (obraAtual.titulo || "sem título")) : "";
                atualizarProgressoDashboard(indice, candidatos.length, "A analisar MARC" + detalhe);
            }

            function terminar(mensagem) {
                STATE.dashboardEmCurso = false;
                STATE.xhrDashboard = [];
                $("#kore-dashboard-atualizar").prop("disabled", false).text("Carregar bibliográficos");
                atualizarProgressoDashboard(candidatos.length, candidatos.length, mensagem);
            }

            function seguinte() {
                if (token !== STATE.dashboardToken) return;

                if (indice >= candidatos.length) {
                    STATE.ocorrencias = normalizarOcorrencias(ocorrencias);
                    STATE.dashboardExecutada = true;
                    atualizarAuthorityState();
                    terminar("Dashboard atualizada. Foram analisados " + candidatos.length + " registos candidatos e " + STATE.ocorrencias.length + " ocorrência(s).");
                    renderDashboard();
                    koreV45AjustesFinais();

                    return;
                }

                progresso();

                var obra = candidatos[indice];
                indice++;

                var xhr = $.ajax({
                    url: obra.marc,
                    method: "GET",
                    dataType: "html"
                }).done(function (htmlMARC) {
                    if (token !== STATE.dashboardToken) return;
                    var resultado = analisarMARCComoOcorrencias(htmlMARC, authid, nomeAutoridade, obra);
                    ocorrencias = ocorrencias.concat(resultado);
                }).fail(function () {
                    if (token !== STATE.dashboardToken) return;
                    ocorrencias.push(criarOcorrencia({
                        obra: obra,
                        campo: "",
                        natureza: "Erro de leitura",
                        valorEncontrado: "",
                        problema: "Erro de leitura",
                        prioridade: "Revisão",
                        authidEsperado: authid,
                        authidEncontrado: "",
                        origemRelacao: obra.origens.join(", "),
                        confianca: "Baixa",
                        acaoCurta: "Verificar manualmente",
                        acaoDetalhada: "Não foi possível validar o MARC deste registo a partir da página da Intranet.",
                        grupo: "manual"
                    }));
                }).always(function () {
                    if (token !== STATE.dashboardToken) return;
                    seguinte();
                });

                STATE.xhrDashboard.push(xhr);
            }

            seguinte();
        }

        function criarOcorrencia(dados) {
            var obra = dados.obra;

            return {
                biblionumber: obra.biblionumber,
                titulo: obra.titulo,
                campo: dados.campo || "",
                natureza: dados.natureza || "",
                valorEncontrado: dados.valorEncontrado || "",
                problema: dados.problema || "",
                prioridade: dados.prioridade || "Informativa",
                authidEsperado: dados.authidEsperado || "",
                authidEncontrado: dados.authidEncontrado || "",
                origemRelacao: dados.origemRelacao || (obra.origens || []).join(", "),
                confianca: dados.confianca || "Média",
                codigoFuncao: dados.codigoFuncao || "",
                acaoCurta: dados.acaoCurta || "",
                acaoDetalhada: dados.acaoDetalhada || "",
                grupo: dados.grupo || "contexto",
                links: {
                    detalhe: obra.detalhe,
                    editar: obra.editar,
                    marc: "/cgi-bin/koha/catalogue/showmarc.pl?id=" + encodeURIComponent(obra.biblionumber) + "&viewas=html",
                    opac: "https://qa-catalogo.oeiras.pt/cgi-bin/koha/opac-detail.pl?biblionumber=" + encodeURIComponent(obra.biblionumber)
                }
            };
        }

        function normalizarOcorrencias(lista) {
            var vistos = {};
            var resultado = [];

            lista.forEach(function (o) {
                var chave = [
                    o.biblionumber,
                    o.campo,
                    o.natureza,
                    o.valorEncontrado,
                    o.problema,
                    o.authidEncontrado
                ].join("|");

                if (vistos[chave]) return;
                vistos[chave] = true;
                resultado.push(o);
            });

            resultado.sort(function (a, b) {
                var peso = { "imediata": 1, "manual": 2, "contexto": 3, "sem": 4 };
                var pa = peso[a.grupo] || 9;
                var pb = peso[b.grupo] || 9;

                if (pa !== pb) return pa - pb;
                return String(a.titulo).localeCompare(String(b.titulo), "pt");
            });

            return resultado;
        }

        function analisarMARCComoOcorrencias(html, authid, nomeAutoridade, obra) {
            var doc = $("<div>").append($.parseHTML(html, document, true));
            doc.find("script, style").remove();

            var blocos = extrairBlocosMARC(doc);
            var nomeNorm = normalizar(nomeAutoridade);
            var estruturais = [];
            var contextuais = [];

            obra._koreBlocos = blocos;

            blocos.forEach(function (bloco) {
                if (CONFIG.camposAutoria.indexOf(bloco.campo) !== -1) {
                    var autoria = analisarBlocoAutoria(bloco, authid, nomeNorm, obra);
                    if (autoria) estruturais.push(autoria);
                    return;
                }

                var contextual = analisarBlocoContextual(bloco, authid, nomeNorm, obra);
                if (contextual) contextuais.push(contextual);
            });

            if (estruturais.length || contextuais.length) {
                return estruturais.concat(contextuais);
            }

            return [criarOcorrencia({
                obra: obra,
                campo: "",
                natureza: "Sem evidência",
                valorEncontrado: "",
                problema: "Sem menção identificada",
                prioridade: "Informativa",
                authidEsperado: authid,
                authidEncontrado: "",
                origemRelacao: (obra.origens || []).join(", "),
                confianca: "Baixa",
                acaoCurta: "Sem ação imediata",
                acaoDetalhada: "O registo foi recuperado como candidato, mas não foi encontrada menção claramente identificável à entidade nos campos analisados.",
                grupo: "sem"
            })];
        }

        function procurarMencoesNaoMapeadas(doc, blocos, authid, universoIdentitario, obra) {
            var ocorrencias = [];
            var vistos = {};
            var origem = (obra.origens || []).join(", ");

            function adicionar(campo, subcampo, valor, confianca, fonte) {
                campo = limparTexto(campo || "—");
                subcampo = limparTexto(subcampo || "");
                valor = limparTexto(valor || "");

                if (!valor || valor === "—") return;
                if (!textoAutoriaCompativel(valor, nomeNorm)) return;

                var campoFinal = campo;
                if (subcampo && subcampo !== "—") campoFinal += "$" + subcampo;

                var chave = campoFinal + "|" + normalizar(valor);
                if (vistos[chave]) return;
                vistos[chave] = true;

                var classificacao = classificarCampoRelacao(campo);

                ocorrencias.push(criarOcorrencia({
                    obra: obra,
                    campo: campoFinal,
                    natureza: classificacao.natureza || "Menção não mapeada",
                    valorEncontrado: valor,
                    problema: "Menção encontrada fora dos padrões principais",
                    prioridade: classificacao.tipo === "mencao_responsabilidade" ? "Revisão" : "Informativa",
                    authidEsperado: authid,
                    authidEncontrado: "",
                    origemRelacao: origem,
                    confianca: confianca || "Baixa",
                    acaoCurta: classificacao.tipo === "mencao_responsabilidade" ? "Avaliar ponto de acesso" : "Mapear menção",
                    acaoDetalhada: "O nome foi encontrado no MARC, mas fora dos padrões estruturais principais já validados. Confirmar se é apenas contexto ou se exige criação/correção de ponto de acesso.",
                    grupo: classificacao.tipo === "mencao_responsabilidade" ? "manual" : "contexto"
                }));
            }

            (blocos || []).forEach(function (bloco) {
                if (!bloco || !bloco.texto) return;
                if (!textoAutoriaCompativel(bloco.texto, nomeNorm)) return;

                var melhor = escolherMelhorSubcampoComNome(bloco, nomeNorm);
                adicionar(bloco.campo, melhor.subcampo, melhor.valor, "Média", "bloco");
            });

            if (ocorrencias.length) return ocorrencias;

            doc.find("tr, li, p, div").each(function () {
                if (ocorrencias.length >= 8) return false;

                var el = $(this);
                var texto = limparTexto(el.text());

                if (!texto || texto.length < 8) return;
                if (!textoAutoriaCompativel(texto, nomeNorm)) return;

                var campo = inferirCampoMARCDoTexto(texto);
                if (!campo) return;

                var subcampos = extrairSubcamposDeTexto(texto);
                var melhor = escolherMelhorSubcampoDeMapa(subcampos, texto, nomeNorm);

                adicionar(campo, melhor.subcampo, melhor.valor, "Baixa", "html");
            });

            return ocorrencias;
        }

        function escolherMelhorSubcampoComNome(bloco, nomeNorm) {
            var candidatos = [];

            if (bloco.subcampos) {
                Object.keys(bloco.subcampos).forEach(function (codigo) {
                    (bloco.subcampos[codigo] || []).forEach(function (valor) {
                        if (textoAutoriaCompativel(valor, nomeNorm)) {
                            candidatos.push({
                                subcampo: codigo,
                                valor: valor
                            });
                        }
                    });
                });
            }

            if (candidatos.length) return candidatos[0];

            return {
                subcampo: "—",
                valor: limparValorMARCParaApresentacao(bloco.texto)
            };
        }

        function escolherMelhorSubcampoDeMapa(subcampos, texto, nomeNorm) {
            var codigos = Object.keys(subcampos || {});

            for (var i = 0; i < codigos.length; i++) {
                var codigo = codigos[i];
                var valores = subcampos[codigo] || [];

                for (var j = 0; j < valores.length; j++) {
                    if (textoAutoriaCompativel(valores[j], nomeNorm)) {
                        return {
                            subcampo: codigo,
                            valor: valores[j]
                        };
                    }
                }
            }

            return {
                subcampo: "—",
                valor: limparValorMARCParaApresentacao(texto)
            };
        }

        function inferirCampoMARCDoTexto(texto) {
            var match = String(texto || "").match(/\b(\d{3})\b/);
            if (!match) return "";

            var campo = match[1];
            if (!/^\d{3}$/.test(campo)) return "";

            return campo;
        }

        function limparValorMARCParaApresentacao(texto) {
            return limparTexto(
                String(texto || "")
                    .replace(/^\s*\d{3}\s*#*\s*/g, "")
                    .replace(/\s+/g, " ")
            );
        }

        function classificarCampoRelacao(campo) {
            campo = String(campo || "");

            if (["700", "701", "702"].indexOf(campo) !== -1) {
                return {
                    tipo: "autoria_estrutural",
                    natureza: "Responsabilidade estruturada"
                };
            }

            if (campo === "200") {
                return {
                    tipo: "mencao_responsabilidade",
                    natureza: "Menção de responsabilidade"
                };
            }

            if (/^6\d\d$/.test(campo)) {
                return {
                    tipo: "assunto",
                    natureza: "Assunto"
                };
            }

            if (/^3\d\d$/.test(campo)) {
                return {
                    tipo: "nota",
                    natureza: "Nota ou texto"
                };
            }

            if (/^4\d\d$/.test(campo)) {
                return {
                    tipo: "relacao_bibliografica",
                    natureza: "Relação bibliográfica"
                };
            }

            if (/^5\d\d$/.test(campo)) {
                return {
                    tipo: "titulo_relacionado",
                    natureza: "Título relacionado"
                };
            }

            if (/^7\d\d$/.test(campo)) {
                return {
                    tipo: "responsabilidade_nao_prioritaria",
                    natureza: "Outro campo de responsabilidade"
                };
            }

            return {
                tipo: "outro_contexto",
                natureza: "Outra menção contextual"
            };
        }

        
        
        
        function grupoOperacional(o) {
            if (!o) return "outro";
            if (o.problema === "Ligação correta") return "confirmadas";
            if (o.problema === "Falta $9" || o.problema === "Outro authid" || o.problema === "Falta $4" || o.problema === "Falta $9 e $4") return "corrigir";
            if (o.grupo === "manual") return "rever";
            if (o.grupo === "contexto") return "mencoes";
            if (o.grupo === "sem") return "tecnicos";
            return "outro";
        }

        function contarPorProblema(problema) {
            if (!STATE.dashboardExecutada) return 0;
            return (STATE.ocorrencias || []).filter(function (o) {
                if (problema === "Falta $9") return ausencia9(o);
                if (problema === "Falta $4") return ausencia4(o);
                return o.problema === problema;
            }).length;
        }

        function filtrarPorProblema(problema) {
            STATE.filtroIntervencao = "problema:" + problema;
            STATE.contextoSelecionado = "";
            STATE.limiteIntervencao = 999999;
            renderTabelaIntervencao();

            if ($("#kore-area-intervencao").length) {
                $("html, body").animate({
                    scrollTop: $("#kore-area-intervencao").offset().top - 80
                }, 250);
            }
        }

function analisarBlocoAutoria(bloco, authid, nomeNorm, obra) {
            var authids = extrairAuthidsDoBlocoMARC(bloco);
            var valorAutoria = extrairValorAutoria(bloco);
            var codigos4 = extrairCodigosFuncaoDoBlocoMARC(bloco);
            var detalhe4 = descricaoFuncao4(codigos4);
            var compativel = textoAutoriaCompativel(valorAutoria || bloco.texto, nomeNorm);
            var origem = (obra.origens || []).join(", ");
            var authidStr = String(authid);
            var temAuthidEsperado = authids.indexOf(authidStr) !== -1;
            var temAuthid = authids.length > 0;
            var tem4 = codigos4.length > 0;
            var valorDecisao = valorAutoria || bloco.texto;

            if (compativel && !temAuthid && !tem4) {
                return criarOcorrencia({
                    obra: obra,
                    campo: bloco.campo,
                    natureza: "Responsabilidade estruturada",
                    valorEncontrado: valorDecisao,
                    problema: "Falta $9 e $4",
                    prioridade: "Crítica",
                    authidEsperado: authid,
                    authidEncontrado: "",
                    origemRelacao: origem,
                    confianca: origem.indexOf("Pesquisa an") !== -1 ? "Alta" : "Média",
                    codigoFuncao: detalhe4,
                    acaoCurta: "Completar $9 e $4",
                    acaoDetalhada: "O ponto de acesso é compatível com a autoridade, mas não tem ligação estrutural ($9) nem código de função/responsabilidade ($4). Confirmar a forma, preencher o $9 com o authid esperado e acrescentar o $4 adequado.",
                    grupo: "imediata"
                });
            }

            if (temAuthidEsperado && !tem4) {
                return criarOcorrencia({
                    obra: obra,
                    campo: bloco.campo + "$9",
                    natureza: "Responsabilidade estruturada",
                    valorEncontrado: valorDecisao || ("Autoridade " + authid),
                    problema: "Falta $4",
                    prioridade: "Revisão",
                    authidEsperado: authid,
                    authidEncontrado: authid,
                    origemRelacao: origem.indexOf("Pesquisa an") !== -1 ? "Pesquisa an" : origem,
                    confianca: "Alta",
                    codigoFuncao: detalhe4,
                    acaoCurta: "Adicionar $4",
                    acaoDetalhada: "O ponto de acesso está ligado à autoridade esperada através do $9, mas não tem código de função/responsabilidade. Confirmar a função e preencher o subcampo $4.",
                    grupo: "imediata"
                });
            }

            if (temAuthidEsperado && tem4) {
                return criarOcorrencia({
                    obra: obra,
                    campo: bloco.campo + "$9",
                    natureza: "Responsabilidade estruturada",
                    valorEncontrado: valorDecisao || ("Autoridade " + authid),
                    problema: "Ligação correta",
                    prioridade: "Informativa",
                    authidEsperado: authid,
                    authidEncontrado: authid,
                    origemRelacao: origem.indexOf("Pesquisa an") !== -1 ? "Pesquisa an" : origem,
                    confianca: "Alta",
                    codigoFuncao: detalhe4,
                    acaoCurta: "Sem ação",
                    acaoDetalhada: "O ponto de acesso está ligado à autoridade esperada através do subcampo $9 e tem código $4.",
                    grupo: "contexto"
                });
            }

            if (compativel && !temAuthid && tem4) {
                return criarOcorrencia({
                    obra: obra,
                    campo: bloco.campo,
                    natureza: "Responsabilidade estruturada",
                    valorEncontrado: valorDecisao,
                    problema: "Falta $9",
                    prioridade: "Crítica",
                    authidEsperado: authid,
                    authidEncontrado: "",
                    origemRelacao: origem,
                    confianca: origem.indexOf("Pesquisa an") !== -1 ? "Alta" : "Média",
                    codigoFuncao: detalhe4,
                    acaoCurta: "Ligar autoridade",
                    acaoDetalhada: "O nome é compatível com a autoridade e existe $4, mas o ponto de acesso não tem $9. Confirmar e preencher o subcampo $9 com o authid esperado.",
                    grupo: "imediata"
                });
            }

            if (compativel && temAuthid && !temAuthidEsperado) {
                return criarOcorrencia({
                    obra: obra,
                    campo: bloco.campo + "$9",
                    natureza: "Responsabilidade estruturada",
                    valorEncontrado: valorDecisao,
                    problema: "Outro authid",
                    prioridade: "Crítica",
                    authidEsperado: authid,
                    authidEncontrado: authids.join(", "),
                    origemRelacao: origem,
                    confianca: "Média",
                    codigoFuncao: detalhe4,
                    acaoCurta: tem4 ? "Rever ligação" : "Rever ligação e $4",
                    acaoDetalhada: tem4 ?
                        "O nome parece compatível, mas o ponto de acesso está ligado a outro authid. Confirmar se existe autoridade duplicada ou ligação indevida." :
                        "O nome parece compatível, mas o ponto de acesso está ligado a outro authid e também não tem $4. Confirmar a autoridade correta e o código de função.",
                    grupo: "manual"
                });
            }

            return null;
        }

        function analisarBlocoContextual(bloco, authid, nomeNorm, obra) {
            var texto = bloco.texto || "";

            if (!textoAutoriaCompativel(texto, nomeNorm)) return null;

            var classificacao = classificarCampoRelacao(bloco.campo);
            var authids = extrairAuthidsDoBlocoMARC(bloco);
            var valor = extrairValorContextual(bloco, classificacao.tipo);

            if (classificacao.tipo === "mencao_responsabilidade") {
                var valor200f = limparValorMARCOperacional(valor || texto);
                var comparacao7xx = obterResumo7xxParaComparacao(obra, nomeNorm);
                var leitura400 = obterLeitura400ParaComparacao(valor200f);
                var cenario200f = classificarCenario200f(valor200f, comparacao7xx, leitura400);
                return criarOcorrencia({
                    obra: obra,
                    campo: bloco.campo + "$f",
                    natureza: classificacao.natureza,
                    valorEncontrado: "200$f: " + valor200f + " || 7xx: " + comparacao7xx + " || 400: " + leitura400.resumo + " || Cenário: " + cenario200f,
                    problema: "Menção de responsabilidade",
                    prioridade: leitura400.estado === "avaliar_400" ? "Revisão" : "Informativa",
                    authidEsperado: authid,
                    authidEncontrado: authids.join(", "),
                    origemRelacao: (obra.origens || []).join(", "),
                    confianca: leitura400.estado === "variante_400_existente" || leitura400.estado === "forma_autorizada" ? "Alta" : "Média",
                    acaoCurta: leitura400.estado === "avaliar_400" ? "Avaliar criação de 400" : "Validar forma prevista",
                    acaoDetalhada: leitura400.detalhe,
                    grupo: "manual"
                });
            }

            return criarOcorrencia({
                obra: obra,
                campo: bloco.campo,
                natureza: classificacao.natureza,
                valorEncontrado: valor || texto,
                problema: "Menção contextual",
                prioridade: "Informativa",
                authidEsperado: authid,
                authidEncontrado: authids.join(", "),
                origemRelacao: (obra.origens || []).join(", "),
                confianca: classificacao.tipo === "assunto" ? "Média" : "Baixa",
                acaoCurta: "Mapear menção",
                acaoDetalhada: "Menção contextual sem impacto estrutural imediato.",
                grupo: "contexto"
            });
        }

        function extrairValorContextual(bloco, tipo) {
            if (tipo === "mencao_responsabilidade") {
                return obterSubcampo(bloco, "f") || obterSubcampo(bloco, "g") || bloco.texto;
            }

            if (tipo === "assunto") {
                return extrairValorAssunto(bloco);
            }

            if (tipo === "nota") {
                return obterSubcampo(bloco, "a") || bloco.texto;
            }

            return obterSubcampo(bloco, "a") || bloco.texto;
        }

        function extrairBlocosMARC(doc) {
            var blocosEstruturais = extrairBlocosMARCDeTabela(doc);

            if (blocosEstruturais.length) return blocosEstruturais;

            return extrairBlocosMARCDeTexto(doc);
        }

        function extrairBlocosMARCDeTabela(doc) {
            var blocos = [];

            doc.find("tr").each(function () {
                var tr = $(this);
                var texto = limparTexto(tr.text());

                var match = texto.match(/\b(\d{3})\b/);
                if (!match) return;

                var campo = match[1];
                if (!/^\d{3}$/.test(campo)) return;
                if (texto.length < 4) return;

                blocos.push({
                    campo: campo,
                    texto: texto,
                    subcampos: extrairSubcamposDeTexto(texto)
                });
            });

            return compactarBlocosMARC(blocos);
        }

        function extrairBlocosMARCDeTexto(doc) {
            var texto = String(doc.text() || "")
                .replace(/\r/g, "\n")
                .replace(/\u00a0/g, " ");

            var linhas = texto
                .split(/\n+/)
                .map(function (linha) {
                    return limparTexto(linha);
                })
                .filter(Boolean);

            var blocos = [];
            var blocoAtual = null;

            $.each(linhas, function (i, linha) {
                var matchCampo = linha.match(/^(\d{3})(\s|#|$)/);

                if (matchCampo) {
                    if (blocoAtual) {
                        blocoAtual.subcampos = extrairSubcamposDeTexto(blocoAtual.texto);
                        blocos.push(blocoAtual);
                    }

                    blocoAtual = {
                        campo: matchCampo[1],
                        texto: linha,
                        subcampos: {}
                    };
                } else if (blocoAtual) {
                    blocoAtual.texto += " " + linha;
                }
            });

            if (blocoAtual) {
                blocoAtual.subcampos = extrairSubcamposDeTexto(blocoAtual.texto);
                blocos.push(blocoAtual);
            }

            return blocos;
        }

        function compactarBlocosMARC(blocos) {
            var resultado = [];

            blocos.forEach(function (bloco) {
                if (!bloco.campo || !bloco.texto) return;

                var textoNorm = normalizar(bloco.texto);
                var duplicado = resultado.some(function (existente) {
                    return existente.campo === bloco.campo && normalizar(existente.texto) === textoNorm;
                });

                if (!duplicado) resultado.push(bloco);
            });

            return resultado;
        }

        function extrairSubcamposDeTexto(texto) {
            var subcampos = {};
            var t = " " + String(texto || "").replace(/\s+/g, " ") + " ";
            var re = /(?:^|\s|\$)([0-9a-z])\s+(.+?)(?=\s(?:[0-9a-z]|\$[0-9a-z])\s+|$)/gi;
            var match;

            while ((match = re.exec(t)) !== null) {
                var codigo = String(match[1]).toLowerCase();
                var valor = limparTexto(match[2]);

                if (!subcampos[codigo]) subcampos[codigo] = [];
                if (valor) subcampos[codigo].push(valor);
            }

            return subcampos;
        }

        function obterSubcampo(bloco, codigo) {
            codigo = String(codigo || "").toLowerCase();

            if (bloco.subcampos && bloco.subcampos[codigo] && bloco.subcampos[codigo].length) {
                return limparValorMARCOperacional(bloco.subcampos[codigo].join(" "));
            }

            return limparValorMARCOperacional(extrairSubcampoSimples(bloco.texto, codigo));
        }

        function extrairAuthidsDoBlocoMARC(bloco) {
            var authids = [];

            if (bloco.subcampos && bloco.subcampos["9"] && bloco.subcampos["9"].length) {
                bloco.subcampos["9"].forEach(function (v) {
                    var nums = String(v || "").match(/\b\d{1,12}\b/g);
                    if (nums) authids = authids.concat(nums);
                });
            }

            if (!authids.length) {
                var texto = String(bloco.texto || "");
                var re = /(?:^|\s|\$)(?:9)\s*([0-9]{1,12})(?=\s|$)/g;
                var match;

                while ((match = re.exec(texto)) !== null) {
                    authids.push(match[1]);
                }
            }

            return removerDuplicados(authids);
        }

        function extrairCodigosFuncaoDoBlocoMARC(bloco) {
            var codigos = [];
            var texto = String(bloco && bloco.texto ? bloco.texto : "")
                .replace(/\u00a0/g, " ")
                .replace(/‡/g, "$")
                .replace(/ǂ/g, "$");

            if (bloco && bloco.subcampos && bloco.subcampos["4"] && bloco.subcampos["4"].length) {
                bloco.subcampos["4"].forEach(function (v) {
                    var encontrados = String(v || "").match(/\b[0-9]{3}\b|\b[a-z]{3}\b/gi);
                    if (encontrados) codigos = codigos.concat(encontrados);
                });
            }

            var re = /(?:\$4|\s4\s+)\s*([0-9]{3}|[a-z]{3})\b/gi;
            var match;

            while ((match = re.exec(texto)) !== null) {
                codigos.push(match[1]);
            }

            return removerDuplicados(codigos);
        }

        function traduzirCodigoFuncao(codigo) {
            var mapa = {
                "000": "Função não especificada",
                "005": "Ator",
                "010": "Adaptador",
                "018": "Animador",
                "020": "Anotador",
                "030": "Arranjador",
                "040": "Artista",
                "050": "Autor citado",
                "060": "Nome associado",
                "065": "Leiloeiro",
                "070": "Autor",
                "075": "Autor do posfácio ou colofão",
                "080": "Autor da introdução",
                "090": "Autor do diálogo",
                "100": "Antecedente bibliográfico",
                "110": "Encadernador",
                "120": "Designer da encadernação",
                "130": "Designer do livro",
                "140": "Designer gráfico",
                "150": "Impressor de ex-líbris",
                "160": "Livreiro",
                "170": "Calígrafo",
                "180": "Cartógrafo",
                "190": "Censor",
                "200": "Coreógrafo",
                "205": "Colaborador",
                "206": "Comentador",
                "207": "Comentador de material textual",
                "210": "Comentador de texto escrito",
                "212": "Comentador de material audiovisual",
                "220": "Compilador",
                "230": "Compositor",
                "240": "Tipógrafo",
                "245": "Conceptualizador",
                "250": "Condutor",
                "255": "Consultor de projeto",
                "257": "Consultor científico",
                "260": "Detentor de direitos de autor",
                "270": "Corrector",
                "275": "Dançarino",
                "280": "Dedicatário",
                "290": "Dedicador",
                "300": "Realizador",
                "305": "Declarante",
                "310": "Distribuidor",
                "320": "Doador",
                "330": "Autor presumível",
                "340": "Editor literário",
                "350": "Gravador",
                "360": "Água-fortista",
                "365": "Especialista associado",
                "370": "Editor",
                "380": "Falsificador",
                "390": "Antigo proprietário",
                "395": "Fundador",
                "400": "Financiador",
                "410": "Designer gráfico",
                "420": "Homenageado",
                "430": "Iluminador",
                "440": "Ilustrador",
                "445": "Impresário",
                "450": "Impressor",
                "460": "Entrevistado",
                "470": "Entrevistador",
                "480": "Libretista",
                "490": "Licenciante",
                "500": "Licenciado",
                "510": "Litógrafo",
                "520": "Letrista",
                "530": "Metal-gravador",
                "540": "Monitor",
                "550": "Narrador",
                "555": "Oponente",
                "557": "Organizador de reunião",
                "560": "Originador",
                "570": "Outro",
                "580": "Fabricante de papel",
                "590": "Titular da patente",
                "600": "Fotógrafo",
                "605": "Apresentador",
                "610": "Impressor da chapa",
                "620": "Impressor das gravuras",
                "630": "Produtor",
                "632": "Cenógrafo",
                "633": "Produtor de som",
                "635": "Programador",
                "637": "Gestor de projeto",
                "640": "Revisor",
                "650": "Editor científico",
                "651": "Diretor de publicação",
                "655": "Marionetista",
                "660": "Destinatário",
                "670": "Técnico de gravação",
                "675": "Revisor técnico",
                "677": "Membro da equipa de investigação",
                "680": "Rubricador",
                "690": "Argumentista",
                "695": "Consultor científico",
                "700": "Copista",
                "705": "Escultor",
                "710": "Secretário",
                "720": "Signatário",
                "721": "Cantor",
                "723": "Patrocinador",
                "725": "Normalizador",
                "727": "Orientador de tese",
                "730": "Tradutor",
                "740": "Tipógrafo",
                "750": "Impressor tipográfico",
                "760": "Gravador em madeira",
                "770": "Autor de material associado",
                "800": "Professor",
                "900": "Inventor",

                "act": "Ator",
                "adp": "Adaptador",
                "aft": "Autor do posfácio",
                "ann": "Anotador",
                "ant": "Antecedente bibliográfico",
                "aqt": "Autor citado",
                "arc": "Arquiteto",
                "arr": "Arranjador",
                "art": "Artista",
                "asn": "Nome associado",
                "ato": "Autógrafo",
                "auc": "Leiloeiro",
                "aud": "Autor do diálogo",
                "aui": "Autor da introdução",
                "aus": "Argumentista",
                "aut": "Autor",
                "bdd": "Designer da encadernação",
                "bjd": "Designer do livro",
                "bkd": "Designer do livro",
                "bkp": "Produtor do livro",
                "bnd": "Encadernador",
                "bsl": "Livreiro",
                "ccp": "Conceptualizador",
                "chr": "Coreógrafo",
                "clb": "Colaborador",
                "cli": "Cliente",
                "cll": "Calígrafo",
                "clr": "Colorista",
                "cmm": "Comentador",
                "cmp": "Compositor",
                "cmt": "Tipógrafo",
                "cnd": "Condutor",
                "cng": "Cinematógrafo",
                "com": "Compilador",
                "cor": "Corrector",
                "cos": "Contestante",
                "cot": "Contestante recorrido",
                "cou": "Tribunal",
                "cov": "Designer da capa",
                "cpc": "Requerente de direitos de autor",
                "cpe": "Queixoso recorrido",
                "cph": "Detentor de direitos de autor",
                "cpl": "Queixoso",
                "cpt": "Queixoso recorrente",
                "cre": "Criador",
                "crp": "Correspondente",
                "crr": "Corrector",
                "crt": "Repórter judicial",
                "csl": "Consultor",
                "csp": "Consultor de projeto",
                "ctb": "Contribuidor",
                "cte": "Contestante recorrido",
                "ctg": "Cartógrafo",
                "ctr": "Contratante",
                "cts": "Contestante",
                "ctt": "Contestante recorrente",
                "cur": "Curador",
                "dfd": "Réu",
                "dfe": "Réu recorrido",
                "dft": "Réu recorrente",
                "dgg": "Instituição que concede grau",
                "dgs": "Orientador de grau",
                "dis": "Dissertante",
                "dln": "Delineador",
                "dnc": "Dançarino",
                "dnr": "Doador",
                "dpc": "Representado",
                "dpt": "Depositante",
                "drm": "Desenhador",
                "drt": "Diretor",
                "dsr": "Designer",
                "dst": "Distribuidor",
                "dtc": "Contribuidor de dados",
                "dte": "Dedicatário",
                "dtm": "Gestor de dados",
                "dto": "Dedicador",
                "dub": "Autor duvidoso",
                "edt": "Editor literário",
                "egr": "Gravador",
                "elg": "Eletricista",
                "elt": "Galvanotipista",
                "eng": "Engenheiro",
                "enj": "Jurisdição",
                "etr": "Água-fortista",
                "exp": "Especialista",
                "fac": "Fac-similista",
                "fds": "Distribuidor cinematográfico",
                "fld": "Diretor de campo",
                "flm": "Editor de filme",
                "fmd": "Realizador de filme",
                "fmk": "Cineasta",
                "fmo": "Antigo proprietário",
                "fmp": "Produtor de filme",
                "fnd": "Financiador",
                "gis": "Especialista em informação geográfica",
                "hnr": "Homenageado",
                "hst": "Anfitrião",
                "ill": "Ilustrador",
                "ilu": "Iluminador",
                "ins": "Inscritor",
                "inv": "Inventor",
                "isb": "Entidade emissora",
                "itr": "Instrumentista",
                "ive": "Entrevistado",
                "ivr": "Entrevistador",
                "jud": "Juiz",
                "jug": "Jurisdição governada",
                "lbr": "Laboratório",
                "lbt": "Libretista",
                "ldr": "Diretor de laboratório",
                "led": "Responsável",
                "lee": "Requerido recorrido",
                "lel": "Requerido",
                "len": "Mutuante",
                "let": "Requerido recorrente",
                "lgd": "Designer de iluminação",
                "lie": "Requerente recorrido",
                "lil": "Requerente",
                "lit": "Requerente recorrente",
                "lsa": "Arquiteto paisagista",
                "lse": "Licenciado",
                "lso": "Licenciante",
                "ltg": "Litógrafo",
                "lyr": "Letrista",
                "mdc": "Contacto de metadados",
                "med": "Médium",
                "mfp": "Local de fabrico",
                "mfr": "Fabricante",
                "mod": "Moderador",
                "mon": "Monitor",
                "mrb": "Marmorista",
                "mrk": "Editor de marcação",
                "msd": "Diretor musical",
                "mte": "Gravador em metal",
                "mus": "Músico",
                "nrt": "Narrador",
                "opn": "Oponente",
                "org": "Originador",
                "orm": "Organizador de reunião",
                "osp": "Apresentador no ecrã",
                "oth": "Outro",
                "own": "Proprietário",
                "pan": "Participante em painel",
                "pat": "Patrono",
                "pbd": "Diretor de publicação",
                "pbl": "Editor comercial",
                "pdr": "Diretor de projeto",
                "pfr": "Revisor de provas",
                "pht": "Fotógrafo",
                "plt": "Fabricante de chapas",
                "pma": "Agência autorizadora",
                "pmn": "Gestor de produção",
                "pop": "Impressor de chapas",
                "ppm": "Fabricante de papel",
                "ppt": "Marionetista",
                "pra": "Presidente",
                "prc": "Contacto de processo",
                "prd": "Pessoal de produção",
                "pre": "Apresentador",
                "prf": "Intérprete",
                "prg": "Programador",
                "prm": "Gravador de matrizes",
                "prn": "Companhia produtora",
                "pro": "Produtor",
                "prp": "Local de produção",
                "prs": "Designer de produção",
                "prt": "Impressor",
                "pta": "Requerente de patente",
                "pte": "Autor recorrente",
                "ptf": "Autor recorrido",
                "pth": "Titular de patente",
                "ptt": "Autor",
                "pup": "Local de publicação",
                "rbr": "Rubricador",
                "rcd": "Técnico de gravação",
                "rce": "Engenheiro de som",
                "rcp": "Destinatário",
                "rdd": "Diretor de rádio",
                "red": "Redator",
                "ren": "Renderizador",
                "res": "Investigador",
                "rev": "Revisor",
                "rpc": "Produtor de rádio",
                "rps": "Repositório",
                "rpt": "Repórter",
                "rpy": "Responsável",
                "rse": "Réu recorrido",
                "rsg": "Realizador cénico",
                "rsp": "Respondente",
                "rsr": "Restaurador",
                "rst": "Réu recorrente",
                "rth": "Responsável de equipa de investigação",
                "rtm": "Membro da equipa de investigação",
                "sad": "Consultor científico",
                "sce": "Argumentista",
                "scl": "Escultor",
                "scr": "Escriba",
                "sds": "Designer de som",
                "sec": "Secretário",
                "sgd": "Diretor de cena",
                "sgn": "Signatário",
                "sht": "Anfitrião de apoio",
                "sll": "Vendedor",
                "sng": "Cantor",
                "spk": "Orador",
                "spn": "Patrocinador",
                "spy": "Segundo responsável",
                "srv": "Topógrafo",
                "std": "Cenógrafo",
                "stg": "Ambiente",
                "stl": "Contador de histórias",
                "stm": "Diretor de palco",
                "stn": "Organismo normalizador",
                "str": "Estereotipador",
                "tcd": "Diretor técnico",
                "tch": "Professor",
                "ths": "Orientador de tese",
                "tld": "Diretor de televisão",
                "tlp": "Produtor de televisão",
                "trc": "Transcritor",
                "trl": "Tradutor",
                "tyd": "Designer tipográfico",
                "tyg": "Tipógrafo",
                "uvp": "Local universitário",
                "vac": "Ator de voz",
                "vdg": "Videógrafo",
                "wac": "Autor de comentário acrescentado",
                "wal": "Autor de letra acrescentada",
                "wam": "Autor de material acrescentado",
                "wat": "Autor de texto acrescentado",
                "wdc": "Xilógrafo",
                "wde": "Gravador em madeira",
                "win": "Autor de introdução",
                "wit": "Testemunha",
                "wpr": "Autor de prefácio",
                "wst": "Autor de conteúdo textual suplementar",
                "fun": "Autor"
            };

            codigo = limparTexto(codigo || "").toLowerCase();
            if (!codigo || codigo === "0" || codigo === "-") return "";
            return mapa[codigo] || codigo.toUpperCase();
        }

        function formatarCodigoFuncao4(codigo, mostrarCodigo) {
            codigo = limparTexto(codigo || "");
            codigo = codigo.replace(/\[.*?\]/g, "").replace(/^\$?4\s*:?\s*/i, "");
            if (!codigo || codigo === "0" || codigo === "-" || codigo === "—") return "";

            var codigos = codigo.split(/\s*,\s*/).filter(function (c) { return !!limparTexto(c); });
            if (!codigos.length) return "";

            return codigos.map(function (c) {
                var label = traduzirCodigoFuncao(c);
                return label;
            }).join(", ");
        }

        function descricaoFuncao4(codigos) {
            if (!codigos || !codigos.length) return "0";
            return codigos.map(function (codigo) {
                return formatarCodigoFuncao4(codigo, true) || codigo;
            }).join(", ");
        }


        function extrairSubcampoSimples(textoBloco, codigo) {
            var re = new RegExp("(^|\\s|\\$)" + escaparRegex(codigo) + "\\s+(.+?)(?=\\s(?:[a-z0-9]|\\$[a-z0-9])\\s+|$)", "i");
            var match = String(textoBloco || "").match(re);

            if (!match) return "";

            return limparTexto(match[2]);
        }

        function extrairValorAutoria(bloco) {
            var partes = [];

            ["a", "b", "f", "g"].forEach(function (codigo) {
                var valor = obterSubcampo(bloco, codigo);
                if (valor) partes.push(valor);
            });

            if (partes.length) return limparValorMARCOperacional(partes.join(" "));

            return limparTexto(
                String(bloco.texto || "")
                    .replace(/^\d{3}\s*#*\s*/g, "")
                    .replace(/\$?9\s+\d{1,12}\b/g, "")
            );
        }

        function extrairValorAssunto(bloco) {
            var partes = [];

            ["a", "x", "y", "z", "j"].forEach(function (codigo) {
                var valor = obterSubcampo(bloco, codigo);
                if (valor) partes.push(valor);
            });

            return partes.join(" ");
        }

        function textoAutoriaCompativel(texto, nomeNorm) {
            var t = normalizar(texto);

            if (!t || !nomeNorm) return false;

            if (t.indexOf(nomeNorm) !== -1 || nomeNorm.indexOf(t) !== -1) return true;

            var partes = nomeNorm.split(" ").filter(function (p) {
                return p.length > 2;
            });

            if (!partes.length) return false;

            var encontrados = 0;

            $.each(partes, function (i, parte) {
                if (t.indexOf(parte) !== -1) encontrados++;
            });

            return encontrados >= Math.min(2, partes.length);
        }

        function pesquisarWikidata(termo) {
            $("#kore-wikidata").html("<p>A pesquisar...</p>");

            $.ajax({
                url: "https://www.wikidata.org/w/api.php",
                dataType: "jsonp",
                data: {
                    action: "wbsearchentities",
                    format: "json",
                    language: "pt",
                    uselang: "pt",
                    type: "item",
                    limit: CONFIG.maxResultadosWikidata,
                    search: termo
                },
                success: function (dados) {
                    if (!dados.search || !dados.search.length) {
                        $("#kore-wikidata").html("<p>Sem resultados.</p>");
                        return;
                    }

                    var ids = $.map(dados.search, function (item) {
                        return item.id;
                    }).join("|");

                    $.ajax({
                        url: "https://www.wikidata.org/w/api.php",
                        dataType: "jsonp",
                        data: {
                            action: "wbgetentities",
                            format: "json",
                            ids: ids,
                            props: "labels|descriptions|aliases|claims",
                            languages: "pt|en"
                        },
                        success: function (detalhes) {
                            var entidadesHumanas = {};
                            var resultadosHumanos = [];

                            $.each(dados.search, function (i, item) {
                                var entidade = detalhes.entities[item.id];

                                if (!entidade) return;

                                if (entidadeEhPessoaHumana(entidade)) {
                                    entidadesHumanas[item.id] = entidade;

                                    resultadosHumanos.push({
                                        id: item.id,
                                        label: obterLabelEntidade(entidade) || item.label || "",
                                        description: obterDescricaoEntidade(entidade) || item.description || ""
                                    });
                                }
                            });

                            if (!resultadosHumanos.length) {
                                $("#kore-wikidata").html("<p>Sem resultados confirmados como pessoa humana, P31 = Q5.</p>");
                                return;
                            }

                            resultadosHumanos = resultadosHumanos.slice(0, CONFIG.maxMostrarWikidata);

                            var entidadesLimitadas = {};

                            $.each(resultadosHumanos, function (i, item) {
                                entidadesLimitadas[item.id] = entidadesHumanas[item.id];
                            });

                            enriquecerEApresentarWikidata(resultadosHumanos, entidadesLimitadas);
                        },
                        error: function () {
                            $("#kore-wikidata").html("<p>Erro ao obter detalhes do Wikidata.</p>");
                        }
                    });
                },
                error: function () {
                    $("#kore-wikidata").html("<p>Erro ao consultar Wikidata.</p>");
                }
            });
        }

        function entidadeEhPessoaHumana(entidade) {
            var humano = false;

            if (!entidade || !entidade.claims || !entidade.claims.P31) return false;

            $.each(entidade.claims.P31, function (i, claim) {
                try {
                    var valor = claim.mainsnak.datavalue.value.id;

                    if (valor === "Q5") {
                        humano = true;
                        return false;
                    }
                } catch (e) {}
            });

            return humano;
        }

        function enriquecerEApresentarWikidata(resultados, entidades) {
            var idsRelacionados = [];

            $.each(entidades, function (qid, entidade) {
                idsRelacionados = idsRelacionados.concat(obterIdsClaims(entidade, "P27"));
                idsRelacionados = idsRelacionados.concat(obterIdsClaims(entidade, "P106"));
                idsRelacionados = idsRelacionados.concat(obterIdsClaims(entidade, "P742"));
            });

            idsRelacionados = removerDuplicados(idsRelacionados);

            if (!idsRelacionados.length) {
                apresentarResultadosWikidata(resultados, entidades, {});
                return;
            }

            $.ajax({
                url: "https://www.wikidata.org/w/api.php",
                dataType: "jsonp",
                data: {
                    action: "wbgetentities",
                    format: "json",
                    ids: idsRelacionados.join("|"),
                    props: "labels",
                    languages: "pt|en"
                },
                success: function (labels) {
                    apresentarResultadosWikidata(resultados, entidades, labels.entities || {});
                },
                error: function () {
                    apresentarResultadosWikidata(resultados, entidades, {});
                }
            });
        }

        function apresentarResultadosWikidata(resultados, entidades, entidadesRelacionadas) {
            var html = "";
            var primeiraImagem = "";

            $.each(resultados, function (i, item) {
                var qid = item.id || "";
                var entidade = entidades[qid] || {};
                var label = obterLabelEntidade(entidade) || item.label || "";
                var descricao = obterDescricaoEntidade(entidade) || item.description || "";
                var link = "https://www.wikidata.org/wiki/" + encodeURIComponent(qid);
                var imagem = obterImagemWikidata(entidade);
        if (imagem && !primeiraImagem) primeiraImagem = imagem;

                var outrosNomes = obterAliases(entidade);
                var pseudonimos = obterLabelsClaims(entidade, "P742", entidadesRelacionadas);
                var paises = obterLabelsClaims(entidade, "P27", entidadesRelacionadas);
                var nascimento = obterPrimeiraDataClaims(entidade, "P569");
                var morte = obterPrimeiraDataClaims(entidade, "P570");
                var ocupacoes = obterLabelsClaims(entidade, "P106", entidadesRelacionadas);

                html += '<div class="kore-item">';
                html += '<div class="kore-wd-layout' + (imagem ? '' : ' kore-wd-layout-sem-imagem') + '">';

                html += '<div class="kore-wd-imgbox">';
                if (imagem) {
                    html += '<img class="kore-wd-img" src="' + escaparHTML(imagem) + '" alt="' + escaparHTML(label) + '">';
                } else {
                    html += '<div class="kore-wd-placeholder"></div>';
                }
                html += '</div>';

                html += '<div class="kore-wd-info">';
                html += '<div class="kore-label">' + escaparHTML(label) + '</div>';

                if (descricao) html += '<div class="kore-desc">' + escaparHTML(descricao) + '</div>';

                html += '<div class="kore-id">' + escaparHTML(qid) + '</div>';

                if (outrosNomes.length) html += '<div class="kore-meta"><strong>Outros nomes:</strong> ' + escaparHTML(outrosNomes.join(", ")) + '</div>';
                if (pseudonimos.length) html += '<div class="kore-meta"><strong>Pseudónimos:</strong> ' + escaparHTML(pseudonimos.join(", ")) + '</div>';
                if (paises.length) html += '<div class="kore-meta"><strong>País:</strong> ' + escaparHTML(paises.join(", ")) + '</div>';
                if (nascimento) html += '<div class="kore-meta"><strong>Data de nascimento:</strong> ' + escaparHTML(nascimento) + '</div>';
                if (morte) html += '<div class="kore-meta"><strong>Data de morte:</strong> ' + escaparHTML(morte) + '</div>';
                if (ocupacoes.length) html += '<div class="kore-meta"><strong>Ocupação:</strong> ' + escaparHTML(ocupacoes.join(", ")) + '</div>';

                html += '<div class="kore-acoes">';
                html += '<a class="kore-btn" href="' + link + '" target="_blank" rel="noopener">Abrir</a>';
                html += '<button type="button" class="kore-copiar" data-valor="' + escaparHTML(qid) + '">Copiar QID</button>';
                html += '<button type="button" class="kore-aplicar-017" data-valor="' + escaparHTML(qid) + '" data-fonte="wikidata">Preencher 017</button>';
                html += '</div>';

                html += '</div>';
                html += '</div>';
                html += '</div>';
            });

            STATE.imagemWikidata = primeiraImagem || STATE.imagemWikidata || "";
    $("#kore-wikidata").html(html);
    renderDashboard();
        }

        function obterImagemWikidata(entidade) {
            if (!entidade || !entidade.claims || !entidade.claims.P18 || !entidade.claims.P18.length) return "";

            try {
                var ficheiro = entidade.claims.P18[0].mainsnak.datavalue.value;

                if (!ficheiro) return "";

                return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(ficheiro) + "?width=240";
            } catch (e) {
                return "";
            }
        }

        function pesquisarVIAF(termo) {
            $("#kore-viaf").html("<p>A pesquisar...</p>");

            $.ajax({
                url: "https://viaf.org/viaf/AutoSuggest?query=" + encodeURIComponent(termo),
                dataType: "json",
                success: function (dados) {
                    var html = "";

                    if (!dados.result || !dados.result.length) {
                        $("#kore-viaf").html("<p>Sem resultados.</p>");
                        return;
                    }

                    $.each(dados.result.slice(0, CONFIG.maxResultadosVIAF), function (i, item) {
                        var viafid = item.viafid || "";
                        var termoResultado = item.term || item.displayForm || "";
                        var link = "https://viaf.org/viaf/" + encodeURIComponent(viafid);

                        html += '<div class="kore-item">';
                        html += '<div class="kore-label">' + escaparHTML(termoResultado) + '</div>';
                        html += '<div class="kore-id">VIAF ' + escaparHTML(viafid) + '</div>';
                        html += '<div class="kore-acoes">';
                        html += '<a class="kore-btn" href="' + link + '" target="_blank" rel="noopener">Abrir</a>';
                        html += '<button type="button" class="kore-copiar" data-valor="' + escaparHTML(viafid) + '">Copiar VIAF</button>';
                        html += '<button type="button" class="kore-aplicar-017" data-valor="' + escaparHTML(viafid) + '" data-fonte="viaf">Preencher 017</button>';
                        html += '</div>';
                        html += '</div>';
                    });

                    $("#kore-viaf").html(html);
                },
                error: function () {
                    var termoURL = encodeURIComponent(termo);
                    var link = "https://viaf.org/viaf/search?query=local.names+all+%22" + termoURL + "%22&sortKeys=holdingscount&recordSchema=BriefVIAF";

                    $("#kore-viaf").html(
                        '<p>Erro ao consultar automaticamente o VIAF.</p>' +
                        '<p><a class="kore-btn" href="' + link + '" target="_blank" rel="noopener">Pesquisar diretamente no VIAF</a></p>'
                    );
                }
            });
        }

        function obterIdsClaims(entidade, propriedade) {
            var ids = [];

            if (!entidade || !entidade.claims || !entidade.claims[propriedade]) return ids;

            $.each(entidade.claims[propriedade], function (i, claim) {
                var id = obterIdClaim(claim);
                if (id) ids.push(id);
            });

            return ids;
        }

        function obterIdClaim(claim) {
            if (
                !claim ||
                !claim.mainsnak ||
                !claim.mainsnak.datavalue ||
                !claim.mainsnak.datavalue.value ||
                !claim.mainsnak.datavalue.value.id
            ) {
                return "";
            }

            return claim.mainsnak.datavalue.value.id;
        }

        function obterLabelsClaims(entidade, propriedade, entidadesRelacionadas) {
            var labels = [];
            var ids = obterIdsClaims(entidade, propriedade);

            $.each(ids, function (i, id) {
                var label = obterLabelEntidade(entidadesRelacionadas[id]);
                if (label) labels.push(label);
            });

            return removerDuplicados(labels);
        }

        function obterLabelEntidade(entidade) {
            if (!entidade || !entidade.labels) return "";

            if (entidade.labels.pt && entidade.labels.pt.value) return entidade.labels.pt.value;
            if (entidade.labels.en && entidade.labels.en.value) return entidade.labels.en.value;

            return "";
        }

        function obterDescricaoEntidade(entidade) {
            if (!entidade || !entidade.descriptions) return "";

            if (entidade.descriptions.pt && entidade.descriptions.pt.value) return entidade.descriptions.pt.value;
            if (entidade.descriptions.en && entidade.descriptions.en.value) return entidade.descriptions.en.value;

            return "";
        }

        function obterAliases(entidade) {
            var aliases = [];

            if (!entidade || !entidade.aliases) return aliases;

            if (entidade.aliases.pt) {
                $.each(entidade.aliases.pt, function (i, alias) {
                    if (alias.value) aliases.push(alias.value);
                });
            }

            if (entidade.aliases.en) {
                $.each(entidade.aliases.en, function (i, alias) {
                    if (alias.value) aliases.push(alias.value);
                });
            }

            return removerDuplicados(aliases);
        }

        function obterPrimeiraDataClaims(entidade, propriedade) {
            if (!entidade || !entidade.claims || !entidade.claims[propriedade] || !entidade.claims[propriedade].length) return "";

            var claim = entidade.claims[propriedade][0];

            if (!claim.mainsnak || !claim.mainsnak.datavalue || !claim.mainsnak.datavalue.value) return "";

            return formatarDataWikidata(claim.mainsnak.datavalue.value);
        }

        function formatarDataWikidata(valor) {
            if (!valor || !valor.time) return "";

            var data = valor.time.replace("+", "").replace("Z", "");
            var partes = data.split("T")[0].split("-");

            if (partes.length < 3) return "";

            var ano = partes[0];
            var mes = partes[1];
            var dia = partes[2];

            if (mes === "00") return ano;
            if (dia === "00") return mes + "/" + ano;

            return dia + "/" + mes + "/" + ano;
        }


        /* ==========================================================
           K●RE IDENTIDADE v6.0
           Camada de evolução segura sobre o motor v4.23.
           Mantém o motor bibliográfico estável e acrescenta:
           - menu operacional na ordem definida;
           - leitura semântica 200/400/500/7xx;
           - distinção entre variante, relação 500, outro autor e menção textual;
           - cartões de intervenção mais claros;
           - CSS premium JS-only, sem dependências externas;
           - remoção de dependência Font Awesome externa.
           ========================================================== */

        function garantirFontAwesome() {
            return;
        }

        function koreV6InstalarCamadaUX() {
            if (document.getElementById("kore-v61-ux")) return;
            var css = "";
            css += "#kore-identidade .kore-017-aplicado{outline:2px solid #12b76a!important;background:#ecfdf3!important;}";
            css += "#kore-identidade .kore-dashboard-actions{align-items:center!important;margin-bottom:8px!important;}";
            css += "#kore-identidade .kore-dashboard-progresslabel{display:inline-flex!important;align-items:center!important;gap:6px!important;font-weight:750!important;color:#1f2937!important;margin:5px 0 8px 0!important;}";
            css += "#kore-identidade .kore-operational-head{display:block!important;padding:0!important;border:0!important;background:transparent!important;}";
            css += "#kore-identidade .kore-operational-head p{display:none!important;}";
            css += "#kore-identidade .kore-operational-badge{display:none!important;}";
            css += "#kore-identidade .kore-v34-problems{border:0!important;background:transparent!important;margin-top:12px!important;}";
            css += "#kore-identidade .kore-problem-menu{display:flex!important;gap:8px!important;flex-wrap:wrap!important;align-items:center!important;padding:0!important;margin:0 0 12px 0!important;border:0!important;background:transparent!important;border-radius:0!important;box-shadow:none!important;}";
            css += "#kore-identidade .kore-problem-menu button{display:inline-flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;min-width:0!important;padding:3px 9px!important;border-radius:999px!important;background:#fff!important;font-size:12px!important;font-weight:800!important;line-height:1.35!important;}";
            css += "#kore-identidade .kore-problem-menu .kore-menu-label{white-space:nowrap!important;}";
            css += "#kore-identidade .kore-problem-menu .kore-problem-count{min-width:22px!important;text-align:center!important;border-radius:999px!important;padding:1px 7px!important;background:#fff!important;border:1px solid currentColor!important;font-size:11px!important;font-weight:900!important;margin:0!important;opacity:.9!important;}";
            css += "#kore-identidade .kore-menu-critical{border-color:#fecdca!important;color:#b42318!important;background:#fff7f6!important;}";
            css += "#kore-identidade .kore-menu-review{border-color:#fedf89!important;color:#b54708!important;background:#fffbf0!important;}";
            css += "#kore-identidade .kore-menu-context{border-color:#b9e6fe!important;color:#026aa2!important;background:#f0f9ff!important;}";
            css += "#kore-identidade .kore-menu-ok{border-color:#abefc6!important;color:#05603a!important;background:#f6fef9!important;}";
            css += "#kore-identidade .kore-menu-neutral{border-color:#d0d5dd!important;color:#344054!important;background:#f8fafc!important;}";
            css += "#kore-identidade .kore-filtro-ativo{box-shadow:0 0 0 2px rgba(0,128,163,.12)!important;background:#eef8fb!important;border-color:#0080a3!important;}";
            css += "#kore-identidade .kore-table-wrap{border:1px solid #d8e2ec!important;border-radius:8px!important;background:#fff!important;overflow:auto!important;}";
            css += "#kore-identidade .kore-table{table-layout:fixed!important;font-size:12px!important;}";
            css += "#kore-identidade .kore-table th{font-size:11px!important;text-transform:uppercase!important;letter-spacing:.02em!important;color:#1f2937!important;padding:9px 8px!important;background:#f8fafc!important;border-bottom:1px solid #d8e2ec!important;}";
            css += "#kore-identidade .kore-table td{padding:10px 8px!important;vertical-align:top!important;line-height:1.35!important;}";
            css += "#kore-identidade .kore-table th:nth-child(1),#kore-identidade .kore-table td:nth-child(1){width:72px!important;}";
            css += "#kore-identidade .kore-table th:nth-child(2),#kore-identidade .kore-table td:nth-child(2){width:180px!important;}";
            css += "#kore-identidade .kore-table th:nth-child(3),#kore-identidade .kore-table td:nth-child(3){width:70px!important;}";
            css += "#kore-identidade .kore-table th:nth-child(4),#kore-identidade .kore-table td:nth-child(4){width:132px!important;}";
            css += "#kore-identidade .kore-table th:nth-child(5),#kore-identidade .kore-table td:nth-child(5){width:520px!important;}";
            css += "#kore-identidade .kore-table th:nth-child(6),#kore-identidade .kore-table td:nth-child(6){width:112px!important;}";
            css += "#kore-identidade .kore-table th:nth-child(7),#kore-identidade .kore-table td:nth-child(7){width:190px!important;}";
            css += "#kore-identidade .kore-table th:nth-child(8),#kore-identidade .kore-table td:nth-child(8){width:220px!important;}";
            css += "#kore-identidade .kore-table th:nth-child(9),#kore-identidade .kore-table td:nth-child(9){width:132px!important;}";
            css += "#kore-identidade .kore-title-cell{font-size:12px!important;font-weight:800!important;color:#0f172a!important;}";
            css += "#kore-identidade .kore-v34-link{font-size:12px!important;font-weight:850!important;color:#005f86!important;text-decoration:none!important;}";
            css += "#kore-identidade .kore-marc-chip{display:inline-flex!important;align-items:center!important;border:1px solid #cfe0ea!important;background:#f4f9fb!important;border-radius:999px!important;padding:2px 7px!important;font-size:11px!important;font-weight:800!important;color:#24556b!important;}";
            css += "#kore-identidade .kore-priority-pill{display:inline-flex!important;align-items:center!important;gap:6px!important;border-radius:999px!important;padding:4px 9px!important;font-size:11px!important;font-weight:900!important;}";
            css += "#kore-identidade .kore-pill-critical{background:#fef3f2!important;color:#b42318!important;}";
            css += "#kore-identidade .kore-pill-review{background:#fff6e6!important;color:#b54708!important;}";
            css += "#kore-identidade .kore-pill-info{background:#eef4ff!important;color:#344054!important;}";
            css += "#kore-identidade .kore-row-critical td{border-left:0!important;background:#fffafa!important;}";
            css += "#kore-identidade .kore-row-review td{border-left:0!important;background:#fffdf7!important;}";
            css += "#kore-identidade .kore-v6-occ-card{border:1px solid #d8e2ec!important;background:#fff!important;border-radius:8px!important;padding:9px!important;box-shadow:0 1px 3px rgba(15,23,42,.04)!important;}";
            css += "#kore-identidade .kore-v6-occ-top{display:flex!important;justify-content:space-between!important;gap:10px!important;align-items:flex-start!important;margin-bottom:8px!important;}";
            css += "#kore-identidade .kore-v6-occ-title{font-size:12px!important;font-weight:850!important;color:#0f172a!important;line-height:1.35!important;}";
            css += "#kore-identidade .kore-v6-occ-meta{font-size:11px!important;color:#667085!important;margin-top:2px!important;}";
            css += "#kore-identidade .kore-v6-badge{display:inline-flex!important;align-items:center!important;border-radius:999px!important;padding:3px 8px!important;font-size:10px!important;font-weight:900!important;white-space:nowrap!important;}";
            css += "#kore-identidade .kore-v6-badge-critical{background:#fef3f2!important;color:#b42318!important;}";
            css += "#kore-identidade .kore-v6-badge-review{background:#fff6e6!important;color:#b54708!important;}";
            css += "#kore-identidade .kore-v6-badge-ok{background:#ecfdf3!important;color:#05603a!important;}";
            css += "#kore-identidade .kore-v6-badge-info{background:#eef4ff!important;color:#344054!important;}";
            css += "#kore-identidade .kore-v6-semantic{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:7px!important;margin-top:8px!important;}";
            css += "#kore-identidade .kore-v6-semantic>div{border:1px solid #d8e2ec!important;border-left:4px solid #98a2b3!important;background:#f8fafc!important;border-radius:6px!important;padding:7px!important;min-height:76px!important;font-size:11px!important;color:#1f2937!important;overflow:hidden!important;}";
            css += "#kore-identidade .kore-v6-semantic>div:nth-child(1){border-left-color:#0080a3!important;background:#f2fbfd!important;}";
            css += "#kore-identidade .kore-v6-semantic>div:nth-child(2){border-left-color:#64748b!important;}";
            css += "#kore-identidade .kore-v6-semantic>div:nth-child(3){border-left-color:#f79009!important;background:#fffaf0!important;}";
            css += "#kore-identidade .kore-v6-semantic>div:nth-child(5){border-left-color:#d92d20!important;background:#fff7ed!important;}";
            css += "#kore-identidade .kore-v6-semantic strong{display:block!important;font-size:10px!important;text-transform:uppercase!important;letter-spacing:.03em!important;color:#111827!important;margin-bottom:4px!important;}";
            css += "#kore-identidade .kore-v6-semantic-note{display:block!important;margin-top:4px!important;color:#667085!important;font-size:10px!important;line-height:1.3!important;}";
            css += "#kore-identidade .kore-v6-line{display:grid!important;grid-template-columns:54px 1fr!important;gap:7px!important;border:1px solid #d8e2ec!important;background:#fff!important;border-radius:6px!important;padding:6px 7px!important;margin:5px 0!important;font-size:11px!important;}";
            css += "#kore-identidade .kore-v6-line-label{font-weight:900!important;color:#0f172a!important;}";
            css += "#kore-identidade .kore-diagnostico{display:block!important;border:1px solid #d8e2ec!important;border-radius:7px!important;background:#f8fafc!important;padding:7px!important;font-size:11px!important;}";
            css += "#kore-identidade .kore-diagnostico-main{display:block!important;font-weight:850!important;color:#111827!important;margin-bottom:3px!important;}";
            css += "#kore-identidade .kore-diagnostico-sub{display:block!important;color:#667085!important;}";
            css += "#kore-identidade .kore-v6-action{display:block!important;border:1px solid #d8e2ec!important;border-radius:7px!important;background:#fff!important;padding:8px!important;font-size:12px!important;font-weight:850!important;color:#111827!important;}";
            css += "#kore-identidade .kore-v6-action small{display:block!important;margin-top:5px!important;font-size:11px!important;line-height:1.35!important;font-weight:600!important;color:#667085!important;}";
            css += "#kore-identidade .kore-table-links{display:grid!important;grid-template-columns:repeat(2,34px)!important;gap:7px!important;justify-content:start!important;}";
            css += "#kore-identidade .kore-table-links .kore-btn{width:42px!important;height:40px!important;padding:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border-radius:7px!important;background:#fff!important;}";
            css += "#kore-identidade .kore-link-icon{font-size:32px!important;line-height:1!important;}";
            css += "#kore-identidade .kore-link-aicon{font-size:26px!important;font-weight:900!important;line-height:1!important;}";
            css += "@media(max-width:1300px){#kore-identidade .kore-v6-semantic{grid-template-columns:repeat(2,minmax(0,1fr))!important;}#kore-identidade .kore-table{min-width:1500px!important;}}";
            var style = document.createElement("style");
            style.id = "kore-v61-ux";
            style.appendChild(document.createTextNode(css));
            document.head.appendChild(style);
        }

        function koreV6Numero(valor) {
            var n = Number(valor || 0);
            if (!isFinite(n) || n < 0) return 0;
            return n;
        }

        function koreV6ListaOcorrencias() {
            return STATE && STATE.ocorrencias ? STATE.ocorrencias : [];
        }

        function koreV6Problema(o) {
            return limparTexto(o && o.problema ? o.problema : "");
        }

        function koreV6EhOutroAutor(o) {
            var p = koreV6Problema(o);
            return p === "Outro authid" || p === "Outro autor" || p === "Autoridade diferente";
        }

        function koreV6EhResponsabilidade(o) {
            var p = koreV6Problema(o);
            return p === "Menção de responsabilidade" || p === "200$f vs. 7xx";
        }

        function koreV6EhSem9e4(o) {
            return koreV6Problema(o) === "Falta $9 e $4";
        }

        function koreV6EhLigado(o) {
            return koreV6Problema(o) === "Ligação correta";
        }

        function koreV6Filtrar(filtro) {
            var lista = koreV6ListaOcorrencias();
            filtro = filtro || "ligados";
            var contextoSelecionado = STATE.contextoSelecionado || "";

            return lista.filter(function (o) {
                if (filtro === "todos") return true;
                if (filtro === "ligados") return koreV6EhLigado(o);
                if (filtro === "variantesNome" || filtro === "variantes400") return false;
                if (filtro === "sem") return o.grupo === "sem";
                if (filtro === "contexto" && contextoSelecionado) return o.grupo === "contexto" && o.natureza === contextoSelecionado;
                if (filtro === "contexto") return o.grupo === "contexto";
                if (filtro === "imediata") return ["Falta $9 e $4", "Falta $9", "Falta $4", "Outro authid", "Outro autor"].indexOf(koreV6Problema(o)) !== -1;
                if (filtro === "manual") return o.grupo === "manual";
                if (String(filtro).indexOf("problema:") === 0) {
                    var problemaFiltro = String(filtro).replace("problema:", "");
                    if (problemaFiltro === "Falta $9") return ausencia9(o);
                    if (problemaFiltro === "Falta $4") return ausencia4(o);
                    if (problemaFiltro === "Falta $9 e $4") return koreV6EhSem9e4(o);
                    if (problemaFiltro === "Outro autor") return koreV6EhOutroAutor(o);
                    if (problemaFiltro === "200$f vs. 7xx") return koreV6EhResponsabilidade(o);
                    return koreV6Problema(o) === problemaFiltro;
                }
                return o.grupo === filtro;
            });
        }

        function countByFiltroOperacional(filtro) {
            if (filtro === "variantesNome" || filtro === "variantes400") {
                return ((STATE.authority && STATE.authority.variantes400) ? STATE.authority.variantes400.length : 0) +
                       ((STATE.authority && STATE.authority.relacionadas500) ? STATE.authority.relacionadas500.length : 0);
            }
            if (!STATE.dashboardExecutada && filtro !== "ligados") return 0;
            return koreV6Filtrar(filtro).length;
        }

        function contarPorProblema(problema) {
            if (!STATE.dashboardExecutada) return 0;
            if (problema === "Falta $9") return koreV6Filtrar("problema:Falta $9").length;
            if (problema === "Falta $4") return koreV6Filtrar("problema:Falta $4").length;
            if (problema === "Falta $9 e $4") return koreV6Filtrar("problema:Falta $9 e $4").length;
            if (problema === "Outro authid" || problema === "Outro autor") return koreV6Filtrar("problema:Outro autor").length;
            if (problema === "Menção de responsabilidade" || problema === "200$f vs. 7xx") return koreV6Filtrar("problema:200$f vs. 7xx").length;
            return koreV6ListaOcorrencias().filter(function (o) { return koreV6Problema(o) === problema; }).length;
        }

        function tituloFiltroOperacional(filtro) {
            if (filtro === "ligados") return "Ligados";
            if (filtro === "variantesNome" || filtro === "variantes400") return "Variantes do nome";
            if (filtro === "problema:Falta $9") return "Sem $9";
            if (filtro === "problema:Falta $4") return "Sem $4";
            if (filtro === "problema:Falta $9 e $4") return "Sem $9 e $4";
            if (filtro === "problema:Outro autor" || filtro === "problema:Outro authid") return "Outro autor";
            if (filtro === "problema:200$f vs. 7xx" || filtro === "problema:Menção de responsabilidade") return "200$f vs. 7xx";
            if (filtro === "contexto") return "Mapa de menções";
            if (filtro === "sem") return "Candidatos não confirmados";
            if (filtro === "todos") return "Todos";
            return "Lista operacional";
        }

        function descricaoFiltroOperacional(filtro) {
            if (filtro === "ligados") return "Registos bibliográficos com ponto de acesso estruturalmente ligado à autoridade atual.";
            if (filtro === "variantesNome" || filtro === "variantes400") return "Formas variantes 400 e relações 500 usadas como universo de identidade, não apenas como lista textual.";
            if (filtro === "problema:Falta $9") return "Pontos de acesso compatíveis com a autoridade mas sem ligação estrutural por $9.";
            if (filtro === "problema:Falta $4") return "Pontos de acesso ligados, mas sem código de função $4.";
            if (filtro === "problema:Falta $9 e $4") return "Pontos de acesso compatíveis sem ligação $9 e sem função $4, prioridade máxima de correção.";
            if (filtro === "problema:Outro autor" || filtro === "problema:Outro authid") return "Ocorrências compatíveis ou próximas ligadas a outro authid. Confirmar entidade, duplicado ou erro de ligação.";
            if (filtro === "problema:200$f vs. 7xx" || filtro === "problema:Menção de responsabilidade") return "Comparação entre a menção de responsabilidade 200$f, os pontos 7xx, variantes 400 e relações 500.";
            if (filtro === "contexto") return "Mapa de menções textuais em campos MARC, incluindo assuntos, notas e ocorrências sem função estrutural.";
            if (filtro === "sem") return "Candidatos recuperados por pesquisa, mas sem ocorrência MARC confirmada.";
            if (filtro === "todos") return "Todas as unidades operacionais identificadas pelo motor.";
            return "Selecione uma categoria para trabalhar registo a registo.";
        }

        function menuProblemaBotao(filtro, label, classe) {
            var n = koreV6Numero(countByFiltroOperacional(filtro));
            var ativo = (STATE.filtroIntervencao || "ligados") === filtro ? " kore-filtro-ativo" : "";
            return '<button type="button" class="kore-filtro-intervencao ' + escaparHTML(classe || "") + ativo + '" data-filtro="' + escaparHTML(filtro) + '" data-label="' + escaparHTML(label) + '" data-count="' + n + '">' +
                '<span class="kore-menu-label">' + escaparHTML(label) + '</span>' +
                '<span class="kore-problem-count">' + escaparHTML(String(n)) + '</span>' +
                '</button>';
        }

        function renderAreaIntervencao() {
            koreV6InstalarCamadaUX();
            if (!STATE.filtroIntervencao) STATE.filtroIntervencao = "problema:Falta $9";
            if (STATE.filtroIntervencao === "problema:Falta $9 e $4") STATE.filtroIntervencao = "problema:Falta $9";

            var html = "";
            html += '<div class="kore-v34-problems" id="kore-area-intervencao">';
            html += '<div class="kore-operational-head">';
            html += '<div>';
            html += '<h3 class="kore-operational-title-hidden">Intervenção bibliográfica</h3>';
            html += '<p>Unidades de intervenção bibliográfica ordenadas por urgência operacional. O filtro Sem $9 agrega também os casos em que faltam $9 e $4.</p>';
            html += '</div>';
            html += '</div>';
            html += '<div class="kore-problem-menu" role="tablist" aria-label="Filtros operacionais KORE">';
            html += menuProblemaBotao("problema:Falta $9", "Sem $9", "kore-menu-critical");
            html += menuProblemaBotao("problema:Falta $4", "Sem $4", "kore-menu-review");
            html += menuProblemaBotao("problema:200$f vs. 7xx", "200$f vs. 7xx", "kore-menu-review");
            html += menuProblemaBotao("problema:Outro autor", "Outro autor", "kore-menu-critical");
            html += menuProblemaBotao("variantesNome", "Variantes do nome", "kore-menu-neutral");
            html += menuProblemaBotao("ligados", "Ligados", "kore-menu-ok");
            html += '</div>';
            html += '</div>';

            html += '<div class="kore-v34-alert" id="kore-lista-alerta">ⓘ <span id="kore-tabela-contexto">Selecione uma categoria para trabalhar registo a registo.</span></div>';
            html += '<div class="kore-table-wrap kore-table-scroll">';
            html += '<table class="kore-table">';
            html += '<thead><tr>';
            html += '<th>Bib#</th><th>Título</th><th>Campo</th><th>Natureza</th><th>Ocorrência encontrada</th><th>Prioridade</th><th>Diagnóstico</th><th>Ação recomendada</th><th>Ligações</th>';
            html += '</tr></thead>';
            html += '<tbody id="kore-tabela-intervencao"></tbody>';
            html += '</table>';
            html += '</div>';
            html += '<div class="kore-table-footer"><span id="kore-tabela-resumo" class="kore-status-text"></span></div>';
            return html;
        }


        function koreV6Compatibilidade200(o) {
            var txt = limparTexto([
                o && o.valorEncontrado,
                o && o.natureza,
                o && o.origemRelacao,
                o && o.diagnostico,
                o && o.acaoDetalhada
            ].join(" "));
            return /forma autorizada|compat[ií]vel|coincide|variante|400|500|relacionad|heter[oó]nimo|pseud[oó]nimo/i.test(txt);
        }

        function koreV6PrioridadeOperacional(o) {
            var p = koreV6Problema(o);
            if (p === "Falta $9" || p === "Falta $9 e $4") return "Crítica";
            if (koreV6EhOutroAutor(o)) return "Crítica";
            if (p === "Falta $4") return "Atenção";
            if (koreV6EhResponsabilidade(o)) return koreV6Compatibilidade200(o) ? "Informativa" : "Crítica";
            if (p === "Ligação correta") return "OK";
            if (/400|500|variante|relacionad/i.test(limparTexto((o && o.natureza) || ""))) return "Informativa";
            return o && o.prioridade ? o.prioridade : "Informativa";
        }

        function koreV6ImpactoOPAC(o) {
            var p = koreV6Problema(o);
            if (p === "Falta $9" || p === "Falta $9 e $4" || koreV6EhOutroAutor(o)) return "Negativo";
            if (p === "Falta $4" || (koreV6EhResponsabilidade(o) && !koreV6Compatibilidade200(o))) return "Neutro";
            if (p === "Ligação correta") return "Positivo";
            return "Neutro";
        }

        function koreV6LinhaEstruturada(label, valor, classe) {
            if (!limparTexto(valor)) return "";
            return '<div class="kore-v6-line ' + escaparHTML(classe || "") + '"><span class="kore-v6-line-label">' + escaparHTML(label) + '</span><span>' + escaparHTML(limparValorMARCOperacional(valor)) + '</span></div>';
        }

        function koreV6ExtrairLinhasComparacao(raw) {
            raw = String(raw || "");
            var linhas = [];
            var padroes = [
                {label:"200$f", key:"200$f:", cls:"kore-v6-line-200"},
                {label:"7xx", key:"7xx:", cls:"kore-v6-line-7xx"},
                {label:"400", key:"400:", cls:"kore-v6-line-400"},
                {label:"500", key:"500:", cls:"kore-v6-line-500"},
                {label:"Cenário", key:"Cenário:", cls:"kore-v6-line-context"}
            ];
            padroes.forEach(function (p, idx) {
                var ini = raw.indexOf(p.key);
                if (ini === -1) return;
                var fim = raw.length;
                padroes.forEach(function (q) {
                    if (q.key === p.key) return;
                    var pos = raw.indexOf(q.key, ini + p.key.length);
                    if (pos !== -1 && pos < fim) fim = pos;
                });
                var val = raw.substring(ini + p.key.length, fim).replace(/^\s*\|\|\s*/, "").replace(/\s*\|\|\s*$/, "");
                linhas.push({label:p.label, valor:val, cls:p.cls});
            });
            return linhas;
        }

        function koreV6ClassificacaoSemantica(o) {
            var p = koreV6Problema(o);
            var natureza = limparTexto(o && o.natureza ? o.natureza : "");
            var valor = limparTexto(o && o.valorEncontrado ? o.valorEncontrado : "");
            var campo = limparTexto(o && o.campo ? o.campo : "");
            var result = {
                tipo: "Menção textual",
                detalhe: "Ocorrência textual que deve ser lida no contexto do campo MARC.",
                classe: "kore-v6-badge-info",
                badge: "Contexto"
            };

            if (p === "Ligação correta") {
                result.tipo = "Autor correto ligado";
                result.detalhe = "O ponto de acesso está estruturalmente ligado à autoridade atual por $9.";
                result.classe = "kore-v6-badge-ok";
                result.badge = "Ligado";
            } else if (p === "Falta $9 e $4") {
                result.tipo = "Acesso textual não ligado";
                result.detalhe = "A forma é compatível, mas faltam o vínculo à autoridade e a função catalográfica.";
                result.classe = "kore-v6-badge-critical";
                result.badge = "Crítico";
            } else if (p === "Falta $9") {
                result.tipo = "Acesso sem autoridade";
                result.detalhe = "A forma textual é compatível com o universo identitário, mas falta $9.";
                result.classe = "kore-v6-badge-critical";
                result.badge = "Sem $9";
            } else if (p === "Falta $4") {
                result.tipo = "Função ausente";
                result.detalhe = "Existe ligação estrutural, mas falta o código de função $4.";
                result.classe = "kore-v6-badge-review";
                result.badge = "Sem $4";
            } else if (koreV6EhOutroAutor(o)) {
                result.tipo = "Possível autoridade errada";
                result.detalhe = "A ocorrência está ligada a outro authid ou parece remeter para entidade distinta.";
                result.classe = "kore-v6-badge-review";
                result.badge = "Rever";
            } else if (koreV6EhResponsabilidade(o)) {
                result.tipo = "200$f vs. 7xx";
                result.detalhe = "Comparar menção de responsabilidade, pontos de acesso 7xx, variantes 400 e relações 500.";
                result.classe = "kore-v6-badge-review";
                result.badge = "Rever";
            }

            if (/^6\d\d$/.test(campo)) {
                result.detalhe += " O campo pertence ao bloco de assunto.";
            } else if (/^3\d\d$/.test(campo) || /^2\d\d$/.test(campo)) {
                result.detalhe += " O campo não é ponto de acesso de responsabilidade.";
            }

            if (/variante|400/i.test(natureza + " " + valor)) {
                result.tipo = "Variante conhecida";
                result.detalhe = "A forma parece estar coberta pelo campo 400, pelo que não deve ser tratada automaticamente como erro.";
            }

            if (/500|relacionad|heter[oó]nimo|pseud[oó]nimo/i.test(natureza + " " + valor)) {
                result.tipo = "Entidade relacionada";
                result.detalhe = "A ocorrência pode estar associada a uma relação 500. Confirmar se é identidade relacionada, heterónimo ou outra entidade.";
            }

            return result;
        }

        function koreV6HtmlOcorrencia(o) {
            var raw = String(o.valorEncontrado || "");
            var principal = limparValorMARCOperacional(raw) || "Sem detalhe";
            var sem = koreV6ClassificacaoSemantica(o);
            var campo = limparTexto(o.campo || "0");
            var authidEsperado = limparTexto(o.authidEsperado || "");
            var authidEncontrado = limparTexto(o.authidEncontrado || "");
            var funcao = limparTexto(o.codigoFuncao || "");
            var confianca = limparTexto(o.confianca || "") || (koreV6Compatibilidade200(o) ? "Alta" : (koreV6EhResponsabilidade(o) ? "Média" : "Média"));
            var origem = limparTexto(traduzirOrigemRelacao(o.origemRelacao || ""));
            var impacto = koreV6ImpactoOPAC(o);
            var linhas = koreV6ExtrairLinhasComparacao(raw);
            var html = "";

            html += '<div class="kore-v6-occ-card">';
            html += '<div class="kore-v6-occ-top">';
            html += '<div><div class="kore-v6-occ-title">' + escaparHTML(linhas.length ? "Análise operacional da ocorrência" : principal) + '</div>';
            html += '<div class="kore-v6-occ-meta">Campo ' + escaparHTML(campo || "0") + (origem ? " · " + escaparHTML(origem) : "") + ' · Confiança: ' + escaparHTML(confianca) + '</div></div>';
            html += '<span class="kore-v6-badge ' + sem.classe + '">' + escaparHTML(sem.badge) + '</span>';
            html += '</div>';

            if (linhas.length) {
                html += '<div class="kore-v6-occ-lines">';
                linhas.forEach(function (l) { html += koreV6LinhaEstruturada(l.label, l.valor, l.cls); });
                html += '</div>';
            }

            html += '<div class="kore-v6-semantic">';
            html += '<div><strong>Leitura</strong>' + escaparHTML(sem.tipo) + '<span class="kore-v6-semantic-note">' + escaparHTML(sem.detalhe) + '</span></div>';
            html += '<div><strong>Autoridade</strong>' + escaparHTML(authidEsperado ? ("Esperado: " + authidEsperado) : "Esperado: 0") + '<span class="kore-v6-semantic-note">' + escaparHTML(authidEncontrado ? ("Encontrado: " + authidEncontrado) : (ausencia9(o) ? "$9 vazio" : "Sem conflito $9")) + '</span></div>';
            html += '<div><strong>Função</strong>' + escaparHTML(codigo4Valido(funcao) ? formatarCodigoFuncao4(funcao, true) : (ausencia4(o) ? "$4 vazio" : "0")) + '<span class="kore-v6-semantic-note">' + escaparHTML(o.natureza || "Ocorrência bibliográfica") + '</span></div>';
            html += '<div><strong>Confiança</strong>' + escaparHTML(confianca) + '<span class="kore-v6-semantic-note">Baseada na compatibilidade 200/400/500/7xx.</span></div>';
            html += '<div><strong>Impacto OPAC</strong>' + escaparHTML(impacto) + '<span class="kore-v6-semantic-note">Efeito provável na descoberta pública e agregação.</span></div>';
            html += '</div>';
            if (linhas.length) html += '<details class="kore-v6-technical"><summary>Detalhes técnicos</summary><pre>' + escaparHTML(raw) + '</pre></details>';
            html += '</div>';
            return html;
        }

        function koreV6FormatarAcao(o) {
            var p = koreV6Problema(o);
            var titulo = "Analisar ocorrência";
            var detalhe = "Impacto: confirmar o contexto bibliográfico antes de intervir.";

            if (p === "Falta $9 e $4") {
                titulo = "Associar autoridade e preencher função.";
                detalhe = "Impacto: ligação ausente à autoridade e função/responsabilidade incompleta.";
            } else if (p === "Falta $9") {
                titulo = "Associar autoridade no $9.";
                detalhe = "Impacto: possível perda de agregação no OPAC.";
            } else if (p === "Falta $4") {
                titulo = "Ligação presente. Confirmar função e preencher $4.";
                detalhe = "Impacto: função/responsabilidade incompleta.";
            } else if (koreV6EhOutroAutor(o)) {
                titulo = "Confirmar entidade ou authid.";
                detalhe = "Impacto: possível ligação a autoridade errada.";
            } else if (koreV6EhResponsabilidade(o)) {
                titulo = koreV6Compatibilidade200(o) ? "Confirmar coerência entre 200$f e 7xx." : "Validar forma do nome e eventual variante 400.";
                detalhe = "Impacto: coerência entre responsabilidade textual e ponto de acesso.";
            } else if (koreV6EhLigado(o)) {
                titulo = "Ligação presente. Confirmar função e preencher $4.";
                detalhe = "Impacto: função/responsabilidade incompleta.";
            }

            return '<span class="kore-v6-action">' + escaparHTML(titulo) + '<small>' + escaparHTML(detalhe) + '</small></span>';
        }

        function renderTabelaIntervencao() {
            koreV6InstalarCamadaUX();

            var filtro = STATE.filtroIntervencao || "ligados";
            var contextoSelecionado = STATE.contextoSelecionado || "";
            var html = "";

            if (filtro === "variantesNome" || filtro === "variantes400") {
                var variantes = (STATE.authority && STATE.authority.variantes400) ? STATE.authority.variantes400 : [];
                var relacionadas = (STATE.authority && STATE.authority.relacionadas500) ? STATE.authority.relacionadas500 : [];
                var listaFormas = [];

                variantes.forEach(function(v){ listaFormas.push({campo:"400", natureza:"Variante do nome", item:v}); });
                relacionadas.forEach(function(v){ listaFormas.push({campo:"500", natureza:"Entidade relacionada", item:v}); });

                if (!listaFormas.length) {
                    html += '<tr><td colspan="9" class="kore-vazio">0 variantes 400 e 0 relações 500 registadas nesta autoridade.</td></tr>';
                } else {
                    listaFormas.forEach(function (linha) {
                        var v = linha.item || {};
                        var forma = formatarNomeDatas(limparValorMARCOperacional(v.forma || ""));
                        var estadoForma = linha.campo === "500" ? estadoCompletude500(v, STATE.authority || {}) : estadoCompletude400(v, STATE.authority || {});
                        var prioridade = estadoForma.estado === "ok" ? "Informativa" : "Revisão";
                        var relacao = linha.campo === "500" ? formatarRelacao5(v.relacao5) : "Forma alternativa, pseudónimo ou grafia variante";
                        var acao = linha.campo === "500"
                            ? (estadoForma.estado === "ok" ? "Usar como relação semântica qualificada." : "Completar 500, preferencialmente com $5 para qualificar a relação.")
                            : (estadoForma.estado === "ok" ? "Usar como variante segura no matching 200/7xx." : "Completar o 400 antes de o usar como variante segura.");

                        html += '<tr class="kore-row-info kore-v6-cardrow">';
                        html += '<td class="kore-small-cell">' + escaparHTML((STATE.authority && STATE.authority.authid) || "0") + '</td>';
                        html += '<td class="kore-title-cell">' + escaparHTML((STATE.authority && STATE.authority.nome) || "Autoridade") + '</td>';
                        html += '<td class="kore-small-cell"><span class="kore-marc-chip">' + escaparHTML(linha.campo) + '</span></td>';
                        html += '<td>' + escaparHTML(linha.natureza) + '</td>';
                        html += '<td><div class="kore-v6-occ-card"><div class="kore-v6-occ-top"><div><div class="kore-v6-occ-title">' + escaparHTML(forma || "Sem forma") + '</div><div class="kore-v6-occ-meta">' + escaparHTML(relacao) + (v.datas ? " · Datas: " + escaparHTML(v.datas) : " · Sem datas") + '</div></div><span class="kore-v6-badge ' + (linha.campo === "500" ? "kore-v6-badge-info" : "kore-v6-badge-ok") + '">' + escaparHTML(linha.campo) + '</span></div></div></td>';
                        html += '<td>' + prioridadePill(prioridade) + '</td>';
                        html += '<td><span class="kore-diagnostico"><span class="kore-diagnostico-main">' + escaparHTML(estadoForma.titulo) + '</span><span class="kore-diagnostico-sub">' + escaparHTML(estadoForma.detalhe) + '</span></span></td>';
                        html += '<td class="kore-action-cell"><span class="kore-v6-action">' + escaparHTML(estadoForma.estado === "ok" ? "Validado para matching" : "Completar autoridade") + '<small>' + escaparHTML(acao) + '</small></span></td>';
                        html += '<td class="kore-table-links"></td>';
                        html += '</tr>';
                    });
                }

                $("#kore-tabela-intervencao").html(html);
                $("#kore-tabela-contexto").text(variantes.length + " variante(s) 400 e " + relacionadas.length + " relação(ões) 500.");
                $("#kore-tabela-resumo").text("Mostrando " + listaFormas.length + " forma(s).");
                $("#kore-lista-titulo").text(tituloFiltroOperacional(filtro));
                $("#kore-lista-descricao").text(descricaoFiltroOperacional(filtro));
                $(".kore-filtro-intervencao").removeClass("kore-filtro-ativo");
                $(".kore-filtro-intervencao").filter(function(){ return $(this).data("filtro") === filtro; }).addClass("kore-filtro-ativo");
                return;
            }

            var lista = koreV6Filtrar(filtro);
            STATE.limiteIntervencao = 999999;
            var visiveis = lista.slice(0, STATE.limiteIntervencao);

            if (!visiveis.length) {
                html += '<tr><td colspan="9" class="kore-vazio">0 ocorrências nesta categoria. Carregue os bibliográficos para alimentar o motor de validação.</td></tr>';
            } else {
                visiveis.forEach(function (o) {
                    var links = o.links || {};
                    var prioridadeOperacional = koreV6PrioridadeOperacional(o);
                    html += '<tr class="' + classeLinhaPrioridade(prioridadeOperacional) + ' kore-v6-cardrow">';
                    html += '<td class="kore-small-cell"><a class="kore-v34-link" href="' + escaparHTML(links.detalhe || '#') + '" target="_blank" rel="noopener">' + escaparHTML(o.biblionumber || "0") + '</a></td>';
                    html += '<td class="kore-title-cell">' + escaparHTML(o.titulo || "Sem título") + '</td>';
                    html += '<td class="kore-small-cell"><span class="kore-marc-chip">' + escaparHTML(o.campo || "0") + '</span></td>';
                    html += '<td>' + escaparHTML(o.natureza || "") + '</td>';
                    html += '<td>' + koreV6HtmlOcorrencia(o) + '</td>';
                    html += '<td>' + prioridadePill(prioridadeOperacional) + '</td>';
                    html += '<td>' + formatarDiagnosticoTabela(o) + '</td>';
                    html += '<td class="kore-action-cell">' + koreV6FormatarAcao(o) + '</td>';
                    html += '<td><div class="kore-table-links">';
                    html += '<a class="kore-btn kore-link-edit" title="Editar registo bibliográfico" href="' + escaparHTML(links.editar || links.detalhe || '#') + '" target="_blank" rel="noopener"><i class="fa fa-pencil kore-link-icon" aria-hidden="true"></i></a>';
                    html += '<a class="kore-btn kore-link-record" title="Ver registo" href="' + escaparHTML(links.detalhe || '#') + '" target="_blank" rel="noopener"><i class="fa fa-file-text-o kore-link-icon" aria-hidden="true"></i></a>';
                    html += '<a class="kore-btn kore-link-marc" title="Ver MARC" href="' + escaparHTML(links.marc || '#') + '" target="_blank" rel="noopener"><span class="kore-link-aicon">$a</span></a>';
                    html += '<a class="kore-btn kore-link-opac" title="Abrir no OPAC" href="' + escaparHTML(links.opac || '#') + '" target="_blank" rel="noopener"><i class="fa fa-globe kore-link-icon" aria-hidden="true"></i></a>';
                    html += '</div></td>';
                    html += '</tr>';
                });
            }

            $("#kore-tabela-intervencao").html(html);
            $("#kore-tabela-resumo").text("Mostrando " + (visiveis.length ? "1 a " + visiveis.length : "0") + " de " + lista.length + " registo(s).");
            $("#kore-lista-titulo").text(tituloFiltroOperacional(filtro));
            $("#kore-lista-descricao").text(descricaoFiltroOperacional(filtro));
            $(".kore-filtro-intervencao").removeClass("kore-filtro-ativo");
            $(".kore-filtro-intervencao").filter(function(){ return $(this).data("filtro") === filtro; }).addClass("kore-filtro-ativo");
            $("#kore-tabela-contexto").text(descricaoFiltroOperacional(filtro));
            var lbl = $("#kore-dashboard-progresslabel").text() || "";
            var m = lbl.match(/Registos processados:\s*(\d+)\s*\/\s*(\d+)\s*\((\d+)%\)/);
            if (m) koreV61AtualizarEtiquetaProgresso(parseInt(m[1],10), parseInt(m[2],10), parseInt(m[3],10));
        }

        function construirUniversoIdentitario(authority) {
            var termos = [];

            if (!authority) return termos;

            if (authority.nome) termos.push(authority.nome);
            if (authority.nomeA && authority.nomeB) {
                termos.push(limparTexto(authority.nomeA + " " + authority.nomeB));
                termos.push(limparTexto(authority.nomeB + " " + authority.nomeA));
                termos.push(limparTexto(authority.nomeA + ", " + authority.nomeB));
                termos.push(limparTexto(authority.nomeB + ", " + authority.nomeA));
            }

            (authority.variantes400 || []).forEach(function (v) {
                if (v && v.forma) termos.push(v.forma);
            });

            (authority.relacionadas500 || []).forEach(function (v) {
                if (v && v.forma) termos.push(v.forma);
            });

            var limpos = [];
            removerDuplicados(termos).forEach(function (termo) {
                termo = limparValorMARCOperacional(termo);
                var n = normalizar(termo);
                if (n) limpos.push(n);

                var m = termo.match(/^([^,]+),\s*(.+)$/);
                if (m) {
                    limpos.push(normalizar(m[1] + " " + m[2]));
                    limpos.push(normalizar(m[2] + " " + m[1]));
                }
            });

            return removerDuplicados(limpos).filter(Boolean);
        }

        function textoAutoriaCompativel(texto, nomeNorm) {
            var t = normalizar(limparValorMARCOperacional(texto));
            if (!t || !nomeNorm) return false;

            var universo = construirUniversoIdentitario(STATE.authority || {});
            if (nomeNorm && universo.indexOf(nomeNorm) === -1) universo.push(nomeNorm);

            for (var i = 0; i < universo.length; i++) {
                var u = universo[i];
                if (!u) continue;
                if (t === u || t.indexOf(u) !== -1 || u.indexOf(t) !== -1) return true;

                var partesU = u.split(" ").filter(function (p) { return p.length > 2; });
                if (partesU.length) {
                    var encontrados = 0;
                    for (var j = 0; j < partesU.length; j++) {
                        if (t.indexOf(partesU[j]) !== -1) encontrados++;
                    }
                    if (encontrados >= Math.min(2, partesU.length)) return true;
                }
            }

            return false;
        }

        function renderCaixasReverMencoes() {
            var sem9e4 = contarPorProblema("Falta $9 e $4");
            var outro = contarPorProblema("Outro autor");
            var responsabilidade = contarPorProblema("200$f vs. 7xx");
            var contexto = (STATE.ocorrencias || []).filter(function (o) { return o.grupo === "contexto"; }).length;
            var tecnicos = (STATE.ocorrencias || []).filter(function (o) { return o.grupo === "sem"; }).length;
            var html = "";

            html += '<div class="kore-split-horizontal">';
            html += '<div class="kore-secondary-box kore-v6-rever-box">';
            html += '<div class="kore-secondary-head"><div><h3>Rever</h3><p>Casos que exigem decisão catalográfica antes de qualquer correção automática.</p></div></div>';
            html += '<div class="kore-secondary-body">';
            html += '<div class="kore-problem-grid">';
            html += renderProblemaCard(sem9e4, "Sem $9 e $4", "Ponto de acesso compatível, mas sem ligação estrutural nem função.", "Falta $9 e $4", "kore-problem-critical");
            html += renderProblemaCard(outro, "Outro autor", "Ligação ou correspondência que pode pertencer a outra autoridade.", "Outro autor", "kore-problem-review");
            html += renderProblemaCard(responsabilidade, "200$f vs. 7xx", "Comparar menção de responsabilidade, 7xx, variantes 400 e relações 500.", "200$f vs. 7xx", "kore-problem-review");
            html += '</div>';
            html += '</div>';
            html += '</div>';

            html += '<div class="kore-secondary-box">';
            html += '<div class="kore-secondary-head"><div><h3>Mapa de menções</h3><p>Ocorrências textuais, assuntos, notas e candidatos não confirmados.</p></div></div>';
            html += '<div class="kore-secondary-body">';
            html += '<div class="kore-summary-strip">';
            html += '<button type="button" class="kore-summary-tile kore-filtro-intervencao" data-filtro="contexto"><strong>' + contexto + '</strong><span>Menções textuais</span></button>';
            html += '<button type="button" class="kore-summary-tile kore-filtro-intervencao" data-filtro="sem"><strong>' + tecnicos + '</strong><span>Candidatos</span></button>';
            html += '<button type="button" class="kore-summary-tile kore-filtro-intervencao" data-filtro="variantesNome"><strong>' + countByFiltroOperacional("variantesNome") + '</strong><span>400/500</span></button>';
            html += '<button type="button" class="kore-summary-tile kore-filtro-intervencao" data-filtro="todos"><strong>' + countByFiltroOperacional("todos") + '</strong><span>Total</span></button>';
            html += '</div>';
            html += '</div>';
            html += '</div>';
            html += '</div>';

            return html;
        }

        function koreV6AjustesFinais() {
            koreV6InstalarCamadaUX();
            $("#kore-identidade .kore-problem-count, #kore-identidade .kore-v34-kpi-value, #kore-identidade .kore-modern-kpi-total, #kore-identidade .kore-metric-value").each(function () {
                var t = $.trim($(this).text() || "");
                if (!t || t === "-" || t === "—" || t === "NaN" || t === "undefined") $(this).text("0");
            });
        }

        $(document).off("korev6ready").on("korev6ready", function(){ koreV6AjustesFinais(); });
        setTimeout(koreV6AjustesFinais, 300);
        setTimeout(koreV6AjustesFinais, 1200);



});

})();
