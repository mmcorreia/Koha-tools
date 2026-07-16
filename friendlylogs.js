/* ==============================================================
   USER FRIENDLY LOGS
   ========================================================*/

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

    return value.trim();
  }

  function displayValue(value) {
    const v = normalise(value);
    return v === '' ? '—' : v;
  }

  function comparable(value) {
    return normalise(value)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function translate(key, value) {
    const v = displayValue(value);

    if (v === '—') return v;

    if (STATE_TRANSLATIONS[key] && STATE_TRANSLATIONS[key][v] !== undefined) {
      return STATE_TRANSLATIONS[key][v];
    }

    return v;
  }

  function parsePerlHash(text) {
    const data = {};
    const re = /'([^']+)'\s*=>\s*(undef|null|'[^']*'|[0-9.]+)/g;
    let match;

    while ((match = re.exec(text)) !== null) {
      data[match[1]] = clean(match[2]);
    }

    return data;
  }

  function extractItemnumber(raw, objectCell) {
    const fromHash = parsePerlHash(raw).itemnumber;
    if (fromHash) return fromHash;

    const link = objectCell.find('a[href*="itemnumber="], a[href*="item_id="]').attr('href') || '';
    const m = link.match(/(?:itemnumber|item_id)=([0-9]+)/);
    if (m) return m[1];

    const text = objectCell.text();
    const m2 = text.match(/Exemplar\s+([0-9]+)/i);
    if (m2) return m2[1];

    return '';
  }

  function valueFromCurrentItem(current, key) {
    if (!current) return '';

    const possibleKeys = API_MAP[key] || [key];

    for (const apiKey of possibleKeys) {
      if (current[apiKey] !== undefined && current[apiKey] !== null) {
        return current[apiKey];
      }
    }

    return '';
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

  function buildRows(before, current) {
    const rows = [];

    if (!current) return rows;

    DISPLAY_FIELDS.forEach(function (key) {
      const beforeRaw = before[key];
      const afterRaw = valueFromCurrentItem(current, key);

      const beforeExists = beforeRaw !== undefined && beforeRaw !== null;
      const afterExists = afterRaw !== undefined && afterRaw !== null;

      if (!beforeExists && !afterExists) return;

      const beforeComp = comparable(beforeRaw);
      const afterComp = comparable(afterRaw);

      if (beforeComp === afterComp) return;

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
          Não foi possível obter o valor atual do exemplar. Sem esse valor, não é possível calcular automaticamente o que foi efetivamente modificado.
        </div>
      `;
    }

    if (!rows.length) {
      return `
        <div class="klog-empty">
          Não foram detetadas diferenças entre o valor registado no log e o valor atual do exemplar.
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
        <div class="klog-title">A interpretar alteração...</div>
        <div class="klog-loading">A obter os valores atuais do exemplar.</div>
      </div>
    `;
  }

  function renderItemCard(raw, action, objectCell, currentItem) {
    const before = parsePerlHash(raw);
    const rows = buildRows(before, currentItem);
    const apiAvailable = !!currentItem;

    let title = 'Exemplar modificado';
    if (/adicionar/i.test(action)) title = 'Exemplar adicionado';
    if (/eliminar/i.test(action)) title = 'Exemplar eliminado';

    const barcode = before.barcode || valueFromCurrentItem(currentItem, 'barcode');
    const callnumber = before.itemcallnumber || valueFromCurrentItem(currentItem, 'itemcallnumber');

    let subtitle = 'Alteração registada no Koha.';
    if (barcode && callnumber) {
      subtitle = `Exemplar ${esc(barcode)}, cota ${esc(callnumber)}.`;
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
            <div class="klog-title">${esc(title)}</div>
            <div class="klog-subtitle">${subtitle}</div>
          </div>
        </div>

        ${renderTable(rows, apiAvailable)}

        <details class="klog-tech">
          <summary>Ver dados técnicos originais</summary>
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
            <div class="klog-title">${esc(objectText || 'Registo')}</div>
            <div class="klog-subtitle">Evento de ${esc(String(action || '').toLowerCase())} registado no Koha.</div>
          </div>
        </div>

        <div class="klog-empty">
          Este tipo de log ainda não tem interpretação estruturada em tabela “antes/depois”.
        </div>

        <details class="klog-tech">
          <summary>Ver dados técnicos originais</summary>
          <pre>${esc(raw)}</pre>
        </details>
      </div>
    `;
  }

  async function enhanceRow(row) {
    if (row.data('klog-diff')) return;

    const cells = row.find('td');
    if (cells.length < 6) return;

    const action = cells.eq(3).text().trim();
    const objectCell = cells.eq(4);
    const objectText = objectCell.text().trim();
    const infoCell = cells.eq(5);

    const raw = infoCell.text().trim();
    if (!raw) return;

    row.data('klog-diff', true);

    if (/^\s*item\s+\$VAR/i.test(raw)) {
      infoCell.html(renderLoading());

      const itemnumber = extractItemnumber(raw, objectCell);
      const currentItem = await fetchCurrentItem(itemnumber);

      infoCell.html(renderItemCard(raw, action, objectCell, currentItem));
      return;
    }

    infoCell.html(renderGenericCard(raw, action, objectText));
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

  function injectCss() {
    if ($('#klog-diff-css').length) return;

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
          box-shadow: 0 1px 2px rgba(0,0,0,.05);
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
          background: #fff;
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

  $(document).ready(function () {
    injectCss();
    enhance();
  });

})();
