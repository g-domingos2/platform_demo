// assets/js/i18n/core.js
// Tradutor central em runtime (pt-BR -> idioma alvo) baseado em dicionários "whitelist".
// - Só substitui textos/atributos cujo valor exato esteja no dicionário, então
//   conteúdo dinâmico (nomes de fazenda, usuários, etc.) nunca é tocado.
// - Guarda o texto original (pt) num WeakMap para conseguir voltar ao português
//   ou trocar diretamente de um idioma para outro (a tradução parte sempre do pt).
// - Suporta vários idiomas alvo (en, es, ...). Cada idioma tem seu próprio
//   dicionário, registrado via registerDict(map, lang).
// - Um MutationObserver reaplica a tradução em todo conteúdo injetado em runtime
//   (troca de rota, overlays, render via JS), sem precisar editar cada página.
(function () {
    "use strict";

    const STORAGE_KEY = "ic:lang";
    const DEFAULT_LANG = "pt-BR";

    // Dicionários por idioma: dicts[lang][textoPt] = traducao
    // (preenchidos por dict.js / dict.es.js via registerDict)
    const dicts = Object.create(null);

    function getDict(lang) {
        return dicts[lang] || null;
    }

    // Originais em português, para restaurar ao voltar o idioma
    const origText = new WeakMap(); // textNode -> string original
    const origAttr = new WeakMap(); // element -> { attr: stringOriginal }
    const renderedText = new WeakMap();
    const renderedAttr = new WeakMap();

    // Atributos textuais que também traduzimos
    const ATTRS = ["placeholder", "title", "aria-label", "alt", "data-tooltip", "data-toast-text"];

    // Elementos cujo conteúdo NÃO deve ser varrido
    const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE"]);

    let observer = null;
    let scheduled = false;

    function getLang() {
        try {
            return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
        } catch (_) {
            return DEFAULT_LANG;
        }
    }

    function isEnglish() {
        return getLang() === "en";
    }

    // Há tradução ativa quando o idioma não é o padrão (pt-BR) e existe
    // dicionário registrado para ele.
    function activeDict() {
        const lang = getLang();
        if (lang === DEFAULT_LANG) return null;
        return getDict(lang);
    }

    function shouldSkip(node) {
        const el = node.nodeType === 1 ? node : node.parentElement;
        if (!el) return true;
        if (SKIP_TAGS.has(el.nodeName)) return true;
        if (el.closest && el.closest("[data-i18n-skip]")) return true;
        return false;
    }

    // dict = dicionário do idioma alvo, ou null para restaurar o português.
    // A tradução parte SEMPRE do texto original em pt (guardado no WeakMap),
    // permitindo trocar diretamente de um idioma para outro.
    function translateText(node, dict) {
        if (renderedText.has(node) && node.nodeValue !== renderedText.get(node)) origText.delete(node);
        if (dict) {
            const original = origText.has(node) ? origText.get(node) : node.nodeValue;
            if (!original) return;
            const trimmed = original.trim();
            if (!trimmed) return;
            const hit = dict[trimmed];
            if (hit === undefined) {
                // Sem tradução neste idioma: garante o português original
                if (origText.has(node)) {
                    node.nodeValue = origText.get(node);
                    origText.delete(node);
                }
                return;
            }
            if (!origText.has(node)) origText.set(node, original);
            // preserva espaços/quebras ao redor do texto
            const translated = original.replace(trimmed, hit);
            if (node.nodeValue !== translated) node.nodeValue = translated;
        } else if (origText.has(node)) {
            node.nodeValue = origText.get(node);
            origText.delete(node);
        }
        renderedText.set(node, node.nodeValue);
    }

    function translateAttrs(el, dict) {
        if (el.nodeType !== 1 || shouldSkip(el)) return;
        let rendered = renderedAttr.get(el);
        if (!rendered) renderedAttr.set(el, (rendered = {}));
        for (let i = 0; i < ATTRS.length; i++) {
            const attr = ATTRS[i];
            if (!el.hasAttribute(attr)) continue;
            const store = origAttr.get(el);
            if (store && attr in rendered && el.getAttribute(attr) !== rendered[attr]) delete store[attr];
            if (dict) {
                const original = store && attr in store ? store[attr] : el.getAttribute(attr);
                const trimmed = (original || "").trim();
                if (!trimmed) continue;
                const hit = dict[trimmed];
                if (hit === undefined) {
                    // Sem tradução neste idioma: garante o português original
                    if (store && attr in store) {
                        el.setAttribute(attr, store[attr]);
                        delete store[attr];
                    }
                    continue;
                }
                let dest = store;
                if (!dest) origAttr.set(el, (dest = {}));
                if (!(attr in dest)) dest[attr] = original;
                const translated = original.replace(trimmed, hit);
                if (el.getAttribute(attr) !== translated) el.setAttribute(attr, translated);
            } else if (store && attr in store) {
                el.setAttribute(attr, store[attr]);
                delete store[attr];
            }
            rendered[attr] = el.getAttribute(attr);
        }
    }

    function walk(root) {
        if (!root) return;
        const dict = activeDict();

        // Texto do próprio nó (quando for textNode injetado solto)
        if (root.nodeType === 3) {
            if (!shouldSkip(root)) translateText(root, dict);
            return;
        }
        if (root.nodeType !== 1) return;

        // Atributos do elemento raiz + descendentes
        translateAttrs(root, dict);
        const els = root.querySelectorAll("*");
        for (let i = 0; i < els.length; i++) translateAttrs(els[i], dict);

        // Nós de texto
        const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
                if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                if (shouldSkip(n)) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            },
        });
        const nodes = [];
        while (tw.nextNode()) nodes.push(tw.currentNode);
        for (let i = 0; i < nodes.length; i++) translateText(nodes[i], dict);
    }

    // Título da aba: fica fora do <body>, então o walk/observer não alcança.
    // Guarda o original em pt e traduz a partir dele, igual aos nós de texto.
    let origTitle = null;
    function translateTitle(dict) {
        if (origTitle === null) origTitle = document.title;
        const original = origTitle;
        if (!original) return;
        const hit = dict ? dict[original.trim()] : undefined;
        const next = hit === undefined ? original : original.replace(original.trim(), hit);
        if (document.title !== next) document.title = next;
    }

    function refresh() {
        document.documentElement.lang = getLocale();
        translateTitle(activeDict());
        if (document.body) walk(document.body);
    }

    function scheduleRefresh() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            refresh();
        });
    }

    function startObserver() {
        if (observer || !document.body) return;
        observer = new MutationObserver((mutations) => {
            const dict = activeDict();
            for (const m of mutations) {
                if (m.type === "characterData" && !shouldSkip(m.target)) translateText(m.target, dict);
                if (m.type === "attributes") translateAttrs(m.target, dict);
                for (const node of m.addedNodes) {
                    if (node.nodeType === 3) {
                        if (!shouldSkip(node)) translateText(node, dict);
                    } else if (node.nodeType === 1) {
                        walk(node);
                    }
                }
            }
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    }

    function setLang(lang) {
        // Aceita qualquer idioma com dicionário registrado; os demais caem no
        // padrão (pt-BR), exibindo o texto original.
        const next = lang && (lang === DEFAULT_LANG || getDict(lang)) ? lang : DEFAULT_LANG;
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch (_) {}
        refresh();
        window.dispatchEvent(new CustomEvent("ic:lang-change", { detail: { lang: next } }));
    }

    // t(ptText): traduz uma string para o idioma ativo usando o dicionário.
    // Retorna o próprio texto pt quando não há tradução (ou idioma é pt-BR).
    // Útil para conteúdo gerado por JS que não passa pela varredura do DOM.
    function t(ptText) {
        const dict = activeDict();
        if (!dict || ptText == null) return ptText;
        const key = String(ptText).trim();
        const hit = dict[key];
        return hit === undefined ? ptText : hit;
    }

    // Locale BCP-47 do idioma ativo, para Intl/toLocaleDateString etc.
    const LOCALES = { en: "en-US", es: "es-ES", "pt-BR": "pt-BR" };
    function getLocale() {
        return LOCALES[getLang()] || "pt-BR";
    }

    // registerDict(map, lang): registra/mescla o dicionário do idioma alvo.
    // lang padrão = "en" para compatibilidade com dict.js antigo.
    function registerDict(map, lang) {
        if (!map) return;
        const target = lang || "en";
        const bucket = dicts[target] || (dicts[target] = Object.create(null));
        Object.assign(bucket, map);
        scheduleRefresh();
    }

    window.IcI18n = {
        registerDict,
        setLang,
        getLang,
        getLocale,
        isEnglish,
        t,
        refresh,
        apply: walk,
    };

    function init() {
        startObserver();
        refresh();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
