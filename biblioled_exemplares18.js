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

  /* Versão de diagnóstico para confirmar que o ficheiro novo foi carregado. */
  var RBMO_BIBLIOLED_VERSION = "2026-08-31-title-canonical-v15";
  window._rbmo_biblioled_version = RBMO_BIBLIOLED_VERSION;

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

  function levenshteinDistance(a, b) {
    a = String(a || "");
    b = String(b || "");

    var matrix = [];
    var i;
    var j;

    for (i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (i = 1; i <= b.length; i++) {
      for (j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  function similarityScore(a, b) {
    var first = normalizeText(a);
    var second = normalizeText(b);

    if (!first || !second) {
      return 0;
    }

    if (first === second) {
      return 1;
    }

    var maxLength = Math.max(first.length, second.length);

    if (!maxLength) {
      return 1;
    }

    return 1 - (
      levenshteinDistance(first, second) /
      maxLength
    );
  }

  function wordSimilar(a, b) {
    var first = normalizeText(a);
    var second = normalizeText(b);

    if (!first || !second) {
      return false;
    }

    if (first === second) {
      return true;
    }

    /*
     * Para palavras muito curtas exigimos mais rigor.
     * Para nomes/apelidos com 5+ letras, toleramos variantes
     * de transliteração e pequenas diferenças ortográficas.
     */
    var threshold =
      Math.max(first.length, second.length) >= 8
        ? 0.72
        : 0.80;

    return similarityScore(first, second) >= threshold;
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
      /*
       * Remove datas biográficas, por exemplo:
       * 1821-1881
       * 1821–1881
       * 1821-
       */
      .replace(/\b\d{3,4}\s*[-–—]\s*\d{0,4}\b/g, " ")
      .replace(/\b\d{3,4}\b/g, " ")
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


  function getMatchedBiblioledSearchData(resources, fallbackTitle, fallbackAuthor) {
    var matchedTitle = "";
    var matchedAuthor = "";

    if (Array.isArray(resources) && resources.length) {
      var firstResource = resources[0] || {};

      matchedTitle =
        cleanTitle(firstResource.title || "");

      var biblioledAuthors =
        getResourceAuthors(
          firstResource,
          "author"
        );

      if (!biblioledAuthors.length) {
        biblioledAuthors =
          getResourceAuthors(firstResource);
      }

      if (biblioledAuthors.length) {
        matchedAuthor =
          cleanAuthor(
            biblioledAuthors[0]
          );
      }
    }

    return {
      title:
        matchedTitle ||
        cleanTitle(fallbackTitle),

      author:
        matchedAuthor ||
        cleanAuthor(fallbackAuthor)
    };
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

  function getCanonicalTitleWords(value) {
    var ignoredWords = [
      "a", "as", "o", "os",
      "um", "uma", "uns", "umas",
      "de", "da", "das", "do", "dos",
      "e", "em", "no", "na", "nos", "nas",
      "por", "para", "com", "ao", "aos",
      "the", "of", "and", "in", "on", "to"
    ];

    return normalizeText(
      cleanTitle(value)
    )
      .split(" ")
      .filter(function (word) {
        return (
          word &&
          ignoredWords.indexOf(word) === -1
        );
      });
  }

  function getTitleScore(
    kohaTitle,
    resourceTitle
  ) {
    var first =
      normalizeText(
        cleanTitle(kohaTitle)
      );

    var second =
      normalizeText(
        cleanTitle(resourceTitle)
      );

    if (!first || !second) {
      return 0;
    }

    /*
     * 1. Correspondência exata após normalização.
     * Aceita automaticamente diferenças de:
     * - maiúsculas/minúsculas;
     * - acentos;
     * - pontuação.
     */
    if (first === second) {
      return 1;
    }

    /*
     * 2. Correspondência canónica:
     * ignoramos apenas artigos/preposições muito comuns,
     * mas exigimos que TODAS as palavras significativas
     * sejam as mesmas e pela mesma ordem.
     *
     * Exemplo aceite:
     * "Os irmãos Karamazov"
     * "Irmãos Karamázov"
     *
     * Exemplo rejeitado:
     * "A criada"
     * "A criada está a ver"
     */
    var firstWords =
      getCanonicalTitleWords(
        kohaTitle
      );

    var secondWords =
      getCanonicalTitleWords(
        resourceTitle
      );

    if (
      firstWords.length &&
      secondWords.length &&
      firstWords.length ===
        secondWords.length
    ) {
      var sameWords =
        firstWords.every(
          function (word, index) {
            return (
              word ===
              secondWords[index]
            );
          }
        );

      if (sameWords) {
        return 0.98;
      }
    }

    /*
     * 3. Pequena tolerância ortográfica global,
     * apenas para títulos praticamente idênticos.
     * Não aceita simples sobreposição de palavras.
     */
    var similarity =
      similarityScore(
        first,
        second
      );

    if (similarity >= 0.94) {
      return similarity;
    }

    return 0;
  }

  function titleMatches(
    kohaTitle,
    resourceTitle
  ) {
    return (
      getTitleScore(
        kohaTitle,
        resourceTitle
      ) >= 0.94
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
      normalizeText(
        cleanAuthor(value)
      )
        .split(" ")
        .filter(function (word) {
          return (
            /^[a-z]+$/.test(word) &&
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

        /*
         * 1. Correspondência normal, palavra a palavra.
         */
        var matchedKohaWords =
          kohaWords.filter(function (kohaWord) {
            return resourceWords.some(function (resourceWord) {
              return wordSimilar(
                kohaWord,
                resourceWord
              );
            });
          });

        if (kohaWords.length === 1) {
          return matchedKohaWords.length >= 1;
        }

        if (matchedKohaWords.length >= 2) {
          return true;
        }

        /*
         * 2. Autores transliterados:
         *
         * O apelido é normalmente a palavra mais longa.
         * Exigimos uma correspondência forte no apelido.
         *
         * Depois permitimos uma tolerância maior no nome próprio
         * para casos como:
         *
         * Fedor / Fiodor / Fiódor / Fyodor
         * Dostoevsky / Dostoievski / Dostoiévski
         */
        var kohaLongest =
          kohaWords
            .slice()
            .sort(function (a, b) {
              return b.length - a.length;
            })[0];

        var resourceLongest =
          resourceWords
            .slice()
            .sort(function (a, b) {
              return b.length - a.length;
            })[0];

        if (
          !kohaLongest ||
          !resourceLongest ||
          similarityScore(
            kohaLongest,
            resourceLongest
          ) < 0.72
        ) {
          return false;
        }

        var remainingKoha =
          kohaWords.filter(function (word) {
            return word !== kohaLongest;
          });

        var remainingResource =
          resourceWords.filter(function (word) {
            return word !== resourceLongest;
          });

        /*
         * Se só existe o apelido em um dos lados,
         * aceitamos a correspondência forte do apelido.
         */
        if (
          !remainingKoha.length ||
          !remainingResource.length
        ) {
          return true;
        }

        /*
         * Para o nome próprio usamos um limiar mais permissivo,
         * mas apenas depois de o apelido já ter sido validado.
         * 0.60 permite Fedor / Fiodor sem abrir demasiado o matching.
         */
        var firstNameCompatible =
          remainingKoha.some(function (kohaWord) {
            return remainingResource.some(function (resourceWord) {
              return (
                similarityScore(
                  kohaWord,
                  resourceWord
                ) >= 0.60
              );
            });
          });

        return firstNameCompatible;
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
      "  margin: 22px 0 8px 0;",
      "  padding: 14px 16px 12px 16px;",
      "  background: #fbfcfd;",
      "  border: 0;",
      "  border-radius: 0;",
      "  font-size: 13px;",
      "  overflow: hidden;",
      "}",

      ".rbmo-biblioled-section-title {",
      "  display: flex;",
      "  align-items: baseline;",
      "  justify-content: space-between;",
      "  gap: 12px;",
      "  margin: 0 0 10px 0;",
      "  font-size: 17px;",
      "  font-weight: 600;",
      "  color: #1f2937;",
      "}",

      ".rbmo-biblioled-intro {",
      "  margin: -2px 0 12px 0;",
      "  font-size: 13px;",
      "  color: #475569;",
      "}",

      ".rbmo-biblioled-intro a {",
      "  margin-left: 4px;",
      "  color: #0076a3;",
      "  text-decoration: none;",
      "  font-weight: 500;",
      "}",

      ".rbmo-biblioled-intro a:hover {",
      "  text-decoration: underline;",
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
      "  grid-template-columns: 46px 0.55fr 1.25fr 1.5fr;",
      "  gap: 14px;",
      "  padding: 9px 8px;",
      "  align-items: center;",
      "}",

      ".rbmo-biblioled-cover-cell {",
      "  width: 42px;",
      "  min-height: 60px;",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "}",

      ".rbmo-biblioled-cover {",
      "  width: 40px;",
      "  height: 58px;",
      "  object-fit: cover;",
      "  border-radius: 2px;",
      "  box-shadow: 0 1px 3px rgba(15,23,42,.16);",
      "  display: block;",
      "}",

      ".rbmo-biblioled-cover-placeholder {",
      "  width: 40px;",
      "  height: 58px;",
      "}",

      ".rbmo-biblioled-row + .rbmo-biblioled-row {",
      "  border-top: 1px solid #e2e8f0;",
      "}",

      ".rbmo-biblioled-row--head {",
      "  font-size: 11.5px;",
      "  font-weight: 700;",
      "  color: #334155;",
      "  padding-top: 4px;",
      "  padding-bottom: 7px;",
      "}",

      ".rbmo-biblioled-muted {",
      "  color: #94a3b8;",
      "}",

      ".rbmo-biblioled-availability {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 7px;",
      "  width: fit-content;",
      "  padding: 0;",
      "  font-weight: 500;",
      "  line-height: 1.35;",
      "  color: #334155;",
      "}",

      ".rbmo-biblioled-availability::before {",
      "  content: '';",
      "  display: inline-block;",
      "  width: 8px;",
      "  height: 8px;",
      "  border-radius: 50%;",
      "  flex: 0 0 8px;",
      "  box-shadow: 0 0 0 1px rgba(0,0,0,.08);",
      "}",

      ".rbmo-biblioled-availability--available::before {",
      "  background: #2e9d50;",
      "}",

      ".rbmo-biblioled-availability--reserved::before {",
      "  background: #e4ad19;",
      "}",

      ".rbmo-biblioled-availability--unknown::before {",
      "  background: #94a3b8;",
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
      "  gap: 7px;",
      "  margin-top: 10px;",
      "  font-size: 13px;",
      "  font-weight: 600;",
      "  color: #0076a3;",
      "  text-decoration: none;",
      "}",

      ".rbmo-biblioled-link-logo {",
      "  height: 17px;",
      "  width: auto;",
      "  display: block;",
      "  flex: 0 0 auto;",
      "}",

      ".rbmo-biblioled-link:hover {",
      "  text-decoration: underline;",
      "}",

      "@media (max-width: 700px) {",
      "  .rbmo-biblioled-row {",
      "    grid-template-columns: 40px 0.5fr 1fr 1.25fr;",
      "    gap: 8px;",
      "    padding-left: 2px;",
      "    padding-right: 2px;",
      "  }",
      "  .rbmo-biblioled-cover {",
      "    width: 36px;",
      "    height: 52px;",
      "  }",
      "  .rbmo-biblioled-cover-cell,",
      "  .rbmo-biblioled-cover-placeholder {",
      "    width: 36px;",
      "  }",
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
     * PRIORIDADE ABSOLUTA:
     * usar a disponibilidade enriquecida pelo Cloudflare Worker.
     *
     * Exemplo:
     *
     * resource.availability = {
     *   status: "available",
     *   available: 1,
     *   next_available: null
     * }
     *
     * ou:
     *
     * resource.availability = {
     *   status: "unavailable",
     *   available: 0,
     *   next_available: "02/09/2026 às 22:44"
     * }
     */

    var workerAvailability =
      resource && resource.availability
        ? resource.availability
        : null;

    if (workerAvailability) {

      var workerStatus =
        normalizeText(
          workerAvailability.status || ""
        );

      var workerAvailable =
        Number(
          workerAvailability.available || 0
        );

      if (workerStatus === "available") {

        return {
          text:
            workerAvailable > 1
              ? "Disponível · " +
                workerAvailable +
                " exemplares"
              : "Disponível · 1 exemplar",

          className:
            "rbmo-biblioled-availability " +
            "rbmo-biblioled-availability--available"
        };
      }

      if (workerStatus === "unavailable") {

        if (workerAvailability.next_available) {

          return {
            text:
              "Disponível a partir de " +
              cleanText(
                workerAvailability.next_available
              ),

            className:
              "rbmo-biblioled-availability " +
              "rbmo-biblioled-availability--reserved"
          };
        }

        return {
          text:
            "Indisponível neste momento",

          className:
            "rbmo-biblioled-availability " +
            "rbmo-biblioled-availability--reserved"
        };
      }
    }


    /*
     * FALLBACK:
     * mantém compatibilidade com versões antigas da API.
     *
     * Só é usado se o Worker não devolver availability.
     */

    var legacyAvailability =
      getAvailability(resource);

    if (legacyAvailability.available > 0) {

      return {
        text:
          legacyAvailability.available > 1
            ? "Disponível · " +
              legacyAvailability.available +
              " exemplares"
            : "Disponível · 1 exemplar",

        className:
          "rbmo-biblioled-availability " +
          "rbmo-biblioled-availability--available"
      };
    }


    var nextReturn =
      getNextReturnDate(
        legacyAvailability.returnDates
      );

    if (nextReturn) {

      return {
        text:
          "Disponível a partir de " +
          formatDate(nextReturn),

        className:
          "rbmo-biblioled-availability " +
          "rbmo-biblioled-availability--reserved"
      };
    }


    if (
      legacyAvailability.state ===
      "unavailable"
    ) {

      return {
        text:
          "Indisponível neste momento",

        className:
          "rbmo-biblioled-availability " +
          "rbmo-biblioled-availability--reserved"
      };
    }


    return {
      text:
        "Disponibilidade desconhecida",

      className:
        "rbmo-biblioled-availability " +
        "rbmo-biblioled-availability--unknown"
    };
  }

  function createEditionRow(
    resource,
    showCover
  ) {
    var row = document.createElement("div");
    row.className = "rbmo-biblioled-row";

    var coverCell =
      document.createElement("div");

    coverCell.className =
      "rbmo-biblioled-cover-cell";

    if (showCover) {
      var coverUrl =
        resource.cover ||
        resource.cover_large ||
        "";

      if (coverUrl) {
        var cover =
          document.createElement("img");

        cover.className =
          "rbmo-biblioled-cover";

        cover.src =
          coverUrl;

        cover.alt = "";

        cover.setAttribute(
          "aria-hidden",
          "true"
        );

        cover.onerror =
          function () {
            coverCell.innerHTML = "";
            var placeholder =
              document.createElement("span");
            placeholder.className =
              "rbmo-biblioled-cover-placeholder";
            coverCell.appendChild(
              placeholder
            );
          };

        coverCell.appendChild(
          cover
        );
      } else {
        var placeholder =
          document.createElement("span");

        placeholder.className =
          "rbmo-biblioled-cover-placeholder";

        coverCell.appendChild(
          placeholder
        );
      }
    }

    row.appendChild(
      coverCell
    );

    var year =
      document.createElement("span");

    year.className =
      "rbmo-biblioled-secondary";

    year.textContent =
      getResourceYear(resource) ||
      "—";

    row.appendChild(year);

    var publisher =
      getResourcePublisher(resource) ||
      "Edição";

    if (resource.link) {
      var publisherLink =
        document.createElement("a");

      publisherLink.href =
        resource.link;

      publisherLink.target =
        "_blank";

      publisherLink.rel =
        "noopener";

      publisherLink.className =
        "rbmo-biblioled-edition-link";

      publisherLink.textContent =
        publisher;

      row.appendChild(
        publisherLink
      );
    } else {
      var publisherCell =
        document.createElement("span");

      publisherCell.textContent =
        publisher;

      row.appendChild(
        publisherCell
      );
    }

    var availabilityInfo =
      getEditionAvailabilityLabel(
        resource
      );

    var availabilityCell =
      document.createElement("span");

    availabilityCell.className =
      availabilityInfo.className;

    availabilityCell.textContent =
      availabilityInfo.text;

    row.appendChild(
      availabilityCell
    );

    return row;
  }

  function getEditionCoverKey(resource) {
    return cleanText(
      resource &&
      (
        resource.cover ||
        resource.cover_large ||
        ""
      )
    );
  }

  function shouldShowEditionCovers(resources) {
    var covers =
      resources
        .map(getEditionCoverKey)
        .filter(Boolean);

    if (!covers.length) {
      return false;
    }

    /*
     * Se todas as edições usam exatamente a mesma capa,
     * não repetimos a imagem em todas as linhas.
     */
    var uniqueCovers =
      covers.filter(function (
        cover,
        index,
        array
      ) {
        return (
          array.indexOf(cover) ===
          index
        );
      });

    return (
      uniqueCovers.length > 1 ||
      resources.length === 1
    );
  }

  function createHeadRow() {
    var row = document.createElement("div");
    row.className = "rbmo-biblioled-row rbmo-biblioled-row--head";

    row.appendChild(
      document.createElement("span")
    );

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

    card.appendChild(sectionTitle);

    var intro = document.createElement("p");
    intro.className = "rbmo-biblioled-intro";
    intro.appendChild(
      document.createTextNode(
        "Aceda a este título em formato ebook."
      )
    );

    var learnMore = document.createElement("a");
    learnMore.href = "https://aml.biblioled.gov.pt/about";
    learnMore.target = "_blank";
    learnMore.rel = "noopener";
    learnMore.textContent = "Saber mais";
    intro.appendChild(learnMore);

    card.appendChild(intro);

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

    var showEditionCovers =
      shouldShowEditionCovers(
        resources
      );

    resources.forEach(function (resource) {
      panel.appendChild(
        createEditionRow(
          resource,
          showEditionCovers
        )
      );
    });

    var matchedSearchData =
      getMatchedBiblioledSearchData(
        resources,
        title,
        author
      );

    var link = document.createElement("a");
    link.className = "rbmo-biblioled-link";
    link.href = getPublicSearchUrl(
      matchedSearchData.title,
      matchedSearchData.author
    );
    link.target = "_blank";
    link.rel = "noopener";

    var linkLogo = document.createElement("img");
    linkLogo.className = "rbmo-biblioled-link-logo";
    linkLogo.src = BIBLIOLED_ICON;
    linkLogo.alt = "";
    linkLogo.setAttribute("aria-hidden", "true");

    linkLogo.onerror = function () {
      linkLogo.style.display = "none";
    };

    var linkText = document.createElement("span");
    linkText.textContent = "Ver na BiblioLED";

    link.appendChild(linkLogo);
    link.appendChild(linkText);

    panel.appendChild(link);

    card.appendChild(panel);

    return card;
  }

  function getInsertTarget() {

    /*
     * Preferência:
     * inserir a BiblioLED no fim do próprio bloco #holdings,
     * depois da tabela, totais e restantes informação dos
     * exemplares físicos. Assim continua dentro do separador
     * "Exemplares", mas sem concorrer visualmente com a coleção física.
     */
    var holdingsContainer =
      document.querySelector("#holdings");

    if (holdingsContainer) {
      return {
        element: holdingsContainer,
        mode: "append"
      };
    }

    /*
     * Fallback para instalações/templates onde #holdings
     * não existe: inserir imediatamente depois da tabela
     * de exemplares.
     */
    var tableSelectors = [
      "#itemst",
      "#itemholdingst",
      ".holdingst",
      "table#holdingst"
    ];

    for (var i = 0; i < tableSelectors.length; i++) {
      var table = document.querySelector(tableSelectors[i]);

      if (table) {
        return {
          element: table,
          mode: "after"
        };
      }
    }

    /*
     * Último fallback: procurar um título/legenda de exemplares
     * e inserir depois do respetivo bloco parental.
     */
    var headings =
      document.querySelectorAll("h2, h3, legend");

    for (var h = 0; h < headings.length; h++) {
      var headingText =
        normalizeText(
          headings[h].textContent
        );

      if (
        headingText.indexOf("exemplares") !== -1 ||
        headingText.indexOf("holdings") !== -1
      ) {
        return {
          element:
            headings[h].parentElement ||
            headings[h],
          mode: "after"
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

    if (target.mode === "after") {
      target.element.insertAdjacentElement(
        "afterend",
        element
      );
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
        "não foi encontrado o fim do bloco de exemplares para inserir o indicador de carregamento."
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
        "não foi encontrado o fim do bloco de exemplares para inserir o cartão BiblioLED."
      );
      return;
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

              log(
                "disponibilidade por edição:",
                detailedResources.map(function (resource) {
                  return {
                    id: resource.id,
                    publisher:
                      resource.publisher_name ||
                      getResourcePublisher(resource),
                    availability:
                      resource.availability || null
                  };
                })
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
                    getMatchedBiblioledSearchData(
                      detailedResources,
                      title,
                      author
                    ).title,
                    getMatchedBiblioledSearchData(
                      detailedResources,
                      title,
                      author
                    ).author
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
    getApiSearchUrl: getApiSearchUrl,
    cleanAuthor: cleanAuthor,
    getAuthorWords: getAuthorWords,
    similarityScore: similarityScore,
    wordSimilar: wordSimilar,
    authorMatches: authorMatches,
    compareAuthorNames: function (first, second) {
      var fakeResource = {
        contributors: [
          {
            first_name: second,
            last_name: "",
            nature: "author"
          }
        ]
      };

      return {
        first: first,
        second: second,
        firstWords: getAuthorWords(first),
        secondWords: getAuthorWords(second),
        matches: authorMatches(first, fakeResource)
      };
    }
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
