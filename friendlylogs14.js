/* ==============================================================
   INTRANET_CATALOGUING_CHANGES
   Versão 1.0
   Autor: Miguel Mimoso Correia

   Finalidade
   ----------
   Melhora a leitura das alterações de catalogação registadas pelo
   Koha no interface dos técnicos, apresentando de forma amigável
   o estado Antes / Depois de alterações a registos bibliográficos
   e exemplares.

   Página-alvo
   -----------
   /cgi-bin/koha/tools/viewlog.pl

   Âmbito
   ------
   - Registos bibliográficos.
   - Exemplares.
   - Eventos ADD, MODIFY e DELETE registados pelo CataloguingLog.

   Principais funcionalidades
   --------------------------
   - Identifica eventos relativos a exemplares e registos bibliográficos.
   - Reconstrói, sempre que possível, o estado imediatamente anterior e
     posterior de cada evento através do histórico de action_logs.
   - Usa o estado atual apenas como fallback quando o histórico não permite
     reconstruir o evento de forma segura.
   - Traduz campos e estados técnicos para designações legíveis.
   - Obtém, quando necessário, o estado atual do exemplar através da API.
   - Obtém, quando necessário, o registo bibliográfico atual através da API
     REST ou da exportação MARCXML do Koha.
   - Apresenta diferenças de forma estruturada, distinguindo valores
     adicionados, alterados e removidos.
   - Nos exemplares, compara dinamicamente todos os campos registados no log,
     mesmo que ainda não tenham uma etiqueta amigável definida.
   - Nos registos bibliográficos, compara dinamicamente os campos MARC/UNIMARC,
     incluindo ocorrências repetidas.
   - Mantém acesso aos dados técnicos originais registados pelo Koha.
   - Normaliza a indicação da interface de origem do evento
     (Técnico, OPAC, API, SIP2 ou Sistema).
   - Reaplica automaticamente a transformação após paginação, pesquisa,
     ordenação ou atualização das tabelas DataTables.

   Dependências
   ------------
   - jQuery, já disponível no backoffice do Koha.
   - REST API / exportação bibliográfica do próprio Koha.
   - Font Awesome, para os ícones apresentados nos cartões.

   Instalação
   ----------
   Destinado ao IntranetUserJS do Koha.
   Inserir apenas o JavaScript, sem tags <script>.

   Compatibilidade
   ---------------
   Desenvolvido para o backoffice Koha utilizado pela RBMO.
   ============================================================== */

