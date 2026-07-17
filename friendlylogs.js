/* ==============================================================
   USER FRIENDLY LOGS
   ============================================================== */

(function () {
  'use strict';

  if (!location.href.includes('/cgi-bin/koha/tools/viewlog.pl')) return;

  const FIELD_LABELS = {
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

  const API_MAP = {
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

  const DISPLAY_FIELDS = [
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

  let enhanceScheduled = false;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, function (character) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[character];
    });
  }

  function clean(value) {
    value = String(value ?? '').trim();

    if (!value || value === 'undef' || value === 'null') {
      return '';
    }

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

    return value.trim();
  }

  function displayValue(value) {
    const normalisedValue = normalise(value);
    return normalisedValue === '' ? '—' : normalisedValue;
  }

  function comparable(value) {
    return normalise(value)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function translate(key, value) {
    const translatedValue = displayValue(value);

    if (translatedValue === '—') {
      return translatedValue;
    }

    if (
      STATE_TRANSLATIONS[key] &&
      STATE_TRANSLATIONS[key][translatedValue] !== undefined
    ) {
      return STATE_TRANSLATIONS[key][translatedValue];
    }

    return translatedValue;
  }

  function parsePerlHash(text) {
    const data = {};
    const regex = /'([^']+)'\s*=>\s*(undef|null|'[^']*'|[0-9.]+)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      data[match[1]] = clean(match[2]);
    }

    return data;
  }

  function extractItemnumber(raw, objectCell) {
    const fromHash = parsePerlHash(raw).itemnumber;

    if (fromHash) {
      return fromHash;
    }

    const link =
      objectCell
        .find('a[href*="itemnumber="], a[href*="item_id="]')
        .attr('href') || '';

    const linkMatch = link.match(/(?:itemnumber|item_id)=([0-9]+)/);

    if (linkMatch) {
      return linkMatch[1];
    }

    const objectText = objectCell.text();
    const textMatch = objectText.match(/Exemplar\s+([0-9]+)/i);

    if (textMatch) {
      return textMatch[1];
    }

    return '';
  }

  function valueFromCurrentItem(currentItem, key) {
    if (!currentItem) {
      return '';
    }

    const possibleKeys = API_MAP[key] || [key];

    for (const apiKey of possibleKeys) {
      if (
        currentItem[apiKey] !== undefined &&
        currentItem[apiKey] !== null
      ) {
        return currentItem[apiKey];
      }
    }

    return '';
  }

  async function fetchCurrentItem(itemnumber) {
    if (!itemnumber) {
      return null;
    }

    const urls = [
      `/api/v1/items/${encodeURIComponent(itemnumber)}`,
      `/api/v1/public/items/${encodeURIComponent(itemnumber)}`
    ];

    for (const url of urls) {
      try {
        const response = await fetch(url, {
          credentials: 'same-origin',
          headers: {
            Accept: 'application/json'
          }
        });

        if (response.ok) {
          return await response.json();
        }
      } catch (error) {
        console.debug(
          '[User Friendly Logs] Não foi possível consultar:',
          url,
          error
        );
      }
    }

    return null;
  }

  function buildRows(before, currentItem) {
    const rows = [];

    if (!currentItem) {
      return rows;
    }

    DISPLAY_FIELDS.forEach(function (key) {
      const beforeRaw = before[key];
      const afterRaw = valueFromCurrentItem(currentItem, key);

      const beforeExists =
        beforeRaw !== undefined &&
        beforeRaw !== null;

      const afterExists =
        afterRaw !== undefined &&
        afterRaw !== null;

      if (!beforeExists && !afterExists) {
        return;
      }

      const beforeComparable = comparable(beforeRaw);
      const afterComparable = comparable(afterRaw);

      if (beforeComparable === afterComparable) {
        return;
      }

      rows.push({
        label: FIELD_LABELS[key] || key,
        before: translate(key, beforeRaw),
        after: translate(key, afterRaw)
      });
    });

    return rows;
  }

  function renderTable(rows, apiAvailable) {
    if (!apiAvailable) {
      return `
        <div class="klog-note">
          Não foi possível obter o valor atual do exemplar.
          Sem esse valor, não é possível calcular automaticamente
          o que foi efetivamente modificado.
        </div>
      `;
    }

    if (!rows.length) {
      return `
        <div class="klog-empty">
          Não foram detetadas diferenças entre o valor registado
          no log e o valor atual do exemplar.
        </div>
      `;
    }

    let html = `
      <table class="klog-diff-table">
        <thead>
          <tr>
            <th>Objeto modificado</th>
            <th>Antes</th>
            <th>Depois</th>
          </tr>
        </thead>
        <tbody>
    `;

    rows.forEach(function (row) {
      html += `
        <tr>
          <td>${esc(row.label)}</td>
          <td>${esc(row.before)}</td>
          <td>${esc(row.after)}</td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    return html;
  }

  function renderLoading() {
    return `
      <div class="klog-card">
        <div class="klog-title">
          A interpretar alteração...
        </div>

        <div class="klog-loading">
          A obter os valores atuais do exemplar.
        </div>
      </div>
    `;
  }

  function renderItemCard(raw, action, objectCell, currentItem) {
    const before = parsePerlHash(raw);
    const rows = buildRows(before, currentItem);
    const apiAvailable = Boolean(currentItem);

    let title = 'Exemplar modificado';

    if (/adicionar/i.test(action)) {
      title = 'Exemplar adicionado';
    }

    if (/eliminar/i.test(action)) {
      title = 'Exemplar eliminado';
    }

    const barcode =
      before.barcode ||
      valueFromCurrentItem(currentItem, 'barcode');

    const callnumber =
      before.itemcallnumber ||
      valueFromCurrentItem(currentItem, 'itemcallnumber');

    let subtitle = 'Alteração registada no Koha.';

    if (barcode && callnumber) {
      subtitle =
        `Exemplar ${esc(barcode)}, cota ${esc(callnumber)}.`;
    } else if (barcode) {
      subtitle = `Exemplar ${esc(barcode)}.`;
    } else if (callnumber) {
      subtitle = `Exemplar com cota ${esc(callnumber)}.`;
    }

    return `
      <div class="klog-card">
        <div class="klog-header">
          <div class="klog-icon">📦</div>

          <div>
            <div class="klog-title">
              ${esc(title)}
            </div>

            <div class="klog-subtitle">
              ${subtitle}
            </div>
          </div>
        </div>

        ${renderTable(rows, apiAvailable)}

        <details class="klog-tech">
          <summary>
            Ver dados técnicos originais
          </summary>

          <pre>${esc(raw)}</pre>
        </details>
      </div>
    `;
  }

  function renderGenericCard(raw, action, objectText) {
    return `
      <div class="klog-card">
        <div class="klog-header">
          <div class="klog-icon">📝</div>

          <div>
            <div class="klog-title">
              ${esc(objectText || 'Registo')}
            </div>

            <div class="klog-subtitle">
              Evento de
              ${esc(String(action || '').toLowerCase())}
              registado no Koha.
            </div>
          </div>
        </div>

        <div class="klog-empty">
          Este tipo de log ainda não tem interpretação estruturada
          em tabela “antes/depois”.
        </div>

        <details class="klog-tech">
          <summary>
            Ver dados técnicos originais
          </summary>

          <pre>${esc(raw)}</pre>
        </details>
      </div>
    `;
  }

  async function enhanceRow(row) {
    if (row.attr('data-klog-diff') === '1') {
      return;
    }

    const cells = row.children('td');

    if (cells.length < 6) {
      return;
    }

    const action = cells.eq(3).text().trim();
    const objectCell = cells.eq(4);
    const objectText = objectCell.text().trim();
    const infoCell = cells.eq(5);
    const raw = infoCell.text().trim();

    if (!raw) {
      return;
    }

    /*
     * O atributo é usado em vez de apenas $.data(),
     * porque o DataTables pode recriar os elementos da tabela.
     */
    row.attr('data-klog-diff', '1');

    try {
      if (/^\s*item\s+\$VAR/i.test(raw)) {
        infoCell.html(renderLoading());

        const itemnumber = extractItemnumber(raw, objectCell);
        const currentItem = await fetchCurrentItem(itemnumber);

        /*
         * Confirma que a célula ainda pertence ao documento.
         * O DataTables pode ter mudado de página enquanto a API respondia.
         */
        if (!document.documentElement.contains(infoCell[0])) {
          return;
        }

        infoCell.html(
          renderItemCard(
            raw,
            action,
            objectCell,
            currentItem
          )
        );

        return;
      }

      infoCell.html(
        renderGenericCard(
          raw,
          action,
          objectText
        )
      );
    } catch (error) {
      row.removeAttr('data-klog-diff');

      console.error(
        '[User Friendly Logs] Erro ao interpretar linha:',
        error
      );
    }
  }

  function findLogTables() {
    return $('table').filter(function () {
      return $(this)
        .find('thead th, th')
        .filter(function () {
          return $(this).text().trim() === 'Info';
        })
        .length > 0;
    });
  }

  function enhance() {
    const tables = findLogTables();

    if (!tables.length) {
      return;
    }

    tables.each(function () {
      $(this)
        .find('tbody tr')
        .each(function () {
          enhanceRow($(this));
        });
    });
  }

  function scheduleEnhance() {
    if (enhanceScheduled) {
      return;
    }

    enhanceScheduled = true;

    window.requestAnimationFrame(function () {
      enhanceScheduled = false;
      enhance();
    });
  }

  function injectCss() {
    if ($('#klog-diff-css').length) {
      return;
    }

    $('head').append(`
      <style id="klog-diff-css">
        table td:nth-child(6) {
          min-width: 620px;
          max-width: 860px;
          vertical-align: top;
        }

        .klog-card {
          background: #ffffff;
          border: 1px solid #d7dde3;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
          color: #1f2933;
          box-shadow: 0 1px 2px rgba(0, 0, 0, .05);
          max-width: 820px;
        }

        .klog-header {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 10px;
        }

        .klog-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #eef3f6;
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 28px;
          font-size: 15px;
        }

        .klog-title {
          font-weight: 700;
          font-size: 13px;
          color: #111827;
          margin-bottom: 2px;
        }

        .klog-subtitle,
        .klog-loading,
        .klog-empty,
        .klog-note {
          color: #4b5563;
          font-size: 12px;
        }

        .klog-diff-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
          font-size: 12px;
          background: #ffffff;
        }

        .klog-diff-table th {
          background: #f3f5f7;
          color: #374151;
          text-align: left;
          font-weight: 700;
          border: 1px solid #d9dee3;
          padding: 6px 8px;
        }

        .klog-diff-table td {
          border: 1px solid #e1e5e9;
          padding: 6px 8px;
          vertical-align: top;
        }

        .klog-diff-table td:first-child {
          width: 28%;
          color: #374151;
          font-weight: 600;
          background: #fafafa;
          border-left: 4px solid #d99a00;
        }

        .klog-diff-table td:nth-child(2),
        .klog-diff-table td:nth-child(3) {
          width: 36%;
          word-break: break-word;
        }

        .klog-diff-table tbody tr td:nth-child(3) {
          background: #fff8e8;
        }

        .klog-note {
          margin-top: 8px;
          padding: 6px 8px;
          background: #fff8e8;
          border: 1px solid #ead29c;
          border-radius: 4px;
        }

        .klog-empty {
          padding: 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 5px;
        }

        .klog-tech {
          margin-top: 10px;
          border-top: 1px solid #eef0f2;
          padding-top: 7px;
        }

        .klog-tech summary {
          cursor: pointer;
          color: #006699;
          font-size: 11px;
          font-weight: 600;
        }

        .klog-tech pre {
          margin-top: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 5px;
          padding: 8px;
          max-height: 150px;
          overflow: auto;
          white-space: pre-wrap;
          font-size: 10.5px;
          line-height: 1.35;
          color: #334155;
        }
      </style>
    `);
  }

  function observeTableChanges() {
    const observer = new MutationObserver(function (mutations) {
      const relevantChange = mutations.some(function (mutation) {
        if (mutation.type !== 'childList') {
          return false;
        }

        return Array.from(mutation.addedNodes).some(function (node) {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return false;
          }

          return (
            node.matches?.('table, tbody, tr') ||
            Boolean(node.querySelector?.('table, tbody, tr'))
          );
        });
      });

      if (relevantChange) {
        scheduleEnhance();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  function bindDataTablesEvents() {
    /*
     * Executa novamente após:
     * - paginação;
     * - ordenação;
     * - pesquisa;
     * - alteração do número de resultados;
     * - qualquer redesenho do DataTables.
     */
    $(document)
      .off('draw.dt.klogFriendlyLogs')
      .on('draw.dt.klogFriendlyLogs', function () {
        scheduleEnhance();
      });

    /*
     * Salvaguarda adicional para versões do Koha
     * que atualizem a tabela antes ou depois do evento draw.
     */
    $(document)
      .off(
        'page.dt.klogFriendlyLogs ' +
        'search.dt.klogFriendlyLogs ' +
        'order.dt.klogFriendlyLogs ' +
        'length.dt.klogFriendlyLogs'
      )
      .on(
        'page.dt.klogFriendlyLogs ' +
        'search.dt.klogFriendlyLogs ' +
        'order.dt.klogFriendlyLogs ' +
        'length.dt.klogFriendlyLogs',
        function () {
          window.setTimeout(scheduleEnhance, 0);
        }
      );
  }

  $(document).ready(function () {
    injectCss();
    bindDataTablesEvents();
    observeTableChanges();
    scheduleEnhance();
  });
})();
