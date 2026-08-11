/* ==========================================================
   AUTHBOX — Caixa de Autoridade
   Miguel Mimoso Correia | CC-BY-NC-SA

   Ferramenta de apoio à edição de autoridades no Koha.
   Funciona apenas em modo de leitura relativamente aos dados
   bibliográficos e aos identificadores externos: não grava
   automaticamente qualquer alteração na base de dados.

   Estrutura:
   1. CSS isolado neste mesmo ficheiro.
   2. JavaScript AuthBox.

   Autoria considerada na validação e na descoberta: campo 700.
   Registos "Sobre o autor": campo 600 ligado ao mesmo AuthID.
   ========================================================== */

/* ==========================================================
   CSS
   ========================================================== */

var AUTHBOX_CSS = `
#authbox {
    --abx-ink:#17232d;
    --abx-muted:#667684;
    --abx-line:#dce4ea;
    --abx-soft:#f7f9fb;
    --abx-blue:#0b5878;
    --abx-blue-2:#0f6f96;
    --abx-green:#27784d;
    --abx-orange:#b96d13;
    --abx-red:#b83d33;
    --abx-purple:#6543a5;
    font-family:Inter,Arial,sans-serif;
    font-size:12.5px;
    color:var(--abx-ink);
    background:#fff;
    border:1px solid var(--abx-line);
    border-radius:8px;
    box-shadow:0 1px 2px rgba(16,24,32,.04),0 8px 20px rgba(16,24,32,.045);
    overflow:hidden;
    margin:14px 0;
}
#authbox * { box-sizing:border-box; }

#authbox-header {
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:14px;
    padding:14px 18px;
    border-bottom:1px solid var(--abx-line);
    background:linear-gradient(180deg,#fff 0%,#fbfdfe 100%);
}
#authbox-header-title { display:flex;gap:11px;align-items:flex-start; }
#authbox-mark {
    width:32px;height:32px;flex:0 0 32px;border-radius:8px;
    display:flex;align-items:center;justify-content:center;
    background:linear-gradient(135deg,var(--abx-blue-2),var(--abx-blue));color:#fff;
}
#authbox-mark svg { width:17px;height:17px; }
#authbox-header-title strong { display:block;font-size:14.5px;font-weight:760; }
#authbox-header-title p { margin:2px 0 0;color:var(--abx-muted);font-size:11px; }
#authbox-toggle {
    display:inline-flex;align-items:center;gap:6px;padding:6px 11px;
    border:1px solid #c7d2da;border-radius:6px;background:#fff;color:var(--abx-muted);
    font:650 11px inherit;cursor:pointer;
}
#authbox-toggle svg { width:12px;height:12px;transition:transform .15s ease; }
#authbox.authbox-collapsed #authbox-toggle svg { transform:rotate(-90deg); }
#authbox-body { display:grid;grid-template-rows:1fr;transition:grid-template-rows .15s ease; }
#authbox.authbox-collapsed #authbox-body { grid-template-rows:0fr; }
#authbox-body-inner { min-height:0;overflow:hidden; }

/* Identidade */
#authbox-identity { padding:16px 18px;border-bottom:1px solid var(--abx-line); }
.authbox-identity-card { display:grid;grid-template-columns:96px minmax(0,1fr);gap:14px; }
.authbox-photo {
    width:96px;height:126px;object-fit:cover;object-position:center top;
    border-radius:6px;border:1px solid var(--abx-line);background:#eef2f5;
}
.authbox-photo-empty { display:flex;align-items:center;justify-content:center;color:#9ba7b1; }
.authbox-photo-empty svg { width:32px;height:32px; }
.authbox-name { font-size:17px;font-weight:760;letter-spacing:-.01em;line-height:1.25; }
.authbox-dates { font-size:13px;font-weight:450;color:var(--abx-muted); }
.authbox-badges { display:flex;gap:7px;flex-wrap:wrap;margin:7px 0 9px; }
.authbox-badge {
    display:inline-flex;align-items:center;border:1px solid var(--abx-line);background:var(--abx-soft);
    border-radius:999px;padding:3px 9px;font-size:10.5px;font-weight:650;
}
.authbox-score-good { background:#eaf7ef;border-color:#c5e6d0;color:var(--abx-green); }
.authbox-score-warning { background:#fdf2e4;border-color:#f0d6ae;color:var(--abx-orange); }
.authbox-score-critical { background:#fceceb;border-color:#efc5c1;color:var(--abx-red); }
.authbox-field-grid { display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:8px; }
.authbox-field { min-width:0;border:1px solid #e7edf1;background:#fbfcfd;border-radius:6px;padding:6px 8px; }
.authbox-field strong { display:block;margin-bottom:2px;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;color:var(--abx-muted); }
.authbox-field span { display:block;min-width:0;overflow-wrap:anywhere;font-size:11.5px; }
.authbox-field a { color:var(--abx-blue);text-decoration:none;font-weight:650; }
.authbox-alert-grid { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:7px; }
.authbox-mini-alert { padding:6px 8px;border-radius:6px;font-size:11px; }
.authbox-mini-alert strong { display:block;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px; }
.authbox-alert-ok { background:#eaf7ef;color:var(--abx-green); }
.authbox-alert-warn { background:#fdf2e4;color:var(--abx-orange); }
.authbox-alert-bad { background:#fceceb;color:var(--abx-red); }

/* Descoberta */
#authbox-discovery { padding:16px 18px 18px;border-bottom:1px solid var(--abx-line);background:#fcfdfe; }
.authbox-discovery-head { display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:12px; }
.authbox-discovery-head h3 { margin:0;font-size:14px;font-weight:760;color:var(--abx-ink); }
.authbox-discovery-head p { margin:2px 0 0;font-size:10.5px;color:var(--abx-muted); }
.authbox-discovery-state { font-size:10.5px;color:var(--abx-muted);white-space:nowrap; }
.authbox-discovery-group + .authbox-discovery-group { margin-top:18px; }
.authbox-discovery-group-head { display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px; }
.authbox-discovery-group-title { display:flex;align-items:baseline;gap:7px;min-width:0; }
.authbox-discovery-group-title strong { font-size:12px;font-weight:760; }
.authbox-discovery-count { color:var(--abx-muted);font-size:10.5px; }
.authbox-carousel-actions { display:flex;gap:5px; }
.authbox-carousel-btn {
    width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;
    border:1px solid #cbd6de;border-radius:50%;background:#fff;color:#4f6270;cursor:pointer;
}
.authbox-carousel-btn:hover { background:#f2f6f8;color:var(--abx-blue); }
.authbox-carousel-btn:disabled { opacity:.35;cursor:default; }
.authbox-carousel-btn svg { width:13px;height:13px; }
.authbox-carousel-shell { position:relative; }
.authbox-carousel {
    display:flex;gap:12px;overflow-x:auto;overflow-y:hidden;scroll-behavior:smooth;
    scrollbar-width:thin;scrollbar-color:#c7d2da transparent;padding:2px 2px 8px;
    overscroll-behavior-inline:contain;
}
.authbox-carousel::-webkit-scrollbar { height:6px; }
.authbox-carousel::-webkit-scrollbar-thumb { background:#c7d2da;border-radius:999px; }
.authbox-book {
    flex:0 0 116px;min-width:116px;text-decoration:none!important;color:inherit!important;
    display:block;border-radius:6px;padding:5px;transition:background .12s ease,transform .12s ease;
}
.authbox-book:hover { background:#f1f5f7;transform:translateY(-1px); }
.authbox-cover-wrap {
    width:106px;height:156px;border:1px solid #d9e2e8;border-radius:5px;background:#eef2f4;
    overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px rgba(0,0,0,.08);
}
.authbox-cover { width:100%;height:100%;object-fit:cover;object-position:center top;display:block; }
.authbox-cover-placeholder { color:#9aa7b1;text-align:center;padding:8px;font-size:9px;line-height:1.25; }
.authbox-cover-placeholder svg { display:block;width:28px;height:28px;margin:0 auto 6px; }
.authbox-book-title { margin-top:6px;font-size:10.5px;font-weight:680;line-height:1.25;color:#263b49;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden; }
.authbox-book-meta { margin-top:3px;color:var(--abx-muted);font-size:9.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.authbox-discovery-empty {
    border:1px dashed #d4dee5;border-radius:6px;background:#fff;padding:14px;color:var(--abx-muted);
    font-size:11px;text-align:center;
}
.authbox-discovery-loading { display:flex;gap:8px;align-items:center;padding:12px 0;color:var(--abx-muted);font-size:11px; }
.authbox-spinner { width:14px;height:14px;border:2px solid #d9e2e8;border-top-color:var(--abx-blue-2);border-radius:50%;animation:authbox-spin .7s linear infinite; }
@keyframes authbox-spin { to { transform:rotate(360deg); } }

/* Qualidade */
#authbox-kpis { display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:var(--abx-line); }
.authbox-kpi { position:relative;background:#fff;border:0;text-align:left;padding:11px 12px;cursor:pointer;font-family:inherit; }
.authbox-kpi::before { content:"";position:absolute;left:0;top:0;bottom:0;width:3px; }
.kpi-red::before { background:var(--abx-red); }
.kpi-orange::before { background:var(--abx-orange); }
.kpi-green::before { background:var(--abx-green); }
.kpi-blue::before { background:var(--abx-blue-2); }
.kpi-purple::before { background:var(--abx-purple); }
.authbox-kpi-icon { display:inline-flex;width:18px;height:18px;color:var(--abx-muted); }
.authbox-kpi-icon svg { width:14px;height:14px; }
.authbox-kpi-label { display:block;margin-top:4px;font-size:9.5px;text-transform:uppercase;letter-spacing:.03em;color:var(--abx-muted);font-weight:650; }
.authbox-kpi-value { display:block;margin-top:2px;font-size:19px;font-weight:800; }
.authbox-kpi-detail { display:block;margin-top:2px;color:var(--abx-muted);font-size:10px; }
#authbox-controls { display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 18px;background:var(--abx-soft);border-bottom:1px solid var(--abx-line); }
#authbox-load { display:inline-flex;align-items:center;gap:6px;padding:7px 13px;border:1px solid transparent;border-radius:6px;background:var(--abx-blue);color:#fff;font:650 11.5px inherit;cursor:pointer; }
#authbox-load svg { width:11px;height:11px; }
#authbox-load:disabled { opacity:.55;cursor:not-allowed; }
#authbox-progress { flex:1;min-width:160px;height:7px;background:#e4e9ed;border-radius:999px;overflow:hidden; }
#authbox-progress.authbox-idle { opacity:.35; }
#authbox-progress-fill { display:block;height:100%;width:0;background:linear-gradient(90deg,#6bb9d6,var(--abx-blue-2));border-radius:999px;transition:width .2s ease; }
#authbox-progress-text { font-size:10.5px;color:var(--abx-muted);white-space:nowrap; }
#authbox-status { padding:8px 18px;font-size:11.5px;color:var(--abx-muted);background:#fbfcfd;border-bottom:1px solid var(--abx-line); }
.authbox-menu { display:flex;gap:7px;flex-wrap:wrap;padding:10px 18px;border-bottom:1px solid var(--abx-line); }
.authbox-menu-btn { display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;border:1px solid #c7d2da;background:#fff;color:var(--abx-muted);font:600 11px inherit;cursor:pointer; }
.authbox-menu-btn.active { background:var(--abx-blue);border-color:var(--abx-blue);color:#fff; }
.authbox-menu-count { font-weight:800; }
.menu-critical { border-left:3px solid var(--abx-red); }
.menu-review { border-left:3px solid var(--abx-orange); }
.menu-ok { border-left:3px solid var(--abx-green); }
.menu-neutral { border-left:3px solid #99a5af; }
.authbox-table-wrap { max-height:380px;overflow:auto; }
.authbox-table { width:100%;border-collapse:collapse;font-size:11.5px; }
.authbox-table thead th { position:sticky;top:0;z-index:2;background:var(--abx-soft);text-align:left;padding:7px 12px;border-bottom:1px solid var(--abx-line);font-size:10px;text-transform:uppercase;letter-spacing:.03em;color:var(--abx-muted); }
.authbox-table tbody td { padding:7px 12px;border-bottom:1px solid #eef2f4;vertical-align:top; }
.authbox-table tbody tr:hover td { background:#f9fbfc; }
.authbox-table a { color:var(--abx-blue);font-weight:650;text-decoration:none; }
.authbox-title-cell { min-width:200px;font-weight:650; }
.authbox-chip { display:inline-block;border:1px solid #e4eaee;background:var(--abx-soft);border-radius:999px;padding:2px 7px;font-size:10.5px; }
.authbox-pill { display:inline-flex;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700; }
.prio-critical { background:#fceceb;color:var(--abx-red); }
.prio-review { background:#fdf2e4;color:var(--abx-orange); }
.prio-info { background:#f1f3f5;color:var(--abx-muted); }
.authbox-action-detail { max-width:280px;margin-top:2px;color:var(--abx-muted);font-size:10px; }
.authbox-review-badge { display:inline-block;padding:2px 8px;border-radius:999px;background:#eaf7ef;color:var(--abx-green);font-size:10px;font-weight:700; }
.authbox-mini-btn { display:inline-flex;border:1px solid #c7d2da;border-radius:5px;background:#fff;color:var(--abx-muted);padding:3px 8px;font:600 10px inherit;cursor:pointer;white-space:nowrap;text-decoration:none!important; }
.authbox-mini-btn:hover { background:#f1f4f6;color:var(--abx-ink); }
.authbox-links { display:flex;gap:5px; }
.authbox-footer { padding:8px 18px;border-top:1px solid var(--abx-line);background:#fbfcfd;color:var(--abx-muted);font-size:10.5px; }
.authbox-empty { padding:14px;text-align:center;color:var(--abx-muted);font-size:11px; }

@media(max-width:1050px) {
    .authbox-field-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
    #authbox-kpis { grid-template-columns:repeat(3,minmax(0,1fr)); }
}
@media(max-width:760px) {
    .authbox-identity-card { grid-template-columns:1fr; }
    .authbox-photo { width:82px;height:108px; }
    .authbox-field-grid,.authbox-alert-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    #authbox-kpis { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .authbox-book { flex-basis:104px;min-width:104px; }
    .authbox-cover-wrap { width:94px;height:140px; }
}
`;