(function () {
  'use strict';

  if (!location.href.includes('/cgi-bin/koha/tools/viewlog.pl')) return;

  if (window.INTRANET_CATALOGUING_CHANGES_ACTIVE) return;
  window.INTRANET_CATALOGUING_CHANGES_ACTIVE = true;
  window.INTRANET_CATALOGUING_CHANGES_VERSION = '1.1';

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
     HISTÓRICO DE ACTION_LOGS
     -------------------------------------------------------------- */

  const ACTION_LOGS_PAGE_SIZE = 100;
  const actionLogsCache = new Map();

  function normaliseAction(action) {
    const value = String(action || '').trim().toUpperCase();

    if (/ADD|ADICION|CRIAR|CREATE/.test(value)) return 'ADD';
    if (/DELETE|ELIMIN|REMOV/.test(value)) return 'DELETE';
    if (/MODIFY|MODIFIC|ALTER/.test(value)) return 'MODIFY';

    return value;
  }

  function logTypeFromRaw(raw) {
    const text = String(raw || '');

    if (
      /\bitem\s+\$VAR/i.test(text) ||
      /\bitemnumber\b/i.test(text) ||
      /\bitem_id\b/i.test(text)
    ) {
      return 'item';
    }

    if (
      /\bbiblio(?:graphic)?\s+\$VAR/i.test(text) ||
      /\bbiblionumber\b/i.test(text) ||
      /\bmarcxml\b/i.test(text) ||
      /<(?:record|marc:record)\b/i.test(text)
    ) {
      return 'biblio';
    }

    return 'generic';
  }

  function actionLogInfo(log) {
    if (!log) return '';
    return String(log.info ?? log.information ?? '');
  }

  function actionLogId(log) {
    const value = log?.action_id ?? log?.id ?? 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function actionLogTimestamp(log) {
    const value = log?.timestamp ?? log?.time ?? '';
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function parseDisplayedKohaDate(text) {
    const value = String(text || '').trim();
    if (!value) return null;

    let parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;

    const m = value.match(
      /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?/
    );

    if (!m) return null;

    const day = Number(m[1]);
    const month = Number(m[2]) - 1;
    const year = Number(m[3]);
    const hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6] || 0);

    const date = new Date(year, month, day, hour, minute, second);
    const time = date.getTime();

    return Number.isFinite(time) ? time : null;
  }

  function extractActionIdFromRow(row) {
    let value =
      row.attr('data-action-id') ||
      row.data('action-id') ||
      row.data('action_id');

    if (value && /^\d+$/.test(String(value))) {
      return Number(value);
    }

    let found = null;

    row.find('a[href]').each(function () {
      const href = $(this).attr('href') || '';
      const match = href.match(/[?&](?:action_id|id)=([0-9]+)/i);

      if (match) {
        found = Number(match[1]);
        return false;
      }
    });

    return found;
  }

  async function fetchCataloguingLogs(objectId) {
    if (!objectId) return [];

    const cacheKey = String(objectId);

    if (actionLogsCache.has(cacheKey)) {
      return actionLogsCache.get(cacheKey);
    }

    const promise = (async function () {
      const all = [];
      let page = 1;

      while (page <= 1000) {
        const params = new URLSearchParams();
        params.set('module', 'CATALOGUING');
        params.set('object', String(objectId));
        params.set('_match', 'exact');
        params.set('_order_by', '+action_id');
        params.set('_page', String(page));
        params.set('_per_page', String(ACTION_LOGS_PAGE_SIZE));

        let response;

        try {
          response = await fetch(`/api/v1/action_logs?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
          });
        } catch (e) {
          return [];
        }

        if (!response.ok) {
          return [];
        }

        let batch;

        try {
          batch = await response.json();
        } catch (e) {
          return [];
        }

        if (!Array.isArray(batch)) {
          return [];
        }

        all.push(...batch);

        if (batch.length < ACTION_LOGS_PAGE_SIZE) {
          break;
        }

        page++;
      }

      return all.sort(function (a, b) {
        return actionLogId(a) - actionLogId(b);
      });
    })();

    actionLogsCache.set(cacheKey, promise);

    return promise;
  }

  function findCurrentActionLog(logs, options) {
    const expectedType = options.type;
    const expectedAction = normaliseAction(options.action);
    const rawComparable = comparable(options.raw);
    const displayedTime = parseDisplayedKohaDate(options.dateText);
    const directId = options.actionId;

    let candidates = (logs || []).filter(function (log) {
      if (normaliseAction(log.action) !== expectedAction) return false;

      const detected = logTypeFromRaw(actionLogInfo(log));

      return detected === expectedType || detected === 'generic';
    });

    if (!candidates.length) {
      candidates = (logs || []).filter(function (log) {
        return normaliseAction(log.action) === expectedAction;
      });
    }

    if (directId) {
      const direct = candidates.find(function (log) {
        return actionLogId(log) === Number(directId);
      });

      if (direct) return direct;
    }

    const exact = candidates.filter(function (log) {
      return comparable(actionLogInfo(log)) === rawComparable;
    });

    if (exact.length === 1) {
      return exact[0];
    }

    const pool = exact.length ? exact : candidates;

    if (displayedTime !== null && pool.length) {
      let best = null;
      let bestDistance = Infinity;

      pool.forEach(function (log) {
        const timestamp = actionLogTimestamp(log);
        if (timestamp === null) return;

        const distance = Math.abs(timestamp - displayedTime);

        if (distance < bestDistance) {
          bestDistance = distance;
          best = log;
        }
      });

      if (best) return best;
    }

    if (pool.length) {
      return pool.reduce(function (latest, log) {
        return actionLogId(log) > actionLogId(latest) ? log : latest;
      });
    }

    return null;
  }

  function previousActionLog(logs, currentLog, type) {
    if (!currentLog) return null;

    const currentId = actionLogId(currentLog);

    const candidates = (logs || []).filter(function (log) {
      if (actionLogId(log) >= currentId) return false;

      const detected = logTypeFromRaw(actionLogInfo(log));

      return detected === type || detected === 'generic';
    });

    if (!candidates.length) return null;

    return candidates.reduce(function (latest, log) {
      return actionLogId(log) > actionLogId(latest) ? log : latest;
    });
  }

  async function getEventHistory(options) {
    const objectId = options.objectId;
    if (!objectId) return null;

    const logs = await fetchCataloguingLogs(objectId);
    if (!logs.length) return null;

    const currentLog = findCurrentActionLog(logs, options);
    if (!currentLog) return null;

    const action = normaliseAction(options.action);
    const currentRaw = actionLogInfo(currentLog) || options.raw;
    const previousLog = previousActionLog(logs, currentLog, options.type);

    if (action === 'ADD') {
      return {
        mode: 'history',
        currentLog: currentLog,
        previousLog: null,
        beforeRaw: '',
        afterRaw: currentRaw,
        action: action
      };
    }

    if (action === 'DELETE') {
      return {
        mode: 'history',
        currentLog: currentLog,
        previousLog: previousLog,
        beforeRaw: currentRaw || actionLogInfo(previousLog),
        afterRaw: '',
        action: action
      };
    }

    return {
      mode: 'history',
      currentLog: currentLog,
      previousLog: previousLog,
      beforeRaw: previousLog ? actionLogInfo(previousLog) : '',
      afterRaw: currentRaw,
      action: action
    };
  }

  function humaniseTechnicalKey(key) {
    const value = String(key || '')
      .replace(/[_\-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!value) return 'Campo';

    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function canonicaliseItemSnapshot(snapshot) {
    const out = {};

    Object.keys(snapshot || {}).forEach(function (key) {
      const canonical = canonicalItemKey(key);

      if (
        out[canonical] === undefined ||
        out[canonical] === null ||
        out[canonical] === ''
      ) {
        out[canonical] = snapshot[key];
      }
    });

    return out;
  }

  function friendlyItemLabel(key) {
    if (ITEM_FIELD_LABELS[key]) return ITEM_FIELD_LABELS[key];

    const original = Object.keys(ITEM_FIELD_LABELS).find(function (candidate) {
      return canonicalItemKey(candidate) === key;
    });

    if (original) return ITEM_FIELD_LABELS[original];

    return humaniseTechnicalKey(key);
  }

  function itemChangeType(before, after) {
    const beforeEmpty = comparable(before) === '';
    const afterEmpty = comparable(after) === '';

    if (beforeEmpty && !afterEmpty) return 'added';
    if (!beforeEmpty && afterEmpty) return 'removed';
    return 'changed';
  }

  function buildItemHistoryRows(beforeSnapshot, afterSnapshot) {
    const before = canonicaliseItemSnapshot(beforeSnapshot || {});
    const after = canonicaliseItemSnapshot(afterSnapshot || {});
    const rows = [];

    const preferred = ITEM_DISPLAY_FIELDS.map(canonicalItemKey);
    const allKeys = Array.from(
      new Set([
        ...preferred,
        ...Object.keys(before),
        ...Object.keys(after)
      ])
    );

    allKeys.forEach(function (key) {
      const hasBefore = Object.prototype.hasOwnProperty.call(before, key);
      const hasAfter = Object.prototype.hasOwnProperty.call(after, key);

      if (!hasBefore && !hasAfter) return;

      const beforeRaw = hasBefore ? before[key] : '';
      const afterRaw = hasAfter ? after[key] : '';

      if (comparable(beforeRaw) === comparable(afterRaw)) return;

      rows.push({
        field: friendlyItemLabel(key),
        code: key,
        before: translateItemValue(key, beforeRaw),
        after: translateItemValue(key, afterRaw),
        change: itemChangeType(beforeRaw, afterRaw)
      });
    });

    return dedupeRows(rows);
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
    const currentSnapshot = {};

    if (current) {
      ITEM_DISPLAY_FIELDS.forEach(function (key) {
        currentSnapshot[canonicalItemKey(key)] = valueFromCurrentItem(current, key);
      });
    }

    return buildItemHistoryRows(logSnapshot || {}, currentSnapshot);
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

  function marcFieldSimilarity(oldField, newField) {
    if (!oldField || !newField || oldField.tag !== newField.tag) return -1;

    let score = 0;

    if ((oldField.ind1 || '') === (newField.ind1 || '')) score += 1;
    if ((oldField.ind2 || '') === (newField.ind2 || '')) score += 1;

    const oldCodes = (oldField.subfields || []).map(s => s.code).join('');
    const newCodes = (newField.subfields || []).map(s => s.code).join('');

    if (oldCodes === newCodes) score += 3;

    const oldValues = new Set(
      (oldField.subfields || []).map(s => `${s.code}|${comparable(s.value)}`)
    );

    (newField.subfields || []).forEach(function (sub) {
      if (oldValues.has(`${sub.code}|${comparable(sub.value)}`)) {
        score += 2;
      }
    });

    if (
      (!oldField.subfields || !oldField.subfields.length) &&
      (!newField.subfields || !newField.subfields.length)
    ) {
      score += 2;
    }

    return score;
  }

  function pairRepeatedFields(oldList, newList) {
    const pairs = [];
    const usedOld = new Set();
    const usedNew = new Set();

    /*
     * 1.º remove ocorrências exatamente iguais.
     */
    oldList.forEach(function (oldField, oldIndex) {
      const sig = fieldSignature(oldField);

      const exactIndex = newList.findIndex(function (newField, newIndex) {
        return !usedNew.has(newIndex) && fieldSignature(newField) === sig;
      });

      if (exactIndex >= 0) {
        usedOld.add(oldIndex);
        usedNew.add(exactIndex);
      }
    });

    /*
     * 2.º emparelha apenas ocorrências estruturalmente plausíveis.
     * Isto reduz falsos "A -> B" quando, na realidade, uma ocorrência
     * foi removida e outra diferente foi adicionada.
     */
    oldList.forEach(function (oldField, oldIndex) {
      if (usedOld.has(oldIndex)) return;

      let bestIndex = -1;
      let bestScore = -1;

      newList.forEach(function (newField, newIndex) {
        if (usedNew.has(newIndex)) return;

        const score = marcFieldSimilarity(oldField, newField);

        if (score > bestScore) {
          bestScore = score;
          bestIndex = newIndex;
        }
      });

      if (bestIndex >= 0 && bestScore >= 4) {
        usedOld.add(oldIndex);
        usedNew.add(bestIndex);

        pairs.push({
          oldField: oldField,
          newField: newList[bestIndex],
          unchanged: false
        });
      }
    });

    /*
     * 3.º ocorrências antigas sem par = removidas.
     */
    oldList.forEach(function (oldField, oldIndex) {
      if (usedOld.has(oldIndex)) return;

      pairs.push({
        oldField: oldField,
        newField: null,
        unchanged: false
      });
    });

    /*
     * 4.º ocorrências atuais sem par = adicionadas.
     */
    newList.forEach(function (newField, newIndex) {
      if (usedNew.has(newIndex)) return;

      pairs.push({
        oldField: null,
        newField: newField,
        unchanged: false
      });
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
          after: newValue,
          change: pair.oldField && pair.newField
            ? 'changed'
            : pair.newField
              ? 'added'
              : 'removed'
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
    const leftTitle = options.leftTitle || 'Antes';
    const rightTitle = options.rightTitle || 'Depois';
    const emptyText =
      options.emptyText ||
      'Não se identificam alterações neste evento. Possivelmente o registo foi guardado sem edições relevantes.';

    if (!rows.length) {
      return `
        <div class="intranet-cataloguing-changes-empty">
          ${esc(emptyText)}
        </div>
      `;
    }

    const changeLabels = {
      added: 'Adicionado',
      removed: 'Removido',
      changed: 'Alterado'
    };

    let html = `
      <div class="intranet-cataloguing-changes-diff-grid">
        <div class="intranet-cataloguing-changes-diff-head">Campo</div>
        <div class="intranet-cataloguing-changes-diff-head">${esc(leftTitle)}</div>
        <div class="intranet-cataloguing-changes-diff-head">${esc(rightTitle)}</div>
    `;

    rows.forEach(function (row) {
      const change = row.change || 'changed';
      const changeLabel = changeLabels[change] || changeLabels.changed;

      html += `
        <div class="intranet-cataloguing-changes-diff-field">
          <div>
            <span class="intranet-cataloguing-changes-field-label">${esc(row.field)}</span>
            ${row.code ? `<span class="intranet-cataloguing-changes-field-code">${esc(row.code)}</span>` : ''}
          </div>
          <span class="intranet-cataloguing-changes-change-badge intranet-cataloguing-changes-change-${esc(change)}">${esc(changeLabel)}</span>
        </div>
        <div class="intranet-cataloguing-changes-diff-value">${esc(row.before)}</div>
        <div class="intranet-cataloguing-changes-diff-value intranet-cataloguing-changes-diff-current">${esc(row.after)}</div>
      `;
    });

    html += `</div>`;

    return html;
  }

  function renderLoading(title, subtitle) {
    return `
      <div class="intranet-cataloguing-changes-card">
        <div class="intranet-cataloguing-changes-title">${esc(title)}</div>
        <div class="intranet-cataloguing-changes-loading">${esc(subtitle)}</div>
      </div>
    `;
  }

  function formatTechnicalRaw(raw) {
    const text = String(raw ?? '').trim();

    // If it already contains line breaks, preserve its original formatting.
    if (/\r|\n/.test(text)) return text;

    // Pretty-print one-line Perl Data::Dumper item hashes for readability,
    // without changing the underlying values used by the friendly parser.
    if (/^\s*item\s+\$VAR\d*\s*=\s*\{/i.test(text)) {
      let body = text
        .replace(/^\s*(item\s+\$VAR\d*\s*=\s*\{)\s*/i, '$1\n  ')
        .replace(/\s*};?\s*$/, '\n};');

      // Break only at commas followed by the next Perl hash key.
      body = body.replace(/,\s*(?='[^']+'\s*=>)/g, ',\n  ');

      return body;
    }

    return text;
  }

  function renderTechnical(raw) {
    const displayRaw = formatTechnicalRaw(raw);

    return `
      <details class="intranet-cataloguing-changes-tech">
        <summary>Ver dados técnicos originais</summary>
        <pre>${esc(displayRaw)}</pre>
      </details>
    `;
  }

  function renderHistoryNote(history, fallbackText) {
    if (history?.mode === 'history') {
      if (history.previousLog || history.action === 'ADD' || history.action === 'DELETE') {
        return `
          <div class="intranet-cataloguing-changes-context-note">
            Comparação reconstruída a partir do histórico de catalogação do Koha.
          </div>
        `;
      }

      return `
        <div class="intranet-cataloguing-changes-mode-note">
          Este é o primeiro estado histórico recuperável deste objeto. O valor anterior não está disponível.
        </div>
      `;
    }

    if (!fallbackText) return '';

    return `
      <div class="intranet-cataloguing-changes-mode-note">
        ${esc(fallbackText)}
      </div>
    `;
  }

  function renderItemCard(raw, action, currentItem, history) {
    const normalAction = normaliseAction(action);
    const currentLogSnapshot = parsePerlHash(raw);

    let beforeSnapshot = {};
    let afterSnapshot = {};
    let rows = [];
    let fallbackText = '';

    if (history?.mode === 'history') {
      beforeSnapshot = parsePerlHash(history.beforeRaw);
      afterSnapshot = parsePerlHash(history.afterRaw);

      rows = buildItemHistoryRows(beforeSnapshot, afterSnapshot);
    } else if (normalAction === 'ADD') {
      afterSnapshot = currentLogSnapshot;
      rows = buildItemHistoryRows({}, afterSnapshot);
      fallbackText = 'Não foi necessário um estado anterior: este evento corresponde à criação do exemplar.';
    } else if (normalAction === 'DELETE') {
      beforeSnapshot = currentLogSnapshot;
      rows = buildItemHistoryRows(beforeSnapshot, {});
      fallbackText = 'O histórico completo não ficou acessível; o snapshot do evento de eliminação foi usado como estado anterior.';
    } else if (currentItem) {
      rows = buildItemRows(currentLogSnapshot, currentItem);
      fallbackText = 'Não foi possível reconstruir o evento anterior através de action_logs. É apresentada, como fallback, a diferença entre o snapshot deste log e o estado atual do exemplar.';
    } else {
      fallbackText = 'Não foi possível reconstruir o estado anterior nem obter o estado atual do exemplar.';
    }

    let title = 'Exemplar modificado';
    if (normalAction === 'ADD') title = 'Exemplar adicionado';
    if (normalAction === 'DELETE') title = 'Exemplar eliminado';

    const identitySnapshot =
      Object.keys(afterSnapshot).length
        ? afterSnapshot
        : Object.keys(beforeSnapshot).length
          ? beforeSnapshot
          : currentLogSnapshot;

    const barcode =
      identitySnapshot.barcode ||
      valueFromCurrentItem(currentItem, 'barcode');

    const callnumber =
      identitySnapshot.itemcallnumber ||
      valueFromCurrentItem(currentItem, 'itemcallnumber');

    let subtitle = 'Evento registado no Koha.';

    if (barcode && callnumber) {
      subtitle = `Exemplar ${esc(barcode)}, cota ${esc(callnumber)}.`;
    } else if (barcode) {
      subtitle = `Exemplar ${esc(barcode)}.`;
    } else if (callnumber) {
      subtitle = `Exemplar com cota ${esc(callnumber)}.`;
    }

    return `
      <div class="intranet-cataloguing-changes-card">
        <div class="intranet-cataloguing-changes-header">
          <div class="intranet-cataloguing-changes-icon"><i class="fa-regular fa-bookmark" aria-hidden="true"></i></div>
          <div>
            <div class="intranet-cataloguing-changes-title">${esc(title)}</div>
            <div class="intranet-cataloguing-changes-subtitle">${subtitle}</div>
          </div>
        </div>

        ${renderHistoryNote(history, fallbackText)}
        ${renderDiffTable(rows)}

        ${renderTechnical(raw)}
      </div>
    `;
  }

  function buildBiblioHistoryRows(beforeRaw, afterRaw) {
    const beforeXml = extractMarcXmlFromRaw(beforeRaw);
    const afterXml = extractMarcXmlFromRaw(afterRaw);
    const beforeFields = marcXmlToFields(beforeXml);
    const afterFields = marcXmlToFields(afterXml);

    if (beforeFields || afterFields) {
      return {
        rows: buildMarcRows(beforeFields || [], afterFields || []),
        mode: 'marc'
      };
    }

    const beforeSnapshot = parsePerlHash(beforeRaw);
    const afterSnapshot = parsePerlHash(afterRaw);

    const keys = Array.from(
      new Set([
        ...Object.keys(beforeSnapshot),
        ...Object.keys(afterSnapshot)
      ])
    );

    const rows = [];

    keys.forEach(function (key) {
      const beforeValue = beforeSnapshot[key] ?? '';
      const afterValue = afterSnapshot[key] ?? '';

      if (comparable(beforeValue) === comparable(afterValue)) return;

      rows.push({
        field: humaniseTechnicalKey(key),
        code: key,
        before: displayValue(beforeValue),
        after: displayValue(afterValue),
        change: itemChangeType(beforeValue, afterValue)
      });
    });

    return {
      rows: dedupeRows(rows),
      mode: rows.length ? 'basic' : ''
    };
  }

  function renderBiblioCard(raw, action, objectText, biblionumber, currentBiblio, history) {
    const normalAction = normaliseAction(action);
    let rows = [];
    let comparisonMode = '';
    let fallbackText = '';

    if (history?.mode === 'history') {
      const built = buildBiblioHistoryRows(history.beforeRaw, history.afterRaw);
      rows = built.rows;
      comparisonMode = built.mode;
    } else if (normalAction === 'ADD') {
      const built = buildBiblioHistoryRows('', raw);
      rows = built.rows;
      comparisonMode = built.mode;
      fallbackText = 'Não foi necessário um estado anterior: este evento corresponde à criação do registo bibliográfico.';
    } else if (normalAction === 'DELETE') {
      const built = buildBiblioHistoryRows(raw, '');
      rows = built.rows;
      comparisonMode = built.mode;
      fallbackText = 'O histórico completo não ficou acessível; o snapshot do evento de eliminação foi usado como estado anterior.';
    } else {
      const logSnapshot = parsePerlHash(raw);
      const oldMarcXml = extractMarcXmlFromRaw(raw);
      const oldFields = marcXmlToFields(oldMarcXml);
      const currentFields = currentBiblio?.fields || null;
      const currentObject = currentBiblio?.rawObject || null;

      if (oldFields && currentFields) {
        rows = buildMarcRows(oldFields, currentFields);
        comparisonMode = 'marc';
      } else if (currentObject) {
        rows = buildBasicBiblioRows(logSnapshot, currentObject);
        comparisonMode = rows.length ? 'basic' : '';
      }

      fallbackText =
        'Não foi possível reconstruir o evento anterior através de action_logs. É apresentada, como fallback, a diferença entre o snapshot deste log e o estado bibliográfico atual.';
    }

    let title = 'Registo bibliográfico modificado';
    if (normalAction === 'ADD') title = 'Registo bibliográfico adicionado';
    if (normalAction === 'DELETE') title = 'Registo bibliográfico eliminado';

    const subtitle = biblionumber
      ? `Registo bibliográfico ${esc(biblionumber)}.`
      : esc(objectText || 'Registo bibliográfico');

    let modeNote = '';

    if (comparisonMode === 'basic') {
      modeNote = `
        <div class="intranet-cataloguing-changes-mode-note">
          Não foi possível obter MARC completo para ambos os estados. Foram comparados todos os campos simples disponíveis no log.
        </div>
      `;
    }

    return `
      <div class="intranet-cataloguing-changes-card">
        <div class="intranet-cataloguing-changes-header">
          <div class="intranet-cataloguing-changes-icon"><i class="fa-regular fa-file" aria-hidden="true"></i></div>
          <div>
            <div class="intranet-cataloguing-changes-title">${esc(title)}</div>
            <div class="intranet-cataloguing-changes-subtitle">${subtitle}</div>
          </div>
        </div>

        ${renderHistoryNote(history, fallbackText)}
        ${modeNote}
        ${renderDiffTable(rows)}

        ${renderTechnical(raw)}
      </div>
    `;
  }

  function renderGenericCard(raw, action, objectText) {
    return `
      <div class="intranet-cataloguing-changes-card">
        <div class="intranet-cataloguing-changes-header">
          <div class="intranet-cataloguing-changes-icon"><i class="fa-regular fa-file" aria-hidden="true"></i></div>
          <div>
            <div class="intranet-cataloguing-changes-title">${esc(objectText || 'Registo')}</div>
            <div class="intranet-cataloguing-changes-subtitle">Evento de ${esc(String(action || '').toLowerCase())} registado no Koha.</div>
          </div>
        </div>

        <div class="intranet-cataloguing-changes-empty">
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
    if (row.data('intranet-cataloguing-changes-diff')) return;

    naturaliseInterface(row);

    const cells = row.find('td');
    if (cells.length < 6) return;

    const dateText = cells.eq(0).text().trim();
    const moduleText = cells.eq(2).text().trim();
    const action = cells.eq(3).text().trim();
    const objectCell = cells.eq(4);
    const objectText = objectCell.text().trim();
    const infoCell = cells.eq(5);

    const originalRaw = infoCell.text();
    const raw = originalRaw.trim();
    if (!raw) return;

    row.data('intranet-cataloguing-changes-diff', true);

    const type = detectLogType(raw, objectCell, moduleText);
    const actionId = extractActionIdFromRow(row);

    if (type === 'item') {
      infoCell.html(
        renderLoading(
          'A interpretar alteração de exemplar...',
          'A reconstruir o estado anterior e posterior deste evento.'
        )
      );

      const itemnumber = extractItemnumber(raw, objectCell);

      const [history, currentItem] = await Promise.all([
        getEventHistory({
          objectId: itemnumber,
          type: 'item',
          action: action,
          raw: originalRaw,
          dateText: dateText,
          actionId: actionId
        }),
        fetchCurrentItem(itemnumber)
      ]);

      infoCell.html(
        renderItemCard(originalRaw, action, currentItem, history)
      );

      return;
    }

    if (type === 'biblio') {
      infoCell.html(
        renderLoading(
          'A interpretar alteração bibliográfica...',
          'A reconstruir o estado anterior e posterior deste evento.'
        )
      );

      const biblionumber = extractBiblionumber(raw, objectCell);

      const [history, currentBiblio] = await Promise.all([
        getEventHistory({
          objectId: biblionumber,
          type: 'biblio',
          action: action,
          raw: originalRaw,
          dateText: dateText,
          actionId: actionId
        }),
        fetchCurrentBiblio(biblionumber)
      ]);

      infoCell.html(
        renderBiblioCard(
          originalRaw,
          action,
          objectText,
          biblionumber,
          currentBiblio,
          history
        )
      );

      return;
    }

    infoCell.html(
      renderGenericCard(originalRaw, action, objectText)
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
    if ($('#intranet-cataloguing-changes-diff-css').length) return;

    $('head').append(`
      <style id="intranet-cataloguing-changes-diff-css">
        table td:nth-child(6) {
          width: 760px;
          min-width: 760px;
          max-width: 760px;
          vertical-align: top;
          box-sizing: border-box;
          overflow: hidden;
        }

        .intranet-cataloguing-changes-card {
          background: #ffffff;
          border: 1px solid #d7dde3;
          border-radius: 7px;
          padding: 7px 9px;
          font-size: 11.5px;
          line-height: 1.25;
          color: #1f2933;
          box-shadow: 0 1px 2px rgba(0,0,0,.04);
          width: 100%;
          max-width: 800px;
          box-sizing: border-box;
          overflow: hidden;
        }

        .intranet-cataloguing-changes-header {
          display: flex;
          align-items: flex-start;
          gap: 7px;
          margin-bottom: 6px;
        }

        .intranet-cataloguing-changes-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 20px;
          height: 20px;
          margin-top: 0;
          color: #4b5563;
          font-size: 17px;
          line-height: 1;
        }

        .intranet-cataloguing-changes-title {
          font-weight: 700;
          font-size: 13px;
          color: #111827;
          margin-bottom: 2px;
        }

        .intranet-cataloguing-changes-subtitle,
        .intranet-cataloguing-changes-loading,
        .intranet-cataloguing-changes-empty,
        .intranet-cataloguing-changes-note,
        .intranet-cataloguing-changes-mode-note,
        .intranet-cataloguing-changes-context-note {
          color: #4b5563;
          font-size: 12px;
        }

        .intranet-cataloguing-changes-diff-grid {
          display: grid;
          grid-template-columns: minmax(145px, 28%) minmax(0, 36%) minmax(0, 36%);
          margin-top: 5px;
          border-top: 1px solid #d9dee3;
          border-left: 1px solid #d9dee3;
          font-size: 11px;
          line-height: 1.2;
        }

        .intranet-cataloguing-changes-diff-head,
        .intranet-cataloguing-changes-diff-field,
        .intranet-cataloguing-changes-diff-value {
          min-width: 0;
          padding: 4px 6px;
          border-right: 1px solid #d9dee3;
          border-bottom: 1px solid #d9dee3;
        }

        .intranet-cataloguing-changes-diff-head {
          background: #f3f5f7;
          color: #374151;
          font-weight: 700;
        }

        .intranet-cataloguing-changes-diff-field {
          background: #fafafa;
          border-left: 3px solid #d99a00;
        }

        .intranet-cataloguing-changes-diff-value {
          background: #fff;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .intranet-cataloguing-changes-diff-current {
          background: #fff8e8;
        }


        .intranet-cataloguing-changes-field-label {
          display: inline;
          font-weight: 600;
        }

        .intranet-cataloguing-changes-field-code {
          display: inline;
          margin-left: 5px;
          color: #8a949e;
          font-size: 9.5px;
          font-family: monospace;
          font-weight: 400;
        }

        .intranet-cataloguing-changes-change-badge {
          display: inline-block;
          margin-top: 3px;
          padding: 1px 5px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 700;
          line-height: 1.35;
          border: 1px solid #d6dbe1;
          background: #f4f6f8;
          color: #4b5563;
        }

        .intranet-cataloguing-changes-change-added {
          background: #eef8f1;
          border-color: #bddfc6;
          color: #286437;
        }

        .intranet-cataloguing-changes-change-removed {
          background: #fff1f0;
          border-color: #efc2bf;
          color: #8b3430;
        }

        .intranet-cataloguing-changes-change-changed {
          background: #fff8e8;
          border-color: #ead29c;
          color: #77570b;
        }

        .intranet-cataloguing-changes-note,
        .intranet-cataloguing-changes-mode-note {
          margin-top: 8px;
          padding: 7px 8px;
          background: #fff8e8;
          border: 1px solid #ead29c;
          border-radius: 4px;
        }

        .intranet-cataloguing-changes-mode-note {
          background: #f5f8fb;
          border-color: #d8e1ea;
        }

        .intranet-cataloguing-changes-empty {
          padding: 5px 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 5px;
        }

        .intranet-cataloguing-changes-context-note {
          margin-top: 5px;
          color: #6b7280;
          font-size: 10.5px;
          line-height: 1.35;
        }

        .intranet-cataloguing-changes-tech {
          margin-top: 6px;
          border-top: 1px solid #eef0f2;
          padding-top: 5px;
        }

        .intranet-cataloguing-changes-tech summary {
          cursor: pointer;
          color: #006699;
          font-size: 11px;
          font-weight: 600;
        }

        .intranet-cataloguing-changes-tech {
          max-width: 100%;
          min-width: 0;
          overflow: hidden;
        }

        .intranet-cataloguing-changes-tech pre {
          margin-top: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 5px;
          padding: 8px;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          box-sizing: border-box;
          max-height: 180px;
          overflow: auto;
          white-space: pre;
          overflow-wrap: normal;
          word-break: normal;
          font-size: 10.5px;
          line-height: 1.35;
          color: #334155;
        }
      </style>
    `);
  }

  function installRefreshHooks() {
    // O Koha/DataTables recria as linhas ao mudar de página, ordenar,
    // pesquisar ou alterar o número de resultados visíveis.
    // Por isso é necessário voltar a aplicar a transformação friendly.

    $(document).on(
      'draw.dt page.dt order.dt search.dt length.dt',
      function () {
        window.setTimeout(enhance, 0);
      }
    );

    // Fallback para ecrãs/versões em que a atualização da tabela
    // não dispara um evento DataTables utilizável.
    const observer = new MutationObserver(function (mutations) {
      let shouldRefresh = false;

      for (const mutation of mutations) {
        if (mutation.type !== 'childList' || !mutation.addedNodes.length) continue;

        for (const node of mutation.addedNodes) {
          if (
            node.nodeType === 1 &&
            (
              node.matches?.('tr, tbody, table') ||
              node.querySelector?.('tr')
            )
          ) {
            shouldRefresh = true;
            break;
          }
        }

        if (shouldRefresh) break;
      }

      if (shouldRefresh) {
        window.setTimeout(enhance, 0);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  $(document).ready(function () {
    injectCss();
    enhance();
    installRefreshHooks();
  });

})();
