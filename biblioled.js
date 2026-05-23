/* ==============================================================================================================================
   BOTÃO BIBLIOLED
   ============================================================================================================================== */

(function () {
    "use strict";

    function addCssOnce() {
        if (document.getElementById("oeiras-biblioled-css")) return;

        const css = document.createElement("style");

        css.id = "oeiras-biblioled-css";
        css.textContent = `
            .oeiras-biblioled-link {
                margin-top: 8px;
            }

            a.oeiras-biblioled-button {
                display: inline-block;
                padding: 7px 12px;
                border: 1px solid #7d7d7d;
                border-radius: 3px;
                background: linear-gradient(to bottom, #fdfdfd 0%, #ececec 100%);
                color: #333333 !important;
                font-size: 0.95em;
                font-weight: 600;
                text-decoration: none !important;
                box-shadow: inset 0 1px 0 #ffffff;
            }

            a.oeiras-biblioled-button:hover,
            a.oeiras-biblioled-button:focus {
                background: linear-gradient(to bottom, #f5f5f5 0%, #dfdfdf 100%);
                border-color: #5f5f5f;
                color: #111111 !important;
                text-decoration: none !important;
            }

            a.oeiras-biblioled-button:active {
                background: linear-gradient(to bottom, #dfdfdf 0%, #f5f5f5 100%);
            }
        `;

        document.head.appendChild(css);
    }

    function cleanTitle(text) {
        if (!text) return "";

        return text
            .replace(/\s+/g, " ")
            .replace(/\s*:\s*.+$/, "")
            .trim();
    }

    function cleanAuthor(text) {
        if (!text) return "";

        return text
            .replace(/\.\s*$/, "")
            .replace(/\d{4}\s*[-–]\s*\d{0,4}/g, "")
            .replace(/\d{4}-?/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    function parseTitleAndAuthor(fullText) {
        if (!fullText) return { title: "", author: "" };

        const normalized = fullText.replace(/\s+/g, " ").trim();

        let titlePart = normalized;
        let authorPart = "";

        if (normalized.includes("/")) {
            const parts = normalized.split("/");
            titlePart = parts[0] ? parts[0].trim() : "";
            authorPart = parts.slice(1).join("/").trim();
        }

        return {
            title: cleanTitle(titlePart),
            author: cleanAuthor(authorPart)
        };
    }

    function getBiblioledUrl(title, author) {
        return "https://aml.biblioled.gov.pt/resources?keywords=" +
            encodeURIComponent(title || "") +
            "&isbn=&author=" +
            encodeURIComponent(author || "") +
            "&narrator=&publisher=&collection_title=&issued_on_range=&language=&audience=&category_standard=feedbooks&category=&nature=&medium=";
    }

    function createButton(url) {
        const wrap = document.createElement("div");

        wrap.className = "oeiras-biblioled-link";
        wrap.innerHTML =
            '<a class="oeiras-biblioled-button" href="' + url + '" target="_blank" rel="noopener">' +
            "Verificar disponibilidade no BiblioLED" +
            "</a>";

        return wrap;
    }

    function isDetailPage() {
        return /\/catalogue\/detail\.pl/.test(window.location.href);
    }

    function isSearchPage() {
        return /\/catalogue\/search\.pl/.test(window.location.href) ||
            /\/cataloguing\/addbooks\.pl/.test(window.location.href);
    }

    function getDetailTitleText() {
        const h1 = document.querySelector("h1");
        return h1 ? (h1.textContent || "").trim() : "";
    }

    function findDetailAnchor() {
        const all = Array.from(document.querySelectorAll("label, .label, dt, th, td, span, div"));

        for (const el of all) {
            const txt = (el.textContent || "").trim();

            if (/^isbn$/i.test(txt) || /^descri[cç][aã]o$/i.test(txt)) {
                return el.parentElement || el;
            }
        }

        return document.querySelector("h1");
    }

    function insertOnDetailPage() {
        if (document.querySelector(".oeiras-biblioled-link")) return;

        const fullTitle = getDetailTitleText();

        if (!fullTitle) return;

        const data = parseTitleAndAuthor(fullTitle);

        if (!data.title) return;

        const url = getBiblioledUrl(data.title, data.author);
        const button = createButton(url);
        const anchor = findDetailAnchor();

        if (anchor) {
            anchor.insertAdjacentElement("afterend", button);
        }
    }

    function getSearchResultLinks() {
        return Array.from(
            document.querySelectorAll('a[href*="/cgi-bin/koha/catalogue/detail.pl?biblionumber="]')
        );
    }

    function insertOnSearchPage() {
        const links = getSearchResultLinks();

        links.forEach(function (link) {
            const container = link.closest("td") || link.parentElement;

            if (!container) return;
            if (container.querySelector(".oeiras-biblioled-link")) return;

            const fullTitle = (link.textContent || "").trim();

            if (!fullTitle) return;

            const data = parseTitleAndAuthor(fullTitle);

            if (!data.title) return;

            const url = getBiblioledUrl(data.title, data.author);
            const button = createButton(url);

            let inserted = false;

            const descendants = Array.from(container.querySelectorAll("*"));

            for (const el of descendants) {
                const txt = (el.textContent || "").trim();

                if (/^descri[cç][aã]o$/i.test(txt)) {
                    const next = el.nextElementSibling;

                    if (next) {
                        next.insertAdjacentElement("afterend", button);
                        inserted = true;
                        break;
                    }
                }
            }

            if (!inserted) {
                let lastMeaningful = null;

                Array.from(container.children).forEach(function (child) {
                    if (
                        child.textContent &&
                        child.textContent.trim() &&
                        !child.classList.contains("oeiras-biblioled-link")
                    ) {
                        lastMeaningful = child;
                    }
                });

                if (lastMeaningful) {
                    lastMeaningful.insertAdjacentElement("afterend", button);
                } else {
                    link.insertAdjacentElement("afterend", button);
                }
            }
        });
    }

    function init() {
        addCssOnce();

        if (isDetailPage()) {
            insertOnDetailPage();
        }

        if (isSearchPage()) {
            insertOnSearchPage();
        }
    }

    document.addEventListener("DOMContentLoaded", init);
    window.addEventListener("load", init);
    setTimeout(init, 400);
    setTimeout(init, 1200);
})();