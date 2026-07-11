/* =====================================
   INTEGRAÇÃO BIBLIOLED NO OPAC KOHA
   Miguel Mimoso Correia CC-BY-NC-SA

   - Pesquisa por título
   - Confirma título + autor
   - Não utiliza ISBN
   - Ignora edição e editora
   - Consulta disponibilidade
   - Só mostra o botão quando encontra a obra
   ===================================== */

(function () {
  "use strict";

  var BIBLIOLED_PROXY =
    "https://biblioled-oeiras.miguelcorreia-a94.workers.dev";

  var BIBLIOLED_ICON =
    "https://bibliotecas.oeiras.pt/wp-content/uploads/2026/05/biblioled_icon.png";

  var MAX_RESULTS = 20;

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeText(value) {
    var text = cleanText(value);

    if (typeof text.normalize === "function") {
      text = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanTitle(value) {
    return cleanText(value)
      .replace(/\s*\/.*$/g, "")
      .replace(/[;,.\[\]\(\)"'«»“”‘’!?]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanAuthor(value) {
    return cleanText(value)
      .replace(/^por\s+/i, "")
      .replace(/\s*\/.*$/g, "")
      .replace(/\s*;\s*.*$/g, "")
      .replace(/\bet al\.?.*$/i, "")
      .replace(/[;,:\[\]\(\)"'«»“”‘’!?]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getBiblionumber() {
    var match =
      location.href.match(/[?&]biblionumber=(\d+)/);

    return match ? match[1] : "";
  }

  function getMarcUrl() {
    var biblionumber = getBiblionumber();

    if (!biblionumber) {
      return "";
    }

    return (
      "/cgi-bin/koha/opac-MARCdetail.pl?biblionumber=" +
      encodeURIComponent(biblionumber)
    );
  }

  /*
   * Extrai:
   * 200$a — título próprio
   * 200$f — primeira menção de responsabilidade
   */
  function extractFrom200(html) {
    var page = $("<div>").html(html);

    var title = "";
    var author = "";
    var inside200 = false;

    page.find("tr").each(function () {
      var $row = $(this);
      var rowText = cleanText($row.text());

      if (/^200\b/.test(rowText)) {
        inside200 = true;
        return;
      }

      if (inside200 && /^\d{3}\b/.test(rowText)) {
        inside200 = false;
      }

      if (!inside200) {
        return;
      }

      var label = cleanText(
        $row.find("td").eq(0).text()
      )
        .replace(/:$/, "")
        .toLowerCase();

      var value = cleanText(
        $row.find("td").eq(1).text()
      );

      if (!label || !value) {
        return;
      }

      if (
        (
          label === "título próprio" ||
          label === "titulo proprio"
        ) &&
        !title
      ) {
        title = value;
      }

      if (
        (
          label === "primeira menção de responsabilidade" ||
          label === "primeira mencao de responsabilidade"
        ) &&
        !author
      ) {
        author = value;
      }
    });

    return {
      title: cleanTitle(title),
      author: cleanAuthor(author)
    };
  }

  function fallbackTitleFromOpac() {
    return cleanTitle(
      $(
        "#catalogue_detail_biblio h1, " +
        "#bibliodescriptions h1, h1"
      )
        .first()
        .text()
    );
  }

  function fallbackAuthorFromOpac() {
    var author = "";

    $(".results_summary").each(function () {
      var label = cleanText(
        $(this).find(".label").first().text()
      )
        .replace(/:$/, "")
        .toLowerCase();

      if (
        label === "autor" ||
        label === "autores" ||
        label === "autor principal" ||
        label === "co-autor" ||
        label === "coautor"
      ) {
        author = cleanAuthor(
          $(this).find("a").first().text()
        );

        return false;
      }
    });

    return author;
  }

  function getSearchUrl(title) {
    return (
      BIBLIOLED_PROXY +
      "/resources.json?title=" +
      encodeURIComponent(title)
    );
  }

  function getDetailUrl(resourceId) {
    return (
      BIBLIOLED_PROXY +
      "/resources/" +
      encodeURIComponent(resourceId) +
      ".json"
    );
  }

  function getResources(response) {
    if (!response) {
      return [];
    }

    if (Array.isArray(response.resources)) {
      return response.resources;
    }

    if (
      response.resources &&
      Array.isArray(response.resources.resource)
    ) {
      return response.resources.resource;
    }

    if (Array.isArray(response.resource)) {
      return response.resource;
    }

    if (Array.isArray(response)) {
      return response;
    }

    return [];
  }

  function getDetailResource(response) {
    if (!response) {
      return null;
    }

    return (
      response.resource ||
      response
    );
  }

  function getTitleWords(title) {
    var ignored = [
      "a", "as", "o", "os",
      "um", "uma", "uns", "umas",
      "de", "da", "das", "do", "dos",
      "e", "em", "no", "na", "nos", "nas",
      "por", "para", "com",
      "the", "of", "and"
    ];

    return normalizeText(title)
      .split(" ")
      .filter(function (word) {
        return (
          word.length > 1 &&
          ignored.indexOf(word) === -1
        );
      });
  }

  function titleMatches(kohaTitle, resourceTitle) {
    var first = normalizeText(kohaTitle);
    var second = normalizeText(resourceTitle);

    if (!first || !second) {
      return false;
    }

    if (first === second) {
      return true;
    }

    /*
     * Permite diferenças de subtítulo.
     *
     * Exemplo:
     * Os Maias
     * Os Maias: episódios da vida romântica
     */
    if (
      first.indexOf(second) === 0 ||
      second.indexOf(first) === 0
    ) {
      return true;
    }

    var firstWords = getTitleWords(first);
    var secondWords = getTitleWords(second);

    if (!firstWords.length || !secondWords.length) {
      return false;
    }

    var common = firstWords.filter(function (word) {
      return secondWords.indexOf(word) !== -1;
    });

    var score =
      common.length /
      Math.max(
        firstWords.length,
        secondWords.length
      );

    return score >= 0.8;
  }

  function getContributorName(contributor) {
    if (!contributor) {
      return "";
    }

    if (typeof contributor === "string") {
      return contributor;
    }

    return cleanText(
      [
        contributor.first_name,
        contributor.last_name
      ]
        .filter(Boolean)
        .join(" ")
    );
  }

  function getAuthors(resource) {
    var contributors =
      resource.contributors || [];

    if (
      contributors &&
      !Array.isArray(contributors) &&
      contributors.contributor
    ) {
      contributors =
        contributors.contributor;
    }

    if (!Array.isArray(contributors)) {
      contributors = [contributors];
    }

    return contributors
      .filter(function (contributor) {
        var nature = normalizeText(
          contributor &&
          contributor.nature
        );

        /*
         * Na resposta real da BiblioLED,
         * o autor vem identificado como:
         *
         * nature: "author"
         */
        return (
          !nature ||
          nature === "author" ||
          nature === "autor"
        );
      })
      .map(getContributorName)
      .filter(Boolean);
  }

  function getAuthorWords(author) {
    var ignored = [
      "de", "da", "das", "do", "dos",
      "e", "van", "von", "del", "di"
    ];

    return normalizeText(author)
      .split(" ")
      .filter(function (word) {
        return (
          word.length >= 3 &&
          ignored.indexOf(word) === -1
        );
      });
  }

  function authorMatches(kohaAuthor, resource) {
    var kohaWords =
      getAuthorWords(kohaAuthor);

    var resourceAuthors =
      getAuthors(resource);

    if (
      !kohaWords.length ||
      !resourceAuthors.length
    ) {
      return false;
    }

    return resourceAuthors.some(function (
      resourceAuthor
    ) {
      var resourceWords =
        getAuthorWords(resourceAuthor);

      var common =
        kohaWords.filter(function (word) {
          return (
            resourceWords.indexOf(word) !== -1
          );
        });

      /*
       * Exige pelo menos duas palavras coincidentes,
       * quando ambos os nomes têm duas ou mais palavras.
       *
       * Exemplo:
       * Eça de Queirós
       * José Maria Eça de Queirós
       */
      var required =
        Math.min(
          2,
          kohaWords.length,
          resourceWords.length
        );

      return common.length >= required;
    });
  }

  function findMatchingResource(
    resources,
    title,
    author
  ) {
    var candidates = resources
      .filter(function (resource) {
        return (
          resource &&
          resource.id &&
          resource.title &&
          titleMatches(
            title,
            resource.title
          ) &&
          authorMatches(
            author,
            resource
          )
        );
      });

    if (!candidates.length) {
      return null;
    }

    /*
     * Dá preferência a título exatamente igual.
     */
    candidates.sort(function (first, second) {
      var firstExact =
        normalizeText(first.title) ===
        normalizeText(title);

      var secondExact =
        normalizeText(second.title) ===
        normalizeText(title);

      if (firstExact && !secondExact) {
        return -1;
      }

      if (!firstExact && secondExact) {
        return 1;
      }

      return 0;
    });

    return candidates[0];
  }

  function normalizeMedia(resource) {
    var media =
      resource.media || [];

    if (
      media &&
      !Array.isArray(media) &&
      media.medium
    ) {
      media = media.medium;
    }

    if (!Array.isArray(media)) {
      media = [media];
    }

    return media.filter(Boolean);
  }

  function normalizeLoans(medium) {
    var loans =
      medium &&
      medium.loans !== undefined
        ? medium.loans
        : [];

    if (
      loans &&
      !Array.isArray(loans) &&
      loans.loan
    ) {
      loans = loans.loan;
    }

    if (!Array.isArray(loans)) {
      loans = [loans];
    }

    return loans.filter(Boolean);
  }

  function normalizeReturnDates(value) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (value.return_date) {
      return Array.isArray(value.return_date)
        ? value.return_date
        : [value.return_date];
    }

    if (value.date) {
      return Array.isArray(value.date)
        ? value.date
        : [value.date];
    }

    return [value];
  }

  function getAvailability(resource) {
    var media = normalizeMedia(resource);

    var available = 0;
    var total = 0;
    var hasAvailabilityData = false;
    var returnDates = [];

    media.forEach(function (medium) {
      /*
       * Algumas respostas podem colocar
       * available e total diretamente no suporte.
       */
      if (
        medium.available !== undefined ||
        medium.total !== undefined
      ) {
        hasAvailabilityData = true;

        available += Number(
          medium.available || 0
        );

        total += Number(
          medium.total || 0
        );

        returnDates = returnDates.concat(
          normalizeReturnDates(
            medium.return_dates
          )
        );
      }

      var loans = normalizeLoans(medium);

      loans.forEach(function (loan) {
        if (
          loan.available !== undefined ||
          loan.total !== undefined
        ) {
          hasAvailabilityData = true;

          available += Number(
            loan.available || 0
          );

          total += Number(
            loan.total || 0
          );
        }

        returnDates = returnDates.concat(
          normalizeReturnDates(
            loan.return_dates
          )
        );
      });
    });

    if (!hasAvailabilityData) {
      return {
        state: "unknown",
        available: null,
        total: null,
        returnDates: []
      };
    }

    if (available > 0) {
      return {
        state: "available",
        available: available,
        total: total,
        returnDates: returnDates
      };
    }

    return {
      state: "unavailable",
      available: 0,
      total: total,
      returnDates: returnDates
    };
  }

  function getNextReturnDate(returnDates) {
    var dates = returnDates
      .map(function (value) {
        return new Date(value);
      })
      .filter(function (date) {
        return !isNaN(date.getTime());
      })
      .sort(function (first, second) {
        return (
          first.getTime() -
          second.getTime()
        );
      });

    return dates.length
      ? dates[0]
      : null;
  }

  function formatDate(date) {
    return date.toLocaleDateString(
      "pt-PT",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }
    );
  }

  function injectCSS() {
    if (
      document.getElementById(
        "rbmo-biblioled-style"
      )
    ) {
      return;
    }

    var style =
      document.createElement("style");

    style.id =
      "rbmo-biblioled-style";

    style.textContent = `
      .rbmo-biblioled {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        margin: 7px 0 13px 0;
      }

      .rbmo-biblioled-btn {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 6px 12px;
        font-size: 12.5px;
        font-weight: 500;
        color: #475569;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        text-decoration: none;
        line-height: 1.2;
        transition:
          color .15s ease,
          background .15s ease,
          border-color .15s ease;
      }

      .rbmo-biblioled-btn:hover,
      .rbmo-biblioled-btn:focus {
        color: #0080a3;
        background: #f0f9ff;
        border-color: #7dd3fc;
        text-decoration: none;
      }

      .rbmo-biblioled-btn img {
        width: auto;
        height: 17px;
      }

      .rbmo-biblioled-status {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 9px;
        font-size: 11.5px;
        font-weight: 600;
        border-radius: 999px;
      }

      .rbmo-biblioled-status::before {
        display: inline-block;
        width: 7px;
        height: 7px;
        border-radius: 50%;
        content: "";
      }

      .rbmo-biblioled-status--available {
        color: #166534;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
      }

      .rbmo-biblioled-status--available::before {
        background: #22c55e;
      }

      .rbmo-biblioled-status--unavailable {
        color: #9a3412;
        background: #fff7ed;
        border: 1px solid #fed7aa;
      }

      .rbmo-biblioled-status--unavailable::before {
        background: #f97316;
      }

      .rbmo-biblioled-status--unknown {
        color: #475569;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }

      .rbmo-biblioled-status--unknown::before {
        background: #94a3b8;
      }

      .rbmo-biblioled-return {
        width: 100%;
        margin-left: 3px;
        font-size: 11.5px;
        color: #64748b;
      }
    `;

    document.head.appendChild(style);
  }

  function createButton(
    resource,
    availability
  ) {
    var wrapper =
      document.createElement("div");

    wrapper.className =
      "rbmo-biblioled";

    var link =
      document.createElement("a");

    link.href =
      resource.link ||
      "https://aml.biblioled.gov.pt";

    link.target = "_blank";
    link.rel = "noopener";
    link.className =
      "rbmo-biblioled-btn";

    link.innerHTML =
      '<img src="' +
      BIBLIOLED_ICON +
      '" alt="">' +
      "<span>Também disponível na BiblioLED</span>";

    wrapper.appendChild(link);

    var status =
      document.createElement("span");

    status.className =
      "rbmo-biblioled-status " +
      "rbmo-biblioled-status--" +
      availability.state;

    if (
      availability.state === "available"
    ) {
      status.textContent =
        availability.available === 1
          ? "Disponível para empréstimo"
          : availability.available +
            " empréstimos disponíveis";
    } else if (
      availability.state === "unavailable"
    ) {
      status.textContent =
        "Temporariamente indisponível";
    } else {
      status.textContent =
        "Consultar disponibilidade";
    }

    wrapper.appendChild(status);

    if (
      availability.state === "unavailable" &&
      availability.returnDates.length
    ) {
      var nextReturn =
        getNextReturnDate(
          availability.returnDates
        );

      if (nextReturn) {
        var returnElement =
          document.createElement("span");

        returnElement.className =
          "rbmo-biblioled-return";

        returnElement.textContent =
          "Próxima devolução prevista: " +
          formatDate(nextReturn);

        wrapper.appendChild(
          returnElement
        );
      }
    }

    return wrapper;
  }

  function insertButton(element) {
    if (
      document.querySelector(
        ".rbmo-biblioled"
      )
    ) {
      return;
    }

    var target =
      document.querySelector(
        "#catalogue_detail_biblio h1"
      ) ||
      document.querySelector(
        "#bibliodescriptions h1"
      ) ||
      document.querySelector("h1");

    if (target) {
      target.insertAdjacentElement(
        "afterend",
        element
      );
    }
  }

  async function init() {
    if (
      location.pathname.indexOf(
        "/cgi-bin/koha/opac-detail.pl"
      ) === -1
    ) {
      return;
    }

    injectCSS();

    var marcUrl = getMarcUrl();

    if (!marcUrl) {
      return;
    }

    try {
      var marcResponse =
        await fetch(marcUrl);

      if (!marcResponse.ok) {
        throw new Error(
          "Erro ao consultar a vista MARC: " +
          marcResponse.status
        );
      }

      var marcHtml =
        await marcResponse.text();

      var marcData =
        extractFrom200(marcHtml);

      var title =
        marcData.title ||
        fallbackTitleFromOpac();

      var author =
        marcData.author ||
        fallbackAuthorFromOpac();

      console.log(
        "BiblioLED — título Koha:",
        title
      );

      console.log(
        "BiblioLED — autor Koha:",
        author
      );

      if (!title || !author) {
        console.warn(
          "BiblioLED — não foi possível obter título e autor."
        );

        return;
      }

      var searchResponse =
        await fetch(
          getSearchUrl(title),
          {
            headers: {
              "Accept": "application/json"
            }
          }
        );

      if (!searchResponse.ok) {
        throw new Error(
          "Erro na pesquisa BiblioLED: " +
          searchResponse.status
        );
      }

      var searchData =
        await searchResponse.json();

      var resources =
        getResources(searchData)
          .slice(0, MAX_RESULTS);

      console.log(
        "BiblioLED — resultados:",
        resources
      );

      var selectedResource =
        findMatchingResource(
          resources,
          title,
          author
        );

      if (!selectedResource) {
        console.log(
          "BiblioLED — nenhuma correspondência por título e autor."
        );

        window._rbmo_biblioled = {
          title: title,
          author: author,
          resources: resources,
          selectedResource: null
        };

        return;
      }

      /*
       * Consulta a ficha individual para obter
       * todos os dados de disponibilidade.
       */
      var detailResponse =
        await fetch(
          getDetailUrl(
            selectedResource.id
          ),
          {
            headers: {
              "Accept": "application/json"
            }
          }
        );

      var detailedResource =
        selectedResource;

      if (detailResponse.ok) {
        var detailData =
          await detailResponse.json();

        detailedResource =
          getDetailResource(detailData) ||
          selectedResource;
      }

      /*
       * Conserva o link da listagem caso não venha
       * na ficha individual.
       */
      if (
        !detailedResource.link &&
        selectedResource.link
      ) {
        detailedResource.link =
          selectedResource.link;
      }

      var availability =
        getAvailability(
          detailedResource
        );

      console.log(
        "BiblioLED — recurso encontrado:",
        detailedResource
      );

      console.log(
        "BiblioLED — disponibilidade:",
        availability
      );

      window._rbmo_biblioled = {
        title: title,
        author: author,
        resources: resources,
        selectedResource:
          detailedResource,
        availability:
          availability
      };

      insertButton(
        createButton(
          detailedResource,
          availability
        )
      );
    } catch (error) {
      console.error(
        "BiblioLED — erro:",
        error
      );
    }
  }

  $(document).ready(init);

})();
