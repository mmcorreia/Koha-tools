/* ==========================================================
   Authority BOX / OPAC
   Miguel Mimoso Correia CC-BY-NC-SA
   Infobox de autores com Wikidata e Wikipédia.
   ========================================================== */

(function () {
  'use strict';

  const CONFIG = {
    version: '1.2',
    maxAutoridades: 12,
    titulo: 'Autor(es)',
    notaFinal: 'Fontes: Wikidata e Wikipédia. Informação de origem externa.',
    mensagemSemQID: 'Ligação indisponível',
    mostrarAutoresSemQID: true,
    cacheMinutos: 15,
    requestTimeoutMs: 8000,
    langs: ['pt', 'pt-br', 'en', 'fr', 'es'],

    // Quando existir pelo menos um campo "autor", este bloco fica sempre aberto e visível.
    etiquetaAutorPrincipal: 'Autor principal',
    etiquetaOutrasResponsabilidades: 'Co-autorias e outras responsabilidades',
    etiquetaSemDesignacao: 'Outras responsabilidades',

    camposValidos: [
      'autor',
      'co-autor',
      'autor secundário'
    ],

    camposExcluidos: [
      'nome pessoal',
      'nome comum',
      'assunto',
      'assuntos',
      'nome geográfico',
      'assunto geográfico',
      'coleção',
      'título',
      'título original'
    ],

    papeis: [
      'Autor',
      'Co-autor',
      'Tradutor',
      'Editor literário',
      'Introdução',
      'Ilustrador',
      'Prefácio',
      'Seleção',
      'Organizador',
      'Coordenador',
      'Compilador',
      'Comentador',
      'Anotador',
      'Adaptador'
    ],

    // Ordem pedida: VIAF, ISNI, LoC, BnF, GND, Wikidata.
    externalIds: [
      { prop: 'P214', label: 'VIAF', url: 'https://viaf.org/viaf/$1', host: 'viaf.org' },
      { prop: 'P213', label: 'ISNI', url: 'https://isni.org/isni/$1', host: 'isni.org' },
      { prop: 'P244', label: 'LoC', url: 'https://id.loc.gov/authorities/names/$1', host: 'id.loc.gov' },
      { prop: 'P268', label: 'BnF', url: 'https://catalogue.bnf.fr/ark:/12148/cb$1', host: 'catalogue.bnf.fr' },
      { prop: 'P227', label: 'GND', url: 'https://d-nb.info/gnd/$1', host: 'd-nb.info' }
    ],

    allowedUrlHosts: [
      'www.wikidata.org',
      'www.wikidata.org',
      'wikidata.org',
      'pt.wikipedia.org',
      'en.wikipedia.org',
      'fr.wikipedia.org',
      'es.wikipedia.org',
      'commons.wikimedia.org',
      'viaf.org',
      'isni.org',
      'id.loc.gov',
      'catalogue.bnf.fr',
      'd-nb.info'
    ]
  };

  const cacheQID = new Map();
  const cacheWikidata = new Map();
  const cacheLabels = new Map();
  const cacheWikipedia = new Map();

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(initAuthorityBox, 900);
  });

  async function initAuthorityBox() {
    if (!location.href.includes('opac-detail.pl')) return;

    const autores = recolherAutores()
      .slice(0, CONFIG.maxAutoridades);

    if (!autores.length) return;

    const content = criarCaixa();
    if (!content) return;

    const autoresPreparados = await prepararAutores(autores);

    if (!autoresPreparados.length) {
      content.appendChild(criarMensagemVazia(CONFIG.mensagemSemQID));
      atualizarContador();
      return;
    }

    renderizarAutoresAgrupados(content, autoresPreparados);
    atualizarContador();
  }

  async function prepararAutores(autores) {
    const qidsMostrados = new Set();
    const resultado = [];

    for (const autor of autores) {
      const qid = await obterQID(autor.authid);

      if (qid && qidsMostrados.has(qid)) continue;
      if (qid) qidsMostrados.add(qid);

      const entidade = qid ? await obterEntidade(qid) : null;

      if (!entidade && !CONFIG.mostrarAutoresSemQID) continue;

      resultado.push({
        autor: autor,
        qid: entidade ? qid : null,
        entidade: entidade || null
      });
    }

    return resultado;
  }

  function renderizarAutoresAgrupados(content, autoresPreparados) {
    content.textContent = '';

    const principais = autoresPreparados.filter(function (item) {
      return item.autor.labelLinha === 'autor' ||
        (item.autor.papeis || []).some(function (p) {
          return normalizarTexto(p) === 'autor';
        });
    });

    const outros = autoresPreparados.filter(function (item) {
      return !principais.includes(item);
    });

    const autoresPrincipais = principais.length ? principais : autoresPreparados.slice(0, 1);
    const restantes = principais.length ? outros : autoresPreparados.slice(1);

    const principalSection = document.createElement('section');
    principalSection.className = 'authoritybox-rbmo-section authoritybox-rbmo-section-main';

    const principalTitle = document.createElement('div');
    principalTitle.className = 'authoritybox-rbmo-section-title';
    principalTitle.textContent = CONFIG.etiquetaAutorPrincipal;
    principalSection.appendChild(principalTitle);

    autoresPrincipais.forEach(function (item, index) {
      principalSection.appendChild(criarCartao(item, index === 0));
    });

    content.appendChild(principalSection);

    if (restantes.length) {
      const grupos = agruparPorDesignacao(restantes);

      const wrapper = document.createElement('section');
      wrapper.className = 'authoritybox-rbmo-section authoritybox-rbmo-section-secondary';

      const detailsGeral = document.createElement('details');
      detailsGeral.className = 'authoritybox-rbmo-accordion authoritybox-rbmo-accordion-master';

      const summaryGeral = document.createElement('summary');
      summaryGeral.className = 'authoritybox-rbmo-accordion-summary';
      summaryGeral.appendChild(criarSummaryTexto(CONFIG.etiquetaOutrasResponsabilidades, restantes.length));
      detailsGeral.appendChild(summaryGeral);

      const inner = document.createElement('div');
      inner.className = 'authoritybox-rbmo-accordion-body';

      grupos.forEach(function (grupo) {
        const details = document.createElement('details');
        details.className = 'authoritybox-rbmo-accordion authoritybox-rbmo-accordion-role';

        const summary = document.createElement('summary');
        summary.className = 'authoritybox-rbmo-accordion-summary';
        summary.appendChild(criarSummaryTexto(grupo.designacao, grupo.items.length));
        details.appendChild(summary);

        const body = document.createElement('div');
        body.className = 'authoritybox-rbmo-accordion-body';

        grupo.items.forEach(function (item) {
          body.appendChild(criarCartao(item, false));
        });

        details.appendChild(body);
        inner.appendChild(details);
      });

      detailsGeral.appendChild(inner);
      wrapper.appendChild(detailsGeral);
      content.appendChild(wrapper);
    }
  }

  function criarSummaryTexto(label, count) {
    const span = document.createElement('span');
    span.className = 'authoritybox-rbmo-summary-text';

    const title = document.createElement('span');
    title.className = 'authoritybox-rbmo-summary-title';
    title.textContent = label;

    const badge = document.createElement('span');
    badge.className = 'authoritybox-rbmo-summary-count';
    badge.textContent = String(count);

    span.appendChild(title);
    span.appendChild(badge);
    return span;
  }

  function agruparPorDesignacao(items) {
    const mapa = new Map();

    items.forEach(function (item) {
      const designacoes = obterDesignacoes(item.autor);
      const chave = designacoes[0] || CONFIG.etiquetaSemDesignacao;

      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(item);
    });

    return Array.from(mapa.entries()).map(function (entry) {
      return {
        designacao: entry[0],
        items: entry[1]
      };
    });
  }

  function criarCartao(item, principal) {
    const autor = item.autor;
    const entidade = item.entidade;
    const qid = item.qid;

    if (!entidade || !qid) {
      return criarCartaoSemWikidata(autor, principal);
    }

    const article = document.createElement('article');
    article.className = 'authoritybox-rbmo-card ' +
      (principal ? 'authoritybox-rbmo-card-main' : 'authoritybox-rbmo-card-compact');

    const top = document.createElement('div');
    top.className = 'authoritybox-rbmo-top';

    const label = obterTextoMultilingue(entidade.labels) || autor.nome || qid;
    const imagem = obterValorClaim(entidade, 'P18');

    top.appendChild(criarImagemOuIniciais(imagem, label));

    const heading = document.createElement('div');
    heading.className = 'authoritybox-rbmo-heading';

    const name = document.createElement('div');
    name.className = 'authoritybox-rbmo-name';
    name.textContent = label;
    heading.appendChild(name);

    heading.appendChild(renderDesignacoes(autor));

    const descricao = obterDescricaoPT(entidade);
    if (descricao) {
      const desc = document.createElement('div');
      desc.className = 'authoritybox-rbmo-desc';
      desc.textContent = descricao;
      heading.appendChild(desc);
    }

    top.appendChild(heading);
    article.appendChild(top);

    const facts = criarFactos(entidade);
    if (facts) article.appendChild(facts);

    const placeholderWikipedia = document.createElement('div');
    placeholderWikipedia.className = 'authoritybox-rbmo-wikipedia-placeholder';
    article.appendChild(placeholderWikipedia);

    preencherResumoWikipediaAsync(entidade, label, placeholderWikipedia);

    const links = criarLinksExternos(entidade, qid);
    if (links) article.appendChild(links);

    return article;
  }

  function criarCartaoSemWikidata(autor, principal) {
    const article = document.createElement('article');
    article.className = 'authoritybox-rbmo-card authoritybox-rbmo-card-missing ' +
      (principal ? 'authoritybox-rbmo-card-main' : 'authoritybox-rbmo-card-compact');

    const top = document.createElement('div');
    top.className = 'authoritybox-rbmo-top';

    top.appendChild(criarImagemOuIniciais(null, autor.nome));

    const heading = document.createElement('div');
    heading.className = 'authoritybox-rbmo-heading';

    const name = document.createElement('div');
    name.className = 'authoritybox-rbmo-name';
    name.textContent = autor.nome;
    heading.appendChild(name);

    heading.appendChild(renderDesignacoes(autor));

    const empty = document.createElement('div');
    empty.className = 'authoritybox-rbmo-empty';
    empty.textContent = CONFIG.mensagemSemQID;
    heading.appendChild(empty);

    top.appendChild(heading);
    article.appendChild(top);

    return article;
  }

  function criarImagemOuIniciais(imagem, label) {
    const photo = document.createElement('div');
    photo.className = 'authoritybox-rbmo-photo';

    const imageUrl = imagem ? imagemCommons(imagem) : '';

    if (imageUrl) {
      const img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      img.src = imageUrl;
      photo.appendChild(img);
    } else {
      photo.classList.add('authoritybox-rbmo-photo-empty');
      const span = document.createElement('span');
      span.textContent = iniciais(label);
      photo.appendChild(span);
    }

    return photo;
  }

  function criarFactos(entidade) {
    const dl = document.createElement('dl');
    dl.className = 'authoritybox-rbmo-facts';

    const nascimento = obterDataClaim(entidade, 'P569');
    const morte = obterDataClaim(entidade, 'P570');

    const paisIds = obterEntityIdsClaim(entidade, 'P27').slice(0, 3);
    const localNascimentoId = obterEntityIdClaim(entidade, 'P19');
    const localMorteId = obterEntityIdClaim(entidade, 'P20');
    const premiosIds = obterEntityIdsClaim(entidade, 'P166').slice(0, 4);

    const linhasPendentes = [];

    linhasPendentes.push({
      prop: 'pais',
      label: 'País',
      ids: paisIds
    });

    linhasPendentes.push({
      prop: 'nascimento',
      label: 'Nascimento',
      data: nascimento,
      ids: localNascimentoId ? [localNascimentoId] : []
    });

    linhasPendentes.push({
      prop: 'morte',
      label: 'Morte',
      data: morte,
      ids: localMorteId ? [localMorteId] : []
    });

    linhasPendentes.push({
      prop: 'premios',
      label: 'Prémios',
      ids: premiosIds
    });

    const ids = []
      .concat(paisIds, localNascimentoId || [], localMorteId || [], premiosIds)
      .filter(Boolean);

    if (!nascimento && !morte && !ids.length) return null;

    obterLabels(ids).then(function (labels) {
      linhasPendentes.forEach(function (linha) {
        let valores = [];

        if (linha.data) valores.push(linha.data);

        if (linha.ids && linha.ids.length) {
          const labelsLinha = linha.ids.map(function (id) {
            return labels[id];
          }).filter(Boolean);

          valores = valores.concat(labelsLinha);
        }

        if (!valores.length) return;

        if ((linha.prop === 'nascimento' || linha.prop === 'morte') && linha.data && valores.length > 1) {
          valores = [linha.data + ', ' + valores.slice(1).join('; ')];
        }

        dl.appendChild(criarLinhaFacto(linha.label, valores.join('; ')));
      });
    }).catch(function () {});

    return dl;
  }

  function criarLinhaFacto(label, valor) {
    const row = document.createElement('div');

    const dt = document.createElement('dt');
    dt.textContent = label;

    const dd = document.createElement('dd');
    dd.textContent = valor;

    row.appendChild(dt);
    row.appendChild(dd);
    return row;
  }

  async function preencherResumoWikipediaAsync(entidade, label, container) {
    const wikipediaInfo = obterWikipediaInfo(entidade, label);
    const resumoWikipedia = wikipediaInfo ? await obterResumoWikipedia(wikipediaInfo) : null;

    if (!container || !container.isConnected) return;

    if (resumoWikipedia && resumoWikipedia.extract && resumoWikipedia.url) {
      const summary = document.createElement('div');
      summary.className = 'authoritybox-rbmo-wikipedia-summary';

      const wlabel = document.createElement('div');
      wlabel.className = 'authoritybox-rbmo-wikipedia-label';
      wlabel.textContent = 'Wikipédia';

      const p = document.createElement('p');
      p.textContent = resumoWikipedia.extract;

      summary.appendChild(wlabel);
      summary.appendChild(p);

      const links = document.createElement('div');
      links.className = 'authoritybox-rbmo-links authoritybox-rbmo-links-main';

      const a = criarLink('Ler mais', resumoWikipedia.url, 'authoritybox-rbmo-btn authoritybox-rbmo-btn-wikipedia');
      if (a) links.appendChild(a);

      if (links.childNodes.length) summary.appendChild(links);
      container.replaceWith(summary);
      return;
    }

    if (wikipediaInfo && wikipediaInfo.url) {
      const links = document.createElement('div');
      links.className = 'authoritybox-rbmo-links authoritybox-rbmo-links-main';

      const a = criarLink('Ler mais na Wikipédia', wikipediaInfo.url, 'authoritybox-rbmo-btn authoritybox-rbmo-btn-wikipedia');
      if (a) links.appendChild(a);

      if (links.childNodes.length) {
        container.replaceWith(links);
        return;
      }
    }

    container.remove();
  }

  function criarLinksExternos(entidade, qid) {
    const externos = obterIdentificadoresExternos(entidade);
    const links = document.createElement('div');
    links.className = 'authoritybox-rbmo-links authoritybox-rbmo-links-external';

    externos.forEach(function (ext) {
      const a = criarLink(ext.label, ext.url, 'authoritybox-rbmo-btn authoritybox-rbmo-btn-small');
      if (a) links.appendChild(a);
    });

    const wdUrl = 'https://www.wikidata.org/wiki/' + encodeURIComponent(qid);
    const wd = criarLink('Wikidata', wdUrl, 'authoritybox-rbmo-btn authoritybox-rbmo-btn-small authoritybox-rbmo-btn-wikidata');
    if (wd) links.appendChild(wd);

    return links.childNodes.length ? links : null;
  }

  function criarLink(label, href, className) {
    const safe = safeExternalUrl(href);
    if (!safe) return null;

    const a = document.createElement('a');
    a.className = className;
    a.href = safe;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.referrerPolicy = 'no-referrer-when-downgrade';
    a.textContent = label;
    return a;
  }

  function renderDesignacoes(autor) {
    const div = document.createElement('div');
    div.className = 'authoritybox-rbmo-roles';

    const designacoes = obterDesignacoes(autor);

    designacoes.forEach(function (papel) {
      const span = document.createElement('span');
      span.textContent = papel;
      div.appendChild(span);
    });

    return div;
  }

  function obterDesignacoes(autor) {
    const papeis = Array.isArray(autor.papeis) ? autor.papeis : [];
    const normalizados = [];

    papeis.forEach(function (p) {
      const limpo = limparTexto(p);
      if (limpo && !normalizados.includes(limpo)) normalizados.push(limpo);
    });

    if (!normalizados.length && autor.labelLinha) {
      normalizados.push(labelParaDesignacao(autor.labelLinha));
    }

    return normalizados.length ? normalizados : [CONFIG.etiquetaSemDesignacao];
  }

  function labelParaDesignacao(label) {
    const t = normalizarTexto(label);

    if (t === 'autor') return 'Autor';
    if (t === 'co-autor') return 'Co-autor';
    if (t === 'autor secundário') return 'Autor secundário';

    return CONFIG.etiquetaSemDesignacao;
  }

  function recolherAutores() {
    const autores = [];

    document.querySelectorAll('tr').forEach(function (tr) {
      const celulas = tr.querySelectorAll('td, th');
      if (celulas.length < 2) return;

      const label = mapearLabel(celulas[0].textContent);
      if (!CONFIG.camposValidos.includes(label)) return;

      const links = Array.from(celulas[1].querySelectorAll('a[href*="opac-search.pl"][href*="q="]'));

      links.forEach(function (a) {
        const texto = limparTexto(a.textContent);
        const authid = extrairAuthId(a.href);

        if (!texto || !authid) return;

        autores.push({
          nome: limparNomeAutor(texto),
          nomeOriginal: texto,
          href: a.href,
          authid: authid,
          labelLinha: label,
          papeis: extrairPapeisDoTexto(texto, label)
        });
      });
    });

    if (!autores.length) {
      const links = Array.from(
        document.querySelectorAll('a[href*="opac-search.pl"][href*="q="]')
      );

      links.forEach(function (a) {
        const texto = limparTexto(a.textContent);
        const authid = extrairAuthId(a.href);

        if (!texto || !authid) return;

        const contexto = obterContextoDoLink(a);
        const label = obterLabelDoLink(a, contexto);

        if (CONFIG.camposExcluidos.includes(label)) return;
        if (pareceAssunto(contexto)) return;

        if (CONFIG.camposValidos.includes(label) || pareceResponsabilidade(contexto, texto)) {
          autores.push({
            nome: limparNomeAutor(texto),
            nomeOriginal: texto,
            href: a.href,
            authid: authid,
            labelLinha: label || inferirLabelResponsabilidade(contexto, texto),
            papeis: extrairPapeisDoTexto(texto, label)
          });
        }
      });
    }

    return autores
      .filter(function (a) {
        return a.nome && a.authid;
      })
      .filter(function (a, i, arr) {
        return arr.findIndex(function (b) {
          return b.authid === a.authid;
        }) === i;
      });
  }

  function obterContextoDoLink(link) {
    const bloco =
      link.closest('.results_summary') ||
      link.closest('tr') ||
      link.closest('li') ||
      link.closest('p') ||
      link.closest('div') ||
      link.parentElement;

    return limparTexto(bloco ? bloco.textContent : link.textContent);
  }

  function obterLabelDoLink(link, contexto) {
    const blocos = [
      link.closest('.results_summary'),
      link.closest('tr'),
      link.closest('li'),
      link.closest('p'),
      link.parentElement
    ].filter(Boolean);

    for (const bloco of blocos) {
      const labelEl =
        bloco.querySelector('.label') ||
        bloco.querySelector('th') ||
        bloco.querySelector('td:first-child') ||
        bloco.querySelector('span:first-child');

      if (!labelEl) continue;

      const label = mapearLabel(labelEl.textContent);
      if (CONFIG.camposValidos.includes(label)) return label;
      if (CONFIG.camposExcluidos.includes(label)) return label;
    }

    return mapearLabel(contexto);
  }

  function mapearLabel(texto) {
    const t = normalizarTexto(texto);

    if (t.startsWith('autor secundário')) return 'autor secundário';
    if (t.startsWith('co-autor')) return 'co-autor';
    if (t.startsWith('autor')) return 'autor';

    if (t.startsWith('nome pessoal')) return 'nome pessoal';
    if (t.startsWith('nome comum')) return 'nome comum';
    if (t.startsWith('assunto geográfico')) return 'assunto geográfico';
    if (t.startsWith('nome geográfico')) return 'nome geográfico';
    if (t.startsWith('assunto')) return 'assunto';
    if (t.startsWith('coleção')) return 'coleção';
    if (t.startsWith('título original')) return 'título original';
    if (t.startsWith('título')) return 'título';

    return '';
  }

  function pareceAssunto(contexto) {
    const t = normalizarTexto(contexto);

    return (
      t.startsWith('nome pessoal') ||
      t.startsWith('nome comum') ||
      t.startsWith('assunto') ||
      t.includes(' -- ') ||
      t.includes('[biografias]') ||
      t.includes('[novelas gráficas]') ||
      t.includes('[publicações infantis]')
    );
  }

  function pareceResponsabilidade(contexto, textoLink) {
    const t = normalizarTexto(contexto);
    const link = normalizarTexto(textoLink);

    if (t.startsWith('autor')) return true;
    if (t.startsWith('co-autor')) return true;
    if (t.startsWith('autor secundário')) return true;

    return CONFIG.papeis.some(function (papel) {
      return link.includes(normalizarTexto(papel));
    });
  }

  function inferirLabelResponsabilidade(contexto, textoLink) {
    const t = normalizarTexto(contexto);
    const link = normalizarTexto(textoLink);

    if (t.startsWith('autor')) return 'autor';
    if (t.startsWith('co-autor')) return 'co-autor';
    if (t.startsWith('autor secundário')) return 'autor secundário';

    if (link.includes('tradutor')) return 'autor secundário';
    if (link.includes('ilustrador')) return 'autor secundário';
    if (link.includes('editor literário')) return 'autor secundário';

    return '';
  }

  function limparNomeAutor(texto) {
    let nome = limparTexto(texto);

    CONFIG.papeis.forEach(function (papel) {
      const re = new RegExp(',?\\s*' + escapeRegExp(papel) + '\\s*$', 'i');
      nome = nome.replace(re, '');
    });

    return limparTexto(nome);
  }

  function extrairPapeisDoTexto(texto, labelLinha) {
    const encontrados = [];

    CONFIG.papeis.forEach(function (papel) {
      const re = new RegExp('(^|,|\\s)' + escapeRegExp(papel) + '($|,|\\s)', 'i');
      if (re.test(texto)) encontrados.push(papel);
    });

    if (!encontrados.length) {
      if (labelLinha === 'autor') encontrados.push('Autor');
      if (labelLinha === 'co-autor') encontrados.push('Co-autor');
      if (labelLinha === 'autor secundário') encontrados.push('Autor secundário');
    }

    return encontrados;
  }

  function extrairAuthId(url) {
    try {
      const u = new URL(url, location.origin);
      const authid = u.searchParams.get('authid') || u.searchParams.get('q');

      if (isValidAuthid(authid)) return authid;

      const q = u.searchParams.get('q') || '';
      const m = q.match(/(?:an:)?(\d+)/i);
      return m && isValidAuthid(m[1]) ? m[1] : null;
    } catch (e) {
      const m =
        String(url || '').match(/[?&]authid=(\d+)/i) ||
        String(url || '').match(/[?&]q=(\d+)/i) ||
        String(url || '').match(/an:(\d+)/i);

      return m && isValidAuthid(m[1]) ? m[1] : null;
    }
  }

  async function obterQID(authid) {
    if (!isValidAuthid(authid)) return null;
    if (cacheQID.has(authid)) return cacheQID.get(authid);

    try {
      const url = '/cgi-bin/koha/opac-authoritiesdetail.pl?authid=' +
        encodeURIComponent(authid) +
        '&marc=1';

      const response = await fetchWithTimeout(url, {
        credentials: 'same-origin',
        cache: 'no-store'
      });

      if (!response.ok) {
        cacheQID.set(authid, null);
        return null;
      }

      const html = await response.text();
      const qid = extrairQIDWikidata(html);

      cacheQID.set(authid, qid);

      return qid;
    } catch (e) {
      console.warn('AuthorityBox: erro ao obter QID', authid, e);
      cacheQID.set(authid, null);
      return null;
    }
  }

  function extrairQIDWikidata(html) {
    const texto = String(html || '').replace(/\s+/g, ' ');
    const matches = Array.from(texto.matchAll(/Q[1-9][0-9]*/g));

    for (const match of matches) {
      const pos = match.index;
      const contexto = texto.slice(Math.max(0, pos - 500), pos + 500).toLowerCase();

      if (contexto.includes('wikidata') && isValidQID(match[0])) {
        return match[0];
      }
    }

    return null;
  }

  async function obterEntidade(qid) {
    if (!isValidQID(qid)) return null;
    if (cacheWikidata.has(qid)) return cacheWikidata.get(qid);

    const key = 'authoritybox_' + CONFIG.version + '_wd_' + qid;
    const cached = lerSessionCache(key);

    if (cached !== undefined) {
      cacheWikidata.set(qid, cached);
      return cached;
    }

    try {
      const url = 'https://www.wikidata.org/wiki/Special:EntityData/' +
        encodeURIComponent(qid) +
        '.json';

      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        cacheWikidata.set(qid, null);
        return null;
      }

      const data = await response.json();
      const entidade = data && data.entities ? data.entities[qid] : null;

      if (!entidade || entidade.missing) {
        cacheWikidata.set(qid, null);
        return null;
      }

      cacheWikidata.set(qid, entidade);
      gravarSessionCache(key, entidade);

      return entidade;
    } catch (e) {
      console.warn('AuthorityBox: erro Wikidata', qid, e);
      cacheWikidata.set(qid, null);
      return null;
    }
  }

  function obterTextoMultilingue(obj) {
    if (!obj) return '';

    for (const lang of CONFIG.langs) {
      if (obj[lang] && obj[lang].value) return limparTexto(obj[lang].value);
    }

    return '';
  }

  function obterDescricaoPT(entidade) {
    if (!entidade.descriptions) return '';

    for (const lang of ['pt', 'pt-br', 'en']) {
      if (entidade.descriptions[lang] && entidade.descriptions[lang].value) {
        return limparTexto(entidade.descriptions[lang].value);
      }
    }

    return '';
  }

  function obterValorClaim(entidade, prop) {
    try {
      return entidade.claims[prop][0].mainsnak.datavalue.value;
    } catch (e) {
      return null;
    }
  }

  function obterDataClaim(entidade, prop) {
    try {
      const valor = entidade.claims[prop][0].mainsnak.datavalue.value;
      return formatarDataWikidata(valor.time, valor.precision);
    } catch (e) {
      return '';
    }
  }

  function formatarDataWikidata(time, precision) {
    if (!time) return '';

    const match = String(time).match(/^([+-])(\d{4,})-(\d{2})-(\d{2})/);
    if (!match) return '';

    const sinal = match[1];
    const ano = match[2];
    const mes = match[3];
    const dia = match[4];

    if (sinal === '-') return ano + ' a.C.';
    if (precision >= 11) return dia + '/' + mes + '/' + ano;
    if (precision === 10) return mes + '/' + ano;
    if (precision === 9) return ano;

    return ano;
  }

  function obterEntityIdClaim(entidade, prop) {
    try {
      const id = entidade.claims[prop][0].mainsnak.datavalue.value.id || '';
      return isValidQID(id) ? id : '';
    } catch (e) {
      return '';
    }
  }

  function obterEntityIdsClaim(entidade, prop) {
    try {
      return entidade.claims[prop]
        .map(function (c) {
          return c.mainsnak.datavalue.value.id;
        })
        .filter(isValidQID);
    } catch (e) {
      return [];
    }
  }

  async function obterLabels(ids) {
    const resultado = {};
    const uniqueIds = Array.from(new Set((ids || []).filter(isValidQID)));
    const porBuscar = uniqueIds.filter(function (id) {
      return id && !cacheLabels.has(id);
    });

    if (porBuscar.length) {
      try {
        const url =
          'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' +
          encodeURIComponent(porBuscar.join('|')) +
          '&props=labels&languages=pt|pt-br|en|fr|es&format=json&origin=*';

        const response = await fetchWithTimeout(url);
        const data = await response.json();

        Object.keys(data.entities || {}).forEach(function (id) {
          const entidade = data.entities[id];
          let label = '';

          for (const lang of CONFIG.langs) {
            if (entidade.labels && entidade.labels[lang]) {
              label = entidade.labels[lang].value;
              break;
            }
          }

          cacheLabels.set(id, limparTexto(label || id));
        });
      } catch (e) {
        console.warn('AuthorityBox: erro ao obter labels', e);
      }
    }

    uniqueIds.forEach(function (id) {
      resultado[id] = cacheLabels.get(id) || id;
    });

    return resultado;
  }

  function obterWikipediaInfo(entidade, label) {
    if (entidade && entidade.sitelinks) {
      const prioridades = ['ptwiki', 'enwiki'];

      for (const key of prioridades) {
        if (entidade.sitelinks[key] && entidade.sitelinks[key].title) {
          const lang = key.replace('wiki', '');
          const title = limparTexto(entidade.sitelinks[key].title);

          if (!isSafeWikiLang(lang) || !title) continue;

          return {
            lang: lang,
            title: title,
            url: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'))
          };
        }
      }
    }

    const safeLabel = limparTexto(label);
    if (!safeLabel) return null;

    return {
      lang: 'pt',
      title: safeLabel,
      url: 'https://pt.wikipedia.org/w/index.php?search=' + encodeURIComponent(safeLabel)
    };
  }

  async function obterResumoWikipedia(wikipediaInfo) {
    if (!wikipediaInfo || !isSafeWikiLang(wikipediaInfo.lang) || !wikipediaInfo.title) return null;

    const key = 'authoritybox_' + CONFIG.version + '_wp_' +
      wikipediaInfo.lang + '_' + wikipediaInfo.title;

    if (cacheWikipedia.has(key)) return cacheWikipedia.get(key);

    const cached = lerSessionCache(key);

    if (cached !== undefined) {
      cacheWikipedia.set(key, cached);
      return cached;
    }

    try {
      const url =
        'https://' +
        encodeURIComponent(wikipediaInfo.lang) +
        '.wikipedia.org/api/rest_v1/page/summary/' +
        encodeURIComponent(wikipediaInfo.title.replace(/ /g, '_'));

      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        cacheWikipedia.set(key, null);
        return null;
      }

      const data = await response.json();

      const extract = limparResumoWikipedia(data.extract || '');
      const finalUrl =
        data.content_urls &&
        data.content_urls.desktop &&
        data.content_urls.desktop.page
          ? data.content_urls.desktop.page
          : wikipediaInfo.url;

      const safeFinalUrl = safeExternalUrl(finalUrl);

      if (!extract || !safeFinalUrl) {
        cacheWikipedia.set(key, null);
        return null;
      }

      const resumo = {
        extract: extract,
        url: safeFinalUrl,
        lang: wikipediaInfo.lang
      };

      cacheWikipedia.set(key, resumo);
      gravarSessionCache(key, resumo);

      return resumo;
    } catch (e) {
      console.warn('AuthorityBox: erro ao obter resumo da Wikipédia', wikipediaInfo, e);
      cacheWikipedia.set(key, null);
      return null;
    }
  }

  function limparResumoWikipedia(texto) {
    const limpo = limparTexto(texto);
    if (!limpo) return '';

    const limite = 420;
    if (limpo.length <= limite) return limpo;

    const cortado = limpo.slice(0, limite);
    const ultimoPonto = cortado.lastIndexOf('.');

    if (ultimoPonto > 180) {
      return cortado.slice(0, ultimoPonto + 1);
    }

    return cortado.replace(/\s+\S*$/, '') + '...';
  }

  function obterIdentificadoresExternos(entidade) {
    const resultado = [];

    CONFIG.externalIds.forEach(function (ext) {
      try {
        const valor = entidade.claims[ext.prop][0].mainsnak.datavalue.value;
        if (!valor) return;

        const url = ext.url.replace('$1', encodeURIComponent(String(valor).replace(/\s+/g, '')));
        const safe = safeExternalUrl(url);

        if (safe) {
          resultado.push({
            label: ext.label,
            url: safe
          });
        }
      } catch (e) {}
    });

    return resultado;
  }

  function imagemCommons(filename) {
    const normalizado = limparTexto(filename).replace(/ /g, '_');
    if (!normalizado || /[<>"]/.test(normalizado)) return '';

    const url = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/' +
      encodeURIComponent(normalizado);

    return safeExternalUrl(url);
  }

  function criarCaixa() {
    if (document.querySelector('#authoritybox-rbmo')) {
      return document.querySelector('#authoritybox-rbmo-content');
    }

    inserirEstilos();

    const aside = document.createElement('aside');
    aside.id = 'authoritybox-rbmo';
    aside.setAttribute('aria-label', 'Autores');

    const header = document.createElement('div');
    header.id = 'authoritybox-rbmo-header';

    const title = document.createElement('span');
    title.textContent = CONFIG.titulo;

    const count = document.createElement('span');
    count.id = 'authoritybox-rbmo-count';

    header.appendChild(title);
    header.appendChild(count);

    const content = document.createElement('div');
    content.id = 'authoritybox-rbmo-content';

    const source = document.createElement('div');
    source.id = 'authoritybox-rbmo-source';

    const strong = document.createElement('strong');
    strong.textContent = 'Fontes: Wikidata e Wikipédia';

    const br = document.createElement('br');
    const text = document.createTextNode('Informação de origem externa.');

    source.appendChild(strong);
    source.appendChild(br);
    source.appendChild(text);

    aside.appendChild(header);
    aside.appendChild(content);
    aside.appendChild(source);

    const alvo =
      document.querySelector('#action') ||
      document.querySelector('.actions-menu') ||
      document.querySelector('#opac-detail-sidebar') ||
      document.querySelector('.col-lg-3') ||
      document.querySelector('.col-md-3') ||
      document.querySelector('#bibliodescriptions') ||
      document.querySelector('#catalogue_detail_biblio') ||
      document.body;

    alvo.insertBefore(aside, alvo.firstChild);

    return content;
  }

  function criarMensagemVazia(texto) {
    const div = document.createElement('div');
    div.className = 'authoritybox-rbmo-empty';
    div.textContent = texto;
    return div;
  }

  function atualizarContador() {
    const cards = document.querySelectorAll('.authoritybox-rbmo-card');
    const count = document.querySelector('#authoritybox-rbmo-count');

    if (count) count.textContent = cards.length ? String(cards.length) : '';
  }

  function inserirEstilos() {
    if (document.querySelector('#authoritybox-rbmo-style')) return;

    const style = document.createElement('style');
    style.id = 'authoritybox-rbmo-style';
    style.textContent = `
      #authoritybox-rbmo {
        background:#ffffff;
        border:1px solid #e5e7eb;
        border-radius:16px;
        box-shadow:0 10px 30px rgba(15,23,42,0.08);
        margin:0 0 16px 0;
        overflow:hidden;
        color:#111827;
        font-size:14px;
      }

      #authoritybox-rbmo-header {
        display:flex;
        justify-content:space-between;
        align-items:center;
        padding:14px 16px 10px 16px;
        font-weight:700;
        font-size:17px;
        letter-spacing:-0.01em;
        border-bottom:1px solid #f1f3f5;
        background:linear-gradient(180deg,#ffffff 0%,#fafafa 100%);
      }

      #authoritybox-rbmo-count {
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-width:22px;
        height:22px;
        padding:0 7px;
        border-radius:999px;
        background:#f1f5f9;
        color:#64748b;
        font-size:12px;
        font-weight:600;
      }

      #authoritybox-rbmo-content {
        padding:8px 14px 8px 14px;
      }

      .authoritybox-rbmo-section {
        margin:0;
      }

      .authoritybox-rbmo-section-title {
        color:#64748b;
        font-size:11px;
        font-weight:700;
        letter-spacing:0.04em;
        text-transform:uppercase;
        margin:4px 0 2px 0;
      }

      .authoritybox-rbmo-card {
        padding:14px 0;
        border-bottom:1px solid #f0f0f0;
      }

      .authoritybox-rbmo-accordion-body .authoritybox-rbmo-card:last-child {
        border-bottom:none;
      }

      .authoritybox-rbmo-section-main > .authoritybox-rbmo-card:last-child {
        border-bottom:none;
      }

      .authoritybox-rbmo-top {
        display:flex;
        gap:12px;
        align-items:flex-start;
      }

      .authoritybox-rbmo-photo {
        flex:0 0 62px;
        width:62px;
        height:78px;
        border-radius:14px;
        overflow:hidden;
        border:1px solid #e5e7eb;
        background:#f8fafc;
        display:flex;
        align-items:center;
        justify-content:center;
      }

      .authoritybox-rbmo-card-main .authoritybox-rbmo-photo {
        flex-basis:118px;
        width:118px;
        height:148px;
        border-radius:20px;
      }

      .authoritybox-rbmo-photo img {
        width:100%;
        height:100%;
        object-fit:cover;
        display:block;
      }

      .authoritybox-rbmo-photo-empty span {
        font-size:20px;
        font-weight:700;
        color:#64748b;
      }

      .authoritybox-rbmo-card-main .authoritybox-rbmo-photo-empty span {
        font-size:32px;
      }

      .authoritybox-rbmo-heading {
        min-width:0;
        flex:1;
      }

      .authoritybox-rbmo-name {
        font-weight:700;
        font-size:16px;
        line-height:1.2;
        margin-bottom:4px;
        letter-spacing:-0.01em;
      }

      .authoritybox-rbmo-card-main .authoritybox-rbmo-name {
        font-size:18px;
      }

      .authoritybox-rbmo-roles {
        display:flex;
        flex-wrap:wrap;
        gap:4px;
        margin:2px 0 7px 0;
      }

      .authoritybox-rbmo-roles span {
        display:inline-flex;
        font-size:11px;
        color:#475569;
        background:#f1f5f9;
        border:1px solid #e2e8f0;
        border-radius:999px;
        padding:2px 8px;
        line-height:1.2;
      }

      .authoritybox-rbmo-desc {
        color:#4b5563;
        line-height:1.35;
        font-size:13px;
      }

      .authoritybox-rbmo-card-compact {
        padding-top:10px;
        padding-bottom:10px;
      }

      .authoritybox-rbmo-card-compact .authoritybox-rbmo-desc {
        font-size:12.5px;
      }

      .authoritybox-rbmo-wikipedia-summary {
        margin-top:12px;
        padding:10px 11px;
        border:1px solid #eef2f7;
        border-radius:12px;
        background:#fbfdff;
      }

      .authoritybox-rbmo-wikipedia-label {
        font-size:11px;
        font-weight:700;
        letter-spacing:0.02em;
        text-transform:uppercase;
        color:#64748b;
        margin-bottom:5px;
      }

      .authoritybox-rbmo-wikipedia-summary p {
        margin:0;
        font-size:12.8px;
        line-height:1.45;
        color:#374151;
      }

      .authoritybox-rbmo-facts {
        margin:12px 0 0 0;
        padding:0;
      }

      .authoritybox-rbmo-card-compact .authoritybox-rbmo-facts {
        margin-top:8px;
      }

      .authoritybox-rbmo-facts div {
        display:grid;
        grid-template-columns:86px 1fr;
        gap:8px;
        padding:5px 0;
        border-top:1px solid #f5f5f5;
      }

      .authoritybox-rbmo-facts dt {
        color:#6b7280;
        font-weight:600;
        font-size:12px;
      }

      .authoritybox-rbmo-facts dd {
        margin:0;
        color:#111827;
        font-size:12.5px;
        line-height:1.35;
      }

      .authoritybox-rbmo-links {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:9px;
      }

      .authoritybox-rbmo-links-external {
        margin-top:8px;
      }

      .authoritybox-rbmo-btn {
        display:inline-flex;
        align-items:center;
        border:1px solid #e5e7eb;
        background:#fafafa;
        border-radius:999px;
        padding:4px 9px;
        font-size:12px;
        line-height:1;
        text-decoration:none !important;
        color:#0369a1;
      }

      .authoritybox-rbmo-btn:hover {
        background:#f0f9ff;
        border-color:#bae6fd;
        text-decoration:none !important;
      }

      .authoritybox-rbmo-btn-small {
        font-size:10.5px;
        padding:2px 7px;
        color:#667085;
        border-color:#edf0f3;
        background:#fbfbfc;
      }

      .authoritybox-rbmo-btn-small:hover {
        color:#0369a1;
        border-color:#dbe3eb;
        background:#f8fafc;
      }

      .authoritybox-rbmo-btn-wikidata {
        font-weight:600;
      }

      .authoritybox-rbmo-empty {
        color:#6b7280;
        font-size:13px;
        font-style:italic;
        padding:3px 0;
      }

      .authoritybox-rbmo-card-missing {
        opacity:0.9;
      }

      .authoritybox-rbmo-accordion {
        border:1px solid #eef2f7;
        border-radius:14px;
        background:#ffffff;
        margin:10px 0;
        overflow:hidden;
      }

      .authoritybox-rbmo-accordion-master {
        border-color:#e5e7eb;
        background:#fcfcfd;
      }

      .authoritybox-rbmo-accordion-role {
        margin:8px 0;
        background:#ffffff;
      }

      .authoritybox-rbmo-accordion-summary {
        cursor:pointer;
        list-style:none;
        padding:10px 12px;
        background:#f8fafc;
        border-bottom:1px solid transparent;
        user-select:none;
      }

      .authoritybox-rbmo-accordion[open] > .authoritybox-rbmo-accordion-summary {
        border-bottom-color:#eef2f7;
      }

      .authoritybox-rbmo-accordion-summary::-webkit-details-marker {
        display:none;
      }

      .authoritybox-rbmo-summary-text {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .authoritybox-rbmo-summary-title {
        color:#334155;
        font-size:13px;
        font-weight:700;
      }

      .authoritybox-rbmo-summary-count {
        display:inline-flex;
        min-width:22px;
        height:22px;
        border-radius:999px;
        align-items:center;
        justify-content:center;
        background:#e2e8f0;
        color:#475569;
        font-size:11px;
        font-weight:700;
      }

      .authoritybox-rbmo-accordion-body {
        padding:0 12px 4px 12px;
      }

      #authoritybox-rbmo-source {
        padding:8px 16px 12px 16px;
        color:#9ca3af;
        font-size:10.5px;
        line-height:1.35;
        border-top:1px solid #f3f4f6;
        background:#fcfcfc;
      }

      #authoritybox-rbmo-source strong {
        color:#64748b;
        font-weight:700;
      }
    `;

    document.head.appendChild(style);
  }

  async function fetchWithTimeout(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(function () {
      controller.abort();
    }, CONFIG.requestTimeoutMs);

    try {
      const opts = Object.assign({}, options || {}, {
        signal: controller.signal
      });

      return await fetch(url, opts);
    } finally {
      clearTimeout(timeout);
    }
  }

  function safeExternalUrl(url) {
    try {
      const u = new URL(url, location.origin);
      if (u.protocol !== 'https:') return '';

      const host = u.hostname.toLowerCase();
      if (!CONFIG.allowedUrlHosts.includes(host)) return '';

      return u.href;
    } catch (e) {
      return '';
    }
  }

  function isValidAuthid(value) {
    return /^[0-9]+$/.test(String(value || '').trim());
  }

  function isValidQID(value) {
    return /^Q[1-9][0-9]*$/.test(String(value || '').trim());
  }

  function isSafeWikiLang(lang) {
    return ['pt', 'en', 'fr', 'es'].includes(String(lang || '').toLowerCase());
  }

  function lerSessionCache(key) {
    if (!CONFIG.cacheMinutos || CONFIG.cacheMinutos <= 0) return undefined;

    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return undefined;

      const parsed = JSON.parse(raw);

      if (!parsed || !parsed.expires || Date.now() > parsed.expires) {
        sessionStorage.removeItem(key);
        return undefined;
      }

      return parsed.value;
    } catch (e) {
      return undefined;
    }
  }

  function gravarSessionCache(key, value) {
    if (!CONFIG.cacheMinutos || CONFIG.cacheMinutos <= 0) return;

    try {
      sessionStorage.setItem(key, JSON.stringify({
        value: value,
        expires: Date.now() + CONFIG.cacheMinutos * 60 * 1000
      }));
    } catch (e) {}
  }

  function normalizarTexto(texto) {
    return limparTexto(texto)
      .toLowerCase()
      .replace(/:$/, '')
      .trim();
  }

  function iniciais(nome) {
    return String(nome || '')
      .replace(/,\s*\d{4}.*/g, '')
      .replace(/,/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (p) {
        return p.charAt(0).toUpperCase();
      })
      .join('');
  }

  function limparTexto(texto) {
    return String(texto || '').replace(/\s+/g, ' ').trim();
  }

  function escapeRegExp(str) {
    return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
})();
