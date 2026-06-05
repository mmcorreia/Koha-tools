/*  =============================================================================================================================== 
   RECOMENDAÇÕES POR ASSUNTO
   PT/EN automático conforme idioma ativo do OPAC
   Miguel Mimoso Correia CC-BY-NC-SA
   Regras:
   1. Usa sempre primeiro o campo 606.
   2. Se o 606 não existir, usa o campo 600.
   3. Lê MARC público sempre que possível.
   4. Usa subcampos $a/_a, $x/_x, $y/_y, $z/_z, $j/_j.
   5. Ignora $2/_2 e $9/_9.
   6. A ordem final das sugestões é aleatória.
    ===============================================================================================================================  */

$(document).ready(function () {

    if (!window.location.href.includes('/cgi-bin/koha/opac-detail.pl')) return;
    if ($('#rbmo-podera-gostar-assunto').length) return;

    function obterIdiomaOPAC() {
        var lang = (
            $('html').attr('lang') ||
            $('html').attr('xml:lang') ||
            ''
        ).toLowerCase();

        if (lang.indexOf('en') === 0) return 'en';
        return 'pt';
    }

    var IDIOMA = obterIdiomaOPAC();

    var TEXTOS = {
    pt: {
        titulo: 'Outras propostas de leitura',
        carregar: 'A carregar sugestões...',
        semCapa: 'Sem capa',
        semAssuntos: 'Não foi possível encontrar assuntos neste registo.',
        assuntoRelacionado: 'Assunto relacionado: ',
        semSugestoes: 'Não foram encontradas sugestões relacionadas.',
        erroCarregar: 'Não foi possível carregar sugestões neste momento.'
    },
    en: {
        titulo: 'Other reading suggestions',
        carregar: 'Loading suggestions...',
        semCapa: 'No cover',
        semAssuntos: 'No subjects could be found in this record.',
        assuntoRelacionado: 'Related subject: ',
        semSugestoes: 'No related suggestions were found.',
        erroCarregar: 'Suggestions could not be loaded at this time.'
    }
};

    var T = TEXTOS[IDIOMA] || TEXTOS.pt;

    var CONFIG = {
        maxCampos: 5,
        maxResultadosPorPesquisa: 12,
        maxSugestoes: 12,
        larguraCartao: 159,
        subcamposAssunto: ['a', 'x', 'y', 'z', 'j']
    };

    function limparTexto(txt) {
        return $.trim(txt || '').replace(/\s+/g, ' ');
    }

    function escapeHtml(str) {
        return String(str || '').replace(/[&<>"']/g, function (m) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            })[m];
        });
    }

    function shuffleArray(array) {
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    function obterBiblionumberAtual() {
        var match = window.location.href.match(/[?&]biblionumber=(\d+)/);
        return match ? match[1] : '';
    }

    function obterCapa(biblionumber) {
        return '/cgi-bin/koha/opac-image.pl?thumbnail=1&biblionumber=' + encodeURIComponent(biblionumber);
    }

    function criarBlocoBase() {
        return `
            <div id="rbmo-podera-gostar-assunto" style="margin:25px 0; padding:18px 0; border-top:1px solid #e5e5e5; border-bottom:1px solid #e5e5e5;">
                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px;">
                    <h3 style="margin:0; font-size:18px; font-weight:600;">${escapeHtml(T.titulo)}</h3>
                    <div>
                        <button type="button" id="rbmo-assunto-carousel-prev" class="btn btn-default btn-sm" style="margin-right:5px;">‹</button>
                        <button type="button" id="rbmo-assunto-carousel-next" class="btn btn-default btn-sm">›</button>
                    </div>
                </div>

                <div id="rbmo-assunto-termos" style="font-size:12px; color:#777; margin-bottom:10px;"></div>

                <div id="rbmo-assunto-carousel-wrapper" style="overflow:hidden; width:100%;">
                    <div id="rbmo-assunto-carousel-track" style="display:flex; gap:14px; transition:transform .25s ease;">
                        <div style="font-size:14px; color:#666;">${escapeHtml(T.carregar)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    function inserirBloco() {
        var destino = $(
            '#catalogue_detail_biblio, ' +
            '#bibliodescriptions, ' +
            '.bibliodescriptions, ' +
            '#isbdcontents, ' +
            '#views'
        ).first();

        if (destino.length) {
            destino.after(criarBlocoBase());
            return;
        }

        var antesExemplares = $('#holdings, #itemst, table#holdingst, #opac-detail-tabs').first();

        if (antesExemplares.length) {
            antesExemplares.before(criarBlocoBase());
        } else {
            $('h1').first().after(criarBlocoBase());
        }
    }

    function criarCartao(item) {
        return `
            <div class="rbmo-assunto-carousel-card" style="flex:0 0 145px; max-width:145px;">
                <a href="${escapeHtml(item.url)}" style="text-decoration:none; color:inherit;">
                    <div style="width:110px; height:155px; margin:0 auto 8px auto; display:flex; align-items:center; justify-content:center; background:#f3f3f3; border:1px solid #ddd;">
                        <img src="${escapeHtml(item.capa)}" alt="" style="max-width:100%; max-height:100%;" onerror="this.style.display='none'; this.parentNode.innerHTML='<span style=&quot;font-size:12px;color:#999;text-align:center;padding:8px;&quot;>${escapeHtml(T.semCapa)}</span>';">

                    </div>
                    <div style="font-size:13px; line-height:1.25; font-weight:600;">${escapeHtml(item.titulo)}</div>
                    ${item.autor ? `<div style="font-size:12px; color:#666; margin-top:3px; line-height:1.25;">${escapeHtml(item.autor)}</div>` : ''}
                </a>
            </div>
        `;
    }

    function normalizarListaTermos(lista) {
        var vistos = {};
        var resultado = [];

        lista.forEach(function (termo) {
            termo = limparTexto(termo)
                .replace(/\s*--\s*/g, ' ')
                .replace(/[.;,:]+$/g, '');

            if (!termo || termo.length < 3) return;

            var chave = termo.toLowerCase();

            if (vistos[chave]) return;

            vistos[chave] = true;
            resultado.push(termo);
        });

        return resultado.slice(0, CONFIG.maxCampos);
    }

    function obterSubcamposTematicos(linha) {
        var termos = [];
        var regex = /[$_]([a-z0-9])\s*([^$_]+)/gi;
        var match;

        while ((match = regex.exec(linha)) !== null) {
            var subcampo = String(match[1]).toLowerCase();
            var valor = limparTexto(match[2]);

            if (!valor) continue;
            if (!CONFIG.subcamposAssunto.includes(subcampo)) continue;

            termos.push(valor);
        }

        return termos;
    }

    function linhaEhCampo(linha, campo) {
        var t = limparTexto(linha);
        var re = new RegExp('^' + campo + '(\\s|\\$|_|#|\\t|$)');
        return re.test(t);
    }

    function labelDeveSerIgnorado(label) {
        label = limparTexto(label).toLowerCase();

        return (
            label.indexOf('sistema') !== -1 ||
            label.indexOf('source') !== -1 ||
            label.indexOf('fonte') !== -1 ||
            label.indexOf('authority') !== -1 ||
            label.indexOf('autoridade') !== -1 ||
            label.indexOf('record number') !== -1 ||
            label.indexOf('número de registo') !== -1 ||
            label.indexOf('thesaurus') !== -1 ||
            label.indexOf('tesauro') !== -1 ||
            label.indexOf('sipor') !== -1
        );
    }

    function extrairCampoDeHtml(html, campo) {
        var pagina = $('<div>').html(html);
        var assuntos = [];
        var campoAtivo = false;
        var termosGrupo = [];

        pagina.find('tr').each(function () {
            var tr = $(this);
            var textoLinha = limparTexto(tr.text());

            if (linhaEhCampo(textoLinha, campo)) {
                if (termosGrupo.length) {
                    assuntos.push(termosGrupo.join(' '));
                }

                campoAtivo = true;
                termosGrupo = [];

                var termosLinha = obterSubcamposTematicos(textoLinha);

                if (termosLinha.length) {
                    assuntos.push(termosLinha.join(' '));
                    campoAtivo = false;
                    termosGrupo = [];
                }

                return;
            }

            if (/^[0-9]{3}(\s|#|_|$)/.test(textoLinha) && !linhaEhCampo(textoLinha, campo)) {
                if (campoAtivo && termosGrupo.length) {
                    assuntos.push(termosGrupo.join(' '));
                }

                campoAtivo = false;
                termosGrupo = [];
                return;
            }

            if (!campoAtivo) return;

            var tds = tr.find('td');

            if (tds.length >= 2) {
                var label = limparTexto($(tds[0]).text());
                var valor = limparTexto($(tds[1]).text());

                if (valor && !labelDeveSerIgnorado(label)) {
                    termosGrupo.push(valor);
                }
            }
        });

        if (campoAtivo && termosGrupo.length) {
            assuntos.push(termosGrupo.join(' '));
        }

        return normalizarListaTermos(assuntos);
    }

    function extrairCampoDeTexto(html, campo) {
        var texto = $('<div>').html(html).text();
        var linhas = String(texto || '').split(/\n|\r/);
        var assuntos = [];

        linhas.forEach(function (linha) {
            var limpa = limparTexto(linha);

            if (!linhaEhCampo(limpa, campo)) return;

            var termos = obterSubcamposTematicos(limpa);

            if (termos.length) {
                assuntos.push(termos.join(' '));
            }
        });

        return normalizarListaTermos(assuntos);
    }

    function obterAssuntosVisiveisFallback() {
        var assuntos606 = [];
        var assuntos600 = [];

        $('.results_summary, tr').each(function () {
            var bloco = $(this);
            var label = limparTexto(
                bloco.find('.label, th, td:first-child').first().text()
            ).replace(/:$/, '').toLowerCase();

            bloco.find('a[href*="opac-search.pl"]').each(function () {
                var txt = limparTexto($(this).text());

                if (!txt || txt.length < 3) return;

                if (
                    label.indexOf('nome comum') !== -1 ||
                    label.indexOf('common name') !== -1 ||
                    label.indexOf('topical') !== -1 ||
                    label.indexOf('subject') !== -1
                ) {
                    assuntos606.push(txt);
                }

                if (
                    label.indexOf('nome pessoal') !== -1 ||
                    label.indexOf('personal name') !== -1 ||
                    label.indexOf('personal') !== -1
                ) {
                    assuntos600.push(txt);
                }
            });
        });

        assuntos606 = normalizarListaTermos(assuntos606);
        assuntos600 = normalizarListaTermos(assuntos600);

        if (assuntos606.length) {
            return {
                campo: '606',
                termos: assuntos606
            };
        }

        if (assuntos600.length) {
            return {
                campo: '600',
                termos: assuntos600
            };
        }

        return {
            campo: '',
            termos: []
        };
    }

    function obterUrlMarcPublico() {
        var biblionumber = obterBiblionumberAtual();

        if (!biblionumber) return '';

        return '/cgi-bin/koha/opac-MARCdetail.pl?biblionumber=' + encodeURIComponent(biblionumber);
    }

    function obterAssuntos() {
        var url = obterUrlMarcPublico();

        if (!url) {
            return $.Deferred().resolve(obterAssuntosVisiveisFallback()).promise();
        }

        return $.get(url)
            .then(function (html) {
                var termos606 = extrairCampoDeHtml(html, '606');

                if (!termos606.length) {
                    termos606 = extrairCampoDeTexto(html, '606');
                }

                if (termos606.length) {
                    return {
                        campo: '606',
                        termos: termos606
                    };
                }

                var termos600 = extrairCampoDeHtml(html, '600');

                if (!termos600.length) {
                    termos600 = extrairCampoDeTexto(html, '600');
                }

                if (termos600.length) {
                    return {
                        campo: '600',
                        termos: termos600
                    };
                }

                return obterAssuntosVisiveisFallback();
            })
            .catch(function () {
                return obterAssuntosVisiveisFallback();
            });
    }

    function criarUrlDetalhe(url) {
        if (!url) return '';

        if (url.indexOf('http') === 0) return url;
        if (url.indexOf('/cgi-bin/koha/') === 0) return url;
        if (url.indexOf('/opac-detail.pl') === 0) return '/cgi-bin/koha' + url;

        return '/cgi-bin/koha/' + url.replace(/^\/+/, '');
    }

    function extrairTituloDoBloco(bloco, link) {
        var titulo = limparTexto(link.text());

        if (titulo.length > 3) return titulo;

        titulo = limparTexto(
            bloco.find('.title, .biblio-title, h2, h3').first().text()
        );

        return titulo;
    }

    function extrairAutorDoBloco(bloco) {
        return limparTexto(
            bloco.find(
                '.author, ' +
                '.byAuthor, ' +
                '.results_summary.author, ' +
                'a[href*="idx=au"], ' +
                'a[href*="idx=Author"], ' +
                'a[href*="q=au"]'
            ).first().text()
        );
    }

    function extrairResultados(htmlPesquisa) {
        var pagina = $('<div>').html(htmlPesquisa);
        var atual = obterBiblionumberAtual();
        var resultados = [];
        var vistos = {};

        pagina.find('a[href*="opac-detail.pl?biblionumber="]').each(function () {
            var link = $(this);
            var url = link.attr('href') || '';
            var match = url.match(/biblionumber=(\d+)/);

            if (!match) return;

            var biblionumber = match[1];

            if (!biblionumber || biblionumber === atual) return;
            if (vistos[biblionumber]) return;

            var bloco = link.closest('li, tr, .searchresults, .result, .bibliocol, div');
            var titulo = extrairTituloDoBloco(bloco, link);

            if (!titulo || titulo.length < 3) return;

            vistos[biblionumber] = true;

            resultados.push({
                biblionumber: biblionumber,
                titulo: titulo,
                autor: extrairAutorDoBloco(bloco),
                url: criarUrlDetalhe(url),
                capa: obterCapa(biblionumber)
            });
        });

        return resultados;
    }

    function criarPesquisaPorAssunto(termo) {
        return '/cgi-bin/koha/opac-search.pl?idx=su&q=' +
            encodeURIComponent(termo) +
            '&count=' +
            encodeURIComponent(CONFIG.maxResultadosPorPesquisa);
    }

    function carregarSugestoes() {
        obterAssuntos().then(function (dados) {
            var termos = dados.termos || [];

            if (!termos.length) {
                $('#rbmo-assunto-carousel-track').html(
                    '<div style="font-size:14px; color:#666;">' + escapeHtml(T.semAssuntos) + '</div>'
                );
                return;
            }

            $('#rbmo-assunto-termos').html(
                escapeHtml(T.assuntoRelacionado) +
                termos.map(function (t) {
                    return '<strong>' + escapeHtml(t) + '</strong>';
                }).join('; ')
            );

            var pedidos = termos.map(function (termo) {
                return $.get(criarPesquisaPorAssunto(termo));
            });

            $.when.apply($, pedidos).done(function () {
                var resultados = [];

                if (pedidos.length === 1) {
                    resultados = resultados.concat(extrairResultados(arguments[0]));
                } else {
                    $.each(arguments, function (_, resposta) {
                        resultados = resultados.concat(extrairResultados(resposta[0]));
                    });
                }

                var vistos = {};

                resultados = resultados.filter(function (item) {
                    if (vistos[item.biblionumber]) return false;
                    vistos[item.biblionumber] = true;
                    return true;
                });

                resultados = shuffleArray(resultados).slice(0, CONFIG.maxSugestoes);

                if (!resultados.length) {
                    $('#rbmo-assunto-carousel-track').html(
                        '<div style="font-size:14px; color:#666;">' + escapeHtml(T.semSugestoes) + '</div>'
                    );
                    return;
                }

                var html = '';

                $.each(resultados, function (_, item) {
                    html += criarCartao(item);
                });

                $('#rbmo-assunto-carousel-track').html(html);
                ativarCarrossel();

            }).fail(function () {
                $('#rbmo-assunto-carousel-track').html(
                    '<div style="font-size:14px; color:#666;">' + escapeHtml(T.erroCarregar) + '</div>'
                );
            });
        });
    }

    function ativarCarrossel() {
        var posicao = 0;
        var cardWidth = CONFIG.larguraCartao;

        function atualizar() {
            $('#rbmo-assunto-carousel-track').css(
                'transform',
                'translateX(' + (-posicao * cardWidth) + 'px)'
            );
        }

        $('#rbmo-assunto-carousel-next').off('click').on('click', function () {
            var total = $('.rbmo-assunto-carousel-card').length;
            var visiveis = Math.floor($('#rbmo-assunto-carousel-wrapper').width() / cardWidth);
            var max = Math.max(0, total - visiveis);

            if (posicao < max) {
                posicao++;
                atualizar();
            }
        });

        $('#rbmo-assunto-carousel-prev').off('click').on('click', function () {
            if (posicao > 0) {
                posicao--;
                atualizar();
            }
        });
    }

    inserirBloco();
    carregarSugestoes();

});
