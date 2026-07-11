/* ==========================================
   INTEGRAÇÃO BIBLIOLED NO OPAC KOHA
   Miguel Mimoso Correia — CC-BY-NC-SA

   Funcionamento:
   - extrai título e autor do campo UNIMARC 200;
   - pesquisa na BiblioLED apenas por título;
   - confirma localmente título + autor;
   - não utiliza ISBN;
   - ignora edição e editora;
   - reúne todas as edições correspondentes;
   - se existir uma edição, abre a ficha do recurso;
   - se existirem várias edições, abre a página
     de pesquisa da BiblioLED;
   - agrega a disponibilidade das várias edições;
   - só apresenta o botão quando encontra a obra.
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

  var MAX_RESULTS = 30;
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
      .replace(
        /[;,.\[\]\(\)"'«»“”‘’!?]+/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanAuthor(value) {
    return cleanText(value)
      .replace(/^por\s+/i, "")
      .replace(/\s*\/.*$/g, "")
      .replace(/\s*;\s*.*$/g, "")
      .replace(/\bet al\.?.*$/i, "")
      .replace(
        /[;,:\[\]\(\)"'«»“”‘’!?]+/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim();
  }

  function encodeParameter(value) {
    return encodeURIComponent(
      value || ""
    ).replace(/%20/g, "+");
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
      var block =
        $(this);

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

  function getPublicSearchUrl(title) {
    return (
      BIBLIOLED_PUBLIC_SEARCH +
      "?q=" +
      encodeParameter(title)
    );
  }

  function getResources(response) {
    if (!response) {
      return [];
    }

    if (
      Array.isArray(
        response.resources
      )
    ) {
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

    if (
      Array.isArray(
        response.resource
      )
    ) {
      return response.resource;
    }

    if (Array.isArray(response)) {
      return response;
    }

    return [];
  }

  function uniqueWords(words) {
    return words.filter(
      function (
        word,
        index,
        array
      ) {
        return (
          array.indexOf(word) ===
          index
        );
      }
    );
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
            ignoredWords.indexOf(
              word
            ) === -1
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
      firstWords.filter(
        function (word) {
          return (
            secondWords.indexOf(
              word
            ) !== -1
          );
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

  function normalizeContributors(
    resource
  ) {
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

    if (
      !Array.isArray(
        contributors
      )
    ) {
      contributors = [
        contributors
      ];
    }

    return contributors.filter(
      Boolean
    );
  }

  function getContributorName(
    contributor
  ) {
    if (!contributor) {
      return "";
    }

    if (
      typeof contributor ===
      "string"
    ) {
      return cleanText(
        contributor
      );
    }

    var composedName =
      cleanText(
        [
          contributor.first_name,
          contributor.last_name
        ]
          .filter(Boolean)
          .join(" ")
      );

    return (
      composedName ||
      cleanText(
        contributor.name
      ) ||
      cleanText(
        contributor.full_name
      )
    );
  }

  function getResourceAuthors(
    resource
  ) {
    return normalizeContributors(
      resource
    )
      .filter(
        function (contributor) {
          var nature =
            normalizeText(
              contributor.nature
            );

          return (
            !nature ||
            nature === "author" ||
            nature === "autor"
          );
        }
      )
      .map(
        getContributorName
      )
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
            ignoredWords.indexOf(
              word
            ) === -1
          );
        })
    );
  }

  function authorMatches(
    kohaAuthor,
    resource
  ) {
    var kohaWords =
      getAuthorWords(
        kohaAuthor
      );

    var resourceAuthors =
      getResourceAuthors(
        resource
      );

    if (
      !kohaWords.length ||
      !resourceAuthors.length
    ) {
      return false;
    }

    return resourceAuthors.some(
      function (resourceAuthor) {
        var resourceWords =
          getAuthorWords(
            resourceAuthor
          );

        if (
          !resourceWords.length
        ) {
          return false;
        }

        var commonWords =
          kohaWords.filter(
            function (word) {
              return (
                resourceWords.indexOf(
                  word
                ) !== -1
              );
            }
          );

        var requiredMatches =
          Math.min(
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
    author
  ) {
    return resources
      .filter(function (resource) {
        if (
          !resource ||
          !resource.title
        ) {
          return false;
        }

        var titleOk =
          titleMatches(
            title,
            resource.title
          );

        var authorOk =
          authorMatches(
            author,
            resource
          );

        log(
          "candidato:",
          {
            id:
              resource.id,
            title:
              resource.title,
            authors:
              getResourceAuthors(
                resource
              ),
            titleScore:
              getTitleScore(
                title,
                resource.title
              ),
            titleOk:
              titleOk,
            authorOk:
              authorOk
          }
        );

        return (
          titleOk &&
          authorOk
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

  function normalizeMedia(
    resource
  ) {
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
      media =
        media.medium;
    }

    if (!Array.isArray(media)) {
      media = [media];
    }

    return media.filter(Boolean);
  }

  function normalizeLoans(
    medium
  ) {
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
      loans =
        loans.loan;
    }

    if (!Array.isArray(loans)) {
      loans = [loans];
    }

    return loans.filter(Boolean);
  }

  function normalizeReturnDates(
    value
  ) {
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
      return Array.isArray(
        value.date
      )
        ? value.date
        : [value.date];
    }

    return [value];
  }

  function getAvailability(
    resource
  ) {
    var media =
      normalizeMedia(resource);

    var available = 0;
    var total = 0;
    var hasAvailabilityData =
      false;

    var returnDates = [];

    media.forEach(
      function (medium) {
        if (
          medium.available !==
            undefined ||
          medium.total !==
            undefined
        ) {
          hasAvailabilityData =
            true;

          available += Number(
            medium.available || 0
          );

          total += Number(
            medium.total || 0
          );

          returnDates =
            returnDates.concat(
              normalizeReturnDates(
                medium.return_dates
              )
            );
        }

        var loans =
          normalizeLoans(medium);

        loans.forEach(
          function (loan) {
            if (
              loan.available !==
                undefined ||
              loan.total !==
                undefined
            ) {
              hasAvailabilityData =
                true;

              available += Number(
                loan.available || 0
              );

              total += Number(
                loan.total || 0
              );
            }

            returnDates =
              returnDates.concat(
                normalizeReturnDates(
                  loan.return_dates
                )
              );
          }
        );
      }
    );

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
        returnDates:
          returnDates
      };
    }

    return {
      state: "unavailable",
      available: 0,
      total: total,
      returnDates:
        returnDates
    };
  }

  function getCombinedAvailability(
    resources
  ) {
    var available = 0;
    var total = 0;
    var hasAvailabilityData =
      false;

    var returnDates = [];

    resources.forEach(
      function (resource) {
        var availability =
          getAvailability(
            resource
          );

        if (
          availability.state !==
          "unknown"
        ) {
          hasAvailabilityData =
            true;
        }

        available += Number(
          availability.available || 0
        );

        total += Number(
          availability.total || 0
        );

        if (
          availability.returnDates &&
          availability.returnDates.length
        ) {
          returnDates =
            returnDates.concat(
              availability.returnDates
            );
        }
      }
    );

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
        returnDates:
          returnDates
      };
    }

    return {
      state: "unavailable",
      available: 0,
      total: total,
      returnDates:
        returnDates
    };
  }

  function getNextReturnDate(
    returnDates
  ) {
    var now =
      new Date().getTime();

    var dates =
      returnDates
        .map(function (value) {
          return new Date(value);
        })
        .filter(function (date) {
          return (
            !isNaN(
              date.getTime()
            ) &&
            date.getTime() >= now
          );
        })
        .sort(
          function (
            first,
            second
          ) {
            return (
              first.getTime() -
              second.getTime()
            );
          }
        );

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
      document.createElement(
        "style"
      );

    style.id =
      "rbmo-biblioled-style";

    style.textContent = [
      ".rbmo-biblioled {",
      "  display: flex;",
      "  align-items: center;",
      "  flex-wrap: wrap;",
      "  gap: 8px;",
      "  margin: 7px 0 13px 0;",
      "}",

      ".rbmo-biblioled-btn {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 7px;",
      "  padding: 6px 12px;",
      "  font-size: 12.5px;",
      "  font-weight: 500;",
      "  line-height: 1.2;",
      "  color: #475569;",
      "  background: #f8fafc;",
      "  border: 1px solid #e2e8f0;",
      "  border-radius: 999px;",
      "  text-decoration: none;",
      "  transition: color .15s ease, background .15s ease, border-color .15s ease;",
      "}",

      ".rbmo-biblioled-btn:hover,",
      ".rbmo-biblioled-btn:focus {",
      "  color: #0080a3;",
      "  background: #f0f9ff;",
      "  border-color: #7dd3fc;",
      "  text-decoration: none;",
      "}",

      ".rbmo-biblioled-btn img {",
      "  width: auto;",
      "  height: 17px;",
      "}",

      ".rbmo-biblioled-status {",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 5px;",
      "  padding: 4px 9px;",
      "  font-size: 11.5px;",
      "  font-weight: 600;",
      "  line-height: 1.2;",
      "  border-radius: 999px;",
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
      "  background: #f0fdf4;",
      "  border: 1px solid #bbf7d0;",
      "}",

      ".rbmo-biblioled-status--available::before {",
      "  background: #22c55e;",
      "}",

      ".rbmo-biblioled-status--unavailable {",
      "  color: #9a3412;",
      "  background: #fff7ed;",
      "  border: 1px solid #fed7aa;",
      "}",

      ".rbmo-biblioled-status--unavailable::before {",
      "  background: #f97316;",
      "}",

      ".rbmo-biblioled-status--unknown {",
      "  color: #475569;",
      "  background: #f8fafc;",
      "  border: 1px solid #e2e8f0;",
      "}",

      ".rbmo-biblioled-status--unknown::before {",
      "  background: #94a3b8;",
      "}",

      ".rbmo-biblioled-return {",
      "  width: 100%;",
      "  margin-left: 3px;",
      "  font-size: 11.5px;",
      "  color: #64748b;",
      "}"
    ].join("\n");

    document.head.appendChild(
      style
    );
  }

  function createButton(
    resources,
    title,
    availability
  ) {
    var wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "rbmo-biblioled";

    var link =
      document.createElement(
        "a"
      );

    var multiple =
      resources.length > 1;

    if (multiple) {
      link.href =
        getPublicSearchUrl(
          title
        );
    } else {
      link.href =
        resources[0].link ||
        getPublicSearchUrl(
          title
        );
    }

    link.target = "_blank";
    link.rel = "noopener";
    link.className =
      "rbmo-biblioled-btn";

    var image =
      document.createElement(
        "img"
      );

    image.src =
      BIBLIOLED_ICON;

    image.alt =
      "BiblioLED";

    var linkText =
      document.createElement(
        "span"
      );

    if (multiple) {
      linkText.textContent =
        "Ver " +
        resources.length +
        " edições na BiblioLED";
    } else {
      linkText.textContent =
        "Também disponível na BiblioLED";
    }

    link.appendChild(image);
    link.appendChild(linkText);

    wrapper.appendChild(link);

    var status =
      document.createElement(
        "span"
      );

    status.className =
      "rbmo-biblioled-status " +
      "rbmo-biblioled-status--" +
      availability.state;

    if (
      availability.state ===
      "available"
    ) {
      if (
        availability.available ===
        1
      ) {
        status.textContent =
          "1 empréstimo disponível";
      } else {
        status.textContent =
          availability.available +
          " empréstimos disponíveis";
      }
    } else if (
      availability.state ===
      "unavailable"
    ) {
      status.textContent =
        multiple
          ? "Edições temporariamente indisponíveis"
          : "Temporariamente indisponível";
    } else {
      status.textContent =
        "Consultar disponibilidade";
    }

    wrapper.appendChild(
      status
    );

    if (
      availability.state ===
        "unavailable" &&
      availability.returnDates &&
      availability.returnDates.length
    ) {
      var nextReturn =
        getNextReturnDate(
          availability.returnDates
        );

      if (nextReturn) {
        var returnElement =
          document.createElement(
            "span"
          );

        returnElement.className =
          "rbmo-biblioled-return";

        returnElement.textContent =
          "Próxima devolução prevista: " +
          formatDate(
            nextReturn
          );

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
      document.querySelector(
        "h1"
      );

    if (!target) {
      warn(
        "não foi encontrado o título da página para inserir o botão."
      );

      return;
    }

    target.insertAdjacentElement(
      "afterend",
      element
    );
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

    var marcUrl =
      getMarcUrl();

    if (!marcUrl) {
      warn(
        "não foi encontrado o biblionumber."
      );

      return;
    }

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
          marcData.author ||
          fallbackAuthorFromOpac();

        log(
          "título Koha:",
          title
        );

        log(
          "autor Koha:",
          author
        );

        if (!title) {
          warn(
            "não foi possível extrair o título."
          );

          return;
        }

        if (!author) {
          warn(
            "não foi possível extrair o autor."
          );

          return;
        }

        var apiUrl =
          getApiSearchUrl(
            title
          );

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
            Accept:
              "application/json"
          }
        })
          .done(function (
            response
          ) {
            log(
              "resposta recebida:",
              response
            );

            var resources =
              getResources(
                response
              ).slice(
                0,
                MAX_RESULTS
              );

            log(
              "recursos encontrados:",
              resources
            );

            if (
              !resources.length
            ) {
              log(
                "a pesquisa por título não devolveu resultados."
              );

              return;
            }

            var matchingResources =
              findMatchingResources(
                resources,
                title,
                author
              );

            if (
              !matchingResources.length
            ) {
              warn(
                "foram encontrados resultados, mas nenhum corresponde simultaneamente ao título e ao autor."
              );

              window._rbmo_biblioled = {
                title:
                  title,
                author:
                  author,
                resources:
                  resources,
                matchingResources:
                  []
              };

              return;
            }

            var availability =
              getCombinedAvailability(
                matchingResources
              );

            log(
              "recursos correspondentes:",
              matchingResources
            );

            log(
              "disponibilidade agregada:",
              availability
            );

            window._rbmo_biblioled = {
              title:
                title,
              author:
                author,
              resources:
                resources,
              matchingResources:
                matchingResources,
              availability:
                availability,
              publicSearchUrl:
                getPublicSearchUrl(
                  title
                )
            };

            insertButton(
              createButton(
                matchingResources,
                title,
                availability
              )
            );
          })
          .fail(function (
            xhr,
            status,
            error
          ) {
            warn(
              "erro na consulta ao Worker:",
              {
                httpStatus:
                  xhr.status,
                status:
                  status,
                error:
                  error,
                response:
                  xhr.responseText
              }
            );
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
            httpStatus:
              xhr.status,
            status:
              status,
            error:
              error
          }
        );
      });
  }

  if (
    typeof window.jQuery ===
    "undefined"
  ) {
    warn(
      "jQuery não está disponível."
    );

    return;
  }

  $(document).ready(
    function () {
      init();
    }
  );
})();
