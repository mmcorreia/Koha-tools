/* ==========================================
   INTEGRAÇÃO BIBLIOLED NO OPAC KOHA
   Miguel Mimoso Correia — CC-BY-NC-SA

   Funcionalidades:
   - extrai título e autor do campo UNIMARC 200;
   - pesquisa a API BiblioLED por título;
   - valida localmente título + autor;
   - não utiliza ISBN;
   - ignora edição e editora na pesquisa (mas mostra-as no detalhe);
   - reúne todas as edições da mesma obra;
   - apresenta cartão isolado logo abaixo do título, separado dos
     exemplares físicos, com logótipo BiblioLED e estado agregado;
   - painel expansível com uma linha por edição (editora/ano,
     suporte, estado, reservas);
   - abre a pesquisa pública filtrada por título e autor;
   - só mostra o cartão quando encontra pelo menos uma correspondência.
   ========================================== */

(function () {
  "use strict";

  var BIBLIOLED_PROXY =
    "https://biblioled-oeiras.miguelcorreia-a94.workers.dev";

  var BIBLIOLED_API =
    BIBLIOLED_PROXY + "/resources.json";

  var BIBLIOLED_PUBLIC_SEARCH =
    "https://aml.biblioled.gov.pt/resources";

  var BIBLIOLED_ICON =
    "https://bibliotecas.oeiras.pt/wp-content/uploads/2026/05/biblioled_icon.png";

  var MAX_RESULTS = 50;
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
    return removeAccents(cleanText(value))
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
    var match = window.location.href.match(
      /[?&]biblionumber=(\d+)/
    );

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

  function extractFrom200(html) {
    var page = $("<div>").html(html);

    var title = "";
    var author = "";
    var inside200 = false;

    page.find("tr").each(function () {
      var row = $(this);
      var rowText = cleanText(row.text());

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

      var cells = row.find("td");

      if (cells.length < 2) {
        return;
      }

      var label = normalizeText(
        cells.eq(0).text()
      );

      var value = cleanText(
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
        label === "primeira mencao de responsabilidade" &&
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

      var label = normalizeText(
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
        author = cleanAuthor(
          block
            .find("a")
            .first()
            .text()
        );

        if (!author) {
          var copy = block.clone();

          copy
            .find(".label")
            .remove();

          author = cleanAuthor(
            copy.text()
          );
        }

        return false;
      }
    });

    return author;
  }

  function fallbackSecondaryAuthorsFromOpac() {
    var authors = [];

    $(".results_summary").each(function () {
      var block = $(this);

      var label = normalizeText(
        block
          .find(".label")
          .first()
          .text()
      );

      if (
        label === "autor secundario" ||
        label === "autores secundarios" ||
        label === "outro autor" ||
        label === "outros autores"
      ) {
        block.find("a").each(function () {
          var author = cleanAuthor(
            $(this).text()
          );

          if (author) {
            authors.push(author);
          }
        });
      }
    });

    return authors;
  }

  function getKohaAuthorCandidates(
    primaryAuthor,
    secondaryAuthors
  ) {
    var candidates = [];

    if (primaryAuthor) {
      candidates.push(primaryAuthor);
    }

    secondaryAuthors.forEach(function (author) {
      if (candidates.indexOf(author) === -1) {
        candidates.push(author);
      }
    });

    return candidates;
  }

  function getApiSearchUrl(title) {
    return (
      BIBLIOLED_API +
      "?title=" +
      encodeParameter(title)
    );
  }

  function getApiResourceUrl(id) {
    return (
      BIBLIOLED_PROXY +
      "/resources/" +
      encodeURIComponent(id) +
      ".json"
    );
  }

  function fetchResourceDetail(id) {
    return new Promise(function (resolve) {
      $.ajax({
        url: getApiResourceUrl(id),
        method: "GET",
        dataType: "json",
        timeout: 15000,
        headers: {
          Accept: "application/json"
        }
      })
        .done(function (data) {
          resolve(data);
        })
        .fail(function (xhr, status, error) {
          warn(
            "erro ao obter a ficha do recurso:",
            {
              id: id,
              httpStatus: xhr.status,
              status: status,
              error: error
            }
          );

          resolve(null);
        });
    });
  }

  function fetchMatchingResourceDetails(matchingResources) {
    var promises = matchingResources.map(function (resource) {
      return fetchResourceDetail(resource.id).then(function (detail) {
        if (detail && detail.media) {
          return detail;
        }

        if (detail) {
          warn(
            "ficha do recurso devolvida sem o campo media, a usar dados da lista:",
            {
              id: resource.id,
              detail: detail
            }
          );
        }

        return resource;
      });
    });

    return Promise.all(promises);
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
      "a",
      "as",
      "o",
      "os",
      "um",
      "uma",
      "uns",
      "umas",
      "de",
      "da",
      "das",
      "do",
      "dos",
      "e",
      "em",
      "no",
      "na",
      "nos",
      "nas",
      "por",
      "para",
      "com",
      "ao",
      "aos",
      "the",
      "of",
      "and",
      "in",
      "on",
      "to"
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
    var first = normalizeText(kohaTitle);
    var second = normalizeText(resourceTitle);

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

    var firstWords = getTitleWords(first);
    var secondWords = getTitleWords(second);

    if (
      !firstWords.length ||
      !secondWords.length
    ) {
      return 0;
    }

    var commonWords = firstWords.filter(
      function (word) {
        return secondWords.indexOf(word) !== -1;
      }
    );

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

    var composedName = cleanText(
      [
        contributor.first_name,
        contributor.last_name
      ]
        .filter(Boolean)
        .join(" ")
    );

    return (
      composedName ||
      cleanText(contributor.name) ||
      cleanText(contributor.full_name) ||
      cleanText(contributor.label)
    );
  }

  function getResourceAuthors(resource, natureFilter) {
    var contributors = normalizeContributors(resource);

    if (natureFilter) {
      contributors = contributors.filter(function (contributor) {
        return (
          normalizeText(
            (contributor && contributor.nature) || ""
          ) === natureFilter
        );
      });
    }

    return contributors
      .map(getContributorName)
      .filter(Boolean);
  }

  function getAuthorWords(value) {
    var ignoredWords = [
      "de",
      "da",
      "das",
      "do",
      "dos",
      "e",
      "van",
      "von",
      "del",
      "di"
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

        if (!resourceWords.length) {
          return false;
        }

        var commonWords =
          kohaWords.filter(function (word) {
            return (
              resourceWords.indexOf(word) !== -1
            );
          });

        var requiredMatches =
          kohaWords.length === 1
            ? 1
            : Math.min(
                2,
                kohaWords.length,
                resourceWords.length
              );

        return (
          commonWords.length >=
          requiredMatches
        );
      }
    );
  }

  function findMatchingResources(
    resources,
    title,
    authorCandidates
  ) {
    return resources
      .filter(function (resource) {
        if (
          !resource ||
          !resource.title
        ) {
          return false;
        }

        var titleOk = titleMatches(
          title,
          resource.title
        );

        var matchedAuthor = authorCandidates.find(
          function (author) {
            return authorMatches(
              author,
              resource
            );
          }
        );

        var authorOk = Boolean(matchedAuthor);

        log(
          "candidato:",
          {
            id: resource.id,
            title: resource.title,
            contributors:
              getResourceAuthors(resource),
            autoresCandidatos:
              authorCandidates,
            autorCorrespondido:
              matchedAuthor || null,
            titleScore:
              getTitleScore(
                title,
                resource.title
              ),
            titleOk: titleOk,
            authorOk: authorOk
          }
        );

        return titleOk && authorOk;
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
      return Array.isArray(medium.loans.loan)
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
      return Array.isArray(value.return_date)
        ? value.return_date
        : [value.return_date];
    }

    if (value.date) {
      return Array.isArray(value.date) ? value.date : [value.date];
    }

    return [value];
  }

  function getNextReturnDate(returnDates) {
    var now = new Date().getTime();

    var dates = returnDates
      .map(function (value) {
        return new Date(value);
      })
      .filter(function (date) {
        return !isNaN(date.getTime()) && date.getTime() >= now;
      })
      .sort(function (first, second) {
        return first.getTime() - second.getTime();
      });

    return dates.length ? dates[0] : null;
  }

  function formatDate(date) {
    return date.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function getAvailability(resource) {
    var digitalMedia = getDigitalMedia(resource);

    var holds = 0;
    var available = 0;
    var total = 0;
    var hasLoanData = false;
    var returnDates = [];

    digitalMedia.forEach(function (medium) {
      holds += Number(medium.current_holds || 0);

      normalizeLoans(medium).forEach(function (loan) {
        hasLoanData = true;
        available += Number(loan.available || 0);
        total += Number(loan.total || 0);
        returnDates = returnDates.concat(
          normalizeReturnDates(loan.return_dates)
        );
      });
    });

    var state = "unknown";

    if (hasLoanData) {
      state = available > 0 ? "available" : "unavailable";
    }

    return {
      hasDigitalEdition: digitalMedia.length > 0,
      state: state,
      holds: holds,
      available: available,
      total: total,
      returnDates: returnDates
    };
  }

  function getCombinedAvailability(resources) {
    var holds = 0;
    var available = 0;
    var total = 0;
    var hasLoanData = false;
    var returnDates = [];
    var digitalEditions = 0;

    resources.forEach(function (resource) {
      var availability = getAvailability(resource);

      holds += availability.holds;
      available += availability.available;
      total += availability.total;
      returnDates = returnDates.concat(availability.returnDates);

      if (availability.state !== "unknown") {
        hasLoanData = true;
      }

      if (availability.hasDigitalEdition) {
        digitalEditions += 1;
      }
    });

    var state = "unknown";

    if (hasLoanData) {
      state = available > 0 ? "available" : "unavailable";
    }

    return {
      state: state,
      holds: holds,
      available: available,
      total: total,
      returnDates: returnDates,
      digitalEditions: digitalEditions
    };
  }

  function getResourcePublisher(resource) {
    if (resource && resource.publisher && resource.publisher.name) {
      return cleanText(resource.publisher.name);
    }

    if (resource && typeof resource.publisher === "string") {
      return cleanText(resource.publisher);
    }

    return "";
  }

  function getDigitalMedia(resource) {
    return normalizeMedia(resource).filter(function (medium) {
      return normalizeText(medium.nature || "") !== "paper";
    });
  }

  function getResourceYear(resource) {
    var digitalMedia = getDigitalMedia(resource);

    var years = digitalMedia
      .map(function (medium) {
        var date = new Date(medium.issued_on || "");
        return isNaN(date.getTime()) ? null : date.getFullYear();
      })
      .filter(Boolean);

    return years.length ? String(Math.min.apply(null, years)) : "";
  }

  function getResourceEditionLabel(resource) {
    var publisher = getResourcePublisher(resource);
    var year = getResourceYear(resource);

    if (publisher && year) {
      return publisher + ", " + year;
    }

    return publisher || year || "Edição";
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
      ".rbmo-biblioled-card {",
      "  margin: 22px 0 24px 0;",
      "  padding: 14px 16px;",
      "  background: #fbfcfd;",
      "  border: 1px solid #dfe5ea;",
      "  border-radius: 8px;",
      "  font-size: 13px;",
      "  overflow: hidden;",
      "}",

      ".rbmo-biblioled-section-title {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 10px;",
      "  margin: 0 0 12px 0;",
      "  font-size: 18px;",
      "  font-weight: 600;",
      "  color: #1f2937;",
      "}",

      ".rbmo-biblioled-section-title .rbmo-biblioled-logo {",
      "  height: 18px;",
      "}",

      ".rbmo-biblioled-section-brand {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 6px;",
      "  font-size: 13px;",
      "  font-weight: 400;",
      "  color: #475569;",
      "}",

      ".rbmo-biblioled-card--highlight {",
      "  background: #eef7fb;",
      "  border: 1.5px solid #0076a3;",
      "}",

      ".rbmo-biblioled-status-group {",
      "  display: flex;",
      "  flex-direction: column;",
      "  gap: 1px;",
      "}",

      ".rbmo-biblioled-status-title {",
      "  font-size: 13px;",
      "  font-weight: 500;",
      "  color: #0c4a6e;",
      "  margin: 0;",
      "}",

      ".rbmo-biblioled-status-subtitle {",
      "  font-size: 12px;",
      "  color: #0076a3;",
      "  margin: 0;",
      "}",

      ".rbmo-biblioled-header {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: space-between;",
      "  gap: 12px;",
      "  flex-wrap: wrap;",
      "}",

      ".rbmo-biblioled-identity {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 10px;",
      "  flex-wrap: wrap;",
      "}",

      ".rbmo-biblioled-logo {",
      "  height: 20px;",
      "  width: auto;",
      "  display: block;",
      "}",

      ".rbmo-biblioled-logo-fallback {",
      "  font-size: 14px;",
      "  font-weight: 600;",
      "  color: #0f172a;",
      "}",

      ".rbmo-biblioled-status {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 6px;",
      "  font-weight: 500;",
      "}",

      ".rbmo-biblioled-status::before {",
      "  display: inline-block;",
      "  width: 7px;",
      "  height: 7px;",
      "  border-radius: 50%;",
      "  content: '';",
      "}",

      ".rbmo-biblioled-status--available {",
      "  color: #166534;",
      "}",

      ".rbmo-biblioled-status--available::before {",
      "  background: #22c55e;",
      "}",

      ".rbmo-biblioled-status--unavailable {",
      "  color: #9a3412;",
      "}",

      ".rbmo-biblioled-status--unavailable::before {",
      "  background: #f97316;",
      "}",

      ".rbmo-biblioled-status--unknown {",
      "  color: #475569;",
      "}",

      ".rbmo-biblioled-status--unknown::before {",
      "  background: #94a3b8;",
      "}",

      ".rbmo-biblioled-toggle {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 5px;",
      "  background: #ffffff;",
      "  border: 1px solid #cbd5e1;",
      "  border-radius: 999px;",
      "  cursor: pointer;",
      "  font-size: 12px;",
      "  color: #1e293b;",
      "  padding: 4px 10px;",
      "}",

      ".rbmo-biblioled-card--highlight .rbmo-biblioled-toggle {",
      "  border-color: #0076a3;",
      "  color: #0076a3;",
      "  font-weight: 500;",
      "}",

      ".rbmo-biblioled-toggle:hover {",
      "  color: #0f172a;",
      "  background: #f1f5f9;",
      "  border-color: #94a3b8;",
      "}",

      ".rbmo-biblioled-chevron {",
      "  display: inline-block;",
      "  width: 0;",
      "  height: 0;",
      "  border-left: 4px solid transparent;",
      "  border-right: 4px solid transparent;",
      "  border-top: 5px solid currentColor;",
      "  transition: transform .15s ease;",
      "}",

      ".rbmo-biblioled-chevron--open {",
      "  transform: rotate(180deg);",
      "}",

      ".rbmo-biblioled-panel {",
      "  display: none;",
      "  margin-top: 10px;",
      "  border-top: 1px solid #e2e8f0;",
      "  padding-top: 8px;",
      "}",

      ".rbmo-biblioled-panel--open {",
      "  display: block;",
      "}",

      ".rbmo-biblioled-row {",
      "  display: grid;",
      "  grid-template-columns: 0.65fr 1.45fr 1.4fr;",
      "  gap: 14px;",
      "  padding: 8px 10px;",
      "  align-items: center;",
      "}",

      ".rbmo-biblioled-row + .rbmo-biblioled-row {",
      "  border-top: 1px solid #e2e8f0;",
      "}",

      ".rbmo-biblioled-row--head {",
      "  font-size: 11.5px;",
      "  color: #64748b;",
      "  padding-bottom: 6px;",
      "}",

      ".rbmo-biblioled-muted {",
      "  color: #94a3b8;",
      "}",

      ".rbmo-biblioled-availability {",
      "  font-weight: 500;",
      "}",

      ".rbmo-biblioled-availability--available {",
      "  color: #238636;",
      "}",

      ".rbmo-biblioled-availability--reserved {",
      "  color: #b45309;",
      "}",

      ".rbmo-biblioled-availability--unknown {",
      "  color: #64748b;",
      "}",

      ".rbmo-biblioled-secondary {",
      "  color: #64748b;",
      "}",

      ".rbmo-biblioled-edition-link {",
      "  color: #0f172a;",
      "  text-decoration: none;",
      "}",

      ".rbmo-biblioled-edition-link:hover {",
      "  color: #0076a3;",
      "  text-decoration: underline;",
      "}",

      ".rbmo-biblioled-link {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 4px;",
      "  margin-top: 8px;",
      "  font-size: 13px;",
      "  color: #0076a3;",
      "  text-decoration: none;",
      "}",

      ".rbmo-biblioled-link:hover {",
      "  text-decoration: underline;",
      "}",

      ".rbmo-biblioled-return {",
      "  margin-top: 6px;",
      "  font-size: 11.5px;",
      "  color: #64748b;",
      "}",

      ".rbmo-biblioled-placeholder {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 8px;",
      "  margin: 32px 24px 24px 0;",
      "  padding: 12px 14px;",
      "  font-size: 13px;",
      "  color: #64748b;",
      "}",

      ".rbmo-biblioled-spinner {",
      "  width: 13px;",
      "  height: 13px;",
      "  border: 2px solid #cbd5e1;",
      "  border-top-color: #0076a3;",
      "  border-radius: 50%;",
      "  display: inline-block;",
      "  animation: rbmo-biblioled-spin 0.8s linear infinite;",
      "}",

      "@keyframes rbmo-biblioled-spin {",
      "  to { transform: rotate(360deg); }",
      "}"
    ].join("\n");

    document.head.appendChild(style);
  }

  function getEditionAvailabilityLabel(resource) {

    /*
     * 1. Preferir a disponibilidade enriquecida pelo Worker.
     *
     * Esperado:
     * resource.availability = {
     *   status: "available" | "unavailable" | "unknown",
     *   available: 0|1|...,
     *   next_available: "02/09/2026 às 22:44" | null
     * }
     */
    if (resource && resource.availability) {
      var workerAvailability = resource.availability;

      if (workerAvailability.status === "available") {
        var availableCount = Number(workerAvailability.available || 0);

        return {
          text: availableCount > 1
            ? "Disponível · " + availableCount + " exemplares"
            : "Disponível",
          className: "rbmo-biblioled-availability rbmo-biblioled-availability--available"
        };
      }

      if (
        workerAvailability.status === "unavailable" &&
        workerAvailability.next_available
      ) {
        return {
          text: "Disponível a partir de " + workerAvailability.next_available,
          className: "rbmo-biblioled-availability rbmo-biblioled-availability--reserved"
        };
      }

      if (workerAvailability.status === "unavailable") {
        return {
          text: "Indisponível neste momento",
          className: "rbmo-biblioled-availability rbmo-biblioled-availability--reserved"
        };
      }
    }

    /*
     * 2. Fallback para os dados antigos da API.
     */
    var availability = getAvailability(resource);

    if (availability.available > 0) {
      return {
        text: availability.total > 1
          ? "Disponível · " + availability.available + " de " + availability.total + " exemplares"
          : "Disponível",
        className: "rbmo-biblioled-availability rbmo-biblioled-availability--available"
      };
    }

    var nextReturn = getNextReturnDate(availability.returnDates);

    if (nextReturn) {
      return {
        text: "Disponível a partir de " + formatDate(nextReturn),
        className: "rbmo-biblioled-availability rbmo-biblioled-availability--reserved"
      };
    }

    if (availability.state === "unavailable") {
      return {
        text: "Indisponível neste momento",
        className: "rbmo-biblioled-availability rbmo-biblioled-availability--reserved"
      };
    }

    return {
      text: "Disponibilidade desconhecida",
      className: "rbmo-biblioled-availability rbmo-biblioled-availability--unknown"
    };
  }

  function createEditionRow(resource) {
    var row = document.createElement("div");
    row.className = "rbmo-biblioled-row";

    var year = document.createElement("span");
    year.className = "rbmo-biblioled-secondary";
    year.textContent = getResourceYear(resource) || "—";
    row.appendChild(year);

    var publisher = getResourcePublisher(resource) || "Edição";

    if (resource.link) {
      var publisherLink = document.createElement("a");
      publisherLink.href = resource.link;
      publisherLink.target = "_blank";
      publisherLink.rel = "noopener";
      publisherLink.className = "rbmo-biblioled-edition-link";
      publisherLink.textContent = publisher;
      row.appendChild(publisherLink);
    } else {
      var publisherCell = document.createElement("span");
      publisherCell.textContent = publisher;
      row.appendChild(publisherCell);
    }

    var availabilityInfo = getEditionAvailabilityLabel(resource);
    var availabilityCell = document.createElement("span");
    availabilityCell.className = availabilityInfo.className;
    availabilityCell.textContent = availabilityInfo.text;
    row.appendChild(availabilityCell);

    return row;
  }

  function createHeadRow() {
    var row = document.createElement("div");
    row.className = "rbmo-biblioled-row rbmo-biblioled-row--head";

    ["Ano", "Editora", "Disponibilidade"].forEach(function (label) {
      var cell = document.createElement("span");
      cell.textContent = label;
      row.appendChild(cell);
    });

    return row;
  }

  function getPhysicalAvailability() {
    var tables = document.querySelectorAll("table");

    for (var t = 0; t < tables.length; t++) {
      var headerCells = tables[t].querySelectorAll(
        "thead th, tr:first-child th"
      );

      var stateIndex = -1;

      for (var h = 0; h < headerCells.length; h++) {
        if (
          normalizeText(
            headerCells[h].textContent
          ) === "estado"
        ) {
          stateIndex = h;
          break;
        }
      }

      if (stateIndex === -1) {
        continue;
      }

      var rows = tables[t].querySelectorAll(
        "tbody tr"
      );

      if (!rows.length) {
        continue;
      }

      var hasAnyItem = false;
      var hasAvailableCopy = false;

      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].querySelectorAll("td");

        if (cells.length <= stateIndex) {
          continue;
        }

        hasAnyItem = true;

        var stateText = normalizeText(
          cells[stateIndex].textContent
        );

        if (
          stateText.indexOf("disponivel") !== -1
        ) {
          hasAvailableCopy = true;
        }
      }

      if (hasAnyItem) {
        return {
          hasPhysicalTable: true,
          hasAvailableCopy: hasAvailableCopy
        };
      }
    }

    return {
      hasPhysicalTable: false,
      hasAvailableCopy: false
    };
  }

  function createCard(
    resources,
    title,
    author,
    availability
  ) {
    var physical = getPhysicalAvailability();
    var highlight =
      physical.hasPhysicalTable &&
      !physical.hasAvailableCopy;

    var card = document.createElement("section");
    card.className =
      "rbmo-biblioled-card" +
      (highlight
        ? " rbmo-biblioled-card--highlight"
        : "");
    card.setAttribute("aria-label", "Disponibilidade digital");

    var sectionTitle = document.createElement("h2");
    sectionTitle.className = "rbmo-biblioled-section-title";

    var titleText = document.createElement("span");
    titleText.textContent = "Disponibilidade digital";
    sectionTitle.appendChild(titleText);

    var brand = document.createElement("span");
    brand.className = "rbmo-biblioled-section-brand";

    var logo = document.createElement("img");
    logo.className = "rbmo-biblioled-logo";
    logo.src = BIBLIOLED_ICON;
    logo.alt = "";

    var fallback = document.createElement("span");
    fallback.className = "rbmo-biblioled-logo-fallback";
    fallback.textContent = "BiblioLED";
    fallback.style.display = "none";

    logo.onerror = function () {
      logo.style.display = "none";
      fallback.style.display = "inline";
    };

    var brandText = document.createElement("span");
    brandText.textContent = "BiblioLED";

    brand.appendChild(logo);
    brand.appendChild(fallback);
    brand.appendChild(brandText);
    sectionTitle.appendChild(brand);

    card.appendChild(sectionTitle);

    if (highlight) {
      var statusGroup = document.createElement("div");
      statusGroup.className = "rbmo-biblioled-status-group";

      var statusTitle = document.createElement("p");
      statusTitle.className = "rbmo-biblioled-status-title";
      statusTitle.textContent =
        "Sem exemplares físicos disponíveis agora";

      var statusSubtitle = document.createElement("p");
      statusSubtitle.className = "rbmo-biblioled-status-subtitle";
      statusSubtitle.textContent =
        "Existe versão digital na BiblioLED";

      statusGroup.appendChild(statusTitle);
      statusGroup.appendChild(statusSubtitle);
      card.appendChild(statusGroup);
    }

    var panel = document.createElement("div");
    panel.className =
      "rbmo-biblioled-panel rbmo-biblioled-panel--open";

    panel.appendChild(createHeadRow());

    resources.forEach(function (resource) {
      panel.appendChild(createEditionRow(resource));
    });

    var link = document.createElement("a");
    link.className = "rbmo-biblioled-link";
    link.href = getPublicSearchUrl(title, author);
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Ver edições na BiblioLED";
    panel.appendChild(link);

    card.appendChild(panel);

    return card;
  }

  function getInsertTarget() {
    var selectors = [
      "#holdings",
      "#itemst",
      "#itemholdingst",
      ".holdingst",
      "#bibliodescriptions + #holdings",
      "table#holdingst"
    ];

    for (var i = 0; i < selectors.length; i++) {
      var node = document.querySelector(selectors[i]);
      if (node) {
        return {
          element: node,
          mode: "before"
        };
      }
    }

    var headings = document.querySelectorAll("h2, h3, legend");

    for (var h = 0; h < headings.length; h++) {
      var headingText = normalizeText(headings[h].textContent);

      if (
        headingText.indexOf("exemplares") !== -1 ||
        headingText.indexOf("holdings") !== -1
      ) {
        return {
          element: headings[h],
          mode: "before"
        };
      }
    }

    var fallback =
      document.querySelector("#catalogue_detail_biblio") ||
      document.querySelector("#bibliodescriptions");

    if (fallback) {
      return {
        element: fallback,
        mode: "append"
      };
    }

    return null;
  }

  function placeElementAtTarget(element) {
    var target = getInsertTarget();

    if (!target || !target.element) {
      return false;
    }

    if (target.mode === "before") {
      target.element.insertAdjacentElement("beforebegin", element);
    } else {
      target.element.appendChild(element);
    }

    return true;
  }

  function createPlaceholder() {
    var placeholder = document.createElement("div");
    placeholder.id = "rbmo-biblioled-placeholder";
    placeholder.className = "rbmo-biblioled-placeholder";

    var spinner = document.createElement("span");
    spinner.className = "rbmo-biblioled-spinner";
    spinner.setAttribute("aria-hidden", "true");

    var text = document.createElement("span");
    text.textContent = "A verificar versão digital…";

    placeholder.appendChild(spinner);
    placeholder.appendChild(text);

    return placeholder;
  }

  function insertPlaceholder() {
    if (
      document.getElementById(
        "rbmo-biblioled-placeholder"
      ) ||
      document.querySelector(
        ".rbmo-biblioled-card"
      )
    ) {
      return;
    }

    if (!placeElementAtTarget(createPlaceholder())) {
      warn(
        "não foi encontrado o local dos exemplares para inserir o indicador de carregamento."
      );
    }
  }

  function removePlaceholder() {
    var placeholder = document.getElementById(
      "rbmo-biblioled-placeholder"
    );

    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.removeChild(
        placeholder
      );
    }
  }

  function insertCard(element) {
    if (
      document.querySelector(
        ".rbmo-biblioled-card"
      )
    ) {
      return;
    }

    var placeholder = document.getElementById(
      "rbmo-biblioled-placeholder"
    );

    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.replaceChild(
        element,
        placeholder
      );

      return;
    }

    if (!placeElementAtTarget(element)) {
      warn(
        "não foi encontrado o local dos exemplares para inserir o cartão."
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

    var marcUrl = getMarcUrl();

    if (!marcUrl) {
      warn(
        "não foi encontrado o biblionumber."
      );
      return;
    }

    insertPlaceholder();

    $.ajax({
      url: marcUrl,
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
          fallbackAuthorFromOpac() ||
          marcData.author;

        var secondaryAuthors =
          fallbackSecondaryAuthorsFromOpac();

        var authorCandidates =
          getKohaAuthorCandidates(
            author,
            secondaryAuthors
          );

        log(
          "título Koha:",
          title
        );

        log(
          "autor Koha:",
          author
        );

        log(
          "autores secundários Koha:",
          secondaryAuthors
        );

        if (!title) {
          warn(
            "não foi possível extrair o título."
          );
          removePlaceholder();
          return;
        }

        if (!authorCandidates.length) {
          warn(
            "não foi possível extrair nenhum autor."
          );
          removePlaceholder();
          return;
        }

        var apiUrl =
          getApiSearchUrl(title);

        log(
          "pedido ao Worker:",
          apiUrl
        );

        $.ajax({
          url: apiUrl,
          method: "GET",
          dataType: "json",
          timeout: 20000,
          headers: {
            Accept: "application/json"
          }
        })
          .done(function (response) {
            var resources =
              getResources(response)
                .slice(0, MAX_RESULTS);

            log(
              "recursos encontrados:",
              resources
            );

            if (!resources.length) {
              log(
                "a pesquisa não devolveu resultados."
              );
              removePlaceholder();
              return;
            }

            var matchingResources =
              findMatchingResources(
                resources,
                title,
                authorCandidates
              );

            if (!matchingResources.length) {
              warn(
                "nenhum resultado corresponde simultaneamente ao título e ao autor."
              );

              window._rbmo_biblioled = {
                title: title,
                author: author,
                resources: resources,
                matchingResources: []
              };

              removePlaceholder();
              return;
            }

            log(
              "recursos correspondentes:",
              matchingResources
            );

            fetchMatchingResourceDetails(
              matchingResources
            ).then(function (
              detailedResources
            ) {
              var availability =
                getCombinedAvailability(
                  detailedResources
                );

              log(
                "disponibilidade agregada:",
                availability
              );

              window._rbmo_biblioled = {
                title: title,
                author: author,
                resources: resources,
                matchingResources:
                  detailedResources,
                editions:
                  detailedResources.length,
                holds:
                  availability.holds,
                digitalEditions:
                  availability.digitalEditions,
                availability:
                  availability,
                publicSearchUrl:
                  getPublicSearchUrl(
                    title,
                    author
                  )
              };

              insertCard(
                createCard(
                  detailedResources,
                  title,
                  author,
                  availability
                )
              );
            });
          })
          .fail(function (
            xhr,
            status,
            error
          ) {
            warn(
              "erro na consulta ao Worker:",
              {
                httpStatus: xhr.status,
                status: status,
                error: error,
                response:
                  xhr.responseText
              }
            );

            removePlaceholder();
          });
      })
      .fail(function (
        xhr,
        status,
        error
      ) {
        warn(
          "erro ao consultar a vista MARC:",
          {
            httpStatus: xhr.status,
            status: status,
            error: error
          }
        );

        removePlaceholder();
      });
  }

  window._rbmoBiblioledDebug = {
    getApiResourceUrl: getApiResourceUrl,
    fetchResourceDetail: fetchResourceDetail,
    getApiSearchUrl: getApiSearchUrl
  };

  if (
    typeof window.jQuery === "undefined"
  ) {
    warn(
      "jQuery não está disponível."
    );
    return;
  }

  $(document).ready(function () {
    init();
  });
})();
