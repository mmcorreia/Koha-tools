/* ==========================================
   INTEGRAÇÃO BIBLIOLED NO OPAC KOHA
   Miguel Mimoso Correia — CC-BY-NC-SA

   - Pesquisa por título
   - Confirma título + autor
   - Não utiliza ISBN
   - Reúne todas as edições da mesma obra
   - Consulta a ficha completa de cada recurso
   - Soma licenças disponíveis
   - Soma licenças totais
   - Soma reservas
   - Mostra próxima devolução
   ========================================== */

(function () {
  "use strict";

  var BIBLIOLED_PROXY =
    "https://biblioled-oeiras.miguelcorreia-a94.workers.dev";

  var BIBLIOLED_API =
    BIBLIOLED_PROXY + "/resources.json";

  var BIBLIOLED_DETAIL_API =
    BIBLIOLED_PROXY + "/resources/";

  var BIBLIOLED_PUBLIC_SEARCH =
    "https://aml.biblioled.gov.pt/resources";

  var BIBLIOLED_ICON =
    "https://bibliotecas.oeiras.pt/wp-content/uploads/2026/05/biblioled_icon.png";

  var MAX_RESULTS = 50;
  var MAX_DETAIL_REQUESTS = 10;
  var DEBUG = true;

  function log() {
    if (!DEBUG || !window.console) {
      return;
    }

    console.log.apply(
      console,
      ["BiblioLED —"].concat(
        Array.prototype.slice.call(arguments)
      )
    );
  }

  function warn() {
    if (!window.console) {
      return;
    }

    console.warn.apply(
      console,
      ["BiblioLED —"].concat(
        Array.prototype.slice.call(arguments)
      )
    );
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function removeAccents(value) {
    var text = String(value || "");

    if (typeof text.normalize === "function") {
      text = text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    }

    return text;
  }

  function normalizeText(value) {
    return removeAccents(
      cleanText(value)
    )
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanTitle(value) {
    return cleanText(value)
      .replace(/\s*\/.*$/g, "")
      .replace(/\s*:\s*.*$/g, "")
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

  function encodeParameter(value) {
    return encodeURIComponent(value || "")
      .replace(/%20/g, "+");
  }

  function getBiblionumber() {
    var match =
      window.location.href.match(
        /[?&]biblionumber=(\d+)/
      );

    return match ? match[1] : "";
  }

  function getMarcUrl() {
    var biblionumber =
      getBiblionumber();

    if (!biblionumber) {
      return "";
    }

    return (
      "/cgi-bin/koha/opac-MARCdetail.pl" +
      "?biblionumber=" +
      encodeURIComponent(biblionumber)
    );
  }

  function extractFrom200(html) {
    var page =
      $("<div>").html(html);

    var title = "";
    var author = "";
    var inside200 = false;

    page.find("tr").each(function () {
      var row = $(this);
      var rowText =
        cleanText(row.text());

      if (/^200\b/.test(rowText)) {
        inside200 = true;
        return;
      }

      if (
        inside200 &&
        /^\d{3}\b/.test(rowText)
      ) {
        inside200 = false;
      }

      if (!inside200) {
        return;
      }

      var cells =
        row.find("td");

      if (cells.length < 2) {
        return;
      }

      var label =
        normalizeText(
          cells.eq(0).text()
        );

      var value =
        cleanText(
          cells.eq(1).text()
        );

      if (!label || !value) {
        return;
      }

      if (
        label === "titulo proprio" &&
        !title
      ) {
        title = value;
      }

      if (
        label ===
          "primeira mencao de responsabilidade" &&
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
        "#bibliodescriptions h1, " +
        "h1"
      )
        .first()
        .text()
    );
  }

  function fallbackAuthorFromOpac() {
    var author = "";

    $(".results_summary").each(function () {
      var block = $(this);

      var label =
        normalizeText(
          block
            .find(".label")
            .first()
            .text()
        );

      if (
        label === "autor" ||
        label === "autores" ||
        label === "autor principal" ||
        label === "co autor" ||
        label === "coautor"
      ) {
        author =
          cleanAuthor(
            block
              .find("a")
              .first()
              .text()
          );

        if (!author) {
          var copy =
            block.clone();

          copy
            .find(".label")
            .remove();

          author =
            cleanAuthor(
              copy.text()
            );
        }

        return false;
      }
    });

    return author;
  }

  function getApiSearchUrl(title) {
    return (
      BIBLIOLED_API +
      "?title=" +
      encodeParameter(title)
    );
  }

  function getDetailUrl(resourceId) {
    return (
      BIBLIOLED_DETAIL_API +
      encodeURIComponent(resourceId) +
      ".json"
    );
  }

  function getPublicSearchUrl(
    title,
    author
  ) {
    return (
      BIBLIOLED_PUBLIC_SEARCH +
      "?keywords=" +
      encodeParameter(title) +
      "&isbn=" +
      "&author=" +
      encodeParameter(author) +
      "&narrator=" +
      "&publisher=" +
      "&collection_title=" +
      "&issued_on_range=" +
      "&language=" +
      "&audience=" +
      "&category_standard=feedbooks" +
      "&category=" +
      "&nature=" +
      "&medium="
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
      Array.isArray(
        response.resources.resource
      )
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

    if (response.resource) {
      return response.resource;
    }

    if (
      response.resources &&
      response.resources.resource
    ) {
      return response.resources.resource;
    }

    return response;
  }

  function uniqueWords(words) {
    return words.filter(function (
      word,
      index,
      array
    ) {
      return array.indexOf(word) === index;
    });
  }

  function getTitleWords(value) {
    var ignoredWords = [
      "a", "as", "o", "os",
      "um", "uma", "uns", "umas",
      "de", "da", "das", "do", "dos",
      "e", "em", "no", "na", "nos", "nas",
      "por", "para", "com", "ao", "aos",
      "the", "of", "and", "in", "on", "to"
    ];

    return uniqueWords(
      normalizeText(value)
        .split(" ")
        .filter(function (word) {
          return (
            word.length > 1 &&
            ignoredWords.indexOf(word) === -1
          );
        })
    );
  }

  function getTitleScore(
    kohaTitle,
    resourceTitle
  ) {
    var first =
      normalizeText(kohaTitle);

    var second =
      normalizeText(resourceTitle);

    if (!first || !second) {
      return 0;
    }

    if (first === second) {
      return 1;
    }

    if (
      first.indexOf(second) === 0 ||
      second.indexOf(first) === 0
    ) {
      return 0.95;
    }

    var firstWords =
      getTitleWords(first);

    var secondWords =
      getTitleWords(second);

    if (
      !firstWords.length ||
      !secondWords.length
    ) {
      return 0;
    }

    var commonWords =
      firstWords.filter(function (word) {
        return (
          secondWords.indexOf(word) !== -1
        );
      });

    return (
      commonWords.length /
      Math.max(
        firstWords.length,
        secondWords.length
      )
    );
  }

  function titleMatches(
    kohaTitle,
    resourceTitle
  ) {
    return (
      getTitleScore(
        kohaTitle,
        resourceTitle
      ) >= 0.8
    );
  }

  function normalizeContributors(resource) {
    var contributors =
      resource &&
      resource.contributors
        ? resource.contributors
        : [];

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

    return contributors.filter(Boolean);
  }

  function getContributorName(
    contributor
  ) {
    if (!contributor) {
      return "";
    }

    if (typeof contributor === "string") {
      return cleanText(contributor);
    }

    return (
      cleanText(
        [
          contributor.first_name,
          contributor.last_name
        ]
          .filter(Boolean)
          .join(" ")
      ) ||
      cleanText(contributor.name) ||
      cleanText(contributor.full_name) ||
      cleanText(contributor.label)
    );
  }

  function getResourceAuthors(resource) {
    return normalizeContributors(resource)
      .map(getContributorName)
      .filter(Boolean);
  }

  function getAuthorWords(value) {
    var ignoredWords = [
      "de", "da", "das", "do", "dos",
      "e", "van", "von", "del", "di"
    ];

    return uniqueWords(
      normalizeText(value)
        .split(" ")
        .filter(function (word) {
          return (
            word.length >= 3 &&
            ignoredWords.indexOf(word) === -1
          );
        })
    );
  }

  function authorMatches(
    kohaAuthor,
    resource
  ) {
    var kohaWords =
      getAuthorWords(kohaAuthor);

    var resourceAuthors =
      getResourceAuthors(resource);

    if (
      !kohaWords.length ||
      !resourceAuthors.length
    ) {
      return false;
    }

    return resourceAuthors.some(
      function (resourceAuthor) {
        var resourceWords =
          getAuthorWords(resourceAuthor);

        var commonWords =
          kohaWords.filter(function (word) {
            return (
              resourceWords.indexOf(word) !== -1
            );
          });

        var required =
          kohaWords.length === 1
            ? 1
            : Math.min(
                2,
                kohaWords.length,
                resourceWords.length
              );

        return commonWords.length >= required;
      }
    );
  }

  function findMatchingResources(
    resources,
    title,
    author
  ) {
    return resources
      .filter(function (resource) {
        return (
          resource &&
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
      })
      .sort(function (
        first,
        second
      ) {
        return (
          getTitleScore(
            title,
            second.title
          ) -
          getTitleScore(
            title,
            first.title
          )
        );
      });
  }

  function requestDetail(resource) {
    return new Promise(function (resolve) {
      if (!resource || !resource.id) {
        resolve(resource);
        return;
      }

      $.ajax({
        url: getDetailUrl(resource.id),
        method: "GET",
        dataType: "json",
        timeout: 15000,
        headers: {
          Accept: "application/json"
        }
      })
        .done(function (response) {
          var detail =
            getDetailResource(response);

          if (!detail) {
            resolve(resource);
            return;
          }

          if (!detail.link && resource.link) {
            detail.link = resource.link;
          }

          if (
            !detail.contributors &&
            resource.contributors
          ) {
            detail.contributors =
              resource.contributors;
          }

          if (
            !detail.media &&
            resource.media
          ) {
            detail.media =
              resource.media;
          }

          resolve(detail);
        })
        .fail(function () {
          resolve(resource);
        });
    });
  }

  function normalizeMedia(resource) {
    var media =
      resource &&
      resource.media
        ? resource.media
        : [];

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
    if (!medium || !medium.loans) {
      return [];
    }

    if (Array.isArray(medium.loans)) {
      return medium.loans;
    }

    if (medium.loans.loan) {
      return Array.isArray(
        medium.loans.loan
      )
        ? medium.loans.loan
        : [medium.loans.loan];
    }

    return [medium.loans];
  }

  function normalizeReturnDates(value) {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value;
    }

    if (value.return_date) {
      return Array.isArray(
        value.return_date
      )
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
    var media =
      normalizeMedia(resource);

    var available = 0;
    var total = 0;
    var holds = 0;
    var hasData = false;
    var returnDates = [];

    media.forEach(function (medium) {
      if (
        medium.current_holds !== undefined
      ) {
        holds += Number(
          medium.current_holds || 0
        );
      }

      var loans =
        normalizeLoans(medium);

      loans.forEach(function (loan) {
        if (
          loan.available !== undefined ||
          loan.total !== undefined ||
          loan.return_dates !== undefined
        ) {
          hasData = true;
        }

        available += Number(
          loan.available || 0
        );

        total += Number(
          loan.total || 0
        );

        returnDates =
          returnDates.concat(
            normalizeReturnDates(
              loan.return_dates
            )
          );
      });
    });

    return {
      state:
        !hasData
          ? "unknown"
          : available > 0
            ? "available"
            : "unavailable",
      available: available,
      total: total,
      holds: holds,
      returnDates: returnDates
    };
  }

  function getCombinedAvailability(resources) {
    var available = 0;
    var total = 0;
    var holds = 0;
    var hasData = false;
    var returnDates = [];

    resources.forEach(function (resource) {
      var availability =
        getAvailability(resource);

      if (
        availability.state !== "unknown"
      ) {
        hasData = true;
      }

      available += Number(
        availability.available || 0
      );

      total += Number(
        availability.total || 0
      );

      holds += Number(
        availability.holds || 0
      );

      returnDates =
        returnDates.concat(
          availability.returnDates || []
        );
    });

    return {
      state:
        !hasData
          ? "unknown"
          : available > 0
            ? "available"
            : "unavailable",
      available: available,
      total: total,
      holds: holds,
      returnDates: returnDates
    };
  }

  function getNextReturnDate(returnDates) {
    var now =
      new Date().getTime();

    var dates =
      returnDates
        .map(function (value) {
          return new Date(value);
        })
        .filter(function (date) {
          return (
            !isNaN(date.getTime()) &&
            date.getTime() >= now
          );
        })
        .sort(function (
          first,
          second
        ) {
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

    style.textContent = [
      ".rbmo-biblioled {",
      "display:flex;",
      "align-items:center;",
      "flex-wrap:wrap;",
      "gap:8px;",
      "margin:7px 0 13px 0;",
      "}",

      ".rbmo-biblioled-btn {",
      "display:inline-flex;",
      "align-items:center;",
      "gap:7px;",
      "padding:6px 12px;",
      "font-size:12.5px;",
      "font-weight:500;",
      "color:#0076a3;",
      "background:#f8fafc;",
      "border:1px solid #dbe4ea;",
      "border-radius:999px;",
      "text-decoration:none;",
      "}",

      ".rbmo-biblioled-btn img {",
      "height:17px;",
      "width:auto;",
      "}",

      ".rbmo-biblioled-status {",
      "display:inline-flex;",
      "align-items:center;",
      "gap:5px;",
      "padding:4px 9px;",
      "font-size:11.5px;",
      "font-weight:600;",
      "border-radius:999px;",
      "}",

      ".rbmo-biblioled-status::before {",
      "content:'';",
      "width:7px;",
      "height:7px;",
      "border-radius:50%;",
      "}",

      ".rbmo-biblioled-status--available {",
      "color:#166534;",
      "background:#f0fdf4;",
      "border:1px solid #bbf7d0;",
      "}",

      ".rbmo-biblioled-status--available::before {",
      "background:#22c55e;",
      "}",

      ".rbmo-biblioled-status--unavailable {",
      "color:#9a3412;",
      "background:#fff7ed;",
      "border:1px solid #fed7aa;",
      "}",

      ".rbmo-biblioled-status--unavailable::before {",
      "background:#f97316;",
      "}",

      ".rbmo-biblioled-status--unknown {",
      "color:#475569;",
      "background:#f8fafc;",
      "border:1px solid #e2e8f0;",
      "}",

      ".rbmo-biblioled-status--unknown::before {",
      "background:#94a3b8;",
      "}",

      ".rbmo-biblioled-return {",
      "width:100%;",
      "font-size:11.5px;",
      "color:#64748b;",
      "}"
    ].join("\n");

    document.head.appendChild(style);
  }

  function createButton(
    resources,
    title,
    author,
    availability
  ) {
    var wrapper =
      document.createElement("div");

    wrapper.className =
      "rbmo-biblioled";

    var link =
      document.createElement("a");

    link.href =
      getPublicSearchUrl(
        title,
        author
      );

    link.target = "_blank";
    link.rel = "noopener";
    link.className =
      "rbmo-biblioled-btn";

    var image =
      document.createElement("img");

    image.src =
      BIBLIOLED_ICON;

    image.alt =
      "BiblioLED";

    var linkText =
      document.createElement("span");

    linkText.textContent =
      resources.length === 1
        ? "Ver na BiblioLED"
        : "Ver " +
          resources.length +
          " edições na BiblioLED";

    link.appendChild(image);
    link.appendChild(linkText);
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
          ? "1 licença disponível"
          : availability.available +
            " licenças disponíveis";

      if (availability.total > 0) {
        status.textContent +=
          " de " +
          availability.total;
      }
    } else if (
      availability.state === "unavailable"
    ) {
      status.textContent =
        "0 licenças disponíveis";

      if (availability.total > 0) {
        status.textContent +=
          " de " +
          availability.total;
      }
    } else {
      status.textContent =
        "Disponibilidade não fornecida pela API";
    }

    if (availability.holds > 0) {
      status.textContent +=
        " · " +
        availability.holds +
        (
          availability.holds === 1
            ? " reserva"
            : " reservas"
        );
    }

    wrapper.appendChild(status);

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

  function init() {
    if (
      window.location.pathname.indexOf(
        "/cgi-bin/koha/opac-detail.pl"
      ) === -1
    ) {
      return;
    }

    injectCSS();

    $.ajax({
      url: getMarcUrl(),
      method: "GET",
      dataType: "html",
      timeout: 15000
    })
      .done(function (html) {
        var marcData =
          extractFrom200(html);

        var title =
          marcData.title ||
          fallbackTitleFromOpac();

        var author =
          marcData.author ||
          fallbackAuthorFromOpac();

        log("título:", title);
        log("autor:", author);

        if (!title || !author) {
          return;
        }

        $.ajax({
          url: getApiSearchUrl(title),
          method: "GET",
          dataType: "json",
          timeout: 20000
        })
          .done(function (response) {
            var resources =
              getResources(response)
                .slice(0, MAX_RESULTS);

            var matches =
              findMatchingResources(
                resources,
                title,
                author
              );

            if (!matches.length) {
              return;
            }

            var detailCandidates =
              matches.slice(
                0,
                MAX_DETAIL_REQUESTS
              );

            Promise.all(
              detailCandidates.map(
                requestDetail
              )
            ).then(function (
              detailedResources
            ) {
              var availability =
                getCombinedAvailability(
                  detailedResources
                );

              log(
                "fichas completas:",
                detailedResources
              );

              log(
                "disponibilidade:",
                availability
              );

              window._rbmo_biblioled = {
                title: title,
                author: author,
                matchingResources:
                  detailedResources,
                editions:
                  detailedResources.length,
                available:
                  availability.available,
                total:
                  availability.total,
                holds:
                  availability.holds,
                returnDates:
                  availability.returnDates,
                availability:
                  availability
              };

              insertButton(
                createButton(
                  detailedResources,
                  title,
                  author,
                  availability
                )
              );
            });
          });
      });
  }

  if (
    typeof window.jQuery === "undefined"
  ) {
    return;
  }

  $(document).ready(init);
})();
