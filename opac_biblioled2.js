/* =====================================
   TESTE BIBLIOLED — VERSÃO SIMPLIFICADA
   ===================================== */

(function () {
  "use strict";

  var BIBLIOLED_PROXY =
    "https://biblioled-oeiras.miguelcorreia-a94.workers.dev";

  var BIBLIOLED_ICON =
    "https://bibliotecas.oeiras.pt/wp-content/uploads/2026/05/biblioled_icon.png";

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

  function getTitle() {
    return cleanText(
      $("#catalogue_detail_biblio h1, #bibliodescriptions h1, h1")
        .first()
        .text()
    )
      .replace(/\s*\/.*$/, "")
      .trim();
  }

  function getAuthor() {
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
        label === "autor principal"
      ) {
        author = cleanText(
          $(this).find("a").first().text()
        );

        if (!author) {
          author = cleanText(
            $(this)
              .clone()
              .find(".label")
              .remove()
              .end()
              .text()
          );
        }

        return false;
      }
    });

    return author;
  }

  function getResources(response) {
    if (
      response &&
      Array.isArray(response.resources)
    ) {
      return response.resources;
    }

    return [];
  }

  function getAuthorNames(resource) {
    var contributors =
      resource.contributors || [];

    if (!Array.isArray(contributors)) {
      return [];
    }

    return contributors
      .filter(function (contributor) {
        return (
          !contributor.nature ||
          contributor.nature === "author"
        );
      })
      .map(function (contributor) {
        return cleanText(
          [
            contributor.first_name,
            contributor.last_name
          ]
            .filter(Boolean)
            .join(" ")
        );
      });
  }

  function titleMatches(kohaTitle, resourceTitle) {
    var a = normalizeText(kohaTitle);
    var b = normalizeText(resourceTitle);

    return (
      a === b ||
      a.indexOf(b) === 0 ||
      b.indexOf(a) === 0
    );
  }

  function authorMatches(
    kohaAuthor,
    resource
  ) {
    var kohaWords =
      normalizeText(kohaAuthor)
        .split(" ")
        .filter(function (word) {
          return word.length >= 3;
        });

    var authors =
      getAuthorNames(resource);

    return authors.some(function (
      resourceAuthor
    ) {
      var resourceWords =
        normalizeText(resourceAuthor)
          .split(" ")
          .filter(function (word) {
            return word.length >= 3;
          });

      var common =
        kohaWords.filter(function (word) {
          return (
            resourceWords.indexOf(word) !== -1
          );
        });

      return common.length >= 1;
    });
  }

  function getAvailability(resource) {
    var available = 0;
    var total = 0;

    var media =
      Array.isArray(resource.media)
        ? resource.media
        : [];

    media.forEach(function (medium) {
      var loans =
        Array.isArray(medium.loans)
          ? medium.loans
          : [];

      loans.forEach(function (loan) {
        available += Number(
          loan.available || 0
        );

        total += Number(
          loan.total || 0
        );
      });
    });

    return {
      available: available,
      total: total
    };
  }

  function injectCSS() {
    if (
      $("#rbmo-biblioled-style").length
    ) {
      return;
    }

    $("head").append(`
      <style id="rbmo-biblioled-style">
        .rbmo-biblioled {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 8px 0 14px 0;
          flex-wrap: wrap;
        }

        .rbmo-biblioled a {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 12px;
          border: 1px solid #dbe4ea;
          border-radius: 999px;
          background: #f8fafc;
          color: #475569;
          text-decoration: none;
          font-size: 12.5px;
        }

        .rbmo-biblioled img {
          height: 17px;
          width: auto;
        }

        .rbmo-biblioled-status {
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 600;
        }

        .rbmo-biblioled-available {
          color: #166534;
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
        }

        .rbmo-biblioled-unavailable {
          color: #9a3412;
          background: #fff7ed;
          border: 1px solid #fed7aa;
        }
      </style>
    `);
  }

  function insertButton(
    resource,
    availability
  ) {
    if (
      $(".rbmo-biblioled").length
    ) {
      return;
    }

    var statusText =
      availability.available > 0
        ? "Disponível para empréstimo"
        : "Temporariamente indisponível";

    var statusClass =
      availability.available > 0
        ? "rbmo-biblioled-available"
        : "rbmo-biblioled-unavailable";

    var html = `
      <div class="rbmo-biblioled">
        <a
          href="${resource.link}"
          target="_blank"
          rel="noopener"
        >
          <img
            src="${BIBLIOLED_ICON}"
            alt="BiblioLED"
          >
          <span>Também na BiblioLED</span>
        </a>

        <span class="rbmo-biblioled-status ${statusClass}">
          ${statusText}
        </span>
      </div>
    `;

    var target =
      $("#catalogue_detail_biblio h1, #bibliodescriptions h1, h1")
        .first();

    if (target.length) {
      target.after(html);
    }
  }

  async function init() {
    if (
      location.pathname.indexOf(
        "opac-detail.pl"
      ) === -1
    ) {
      return;
    }

    injectCSS();

    var title = getTitle();
    var author = getAuthor();

    console.log(
      "BiblioLED — título extraído:",
      title
    );

    console.log(
      "BiblioLED — autor extraído:",
      author
    );

    if (!title) {
      console.warn(
        "BiblioLED — título não encontrado."
      );
      return;
    }

    var url =
      BIBLIOLED_PROXY +
      "/resources.json?title=" +
      encodeURIComponent(title);

    console.log(
      "BiblioLED — pedido:",
      url
    );

    try {
      var response =
        await fetch(url);

      console.log(
        "BiblioLED — HTTP:",
        response.status
      );

      var data =
        await response.json();

      console.log(
        "BiblioLED — resposta:",
        data
      );

      var resources =
        getResources(data);

      console.log(
        "BiblioLED — recursos:",
        resources
      );

      var match =
        resources.find(function (
          resource
        ) {
          var titleOk =
            titleMatches(
              title,
              resource.title
            );

          var authorOk =
            !author ||
            authorMatches(
              author,
              resource
            );

          console.log(
            "BiblioLED — candidato:",
            resource.title,
            getAuthorNames(resource),
            {
              titleOk: titleOk,
              authorOk: authorOk
            }
          );

          return titleOk && authorOk;
        });

      if (!match) {
        console.warn(
          "BiblioLED — nenhum resultado compatível."
        );

        return;
      }

      var availability =
        getAvailability(match);

      console.log(
        "BiblioLED — selecionado:",
        match
      );

      console.log(
        "BiblioLED — disponibilidade:",
        availability
      );

      window._rbmo_biblioled = {
        title: title,
        author: author,
        resources: resources,
        match: match,
        availability: availability
      };

      insertButton(
        match,
        availability
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
