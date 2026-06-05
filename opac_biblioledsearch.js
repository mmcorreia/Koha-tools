/* =====================================
   BOTÃO BIBLIOLED
   Miguel Mimoso Correia CC-BY-NC-SA
   Acrescenta motor de pesquisa para o BiblioLED
   baseado nas informações de título e autor
   do registo bibliográfico bibliográfico
   ===================================== */

(function () {
  "use strict";

  var BIBLIOLED_ICON =
    "https://bibliotecas.oeiras.pt/wp-content/uploads/2026/05/biblioled_icon.png";

  function cleanText(txt) {
    return String(txt || "").replace(/\s+/g, " ").trim();
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
    var m = location.href.match(/[?&]biblionumber=(\d+)/);
    return m ? m[1] : "";
  }

  function getMarcUrl() {
    var n = getBiblionumber();
    if (!n) return "";

    return "/cgi-bin/koha/opac-MARCdetail.pl?biblionumber=" +
      encodeURIComponent(n);
  }

  function extractFrom200(html) {
    var page = $("<div>").html(html);
    var title = "";
    var author = "";
    var inside200 = false;

    page.find("tr").each(function () {
      var $tr = $(this);
      var txt = cleanText($tr.text());

      if (/^200\b/.test(txt)) {
        inside200 = true;
        return;
      }

      if (inside200 && /^\d{3}\b/.test(txt)) {
        inside200 = false;
      }

      if (!inside200) return;

      var label = cleanText($tr.find("td").eq(0).text()).toLowerCase();
      var value = cleanText($tr.find("td").eq(1).text());

      if (!label || !value) return;

      if (label === "título próprio" && !title) {
        title = value;
      }

      if (label === "primeira menção de responsabilidade" && !author) {
        author = value;
      }
    });

    return {
      title: cleanTitle(title),
      author: cleanAuthor(author)
    };
  }

  function fallbackTitleFromOpac() {
    return cleanTitle($("h1").first().text());
  }

  function fallbackAuthorFromOpac() {
    var author = "";

    $(".results_summary").each(function () {
      var label = cleanText($(this).find(".label").first().text())
        .replace(/:$/, "")
        .toLowerCase();

      if (
        label === "autor" ||
        label === "autores" ||
        label === "autor principal" ||
        label === "co-autor"
      ) {
        author = cleanAuthor($(this).find("a").first().text());
        return false;
      }
    });

    return author;
  }

  function getBiblioledUrl(title, author) {
    return "https://aml.biblioled.gov.pt/resources?" +
      "keywords=" + enc(title) +
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
      "&medium=";
  }

  function injectCSS() {
    if ($("#rbmo-biblioled-style").length) return;

    $("head").append(`
      <style id="rbmo-biblioled-style">
        .rbmo-biblioled {
          margin: 6px 0 12px 0;
        }

        .rbmo-biblioled-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 5px 11px;
          font-size: 12.5px;
          color: #475569;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          text-decoration: none;
          transition: all .15s ease;
          line-height: 1.2;
        }

        .rbmo-biblioled-btn img {
          height: 17px;
          width: auto;
          opacity: 0.9;
        }

        .rbmo-biblioled-btn:hover {
          color: #0080a3;
          background: #f0f9ff;
          border-color: #bae6fd;
          text-decoration: none;
        }

        .rbmo-biblioled-btn:hover img {
          opacity: 1;
        }
      </style>
    `);
  }

  function createButton(url) {
    var el = document.createElement("div");
    el.className = "rbmo-biblioled";

    el.innerHTML =
      '<a href="' + url + '" target="_blank" rel="noopener" class="rbmo-biblioled-btn">' +
        '<img src="' + BIBLIOLED_ICON + '" alt="BiblioLED">' +
        '<span>Confirmar disponibilidade na BiblioLED</span>' +
      '</a>';

    return el;
  }

  function insertButton(el) {
    if ($(".rbmo-biblioled").length) return;

    var target =
      document.querySelector("#catalogue_detail_biblio h1") ||
      document.querySelector("#bibliodescriptions h1") ||
      document.querySelector("h1");

    if (target) {
      target.insertAdjacentElement("afterend", el);
    }
  }

  function init() {
    if (!location.href.includes("opac-detail.pl")) return;

    injectCSS();

    var marcUrl = getMarcUrl();
    if (!marcUrl) return;

    $.get(marcUrl).done(function (html) {
      var data = extractFrom200(html);

      var title = data.title || fallbackTitleFromOpac();
      var author = data.author || fallbackAuthorFromOpac();

      if (!title) return;

      var url = getBiblioledUrl(title, author);

      window._rbmo_title = title;
      window._rbmo_author = author;
      window._rbmo_url = url;

      console.log("BiblioLED título:", title);
      console.log("BiblioLED autor:", author);
      console.log("BiblioLED URL:", url);

      insertButton(createButton(url));
    });
  }

  $(document).ready(init);

})();
