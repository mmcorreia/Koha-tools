/* =====================================
   BOTÃO BIBLIOLED — CONSULTA À API
   Miguel Mimoso Correia CC-BY-NC-SA

   Pesquisa recursos na BiblioLED por:
   - título
   - autor

   Não utiliza ISBN.

   O botão só é apresentado quando é encontrada
   uma correspondência compatível na API.

   Indica:
   - Disponível
   - Indisponível
   - Disponibilidade não indicada
   ===================================== */

(function () {
  "use strict";

  var BIBLIOLED_API =
    "https://aml.biblioled.gov.pt/v1/resources.json";

  var BIBLIOLED_SEARCH =
    "https://aml.biblioled.gov.pt/resources";

  var BIBLIOLED_ICON =
    "https://bibliotecas.oeiras.pt/wp-content/uploads/2026/05/biblioled_icon.png";

  /*
   * Percentagem mínima de palavras do título
   * que devem coincidir.
   *
   * 0.70 = 70%
   */
  var TITLE_MATCH_THRESHOLD = 0.70;

  /*
   * Quando true, exige que pelo menos uma parte
   * relevante do nome do autor coincida.
   */
  var REQUIRE_AUTHOR_MATCH = true;

  function cleanText(txt) {
    return String(txt || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeText(txt) {
    return cleanText(txt)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanTitle(txt) {
    return cleanText(txt)
      .replace(/\s*:\s*.*$/g, "")
      .replace(/\s*\/.*$/g, "")
      .replace(/[;,.\[\]\(\)"'«»“”‘’!?]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function cleanAuthor(txt) {
    return cleanText(txt)
      .replace(/^por\s+/i, "")
      .replace(/\s*;\s*.*$/g, "")
      .replace(/\s*\/.*$/g, "")
      .replace(/\bet al\.?.*$/i, "")
      .replace(/[;,:\[\]\(\)"'«»“”‘’!?]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function enc(txt) {
    return encodeURIComponent(txt || "").replace(/%20/g, "+");
  }

  function getBiblionumber() {
    var match = location.href.match(/[?&]biblionumber=(\d+)/);
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
      var $tr = $(this);
      var rowText = cleanText($tr.text());

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
        $tr.find("td").eq(0).text()
      ).toLowerCase();

      var value = cleanText(
        $tr.find("td").eq(1).text()
      );

      if (!label || !value) {
        return;
      }

      if (label === "título próprio" && !title) {
        title = value;
      }

      if (
        label === "primeira menção de responsabilidade" &&
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
      $("#catalogue_detail_biblio h1, #bibliodescriptions h1, h1")
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
        label === "co-autor"
      ) {
        author = cleanAuthor(
          $(this).find("a").first().text()
        );

        return false;
      }
    });

    return author;
  }

  function getApiUrl(title, author) {
    var parameters = [
      "title=" + enc(title)
    ];

    if (author) {
      parameters.push("author=" + enc(author));
    }

    return BIBLIOLED_API + "?" + parameters.join("&");
  }

  function getSearchUrl(title, author) {
    return (
      BIBLIOLED_SEARCH +
      "?keywords=" + enc(title) +
      "&isbn=" +
      "&author=" + enc(author) +
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

  /*
   * A documentação pode representar a lista JSON
   * de maneiras diferentes, consoante a serialização:
   *
   * { resources: [...] }
   * { resources: { resource: [...] } }
   * { resource: [...] }
   * [...]
   *
   * Esta função aceita essas estruturas.
   */
  function getResourcesFromResponse(response) {
    if (!response) {
      return [];
    }

    if (Array.isArray(response)) {
      return response;
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

    if (
      response.resources &&
      response.resources.resource
    ) {
      return [response.resources.resource];
    }

    if (Array.isArray(response.resource)) {
      return response.resource;
    }

    if (response.resource) {
      return [response.resource];
    }

    return [];
  }

  function getSignificantWords(txt) {
    var ignoredWords = [
      "a", "as", "o", "os",
      "um", "uma", "uns", "umas",
      "de", "da", "das", "do", "dos",
      "e", "em", "no", "na", "nos", "nas",
      "por", "para", "com",
      "the", "of", "and", "in", "on", "to"
    ];

    return normalizeText(txt)
      .split(" ")
      .filter(function (word) {
        return (
          word.length > 1 &&
          ignoredWords.indexOf(word) === -1
        );
      });
  }

  function titleSimilarity(titleA, titleB) {
    var normalizedA = normalizeText(titleA);
    var normalizedB = normalizeText(titleB);

    if (!normalizedA || !normalizedB) {
      return 0;
    }

    if (normalizedA === normalizedB) {
      return 1;
    }

    if (
      normalizedA.indexOf(normalizedB) !== -1 ||
      normalizedB.indexOf(normalizedA) !== -1
    ) {
      return 0.95;
    }

    var wordsA = getSignificantWords(normalizedA);
    var wordsB = getSignificantWords(normalizedB);

    if (!wordsA.length || !wordsB.length) {
      return 0;
    }

    var matched = wordsA.filter(function (word) {
      return wordsB.indexOf(word) !== -1;
    });

    return matched.length / wordsA.length;
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
      ].filter(Boolean).join(" ")
    );
  }

  function getResourceAuthors(resource) {
    var contributors = resource.contributors || [];

    if (!Array.isArray(contributors)) {
      contributors = contributors.contributor || contributors;
    }

    if (!Array.isArray(contributors)) {
      contributors = [contributors];
    }

    return contributors
      .map(getContributorName)
      .filter(Boolean);
  }

  function authorMatches(kohaAuthor, resource) {
    if (!kohaAuthor) {
      return true;
    }

    var normalizedKohaAuthor = normalizeText(kohaAuthor);
    var authors = getResourceAuthors(resource);

    if (!authors.length) {
      /*
       * Se a API não devolver colaboradores,
       * não excluímos automaticamente o recurso.
       */
      return true;
    }

    var kohaWords = getSignificantWords(normalizedKohaAuthor);

    return authors.some(function (resourceAuthor) {
      var normalizedResourceAuthor =
        normalizeText(resourceAuthor);

      if (
        normalizedResourceAuthor === normalizedKohaAuthor ||
        normalizedResourceAuthor.indexOf(normalizedKohaAuthor) !== -1 ||
        normalizedKohaAuthor.indexOf(normalizedResourceAuthor) !== -1
      ) {
        return true;
      }

      var resourceWords =
        getSignificantWords(normalizedResourceAuthor);

      /*
       * Considera correspondência quando existe pelo
       * menos um apelido ou nome relevante em comum.
       */
      return kohaWords.some(function (word) {
        return (
          word.length >= 3 &&
          resourceWords.indexOf(word) !== -1
        );
      });
    });
  }

  function resourceMatches(resource, title, author) {
    if (!resource || !resource.title) {
      return false;
    }

    var titleScore =
      titleSimilarity(title, resource.title);

    if (titleScore < TITLE_MATCH_THRESHOLD) {
      return false;
    }

    if (
      REQUIRE_AUTHOR_MATCH &&
      author &&
      !authorMatches(author, resource)
    ) {
      return false;
    }

    return true;
  }

  function findBestResource(resources, title, author) {
    var matches = resources
      .filter(function (resource) {
        return resourceMatches(
          resource,
          title,
          author
        );
      })
      .map(function (resource) {
        return {
          resource: resource,
          score: titleSimilarity(
            title,
            resource.title
          )
        };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      });

    return matches.length
      ? matches[0].resource
      : null;
  }

  function normalizeMedia(resource) {
    var media = resource.media || [];

    if (!Array.isArray(media)) {
      media = media.medium || media;
    }

    if (!Array.isArray(media)) {
      media = [media];
    }

    return media.filter(Boolean);
  }

  function normalizeLoans(medium) {
    var loans = medium && medium.loans
      ? medium.loans
      : [];

    if (!Array.isArray(loans)) {
      loans = loans.loan || loans;
    }

    if (!Array.isArray(loans)) {
      loans = [loans];
    }

    return loans.filter(Boolean);
  }

  function getAvailability(resource) {
    var media = normalizeMedia(resource);
    var available = 0;
    var total = 0;
    var hasLoanInformation = false;
    var returnDates = [];

    media.forEach(function (medium) {
      var loans = normalizeLoans(medium);

      loans.forEach(function (loan) {
        if (
          loan.available !== undefined ||
          loan.total !== undefined
        ) {
          hasLoanInformation = true;
        }

        available +=
          Number(loan.available || 0);

        total +=
          Number(loan.total || 0);

        var dates =
          loan.return_dates || [];

        if (!Array.isArray(dates)) {
          dates =
            dates.return_date ||
            dates.date ||
            dates;
        }

        if (!Array.isArray(dates)) {
          dates = [dates];
        }

        dates.filter(Boolean).forEach(function (date) {
          returnDates.push(date);
        });
      });
    });

    if (!hasLoanInformation) {
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

  function getResourceUrl(resource, title, author) {
    return (
      resource.link ||
      resource.url ||
      resource.link_url ||
      resource.linkURL ||
      getSearchUrl(title, author)
    );
  }

  function injectCSS() {
    if ($("#rbmo-biblioled-style").length) {
      return;
    }

    $("head").append(`
      <style id="rbmo-biblioled-style">
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
          transition:
            color .15s ease,
            background .15s ease,
            border-color .15s ease;
          line-height: 1.2;
        }

        .rbmo-biblioled-btn img {
          width: auto;
          height: 17px;
          opacity: .92;
        }

        .rbmo-biblioled-btn:hover,
        .rbmo-biblioled-btn:focus {
          color: #0080a3;
          background: #f0f9ff;
          border-color: #7dd3fc;
          text-decoration: none;
        }

        .rbmo-biblioled-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 9px;
          font-size: 11.5px;
          font-weight: 600;
          line-height: 1.2;
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
      </style>
    `);
  }

  function formatReturnDate(dateValue) {
    var date = new Date(dateValue);

    if (isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  function getNextReturnDate(returnDates) {
    var validDates = returnDates
      .map(function (dateValue) {
        return new Date(dateValue);
      })
      .filter(function (date) {
        return !isNaN(date.getTime());
      })
      .sort(function (a, b) {
        return a.getTime() - b.getTime();
      });

    return validDates.length
      ? validDates[0]
      : null;
  }

  function createButton(resource, title, author) {
    var availability =
      getAvailability(resource);

    var resourceUrl =
      getResourceUrl(resource, title, author);

    var wrapper =
      document.createElement("div");

    wrapper.className = "rbmo-biblioled";

    var link =
      document.createElement("a");

    link.href = resourceUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.className = "rbmo-biblioled-btn";

    link.innerHTML =
      '<img src="' +
      BIBLIOLED_ICON +
      '" alt="">' +
      "<span>Disponível também na BiblioLED</span>";

    wrapper.appendChild(link);

    var status =
      document.createElement("span");

    status.className =
      "rbmo-biblioled-status " +
      "rbmo-biblioled-status--" +
      availability.state;

    if (availability.state === "available") {
      status.textContent =
        availability.available === 1
          ? "1 empréstimo disponível"
          : availability.available +
            " empréstimos disponíveis";
    } else if (
      availability.state === "unavailable"
    ) {
      status.textContent = "Indisponível";
    } else {
      status.textContent =
        "Disponibilidade não indicada";
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
        var returnInfo =
          document.createElement("span");

        returnInfo.className =
          "rbmo-biblioled-return";

        returnInfo.textContent =
          "Próxima devolução prevista: " +
          formatReturnDate(nextReturn);

        wrapper.appendChild(returnInfo);
      }
    }

    return wrapper;
  }

  function insertButton(element) {
    if ($(".rbmo-biblioled").length) {
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

  function requestResources(title, author) {
    var apiUrl = getApiUrl(title, author);

    /*
     * dataType: "json" obriga o jQuery a interpretar
     * a resposta como JSON.
     */
    return $.ajax({
      url: apiUrl,
      method: "GET",
      dataType: "json",
      timeout: 10000
    });
  }

  function init() {
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

    $.get(marcUrl)
      .done(function (html) {
        var data = extractFrom200(html);

        var title =
          data.title ||
          fallbackTitleFromOpac();

        var author =
          data.author ||
          fallbackAuthorFromOpac();

        if (!title) {
          return;
        }

        var apiUrl =
          getApiUrl(title, author);

        console.log(
          "BiblioLED — título Koha:",
          title
        );

        console.log(
          "BiblioLED — autor Koha:",
          author
        );

        console.log(
          "BiblioLED — pedido API:",
          apiUrl
        );

        requestResources(title, author)
          .done(function (response) {
            var resources =
              getResourcesFromResponse(
                response
              );

            var resource =
              findBestResource(
                resources,
                title,
                author
              );

            console.log(
              "BiblioLED — resultados:",
              resources
            );

            if (!resource) {
              console.log(
                "BiblioLED — nenhuma correspondência confirmada."
              );

              return;
            }

            console.log(
              "BiblioLED — recurso selecionado:",
              resource
            );

            console.log(
              "BiblioLED — disponibilidade:",
              getAvailability(resource)
            );

            window._rbmo_biblioled = {
              kohaTitle: title,
              kohaAuthor: author,
              apiUrl: apiUrl,
              resources: resources,
              resource: resource,
              availability:
                getAvailability(resource)
            };

            insertButton(
              createButton(
                resource,
                title,
                author
              )
            );
          })
          .fail(function (
            xhr,
            status,
            error
          ) {
            console.warn(
              "BiblioLED — não foi possível consultar a API:",
              status,
              error,
              xhr.status
            );
          });
      })
      .fail(function () {
        console.warn(
          "BiblioLED — não foi possível ler o campo 200."
        );
      });
  }

  $(document).ready(init);
})();
