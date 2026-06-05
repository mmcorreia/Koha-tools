/*  =============================================================================================================================== 
   RECOMENDAÇÕES POR ASSUNTO
   PT/EN automático conforme idioma ativo do OPAC
   Miguel Mimoso Correia CC-BY-NC-SA

   Versão otimizada:
   1. Mais rápida, reduz número de pesquisas ao OPAC.
   2. Evita depender de lista fixa de termos genéricos.
   3. Usa 606 antes de 600.
   4. Usa $a e $x como motores principais.
   5. Usa $y, $z e $j apenas combinados com $a ou $x.
   6. Aplica rotação por offset para não mostrar sempre os mesmos primeiros resultados.
   7. Agrega resultados repetidos e aplica diversidade por autor e título.
   8. Não mostra ao leitor os assuntos usados internamente.
   ===============================================================================================================================  */

$(document).ready(function () {

    if (!window.location.href.includes('/cgi-bin/koha/opac-detail.pl')) return;

    $('#rbmo-assunto-termos').remove();

    $('#rbmo-podera-gostar-assunto')
        .find('div')
        .filter(function () {
            var texto = $(this).text().trim().toLowerCase();
            return texto.indexOf('assunto relacionado:') === 0 ||
                   texto.indexOf('related subject:') === 0;
        })
        .remove();

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
            semAssuntos: 'Não foi possível encontrar propostas de leitura relacionadas.',
            semSugestoes: 'Não foram encontradas sugestões relacionadas.',
            erroCarregar: 'Não foi possível carregar sugestões neste momento.'
        },
        en: {
            titulo: 'Other reading suggestions',
            carregar: 'Loading suggestions...',
            semCapa: 'No cover',
            semAssuntos: 'No related reading suggestions could be found.',
            semSugestoes: 'No related suggestions were found.',
            erroCarregar: 'Suggestions could not be loaded at this time.'
        }
    };

    var T = TEXTOS[IDIOMA] || TEXTOS.pt;

    var CONFIG = {
        maxCamposMARC: 5,
        maxSementesPesquisa: 4,
        maxResultadosPorPesquisa: 18,
        maxSugestoes: 12,
        larguraCartao: 159,

        subcamposPrincipais: ['a', 'x'],
        subcamposRefinamento: ['y', 'z', 'j'],
        subcamposIgnorados: ['2', '9'],

        pesosSubcampo: {
            a: 7,
            x: 5,
            y: 1.5,
            z: 1.5,
            j: 1
        },

        pesoCombinacao: 2,
        bonusOcorrenciaMultipla: 3,
        maxBonusOcorrencias: 9,

        maxPorAutor: 2,
        maxPorTituloNormalizado: 1,

        offsetsRotativos: [0, 18, 36, 54],
        aleatoriedadeControlada: 0.35,

        timeoutPesquisaMs: 6500,
        debug: false
    };

    function logDebug() {
        if (!CONFIG.debug || !window.console) return;
        console.log.apply(console, arguments);
    }

    function limparTexto(txt) {
        return $.trim(txt || '').replace(/\s+/g, ' ');
    }

    function normalizarChave(txt) {
        return limparTexto(txt)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[.;,:]+$/g, '')
            .replace(/\s+/g, ' ');
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

    function calcularPesoSubcampo(subcampo) {
        subcampo = String(subcampo || '').toLowerCase();
        return CONFIG.pesosSubcampo[subcampo] || 1;
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

    function inferirSubcampoPorLabel(label) {
        label = limparTexto(label).toLowerCase();

        var match = label.match(/[$_]([a-z0-9])/i);
        if (match) return match[1].toLowerCase();

        if (label.indexOf('subdivisão de assunto') !== -1 ||
            label.indexOf('subject subdivision') !== -1 ||
            label.indexOf('subdivision') !== -1) {
            return 'x';
        }

        if (label.indexOf('geográfica') !== -1 ||
            label.indexOf('geographic') !== -1) {
            return 'z';
        }

        if (label.indexOf('cronológica') !== -1 ||
            label.indexOf('chronological') !== -1) {
            return 'y';
        }

        if (label.indexOf('forma') !== -1 ||
            label.indexOf('form') !== -1) {
            return 'j';
        }

        if (label.indexOf('assunto') !== -1 ||
            label.indexOf('subject') !== -1 ||
            label.indexOf('nome comum') !== -1 ||
            label.indexOf('topical') !== -1) {
            return 'a';
        }

        return 'a';
    }

    function criarGrupoCampo(campo) {
        return {
            campo: campo,
            subcampos: [],
            principais: [],
            refinamentos: []
        };
    }

    function adicionarSubcampoAoGrupo(grupo, subcampo, valor) {
        subcampo = String(subcampo || '').toLowerCase();
        valor = limparTexto(valor)
            .replace(/\s*--\s*/g, ' ')
            .replace(/[.;,:]+$/g, '');

        if (!valor || valor.length < 3) return;
        if (CONFIG.subcamposIgnorados.indexOf(subcampo) !== -1) return;

        var item = {
            termo: valor,
            subcampo: subcampo,
            campo: grupo.campo,
            peso: calcularPesoSubcampo(subcampo)
        };

        grupo.subcampos.push(item);

        if (CONFIG.subcamposPrincipais.indexOf(subcampo) !== -1) {
            grupo.principais.push(item);
        } else if (CONFIG.subcamposRefinamento.indexOf(subcampo) !== -1) {
            grupo.refinamentos.push(item);
        }
    }

    function extrairSubcamposDeLinha(linha, campo) {
        var grupo = criarGrupoCampo(campo);
        var regex = /[$_]([a-z0-9])\s*([^$_]+)/gi;
        var match;

        while ((match = regex.exec(linha)) !== null) {
            adicionarSubcampoAoGrupo(grupo, match[1], match[2]);
        }

        return grupo.subcampos.length ? grupo : null;
    }

    function normalizarGrupos(grupos) {
        var gruposLimpos = [];

        grupos.forEach(function (grupo) {
            var vistos = {};
            var novo = criarGrupoCampo(grupo.campo);

            grupo.subcampos.forEach(function (item) {
                var chave = item.subcampo + '|' + normalizarChave(item.termo);

                if (vistos[chave]) return;
                vistos[chave] = true;

                adicionarSubcampoAoGrupo(novo, item.subcampo, item.termo);
            });

            if (novo.subcampos.length) {
                gruposLimpos.push(novo);
            }
        });

        return gruposLimpos.slice(0, CONFIG.maxCamposMARC);
    }

    function extrairGruposCampoDeHtml(html, campo) {
        var pagina = $('<div>').html(html);
        var grupos = [];
        var grupoAtivo = null;

        pagina.find('tr').each(function () {
            var tr = $(this);
            var textoLinha = limparTexto(tr.text());

            if (linhaEhCampo(textoLinha, campo)) {
                if (grupoAtivo && grupoAtivo.subcampos.length) {
                    grupos.push(grupoAtivo);
                }

                grupoAtivo = criarGrupoCampo(campo);

                var grupoLinha = extrairSubcamposDeLinha(textoLinha, campo);

                if (grupoLinha && grupoLinha.subcampos.length) {
                    grupos.push(grupoLinha);
                    grupoAtivo = null;
                }

                return;
            }

            if (/^[0-9]{3}(\s|#|_|$)/.test(textoLinha) && !linhaEhCampo(textoLinha, campo)) {
                if (grupoAtivo && grupoAtivo.subcampos.length) {
                    grupos.push(grupoAtivo);
                }

                grupoAtivo = null;
                return;
            }

            if (!grupoAtivo) return;

            var tds = tr.find('td');

            if (tds.length >= 2) {
                var label = limparTexto($(tds[0]).text());
                var valor = limparTexto($(tds[1]).text());

                if (valor && !labelDeveSerIgnorado(label)) {
                    adicionarSubcampoAoGrupo(
                        grupoAtivo,
                        inferirSubcampoPorLabel(label),
                        valor
                    );
                }
            }
        });

        if (grupoAtivo && grupoAtivo.subcampos.length) {
            grupos.push(grupoAtivo);
        }

        return normalizarGrupos(grupos);
    }

    function extrairGruposCampoDeTexto(html, campo) {
        var texto = $('<div>').html(html).text();
        var linhas = String(texto || '').split(/\n|\r/);
        var grupos = [];

        linhas.forEach(function (linha) {
            var limpa = limparTexto(linha);

            if (!linhaEhCampo(limpa, campo)) return;

            var grupoLinha = extrairSubcamposDeLinha(limpa, campo);

            if (grupoLinha && grupoLinha.subcampos.length) {
                grupos.push(grupoLinha);
            }
        });

        return normalizarGrupos(grupos);
    }

    function obterAssuntosVisiveisFallback() {
        var grupos606 = [];
        var grupos600 = [];

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
                    var grupo606 = criarGrupoCampo('606');
                    adicionarSubcampoAoGrupo(grupo606, 'a', txt);
                    grupos606.push(grupo606);
                }

                if (
                    label.indexOf('nome pessoal') !== -1 ||
                    label.indexOf('personal name') !== -1 ||
                    label.indexOf('personal') !== -1
                ) {
                    var grupo600 = criarGrupoCampo('600');
                    adicionarSubcampoAoGrupo(grupo600, 'a', txt);
                    grupos600.push(grupo600);
                }
            });
        });

        grupos606 = normalizarGrupos(grupos606);
        grupos600 = normalizarGrupos(grupos600);

        if (grupos606.length) {
            return {
                campo: '606',
                grupos: grupos606
            };
        }

        if (grupos600.length) {
            return {
                campo: '600',
                grupos: grupos600
            };
        }

        return {
            campo: '',
            grupos: []
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

        return $.get({
            url: url,
            timeout: CONFIG.timeoutPesquisaMs
        })
        .then(function (html) {
            var grupos606 = extrairGruposCampoDeHtml(html, '606');

            if (!grupos606.length) {
                grupos606 = extrairGruposCampoDeTexto(html, '606');
            }

            if (grupos606.length) {
                return {
                    campo: '606',
                    grupos: grupos606
                };
            }

            var grupos600 = extrairGruposCampoDeHtml(html, '600');

            if (!grupos600.length) {
                grupos600 = extrairGruposCampoDeTexto(html, '600');
            }

            if (grupos600.length) {
                return {
                    campo: '600',
                    grupos: grupos600
                };
            }

            return obterAssuntosVisiveisFallback();
        })
        .catch(function () {
            return obterAssuntosVisiveisFallback();
        });
    }

    function criarSemente(termo, peso, origem, tipo) {
        termo = limparTexto(termo)
            .replace(/\s*--\s*/g, ' ')
            .replace(/[.;,:]+$/g, '');

        if (!termo || termo.length < 3) return null;

        return {
            termo: termo,
            peso: peso || 1,
            origem: origem || '',
            tipo: tipo || 'simples'
        };
    }

    function construirSementesDePesquisa(grupos) {
        var sementes = [];
        var vistos = {};

        grupos.forEach(function (grupo) {
            var principais = grupo.principais || [];
            var refinamentos = grupo.refinamentos || [];

            principais.forEach(function (principal) {
                sementes.push(criarSemente(
                    principal.termo,
                    principal.peso,
                    grupo.campo + '$' + principal.subcampo,
                    'principal'
                ));
            });

            principais.slice(0, 2).forEach(function (principal) {
                refinamentos.slice(0, 2).forEach(function (ref) {
                    sementes.push(criarSemente(
                        principal.termo + ' ' + ref.termo,
                        principal.peso + ref.peso + CONFIG.pesoCombinacao,
                        grupo.campo + '$' + principal.subcampo + '+$' + ref.subcampo,
                        'combinada'
                    ));
                });
            });

            if (principais.length >= 2) {
                sementes.push(criarSemente(
                    principais[0].termo + ' ' + principais[1].termo,
                    principais[0].peso + principais[1].peso + CONFIG.pesoCombinacao,
                    grupo.campo + '$' + principais[0].subcampo + '+$' + principais[1].subcampo,
                    'combinada-principal'
                ));
            }

            if (!principais.length && refinamentos.length) {
                sementes.push(criarSemente(
                    refinamentos[0].termo,
                    Math.max(0.5, refinamentos[0].peso * 0.5),
                    grupo.campo + '$' + refinamentos[0].subcampo,
                    'fallback-refinamento'
                ));
            }
        });

        sementes = sementes.filter(function (s) {
            return s && s.termo && s.termo.length >= 3;
        });

        sementes.forEach(function (s) {
            var chave = normalizarChave(s.termo);

            if (!vistos[chave]) {
                vistos[chave] = s;
            } else {
                vistos[chave].peso += Math.max(1, s.peso * 0.5);
                vistos[chave].origem += '|' + s.origem;
            }
        });

        sementes = Object.keys(vistos).map(function (k) {
            return vistos[k];
        });

        sementes.sort(function (a, b) {
            return b.peso - a.peso;
        });

        return sementes.slice(0, CONFIG.maxSementesPesquisa);
    }

    function obterOffsetRotativo(semente, indice) {
        var biblionumber = obterBiblionumberAtual();
        var chave = 'rbmo_sug_offset_' + biblionumber + '_' + normalizarChave(semente.termo);
        var atual = parseInt(sessionStorage.getItem(chave) || '-1', 10);

        if (isNaN(atual)) atual = -1;

        var proximo = (atual + 1 + indice) % CONFIG.offsetsRotativos.length;

        sessionStorage.setItem(chave, String(proximo));

        return CONFIG.offsetsRotativos[proximo];
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

    function criarPesquisaPorSemente(semente, indice) {
        var offset = obterOffsetRotativo(semente, indice);

        return '/cgi-bin/koha/opac-search.pl?idx=su&q=' +
            encodeURIComponent(semente.termo) +
            '&count=' +
            encodeURIComponent(CONFIG.maxResultadosPorPesquisa) +
            '&offset=' +
            encodeURIComponent(offset);
    }

    function extrairResultados(htmlPesquisa, semente) {
        var pagina = $('<div>').html(htmlPesquisa);
        var atual = obterBiblionumberAtual();
        var resultados = [];
        var vistosLocal = {};
        var posicao = 0;

        pagina.find('a[href*="opac-detail.pl?biblionumber="]').each(function () {
            var link = $(this);
            var url = link.attr('href') || '';
            var match = url.match(/biblionumber=(\d+)/);

            if (!match) return;

            var biblionumber = match[1];

            if (!biblionumber || biblionumber === atual) return;
            if (vistosLocal[biblionumber]) return;

            var bloco = link.closest('li, tr, .searchresults, .result, .bibliocol, div');
            var titulo = extrairTituloDoBloco(bloco, link);

            if (!titulo || titulo.length < 3) return;

            posicao++;
            vistosLocal[biblionumber] = true;

            var pontosPorPosicao = Math.max(
                0,
                (CONFIG.maxResultadosPorPesquisa - posicao) / 8
            );

            resultados.push({
                biblionumber: biblionumber,
                titulo: titulo,
                autor: extrairAutorDoBloco(bloco),
                url: criarUrlDetalhe(url),
                capa: obterCapa(biblionumber),
                pontos: (semente.peso || 1) + pontosPorPosicao,
                ocorrencias: 1,
                termosOrigem: [semente.termo],
                tiposOrigem: [semente.tipo],
                melhorPosicao: posicao
            });
        });

        return resultados;
    }

    function agregarResultados(listaResultados) {
        var mapa = {};

        listaResultados.forEach(function (item) {
            if (!mapa[item.biblionumber]) {
                mapa[item.biblionumber] = item;
                return;
            }

            mapa[item.biblionumber].pontos += item.pontos + CONFIG.bonusOcorrenciaMultipla;
            mapa[item.biblionumber].ocorrencias += 1;
            mapa[item.biblionumber].melhorPosicao = Math.min(
                mapa[item.biblionumber].melhorPosicao,
                item.melhorPosicao
            );

            item.termosOrigem.forEach(function (termo) {
                if (mapa[item.biblionumber].termosOrigem.indexOf(termo) === -1) {
                    mapa[item.biblionumber].termosOrigem.push(termo);
                }
            });

            item.tiposOrigem.forEach(function (tipo) {
                if (mapa[item.biblionumber].tiposOrigem.indexOf(tipo) === -1) {
                    mapa[item.biblionumber].tiposOrigem.push(tipo);
                }
            });
        });

        return Object.keys(mapa).map(function (k) {
            var item = mapa[k];

            item.pontos += Math.min(
                CONFIG.maxBonusOcorrencias,
                item.ocorrencias * CONFIG.bonusOcorrenciaMultipla
            );

            if (item.tiposOrigem.indexOf('combinada') !== -1 ||
                item.tiposOrigem.indexOf('combinada-principal') !== -1) {
                item.pontos += 2;
            }

            item.pontos += Math.random() * CONFIG.aleatoriedadeControlada;

            return item;
        });
    }

    function selecionarComDiversidade(resultados) {
        var selecionados = [];
        var contagemAutor = {};
        var contagemTitulo = {};

        resultados.sort(function (a, b) {
            if (b.pontos !== a.pontos) return b.pontos - a.pontos;
            return a.melhorPosicao - b.melhorPosicao;
        });

        resultados.forEach(function (item) {
            if (selecionados.length >= CONFIG.maxSugestoes) return;

            var chaveAutor = normalizarChave(item.autor || '');
            var chaveTitulo = normalizarChave(item.titulo || '');

            if (chaveTitulo) {
                contagemTitulo[chaveTitulo] = contagemTitulo[chaveTitulo] || 0;

                if (contagemTitulo[chaveTitulo] >= CONFIG.maxPorTituloNormalizado) {
                    return;
                }
            }

            if (chaveAutor) {
                contagemAutor[chaveAutor] = contagemAutor[chaveAutor] || 0;

                if (contagemAutor[chaveAutor] >= CONFIG.maxPorAutor) {
                    return;
                }
            }

            if (chaveTitulo) contagemTitulo[chaveTitulo]++;
            if (chaveAutor) contagemAutor[chaveAutor]++;

            selecionados.push(item);
        });

        if (selecionados.length < CONFIG.maxSugestoes) {
            resultados.forEach(function (item) {
                if (selecionados.length >= CONFIG.maxSugestoes) return;

                var jaExiste = selecionados.some(function (s) {
                    return s.biblionumber === item.biblionumber;
                });

                if (!jaExiste) {
                    selecionados.push(item);
                }
            });
        }

        return selecionados;
    }

    function carregarSugestoes() {
        obterAssuntos().then(function (dados) {
            var grupos = dados.grupos || [];
            var sementes = construirSementesDePesquisa(grupos);

            logDebug('Grupos MARC usados:', grupos);
            logDebug('Sementes de pesquisa:', sementes);

            if (!sementes.length) {
                $('#rbmo-assunto-carousel-track').html(
                    '<div style="font-size:14px; color:#666;">' + escapeHtml(T.semAssuntos) + '</div>'
                );
                return;
            }

            var pedidos = sementes.map(function (semente, indice) {
                return $.get({
                    url: criarPesquisaPorSemente(semente, indice),
                    timeout: CONFIG.timeoutPesquisaMs
                });
            });

            $.when.apply($, pedidos).done(function () {
                var todosResultados = [];

                if (pedidos.length === 1) {
                    todosResultados = todosResultados.concat(
                        extrairResultados(arguments[0], sementes[0])
                    );
                } else {
                    $.each(arguments, function (i, resposta) {
                        todosResultados = todosResultados.concat(
                            extrairResultados(resposta[0], sementes[i])
                        );
                    });
                }

                var resultadosAgregados = agregarResultados(todosResultados);
                var resultadosSelecionados = selecionarComDiversidade(resultadosAgregados);

                logDebug('Resultados agregados:', resultadosAgregados);
                logDebug('Resultados selecionados:', resultadosSelecionados);

                if (!resultadosSelecionados.length) {
                    $('#rbmo-assunto-carousel-track').html(
                        '<div style="font-size:14px; color:#666;">' + escapeHtml(T.semSugestoes) + '</div>'
                    );
                    return;
                }

                var html = '';

                $.each(resultadosSelecionados, function (_, item) {
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


/*  ===============================================================================================================================
    PROTEÇÃO FINAL
    Remove "Assunto relacionado" caso seja recriado por cache, duplicação de código ou outro script ativo no OPAC.
    =============================================================================================================================== */

(function () {

    function removerAssuntoRelacionado() {
        $('#rbmo-assunto-termos').remove();

        $('#rbmo-podera-gostar-assunto')
            .find('div')
            .filter(function () {
                var texto = $(this).text().trim().toLowerCase();
                return texto.indexOf('assunto relacionado:') === 0 ||
                       texto.indexOf('related subject:') === 0;
            })
            .remove();
    }

    $(document).ready(function () {
        removerAssuntoRelacionado();

        setTimeout(removerAssuntoRelacionado, 300);
        setTimeout(removerAssuntoRelacionado, 1000);
        setTimeout(removerAssuntoRelacionado, 2000);

        if (!document.body) return;

        var observer = new MutationObserver(function () {
            removerAssuntoRelacionado();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });

})();
