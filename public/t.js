/*
 * Snippet de tracking (server-side + client).
 * Uso no site do cliente:
 *   <script async src="https://SEU-DOMINIO.com/t.js"></script>
 *
 * O que faz:
 *  - resolve o trck_user_id (URL ?trck=… → localStorage) para cross-domain;
 *  - captura _fbp/_fbc (e deriva fbc de fbclid), client_id do GA (_ga) e UTMs;
 *  - carrega a gtag.js e o Pixel dinamicamente (ids vindos de /api/config);
 *  - chama /api/identify e dispara eventos por /api/event usando o MESMO
 *    event_id do Pixel (deduplicação).
 * API global: window.trck = { track, identify, decorate, getId }.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  var API = script ? new URL(script.src).origin : window.location.origin;
  var LS_ID = "trck_user_id";
  var LS_UTMS = "trck_utms";

  // ── helpers ────────────────────────────────────────────────────────────────
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }
  function getCookie(name) {
    var m = document.cookie.match("(^|;)\\s*" + name + "\\s*=\\s*([^;]+)");
    return m ? decodeURIComponent(m.pop()) : null;
  }
  function setCookie(name, value, days) {
    try {
      var exp = new Date(Date.now() + (days || 90) * 864e5).toUTCString();
      document.cookie =
        name + "=" + value + "; expires=" + exp + "; path=/; SameSite=Lax";
    } catch {}
  }
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }
  function store(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  }
  function load(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  }

  // ── identidade e atribuição ──────────────────────────────────────────────
  function resolveId() {
    var fromUrl = getParam("trck");
    if (fromUrl) {
      store(LS_ID, fromUrl);
      return fromUrl;
    }
    return load(LS_ID);
  }

  function captureUtms() {
    var keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
    ];
    var found = {};
    var has = false;
    keys.forEach(function (k) {
      var v = getParam(k);
      if (v) {
        found[k] = v;
        has = true;
      }
    });
    if (has) {
      store(LS_UTMS, JSON.stringify(found));
      return found;
    }
    try {
      return JSON.parse(load(LS_UTMS) || "{}");
    } catch {
      return {};
    }
  }

  function gaClientId() {
    var ga = getCookie("_ga");
    if (!ga) return null;
    var parts = ga.split(".");
    return parts.length >= 4 ? parts.slice(-2).join(".") : null;
  }
  function gaSessionId() {
    // Procura um cookie _ga_XXXX (fluxo específico). Best-effort.
    var m = document.cookie.match(/_ga_[^=]+=([^;]+)/);
    if (!m) return null;
    var parts = decodeURIComponent(m[1]).split(".");
    return parts.length >= 3 ? parts[2] : null;
  }
  function fbc() {
    var c = getCookie("_fbc");
    if (c) return c;
    var fbclid = getParam("fbclid");
    return fbclid ? "fb.1." + Date.now() + "." + fbclid : null;
  }
  // Se o Pixel não criou o _fbp (comum em navegador in-app: Instagram/Facebook,
  // onde o cookie do Pixel costuma falhar), geramos um no formato oficial
  // (fb.1.<ts>.<rand>) e persistimos — assim o fbp entra no identify/CAPI e fica
  // consistente entre os eventos e (se carregar) o próprio Pixel.
  function ensureFbp() {
    var c = getCookie("_fbp");
    if (c) return c;
    var v = "fb.1." + Date.now() + "." + Math.floor(Math.random() * 1e10);
    setCookie("_fbp", v, 90);
    return v;
  }

  var trckId = resolveId();
  var utms = captureUtms();

  // Modo teste do Meta: abra o site com ?fbtest=1 (ex.: na aba "Eventos de
  // Teste"). Persiste na sessão e faz a CAPI mandar o test_event_code.
  function isTestMode() {
    try {
      if (getParam("fbtest") === "1") {
        sessionStorage.setItem("trck_fbtest", "1");
        return true;
      }
      return sessionStorage.getItem("trck_fbtest") === "1";
    } catch {
      return getParam("fbtest") === "1";
    }
  }
  var TEST_MODE = isTestMode();

  function commonPayload() {
    return {
      trck_user_id: trckId || undefined,
      fbp: getCookie("_fbp") || undefined,
      fbc: fbc() || undefined,
      ga_client_id: gaClientId() || undefined,
      ga_session_id: gaSessionId() || undefined,
      utm_source: utms.utm_source,
      utm_medium: utms.utm_medium,
      utm_campaign: utms.utm_campaign,
      utm_term: utms.utm_term,
      utm_content: utms.utm_content,
    };
  }

  function post(path, data) {
    return fetch(API + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
      keepalive: true,
    })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .catch(function () {
        return null;
      });
  }

  // ── carregamento dinâmico da gtag e do Pixel ──────────────────────────────
  function loadGtag(ids) {
    if (!ids.length) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer.push(arguments);
    };
    var s = document.createElement("script");
    s.async = true;
    s.src =
      "https://www.googletagmanager.com/gtag/js?id=" +
      encodeURIComponent(ids[0]);
    document.head.appendChild(s);
    window.gtag("js", new Date());
    ids.forEach(function (id) {
      window.gtag("config", id);
    });
  }

  function loadPixel(ids) {
    if (!ids.length) return;
    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(
      window,
      document,
      "script",
      "https://connect.facebook.net/en_US/fbevents.js",
    );
    /* eslint-enable */
    ids.forEach(function (id) {
      window.fbq("init", id);
    });
  }

  // ── API pública ───────────────────────────────────────────────────────────
  function identify(extra) {
    var payload = commonPayload();
    if (document.referrer) payload.referrer = document.referrer;
    if (extra) for (var k in extra) payload[k] = extra[k];
    return post("/api/identify", payload).then(function (res) {
      if (res && res.trck_user_id) {
        trckId = res.trck_user_id;
        store(LS_ID, trckId);
      }
      return trckId;
    });
  }

  function track(name, params) {
    params = params || {};
    var eventId = uuid();
    // Pixel (browser) com o MESMO event_id → dedup com a CAPI (servidor).
    if (window.fbq) window.fbq("track", name, params, { eventID: eventId });
    if (window.gtag) window.gtag("event", name, params);

    var payload = commonPayload();
    payload.event_name = name;
    payload.event_id = eventId;
    payload.event_source_url = window.location.href;
    if (TEST_MODE) payload.test_event = true;
    if (params.value != null) payload.value = params.value;
    if (params.currency) payload.currency = params.currency;
    if (params.content_ids) payload.content_ids = params.content_ids;
    if (params.content_name) payload.content_name = params.content_name;
    if (params.content_type) payload.content_type = params.content_type;
    return post("/api/event", payload);
  }

  /** Acrescenta ?trck=<id> a uma URL (checkout, WhatsApp) para cross-domain. */
  function decorate(url) {
    if (!trckId) return url;
    try {
      var u = new URL(url, window.location.href);
      u.searchParams.set("trck", trckId);
      // Hotmart só devolve no webhook os parâmetros NATIVOS dele (src/sck) — o
      // "trck" custom é descartado. Então colamos o id também no `sck` (campo
      // livre; volta como purchase.tracking.source_sck) pra casar a compra com
      // o visitante por ID. NÃO tocamos no `src` (atribuição de anúncio dele).
      if (hostIn(u.host, PAYMENT_HOSTS) && !u.searchParams.get("sck")) {
        u.searchParams.set("sck", trckId);
      }
      return u.toString();
    } catch {
      var sep = url.indexOf("?") === -1 ? "?" : "&";
      return url + sep + "trck=" + encodeURIComponent(trckId);
    }
  }

  window.trck = {
    track: track,
    identify: identify,
    decorate: decorate,
    getId: function () {
      return trckId;
    },
  };

  // ── decoração automática de links (checkout + WhatsApp) ───────────────────
  // Adiciona ?trck=<id> automaticamente nos links de compra/WhatsApp, sem
  // precisar editar link por link. Force qualquer link com data-trck; pule com
  // data-no-trck.
  var CHECKOUT_HOSTS = [
    "hotmart.com", // pay.hotmart.com, hotmart.com, etc.
    "wa.me",
    "whatsapp.com", // api.whatsapp.com, chat.whatsapp.com
  ];
  // Só os hosts de PAGAMENTO disparam InitiateCheckout (WhatsApp não é checkout).
  var PAYMENT_HOSTS = ["hotmart.com"];
  function hostIn(host, list) {
    host = host.toLowerCase();
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      if (host === h || host.slice(-(h.length + 1)) === "." + h) return true;
    }
    return false;
  }
  function matchHost(host) {
    return hostIn(host, CHECKOUT_HOSTS);
  }
  /** É um link de checkout/pagamento (Hotmart) — dispara InitiateCheckout. */
  function isCheckoutLink(a) {
    if (!a || !a.getAttribute || !a.getAttribute("href")) return false;
    if (a.hasAttribute("data-no-checkout")) return false;
    if (a.hasAttribute("data-checkout")) return true; // força em botão custom
    try {
      return hostIn(new URL(a.href, window.location.href).host, PAYMENT_HOSTS);
    } catch {
      return false;
    }
  }
  function shouldDecorate(a) {
    if (!a || !a.getAttribute || !a.getAttribute("href")) return false;
    if (a.hasAttribute("data-no-trck")) return false;
    if (a.hasAttribute("data-trck")) return true;
    try {
      var u = new URL(a.href, window.location.href);
      if (u.searchParams.has("trck")) return false;
      return matchHost(u.host);
    } catch {
      return false;
    }
  }
  function decorateAll() {
    if (!trckId) return;
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      if (shouldDecorate(links[i])) links[i].href = decorate(links[i].href);
    }
  }
  // Captura no clique cobre links criados dinamicamente. Além de decorar o link,
  // dispara InitiateCheckout ao clicar num link de pagamento (Hotmart).
  var lastCheckoutAt = 0;
  function fireInitiateCheckout() {
    var now = Date.now();
    if (now - lastCheckoutAt < 1500) return; // evita duplo-clique acidental
    lastCheckoutAt = now;
    track("InitiateCheckout");
  }
  document.addEventListener(
    "click",
    function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      if (shouldDecorate(a)) a.href = decorate(a.href);
      if (isCheckoutLink(a)) fireInitiateCheckout();
    },
    true,
  );

  // Espera o cookie _fbp (criado pelo Pixel ao carregar) por até ~1s, para que
  // o fbp entre já no primeiro identify/PageView e melhore o match da Meta.
  function waitForFbp(cb, tries) {
    tries = tries || 0;
    if (getCookie("_fbp")) return cb();
    // Deu o tempo e o Pixel não criou o cookie → geramos um fallback e seguimos.
    if (tries >= 12) {
      ensureFbp();
      return cb();
    }
    setTimeout(function () {
      waitForFbp(cb, tries + 1);
    }, 100);
  }

  // ── bootstrap ─────────────────────────────────────────────────────────────
  fetch(API + "/api/config")
    .then(function (r) {
      return r.ok ? r.json() : { ga4: [], pixels: [] };
    })
    .catch(function () {
      return { ga4: [], pixels: [] };
    })
    .then(function (cfg) {
      loadGtag(cfg.ga4 || []);
      loadPixel(cfg.pixels || []);
      // page_view é automático no GA4 (config); PageView vai pela CAPI+Pixel.
      waitForFbp(function () {
        identify().then(function () {
          track("PageView");
          decorateAll();
        });
      });
    });
})();
