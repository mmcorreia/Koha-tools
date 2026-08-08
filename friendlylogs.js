/* ==============================================================
   USER FRIENDLY LOGS — Koha
   Versão melhorada: exemplares + registos bibliográficos
   ============================================================== */

(function () {
  'use strict';

  if (!location.href.includes('/cgi-bin/koha/tools/viewlog.pl')) return;

  /* --------------------------------------------------------------
     CONFIGURAÇÃO
     -------------------------------------------------------------- */

  const ITEM_FIELD_LABELS = {
    barcode: 'Código de barras',
    itemcallnumber: 'Cota',
    homebranch: 'Biblioteca de origem',
    holdingbranch: 'Biblioteca atual',
    location: 'Localização',
    permanent_location: 'Localização permanente',
    itype: 'Tipo de documento',
    ccode: 'Coleção',
    itemlost: 'Estado perdido/eliminado',
    damaged: 'Danificado',
    withdrawn: 'Retirado',
    notforloan: 'Não emprestável',
    restricted: 'Restrito',
    price: 'Preço',
    replacementprice: 'Preço de substituição',
    datelastborrowed: 'Último empréstimo',
    datelastseen: 'Última verificação',
    dateaccessioned: 'Data de entrada',
    issues: 'Total de empréstimos',
    renewals: 'Renovações',
    copynumber: 'N.º de cópia',
    enumchron: 'Enumeração/cronologia',
    materials: 'Materiais',
    itemnotes: 'Nota pública',
    itemnotes_nonpublic: 'Nota interna',
    public_note: 'Nota pública',
    cn_source: 'Fonte da cota',
    cn_sort: 'Cota normalizada',
    uri: 'URI',
    itemnumber: 'N.º interno do exemplar'
  };

  const ITEM_API_MAP = {
    barcode: ['external_id', 'barcode'],
    itemcallnumber: ['callnumber', 'itemcallnumber'],
    homebranch: ['home_library_id', 'homebranch'],
    holdingbranch: ['holding_library_id', 'holdingbranch'],
    location: ['location'],
    permanent_location: ['permanent_location'],
    itype: ['item_type_id', 'itype'],
    ccode: ['collection_code', 'ccode'],
    itemlost: ['lost_status', 'itemlost'],
    damaged: ['damaged_status', 'damaged'],
    withdrawn: ['withdrawn'],
    notforloan: ['not_for_loan_status', 'notforloan'],
    restricted: ['restricted_status', 'restricted'],
    price: ['purchase_price', 'price'],
    replacementprice: ['replacement_price', 'replacementprice'],
    datelastborrowed: ['last_checkout_date', 'datelastborrowed'],
    datelastseen: ['last_seen_date', 'datelastseen'],
    dateaccessioned: ['acquisition_date', 'dateaccessioned'],
    issues: ['checkouts_count', 'issues'],
    renewals: ['renewals_count', 'renewals'],
    copynumber: ['copy_number', 'copynumber'],
    enumchron: ['serial_issue_number', 'enumchron'],
    materials: ['materials_notes', 'materials'],
    itemnotes: ['public_notes', 'itemnotes'],
    itemnotes_nonpublic: ['internal_notes', 'itemnotes_nonpublic'],
    public_note: ['public_note'],
    cn_source: ['call_number_source', 'cn_source'],
    cn_sort: ['call_number_sort', 'cn_sort'],
    uri: ['uri'],
    itemnumber: ['item_id', 'itemnumber']
  };

  const ITEM_DISPLAY_FIELDS = [
    'barcode',
    'itemcallnumber',
    'homebranch',
    'holdingbranch',
    'location',
    'permanent_location',
    'itype',
    'ccode',
    'itemlost',
    'damaged',
    'withdrawn',
    'notforloan',
    'restricted',
    'dateaccessioned',
    'datelastborrowed',
    'datelastseen',
    'issues',
    'renewals',
    'price',
    'replacementprice',
    'copynumber',
    'enumchron',
    'materials',
    'itemnotes',
    'itemnotes_nonpublic',
    'public_note',
    'cn_source',
    'cn_sort',
    'uri',
    'itemnumber'
  ];

  const STATE_TRANSLATIONS = {
    itemlost: {
      '0': 'Não está perdido',
      '1': 'Perdido',
      '2': 'Perdido e pago',
      '3': 'Eliminado',
      '4': 'Em falta'
    },
    damaged: {
      '0': 'Não danificado',
      '1': 'Danificado'
    },
    withdrawn: {
      '0': 'Não retirado',
      '1': 'Retirado'
    },
    notforloan: {
      '0': 'Emprestável',
      '1': 'Não emprestável'
    }
  };

  /*
   * Etiquetas UNIMARC mais úteis para leitura humana.
   * As restantes aparecem como "campo $subcampo".
   */
  const UNIMARC_LABELS = {
    '001': 'Identificador do registo',
    '005': 'Data/hora da última transação',
    '010': 'ISBN',
    '011': 'ISSN',
    '100': 'Dados gerais de processamento',
    '101': 'Língua da publicação',
    '102': 'País de publicação',
    '105': 'Dados codificados — monografias',
    '200': 'Título e menção de responsabilidade',
    '205': 'Menção de edição',
    '210': 'Publicação, distribuição, etc.',
    '214': 'Publicação, produção, distribuição, etc.',
    '215': 'Descrição física',
    '225': 'Coleção',
    '300': 'Nota geral',
    '304': 'Nota de título e responsabilidade',
    '305': 'Nota de edição e história bibliográfica',
    '320': 'Nota de bibliografia/índices',
    '327': 'Nota de conteúdo',
    '330': 'Resumo',
    '454': 'Tradução de',
    '461': 'Conjunto',
    '463': 'Parte',
    '464': 'Analítica',
    '500': 'Título uniforme',
    '600': 'Nome de pessoa como assunto',
    '601': 'Nome de coletividade como assunto',
    '602': 'Nome de família como assunto',
    '606': 'Nome comum como assunto',
    '607': 'Nome geográfico como assunto',
    '608': 'Forma/género',
    '610': 'Termo de indexação não controlado',
    '675': 'CDU',
    '676': 'CDD',
    '700': 'Responsabilidade principal — pessoa',
    '701': 'Responsabilidade alternativa — pessoa',
    '702': 'Responsabilidade secundária — pessoa',
    '710': 'Responsabilidade principal — coletividade',
    '711': 'Responsabilidade alternativa — coletividade',
    '712': 'Responsabilidade secundária — coletividade',
    '856': 'Localização e acesso eletrónico',
    '966': 'Dados locais',
    '995': 'Exemplar/local — campo local'
  };

  /* --------------------------------------------------------------
     UTILITÁRIOS
     -------------------------------------------------------------- */

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  function clean(value) {
    value = String(value ?? '').trim();
    if (!value || value === 'undef' || value === 'null') return '';
    return value.replace(/^'|'$/g, '').trim();
  }

  function normalise(value) {
    value = clean(value);
    if (value === '') return '';

    if (/^-?\d+(\.0+)?$/.test(value)) {
      return String(parseInt(value, 10));
    }

    if (/^-?\d+\.\d+$/.test(value)) {
      return String(parseFloat(value));
    }

    return value
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  function comparable(value) {
    return normalise(value)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function displayValue(value) {
    const v = normalise(value);
    return v === '' ? '—' : v;
  }

  function translateItemValue(key, value) {
    const v = displayValue(value);

    if (v === '—') return v;

    if (STATE_TRANSLATIONS[key] && STATE_TRANSLATIONS[key][v] !== undefined) {
      return STATE_TRANSLATIONS[key][v];
    }

    return v;
  }

  function dedupeRows(rows) {
    const seen = new Set();
    const out = [];

    (rows || []).forEach(function (row) {
      const key = [
        String(row.code || row.field || '').toLowerCase(),
        comparable(row.before),
        comparable(row.after)
      ].join('|');

      if (seen.has(key)) return;
      seen.add(key);
      out.push(row);
    });

    return out;
  }

  function canonicalItemKey(key) {
    const aliases = {
      public_note: 'itemnotes',
      itemnotes_nonpublic: 'itemnotes_nonpublic',
      cn_sort: 'cn_sort',
      cn_source: 'cn_source'
    };
    return aliases[key] || key;
  }

  function parsePerlHash(text) {
    const data = {};

    /*
     * Suporta valores simples produzidos pelo Data::Dumper.
     * Não tenta interpretar estruturas Perl aninhadas.
     */
    const re = /'([^']+)'\s*=>\s*(undef|null|'(?:\\.|[^'])*'|-?\d+(?:\.\d+)?)/g;
    let match;

    while ((match = re.exec(text)) !== null) {
      let value = match[2];

      if (/^'/.test(value)) {
        value = value
          .slice(1, -1)
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, '\\')
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t');
      }

      data[match[1]] = clean(value);
    }

    return data;
  }

  function firstDefined(obj, keys) {
    if (!obj) return '';

    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null) {
        return obj[key];
      }
    }

    return '';
  }

  function objectLinkHref(objectCell) {
    return objectCell.find('a').first().attr('href') || '';
  }

  function extractItemnumber(raw, objectCell) {
    const fromHash = parsePerlHash(raw).itemnumber;
    if (fromHash) return fromHash;

    const href = objectLinkHref(objectCell);
    let m = href.match(/(?:itemnumber|item_id)=([0-9]+)/i);
    if (m) return m[1];

    const text = objectCell.text();
    m = text.match(/(?:Exemplar|Item)\s+([0-9]+)/i);
    if (m) return m[1];

    m = raw.match(/['"]?(?:itemnumber|item_id)['"]?\s*(?:=>|:|=)\s*['"]?([0-9]+)/i);
    if (m) return m[1];

    return '';
  }

  function extractBiblionumber(raw, objectCell) {
    const hash = parsePerlHash(raw);
    if (hash.biblionumber) return hash.biblionumber;
    if (hash.biblio_id) return hash.biblio_id;

    const href = objectLinkHref(objectCell);

    const patterns = [
      /[?&]biblionumber=([0-9]+)/i,
      /[?&]biblio(?:_id)?=([0-9]+)/i,
      /detail\.pl\?biblionumber=([0-9]+)/i
    ];

    for (const re of patterns) {
      const m = href.match(re);
      if (m) return m[1];
    }

    const text = objectCell.text();
    let m = text.match(/(?:Registo|Biblio(?:gr[aá]fico)?|Bibliographic record)\s+([0-9]+)/i);
    if (m) return m[1];

    m = raw.match(/['"]?(?:biblionumber|biblio_id)['"]?\s*(?:=>|:|=)\s*['"]?([0-9]+)/i);
    if (m) return m[1];

    return '';
  }

  function detectLogType(raw, objectCell, moduleText) {
    const href = objectLinkHref(objectCell);
    const objectText = objectCell.text().trim();

    if (
      /\bitem\s+\$VAR/i.test(raw) ||
      /\bitemnumber\b/i.test(raw) ||
      /(?:itemnumber|item_id)=/i.test(href) ||
      /\bExemplar\s+\d+/i.test(objectText)
    ) {
      return 'item';
    }

    if (
      /\bbiblio(?:graphic)?\s+\$VAR/i.test(raw) ||
      /\bbiblionumber\b/i.test(raw) ||
      /\bmarcxml\b/i.test(raw) ||
      /biblionumber=/i.test(href) ||
      /\bRegisto\s+\d+/i.test(objectText) ||
      (/cat[aá]logo/i.test(moduleText) && /\d+/.test(objectText))
    ) {
      return 'biblio';
    }

    return 'generic';
  }

  /* --------------------------------------------------------------
     EXEMPLARES
     -------------------------------------------------------------- */

  function valueFromCurrentItem(current, key) {
    if (!current) return '';

    const possibleKeys = ITEM_API_MAP[key] || [key];
    return firstDefined(current, possibleKeys);
  }

  async function fetchCurrentItem(itemnumber) {
    if (!itemnumber) return null;

    const urls = [
      `/api/v1/items/${encodeURIComponent(itemnumber)}`,
      `/api/v1/public/items/${encodeURIComponent(itemnumber)}`
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          credentials: 'same-origin',
          headers: { Accept: 'application/json' }
        });

        if (response.ok) {
          return await response.json();
        }
      } catch (e) {}
    }

    return null;
  }

  function buildItemRows(logSnapshot, current) {
    const rows = [];
    const emitted = new Set();

    if (!current) return rows;

    ITEM_DISPLAY_FIELDS.forEach(function (key) {
      const canonical = canonicalItemKey(key);
      if (emitted.has(canonical)) return;

      const logRaw = logSnapshot[key];
      const currentRaw = valueFromCurrentItem(current, key);

      const logExists = logRaw !== undefined && logRaw !== null;

      // Só mostrar campos que o próprio evento do log contém.
      // Um campo ausente no log NÃO significa que nesse evento tenha passado
      // de vazio para o valor atual; significa apenas que o Koha não o registou
      // nesse evento.
      if (!logExists) return;

      if (comparable(logRaw) === comparable(currentRaw)) return;

      emitted.add(canonical);

      rows.push({
        field: ITEM_FIELD_LABELS[key] || key,
        code: canonical,
        before: translateItemValue(key, logRaw),
        after: translateItemValue(key, currentRaw)
      });
    });

    return dedupeRows(rows);
  }

  /* --------------------------------------------------------------
     BIBLIOGRÁFICOS / MARC
     -------------------------------------------------------------- */

  function decodeHtmlEntities(text) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    return textarea.value;
  }

  function extractMarcXmlFromRaw(raw) {
    if (!raw) return '';

    let text = decodeHtmlEntities(raw);

    /*
     * 1. XML MARC completo diretamente no log.
     */
    let m = text.match(/<(?:record|marc:record)\b[\s\S]*?<\/(?:record|marc:record)>/i);
    if (m) return m[0];

    /*
     * 2. Valor "marcxml => '...'" dentro de Data::Dumper.
     */
    m = text.match(/['"]marcxml['"]\s*=>\s*'((?:\\.|[^'])*)'/i);
    if (m) {
      return m[1]
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\\\/g, '\\');
    }

    return '';
  }

  function marcXmlToFields(xmlText) {
    if (!xmlText) return null;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');

      if (doc.querySelector('parsererror')) return null;

      const record =
        doc.querySelector('record') ||
        doc.getElementsByTagNameNS('*', 'record')[0];

      if (!record) return null;

      const fields = [];

      const leader =
        record.querySelector('leader') ||
        record.getElementsByTagNameNS('*', 'leader')[0];

      if (leader) {
        fields.push({
          tag: 'LDR',
          ind1: '',
          ind2: '',
          subfields: [],
          value: leader.textContent || ''
        });
      }

      Array.from(record.children).forEach(function (node) {
        const localName = node.localName || node.nodeName.replace(/^.*:/, '');

        if (localName === 'controlfield') {
          fields.push({
            tag: node.getAttribute('tag') || '',
            ind1: '',
            ind2: '',
            subfields: [],
            value: node.textContent || ''
          });
        }

        if (localName === 'datafield') {
          const subfields = Array.from(node.children)
            .filter(function (sub) {
              return (sub.localName || '').toLowerCase() === 'subfield';
            })
            .map(function (sub) {
              return {
                code: sub.getAttribute('code') || '',
                value: sub.textContent || ''
              };
            });

          fields.push({
            tag: node.getAttribute('tag') || '',
            ind1: node.getAttribute('ind1') || ' ',
            ind2: node.getAttribute('ind2') || ' ',
            subfields: subfields,
            value: ''
          });
        }
      });

      return fields;
    } catch (e) {
      return null;
    }
  }

  function marcInJsonToFields(data) {
    if (!data) return null;

    let record = data;

    /*
     * Alguns endpoints podem devolver o registo dentro de uma propriedade.
     */
    if (data.record) record = data.record;
    if (data.marc) record = data.marc;

    if (!record || !Array.isArray(record.fields)) return null;

    const fields = [];

    if (record.leader !== undefined) {
      fields.push({
        tag: 'LDR',
        ind1: '',
        ind2: '',
        subfields: [],
        value: String(record.leader ?? '')
      });
    }

    record.fields.forEach(function (entry) {
      if (!entry || typeof entry !== 'object') return;

      const tag = Object.keys(entry)[0];
      if (!tag) return;

      const value = entry[tag];

      if (typeof value === 'string' || typeof value === 'number') {
        fields.push({
          tag: tag,
          ind1: '',
          ind2: '',
          subfields: [],
          value: String(value)
        });
        return;
      }

      if (value && typeof value === 'object') {
        const subfields = [];

        if (Array.isArray(value.subfields)) {
          value.subfields.forEach(function (sub) {
            if (!sub || typeof sub !== 'object') return;
            const code = Object.keys(sub)[0];
            if (!code) return;

            subfields.push({
              code: code,
              value: String(sub[code] ?? '')
            });
          });
        }

        fields.push({
          tag: tag,
          ind1: String(value.ind1 ?? ' '),
          ind2: String(value.ind2 ?? ' '),
          subfields: subfields,
          value: ''
        });
      }
    });

    return fields;
  }

  async function responseToMarc(response) {
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const body = await response.text();

    if (!body) return null;

    if (contentType.includes('json') || /^[\s]*[\{\[]/.test(body)) {
      try {
        const json = JSON.parse(body);

        /*
         * API pode devolver MARC-in-JSON.
         */
        const marcJson = marcInJsonToFields(json);
        if (marcJson) {
          return {
            fields: marcJson,
            rawObject: json
          };
        }

        /*
         * Ou um objeto bibliográfico com marcxml.
         */
        const xml =
          json.marcxml ||
          json.marc_xml ||
          (json.record && json.record.marcxml) ||
          '';

        const xmlFields = marcXmlToFields(xml);
        if (xmlFields) {
          return {
            fields: xmlFields,
            rawObject: json
          };
        }

        /*
         * Mesmo sem MARC, guardamos o objeto para comparação básica.
         */
        return {
          fields: null,
          rawObject: json
        };
      } catch (e) {}
    }

    const xmlFields = marcXmlToFields(body);
    if (xmlFields) {
      return {
        fields: xmlFields,
        rawObject: null
      };
    }

    return null;
  }

  async function fetchCurrentBiblio(biblionumber) {
    if (!biblionumber) return null;

    const id = encodeURIComponent(biblionumber);

    /*
     * Tentamos primeiro a REST API, em vários formatos.
     * Depois usamos o exportador bibliográfico do interface dos técnicos,
     * que costuma ser um bom fallback para obter MARCXML.
     */
    const attempts = [
      {
        url: `/api/v1/biblios/${id}`,
        accept: 'application/marc-in-json'
      },
      {
        url: `/api/v1/biblios/${id}`,
        accept: 'application/marcxml+xml'
      },
      {
        url: `/api/v1/biblios/${id}`,
        accept: 'application/json'
      },
      {
        url: `/cgi-bin/koha/catalogue/export.pl?op=export&format=xml&bib=${id}`,
        accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8'
      }
    ];

    for (const attempt of attempts) {
      try {
        const response = await fetch(attempt.url, {
          credentials: 'same-origin',
          headers: { Accept: attempt.accept }
        });

        if (!response.ok) continue;

        const parsed = await responseToMarc(response);

        if (parsed && (parsed.fields || parsed.rawObject)) {
          return parsed;
        }
      } catch (e) {}
    }

    return null;
  }

  function fieldSignature(field) {
    if (!field) return '';

    if (!field.subfields || !field.subfields.length) {
      return `${field.tag}|${normalise(field.value)}`;
    }

    const subs = field.subfields
      .map(function (sub) {
        return `$${sub.code} ${normalise(sub.value)}`;
      })
      .join(' | ');

    return `${field.tag}|${field.ind1 || ' '}|${field.ind2 || ' '}|${subs}`;
  }

  function displayMarcField(field) {
    if (!field) return '—';

    if (!field.subfields || !field.subfields.length) {
      return displayValue(field.value);
    }

    return field.subfields
      .map(function (sub) {
        return `$${sub.code} ${displayValue(sub.value)}`;
      })
      .join('  ');
  }

  function marcFieldLabel(field) {
    const tag = field?.tag || '';
    const base = UNIMARC_LABELS[tag] || `Campo ${tag}`;

    if (field?.subfields?.length === 1) {
      return `${base} — ${tag} $${field.subfields[0].code}`;
    }

    return `${base} — ${tag}`;
  }

  function groupFieldsByTag(fields) {
    const map = new Map();

    (fields || []).forEach(function (field) {
      if (!map.has(field.tag)) map.set(field.tag, []);
      map.get(field.tag).push(field);
    });

    return map;
  }

  function occurrenceKey(field) {
    /*
     * Assinatura sem valores: ajuda a emparelhar ocorrências repetidas
     * do mesmo campo pela estrutura de indicadores/subcampos.
     */
    return [
      field.tag,
      field.ind1 || '',
      field.ind2 || '',
      (field.subfields || []).map(s => s.code).join('')
    ].join('|');
  }

  function pairRepeatedFields(oldList, newList) {
    const pairs = [];
    const usedNew = new Set();

    /*
     * 1.º tenta encontrar uma ocorrência exatamente igual.
     */
    oldList.forEach(function (oldField, oldIndex) {
      const sig = fieldSignature(oldField);
      const exactIndex = newList.findIndex(function (newField, index) {
        return !usedNew.has(index) && fieldSignature(newField) === sig;
      });

      if (exactIndex >= 0) {
        usedNew.add(exactIndex);
        pairs.push({ oldField, newField: newList[exactIndex], unchanged: true });
      } else {
        pairs.push({ oldField, newField: null, unchanged: false, oldIndex });
      }
    });

    /*
     * 2.º para as restantes, tenta emparelhar pela estrutura.
     */
    pairs.forEach(function (pair) {
      if (pair.newField || pair.unchanged) return;

      const structure = occurrenceKey(pair.oldField);
      const structureIndex = newList.findIndex(function (newField, index) {
        return !usedNew.has(index) && occurrenceKey(newField) === structure;
      });

      if (structureIndex >= 0) {
        usedNew.add(structureIndex);
        pair.newField = newList[structureIndex];
      }
    });

    /*
     * 3.º se ainda houver ocorrências sem par, emparelha pela ordem.
     */
    pairs.forEach(function (pair) {
      if (pair.newField || pair.unchanged) return;

      const fallbackIndex = newList.findIndex(function (_newField, index) {
        return !usedNew.has(index);
      });

      if (fallbackIndex >= 0) {
        usedNew.add(fallbackIndex);
        pair.newField = newList[fallbackIndex];
      }
    });

    /*
     * 4.º campos atuais novos.
     */
    newList.forEach(function (newField, index) {
      if (!usedNew.has(index)) {
        pairs.push({ oldField: null, newField, unchanged: false });
      }
    });

    return pairs;
  }

  function buildMarcRows(oldFields, currentFields) {
    if (!oldFields || !currentFields) return [];

    const rows = [];
    const oldMap = groupFieldsByTag(oldFields);
    const newMap = groupFieldsByTag(currentFields);
    const tags = Array.from(new Set([
      ...oldMap.keys(),
      ...newMap.keys()
    ])).sort();

    tags.forEach(function (tag) {
      const oldList = oldMap.get(tag) || [];
      const newList = newMap.get(tag) || [];

      pairRepeatedFields(oldList, newList).forEach(function (pair) {
        if (pair.unchanged) return;

        const oldValue = pair.oldField ? displayMarcField(pair.oldField) : '—';
        const newValue = pair.newField ? displayMarcField(pair.newField) : '—';

        if (comparable(oldValue) === comparable(newValue)) return;

        rows.push({
          field: marcFieldLabel(pair.oldField || pair.newField),
          code: tag,
          before: oldValue,
          after: newValue
        });
      });
    });

    return dedupeRows(rows);
  }

  function buildBasicBiblioRows(logSnapshot, currentObject) {
    if (!currentObject) return [];

    /*
     * Fallback para instalações em que o log não contém MARCXML,
     * mas contém os campos da tabela biblio/biblioitems.
     */
    const mappings = [
      ['title', ['title'], 'Título'],
      ['subtitle', ['subtitle'], 'Subtítulo'],
      ['author', ['author'], 'Autor'],
      ['medium', ['medium'], 'Suporte'],
      ['frameworkcode', ['framework_id', 'frameworkcode'], 'Grelha bibliográfica'],
      ['isbn', ['isbn'], 'ISBN'],
      ['issn', ['issn'], 'ISSN'],
      ['publishercode', ['publisher', 'publishercode'], 'Editor'],
      ['publicationyear', ['publication_year', 'publicationyear'], 'Ano de publicação'],
      ['pages', ['pages'], 'Descrição física']
    ];

    const rows = [];

    mappings.forEach(function ([oldKey, newKeys, label]) {
      if (logSnapshot[oldKey] === undefined) return;

      const beforeRaw = logSnapshot[oldKey];
      const afterRaw = firstDefined(currentObject, newKeys);

      if (comparable(beforeRaw) === comparable(afterRaw)) return;

      rows.push({
        field: label,
        code: oldKey,
        before: displayValue(beforeRaw),
        after: displayValue(afterRaw)
      });
    });

    return dedupeRows(rows);
  }

  /* --------------------------------------------------------------
     RENDERIZAÇÃO
     -------------------------------------------------------------- */

  function renderDiffTable(rows, options = {}) {
    const leftTitle = options.leftTitle || 'Valor no log';
    const rightTitle = options.rightTitle || 'Valor atual';

    if (!rows.length) {
      return `
        <div class="klog-empty">
          Não foram detetadas diferenças nos dados que foi possível comparar.
        </div>
      `;
    }

    let html = `
      <div class="klog-diff-grid">
        <div class="klog-diff-head">Campo</div>
        <div class="klog-diff-head">${esc(leftTitle)}</div>
        <div class="klog-diff-head">${esc(rightTitle)}</div>
    `;

    rows.forEach(function (row) {
      html += `
        <div class="klog-diff-field">
          <span class="klog-field-label">${esc(row.field)}</span>
          ${row.code ? `<span class="klog-field-code">${esc(row.code)}</span>` : ''}
        </div>
        <div class="klog-diff-value">${esc(row.before)}</div>
        <div class="klog-diff-value klog-diff-current">${esc(row.after)}</div>
      `;
    });

    html += `</div>`;

    return html;
  }

  function renderLoading(title, subtitle) {
    return `
      <div class="klog-card klog-card-loading">
        <div class="klog-title">${esc(title)}</div>
        <div class="klog-subtitle">${esc(subtitle)}</div>
      </div>
    `;
  }

  function renderTechnical(raw) {
    return `
      <details class="klog-tech">
        <summary>Ver dados técnicos originais</summary>
        <pre>${esc(raw)}</pre>
      </details>
    `;
  }

  function renderItemCard(raw, action, currentItem) {
    const logSnapshot = parsePerlHash(raw);
    const rows = buildItemRows(logSnapshot, currentItem);

    let title = 'Exemplar modificado';
    if (/adicionar|add/i.test(action)) title = 'Exemplar adicionado';
    if (/eliminar|delete/i.test(action)) title = 'Exemplar eliminado';

    const barcode =
      logSnapshot.barcode ||
      valueFromCurrentItem(currentItem, 'barcode');

    const callnumber =
      logSnapshot.itemcallnumber ||
      valueFromCurrentItem(currentItem, 'itemcallnumber');

    let subtitle = 'Evento registado no Koha.';

    if (barcode && callnumber) {
      subtitle = `Exemplar ${esc(barcode)}, cota ${esc(callnumber)}.`;
    } else if (barcode) {
      subtitle = `Exemplar ${esc(barcode)}.`;
    } else if (callnumber) {
      subtitle = `Exemplar com cota ${esc(callnumber)}.`;
    }

    let body = '';

    if (!currentItem) {
      body = `
        <div class="klog-note">
          Não foi possível obter o estado atual do exemplar. O log original continua disponível abaixo.
        </div>
      `;
    } else {
      body = renderDiffTable(rows);
    }

    return `
      <div class="klog-card">
        <div class="klog-header">
          <div class="klog-title">${esc(title)}</div>
          <div class="klog-subtitle">${subtitle}</div>
        </div>

        ${body}

        <div class="klog-context-note">
          Mostram-se apenas os campos presentes neste evento do log e cujo valor difere do estado atual.
        </div>

        ${renderTechnical(raw)}
      </div>
    `;
  }

  function renderBiblioCard(raw, action, objectText, biblionumber, currentBiblio) {
    const logSnapshot = parsePerlHash(raw);
    const oldMarcXml = extractMarcXmlFromRaw(raw);
    const oldFields = marcXmlToFields(oldMarcXml);

    const currentFields = currentBiblio?.fields || null;
    const currentObject = currentBiblio?.rawObject || null;

    let rows = [];
    let comparisonMode = '';

    if (oldFields && currentFields) {
      rows = buildMarcRows(oldFields, currentFields);
      comparisonMode = 'marc';
    } else if (currentObject) {
      rows = buildBasicBiblioRows(logSnapshot, currentObject);
      comparisonMode = rows.length ? 'basic' : '';
    }

    let title = 'Registo bibliográfico modificado';
    if (/adicionar|add/i.test(action)) title = 'Registo bibliográfico adicionado';
    if (/eliminar|delete/i.test(action)) title = 'Registo bibliográfico eliminado';

    const subtitle = biblionumber
      ? `Registo bibliográfico ${esc(biblionumber)}.`
      : esc(objectText || 'Registo bibliográfico');

    let body = '';

    if (!currentBiblio) {
      body = `
        <div class="klog-note">
          O registo bibliográfico foi reconhecido, mas não foi possível obter o seu estado atual através da API/exportação do Koha.
        </div>
      `;
    } else if (comparisonMode === 'marc') {
      body = renderDiffTable(rows);
    } else if (comparisonMode === 'basic') {
      body = `
        <div class="klog-mode-note">
          O log não contém um registo MARC completo. Foi feita uma comparação dos campos bibliográficos simples disponíveis.
        </div>
        ${renderDiffTable(rows)}
      `;
    } else {
      body = `
        <div class="klog-note">
          O registo bibliográfico foi reconhecido, mas este evento não contém informação MARC anterior suficiente para reconstruir automaticamente uma tabela de diferenças.
        </div>
      `;
    }

    return `
      <div class="klog-card">
        <div class="klog-header">
          <div class="klog-title">${esc(title)}</div>
          <div class="klog-subtitle">${subtitle}</div>
        </div>

        ${body}

        <div class="klog-context-note">
          Quando o log contém MARCXML, a comparação é feita campo a campo com o registo bibliográfico atual.
        </div>

        ${renderTechnical(raw)}
      </div>
    `;
  }

  function renderGenericCard(raw, action, objectText) {
    return `
      <div class="klog-card">
        <div class="klog-header">
          <div class="klog-title">${esc(objectText || 'Registo')}</div>
          <div class="klog-subtitle">Evento de ${esc(String(action || '').toLowerCase())} registado no Koha.</div>
        </div>

        <div class="klog-empty">
          Este tipo de log ainda não contém informação suficiente para uma interpretação estruturada.
        </div>

        ${renderTechnical(raw)}
      </div>
    `;
  }


  function naturaliseInterface(row) {
    const cells = row.find('td');
    if (cells.length < 7) return;

    const technicianCell = cells.eq(1);
    const interfaceCell = cells.eq(6);

    const technicianText = technicianCell.text().trim();
    const interfaceText = interfaceCell.text().trim();

    /*
     * Mantém as restantes colunas intactas.
     * A única alteração é tornar a coluna "Interface" mais natural.
     *
     * Regra principal:
     * - user 0 / sem técnico identificável -> Sistema
     * - intranet/staff -> Técnico
     * - OPAC -> OPAC
     * - API -> API
     * - SIP2 -> SIP2
     * - cron/script -> Sistema
     * - caso desconhecido -> mantém o texto original
     */

    const userIdMatch = technicianText.match(/\((\d+)\)\s*$/);
    const userId = userIdMatch ? userIdMatch[1] : '';

    const lowerInterface = interfaceText.toLowerCase();
    const lowerTechnician = technicianText.toLowerCase();

    let natural = interfaceText;

    const isSystem =
      userId === '0' ||
      !technicianText ||
      /^(0|sistema|system|koha)$/i.test(technicianText) ||
      /cron|script|command.?line|background|worker|job/i.test(lowerInterface);

    if (isSystem) {
      natural = 'Sistema';
    } else if (/sip2/i.test(lowerInterface)) {
      natural = 'SIP2';
    } else if (/\bapi\b/i.test(lowerInterface)) {
      natural = 'API';
    } else if (/opac/i.test(lowerInterface)) {
      natural = 'OPAC';
    } else if (
      /interface dos t[eé]cnicos/i.test(lowerInterface) ||
      /intranet|staff/i.test(lowerInterface)
    ) {
      natural = 'Técnico';
    }

    if (natural && natural !== interfaceText) {
      interfaceCell.text(natural);
      interfaceCell.attr('title', interfaceText);
    }
  }

  /* --------------------------------------------------------------
     PROCESSAMENTO DA TABELA
     -------------------------------------------------------------- */

  async function enhanceRow(row) {
    if (row.data('klog-diff')) return;

    naturaliseInterface(row);

    const cells = row.find('td');
    if (cells.length < 6) return;

    const moduleText = cells.eq(2).text().trim();
    const action = cells.eq(3).text().trim();
    const objectCell = cells.eq(4);
    const objectText = objectCell.text().trim();
    const infoCell = cells.eq(5);

    const raw = infoCell.text().trim();
    if (!raw) return;

    row.data('klog-diff', true);

    const type = detectLogType(raw, objectCell, moduleText);

    if (type === 'item') {
      infoCell.html(
        renderLoading(
          'A interpretar alteração de exemplar...',
          'A obter o estado atual do exemplar.'
        )
      );

      const itemnumber = extractItemnumber(raw, objectCell);
      const currentItem = await fetchCurrentItem(itemnumber);

      infoCell.html(
        renderItemCard(raw, action, currentItem)
      );

      return;
    }

    if (type === 'biblio') {
      infoCell.html(
        renderLoading(
          'A interpretar alteração bibliográfica...',
          'A obter o registo bibliográfico atual.'
        )
      );

      const biblionumber = extractBiblionumber(raw, objectCell);
      const currentBiblio = await fetchCurrentBiblio(biblionumber);

      infoCell.html(
        renderBiblioCard(
          raw,
          action,
          objectText,
          biblionumber,
          currentBiblio
        )
      );

      return;
    }

    infoCell.html(
      renderGenericCard(raw, action, objectText)
    );
  }

  function enhance() {
    const table = $('table').filter(function () {
      return $(this).find('th').filter(function () {
        return $(this).text().trim() === 'Info';
      }).length;
    }).first();

    if (!table.length) return;

    table.find('tbody tr').each(function () {
      enhanceRow($(this));
    });
  }

  /* --------------------------------------------------------------
     CSS
     -------------------------------------------------------------- */

  function injectCss() {
    if ($('#klog-diff-css').length) return;

    $('head').append(`
      <style id="klog-diff-css">
        table td:nth-child(6) {
          min-width: 540px;
          max-width: 780px;
          vertical-align: top;
        }

        .klog-card {
          background: #fff;
          border: 1px solid #d9d9d9;
          border-radius: 4px;
          padding: 8px 10px;
          font-size: 12px;
          line-height: 1.35;
          color: #333;
          max-width: 760px;
        }

        .klog-card + .klog-card {
          margin-top: 6px;
        }

        .klog-header {
          margin-bottom: 6px;
        }

        .klog-title {
          font-weight: 700;
          font-size: 12.5px;
          color: #333;
          margin: 0 0 2px 0;
        }

        .klog-subtitle,
        .klog-loading,
        .klog-empty,
        .klog-note,
        .klog-mode-note,
        .klog-context-note {
          color: #555;
          font-size: 11.5px;
        }

        .klog-diff-grid {
          display: grid;
          grid-template-columns: minmax(170px, 31%) minmax(0, 34.5%) minmax(0, 34.5%);
          margin-top: 6px;
          border-top: 1px solid #ddd;
          border-left: 1px solid #ddd;
          font-size: 11px;
          line-height: 1.25;
          background: #fff;
        }

        .klog-diff-head,
        .klog-diff-field,
        .klog-diff-value {
          min-width: 0;
          padding: 4px 6px;
          border-right: 1px solid #ddd;
          border-bottom: 1px solid #ddd;
        }

        .klog-diff-head {
          background: #f5f5f5;
          color: #333;
          font-weight: 700;
        }

        .klog-diff-field {
          background: #fafafa;
        }

        .klog-diff-value {
          background: #fff;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .klog-diff-current {
          background: #fcf8e3;
        }

        .klog-field-label {
          display: inline;
          font-weight: 600;
          color: #333;
        }

        .klog-field-code {
          display: inline;
          margin-left: 4px;
          color: #888;
          font-size: 10px;
          font-family: monospace;
          font-weight: 400;
        }

        .klog-note,
        .klog-mode-note,
        .klog-empty {
          margin-top: 6px;
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          background: #fafafa;
        }

        .klog-note {
          background: #fcf8e3;
          border-color: #eedc94;
        }

        .klog-mode-note {
          background: #f5f5f5;
        }

        .klog-context-note {
          margin-top: 6px;
          color: #666;
          font-size: 10.5px;
          line-height: 1.3;
        }

        .klog-tech {
          margin-top: 6px;
          padding-top: 5px;
          border-top: 1px solid #eee;
        }

        .klog-tech summary {
          cursor: pointer;
          color: #006699;
          font-size: 11px;
          font-weight: 600;
        }

        .klog-tech pre {
          margin-top: 6px;
          background: #f9f9f9;
          border: 1px solid #ddd;
          border-radius: 3px;
          padding: 6px 8px;
          max-height: 180px;
          overflow: auto;
          white-space: pre-wrap;
          font-size: 10.5px;
          line-height: 1.35;
          color: #444;
        }
      </style>
    `);
  }

  $(document).ready(function () {
    injectCss();
    enhance();
  });

})();
