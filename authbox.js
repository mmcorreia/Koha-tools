/* ==========================================================
   AUTHBOX — Caixa de Autoridade
   Miguel Mimoso Correia | CC-BY-NC-SA

   Corre na página de edição de uma autoridade do Koha
   (intranet) e mostra: identidade da autoridade, estado dos
   identificadores externos (Wikidata/VIAF, só leitura),
   completude do 200/400/500, e um painel de qualidade que
   valida a ligação estrutural entre esta autoridade e os
   registos bibliográficos que a citam (700/701/702, $9, $4).

   Este ficheiro NUNCA escreve no campo 017. A pesquisa e
   aplicação de identificadores é uma ferramenta à parte
   (authsearch.js), para que os dois possam evoluir sem
   dependerem um do outro.

   Nenhum pedido de rede feito por este ficheiro é diferente
   de GET. Nada aqui grava na base de dados do Koha; qualquer
   alteração a um registo continua a exigir que o catalogador
   a grave através da interface nativa do Koha.
   ========================================================== */

(function () {
    "use strict";

    if (window.__authboxAtivo) return;
    window.__authboxAtivo = true;

    $(document).ready(function () {
        if (!paginaAtualEhEditorAutoridade()) return;

        var CONFIG = {
            camposAutoria: ["700", "701", "702"],
            camposAssunto: ["600", "601", "602", "604", "605", "606", "607", "608"],
            maxCandidatosValidacao: 180,
            timeoutMARC: 12000
        };

        var CODIGOS_FUNCAO_AUTORIZADOS = {
            "000": "Indeterminada (função)", "005": "Actor", "010": "Adaptador", "020": "Anotador",
            "030": "Autor de arranjo musical", "040": "Artista", "050": "Responsável editorial",
            "060": "Nome associado", "065": "Leiloeiro", "070": "Autor (ou Co-Autor)",
            "072": "Autor em citações", "075": "Posfaciador", "080": "Autor da introdução (prefácio, prólogo)",
            "090": "Autor do diálogo", "100": "Antecedente bibliográfico", "110": "Encadernador",
            "120": "Responsável pela concepção da encadernação", "130": "Responsável pela concepção gráfica",
            "140": "Responsável pela concepção da capa e sobrecapa", "150": "Responsável pela concepção dos extratextos",
            "160": "Livreiro", "170": "Calígrafo", "180": "Cartógrafo", "190": "Censor",
            "200": "Coreógrafo", "205": "Colaborador", "210": "Comentador", "212": "Comentador (texto escrito)",
            "220": "Compilador", "230": "Compositor", "240": "Compositor gráfico",
            "245": "Ideia original de (usado para audiovisual)", "250": "Maestro",
            "260": "Detentor dos direitos de autor", "270": "Corrector", "273": "Organizador de exposição",
            "275": "Bailarino", "280": "Personalidade a quem é dedicada a obra", "290": "Autor da dedicatória",
            "300": "Director", "305": "Dissertador", "310": "Distribuidor", "320": "Doador",
            "330": "Autor incerto", "340": "Editor literário", "350": "Gravador (burilista)",
            "360": "Gravador (aguafortista)", "365": "Perito", "370": "Editor de filmes",
            "380": "Contrafactor", "390": "Antigo possuidor", "410": "Técnico gráfico",
            "420": "Em memória/honra de", "430": "Iluminista", "440": "Ilustrador",
            "445": "Empresário (teatral/musical)", "450": "Autor da apresentação", "460": "Entrevistado",
            "470": "Entrevistador", "480": "Libretista", "490": "Personalidade que detém licença",
            "500": "Pessoa que concede licença", "510": "Litógrafo", "520": "Autor de letras para trechos musicais",
            "530": "Gravador em metal", "540": "Supervisor", "545": "Músico", "550": "Narrador",
            "555": "Arguente", "557": "Organizador de conferência", "560": "Investigador", "570": "Outro",
            "580": "Fabricante de papel", "590": "Intérprete", "600": "Fotógrafo", "610": "Impressor",
            "620": "Impressor de ilustração em chapa gravada", "630": "Produtor", "632": "Director artístico",
            "633": "Equipa de produção", "640": "Revisor", "650": "Editor comercial",
            "660": "Destinatário de carta(s)", "670": "Técnico de gravação", "680": "Rubricador",
            "690": "Cenógrafo", "695": "Consultor científico", "700": "Escriba (copista)", "705": "Escultor",
            "710": "Relator", "720": "Autor de assinatura manuscrita", "721": "Cantor", "723": "Patrocinador",
            "727": "Orientador de tese", "730": "Tradutor", "740": "Responsável pela concepção do tipo",
            "750": "Tipógrafo", "755": "Entretainer", "760": "Gravador em madeira",
            "770": "Responsável pelo material acompanhante"
        };

        function codigoFuncaoAutorizado(codigo) {
            codigo = limparTexto(codigo || "").trim();
            if (!codigo) return true;
            return !!CODIGOS_FUNCAO_AUTORIZADOS[codigo];
        }

        var STATE = {
            authority: null,
            candidatos: [],
            ocorrencias: [],
            diagnostics: [],
            score: 0,
            filtroIntervencao: "ligados",
            contextoSelecionado: "",
            imagemWikidata: "",
            imagemWikidataQid: "",
            limiteIntervencao: 999999,
            dashboardExecutada: false,
            dashboardEmCurso: false,
            dashboardToken: 0,
            xhrDashboard: [],
            colapsado: false
        };

        if (!paginaAtualEhEditorAutoridade()) return;

        $("#authbox").remove();
        construirInterface();
        instalarEstilos();
        atualizarAuthorityState();
        renderPainel();
        if (lerColapsoGuardado()) aplicarColapso(true);
        ligarEventos();

        // ---------------------------------------------------------------
        // Guarda de página e utilitários gerais
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

        function obterAuthidAtual() {
            var params = new URLSearchParams(window.location.search || "");
            var authid = params.get("authid");
            return authid && /^\d+$/.test(authid) ? authid : "";
        }

        function limparTexto(txt) {
            return String(txt || "").replace(/\s+/g, " ").trim();
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
            if (m) return limparTexto(m[1]) + ", " + limparTexto(m[2]) + (m[3] ? " " + limparTexto(m[3]) : "");

            m = valor.match(/^(.+?)\s+Outra parte do nome não tomada para palavra de ordem\s+(.+?)(?:\s+Datas\s+(.+))?$/i);
            if (m) return limparTexto(m[1]) + ", " + limparTexto(m[2]) + (m[3] ? " " + limparTexto(m[3]) : "");

            m = valor.match(/^(.+?)\s+Autoridade\s+Outra parte do nome não tomada para\s+(.+?)\s+((?:\d{4}|\?{4}|[ca]\.\s*\d{4}).*)$/i);
            if (m) return limparTexto(m[1]) + ", " + limparTexto(m[2]) + " " + limparTexto(m[3]);

            m = valor.match(/^(.+?)\s+Outra parte do nome não tomada para\s+(.+?)\s+((?:\d{4}|\?{4}|[ca]\.\s*\d{4}).*)$/i);
            if (m) return limparTexto(m[1]) + ", " + limparTexto(m[2]) + " " + limparTexto(m[3]);

            m = valor.match(/^(.+?)\s+Autoridade\s+Outra parte do nome não tomada para\s+(.+)$/i);
            if (m) return limparTexto(m[1]) + ", " + limparTexto(m[2]);

            m = valor.match(/^(.+?)\s+Outra parte do nome não tomada para\s+(.+)$/i);
            if (m) return limparTexto(m[1]) + ", " + limparTexto(m[2]);

            return valor
                .replace(/\bPalavra de ordem\b\s*/ig, "")
                .replace(/\bAutoridade\b\s*/ig, "")
                .replace(/\bOutra parte do nome não tomada para palavra de ordem\b\s*/ig, ", ")
                .replace(/\bOutra parte do nome não tomada para\b\s*/ig, ", ")
                .replace(/\bDatas\b\s*/ig, " ")
                .replace(/\s+,\s+/g, ", ")
                .replace(/\s+/g, " ")
                .trim();
        }

        function escaparHTML(txt) {
            return String(txt || "")
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }

        function escaparRegex(txt) {
            return String(txt || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }

        function normalizar(txt) {
            return String(txt || "")
                .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
                .replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
        }

        function removerDuplicados(lista) {
            var vistos = {}; var resultado = [];
            $.each(lista || [], function (i, v) {
                v = limparTexto(v);
                if (!v || vistos[v]) return;
                vistos[v] = true; resultado.push(v);
            });
            return resultado;
        }

        function contemPalavraInteira(texto, palavra) {
            if (!texto || !palavra) return false;
            var re = new RegExp("(^|[^a-z0-9])" + escaparRegex(palavra) + "($|[^a-z0-9])", "i");
            return re.test(" " + texto + " ");
        }

        // ---------------------------------------------------------------
        // Persistência local: estado de revisão (Resolvido / Falso positivo)
        // ---------------------------------------------------------------

        function chaveArmazenamentoRevisao(authid) { return "authbox_revisao_" + authid; }

        function lerEstadosRevisao(authid) {
            if (!authid) return {};
            try { return JSON.parse(localStorage.getItem(chaveArmazenamentoRevisao(authid)) || "{}"); }
            catch (e) { return {}; }
        }

        function gravarEstadoRevisao(authid, chave, estado) {
            if (!authid || !chave) return;
            try {
                var estados = lerEstadosRevisao(authid);
                if (estado) estados[chave] = { estado: estado, em: Date.now() };
                else delete estados[chave];
                localStorage.setItem(chaveArmazenamentoRevisao(authid), JSON.stringify(estados));
            } catch (e) { console.warn("Authbox: não foi possível gravar o estado de revisão.", e); }
        }

        function chaveOcorrencia(dados) {
            var obra = dados.obra || {};
            return [obra.biblionumber || "", dados.campo || "", dados.problema || "",
                normalizar(String(dados.valorEncontrado || "")).slice(0, 60)].join("|");
        }

        function estaResolvida(o) {
            return !!(o && (o.estadoRevisao === "confirmado" || o.estadoRevisao === "falso_positivo"));
        }

        function lerColapsoGuardado() {
            try { return localStorage.getItem("authbox_colapsado") === "1"; } catch (e) { return false; }
        }

        function gravarColapsoGuardado(v) {
            try { localStorage.setItem("authbox_colapsado", v ? "1" : "0"); } catch (e) { /* silencioso */ }
        }

        // ---------------------------------------------------------------
        // Leitura da autoridade (200, 017 só-leitura, 400, 500)
        // ---------------------------------------------------------------

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
                nomeA: nomeA, nomeB: nomeB, nome: nome, datas: datas,
                wikidata: ids017.filter(function (i) { return i.tipo === "wikidata"; }),
                viaf: ids017.filter(function (i) { return i.tipo === "viaf"; }),
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
                    campo = li; return false;
                }
            });
            return campo;
        }

        function obterValorSubcampo(campo, etiqueta) {
            var valor = "";
            if (!campo.length) return "";
            campo.find("li, div, p, tr").each(function () {
                var linha = $(this);
                var texto = limparTexto(linha.text());
                if (texto.indexOf(etiqueta) === -1) return;
                var input = linha.find("input[type='text'], textarea").filter(function () {
                    return $(this).is(":visible") && $(this).outerWidth() > 70;
                }).last();
                if (input.length) { valor = limparTexto(input.val()); return false; }
            });
            return valor;
        }

        function obterValorSubcampoPorCodigo(campo, codigo) {
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
                    id.indexOf("subfield_" + codigo) !== -1 || name.indexOf("subfield_" + codigo) !== -1 ||
                    id.match(new RegExp("_" + codigo + "($|_)", "i")) || name.match(new RegExp("_" + codigo + "($|_)", "i")) ||
                    cls.indexOf("subfield_" + codigo) !== -1 || contexto.indexOf("$" + codigo) !== -1;
                if (!corresponde) return;
                var v = limparTexto(el.val());
                if (v) { valor = v; return false; }
            });

            if (valor) return valor;
            var texto = limparTexto(campo.text());
            var re = new RegExp("\\$" + codigo + "\\s*[:=]?\\s*([^$]+)", "i");
            var m = texto.match(re);
            if (m && m[1]) valor = limparTexto(m[1]);
            return valor;
        }

        // Só-leitura: encontra os campos 017 já preenchidos, para os mostrar
        // no cartão de identidade. Nunca escreve. A aplicação (escrita) de
        // um novo identificador é feita por authsearch.js.
        function obterIdentificadores017Atuais() {
            var identificadores = []; var vistos = {};
            $("li, div, tr").each(function () {
                var bloco = $(this);
                var texto = limparTexto(bloco.text());
                if (texto.indexOf("017") === -1) return;
                if (texto.indexOf("Identificador") === -1) return;
                if (texto.indexOf("Sistema de codificação") === -1) return;

                var campoA = encontrarCampoPorEtiqueta(bloco, "Identificador");
                var campo2 = encontrarCampoPorEtiqueta(bloco, "Sistema de codificação");
                if (!campoA.length && !campo2.length) return;

                var valorA = campoA.length ? limparTexto(campoA.val()) : "";
                var valor2 = campo2.length ? limparTexto(campo2.val()).toLowerCase() : "";
                if (!valorA && !valor2) return;

                identificadores.push({ valor: valorA, fonte: valor2, tipo: classificarIdentificador017(valorA, valor2) });
            });
            return identificadores;
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

        function escaparSelector(txt) {
            if ($.escapeSelector) return $.escapeSelector(txt);
            return String(txt || "").replace(/([ #;?%&,.+*~':"!^$[\]()=>|\/@])/g, "\\$1");
        }

        function classificarIdentificador017(valor, fonte) {
            var v = String(valor || "").trim();
            var f = String(fonte || "").toLowerCase();
            if (/^Q\d+$/i.test(v) || f.indexOf("wikidata") !== -1) return "wikidata";
            if (/^\d+$/.test(v) && f.indexOf("viaf") !== -1) return "viaf";
            return "outro";
        }

        function obterVariantes400Autoridade() {
            var variantes = []; var vistos = {};
            $("li, div, tr").each(function () {
                var bloco = $(this);
                var texto = limparTexto(bloco.text());
                if (texto.indexOf("400") === -1) return;
                if (texto.indexOf("Palavra de ordem") === -1 && texto.indexOf("Outra parte do nome") === -1 &&
                    texto.indexOf("Forma variante") === -1 && texto.indexOf("Ver também") === -1) return;

                var nomeA = obterValorSubcampo(bloco, "Palavra de ordem");
                var nomeB = obterValorSubcampo(bloco, "Outra parte do nome");
                var datas = obterValorSubcampo(bloco, "Datas");
                var formas = [];
                if (nomeB || nomeA) {
                    formas.push(limparTexto([nomeB, nomeA].filter(Boolean).join(" ")));
                    formas.push(limparTexto([nomeA, nomeB].filter(Boolean).join(" ")));
                }
                if (!formas.length) {
                    var bruto = limparTexto(texto.replace(/^.*?\b400\b/, "").replace(/Palavra de ordem|Outra parte do nome|Datas|Forma variante|Ver também/gi, " "));
                    if (bruto && bruto.length < 180) formas.push(bruto);
                }
                formas.forEach(function (forma) {
                    forma = limparTexto(forma);
                    if (!forma || forma.length < 3) return;
                    var chave = normalizar(forma);
                    if (!chave || vistos[chave]) return;
                    vistos[chave] = true;
                    variantes.push({ forma: forma, nomeA: nomeA || "", nomeB: nomeB || "", datas: datas || "" });
                });
            });
            return variantes;
        }

        function obterRelacionadas500Autoridade() {
            var relacionadas = []; var vistos = {};
            $("li, div, tr").each(function () {
                var bloco = $(this);
                var texto = limparTexto(bloco.text());
                if (texto.indexOf("500") === -1) return;
                if (texto.indexOf("Palavra de ordem") === -1 && texto.indexOf("Outra parte do nome") === -1 &&
                    texto.indexOf("Forma relacionada") === -1 && texto.indexOf("Ver também") === -1) return;

                var nomeA = obterValorSubcampo(bloco, "Palavra de ordem");
                var nomeB = obterValorSubcampo(bloco, "Outra parte do nome");
                var datas = obterValorSubcampo(bloco, "Datas");
                var relacao5 = obterValorSubcampoPorCodigo(bloco, "5") || obterValorSubcampo(bloco, "Código de relação") || obterValorSubcampo(bloco, "Relação");
                var formas = [];
                if (nomeB || nomeA) {
                    formas.push(limparTexto([nomeB, nomeA].filter(Boolean).join(" ")));
                    formas.push(limparTexto([nomeA, nomeB].filter(Boolean).join(" ")));
                }
                if (!formas.length) {
                    var bruto = limparTexto(texto.replace(/^.*?\b500\b/, "").replace(/Palavra de ordem|Outra parte do nome|Datas|Forma relacionada|Ver também/gi, " "));
                    if (bruto && bruto.length < 180) formas.push(bruto);
                }
                formas.forEach(function (forma) {
                    forma = limparTexto(forma);
                    if (!forma || forma.length < 3) return;
                    var chave = normalizar(forma);
                    if (!chave || vistos[chave]) return;
                    vistos[chave] = true;
                    relacionadas.push({ forma: forma, nomeA: nomeA || "", nomeB: nomeB || "", datas: datas || "", relacao5: relacao5 || "" });
                });
            });
            return relacionadas;
        }

        function construirUniversoIdentitario(authority) {
            var termos = [];
            if (!authority) return termos;
            if (authority.nome) termos.push(authority.nome);
            if (authority.nomeA && authority.nomeB) {
                termos.push(limparTexto(authority.nomeB + " " + authority.nomeA));
                termos.push(limparTexto(authority.nomeA + " " + authority.nomeB));
                termos.push(limparTexto(authority.nomeA + ", " + authority.nomeB));
                termos.push(limparTexto(authority.nomeB + ", " + authority.nomeA));
            }
            (authority.variantes400 || []).forEach(function (v) { if (v && v.forma) termos.push(v.forma); });
            (authority.relacionadas500 || []).forEach(function (v) { if (v && v.forma) termos.push(v.forma); });

            var limpos = [];
            removerDuplicados(termos).forEach(function (termo) {
                termo = limparValorMARCOperacional(termo);
                var n = normalizar(termo);
                if (n) limpos.push(n);
                var m = termo.match(/^([^,]+),\s*(.+)$/);
                if (m) { limpos.push(normalizar(m[1] + " " + m[2])); limpos.push(normalizar(m[2] + " " + m[1])); }
            });
            return removerDuplicados(limpos).filter(Boolean);
        }

        function analisarEstadoDatas(datas) {
            var d = limparTexto(datas || "");
            if (!d) return { estado: "bad", label: "Datas ausentes", detalhe: "Campo 200$f ausente ou sem datas." };

            var texto = d.replace(/\u2010|\u2011|\u2012|\u2013|\u2014|\u2212/g, "-").replace(/\s+/g, " ").trim();
            var numeros = texto.match(/\d{3,4}/g) || [];
            var intervaloFechado = /\d{3,4}\s*-\s*\d{3,4}/.test(texto);
            var intervaloAbertoDepois = /\d{3,4}\s*-\s*$/.test(texto);
            var intervaloAbertoAntes = /^-\s*\d{3,4}/.test(texto);

            if (intervaloFechado || numeros.length >= 2) return { estado: "ok", label: "Datas completas", detalhe: d };
            if (intervaloAbertoDepois && numeros.length === 1) return { estado: "warn", label: "Falta data de morte", detalhe: d };
            if (intervaloAbertoAntes && numeros.length === 1) return { estado: "warn", label: "Falta data de nascimento", detalhe: d };
            if (numeros.length === 1) return { estado: "warn", label: "Data única", detalhe: d };
            return { estado: "bad", label: "Datas não interpretadas", detalhe: d };
        }

        function estadoCompletude400(item, authority) {
            var forma = limparTexto(item && item.forma || "");
            var datas = limparTexto(item && item.datas || "");
            var temDatasAutoridade = !!limparTexto(authority && authority.datas || "");
            var problemas = [];
            if (!forma) problemas.push("forma vazia");
            if (temDatasAutoridade && !datas) problemas.push("datas vazias");
            if (!problemas.length) return { estado: "ok", titulo: "400 completo", detalhe: "Forma variante preenchida e coerente com a estrutura mínima da autoridade." };
            return { estado: "warn", titulo: "Completar 400", detalhe: "Campo 400 incompleto: " + problemas.join(" · ") + "." };
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
            if (!problemas.length) return { estado: "ok", titulo: "500 completo", detalhe: "Forma relacionada preenchida e relação qualificada no $5." };
            return { estado: "warn", titulo: "Qualificar 500", detalhe: "Campo 500 incompleto: " + problemas.join(" · ") + "." };
        }

        function formatarRelacao5(valor) {
            valor = limparTexto(valor || "");
            if (!valor) return "$5 vazio";
            var mapa = { a: "nome anterior", b: "nome posterior", c: "nome real", d: "pseudónimo", e: "heterónimo", f: "identidade relacionada", g: "forma associada", h: "entidade relacionada" };
            var k = valor.toLowerCase();
            return mapa[k] ? (mapa[k] + " [$5 " + valor + "]") : ("$5 " + valor);
        }

        // ---------------------------------------------------------------
        // Diagnóstico e pontuação
        // ---------------------------------------------------------------

        function diagnosticarAutoridade(authority) {
            var issues = [];
            if (!authority.authid) issues.push(issue("critical", "Autoridade sem authid", "A validação bibliográfica completa só fica disponível depois de gravar a autoridade.", "Gravar a autoridade antes de validar relações bibliográficas."));
            if (!authority.nomeA) issues.push(issue("critical", "200$a ausente", "A palavra de ordem não foi identificada.", "Completar o campo 200$a."));
            if (!authority.nomeB) issues.push(issue("review", "200$b ausente", "A outra parte do nome não foi identificada.", "Confirmar a estrutura do nome."));
            if (!authority.wikidata.length) issues.push(issue("review", "Wikidata ausente", "Não foi encontrado QID no campo 017.", "Pesquisar e aplicar QID no 017."));
            if (!authority.viaf.length) issues.push(issue("review", "VIAF ausente", "Não foi encontrado identificador VIAF no campo 017.", "Pesquisar e aplicar VIAF no 017."));

            authority.wikidata.forEach(function (id) {
                if (!/^Q\d+$/i.test(id.valor)) issues.push(issue("critical", "QID inválido", "O valor " + id.valor + " não tem formato QID válido.", "Corrigir 017$a para um identificador Wikidata do tipo Q123."));
            });
            authority.viaf.forEach(function (id) {
                if (!/^\d+$/.test(id.valor)) issues.push(issue("critical", "VIAF inválido", "O valor " + id.valor + " não tem formato numérico.", "Corrigir 017$a para o identificador VIAF numérico."));
            });
            if (authority.wikidata.length > 1) issues.push(issue("critical", "Múltiplos QID", "A autoridade tem mais do que um identificador Wikidata real no 017.", "Confirmar identidade e remover identificadores indevidos."));
            if (authority.viaf.length > 1) issues.push(issue("review", "Múltiplos VIAF", "A autoridade tem mais do que um identificador VIAF real no 017.", "Confirmar se todos correspondem à mesma entidade."));

            var estadoDatas = analisarEstadoDatas(authority.datas);
            if (estadoDatas.estado === "bad") issues.push(issue("review", estadoDatas.label, estadoDatas.detalhe, "Completar o campo 200$f quando as datas forem conhecidas."));
            else if (estadoDatas.estado === "warn") issues.push(issue("review", estadoDatas.label, estadoDatas.detalhe, "Confirmar se é possível completar a informação cronológica."));

            if (!authority.variantes400 || !authority.variantes400.length) issues.push(issue("info", "Campo 400 ausente", "A autoridade não apresenta formas variantes registadas.", "Adicionar variantes quando existirem formas alternativas, pseudónimos ou formas de remissão."));

            (authority.variantes400 || []).forEach(function (v) {
                var e = estadoCompletude400(v, authority);
                if (e.estado !== "ok") issues.push(issue("review", e.titulo, e.detalhe, "Completar o campo 400 antes de o usar como referência de validação."));
            });
            (authority.relacionadas500 || []).forEach(function (v) {
                var e = estadoCompletude500(v, authority);
                if (e.estado !== "ok") issues.push(issue("review", e.titulo, e.detalhe, "Confirmar a forma relacionada e preencher o $5 para qualificar a relação."));
            });

            return issues;
        }

        function issue(severity, title, text, action) { return { severity: severity, title: title, text: text, action: action }; }

        // A pontuação é uma média ponderada de três dimensões independentes,
        // cada uma normalizada a 0–100, para que nenhuma sature as outras e
        // para que o resultado não dependa do volume de registos citados:
        //  - integridade bibliográfica (peso 50%): proporção de ocorrências
        //    7xx estruturalmente resolvidas sobre o total, excluindo as já
        //    marcadas como falso positivo;
        //  - completude da autoridade (peso 30%): proporção de diagnósticos
        //    da própria autoridade sem problema;
        //  - identificadores externos (peso 20%): Wikidata e VIAF presentes
        //    e com formato válido.
        function calcularScore() {
            var authority = STATE.authority;
            var diagnostics = STATE.diagnostics || [];
            var ocorrencias = (STATE.ocorrencias || []).filter(function (o) { return !estaResolvida(o); });

            var pesoBib = 0.5, pesoAutoridade = 0.3, pesoIds = 0.2;
            var scoreBib = 100, scoreAutoridade = 100, scoreIds = 0;

            var relevantes = ocorrencias.filter(function (o) {
                return o.grupo === "imediata" || o.grupo === "manual" || problemaOcorrencia(o) === "Ligação correta";
            });
            if (STATE.dashboardExecutada && relevantes.length) {
                var ligadas = relevantes.filter(function (o) { return problemaOcorrencia(o) === "Ligação correta"; }).length;
                scoreBib = Math.round((ligadas / relevantes.length) * 100);
            } else if (STATE.dashboardExecutada) {
                scoreBib = 100;
            }

            var pesoDiagnostico = { critical: 14, review: 6, info: 2 };
            var penalizacaoAutoridade = 0;
            diagnostics.forEach(function (d) { penalizacaoAutoridade += pesoDiagnostico[d.severity] || 0; });
            scoreAutoridade = Math.max(0, 100 - penalizacaoAutoridade);

            if (authority) {
                var temWD = authority.wikidata.length && /^Q\d+$/i.test(authority.wikidata[0].valor);
                var temVIAF = authority.viaf.length && /^\d+$/.test(authority.viaf[0].valor);
                scoreIds = (temWD ? 50 : 0) + (temVIAF ? 50 : 0);
            }

            var total = scoreBib * pesoBib + scoreAutoridade * pesoAutoridade + scoreIds * pesoIds;
            return Math.max(0, Math.min(100, Math.round(total)));
        }

        function estadoScore(score) {
            if (score >= 80) return { label: "Bom", classe: "abx-score-good" };
            if (score >= 55) return { label: "A rever", classe: "abx-score-warning" };
            return { label: "Crítico", classe: "abx-score-critical" };
        }

        // ---------------------------------------------------------------
        // Imagem Wikidata (leitura, para o cartão de identidade)
        // ---------------------------------------------------------------

        function obterImagemDashboard() {
            if (STATE.imagemWikidata) return STATE.imagemWikidata;
            var qid = (STATE.authority && STATE.authority.wikidata.length) ? STATE.authority.wikidata[0].valor : "";
            if (qid && /^Q\d+$/i.test(qid)) carregarImagemWikidataPorQid(qid);
            return "";
        }

        function carregarImagemWikidataPorQid(qid) {
            qid = String(qid || "").toUpperCase();
            if (!qid || !/^Q\d+$/.test(qid)) return;
            if (STATE.imagemWikidataQid === qid) return;

            $.ajax({
                url: "https://www.wikidata.org/wiki/Special:EntityData/" + encodeURIComponent(qid) + ".json",
                method: "GET", dataType: "json", timeout: 9000
            }).done(function (data) {
                var entidade = data && data.entities ? data.entities[qid] : null;
                var imagem = obterImagemWikidataDeEntidade(entidade);
                if (imagem) { STATE.imagemWikidata = imagem; STATE.imagemWikidataQid = qid; renderPainel(); }
            });
        }

        function obterImagemWikidataDeEntidade(entidade) {
            if (!entidade || !entidade.claims || !entidade.claims.P18 || !entidade.claims.P18.length) return "";
            try {
                var ficheiro = entidade.claims.P18[0].mainsnak.datavalue.value;
                if (!ficheiro) return "";
                return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(ficheiro) + "?width=240";
            } catch (e) { return ""; }
        }

        // ---------------------------------------------------------------
        // Interface
        // ---------------------------------------------------------------

        function construirInterface() {
            var html = "";
            html += '<div id="authbox">';
            html += '  <div id="authbox-header">';
            html += '    <div id="authbox-header-titulo"><div id="authbox-icone">' + iconeOk() + '</div>';
            html += '      <div><strong>Caixa de Autoridade</strong><p>Identidade, identificadores e qualidade da ligação bibliográfica.</p></div></div>';
            html += '    <button type="button" id="authbox-colapsar">' + iconeSeta() + ' <span id="authbox-colapsar-txt">Ocultar</span></button>';
            html += '  </div>';
            html += '  <div id="authbox-corpo"><div id="authbox-corpo-inner">';
            html += '    <div id="authbox-identidade"></div>';
            html += '    <div id="authbox-kpis"></div>';
            html += '    <div id="authbox-controlbar">';
            html += '      <button type="button" id="authbox-carregar">' + iconePlay() + ' Carregar bibliográficos</button>';
            html += '      <div id="authbox-progresso-wrap" class="authbox-fechado"><div id="authbox-progresso-barra"><span id="authbox-progresso-fill"></span></div></div>';
            html += '      <span id="authbox-progresso-texto">Registos processados: 0 / 0 (0%)</span>';
            html += '    </div>';
            html += '    <div id="authbox-status" class="authbox-vazio">Aguardando carregamento bibliográfico.</div>';
            html += '    <div id="authbox-area-intervencao"></div>';
            html += '  </div></div>';
            html += '</div>';

            var $alvo = $("h1").first().length ? $("h1").first() :
                $("#main_intranet-main").first().length ? $("#main_intranet-main").first() :
                $("#main").first().length ? $("#main").first() : $("body").first();

            if ($alvo.is("h1")) $alvo.after(html); else $alvo.prepend(html);
        }

        function ligarEventos() {
            $("#authbox-colapsar").on("click", function () {
                var colapsado = !$("#authbox").hasClass("colapsado");
                aplicarColapso(colapsado);
                gravarColapsoGuardado(colapsado);
            });

            $("#authbox-carregar").on("click", function () { executarDashboardCompleto(); });

            $(document).on("click.authbox", "#authbox-area-intervencao .authbox-filtro", function () {
                STATE.filtroIntervencao = $(this).data("filtro");
                STATE.contextoSelecionado = "";
                renderAreaIntervencao();
            });

            $(document).on("click.authbox", ".authbox-marcar", function () {
                var chave = $(this).data("chave");
                var estado = $(this).data("estado");
                var authid = (STATE.authority && STATE.authority.authid) || "";
                if (!chave || !estado || !authid) return;
                gravarEstadoRevisao(authid, chave, estado);
                STATE.ocorrencias.forEach(function (o) { if (o.chave === chave) o.estadoRevisao = estado; });
                atualizarAuthorityState();
                renderPainel();
            });

            $(document).on("click.authbox", ".authbox-reabrir", function () {
                var chave = $(this).data("chave");
                var authid = (STATE.authority && STATE.authority.authid) || "";
                if (!chave || !authid) return;
                gravarEstadoRevisao(authid, chave, null);
                STATE.ocorrencias.forEach(function (o) { if (o.chave === chave) o.estadoRevisao = ""; });
                atualizarAuthorityState();
                renderPainel();
            });
        }

        function aplicarColapso(colapsado) {
            $("#authbox").toggleClass("colapsado", colapsado);
            $("#authbox-colapsar-txt").text(colapsado ? "Mostrar" : "Ocultar");
        }

        function renderPainel() {
            atualizarAuthorityState();
            var score = STATE.score;
            var estado = estadoScore(score);

            renderIdentidade(score, estado);
            renderKpis();
            renderAreaIntervencao();
        }

        function renderIdentidade(score, estado) {
            var a = STATE.authority || {};
            var foto = obterImagemDashboard();
            var wd = a.wikidata && a.wikidata.length ? a.wikidata[0].valor : "";
            var viaf = a.viaf && a.viaf.length ? a.viaf[0].valor : "";
            var estadoDatas = analisarEstadoDatas(a.datas);

            var html = "";
            html += '<div class="authbox-identity-card">';
            html += foto ? '<img class="authbox-photo" src="' + escaparHTML(foto) + '" alt="">' : '<div class="authbox-photo authbox-photo-vazia">' + iconePessoa() + '</div>';
            html += '<div class="authbox-identity-main">';
            html += '<div class="authbox-name">' + escaparHTML(a.nome || "Autoridade sem nome identificado") + (a.datas ? ' <span class="authbox-datas">' + escaparHTML(a.datas) + '</span>' : '') + '</div>';
            html += '<div class="authbox-badges">';
            html += '<span class="authbox-badge">Authid: ' + escaparHTML(a.authid || "por gravar") + '</span>';
            html += '<span class="authbox-badge ' + estado.classe + '">Qualidade: ' + score + ' · ' + estado.label + '</span>';
            html += '</div>';
            html += '<div class="authbox-fieldgrid">';
            html += campoIdentidade("200$a", a.nomeA || "—");
            html += campoIdentidade("200$b", a.nomeB || "—");
            html += campoIdentidade("Wikidata", wd ? ('<a target="_blank" rel="noopener" href="https://www.wikidata.org/wiki/' + escaparHTML(wd) + '">' + escaparHTML(wd) + ' ↗</a>') : "—");
            html += campoIdentidade("VIAF", viaf ? ('<a target="_blank" rel="noopener" href="https://viaf.org/viaf/' + escaparHTML(viaf) + '">' + escaparHTML(viaf) + ' ↗</a>') : "—");
            html += '</div>';
            html += '<div class="authbox-alertgrid">';
            html += alertaMini(estadoDatas.estado, "Estado cronológico", estadoDatas.label);
            html += alertaMini((wd && viaf) ? "ok" : "warn", "Identificadores", (wd ? "Wikidata" : "Sem Wikidata") + " · " + (viaf ? "VIAF" : "Sem VIAF"));
            html += '</div>';
            html += '</div></div>';

            $("#authbox-identidade").html(html);
        }

        function campoIdentidade(rotulo, valorHtml) {
            return '<div class="authbox-field"><strong>' + escaparHTML(rotulo) + '</strong><span>' + valorHtml + '</span></div>';
        }

        function alertaMini(estado, titulo, texto) {
            var classe = estado === "ok" ? "authbox-alert-ok" : (estado === "warn" ? "authbox-alert-warn" : "authbox-alert-bad");
            return '<div class="authbox-mini-alert ' + classe + '"><strong>' + escaparHTML(titulo) + '</strong><span>' + escaparHTML(texto) + '</span></div>';
        }

        function renderKpis() {
            var sem9 = filtrarOcorrencias("problema:Falta $9").length;
            var sem4 = filtrarOcorrencias("problema:Falta $4").length;
            var sem9e4 = filtrarOcorrencias("problema:Falta $9 e $4").length;
            var outroAutor = filtrarOcorrencias("problema:Outro autor").length;
            var responsabilidade = filtrarOcorrencias("problema:200$f vs. 7xx").length;
            var ligados = filtrarOcorrencias("ligados").length;
            var contexto = filtrarOcorrencias("contexto").length;
            var candidatos = filtrarOcorrencias("sem").length;

            var totalCorrigir = STATE.dashboardExecutada
                ? (STATE.ocorrencias || []).filter(function (o) {
                    if (estaResolvida(o)) return false;
                    var p = problemaOcorrencia(o);
                    return p === "Falta $9" || p === "Falta $4" || p === "Falta $9 e $4";
                }).length : 0;
            var totalRever = outroAutor + responsabilidade;

            var html = "";
            html += kpi("kpi-vermelho", iconeLapis(), "Corrigir", totalCorrigir, "Sem $9: <b>" + sem9 + "</b> · Sem $4: <b>" + sem4 + "</b>", "problema:Falta $9");
            html += kpi("kpi-laranja", iconeOlho(), "Rever", totalRever, "Outro autor: <b>" + outroAutor + "</b> · 200$f vs. 7xx: <b>" + responsabilidade + "</b>", "problema:Outro autor");
            html += kpi("kpi-verde", iconeLink(), "Ligados", ligados, "Ligados à autoridade", "ligados");
            html += kpi("kpi-azul", iconeLivro(), "Contexto", contexto, "Assuntos, notas, texto livre", "contexto");
            html += kpi("kpi-roxo", iconePessoas(), "Candidatos", candidatos, "Sem confirmação MARC", "sem");

            $("#authbox-kpis").html(html);
        }

        function kpi(classe, icone, titulo, valor, detalheHtml, filtro) {
            return '<button type="button" class="authbox-kpi ' + classe + ' authbox-filtro" data-filtro="' + escaparHTML(filtro) + '">' +
                '<span class="authbox-kpi-icone">' + icone + '</span>' +
                '<span class="authbox-kpi-titulo">' + escaparHTML(titulo) + '</span>' +
                '<span class="authbox-kpi-valor">' + (STATE.dashboardExecutada ? valor : 0) + '</span>' +
                '<span class="authbox-kpi-detalhe">' + detalheHtml + '</span>' +
                '</button>';
        }

        function renderAreaIntervencao() {
            if (!STATE.filtroIntervencao) STATE.filtroIntervencao = "ligados";

            var html = "";
            html += '<div class="authbox-menu">';
            html += menuBotao("problema:Falta $9", "Sem $9", "menu-critico");
            html += menuBotao("problema:Falta $4", "Sem $4", "menu-revisao");
            html += menuBotao("problema:200$f vs. 7xx", "200$f vs. 7xx", "menu-revisao");
            html += menuBotao("problema:Outro autor", "Outro autor", "menu-critico");
            html += menuBotao("variantes", "400/500", "menu-neutro");
            html += menuBotao("ligados", "Ligados", "menu-ok");
            html += menuBotao("resolvidos", "Resolvidos", "menu-neutro");
            html += '</div>';

            html += '<div class="authbox-table-wrap"><table class="authbox-table"><thead><tr>';
            html += '<th>Bib#</th><th>Título</th><th>Campo</th><th>Ocorrência</th><th>Prioridade</th><th>Diagnóstico</th><th>Estado</th><th>Ligações</th>';
            html += '</tr></thead><tbody id="authbox-tabela-corpo"></tbody></table></div>';
            html += '<div class="authbox-rodape" id="authbox-rodape"></div>';

            $("#authbox-area-intervencao").html(html);
            renderTabela();
        }

        function menuBotao(filtro, label, classe) {
            var n = filtro === "variantes"
                ? ((STATE.authority && STATE.authority.variantes400 ? STATE.authority.variantes400.length : 0) + (STATE.authority && STATE.authority.relacionadas500 ? STATE.authority.relacionadas500.length : 0))
                : filtrarOcorrencias(filtro).length;
            var ativo = STATE.filtroIntervencao === filtro ? " ativo" : "";
            return '<button type="button" class="authbox-menu-btn ' + classe + ativo + ' authbox-filtro" data-filtro="' + escaparHTML(filtro) + '">' +
                escaparHTML(label) + ' <span class="authbox-menu-count">' + n + '</span></button>';
        }

        function renderTabela() {
            var filtro = STATE.filtroIntervencao;
            var corpo = $("#authbox-tabela-corpo");

            if (filtro === "variantes") {
                renderTabelaVariantes(corpo);
                return;
            }

            var lista = filtrarOcorrencias(filtro);
            if (!lista.length) {
                corpo.html('<tr><td colspan="8" class="authbox-vazio">0 ocorrências nesta categoria. Carregue os bibliográficos para iniciar a validação.</td></tr>');
                $("#authbox-rodape").text("");
                return;
            }

            var html = "";
            lista.forEach(function (o) {
                var links = o.links || {};
                var prioridade = prioridadeOperacional(o);
                html += "<tr>";
                html += '<td><a href="' + escaparHTML(links.detalhe || "#") + '" target="_blank" rel="noopener">' + escaparHTML(o.biblionumber || "0") + '</a></td>';
                html += '<td class="authbox-titulo-cell">' + escaparHTML(o.titulo || "Sem título") + '</td>';
                html += '<td><span class="authbox-chip">' + escaparHTML(o.campo || "0") + '</span></td>';
                html += '<td>' + escaparHTML(limparValorMARCOperacional(o.valorEncontrado || "")).slice(0, 90) + '</td>';
                html += '<td>' + pillPrioridade(prioridade) + '</td>';
                html += '<td>' + escaparHTML(o.acaoCurta || "") + '<div class="authbox-acao-detalhe">' + escaparHTML(o.acaoDetalhada || "") + '</div></td>';
                html += '<td>' + celulaEstado(o) + '</td>';
                html += '<td><div class="authbox-links">';
                html += '<a class="authbox-btn-mini" title="Editar" href="' + escaparHTML(links.editar || links.detalhe || "#") + '" target="_blank" rel="noopener">✎</a>';
                html += '<a class="authbox-btn-mini" title="Ver MARC" href="' + escaparHTML(links.marc || "#") + '" target="_blank" rel="noopener">$a</a>';
                html += '<a class="authbox-btn-mini" title="OPAC" href="' + escaparHTML(links.opac || "#") + '" target="_blank" rel="noopener">◎</a>';
                html += '</div></td>';
                html += "</tr>";
            });

            corpo.html(html);
            var analisadas = (STATE.ocorrencias || []).length;
            $("#authbox-rodape").text("Mostrando " + lista.length + " de " + analisadas + " ocorrência(s) analisada(s).");
        }

        function renderTabelaVariantes(corpo) {
            var variantes = (STATE.authority && STATE.authority.variantes400) ? STATE.authority.variantes400 : [];
            var relacionadas = (STATE.authority && STATE.authority.relacionadas500) ? STATE.authority.relacionadas500 : [];
            var linhas = [];
            variantes.forEach(function (v) { linhas.push({ campo: "400", item: v }); });
            relacionadas.forEach(function (v) { linhas.push({ campo: "500", item: v }); });

            if (!linhas.length) {
                corpo.html('<tr><td colspan="8" class="authbox-vazio">0 variantes 400 e 0 relações 500 registadas nesta autoridade.</td></tr>');
                $("#authbox-rodape").text("");
                return;
            }

            var html = "";
            linhas.forEach(function (linha) {
                var v = linha.item;
                var estadoForma = linha.campo === "500" ? estadoCompletude500(v, STATE.authority) : estadoCompletude400(v, STATE.authority);
                html += "<tr>";
                html += '<td colspan="2" class="authbox-titulo-cell">' + escaparHTML(v.forma || "Sem forma") + (v.datas ? ' <span class="authbox-datas-inline">(' + escaparHTML(v.datas) + ')</span>' : '') + '</td>';
                html += '<td><span class="authbox-chip">' + escaparHTML(linha.campo) + '</span></td>';
                html += '<td>' + (linha.campo === "500" ? escaparHTML(formatarRelacao5(v.relacao5)) : "Forma variante") + '</td>';
                html += '<td>' + pillPrioridade(estadoForma.estado === "ok" ? "Informativa" : "Revisão") + '</td>';
                html += '<td>' + escaparHTML(estadoForma.titulo) + '<div class="authbox-acao-detalhe">' + escaparHTML(estadoForma.detalhe) + '</div></td>';
                html += '<td colspan="2">—</td>';
                html += "</tr>";
            });

            corpo.html(html);
            $("#authbox-rodape").text(variantes.length + " variante(s) 400 e " + relacionadas.length + " relação(ões) 500.");
        }

        function celulaEstado(o) {
            if (o.estadoRevisao === "confirmado" || o.estadoRevisao === "falso_positivo") {
                var rotulo = o.estadoRevisao === "confirmado" ? "Resolvido" : "Falso positivo";
                return '<span class="authbox-badge-estado ok">' + rotulo + '</span> <button type="button" class="authbox-btn-mini authbox-reabrir" data-chave="' + escaparHTML(o.chave) + '">Reabrir</button>';
            }
            return '<button type="button" class="authbox-btn-mini authbox-marcar" data-chave="' + escaparHTML(o.chave) + '" data-estado="confirmado">Resolvido</button> ' +
                '<button type="button" class="authbox-btn-mini authbox-marcar" data-chave="' + escaparHTML(o.chave) + '" data-estado="falso_positivo">Falso pos.</button>';
        }

        function pillPrioridade(p) {
            var classe = p === "Crítica" ? "prio-critica" : (p === "Revisão" ? "prio-revisao" : "prio-info");
            return '<span class="authbox-pill ' + classe + '">' + escaparHTML(p || "Informativa") + '</span>';
        }

        // ---------------------------------------------------------------
        // Filtros
        // ---------------------------------------------------------------

        function problemaOcorrencia(o) { return limparTexto(o && o.problema ? o.problema : ""); }
        function ehOutroAutor(o) { var p = problemaOcorrencia(o); return p === "Outro authid" || p === "Outro autor"; }
        function ehResponsabilidade(o) { var p = problemaOcorrencia(o); return p === "Menção de responsabilidade" || p === "200$f vs. 7xx"; }
        function ehSem9e4(o) { return problemaOcorrencia(o) === "Falta $9 e $4"; }
        function ausencia9(o) { return o && (o.problema === "Falta $9" || o.problema === "Falta $9 e $4"); }
        function ausencia4(o) { return o && (o.problema === "Falta $4" || o.problema === "Falta $9 e $4"); }
        function ehLigado(o) { return problemaOcorrencia(o) === "Ligação correta"; }

        function filtrarOcorrencias(filtro) {
            var lista = STATE.ocorrencias || [];
            var contexto = STATE.contextoSelecionado || "";

            return lista.filter(function (o) {
                if (filtro === "resolvidos") return estaResolvida(o);
                if (estaResolvida(o) && filtro !== "todos" && filtro !== "ligados") return false;
                if (filtro === "todos") return true;
                if (filtro === "ligados") return ehLigado(o);
                if (filtro === "sem") return o.grupo === "sem";
                if (filtro === "contexto" && contexto) return o.grupo === "contexto" && o.natureza === contexto;
                if (filtro === "contexto") return o.grupo === "contexto";
                if (String(filtro).indexOf("problema:") === 0) {
                    var p = String(filtro).replace("problema:", "");
                    if (p === "Falta $9") return ausencia9(o);
                    if (p === "Falta $4") return ausencia4(o);
                    if (p === "Falta $9 e $4") return ehSem9e4(o);
                    if (p === "Outro autor") return ehOutroAutor(o);
                    if (p === "200$f vs. 7xx") return ehResponsabilidade(o);
                    return problemaOcorrencia(o) === p;
                }
                return o.grupo === filtro;
            });
        }

        function prioridadeOperacional(o) {
            var p = problemaOcorrencia(o);
            if (p === "Falta $9" || p === "Falta $9 e $4" || ehOutroAutor(o)) return "Crítica";
            if (p === "Falta $4") return "Revisão";
            if (ehResponsabilidade(o)) return "Revisão";
            if (p === "Ligação correta") return "Informativa";
            return o.prioridade || "Informativa";
        }

        // ---------------------------------------------------------------
        // Motor de validação bibliográfica
        // ---------------------------------------------------------------

        function executarDashboardCompleto() {
            atualizarAuthorityState();
            if (STATE.dashboardEmCurso) { $("#authbox-status").text("A análise já está em curso."); return; }
            if (!STATE.authority.authid) { $("#authbox-status").text("A autoridade ainda não tem authid. Grave primeiro."); return; }

            (STATE.xhrDashboard || []).forEach(function (xhr) { try { if (xhr && xhr.readyState !== 4) xhr.abort(); } catch (e) {} });

            STATE.dashboardToken++;
            STATE.dashboardEmCurso = true;
            STATE.xhrDashboard = [];
            $("#authbox-carregar").prop("disabled", true).text("A carregar...");
            atualizarProgresso(0, 0, "A pesquisar registos...");
            STATE.dashboardExecutada = false;
            STATE.candidatos = [];
            STATE.ocorrencias = [];
            renderPainel();

            pesquisarCandidatos(STATE.authority.authid, STATE.authority.nome, STATE.dashboardToken);
        }

        function atualizarProgresso(atual, total, msg) {
            var pct = total ? Math.round((atual / total) * 100) : 0;
            $("#authbox-status").text(msg || "A preparar análise...");
            $("#authbox-progresso-wrap").removeClass("authbox-fechado");
            $("#authbox-progresso-fill").css("width", pct + "%");
            $("#authbox-progresso-texto").text(total ? ("Registos processados: " + atual + " / " + total + " (" + pct + "%)") : "Registos processados: 0 / 0 (0%)");
        }

        function terminarProgresso(msg) {
            STATE.dashboardEmCurso = false;
            STATE.xhrDashboard = [];
            $("#authbox-carregar").prop("disabled", false).text("Carregar bibliográficos");
            $("#authbox-status").text(msg || "");
        }

        function pesquisarCandidatos(authid, nome, token) {
            var pesquisas = [{ origem: "Pesquisa an", url: "/cgi-bin/koha/catalogue/search.pl?idx=an&q=" + encodeURIComponent(authid) }];
            if (nome) {
                pesquisas.push({ origem: "Pesquisa autor", url: "/cgi-bin/koha/catalogue/search.pl?idx=au&q=" + encodeURIComponent(nome) });
                pesquisas.push({ origem: "Pesquisa livre", url: "/cgi-bin/koha/catalogue/search.pl?q=" + encodeURIComponent(nome) });
            }

            var pedidos = $.map(pesquisas, function (p) {
                var xhr = $.ajax({ url: p.url, method: "GET", dataType: "html" })
                    .then(function (html) { return { origem: p.origem, html: html, erro: false }; },
                        function () { return { origem: p.origem, html: "", erro: true }; });
                STATE.xhrDashboard.push(xhr);
                return xhr;
            });

            $.when.apply($, pedidos).done(function () {
                if (token !== STATE.dashboardToken) return;
                var respostas = pedidos.length === 1 ? [arguments[0]] : Array.prototype.slice.call(arguments);
                var candidatos = fundirCandidatos(respostas);

                if (!candidatos.length) {
                    $("#authbox-status").text("Não foram encontrados registos candidatos.");
                    STATE.dashboardExecutada = true;
                    terminarProgresso("");
                    renderPainel();
                    return;
                }

                STATE.candidatos = candidatos;
                validarCandidatos(candidatos, authid, nome, token);
            });
        }

        function fundirCandidatos(respostas) {
            var vistos = {}; var candidatos = [];
            $.each(respostas, function (i, r) {
                if (!r || r.erro) return;
                $.each(extrairObrasDaPesquisa(r.html), function (j, obra) {
                    if (!obra.biblionumber) return;
                    if (!vistos[obra.biblionumber]) { vistos[obra.biblionumber] = obra; obra.origens = []; candidatos.push(obra); }
                    vistos[obra.biblionumber].origens = removerDuplicados(vistos[obra.biblionumber].origens.concat([r.origem]));
                });
            });
            return candidatos.slice(0, CONFIG.maxCandidatosValidacao);
        }

        function extrairObrasDaPesquisa(html) {
            var obras = []; var vistos = {};
            var doc = $("<div>").append($.parseHTML(html, document, true));
            doc.find('a[href*="detail.pl?biblionumber="], a[href*="addbiblio.pl?biblionumber="]').each(function () {
                var a = $(this);
                var biblionumber = obterBiblionumberDeURL(a.attr("href") || "");
                if (!biblionumber || vistos[biblionumber]) return;
                vistos[biblionumber] = true;
                var bloco = a.closest("tr").length ? a.closest("tr") : a.closest(".searchresults, .result, li").length ? a.closest(".searchresults, .result, li") : a.parent();
                obras.push({
                    biblionumber: biblionumber,
                    titulo: obterTituloDoResultado(bloco, biblionumber),
                    detalhe: "/cgi-bin/koha/catalogue/detail.pl?biblionumber=" + encodeURIComponent(biblionumber),
                    editar: "/cgi-bin/koha/cataloguing/addbiblio.pl?biblionumber=" + encodeURIComponent(biblionumber),
                    marc: "/cgi-bin/koha/catalogue/MARCdetail.pl?biblionumber=" + encodeURIComponent(biblionumber),
                    origens: []
                });
            });
            return obras;
        }

        function obterBiblionumberDeURL(url) {
            if (!url) return "";
            try {
                var u = new URL(url, window.location.origin);
                var b = u.searchParams.get("biblionumber");
                if (b && /^\d+$/.test(b)) return b;
            } catch (e) {}
            var m = String(url).match(/[?&]biblionumber=(\d+)/i);
            return m ? m[1] : "";
        }

        function obterTituloDoResultado(bloco, biblionumber) {
            var seletores = ['a.title[href*="detail.pl?biblionumber="]', '.title a[href*="detail.pl?biblionumber="]', 'h2 a[href*="detail.pl?biblionumber="]', 'h3 a[href*="detail.pl?biblionumber="]', 'a[href*="detail.pl?biblionumber="]'];
            var titulo = "";
            for (var i = 0; i < seletores.length && !titulo; i++) {
                bloco.find(seletores[i]).each(function () {
                    var txt = limparTexto($(this).text());
                    if (txt && txt.length > 2 && !ehRuido(txt)) { titulo = txt; return false; }
                });
            }
            return titulo || "Registo bibliográfico " + biblionumber;
        }

        function ehRuido(txt) {
            var t = normalizar(txt);
            return !t || ["imagem local de capa", "reservas", "adicionar ao carrinho", "modificar o registo", "editar exemplares", "vista opac", "ver detalhe", "ver marc"].indexOf(t) !== -1;
        }

        function validarCandidatos(candidatos, authid, nomeAutoridade, token) {
            var ocorrencias = []; var indice = 0;

            function seguinte() {
                if (token !== STATE.dashboardToken) return;
                if (indice >= candidatos.length) {
                    STATE.ocorrencias = normalizarOcorrencias(ocorrencias);
                    STATE.dashboardExecutada = true;
                    terminarProgresso("Concluído: " + candidatos.length + " registo(s) analisado(s), " + STATE.ocorrencias.length + " ocorrência(s).");
                    renderPainel();
                    return;
                }

                var obra = candidatos[indice];
                atualizarProgresso(indice, candidatos.length, "A analisar MARC · " + obra.biblionumber + " · " + (obra.titulo || ""));
                indice++;

                var xhr = $.ajax({ url: obra.marc, method: "GET", dataType: "html" })
                    .done(function (html) {
                        if (token !== STATE.dashboardToken) return;
                        ocorrencias = ocorrencias.concat(analisarMARCComoOcorrencias(html, authid, nomeAutoridade, obra));
                    })
                    .fail(function () {
                        if (token !== STATE.dashboardToken) return;
                        ocorrencias.push(criarOcorrencia({ obra: obra, natureza: "Erro de leitura", problema: "Erro de leitura", prioridade: "Revisão", authidEsperado: authid, acaoCurta: "Verificar manualmente", acaoDetalhada: "Não foi possível validar o MARC deste registo.", grupo: "manual" }));
                    })
                    .always(function () { if (token === STATE.dashboardToken) seguinte(); });

                STATE.xhrDashboard.push(xhr);
            }

            seguinte();
        }

        function criarOcorrencia(dados) {
            var obra = dados.obra;
            var chave = chaveOcorrencia(dados);
            var authidAtual = (STATE.authority && STATE.authority.authid) || "";
            var registoEstado = authidAtual ? lerEstadosRevisao(authidAtual)[chave] : null;

            return {
                biblionumber: obra.biblionumber, titulo: obra.titulo, campo: dados.campo || "",
                natureza: dados.natureza || "", valorEncontrado: dados.valorEncontrado || "",
                problema: dados.problema || "", prioridade: dados.prioridade || "Informativa",
                authidEsperado: dados.authidEsperado || "", authidEncontrado: dados.authidEncontrado || "",
                origemRelacao: dados.origemRelacao || (obra.origens || []).join(", "),
                codigoFuncao: dados.codigoFuncao || "", acaoCurta: dados.acaoCurta || "", acaoDetalhada: dados.acaoDetalhada || "",
                grupo: dados.grupo || "contexto", chave: chave, estadoRevisao: registoEstado ? registoEstado.estado : "",
                links: {
                    detalhe: obra.detalhe, editar: obra.editar,
                    marc: "/cgi-bin/koha/catalogue/showmarc.pl?id=" + encodeURIComponent(obra.biblionumber) + "&viewas=html",
                    opac: "/cgi-bin/koha/opac-detail.pl?biblionumber=" + encodeURIComponent(obra.biblionumber)
                }
            };
        }

        function normalizarOcorrencias(lista) {
            var vistos = {}; var resultado = [];
            lista.forEach(function (o) {
                var chave = [o.biblionumber, o.campo, o.natureza, o.valorEncontrado, o.problema, o.authidEncontrado].join("|");
                if (vistos[chave]) return;
                vistos[chave] = true; resultado.push(o);
            });
            resultado.sort(function (a, b) {
                var peso = { imediata: 1, manual: 2, contexto: 3, sem: 4 };
                var pa = peso[a.grupo] || 9, pb = peso[b.grupo] || 9;
                return pa !== pb ? pa - pb : String(a.titulo).localeCompare(String(b.titulo), "pt");
            });
            return resultado;
        }

        function analisarMARCComoOcorrencias(html, authid, nomeAutoridade, obra) {
            var doc = $("<div>").append($.parseHTML(html, document, true));
            doc.find("script, style").remove();
            var blocos = extrairBlocosMARC(doc);
            var nomeNorm = normalizar(nomeAutoridade);
            var resultado = [];

            blocos.forEach(function (bloco) {
                if (CONFIG.camposAutoria.indexOf(bloco.campo) !== -1) {
                    var r = analisarBlocoAutoria(bloco, authid, nomeNorm, obra);
                    if (r) resultado.push(r);
                } else {
                    var c = analisarBlocoContextual(bloco, authid, nomeNorm, obra);
                    if (c) resultado.push(c);
                }
            });

            if (!resultado.length) {
                resultado.push(criarOcorrencia({ obra: obra, natureza: "Sem evidência", problema: "Sem menção identificada", prioridade: "Informativa", authidEsperado: authid, acaoCurta: "Sem ação imediata", acaoDetalhada: "Registo recuperado como candidato, sem menção claramente identificável.", grupo: "sem" }));
            }
            return resultado;
        }

        // Só o campo 700 (responsabilidade principal) dispensa o código de
        // função $4; 701 e 702 continuam a exigi-lo. Um $4 presente que não
        // conste da lista de valores autorizados CODIGOFUNC é sinalizado
        // como problema de qualidade de dados, com prioridade sobre a
        // avaliação normal de $9/$4.
        function analisarBlocoAutoria(bloco, authid, nomeNorm, obra) {
            var authids = extrairAuthidsDoBloco(bloco);
            var valorAutoria = extrairValorAutoria(bloco);
            var codigos4 = extrairCodigosFuncaoDoBloco(bloco);
            var detalhe4 = descricaoFuncao4(codigos4);
            var compativel = textoAutoriaCompativel(valorAutoria || bloco.texto, nomeNorm);
            var origem = (obra.origens || []).join(", ");
            var authidStr = String(authid);
            var temAuthidEsperado = authids.indexOf(authidStr) !== -1;
            var temAuthid = authids.length > 0;

            var codigosValidos = codigos4.filter(codigoFuncaoAutorizado);
            var codigosInvalidos = codigos4.filter(function (c) { return !codigoFuncaoAutorizado(c); });
            var exigeFuncao4 = bloco.campo !== "700";
            var tem4 = exigeFuncao4 ? (codigosValidos.length > 0) : true;
            var valorDecisao = valorAutoria || bloco.texto;

            if (codigosInvalidos.length) {
                return criarOcorrencia({
                    obra: obra, campo: bloco.campo + "$4", natureza: "Código de função inválido",
                    valorEncontrado: (valorDecisao || ("Autoridade " + authid)) + " || $4: " + codigosInvalidos.join(", "),
                    problema: "Código $4 não autorizado", prioridade: "Revisão", authidEsperado: authid,
                    authidEncontrado: authids.join(", "), origemRelacao: origem, codigoFuncao: detalhe4,
                    acaoCurta: "Corrigir código $4",
                    acaoDetalhada: "O $4 contém código(s) fora da lista de valores autorizados CODIGOFUNC: " + codigosInvalidos.join(", ") + ".",
                    grupo: "imediata"
                });
            }

            if (compativel && !temAuthid && !tem4) {
                return criarOcorrencia({ obra: obra, campo: bloco.campo, natureza: "Responsabilidade estruturada", valorEncontrado: valorDecisao, problema: "Falta $9 e $4", prioridade: "Crítica", authidEsperado: authid, origemRelacao: origem, codigoFuncao: detalhe4, acaoCurta: "Completar $9 e $4", acaoDetalhada: "O ponto de acesso é compatível, mas não tem $9 nem $4.", grupo: "imediata" });
            }
            if (temAuthidEsperado && !tem4) {
                return criarOcorrencia({ obra: obra, campo: bloco.campo + "$9", natureza: "Responsabilidade estruturada", valorEncontrado: valorDecisao || ("Autoridade " + authid), problema: "Falta $4", prioridade: "Revisão", authidEsperado: authid, authidEncontrado: authid, origemRelacao: origem, codigoFuncao: detalhe4, acaoCurta: "Adicionar $4", acaoDetalhada: "Ligado por $9, mas sem código de função.", grupo: "imediata" });
            }
            if (temAuthidEsperado) {
                return criarOcorrencia({ obra: obra, campo: bloco.campo + "$9", natureza: "Responsabilidade estruturada", valorEncontrado: valorDecisao || ("Autoridade " + authid), problema: "Ligação correta", prioridade: "Informativa", authidEsperado: authid, authidEncontrado: authid, origemRelacao: origem, codigoFuncao: detalhe4, acaoCurta: "Sem ação", acaoDetalhada: "Ligado correctamente à autoridade.", grupo: "contexto" });
            }
            if (compativel && !temAuthid && tem4) {
                return criarOcorrencia({ obra: obra, campo: bloco.campo, natureza: "Responsabilidade estruturada", valorEncontrado: valorDecisao, problema: "Falta $9", prioridade: "Crítica", authidEsperado: authid, origemRelacao: origem, codigoFuncao: detalhe4, acaoCurta: "Ligar autoridade", acaoDetalhada: "Compatível, com $4, mas sem $9.", grupo: "imediata" });
            }
            if (compativel && temAuthid && !temAuthidEsperado) {
                return criarOcorrencia({ obra: obra, campo: bloco.campo + "$9", natureza: "Responsabilidade estruturada", valorEncontrado: valorDecisao, problema: "Outro autor", prioridade: "Crítica", authidEsperado: authid, authidEncontrado: authids.join(", "), origemRelacao: origem, codigoFuncao: detalhe4, acaoCurta: "Rever ligação", acaoDetalhada: "Ligado a outro authid; confirmar duplicação ou relação legítima.", grupo: "manual" });
            }
            return null;
        }

        function analisarBlocoContextual(bloco, authid, nomeNorm, obra) {
            var texto = bloco.texto || "";
            if (!textoAutoriaCompativel(texto, nomeNorm)) return null;
            var classificacao = classificarCampoRelacao(bloco.campo);
            var authids = extrairAuthidsDoBloco(bloco);
            var valor = extrairValorContextual(bloco, classificacao.tipo);

            if (classificacao.tipo === "mencao_responsabilidade") {
                return criarOcorrencia({
                    obra: obra, campo: bloco.campo + "$f", natureza: classificacao.natureza,
                    valorEncontrado: limparValorMARCOperacional(valor || texto),
                    problema: "200$f vs. 7xx", prioridade: "Revisão", authidEsperado: authid,
                    authidEncontrado: authids.join(", "), origemRelacao: (obra.origens || []).join(", "),
                    acaoCurta: "Confirmar coerência", acaoDetalhada: "Comparar a menção de responsabilidade com os pontos 7xx, variantes 400 e relações 500.",
                    grupo: "manual"
                });
            }

            return criarOcorrencia({
                obra: obra, campo: bloco.campo, natureza: classificacao.natureza, valorEncontrado: valor || texto,
                problema: "Menção contextual", prioridade: "Informativa", authidEsperado: authid,
                authidEncontrado: authids.join(", "), origemRelacao: (obra.origens || []).join(", "),
                acaoCurta: "Mapear menção", acaoDetalhada: "Menção contextual sem impacto estrutural imediato.", grupo: "contexto"
            });
        }

        function extrairValorContextual(bloco, tipo) {
            if (tipo === "mencao_responsabilidade") return obterSubcampo(bloco, "f") || obterSubcampo(bloco, "g") || bloco.texto;
            if (tipo === "assunto") return ["a", "x", "y", "z", "j"].map(function (c) { return obterSubcampo(bloco, c); }).filter(Boolean).join(" ");
            return obterSubcampo(bloco, "a") || bloco.texto;
        }

        function classificarCampoRelacao(campo) {
            campo = String(campo || "");
            if (["700", "701", "702"].indexOf(campo) !== -1) return { tipo: "autoria_estrutural", natureza: "Responsabilidade estruturada" };
            if (campo === "200") return { tipo: "mencao_responsabilidade", natureza: "Menção de responsabilidade" };
            if (/^6\d\d$/.test(campo)) return { tipo: "assunto", natureza: "Assunto" };
            if (/^3\d\d$/.test(campo)) return { tipo: "nota", natureza: "Nota ou texto" };
            if (/^4\d\d$/.test(campo)) return { tipo: "relacao_bibliografica", natureza: "Relação bibliográfica" };
            if (/^5\d\d$/.test(campo)) return { tipo: "titulo_relacionado", natureza: "Título relacionado" };
            return { tipo: "outro_contexto", natureza: "Outra menção contextual" };
        }

        function extrairBlocosMARC(doc) {
            var estruturais = extrairBlocosMARCDeTabela(doc);
            return estruturais.length ? estruturais : extrairBlocosMARCDeTexto(doc);
        }

        function extrairBlocosMARCDeTabela(doc) {
            var blocos = [];
            doc.find("tr").each(function () {
                var texto = limparTexto($(this).text());
                var m = texto.match(/\b(\d{3})\b/);
                if (!m || texto.length < 4) return;
                blocos.push({ campo: m[1], texto: texto, subcampos: extrairSubcamposDeTexto(texto) });
            });
            return compactarBlocosMARC(blocos);
        }

        function extrairBlocosMARCDeTexto(doc) {
            var texto = String(doc.text() || "").replace(/\r/g, "\n").replace(/\u00a0/g, " ");
            var linhas = texto.split(/\n+/).map(limparTexto).filter(Boolean);
            var blocos = []; var atual = null;

            linhas.forEach(function (linha) {
                var m = linha.match(/^(\d{3})(\s|#|$)/);
                if (m) {
                    if (atual) { atual.subcampos = extrairSubcamposDeTexto(atual.texto); blocos.push(atual); }
                    atual = { campo: m[1], texto: linha, subcampos: {} };
                } else if (atual) atual.texto += " " + linha;
            });
            if (atual) { atual.subcampos = extrairSubcamposDeTexto(atual.texto); blocos.push(atual); }
            return blocos;
        }

        function compactarBlocosMARC(blocos) {
            var resultado = [];
            blocos.forEach(function (b) {
                if (!b.campo || !b.texto) return;
                var textoNorm = normalizar(b.texto);
                if (!resultado.some(function (e) { return e.campo === b.campo && normalizar(e.texto) === textoNorm; })) resultado.push(b);
            });
            return resultado;
        }

        function extrairSubcamposDeTexto(texto) {
            var subcampos = {}; var t = " " + String(texto || "").replace(/\s+/g, " ") + " ";
            var re = /(?:^|\s|\$)([0-9a-z])\s+(.+?)(?=\s(?:[0-9a-z]|\$[0-9a-z])\s+|$)/gi;
            var m;
            while ((m = re.exec(t)) !== null) {
                var codigo = String(m[1]).toLowerCase();
                var valor = limparTexto(m[2]);
                if (!subcampos[codigo]) subcampos[codigo] = [];
                if (valor) subcampos[codigo].push(valor);
            }
            return subcampos;
        }

        function obterSubcampo(bloco, codigo) {
            codigo = String(codigo || "").toLowerCase();
            if (bloco.subcampos && bloco.subcampos[codigo] && bloco.subcampos[codigo].length) return limparValorMARCOperacional(bloco.subcampos[codigo].join(" "));
            var re = new RegExp("(^|\\s|\\$)" + escaparRegex(codigo) + "\\s+(.+?)(?=\\s(?:[a-z0-9]|\\$[a-z0-9])\\s+|$)", "i");
            var m = String(bloco.texto || "").match(re);
            return m ? limparTexto(m[2]) : "";
        }

        function extrairAuthidsDoBloco(bloco) {
            var authids = [];
            if (bloco.subcampos && bloco.subcampos["9"]) {
                bloco.subcampos["9"].forEach(function (v) { var n = String(v || "").match(/\b\d{1,12}\b/g); if (n) authids = authids.concat(n); });
            }
            if (!authids.length) {
                var re = /(?:^|\s|\$)(?:9)\s*([0-9]{1,12})(?=\s|$)/g; var m; var texto = String(bloco.texto || "");
                while ((m = re.exec(texto)) !== null) authids.push(m[1]);
            }
            return removerDuplicados(authids);
        }

        function extrairCodigosFuncaoDoBloco(bloco) {
            var codigos = [];
            var texto = String(bloco && bloco.texto ? bloco.texto : "").replace(/\u00a0/g, " ").replace(/‡/g, "$").replace(/ǂ/g, "$");
            if (bloco && bloco.subcampos && bloco.subcampos["4"]) {
                bloco.subcampos["4"].forEach(function (v) { var e = String(v || "").match(/\b[0-9]{3}\b/g); if (e) codigos = codigos.concat(e); });
            }
            var re = /(?:\$4|\s4\s+)\s*([0-9]{3})\b/gi; var m;
            while ((m = re.exec(texto)) !== null) codigos.push(m[1]);
            return removerDuplicados(codigos);
        }

        function formatarCodigoFuncao4(codigo) {
            codigo = limparTexto(codigo || "").replace(/\[.*?\]/g, "").replace(/^\$?4\s*:?\s*/i, "");
            if (!codigo || codigo === "0" || codigo === "-" || codigo === "—") return "";
            return codigo.split(/\s*,\s*/).filter(Boolean).map(function (c) { return traduzirCodigoFuncao(c) || c; }).join(", ");
        }

        function traduzirCodigoFuncao(codigo) {
            codigo = limparTexto(codigo || "").trim();
            if (!codigo || codigo === "0" || codigo === "-" || codigo === "—") return "";
            if (CODIGOS_FUNCAO_AUTORIZADOS[codigo]) return CODIGOS_FUNCAO_AUTORIZADOS[codigo];
            return "Código não autorizado: " + codigo.toUpperCase();
        }

        function descricaoFuncao4(codigos) {
            if (!codigos || !codigos.length) return "0";
            return codigos.map(function (c) { return formatarCodigoFuncao4(c) || c; }).join(", ");
        }

        function extrairValorAutoria(bloco) {
            var partes = ["a", "b", "f", "g"].map(function (c) { return obterSubcampo(bloco, c); }).filter(Boolean);
            if (partes.length) return limparValorMARCOperacional(partes.join(" "));
            return limparTexto(String(bloco.texto || "").replace(/^\d{3}\s*#*\s*/g, "").replace(/\$?9\s+\d{1,12}\b/g, ""));
        }

        function textoAutoriaCompativel(texto, nomeNorm) {
            var t = normalizar(limparValorMARCOperacional(texto));
            if (!t || !nomeNorm) return false;

            var universo = construirUniversoIdentitario(STATE.authority || {});
            if (nomeNorm && universo.indexOf(nomeNorm) === -1) universo.push(nomeNorm);

            for (var i = 0; i < universo.length; i++) {
                var u = universo[i];
                if (!u) continue;
                if (t === u || contemPalavraInteira(t, u)) return true;

                var partesU = u.split(" ").filter(function (p) { return p.length > 2; });
                if (partesU.length <= 1) {
                    if (partesU.length === 1 && contemPalavraInteira(t, partesU[0])) return true;
                    continue;
                }
                var encontrados = 0;
                for (var j = 0; j < partesU.length; j++) if (contemPalavraInteira(t, partesU[j])) encontrados++;
                if (encontrados >= Math.min(2, partesU.length)) return true;
            }
            return false;
        }

        // ---------------------------------------------------------------
        // Ícones (SVG inline)
        // ---------------------------------------------------------------

        function svg(path) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>'; }
        function iconeOk() { return svg('<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>'); }
        function iconeSeta() { return svg('<path d="M6 9l6 6 6-6"/>'); }
        function iconePlay() { return svg('<path d="M5 3l14 9-14 9V3z"/>'); }
        function iconePessoa() { return svg('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>'); }
        function iconeLapis() { return svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'); }
        function iconeOlho() { return svg('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/>'); }
        function iconeLink() { return svg('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'); }
        function iconeLivro() { return svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'); }
        function iconePessoas() { return svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'); }

        // ---------------------------------------------------------------
        // Estilos
        // ---------------------------------------------------------------

        function instalarEstilos() {
            if ($("#authbox-estilos").length) return;
            var css = "" +
                "#authbox{font-family:Inter,Arial,sans-serif;font-size:12.5px;color:#16212c;background:#fff;border:1px solid #d9e2ea;border-radius:8px;box-shadow:0 1px 2px rgba(16,24,32,.04),0 8px 20px rgba(16,24,32,.045);overflow:hidden;margin:14px 0;}" +
                "#authbox *{box-sizing:border-box;}" +
                "#authbox-header{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;padding:14px 18px;border-bottom:1px solid #e5ebf0;background:linear-gradient(180deg,#fff 0%,#fbfdfe 100%);}" +
                "#authbox-header-titulo{display:flex;gap:11px;align-items:flex-start;}" +
                "#authbox-icone{width:32px;height:32px;border-radius:8px;flex:0 0 32px;background:linear-gradient(135deg,#0f6e93 0%,#0b4f6c 100%);display:flex;align-items:center;justify-content:center;}" +
                "#authbox-icone svg{width:17px;height:17px;stroke:#fff;}" +
                "#authbox-header-titulo strong{font-size:14.5px;font-weight:750;}" +
                "#authbox-header-titulo p{margin:2px 0 0;font-size:11px;color:#5b6b78;}" +
                "#authbox-colapsar{display:inline-flex;align-items:center;gap:6px;padding:6px 11px;border-radius:6px;border:1px solid #c7d2da;background:#fff;font-size:11px;font-weight:650;color:#5b6b78;cursor:pointer;font-family:inherit;}" +
                "#authbox-colapsar svg{width:12px;height:12px;transition:transform .15s ease;}" +
                "#authbox.colapsado #authbox-colapsar svg{transform:rotate(-90deg);}" +
                "#authbox-corpo{display:grid;grid-template-rows:1fr;transition:grid-template-rows .15s ease;}" +
                "#authbox.colapsado #authbox-corpo{grid-template-rows:0fr;}" +
                "#authbox-corpo-inner{overflow:hidden;}" +
                "#authbox-identidade{padding:16px 18px;border-bottom:1px solid #e5ebf0;}" +
                ".authbox-identity-card{display:grid;grid-template-columns:96px 1fr;gap:14px;}" +
                ".authbox-photo{width:96px;height:126px;object-fit:cover;border-radius:6px;border:1px solid #d9e2ea;background:#eef2f5;}" +
                ".authbox-photo-vazia{display:flex;align-items:center;justify-content:center;color:#98a4ae;}" +
                ".authbox-photo-vazia svg{width:32px;height:32px;}" +
                ".authbox-name{font-size:17px;font-weight:750;letter-spacing:-.01em;}" +
                ".authbox-datas{font-weight:450;color:#5b6b78;font-size:13px;}" +
                ".authbox-badges{display:flex;gap:8px;flex-wrap:wrap;margin:7px 0;}" +
                ".authbox-badge{display:inline-flex;align-items:center;border:1px solid #d9e2ea;background:#f8fafb;border-radius:99px;padding:3px 10px;font-size:11px;font-weight:650;}" +
                ".authbox-score-good{background:#e9f7ef;border-color:#bfe4cc;color:#1f7a4d;}" +
                ".authbox-score-warning{background:#fdf1e2;border-color:#f1d6a3;color:#c67510;}" +
                ".authbox-score-critical{background:#fdeeec;border-color:#f1c1ba;color:#c4392b;}" +
                ".authbox-fieldgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:9px;}" +
                ".authbox-field{border:1px solid #e5ebf0;background:#fbfcfd;border-radius:6px;padding:6px 8px;}" +
                ".authbox-field strong{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;color:#5b6b78;margin-bottom:2px;}" +
                ".authbox-field span{font-size:12px;}" +
                ".authbox-field a{color:#0b4f6c;text-decoration:none;font-weight:650;}" +
                ".authbox-alertgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:7px;}" +
                ".authbox-mini-alert{border-radius:6px;padding:6px 8px;font-size:11px;}" +
                ".authbox-mini-alert strong{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px;}" +
                ".authbox-alert-ok{background:#e9f7ef;color:#1f7a4d;}" +
                ".authbox-alert-warn{background:#fdf1e2;color:#c67510;}" +
                ".authbox-alert-bad{background:#fdeeec;color:#c4392b;}" +
                "#authbox-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:#e5ebf0;}" +
                ".authbox-kpi{background:#fff;border:0;text-align:left;padding:11px 12px;cursor:pointer;font-family:inherit;position:relative;}" +
                ".authbox-kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;}" +
                ".kpi-vermelho::before{background:#c4392b;} .kpi-laranja::before{background:#c67510;} .kpi-verde::before{background:#1f7a4d;} .kpi-azul::before{background:#0f6e93;} .kpi-roxo::before{background:#6a3fb5;}" +
                ".authbox-kpi-icone{display:inline-flex;width:18px;height:18px;color:#5b6b78;}" +
                ".authbox-kpi-icone svg{width:14px;height:14px;}" +
                ".authbox-kpi-titulo{display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;color:#5b6b78;font-weight:650;margin-top:4px;}" +
                ".authbox-kpi-valor{display:block;font-size:19px;font-weight:800;margin-top:2px;}" +
                ".authbox-kpi-detalhe{display:block;font-size:10px;color:#5b6b78;margin-top:2px;}" +
                "#authbox-controlbar{display:flex;align-items:center;gap:12px;padding:11px 18px;background:#f8fafb;border-bottom:1px solid #e5ebf0;flex-wrap:wrap;}" +
                "#authbox-carregar{display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border-radius:6px;border:1px solid transparent;background:#0b4f6c;color:#fff;font-size:11.5px;font-weight:650;cursor:pointer;font-family:inherit;}" +
                "#authbox-carregar svg{width:11px;height:11px;}" +
                "#authbox-carregar:disabled{opacity:.55;cursor:not-allowed;}" +
                "#authbox-progresso-wrap{flex:1;min-width:160px;height:7px;background:#e4e9ed;border-radius:99px;overflow:hidden;}" +
                "#authbox-progresso-wrap.authbox-fechado{opacity:.35;}" +
                "#authbox-progresso-barra{width:100%;height:100%;}" +
                "#authbox-progresso-fill{display:block;height:100%;width:0;background:linear-gradient(90deg,#6bb9d6,#0f6e93);border-radius:99px;transition:width .25s ease;}" +
                "#authbox-progresso-texto{font-size:10.5px;color:#5b6b78;white-space:nowrap;}" +
                "#authbox-status{padding:8px 18px;font-size:11.5px;color:#5b6b78;background:#fbfcfd;border-bottom:1px solid #e5ebf0;}" +
                "#authbox-status.authbox-vazio{font-style:normal;}" +
                ".authbox-menu{display:flex;gap:7px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid #e5ebf0;}" +
                ".authbox-menu-btn{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:99px;border:1px solid #c7d2da;background:#fff;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;color:#5b6b78;}" +
                ".authbox-menu-btn.ativo{background:#0b4f6c;border-color:#0b4f6c;color:#fff;}" +
                ".authbox-menu-count{font-weight:800;}" +
                ".menu-critico{border-left:3px solid #c4392b;} .menu-revisao{border-left:3px solid #c67510;} .menu-ok{border-left:3px solid #1f7a4d;} .menu-neutro{border-left:3px solid #98a4ae;}" +
                "#authbox-area-intervencao{}" +
                ".authbox-table-wrap{max-height:380px;overflow:auto;}" +
                ".authbox-table{width:100%;border-collapse:collapse;font-size:11.5px;}" +
                ".authbox-table thead th{position:sticky;top:0;background:#f8fafb;text-align:left;padding:7px 12px;border-bottom:1px solid #e5ebf0;font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:#5b6b78;z-index:2;}" +
                ".authbox-table tbody td{padding:7px 12px;border-bottom:1px solid #eef1f4;vertical-align:top;}" +
                ".authbox-table tbody tr:hover td{background:#f9fbfc;}" +
                ".authbox-table a{color:#0b4f6c;font-weight:650;text-decoration:none;}" +
                ".authbox-titulo-cell{font-weight:650;min-width:200px;}" +
                ".authbox-datas-inline{color:#5b6b78;font-weight:450;}" +
                ".authbox-chip{display:inline-block;border:1px solid #e5ebf0;background:#f8fafb;border-radius:99px;padding:2px 7px;font-size:10.5px;}" +
                ".authbox-pill{display:inline-flex;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;}" +
                ".prio-critica{background:#fdeeec;color:#c4392b;} .prio-revisao{background:#fdf1e2;color:#c67510;} .prio-info{background:#f1f3f5;color:#5b6b78;}" +
                ".authbox-acao-detalhe{font-size:10px;color:#5b6b78;margin-top:2px;max-width:280px;}" +
                ".authbox-badge-estado{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;}" +
                ".authbox-badge-estado.ok{background:#e9f7ef;color:#1f7a4d;}" +
                ".authbox-btn-mini{border:1px solid #c7d2da;background:#fff;color:#5b6b78;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:600;cursor:pointer;white-space:nowrap;font-family:inherit;text-decoration:none;display:inline-flex;}" +
                ".authbox-btn-mini:hover{background:#f1f4f6;color:#16212c;}" +
                ".authbox-links{display:flex;gap:5px;}" +
                ".authbox-rodape{padding:8px 18px;font-size:10.5px;color:#5b6b78;border-top:1px solid #e5ebf0;background:#fbfcfd;}" +
                ".authbox-vazio{padding:14px;text-align:center;color:#5b6b78;font-style:italic;}" +
                "@media(max-width:920px){#authbox-kpis{grid-template-columns:repeat(2,1fr);}.authbox-identity-card{grid-template-columns:1fr;}.authbox-fieldgrid,.authbox-alertgrid{grid-template-columns:repeat(2,1fr);}}";

            $("<style>").attr("id", "authbox-estilos").text(css).appendTo("head");
        }

    });

})();
