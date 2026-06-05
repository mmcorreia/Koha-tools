/* ==========================================================
   Authority BOX / OPAC Koha
   Miguel Mimoso Correia CC-BY-NC-SA
   Infobox de autores com Wikidata e Wikipédia.

   Versão OPAC 1.3
   - Apenas OPAC: /cgi-bin/koha/opac-detail.pl
   - Autor principal sempre visível
   - Co-autorias e responsabilidades secundárias em acordeões
   - Designações de autoria visíveis
   - Identificadores: VIAF, ISNI, LoC, BnF, GND, Wikidata
   - Compatível com código colado diretamente em OPACUserJS
   ========================================================== */

(function () {
  'use strict';

  if (window.__authorityBoxRbmoOpacLoaded) return;
  window.__authorityBoxRbmoOpacLoaded = true;

  const CONFIG = {
    version: '1.3-opac',
    maxAutoridades: 12,
    titulo: 'Autor(es)',
    tituloAutorPrincipal: 'Autor principal',
    tituloOutrasResponsabilidades: 'Co-autorias e outras responsabilidades',
    notaFinal: '<strong>Fontes: Wikidata e Wikipédia</strong><br>Ligação semântica estabelecida através do registo de autoridade local.',
    mensagemSemQID: 'Ligação indisponível',
    mostrarAutoresSemQID: true,
    cacheMinutos: 15,
    langs: ['pt', 'pt-br', 'en', 'fr', 'es'],

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

    externalIds: [
      { prop: 'P214', label: 'VIAF', url: 'https://viaf.org/viaf/$1' },
      { prop: 'P213', label: 'ISNI', url: 'https://isni.org/isni/$1' },
      { prop: 'P244', label: 'LoC', url: 'https://id.loc.gov/authorities/names/$1' },
      { prop: 'P268', label: 'BnF', url: 'https://catalogue.bnf.fr/ark:/12148/cb$1' },
      { prop: 'P227', label: 'GND', url: 'https://d-nb.info/gnd/$1' }
    ]
  };

  const cacheQID = new Map();
  const cacheWikidata = new Map();
  const cacheLabels = new Map();
  const cacheWikipedia = new Map();

  function arrancarAuthorityBox() {
    setTimeout(initAuthorityBoxOpac, 900);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', arrancarAuthorityBox, { once: true });
  } else {
    arrancarAuthorityBox();
  }

  async function initAuthorityBoxOpac() {
    if (!isOpacDetailPage()) return;

    const autores = recolherAutores();
    if (!autores.length) return;

    criarCaixa();

    const content = document.querySelector('#authoritybox-rbmo-content');
    if (!content) return;

    const autoresProcessados = [];
    const qidsMostrados = new Set();
    const authidsMostrados = new Set();

    for (const autor of autores.slice(0, CONFIG.maxAutoridades)) {
      if (autor.authid && authidsMostrados.has(autor.authid)) continue;
      if (autor.authid) authidsMostrados.add(autor.authid);

      const qid = autor.authid ? await obterQID(autor.authid) : null;

      if (qid && qidsMostrados.has(qid)) continue;
      if (qid) qidsMostrados.add(qid);

      autoresProcessados.push({
        autor: autor,
        qid: qid,
        grupo: obterGrupoAutor(autor)
      });
    }

    if (!autoresProcessados.length) return;

    const principal = escolherAutorPrincipal(autoresProcessados);
    const restantes = autoresProcessados.filter(function (item) {
      return item !== principal;
    });

    if (principal) {
      const blocoPrincipal = document.createElement('section');
      blocoPrincipal.className = 'authoritybox-rbmo-section authoritybox-rbmo-section-primary';

      const h = document.createElement('div');
      h.className = 'authoritybox-rbmo-section-title';
      h.textContent = CONFIG.tituloAutorPrincipal;
      blocoPrincipal.appendChild(h);

      const html = principal.qid
        ? await construirCartaoComWikidata(principal.qid, principal.autor, true)
        : construirCartaoSemWikidata(principal.autor, true);

      blocoPrincipal.insertAdjacentHTML('beforeend', html);
      content.appendChild(blocoPrincipal);
    }

    if (restantes.length) {
      const details = document.createElement('details');
      details.className = 'authoritybox-rbmo-accordion';

      const summary = document.createElement('summary');
      summary.textContent = CONFIG.tituloOutrasResponsabilidades + ' (' + restantes.length + ')';
      details.appendChild(summary);

      const porGrupo = agruparPorResponsabilidade(restantes);

      for (const grupo of porGrupo) {
        const grupoDetails = document.createElement('details');
        grupoDetails.className = 'authoritybox-rbmo-subaccordion';
        grupoDetails.open = grupo.aberto;

        const grupoSummary = document.createElement('summary');
        grupoSummary.textContent = grupo.label + ' (' + grupo.items.length + ')';
        grupoDetails.appendChild(grupoSummary);

        for (const item of grupo.items) {
          const html = item.qid
            ? await construirCartaoComWikidata(item.qid, item.autor, false)
            : construirCartaoSemWikidata(item.autor, false);

          if (html) grupoDetails.insertAdjacentHTML('beforeend', html);
        }

        details.appendChild(grupoDetails);
      }

      content.appendChild(details);
    }

    atualizarContador();
  }

  function isOpacDetailPage() {
    return window.location.pathname.includes('/cgi-bin/koha/opac-detail.pl') ||
      window.location.href.includes('opac-detail.pl');
  }

  function recolherAutores() {
    const autores = [];

    document.querySelectorAll('.results_summary, tr').forEach(function (bloco) {
      const label = obterLabelDoBloco(bloco);
      if (!CONFIG.camposValidos.includes(label)) return;

      const links = Array.from(bloco.querySelectorAll('a[href*="opac-search.pl"]'));

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
            labelLinha: label || 'autor secundário',
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

  function obterLabelDoBloco(bloco) {
    let labelEl = null;

    if (bloco.classList && bloco.classList.contains('results_summary')) {
      labelEl = bloco.querySelector('.label');
    } else if (bloco.tagName && bloco.tagName.toLowerCase() === 'tr') {
      labelEl = bloco.querySelector('th') || bloco.querySelector('td:first-child');
    }

    return mapearLabel(labelEl ? labelEl.textContent : bloco.textContent);
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
    if (t.startsWith('co-autor') || t.startsWith('coautor')) return 'co-autor';
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
    if (t.startsWith('co-autor') || t.startsWith('coautor')) return true;
    if (t.startsWith('autor secundário')) return true;

    return CONFIG.papeis.some(function (papel) {
      return link.includes(normalizarTexto(papel));
    });
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

  function obterGrupoAutor(autor) {
    if (autor.papeis && autor.papeis.length) return autor.papeis[0];
    if (autor.labelLinha === 'autor') return 'Autor';
    if (autor.labelLinha === 'co-autor') return 'Co-autor';
    if (autor.labelLinha === 'autor secundário') return 'Autor secundário';
    return 'Outras responsabilidades';
  }

  function escolherAutorPrincipal(items) {
    return items.find(function (item) {
      return item.autor.labelLinha === 'autor' || item.grupo === 'Autor';
    }) || items[0] || null;
  }

  function agruparPorResponsabilidade(items) {
    const ordem = [
      'Co-autor',
      'Autor secundário',
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
      'Adaptador',
      'Outras responsabilidades'
    ];

    const mapa = new Map();

    items.forEach(function (item) {
      const key = item.grupo || 'Outras responsabilidades';
      if (!mapa.has(key)) mapa.set(key, []);
      mapa.get(key).push(item);
    });

    return Array.from(mapa.keys())
      .sort(function (a, b) {
        const ia = ordem.indexOf(a) === -1 ? 999 : ordem.indexOf(a);
        const ib = ordem.indexOf(b) === -1 ? 999 : ordem.indexOf(b);
        return ia - ib || a.localeCompare(b);
      })
      .map(function (label, index) {
        return {
          label: label,
          items: mapa.get(label),
          aberto: index === 0
        };
      });
  }

  function extrairAuthId(url) {
    try {
      const u = new URL(url, location.origin);
      const q = u.searchParams.get('q');
      const authid = u.searchParams.get('authid');
      const idx = u.searchParams.get('idx') || '';

      if (authid && /^\d+$/.test(authid)) return authid;
      if (q && /^\d+$/.test(q) && /(^|,)an(,|$)/i.test(idx)) return q;
      if (q && /^\d+$/.test(q)) return q;

      const decoded = decodeURIComponent(url);
      const m =
        decoded.match(/[?&]authid=(\d+)/i) ||
        decoded.match(/[?&]q=(\d+)/i) ||
        decoded.match(/an:(\d+)/i);

      return m ? m[1] : null;
    } catch (e) {
      const decoded = decodeURIComponent(String(url || ''));
      const m =
        decoded.match(/[?&]authid=(\d+)/i) ||
        decoded.match(/[?&]q=(\d+)/i) ||
        decoded.match(/an:(\d+)/i);

      return m ? m[1] : null;
    }
  }

  async function obterQID(authid) {
    if (!authid || !/^\d+$/.test(String(authid))) return null;
    if (cacheQID.has(authid)) return cacheQID.get(authid);

    try {
      const url = '/cgi-bin/koha/opac-authoritiesdetail.pl?authid=' +
        encodeURIComponent(authid) +
        '&marc=1';

      const response = await fetch(url, {
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
    const matches = Array.from(texto.matchAll(/Q[1-9]\d{2,}/g));

    for (const match of matches) {
      const pos = match.index;
      const contexto = texto.slice(Math.max(0, pos - 450), pos + 450).toLowerCase();

      if (contexto.includes('wikidata')) {
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

      const response = await fetch(url);

      if (!response.ok) {
        cacheWikidata.set(qid, null);
        return null;
      }

      const data = await response.json();
      const entidade = data.entities && data.entities[qid];

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

  async function construirCartaoComWikidata(qid, autor, principal) {
    const entidade = await obterEntidade(qid);
    if (!entidade) return construirCartaoSemWikidata(autor, principal);

    const label = obterTextoMultilingue(entidade.labels) || autor.nome || qid;
    const descricao = obterDescricaoPT(entidade);
    const imagem = obterValorClaim(entidade, 'P18');
    const nascimento = obterDataClaim(entidade, 'P569');
    const morte = obterDataClaim(entidade, 'P570');

    const paisIds = obterEntityIdsClaim(entidade, 'P27').slice(0, 3);
    const localNascimentoId = obterEntityIdClaim(entidade, 'P19');
    const localMorteId = obterEntityIdClaim(entidade, 'P20');
    const premiosIds = obterEntityIdsClaim(entidade, 'P166').slice(0, 4);

    const labels = await obterLabels([
      localNascimentoId,
      localMorteId
    ].concat(paisIds, premiosIds).filter(Boolean));

    const paises = paisIds.map(function (id) {
      return labels[id];
    }).filter(Boolean);

    const localNascimento = localNascimentoId ? labels[localNascimentoId] : '';
    const localMorte = localMorteId ? labels[localMorteId] : '';
    const premios = premiosIds.map(function (id) {
      return labels[id];
    }).filter(Boolean);

    const wikipediaInfo = obterWikipediaInfo(entidade, label);
    const resumoWikipedia = wikipediaInfo ? await obterResumoWikipedia(wikipediaInfo) : null;
    const externos = obterIdentificadoresExternos(entidade, qid);

    let html = '<article class="authoritybox-rbmo-card ' +
      (principal ? 'authoritybox-rbmo-card-main' : 'authoritybox-rbmo-card-compact') +
      '">';

    html += '<div class="authoritybox-rbmo-top">';

    if (imagem) {
      html +=
        '<div class="authoritybox-rbmo-photo">' +
          '<img src="' + escapeAttr(imagemCommons(imagem)) + '" alt="">' +
        '</div>';
    } else {
      html +=
        '<div class="authoritybox-rbmo-photo authoritybox-rbmo-photo-empty">' +
          '<span>' + escapeHtml(iniciais(label)) + '</span>' +
        '</div>';
    }

    html +=
      '<div class="authoritybox-rbmo-heading">' +
        '<div class="authoritybox-rbmo-name">' + escapeHtml(label) + '</div>' +
        renderPapeis(autor.papeis) +
        (descricao ? '<div class="authoritybox-rbmo-desc">' + escapeHtml(descricao) + '</div>' : '') +
      '</div>' +
    '</div>';

    html += '<dl class="authoritybox-rbmo-facts">';

    if (paises.length) {
      html +=
        '<div>' +
          '<dt>País</dt>' +
          '<dd>' + paises.map(escapeHtml).join('; ') + '</dd>' +
        '</div>';
    }

    if (nascimento || localNascimento) {
      html +=
        '<div>' +
          '<dt>Nascimento</dt>' +
          '<dd>' + escapeHtml(nascimento || 'Data não indicada') +
          (localNascimento ? ', ' + escapeHtml(localNascimento) : '') +
          '</dd>' +
        '</div>';
    }

    if (morte || localMorte) {
      html +=
        '<div>' +
          '<dt>Morte</dt>' +
          '<dd>' + escapeHtml(morte || 'Data não indicada') +
          (localMorte ? ', ' + escapeHtml(localMorte) : '') +
          '</dd>' +
        '</div>';
    }

    if (premios.length) {
      html +=
        '<div>' +
          '<dt>Prémios</dt>' +
          '<dd>' + premios.map(escapeHtml).join('; ') + '</dd>' +
        '</div>';
    }

    html += '</dl>';

    if (resumoWikipedia && resumoWikipedia.extract) {
      html += '<div class="authoritybox-rbmo-wikipedia-summary">';
      html += '<div class="authoritybox-rbmo-wikipedia-label">Wikipédia</div>';
      html += '<p>' + escapeHtml(resumoWikipedia.extract) + '</p>';
      html += '<div class="authoritybox-rbmo-links authoritybox-rbmo-links-main">';
      html += '<a class="authoritybox-rbmo-btn authoritybox-rbmo-btn-wikipedia" href="' + escapeAttr(resumoWikipedia.url) + '" target="_blank" rel="noopener noreferrer">Ler mais</a>';
      html += '</div>';
      html += '</div>';
    } else if (wikipediaInfo && wikipediaInfo.url) {
      html += '<div class="authoritybox-rbmo-links authoritybox-rbmo-links-main">';
      html += '<a class="authoritybox-rbmo-btn authoritybox-rbmo-btn-wikipedia" href="' + escapeAttr(wikipediaInfo.url) + '" target="_blank" rel="noopener noreferrer">Ler mais na Wikipédia</a>';
      html += '</div>';
    }

    html += '<div class="authoritybox-rbmo-links authoritybox-rbmo-links-external">';

    externos.forEach(function (ext) {
      html += '<a class="authoritybox-rbmo-btn authoritybox-rbmo-btn-small" href="' + escapeAttr(ext.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(ext.label) + '</a>';
    });

    html += '</div>';
    html += '</article>';

    return html;
  }

  function construirCartaoSemWikidata(autor, principal) {
    if (!CONFIG.mostrarAutoresSemQID) return '';

    return (
      '<article class="authoritybox-rbmo-card authoritybox-rbmo-card-missing ' +
        (principal ? 'authoritybox-rbmo-card-main' : 'authoritybox-rbmo-card-compact') +
      '">' +
        '<div class="authoritybox-rbmo-top">' +
          '<div class="authoritybox-rbmo-photo authoritybox-rbmo-photo-empty">' +
            '<span>' + escapeHtml(iniciais(autor.nome)) + '</span>' +
          '</div>' +
          '<div class="authoritybox-rbmo-heading">' +
            '<div class="authoritybox-rbmo-name">' + escapeHtml(autor.nome) + '</div>' +
            renderPapeis(autor.papeis) +
            '<div class="authoritybox-rbmo-empty">' + escapeHtml(CONFIG.mensagemSemQID) + '</div>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderPapeis(papeis) {
    if (!papeis || !papeis.length) return '';

    return (
      '<div class="authoritybox-rbmo-roles">' +
        papeis.map(function (papel) {
          return '<span>' + escapeHtml(papel) + '</span>';
        }).join('') +
      '</div>'
    );
  }

  function obterTextoMultilingue(obj) {
    if (!obj) return '';

    for (const lang of CONFIG.langs) {
      if (obj[lang] && obj[lang].value) return obj[lang].value;
    }

    return '';
  }

  function obterDescricaoPT(entidade) {
    if (!entidade.descriptions) return '';
    if (entidade.descriptions.pt && entidade.descriptions.pt.value) return entidade.descriptions.pt.value;
    if (entidade.descriptions['pt-br'] && entidade.descriptions['pt-br'].value) return entidade.descriptions['pt-br'].value;
    if (entidade.descriptions.en && entidade.descriptions.en.value) return entidade.descriptions.en.value;
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

    const match = time.match(/^([+-])(\d{4,})-(\d{2})-(\d{2})/);
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
      return entidade.claims[prop][0].mainsnak.datavalue.value.id || '';
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
        .filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  async function obterLabels(ids) {
    const resultado = {};
    const porBuscar = ids.filter(function (id) {
      return id && !cacheLabels.has(id);
    });

    if (porBuscar.length) {
      try {
        const url =
          'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=' +
          encodeURIComponent(porBuscar.join('|')) +
          '&props=labels&languages=pt|pt-br|en|fr|es&format=json&origin=*';

        const response = await fetch(url);
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

          cacheLabels.set(id, label || id);
        });
      } catch (e) {
        console.warn('AuthorityBox: erro ao obter labels', e);
      }
    }

    ids.forEach(function (id) {
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
          const title = entidade.sitelinks[key].title;

          return {
            lang: lang,
            title: title,
            url: 'https://' + lang + '.wikipedia.org/wiki/' + encodeURIComponent(title.replace(/ /g, '_'))
          };
        }
      }
    }

    return {
      lang: 'pt',
      title: label,
      url: 'https://pt.wikipedia.org/w/index.php?search=' + encodeURIComponent(label)
    };
  }

  async function obterResumoWikipedia(wikipediaInfo) {
    if (!wikipediaInfo || !wikipediaInfo.lang || !wikipediaInfo.title) return null;

    const key = 'authoritybox_' + CONFIG.version + '_wp_' + wikipediaInfo.lang + '_' + wikipediaInfo.title;

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

      const response = await fetch(url);

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

      if (!extract) {
        cacheWikipedia.set(key, null);
        return null;
      }

      const resumo = {
        extract: extract,
        url: finalUrl,
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

  function obterIdentificadoresExternos(entidade, qid) {
    const resultado = [];

    CONFIG.externalIds.forEach(function (ext) {
      try {
        const valor = entidade.claims[ext.prop][0].mainsnak.datavalue.value;

        if (valor) {
          resultado.push({
            label: ext.label,
            url: ext.url.replace('$1', encodeURIComponent(String(valor).replace(/\s+/g, '')))
          });
        }
      } catch (e) {}
    });

    if (isValidQID(qid)) {
      resultado.push({
        label: 'Wikidata',
        url: 'https://www.wikidata.org/wiki/' + encodeURIComponent(qid)
      });
    }

    return resultado;
  }

  function imagemCommons(filename) {
    const normalizado = String(filename || '').replace(/ /g, '_');
    return 'https://commons.wikimedia.org/wiki/Special:Redirect/file/' + encodeURIComponent(normalizado);
  }

  function criarCaixa() {
    if (document.querySelector('#authoritybox-rbmo')) return;

    inserirEstilos();

    const html =
      '<aside id="authoritybox-rbmo" aria-label="Autores">' +
        '<div id="authoritybox-rbmo-header">' +
          '<span>' + escapeHtml(CONFIG.titulo) + '</span>' +
          '<span id="authoritybox-rbmo-count"></span>' +
        '</div>' +
        '<div id="authoritybox-rbmo-content"></div>' +
        '<div id="authoritybox-rbmo-source">' + CONFIG.notaFinal + '</div>' +
      '</aside>';

    const alvo = obterAlvoInsercao();
    alvo.insertAdjacentHTML('afterbegin', html);
  }

  function obterAlvoInsercao() {
    return (
      document.querySelector('#opac-detail-sidebar') ||
      document.querySelector('#action') ||
      document.querySelector('.col-lg-3') ||
      document.querySelector('.col-md-3') ||
      document.querySelector('#bibliodescriptions') ||
      document.querySelector('#catalogue_detail_biblio') ||
      document.body
    );
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
  padding:4px 14px 10px 14px;
}
.authoritybox-rbmo-section-title {
  margin:10px 0 0 0;
  color:#64748b;
  font-size:11px;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:0.04em;
}
.authoritybox-rbmo-card {
  padding:14px 0;
  border-bottom:1px solid #f0f0f0;
}
.authoritybox-rbmo-card:last-child {
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
  margin-top:6px;
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
.authoritybox-rbmo-empty {
  color:#6b7280;
  font-size:13px;
  font-style:italic;
  padding:3px 0;
}
.authoritybox-rbmo-card-missing {
  opacity:0.9;
}
.authoritybox-rbmo-accordion,
.authoritybox-rbmo-subaccordion {
  margin:10px 0 0 0;
  border:1px solid #e5e7eb;
  border-radius:12px;
  background:#ffffff;
  overflow:hidden;
}
.authoritybox-rbmo-accordion > summary,
.authoritybox-rbmo-subaccordion > summary {
  cursor:pointer;
  padding:9px 11px;
  font-size:12px;
  font-weight:700;
  color:#475569;
  background:#f8fafc;
  list-style:none;
}
.authoritybox-rbmo-accordion > summary::-webkit-details-marker,
.authoritybox-rbmo-subaccordion > summary::-webkit-details-marker {
  display:none;
}
.authoritybox-rbmo-accordion > summary::before,
.authoritybox-rbmo-subaccordion > summary::before {
  content:'▸';
  display:inline-block;
  margin-right:6px;
  transition:transform .15s ease;
}
.authoritybox-rbmo-accordion[open] > summary::before,
.authoritybox-rbmo-subaccordion[open] > summary::before {
  transform:rotate(90deg);
}
.authoritybox-rbmo-subaccordion {
  margin:9px 8px;
  border-color:#edf0f3;
}
.authoritybox-rbmo-subaccordion .authoritybox-rbmo-card {
  padding-left:10px;
  padding-right:10px;
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

  function isValidQID(qid) {
    return /^Q[1-9]\d*$/.test(String(qid || '').trim());
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

  function escapeAttr(str) {
    return escapeHtml(str);
  }

  function escapeRegExp(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

})();