/* ==========================================================
   JAVASCRIPT
   ========================================================== */

(function () {
    "use strict";

    if (!window.jQuery) {
        console.warn("AuthBox: jQuery não está disponível.");
        return;
    }

    var $ = window.jQuery;

    $(document).ready(function () {
        // Inicialização idempotente: substitui qualquer AuthBox anteriormente carregado.
        $(document).off(".authbox");
        $("#authbox").remove();
        $("#authbox-styles").remove();
        window.__authboxAtivo = true;
        if (!paginaAtualEhEditorAutoridade()) return;

        var CONFIG = {
            camposAutoria: ["700"],
            camposSobreAutor: ["600"],
            camposAssuntoContexto: ["600", "601", "602", "604", "605", "606", "607", "608"],
            maxCandidatosValidacao: 180,
            maxDescoberta: 100,
            concorrenciaDescoberta: 5,
            timeout: 12000
        };

        var STATE = {
            authority: null,
            diagnostics: [],
            score: 0,
            candidatos: [],
            ocorrencias: [],
            filtro: "ligados",
            dashboardExecutada: false,
            dashboardEmCurso: false,
            dashboardToken: 0,
            xhrDashboard: [],
            imagemWikidata: "",
            imagemWikidataQid: "",
            discovery: {
                authid: "",
                carregando: false,
                carregado: false,
                token: 0,
                candidatos: [],
                obras: [],
                sobre: [],
                falhas: 0,
                xhr: []
            }
        };

        instalarEstilos();
        $("#authbox").remove();
        construirInterface();
        atualizarAuthorityState();
        renderTudo();
        ligarEventos();
        aplicarColapso(lerColapsoGuardado());
        carregarDescoberta();

        /* ------------------------------------------------------
           Página e utilitários
           ------------------------------------------------------ */

        function paginaAtualEhEditorAutoridade() {
            var path = window.location.pathname || "";
            var params = new URLSearchParams(window.location.search || "");
            var ok = path.indexOf("/cgi-bin/koha/authorities/authorities.pl") !== -1 ||
                     path.indexOf("/authorities/authorities.pl") !== -1;
            return ok && (!!params.get("authid") || params.has("authtypecode"));
        }

        function obterAuthidAtual() {
            var v = new URLSearchParams(window.location.search || "").get("authid") || "";
            return /^\d+$/.test(v) ? v : "";
        }

        function limparTexto(v) {
            return String(v == null ? "" : v).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
        }

        function escaparHTML(v) {
            return String(v == null ? "" : v)
                .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        }

        function escaparAttr(v) { return escaparHTML(v); }

        function escaparRegex(v) {
            return String(v || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }

        function escaparSelector(v) {
            if ($.escapeSelector) return $.escapeSelector(String(v || ""));
            return String(v || "").replace(/([ #;?%&,.+*~':"!^$[\]()=>|\/@])/g, "\\$1");
        }

        function normalizar(v) {
            var s = String(v || "").toLowerCase();
            try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
            return s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
        }

        function removerDuplicados(lista, chaveFn) {
            var out = [], vistos = {};
            (lista || []).forEach(function (item) {
                var chave = chaveFn ? chaveFn(item) : limparTexto(item);
                if (!chave || vistos[chave]) return;
                vistos[chave] = true;
                out.push(item);
            });
            return out;
        }

        function tornarURLSegura(url) {
            url = limparTexto(url);
            if (!url) return "";
            try {
                var u = new URL(url, window.location.origin);
                if (u.protocol !== "http:" && u.protocol !== "https:") return "";
                return u.href;
            } catch (e) { return ""; }
        }

        function normalizarURLInterna(url) {
            if (!url) return "";
            try {
                var u = new URL(url, window.location.origin);
                return u.pathname + u.search;
            } catch (e) { return url; }
        }

        /* ------------------------------------------------------
           CSS
           ------------------------------------------------------ */

        function instalarEstilos() {
            if (document.getElementById("authbox-styles")) return;
            var style = document.createElement("style");
            style.id = "authbox-styles";
            style.type = "text/css";
            style.textContent = AUTHBOX_CSS;
            document.head.appendChild(style);
        }

        /* ------------------------------------------------------
           Leitura da autoridade
           ------------------------------------------------------ */

        function atualizarAuthorityState() {
            STATE.authority = obterDadosAutoridade();
            STATE.diagnostics = diagnosticarAutoridade(STATE.authority);
            STATE.score = calcularScore();
        }

        function obterDadosAutoridade() {
            var campo200 = obterCampoMARCEditor("200");
            var nomeA = obterSubcampoEditor(campo200, "a", ["Palavra de ordem"]);
            var nomeB = obterSubcampoEditor(campo200, "b", ["Outra parte do nome"]);
            var nomeC = obterSubcampoEditor(campo200, "c", ["Elementos de identificação", "Elementos de identificação ou distinção"]);
            var datas = obterSubcampoEditor(campo200, "f", ["Datas"]);
            var ids017 = obterIdentificadores017Atuais();

            return {
                authid: obterAuthidAtual(),
                nomeA: nomeA,
                nomeB: nomeB,
                nomeC: nomeC,
                nome: construirNomePessoa(nomeA, nomeB, nomeC),
                datas: datas,
                wikidata: ids017.filter(function (x) { return x.tipo === "wikidata"; }),
                viaf: ids017.filter(function (x) { return x.tipo === "viaf"; }),
                variantes400: obterFormasEditor("400"),
                relacionadas500: obterFormasEditor("500")
            };
        }

        function construirNomePessoa(a, b, c) {
            a = limparTexto(a); b = limparTexto(b); c = limparTexto(c);
            return limparTexto([b, a, c].filter(Boolean).join(" "));
        }

        function obterCampoMARCEditor(tag) {
            var melhor = $();
            $("li").each(function () {
                var $li = $(this);
                var texto = limparTexto($li.text());
                if (new RegExp("(^|\\s)" + escaparRegex(tag) + "(\\s|$)").test(texto) &&
                    ($li.find("input,textarea,select").length >= 2)) {
                    melhor = $li;
                    return false;
                }
            });
            return melhor;
        }

        function obterSubcampoEditor(campo, codigo, rotulos) {
            if (!campo || !campo.length) return "";
            codigo = String(codigo || "").toLowerCase();
            rotulos = rotulos || [];
            var resultado = "";

            campo.find("input[type='text']").each(function () {
                var $code = $(this);
                if (limparTexto($code.val()).toLowerCase() !== codigo) return;
                var $linha = $code.closest("li,div,tr,p");
                for (var i = 0; i < 5 && $linha.length; i++) {
                    var $vals = $linha.find("input[type='text'],textarea,select").filter(function () {
                        if (this === $code[0]) return false;
                        var v = limparTexto($(this).val());
                        return v.toLowerCase() !== codigo && v !== "200" && v !== "400" && v !== "500";
                    });
                    if ($vals.length) {
                        var $cand = $vals.last();
                        var val = limparTexto($cand.val());
                        if (val) { resultado = val; return false; }
                    }
                    $linha = $linha.parent();
                }
            });
            if (resultado) return resultado;

            for (var r = 0; r < rotulos.length && !resultado; r++) {
                var alvo = rotulos[r].toLowerCase();
                campo.find("label").each(function () {
                    var $label = $(this);
                    if (limparTexto($label.text()).toLowerCase().indexOf(alvo) === -1) return;
                    var id = $label.attr("for");
                    if (id) {
                        var $el = $("#" + escaparSelector(id));
                        if ($el.length) {
                            var v = limparTexto($el.val());
                            if (v && v.toLowerCase() !== codigo) { resultado = v; return false; }
                        }
                    }
                    var $linha = $label.closest("li,div,tr,p");
                    var $inputs = $linha.find("input[type='text'],textarea,select").filter(function () {
                        var v = limparTexto($(this).val());
                        return v && v.toLowerCase() !== codigo && !/^[a-z0-9]$/i.test(v);
                    });
                    if ($inputs.length) { resultado = limparTexto($inputs.last().val()); return false; }
                });
            }
            return resultado;
        }

        function obterIdentificadores017Atuais() {
            var out = [], vistos = {};
            localizarOcorrencias017().forEach(function (campo) {
                var valor = limparTexto(campo.a.val());
                var fonte = limparTexto(campo.dois.val()).toLowerCase();
                if (!valor || !fonte) return;
                var chave = valor.toUpperCase() + "|" + fonte;
                if (vistos[chave]) return;
                vistos[chave] = true;
                out.push({ valor: valor, fonte: fonte, tipo: classificar017(valor, fonte) });
            });
            return out;
        }

        function localizarOcorrencias017() {
            var out = [], vistos = {};
            $("li").each(function () {
                var $li = $(this), txt = limparTexto($li.text());
                if (!/(^|\s)017(\s|$)/.test(txt)) return;
                var a = obterElemento017($li, "a", "Identificador");
                var dois = obterElemento017($li, "2", "Sistema de codificação");
                if (!a.length || !dois.length) return;
                var chave = (a.attr("id") || a.attr("name") || "") + "|" + (dois.attr("id") || dois.attr("name") || "");
                if (!chave || vistos[chave]) return;
                vistos[chave] = true;
                out.push({ bloco: $li, a: a, dois: dois });
            });
            return out;
        }

        function obterElemento017(bloco, codigo, rotulo) {
            var encontrado = $();
            bloco.find("input[type='text']").each(function () {
                var $code = $(this);
                if (limparTexto($code.val()) !== codigo) return;
                var $linha = $code.closest("li,div,tr,p");
                var $vals = $linha.find("input[type='text'],textarea").filter(function () {
                    return this !== $code[0] && limparTexto($(this).val()) !== codigo;
                });
                if ($vals.length) { encontrado = $vals.last(); return false; }
            });
            if (encontrado.length) return encontrado;

            bloco.find("label").each(function () {
                var $label = $(this);
                if (limparTexto($label.text()).indexOf(rotulo) === -1) return;
                var id = $label.attr("for");
                if (id && $("#" + escaparSelector(id)).length) {
                    encontrado = $("#" + escaparSelector(id)); return false;
                }
            });
            return encontrado;
        }

        function classificar017(valor, fonte) {
            if (/^Q\d+$/i.test(valor) && fonte.indexOf("wikidata") !== -1) return "wikidata";
            if (/^\d+$/.test(valor) && fonte.indexOf("viaf") !== -1) return "viaf";
            return "outro";
        }

        function obterFormasEditor(tag) {
            var formas = [], vistos = {};
            $("li").each(function () {
                var $li = $(this), txt = limparTexto($li.text());
                if (!new RegExp("(^|\\s)" + tag + "(\\s|$)").test(txt)) return;
                var a = obterSubcampoEditor($li, "a", ["Palavra de ordem"]);
                var b = obterSubcampoEditor($li, "b", ["Outra parte do nome"]);
                var c = obterSubcampoEditor($li, "c", ["Elementos de identificação", "Elementos de identificação ou distinção"]);
                var f = obterSubcampoEditor($li, "f", ["Datas"]);
                var cinco = tag === "500" ? obterSubcampoEditor($li, "5", ["Código de relação", "Relação"]) : "";
                var forma = construirNomePessoa(a, b, c);
                if (!forma) return;
                var chave = normalizar(forma) + "|" + f + "|" + cinco;
                if (vistos[chave]) return;
                vistos[chave] = true;
                formas.push({ forma: forma, nomeA: a, nomeB: b, nomeC: c, datas: f, relacao5: cinco });
            });
            return formas;
        }

        /* ------------------------------------------------------
           Diagnóstico e score
           ------------------------------------------------------ */

        function diagnosticarAutoridade(a) {
            var issues = [];
            if (!a.authid) issues.push(issue("critical", "Autoridade sem AuthID", "Grave a autoridade para ativar a descoberta e a validação bibliográfica."));
            if (!a.nomeA) issues.push(issue("critical", "200$a ausente", "A palavra de ordem não foi identificada."));
            if (!a.nome) issues.push(issue("critical", "Forma autorizada incompleta", "Não foi possível reconstruir a forma autorizada do 200."));
            if (!a.wikidata.length) issues.push(issue("review", "Wikidata ausente", "Não foi identificado um QID válido no 017."));
            if (!a.viaf.length) issues.push(issue("review", "VIAF ausente", "Não foi identificado um VIAF válido no 017."));
            if (a.wikidata.length > 1) issues.push(issue("critical", "Múltiplos QID", "Existem vários identificadores Wikidata na autoridade."));
            if (a.viaf.length > 1) issues.push(issue("review", "Múltiplos VIAF", "Existem vários identificadores VIAF na autoridade."));

            var datas = analisarDatas(a.datas);
            if (datas.estado !== "ok") issues.push(issue(datas.estado === "bad" ? "review" : "info", datas.label, datas.detalhe));
            if (!a.variantes400.length) issues.push(issue("info", "Sem formas variantes", "Não existem ocorrências 400 registadas."));
            return issues;
        }

        function issue(severity, title, text) { return { severity: severity, title: title, text: text }; }

        function analisarDatas(v) {
            var d = limparTexto(v);
            if (!d) return { estado:"bad", label:"Datas ausentes", detalhe:"Campo 200$f sem informação cronológica." };
            var x = d.replace(/[‐‑‒–—−]/g, "-");
            if (/\d{3,4}\s*-\s*\d{3,4}/.test(x)) return { estado:"ok", label:"Datas completas", detalhe:d };
            if (/\d{3,4}\s*-\s*$/.test(x)) return { estado:"warn", label:"Sem data de morte", detalhe:d };
            if (/^\s*-\s*\d{3,4}/.test(x)) return { estado:"warn", label:"Sem data de nascimento", detalhe:d };
            if (/\d{3,4}/.test(x)) return { estado:"warn", label:"Data parcial", detalhe:d };
            return { estado:"bad", label:"Datas não interpretadas", detalhe:d };
        }

        function calcularScore() {
            var a = STATE.authority || {};
            var score = 100;
            (STATE.diagnostics || []).forEach(function (d) {
                score -= d.severity === "critical" ? 14 : (d.severity === "review" ? 7 : 2);
            });
            if (STATE.dashboardExecutada) {
                var relevantes = (STATE.ocorrencias || []).filter(function (o) { return o.grupo === "imediata" || o.problema === "Ligação correta"; });
                if (relevantes.length) {
                    var corretas = relevantes.filter(function (o) { return o.problema === "Ligação correta"; }).length;
                    var bibScore = Math.round((corretas / relevantes.length) * 100);
                    score = Math.round(score * .55 + bibScore * .45);
                }
            }
            if (a.wikidata && a.wikidata.length && a.viaf && a.viaf.length) score = Math.min(100, score + 4);
            return Math.max(0, Math.min(100, score));
        }

        function estadoScore(v) {
            if (v >= 80) return { label:"Bom", classe:"authbox-score-good" };
            if (v >= 55) return { label:"A rever", classe:"authbox-score-warning" };
            return { label:"Crítico", classe:"authbox-score-critical" };
        }

        /* ------------------------------------------------------
           Imagem Wikidata
           ------------------------------------------------------ */

        function obterImagemDashboard() {
            if (STATE.imagemWikidata) return STATE.imagemWikidata;
            var qid = STATE.authority && STATE.authority.wikidata.length ? STATE.authority.wikidata[0].valor : "";
            if (qid && STATE.imagemWikidataQid !== qid) carregarImagemWikidata(qid);
            return "";
        }

        function carregarImagemWikidata(qid) {
            qid = String(qid || "").toUpperCase();
            if (!/^Q\d+$/.test(qid)) return;
            STATE.imagemWikidataQid = qid;
            $.ajax({
                url:"https://www.wikidata.org/wiki/Special:EntityData/" + encodeURIComponent(qid) + ".json",
                method:"GET", dataType:"json", timeout:9000
            }).done(function (data) {
                try {
                    var e = data.entities[qid];
                    var f = e.claims.P18[0].mainsnak.datavalue.value;
                    if (!f) return;
                    STATE.imagemWikidata = "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(f) + "?width=240";
                    renderIdentidade();
                } catch (err) {}
            });
        }

        /* ------------------------------------------------------
           Interface
           ------------------------------------------------------ */

        function construirInterface() {
            var html = '' +
                '<section id="authbox">' +
                  '<header id="authbox-header">' +
                    '<div id="authbox-header-title"><div id="authbox-mark">' + iconeOk() + '</div>' +
                      '<div><strong>AuthBox</strong><p>Identidade, descoberta no catálogo e controlo de qualidade.</p></div>' +
                    '</div>' +
                    '<button type="button" id="authbox-toggle">' + iconeChevronBaixo() + '<span>Ocultar</span></button>' +
                  '</header>' +
                  '<div id="authbox-body"><div id="authbox-body-inner">' +
                    '<div id="authbox-identity"></div>' +
                    '<div id="authbox-discovery"></div>' +
                    '<div id="authbox-kpis"></div>' +
                    '<div id="authbox-controls">' +
                      '<button type="button" id="authbox-load">' + iconePlay() + ' Carregar validação bibliográfica</button>' +
                      '<div id="authbox-progress" class="authbox-idle"><span id="authbox-progress-fill"></span></div>' +
                      '<span id="authbox-progress-text">Registos processados: 0 / 0</span>' +
                    '</div>' +
                    '<div id="authbox-status">A validação detalhada é executada a pedido.</div>' +
                    '<div id="authbox-review"></div>' +
                  '</div></div>' +
                '</section>';

            var $h1 = $("h1").first();
            if ($h1.length) $h1.after(html);
            else $("#main_intranet-main,#main").first().prepend(html);
        }

        function renderTudo() {
            atualizarAuthorityState();
            renderIdentidade();
            renderDescoberta();
            renderKpis();
            renderAreaRevisao();
        }

        function renderIdentidade() {
            atualizarAuthorityState();
            var a = STATE.authority || {};
            var estado = estadoScore(STATE.score);
            var wd = a.wikidata.length ? a.wikidata[0].valor : "";
            var viaf = a.viaf.length ? a.viaf[0].valor : "";
            var foto = obterImagemDashboard();
            var datas = analisarDatas(a.datas);

            var html = '<div class="authbox-identity-card">' +
                (foto ? '<img class="authbox-photo" src="' + escaparAttr(foto) + '" alt="">' : '<div class="authbox-photo authbox-photo-empty">' + iconePessoa() + '</div>') +
                '<div>' +
                  '<div class="authbox-name">' + escaparHTML(a.nome || "Autoridade sem nome identificado") +
                    (a.datas ? ' <span class="authbox-dates">' + escaparHTML(a.datas) + '</span>' : '') + '</div>' +
                  '<div class="authbox-badges">' +
                    '<span class="authbox-badge">AuthID: ' + escaparHTML(a.authid || "por gravar") + '</span>' +
                    '<span class="authbox-badge ' + estado.classe + '">Qualidade: ' + STATE.score + ' · ' + estado.label + '</span>' +
                  '</div>' +
                  '<div class="authbox-field-grid">' +
                    campoIdentidade('200$a', a.nomeA || '—') +
                    campoIdentidade('200$b', a.nomeB || '—') +
                    campoIdentidade('200$c', a.nomeC || '—') +
                    campoIdentidade('Wikidata', wd ? '<a target="_blank" rel="noopener" href="https://www.wikidata.org/wiki/' + escaparAttr(wd) + '">' + escaparHTML(wd) + ' ↗</a>' : '—') +
                    campoIdentidade('VIAF', viaf ? '<a target="_blank" rel="noopener" href="https://viaf.org/viaf/' + escaparAttr(viaf) + '">' + escaparHTML(viaf) + ' ↗</a>' : '—') +
                  '</div>' +
                  '<div class="authbox-alert-grid">' +
                    alertaMini(datas.estado, 'Estado cronológico', datas.label) +
                    alertaMini(wd && viaf ? 'ok' : 'warn', 'Identificadores', (wd ? 'Wikidata' : 'Sem Wikidata') + ' · ' + (viaf ? 'VIAF' : 'Sem VIAF')) +
                  '</div>' +
                '</div></div>';
            $("#authbox-identity").html(html);
        }

        function campoIdentidade(rotulo, valor) {
            return '<div class="authbox-field"><strong>' + escaparHTML(rotulo) + '</strong><span>' + valor + '</span></div>';
        }

        function alertaMini(estado, titulo, texto) {
            var c = estado === 'ok' ? 'authbox-alert-ok' : (estado === 'warn' ? 'authbox-alert-warn' : 'authbox-alert-bad');
            return '<div class="authbox-mini-alert ' + c + '"><strong>' + escaparHTML(titulo) + '</strong><span>' + escaparHTML(texto) + '</span></div>';
        }

        /* ------------------------------------------------------
           Descoberta no catálogo
           ------------------------------------------------------ */

        function renderDescoberta() {
            var d = STATE.discovery;
            var a = STATE.authority || {};
            var status = d.carregando ? 'A analisar o catálogo…' : (d.carregado ? (d.candidatos.length + ' registos ligados analisados') : '');

            var html = '<div class="authbox-discovery-head"><div><h3>Descobrir no catálogo</h3>' +
                '<p>Obras em que a autoridade é autor principal (700) e documentos em que surge como assunto (600).</p></div>' +
                '<span class="authbox-discovery-state">' + escaparHTML(status) + '</span></div>';

            if (!a.authid) {
                html += '<div class="authbox-discovery-empty">Grave a autoridade para pesquisar obras associadas ao AuthID.</div>';
                $("#authbox-discovery").html(html);
                return;
            }

            if (d.carregando && !d.carregado) {
                html += '<div class="authbox-discovery-loading"><span class="authbox-spinner"></span> A identificar obras e documentos sobre ' + escaparHTML(a.nome || 'esta autoridade') + '…</div>';
                $("#authbox-discovery").html(html);
                return;
            }

            html += renderGrupoDescoberta('works', 'Obras do autor', d.obras, 'Não foram identificadas obras com esta autoridade no campo 700.');
            html += renderGrupoDescoberta('about', 'Sobre o autor', d.sobre, 'Não foram identificados documentos com esta autoridade no campo 600.');
            $("#authbox-discovery").html(html);
        }

        function renderGrupoDescoberta(id, titulo, lista, vazio) {
            lista = lista || [];
            var html = '<section class="authbox-discovery-group">' +
                '<div class="authbox-discovery-group-head"><div class="authbox-discovery-group-title"><strong>' + escaparHTML(titulo) + '</strong><span class="authbox-discovery-count">' + lista.length + '</span></div>' +
                '<div class="authbox-carousel-actions"><button type="button" class="authbox-carousel-btn" data-carousel="' + id + '" data-dir="-1" aria-label="Anterior">' + iconeChevronEsquerda() + '</button>' +
                '<button type="button" class="authbox-carousel-btn" data-carousel="' + id + '" data-dir="1" aria-label="Seguinte">' + iconeChevronDireita() + '</button></div></div>';

            if (!lista.length) {
                html += '<div class="authbox-discovery-empty">' + escaparHTML(vazio) + '</div></section>';
                return html;
            }

            html += '<div class="authbox-carousel-shell"><div class="authbox-carousel" id="authbox-carousel-' + id + '">';
            lista.forEach(function (obra) { html += cardObra(obra); });
            html += '</div></div></section>';
            return html;
        }

        function cardObra(obra) {
            var capa = tornarURLSegura(obra.capa);
            var href = obra.detalhe || ('/cgi-bin/koha/catalogue/detail.pl?biblionumber=' + encodeURIComponent(obra.biblionumber));
            var meta = obra.ano || ('Bib# ' + obra.biblionumber);
            return '<a class="authbox-book" href="' + escaparAttr(href) + '" target="_blank" rel="noopener" title="Abrir registo bibliográfico">' +
                '<span class="authbox-cover-wrap">' +
                (capa ? '<img class="authbox-cover" loading="lazy" src="' + escaparAttr(capa) + '" alt="">' : '<span class="authbox-cover-placeholder">' + iconeLivro() + 'Sem capa</span>') +
                '</span><span class="authbox-book-title">' + escaparHTML(obra.titulo || ('Registo ' + obra.biblionumber)) + '</span>' +
                '<span class="authbox-book-meta">' + escaparHTML(meta) + '</span></a>';
        }

        function carregarDescoberta(forcar) {
            atualizarAuthorityState();
            var authid = STATE.authority.authid;
            if (!authid) { renderDescoberta(); return; }

            var d = STATE.discovery;
            if (!forcar && d.carregado && d.authid === authid) { renderDescoberta(); return; }
            if (d.carregando && d.authid === authid) return;

            cancelarPedidos(d.xhr);
            d.token++;
            var token = d.token;
            d.authid = authid;
            d.carregando = true;
            d.carregado = false;
            d.candidatos = [];
            d.obras = [];
            d.sobre = [];
            d.falhas = 0;
            d.xhr = [];
            renderDescoberta();

            var url = '/cgi-bin/koha/catalogue/search.pl?q=' + encodeURIComponent('an:' + authid) + '&count=50';
            carregarResultadosPaginados(url, CONFIG.maxDescoberta, d.xhr, function (erro, candidatos) {
                if (token !== d.token) return;
                candidatos = candidatos || [];
                d.candidatos = candidatos;
                if (erro && !candidatos.length) {
                    d.carregando = false;
                    d.carregado = true;
                    renderDescoberta();
                    return;
                }
                classificarDescoberta(candidatos, authid, token);
            });
        }

        function carregarResultadosPaginados(url, limite, colecaoXhr, callback) {
            var todos = [], vistosBib = {}, paginas = {}, terminou = false;

            function concluir(erro) {
                if (terminou) return;
                terminou = true;
                callback(erro, todos.slice(0, limite));
            }

            function proxima(u) {
                if (!u || todos.length >= limite || paginas[u]) { concluir(false); return; }
                paginas[u] = true;
                var xhr = $.ajax({ url:u, method:'GET', dataType:'html', timeout:CONFIG.timeout })
                    .done(function (html) {
                        extrairResultadosCatalogo(html).forEach(function (obra) {
                            if (!obra.biblionumber || vistosBib[obra.biblionumber] || todos.length >= limite) return;
                            vistosBib[obra.biblionumber] = true;
                            todos.push(obra);
                        });
                        if (todos.length >= limite) { concluir(false); return; }
                        var next = encontrarProximaPagina(html, u);
                        if (next) proxima(next); else concluir(false);
                    })
                    .fail(function () { concluir(todos.length === 0); });
                colecaoXhr.push(xhr);
            }
            proxima(url);
        }

        function extrairResultadosCatalogo(html) {
            var doc = $('<div>').append($.parseHTML(html, document, true));
            var out = [], vistos = {};
            doc.find('a[href*="detail.pl?biblionumber="]').each(function () {
                var $a = $(this);
                var b = obterBiblionumberDeURL($a.attr('href') || '');
                if (!b || vistos[b]) return;
                var $ctx = $a.closest('tr,.searchresults,.result,.bibliocol,li');
                if (!$ctx.length) $ctx = $a.parent();
                var titulo = obterTituloResultado($ctx, b);
                if (!titulo) return;
                vistos[b] = true;
                var capa = extrairCapaResultado($ctx);
                var ano = extrairAnoResultado($ctx);
                out.push({
                    biblionumber:b,
                    titulo:titulo,
                    capa:capa,
                    ano:ano,
                    detalhe:'/cgi-bin/koha/catalogue/detail.pl?biblionumber=' + encodeURIComponent(b),
                    marc:'/cgi-bin/koha/catalogue/MARCdetail.pl?biblionumber=' + encodeURIComponent(b),
                    editar:'/cgi-bin/koha/cataloguing/addbiblio.pl?biblionumber=' + encodeURIComponent(b)
                });
            });
            return out;
        }

        function obterTituloResultado($ctx, b) {
            var titulo = '';
            $ctx.find('a.title,h2 a,h3 a,a[href*="detail.pl?biblionumber="]').each(function () {
                if (titulo) return;
                var t = limparTexto($(this).text());
                if (t && t.length > 2 && !ehRuidoResultado(t)) titulo = t;
            });
            return titulo || ('Registo bibliográfico ' + b);
        }

        function ehRuidoResultado(t) {
            var n = normalizar(t);
            return !n || /^(imagem local de capa|reservas|adicionar ao carrinho|editar|ver detalhe|ver marc|vista opac)$/.test(n);
        }

        function extrairCapaResultado($ctx) {
            var src = '';
            $ctx.find('img').each(function () {
                var s = limparTexto($(this).attr('src') || $(this).attr('data-src') || '');
                if (!s) return;
                if (/spinner|loading|blank|pixel|icon/i.test(s)) return;
                src = s; return false;
            });
            return src ? tornarURLSegura(src) : '';
        }

        function extrairAnoResultado($ctx) {
            var texto = limparTexto($ctx.text());
            var m = texto.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
            return m ? m[1] : '';
        }

        function encontrarProximaPagina(html, atual) {
            var doc = $('<div>').append($.parseHTML(html, document, true));
            var href = '';
            var $next = doc.find('a[rel="next"]').first();
            if (!$next.length) {
                doc.find('.pagination a,nav a').each(function () {
                    var txt = limparTexto($(this).text()).toLowerCase();
                    var title = limparTexto($(this).attr('title') || '').toLowerCase();
                    if (/^(next|próximo|proximo|seguinte|›|»)$/.test(txt) || /next|próxim|proxim|seguinte/.test(title)) {
                        $next = $(this); return false;
                    }
                });
            }
            href = $next.length ? ($next.attr('href') || '') : '';
            if (!href) return '';
            try {
                var u = new URL(href, new URL(atual, window.location.origin));
                return u.pathname + u.search;
            } catch (e) { return normalizarURLInterna(href); }
        }

        function classificarDescoberta(candidatos, authid, token) {
            var d = STATE.discovery;
            var indice = 0, ativos = 0, concluidos = 0;

            if (!candidatos.length) {
                d.carregando = false; d.carregado = true; renderDescoberta(); return;
            }

            function terminar() {
                if (concluidos < candidatos.length || ativos > 0) return false;
                d.obras = removerDuplicados(d.obras, function (x) { return String(x.biblionumber); })
                    .sort(function (a,b) { return String(a.titulo).localeCompare(String(b.titulo),'pt'); });
                d.sobre = removerDuplicados(d.sobre, function (x) { return String(x.biblionumber); })
                    .sort(function (a,b) { return String(a.titulo).localeCompare(String(b.titulo),'pt'); });
                d.carregando = false;
                d.carregado = true;
                renderDescoberta();
                return true;
            }

            function arrancar() {
                if (token !== d.token) return;
                if (terminar()) return;
                while (ativos < CONFIG.concorrenciaDescoberta && indice < candidatos.length) {
                    (function (obra) {
                        ativos++;
                        var xhr = $.ajax({ url:obra.marc, method:'GET', dataType:'html', timeout:CONFIG.timeout })
                            .done(function (html) {
                                if (token !== d.token) return;
                                var classes = classificarMARCParaDescoberta(html, authid);
                                if (classes.autor) d.obras.push(obra);
                                if (classes.sobre) d.sobre.push(obra);
                            })
                            .fail(function () { if (token === d.token) d.falhas++; })
                            .always(function () {
                                ativos--; concluidos++;
                                if (token === d.token) { renderDescoberta(); arrancar(); }
                            });
                        d.xhr.push(xhr);
                    })(candidatos[indice++]);
                }
            }
            arrancar();
        }

        function classificarMARCParaDescoberta(html, authid) {
            var doc = $('<div>').append($.parseHTML(html, document, true));
            doc.find('script,style').remove();
            var blocos = extrairBlocosMARC(doc);
            var resultado = { autor:false, sobre:false };
            blocos.forEach(function (b) {
                var ids = extrairAuthidsDoBloco(b);
                if (ids.indexOf(String(authid)) === -1) return;
                if (b.campo === '700') resultado.autor = true;
                if (b.campo === '600') resultado.sobre = true;
            });
            return resultado;
        }

        /* ------------------------------------------------------
           Dashboard de qualidade
           ------------------------------------------------------ */

        function renderKpis() {
            var sem9 = filtrarOcorrencias('sem9').length;
            var outro = filtrarOcorrencias('outro').length;
            var ligados = filtrarOcorrencias('ligados').length;
            var contexto = filtrarOcorrencias('contexto').length;
            var candidatos = filtrarOcorrencias('sem').length;
            var html = '';
            html += kpi('kpi-red', iconeLapis(), 'Corrigir', sem9, '700 sem ligação $9', 'sem9');
            html += kpi('kpi-orange', iconeOlho(), 'Rever', outro, 'Outro AuthID ou incoerência', 'outro');
            html += kpi('kpi-green', iconeLink(), 'Ligados', ligados, '700 ligado à autoridade', 'ligados');
            html += kpi('kpi-blue', iconeLivro(), 'Contexto', contexto, '600, notas e menções', 'contexto');
            html += kpi('kpi-purple', iconePessoas(), 'Candidatos', candidatos, 'Sem confirmação estrutural', 'sem');
            $('#authbox-kpis').html(html);
        }

        function kpi(classe, icon, label, valor, detalhe, filtro) {
            return '<button type="button" class="authbox-kpi authbox-filter ' + classe + '" data-filter="' + escaparAttr(filtro) + '">' +
                '<span class="authbox-kpi-icon">' + icon + '</span><span class="authbox-kpi-label">' + escaparHTML(label) + '</span>' +
                '<span class="authbox-kpi-value">' + (STATE.dashboardExecutada ? valor : 0) + '</span><span class="authbox-kpi-detail">' + escaparHTML(detalhe) + '</span></button>';
        }

        function renderAreaRevisao() {
            var html = '<div class="authbox-menu">' +
                menuFiltro('sem9','Sem $9','menu-critical') +
                menuFiltro('outro','Rever ligação','menu-review') +
                menuFiltro('variantes','400/500','menu-neutral') +
                menuFiltro('ligados','Ligados','menu-ok') +
                menuFiltro('contexto','Contexto','menu-neutral') +
                menuFiltro('resolvidos','Resolvidos','menu-neutral') +
                '</div><div class="authbox-table-wrap"><table class="authbox-table"><thead><tr>' +
                '<th>Bib#</th><th>Título</th><th>Campo</th><th>Ocorrência</th><th>Prioridade</th><th>Diagnóstico</th><th>Estado</th><th>Ligações</th>' +
                '</tr></thead><tbody id="authbox-table-body"></tbody></table></div><div class="authbox-footer" id="authbox-footer"></div>';
            $('#authbox-review').html(html);
            renderTabela();
        }

        function menuFiltro(filtro, label, classe) {
            var n;
            if (filtro === 'variantes') n = (STATE.authority.variantes400.length + STATE.authority.relacionadas500.length);
            else n = filtrarOcorrencias(filtro).length;
            return '<button type="button" class="authbox-menu-btn authbox-filter ' + classe + (STATE.filtro === filtro ? ' active' : '') + '" data-filter="' + escaparAttr(filtro) + '">' +
                escaparHTML(label) + ' <span class="authbox-menu-count">' + n + '</span></button>';
        }

        function renderTabela() {
            var $body = $('#authbox-table-body');
            if (!$body.length) return;
            if (STATE.filtro === 'variantes') { renderTabelaVariantes($body); return; }
            var lista = filtrarOcorrencias(STATE.filtro);
            if (!lista.length) {
                $body.html('<tr><td colspan="8" class="authbox-empty">0 ocorrências nesta categoria.</td></tr>');
                $('#authbox-footer').text(STATE.dashboardExecutada ? 'Validação concluída.' : 'Carregue a validação bibliográfica para analisar os registos.');
                return;
            }
            var html = '';
            lista.forEach(function (o) {
                html += '<tr><td><a href="' + escaparAttr(o.links.detalhe) + '" target="_blank" rel="noopener">' + escaparHTML(o.biblionumber) + '</a></td>' +
                    '<td class="authbox-title-cell">' + escaparHTML(o.titulo) + '</td>' +
                    '<td><span class="authbox-chip">' + escaparHTML(o.campo || '—') + '</span></td>' +
                    '<td>' + escaparHTML(o.valorEncontrado || '—').slice(0,120) + '</td>' +
                    '<td>' + pillPrioridade(o.prioridade) + '</td>' +
                    '<td>' + escaparHTML(o.acaoCurta || '') + '<div class="authbox-action-detail">' + escaparHTML(o.acaoDetalhada || '') + '</div></td>' +
                    '<td>' + celulaEstado(o) + '</td>' +
                    '<td><div class="authbox-links"><a class="authbox-mini-btn" href="' + escaparAttr(o.links.editar) + '" target="_blank" rel="noopener">✎</a>' +
                    '<a class="authbox-mini-btn" href="' + escaparAttr(o.links.marc) + '" target="_blank" rel="noopener">MARC</a>' +
                    '<a class="authbox-mini-btn" href="' + escaparAttr(o.links.opac) + '" target="_blank" rel="noopener">OPAC</a></div></td></tr>';
            });
            $body.html(html);
            $('#authbox-footer').text('Mostrando ' + lista.length + ' de ' + STATE.ocorrencias.length + ' ocorrência(s) analisada(s).');
        }

        function renderTabelaVariantes($body) {
            var linhas = [];
            STATE.authority.variantes400.forEach(function (v) { linhas.push({ campo:'400', item:v }); });
            STATE.authority.relacionadas500.forEach(function (v) { linhas.push({ campo:'500', item:v }); });
            if (!linhas.length) {
                $body.html('<tr><td colspan="8" class="authbox-empty">Sem formas 400 ou relações 500 registadas.</td></tr>');
                $('#authbox-footer').text(''); return;
            }
            var html = '';
            linhas.forEach(function (x) {
                html += '<tr><td colspan="2" class="authbox-title-cell">' + escaparHTML(x.item.forma) + (x.item.datas ? ' (' + escaparHTML(x.item.datas) + ')' : '') + '</td>' +
                    '<td><span class="authbox-chip">' + x.campo + '</span></td><td>' + (x.campo === '500' ? escaparHTML(formatarRelacao5(x.item.relacao5)) : 'Forma variante') +
                    '</td><td>' + pillPrioridade('Informativa') + '</td><td>Estrutura da autoridade</td><td colspan="2">—</td></tr>';
            });
            $body.html(html);
            $('#authbox-footer').text(STATE.authority.variantes400.length + ' variante(s) 400 · ' + STATE.authority.relacionadas500.length + ' relação(ões) 500.');
        }

        function filtrarOcorrencias(filtro) {
            var lista = STATE.ocorrencias || [];
            return lista.filter(function (o) {
                if (filtro === 'resolvidos') return estaResolvida(o);
                if (estaResolvida(o)) return false;
                if (filtro === 'sem9') return o.problema === 'Falta $9';
                if (filtro === 'outro') return o.problema === 'Outro AuthID' || o.problema === 'Menção de responsabilidade';
                if (filtro === 'ligados') return o.problema === 'Ligação correta';
                if (filtro === 'contexto') return o.grupo === 'contexto';
                if (filtro === 'sem') return o.grupo === 'sem';
                return true;
            });
        }

        function executarDashboard() {
            atualizarAuthorityState();
            if (STATE.dashboardEmCurso) return;
            if (!STATE.authority.authid) { $('#authbox-status').text('Grave a autoridade antes de iniciar a validação.'); return; }
            cancelarPedidos(STATE.xhrDashboard);
            STATE.dashboardToken++;
            var token = STATE.dashboardToken;
            STATE.dashboardEmCurso = true;
            STATE.dashboardExecutada = false;
            STATE.ocorrencias = [];
            STATE.candidatos = [];
            STATE.xhrDashboard = [];
            $('#authbox-load').prop('disabled',true).text('A analisar…');
            atualizarProgresso(0,0,'A pesquisar candidatos…');
            renderKpis(); renderAreaRevisao();

            pesquisarCandidatosDashboard(STATE.authority.authid, STATE.authority.nome, token);
        }

        function pesquisarCandidatosDashboard(authid, nome, token) {
            var pesquisas = [
                { origem:'AuthID', url:'/cgi-bin/koha/catalogue/search.pl?q=' + encodeURIComponent('an:' + authid) + '&count=50' }
            ];
            if (nome) {
                pesquisas.push({ origem:'Autor', url:'/cgi-bin/koha/catalogue/search.pl?idx=au&q=' + encodeURIComponent(nome) + '&count=50' });
                pesquisas.push({ origem:'Texto livre', url:'/cgi-bin/koha/catalogue/search.pl?q=' + encodeURIComponent(nome) + '&count=50' });
            }
            var restantes = pesquisas.length, respostas = [];
            pesquisas.forEach(function (p) {
                var xhr = $.ajax({ url:p.url, method:'GET', dataType:'html', timeout:CONFIG.timeout })
                    .done(function (html) { respostas.push({ origem:p.origem, html:html }); })
                    .always(function () {
                        restantes--;
                        if (!restantes && token === STATE.dashboardToken) {
                            var candidatos = fundirCandidatos(respostas).slice(0,CONFIG.maxCandidatosValidacao);
                            STATE.candidatos = candidatos;
                            validarCandidatosDashboard(candidatos, authid, token);
                        }
                    });
                STATE.xhrDashboard.push(xhr);
            });
        }

        function fundirCandidatos(respostas) {
            var out = [], mapa = {};
            respostas.forEach(function (r) {
                extrairResultadosCatalogo(r.html).forEach(function (obra) {
                    if (!mapa[obra.biblionumber]) {
                        obra.origens = [];
                        mapa[obra.biblionumber] = obra;
                        out.push(obra);
                    }
                    if (mapa[obra.biblionumber].origens.indexOf(r.origem) === -1) mapa[obra.biblionumber].origens.push(r.origem);
                });
            });
            return out;
        }

        function validarCandidatosDashboard(candidatos, authid, token) {
            var ocorrencias = [], indice = 0;
            if (!candidatos.length) { finalizarDashboard('Não foram encontrados registos candidatos.'); return; }

            function seguinte() {
                if (token !== STATE.dashboardToken) return;
                if (indice >= candidatos.length) {
                    STATE.ocorrencias = normalizarOcorrencias(ocorrencias);
                    STATE.dashboardExecutada = true;
                    finalizarDashboard('Concluído: ' + candidatos.length + ' registo(s) analisado(s).');
                    atualizarAuthorityState(); renderTudo();
                    return;
                }
                var obra = candidatos[indice++];
                atualizarProgresso(indice-1,candidatos.length,'A analisar MARC · ' + obra.biblionumber);
                var xhr = $.ajax({ url:obra.marc, method:'GET', dataType:'html', timeout:CONFIG.timeout })
                    .done(function (html) { if (token === STATE.dashboardToken) ocorrencias = ocorrencias.concat(analisarMARCQualidade(html,authid,obra)); })
                    .fail(function () {
                        if (token !== STATE.dashboardToken) return;
                        ocorrencias.push(criarOcorrencia(obra,'','Erro de leitura','Erro de leitura','Revisão','manual','Não foi possível validar o MARC deste registo.'));
                    })
                    .always(function () { if (token === STATE.dashboardToken) seguinte(); });
                STATE.xhrDashboard.push(xhr);
            }
            seguinte();
        }

        function finalizarDashboard(msg) {
            STATE.dashboardEmCurso = false;
            cancelarPedidos(STATE.xhrDashboard);
            STATE.xhrDashboard = [];
            $('#authbox-load').prop('disabled',false).html(iconePlay() + ' Carregar validação bibliográfica');
            $('#authbox-status').text(msg || '');
            $('#authbox-progress-fill').css('width','100%');
            $('#authbox-progress-text').text('Concluído');
        }

        function atualizarProgresso(atual,total,msg) {
            var pct = total ? Math.round((atual/total)*100) : 0;
            $('#authbox-progress').removeClass('authbox-idle');
            $('#authbox-progress-fill').css('width',pct + '%');
            $('#authbox-progress-text').text(total ? (atual + ' / ' + total + ' · ' + pct + '%') : 'A preparar…');
            $('#authbox-status').text(msg || '');
        }

        function analisarMARCQualidade(html, authid, obra) {
            var doc = $('<div>').append($.parseHTML(html, document, true));
            doc.find('script,style').remove();
            var blocos = extrairBlocosMARC(doc);
            var out = [], nomeNorm = normalizar(STATE.authority.nome);

            blocos.forEach(function (b) {
                if (b.campo === '700') {
                    var ids = extrairAuthidsDoBloco(b);
                    var valor = extrairValorPessoaMARC(b);
                    var compativel = textoCompativel(valor || b.texto, nomeNorm);
                    if (ids.indexOf(String(authid)) !== -1) {
                        out.push(criarOcorrencia(obra,'700$9',valor || ('AuthID ' + authid),'Ligação correta','Informativa','contexto','Ligado corretamente à autoridade.'));
                    } else if (compativel && !ids.length) {
                        out.push(criarOcorrencia(obra,'700',valor,'Falta $9','Crítica','imediata','O ponto de acesso é compatível com esta autoridade, mas não contém $9.'));
                    } else if (compativel && ids.length) {
                        out.push(criarOcorrencia(obra,'700$9',valor,'Outro AuthID','Revisão','manual','O ponto de acesso é compatível, mas está ligado a outro AuthID: ' + ids.join(', ') + '.'));
                    }
                    return;
                }

                var classificacao = classificarCampoContextual(b.campo);
                if (!classificacao) return;
                var idsContexto = extrairAuthidsDoBloco(b);
                var texto = extrairValorContextual(b,classificacao.tipo);
                var ligado = idsContexto.indexOf(String(authid)) !== -1;
                var comp = textoCompativel(texto || b.texto,nomeNorm);
                if (!ligado && !comp) return;
                out.push(criarOcorrencia(obra,b.campo,texto || b.texto,classificacao.tipo === 'responsabilidade' ? 'Menção de responsabilidade' : 'Menção contextual','Informativa','contexto',classificacao.natureza + '.'));
            });

            if (!out.length) out.push(criarOcorrencia(obra,'','', 'Sem menção identificada','Informativa','sem','Registo recuperado como candidato sem evidência estrutural clara.'));
            return out;
        }

        function classificarCampoContextual(campo) {
            if (campo === '200') return { tipo:'responsabilidade', natureza:'Menção de responsabilidade' };
            if (/^6\d\d$/.test(campo)) return { tipo:'assunto', natureza:'Assunto' };
            if (/^3\d\d$/.test(campo)) return { tipo:'nota', natureza:'Nota ou texto' };
            if (/^4\d\d$/.test(campo)) return { tipo:'relacao', natureza:'Relação bibliográfica' };
            if (/^5\d\d$/.test(campo)) return { tipo:'titulo', natureza:'Título relacionado' };
            return null;
        }

        function extrairValorContextual(b,tipo) {
            if (tipo === 'responsabilidade') return obterSubcampoMARC(b,'f') || obterSubcampoMARC(b,'g') || b.texto;
            if (tipo === 'assunto') return ['a','b','c','f','x','y','z','j'].map(function (c) { return obterSubcampoMARC(b,c); }).filter(Boolean).join(' ');
            return obterSubcampoMARC(b,'a') || b.texto;
        }

        function criarOcorrencia(obra,campo,valor,problema,prioridade,grupo,detalhe) {
            var obj = {
                biblionumber:obra.biblionumber,
                titulo:obra.titulo || ('Registo ' + obra.biblionumber),
                campo:campo || '',
                valorEncontrado:limparTexto(valor),
                problema:problema,
                prioridade:prioridade,
                grupo:grupo,
                acaoCurta:problema === 'Ligação correta' ? 'Sem ação' : (problema === 'Falta $9' ? 'Ligar autoridade' : 'Rever'),
                acaoDetalhada:detalhe || '',
                links:{
                    detalhe:obra.detalhe,
                    editar:obra.editar,
                    marc:'/cgi-bin/koha/catalogue/showmarc.pl?id=' + encodeURIComponent(obra.biblionumber) + '&viewas=html',
                    opac:'/cgi-bin/koha/opac-detail.pl?biblionumber=' + encodeURIComponent(obra.biblionumber)
                }
            };
            obj.chave = [obj.biblionumber,obj.campo,obj.problema,normalizar(obj.valorEncontrado).slice(0,60)].join('|');
            var estados = lerEstadosRevisao(STATE.authority.authid);
            obj.estadoRevisao = estados[obj.chave] ? estados[obj.chave].estado : '';
            return obj;
        }

        function normalizarOcorrencias(lista) {
            var out = removerDuplicados(lista,function (o) { return [o.biblionumber,o.campo,o.problema,o.valorEncontrado].join('|'); });
            out.sort(function (a,b) {
                var peso = { imediata:1, manual:2, contexto:3, sem:4 };
                var x = peso[a.grupo] || 9, y = peso[b.grupo] || 9;
                return x !== y ? x-y : String(a.titulo).localeCompare(String(b.titulo),'pt');
            });
            return out;
        }

        /* ------------------------------------------------------
           Parser MARC do detalhe bibliográfico
           ------------------------------------------------------ */

        function extrairBlocosMARC(doc) {
            var t = extrairBlocosMARCDeTabela(doc);
            return t.length ? t : extrairBlocosMARCDeTexto(doc);
        }

        function extrairBlocosMARCDeTabela(doc) {
            var out = [];
            doc.find('tr').each(function () {
                var texto = limparTexto($(this).text());
                var m = texto.match(/\b(\d{3})\b/);
                if (!m || texto.length < 4) return;
                out.push({ campo:m[1], texto:texto, subcampos:extrairSubcamposDeTexto(texto) });
            });
            return compactarBlocos(out);
        }

        function extrairBlocosMARCDeTexto(doc) {
            var texto = String(doc.text() || '').replace(/\r/g,'\n').replace(/\u00a0/g,' ');
            var linhas = texto.split(/\n+/).map(limparTexto).filter(Boolean);
            var out = [], atual = null;
            linhas.forEach(function (linha) {
                var m = linha.match(/^(\d{3})(\s|#|$)/);
                if (m) {
                    if (atual) { atual.subcampos = extrairSubcamposDeTexto(atual.texto); out.push(atual); }
                    atual = { campo:m[1], texto:linha, subcampos:{} };
                } else if (atual) atual.texto += ' ' + linha;
            });
            if (atual) { atual.subcampos = extrairSubcamposDeTexto(atual.texto); out.push(atual); }
            return compactarBlocos(out);
        }

        function compactarBlocos(lista) {
            return removerDuplicados(lista,function (b) { return b.campo + '|' + normalizar(b.texto); });
        }

        function extrairSubcamposDeTexto(texto) {
            var sub = {}, t = ' ' + String(texto || '').replace(/‡/g,'$').replace(/ǂ/g,'$').replace(/\s+/g,' ') + ' ';
            var re = /(?:^|\s|\$)([0-9a-z])\s+(.+?)(?=\s(?:[0-9a-z]|\$[0-9a-z])\s+|$)/gi, m;
            while ((m = re.exec(t)) !== null) {
                var c = m[1].toLowerCase(), v = limparTexto(m[2]);
                if (!sub[c]) sub[c] = [];
                if (v) sub[c].push(v);
            }
            return sub;
        }

        function obterSubcampoMARC(b,c) {
            c = String(c || '').toLowerCase();
            if (b.subcampos && b.subcampos[c] && b.subcampos[c].length) return limparTexto(b.subcampos[c].join(' '));
            return '';
        }

        function extrairAuthidsDoBloco(b) {
            var ids = [];
            if (b.subcampos && b.subcampos['9']) {
                b.subcampos['9'].forEach(function (v) {
                    var m = String(v || '').match(/\b\d{1,12}\b/g);
                    if (m) ids = ids.concat(m);
                });
            }
            if (!ids.length) {
                var re = /(?:\$9|\s9\s+)\s*(\d{1,12})\b/g, m2;
                while ((m2 = re.exec(String(b.texto || ''))) !== null) ids.push(m2[1]);
            }
            return removerDuplicados(ids);
        }

        function extrairValorPessoaMARC(b) {
            return limparTexto(['b','a','c','f'].map(function (c) { return obterSubcampoMARC(b,c); }).filter(Boolean).join(' '));
        }

        function textoCompativel(texto,nomeNorm) {
            var t = normalizar(texto);
            if (!t || !nomeNorm) return false;
            var universo = [nomeNorm];
            STATE.authority.variantes400.forEach(function (v) { if (v.forma) universo.push(normalizar(v.forma)); });
            return universo.some(function (u) {
                if (!u) return false;
                if (t === u || t.indexOf(u) !== -1) return true;
                var tokens = u.split(' ').filter(function (x) { return x.length > 2; });
                if (tokens.length < 2) return tokens.length === 1 && t.indexOf(tokens[0]) !== -1;
                var n = tokens.filter(function (x) { return t.indexOf(x) !== -1; }).length;
                return n >= Math.min(2,tokens.length);
            });
        }

        function obterBiblionumberDeURL(url) {
            try {
                var u = new URL(url,window.location.origin);
                var b = u.searchParams.get('biblionumber');
                if (/^\d+$/.test(b || '')) return b;
            } catch (e) {}
            var m = String(url || '').match(/[?&]biblionumber=(\d+)/i);
            return m ? m[1] : '';
        }

        /* ------------------------------------------------------
           Estado local de revisão
           ------------------------------------------------------ */

        function chaveArmazenamentoRevisao(authid) { return 'authbox_review_' + authid; }

        function lerEstadosRevisao(authid) {
            if (!authid) return {};
            try { return JSON.parse(localStorage.getItem(chaveArmazenamentoRevisao(authid)) || '{}'); }
            catch (e) { return {}; }
        }

        function gravarEstadoRevisao(authid,chave,estado) {
            if (!authid || !chave) return;
            try {
                var x = lerEstadosRevisao(authid);
                if (estado) x[chave] = { estado:estado, em:Date.now() }; else delete x[chave];
                localStorage.setItem(chaveArmazenamentoRevisao(authid),JSON.stringify(x));
            } catch (e) {}
        }

        function estaResolvida(o) { return !!(o && (o.estadoRevisao === 'confirmado' || o.estadoRevisao === 'falso_positivo')); }

        function celulaEstado(o) {
            if (estaResolvida(o)) {
                return '<span class="authbox-review-badge">' + (o.estadoRevisao === 'confirmado' ? 'Resolvido' : 'Falso positivo') + '</span> ' +
                    '<button type="button" class="authbox-mini-btn authbox-reopen" data-key="' + escaparAttr(o.chave) + '">Reabrir</button>';
            }
            return '<button type="button" class="authbox-mini-btn authbox-mark-review" data-key="' + escaparAttr(o.chave) + '" data-state="confirmado">Resolvido</button> ' +
                '<button type="button" class="authbox-mini-btn authbox-mark-review" data-key="' + escaparAttr(o.chave) + '" data-state="falso_positivo">Falso pos.</button>';
        }

        function pillPrioridade(p) {
            var c = p === 'Crítica' ? 'prio-critical' : (p === 'Revisão' ? 'prio-review' : 'prio-info');
            return '<span class="authbox-pill ' + c + '">' + escaparHTML(p || 'Informativa') + '</span>';
        }

        function formatarRelacao5(v) {
            var mapa = { a:'nome anterior', b:'nome posterior', c:'nome real', d:'pseudónimo', e:'heterónimo', f:'identidade relacionada', g:'forma associada', h:'entidade relacionada' };
            v = limparTexto(v).toLowerCase();
            return v ? ((mapa[v] || 'relação') + ' [$5 ' + v + ']') : '$5 vazio';
        }

        /* ------------------------------------------------------
           Eventos
           ------------------------------------------------------ */

        function ligarEventos() {
            $(document)
                .off('.authbox')
                .on('click.authbox','#authbox-toggle',function () {
                    var col = !$('#authbox').hasClass('authbox-collapsed');
                    aplicarColapso(col); gravarColapsoGuardado(col);
                })
                .on('click.authbox','#authbox-load',executarDashboard)
                .on('click.authbox','.authbox-filter',function () {
                    STATE.filtro = String($(this).attr('data-filter') || 'ligados');
                    renderAreaRevisao();
                })
                .on('click.authbox','.authbox-carousel-btn',function () {
                    var id = String($(this).attr('data-carousel') || '');
                    var dir = Number($(this).attr('data-dir') || 1);
                    var el = document.getElementById('authbox-carousel-' + id);
                    if (el) el.scrollBy({ left:dir * Math.max(320,Math.round(el.clientWidth * .82)), behavior:'smooth' });
                })
                .on('click.authbox','.authbox-mark-review',function () {
                    var chave = String($(this).attr('data-key') || ''), estado = String($(this).attr('data-state') || '');
                    gravarEstadoRevisao(STATE.authority.authid,chave,estado);
                    STATE.ocorrencias.forEach(function (o) { if (o.chave === chave) o.estadoRevisao = estado; });
                    atualizarAuthorityState(); renderKpis(); renderAreaRevisao();
                })
                .on('click.authbox','.authbox-reopen',function () {
                    var chave = String($(this).attr('data-key') || '');
                    gravarEstadoRevisao(STATE.authority.authid,chave,'');
                    STATE.ocorrencias.forEach(function (o) { if (o.chave === chave) o.estadoRevisao = ''; });
                    atualizarAuthorityState(); renderKpis(); renderAreaRevisao();
                });
        }

        function aplicarColapso(v) {
            $('#authbox').toggleClass('authbox-collapsed',!!v);
            $('#authbox-toggle span').text(v ? 'Mostrar' : 'Ocultar');
        }

        function lerColapsoGuardado() {
            try { return localStorage.getItem('authbox_collapsed') === '1'; } catch (e) { return false; }
        }

        function gravarColapsoGuardado(v) {
            try { localStorage.setItem('authbox_collapsed',v ? '1' : '0'); } catch (e) {}
        }

        function cancelarPedidos(lista) {
            (lista || []).forEach(function (xhr) { try { if (xhr && xhr.readyState !== 4 && xhr.abort) xhr.abort(); } catch (e) {} });
        }

        /* ------------------------------------------------------
           Ícones
           ------------------------------------------------------ */

        function svg(path) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; }
        function iconeOk() { return svg('<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>'); }
        function iconeChevronBaixo() { return svg('<path d="M6 9l6 6 6-6"/>'); }
        function iconeChevronEsquerda() { return svg('<path d="M15 18l-6-6 6-6"/>'); }
        function iconeChevronDireita() { return svg('<path d="M9 18l6-6-6-6"/>'); }
        function iconePlay() { return svg('<path d="M5 3l14 9-14 9V3z"/>'); }
        function iconePessoa() { return svg('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/>'); }
        function iconeLapis() { return svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'); }
        function iconeOlho() { return svg('<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/>'); }
        function iconeLink() { return svg('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>'); }
        function iconeLivro() { return svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'); }
        function iconePessoas() { return svg('<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>'); }
    });
})();
