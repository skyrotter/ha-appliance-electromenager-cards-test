/* Chargeur « à la demande » : déclare toutes les cartes sous forme d'éléments « souches » et ne télécharge
 * le code d'une carte (fichier ha-appliance-electromenager-cards.<nom>.js, à côté de ce fichier) qu'au moment
 * où elle s'affiche dans un tableau de bord ou dans l'éditeur. La liste des cartes vient de build.js. */
(() => {
  "use strict";
  if (window.__applianceLazy) return;
  window.__applianceLazy = true;
  const VERSION = "/*@version*/", PREFIX = "ha-appliance-electromenager-cards";
  const M = /*@manifest*/{};

  // dossier de ce fichier : script classique (currentScript) ou module (pile d'appels)
  const here = (document.currentScript && document.currentScript.src) || ((new Error().stack || "").match(/https?:\/\/[^\s)]+?\.js/) || [""])[0];
  const BASE = here.replace(/[?#].*$/, "").replace(/[^/]*$/, "");

  const native = { define: customElements.define.bind(customElements), get: customElements.get.bind(customElements) };
  const real = {};   // tag -> vraie classe, une fois le morceau chargé
  const inst = {};   // tag -> souches en attente de leur vraie classe
  const stubs = new Set(M.tags);
  const noop = () => {};

  // Le code d'une carte croit parler à customElements : on lui donne une version qui range la classe au lieu de la déclarer (la souche l'est déjà).
  const sandboxCE = new Proxy(customElements, {
    get(t, k) {
      if (k === "define") return (n, c, o) => (stubs.has(n) ? void (real[n] = c) : native.define(n, c, o));
      if (k === "get") return (n) => (stubs.has(n) ? real[n] : native.get(n));
      const v = t[k]; return typeof v === "function" ? v.bind(t) : v;
    },
  });

  // upgrade : la souche prend le prototype de la vraie classe (le navigateur a retenu les callbacks de la souche, qui les relaie)
  const swap = (el, C) => { if (Object.getPrototypeOf(el) !== C.prototype) Object.setPrototypeOf(el, C.prototype); };
  const upgrade = (tag) => {
    const C = real[tag]; if (!C) return;
    (inst[tag] || []).forEach((el) => {
      try {
        swap(el, C);
        if (el.__lc !== undefined) el.setConfig(el.__lc);
        if (el.__lh !== undefined) el.hass = el.__lh;
        if (el.isConnected && C.prototype.connectedCallback) C.prototype.connectedCallback.call(el);
      } catch (e) { console.error(`[appliance-cards] ${tag}`, e); }
    });
    delete inst[tag];
  };

  const chunks = {};
  const url = (n) => `${BASE}${PREFIX}.${n}.js?v=${VERSION}`;
  const load = (n) => chunks[n] || (chunks[n] = (n === "shared" ? Promise.resolve() : load("shared"))
    .then(() => import(url(n)))
    .then((m) => { m.default(sandboxCE); (M.chunks[n] || []).forEach(upgrade); })
    .catch((e) => { delete chunks[n]; console.error(`[appliance-cards] chargement de « ${n} » impossible`, e); throw e; }));

  // éditeur par formulaire (cartes de base) : Home Assistant lit getConfigForm() tout de suite, la souche ne peut pas le donner ; on fournit l'éditeur nous-mêmes
  native.define("appliance-lazy-form", class extends HTMLElement {
    setConfig(c) { this._c = c; this._draw(); }
    set hass(h) { this._h = h; if (this._form) this._form.hass = h; }
    _draw() {
      if (!this._form) {
        this._form = document.createElement("ha-form");
        this._form.addEventListener("value-changed", (e) => {
          this._c = e.detail.value;
          this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._c }, bubbles: true, composed: true }));
        });
        this.appendChild(this._form);
      }
      const f = this._f;
      Object.assign(this._form, { hass: this._h, data: this._c, schema: f.schema, computeLabel: f.computeLabel || ((s) => s.name), computeHelper: f.computeHelper });
    }
  });

  const makeStub = (tag, chunk) => {
    const ensure = () => load(chunk).then(() => real[tag]);
    return class extends HTMLElement {
      static async getConfigElement() {
        const C = await ensure();
        if (C && C.getConfigElement) return C.getConfigElement();
        const f = C && C.getConfigForm && C.getConfigForm();
        if (!f) return undefined;
        const el = document.createElement("appliance-lazy-form"); el._f = f; return el;
      }
      static async getStubConfig(...a) { const C = await ensure(); return C && C.getStubConfig ? C.getStubConfig(...a) : {}; }
      constructor() { super(); if (real[tag]) swap(this, real[tag]); }
      connectedCallback() {
        const C = real[tag];
        if (C && Object.getPrototypeOf(this) === C.prototype) { if (C.prototype.connectedCallback) C.prototype.connectedCallback.call(this); } else ensure().catch(noop);
      }
      disconnectedCallback() { const C = real[tag]; if (C && C.prototype.disconnectedCallback && Object.getPrototypeOf(this) === C.prototype) C.prototype.disconnectedCallback.call(this); }
      setConfig(c) { this.__lc = c; (inst[tag] = inst[tag] || new Set()).add(this); ensure().catch(noop); }
      set hass(h) { this.__lh = h; }
      get hass() { return this.__lh; }
      getCardSize() { return 4; }
      getGridOptions() { return { columns: 12, min_columns: 3, rows: "auto", min_rows: 1 }; }
    };
  };

  // liste du sélecteur de cartes de Home Assistant, avant tout téléchargement
  window.customCards = window.customCards || [];
  M.cards.forEach((c) => { if (!window.customCards.some((x) => x.type === c.type)) window.customCards.push(c); });
  // le code d'une carte déclare aussi sa fiche : on ignore les doublons
  const push = window.customCards.push;
  window.customCards.push = function (...a) { return push.apply(this, a.filter((x) => !this.some((y) => y.type === x.type))); };

  Object.entries(M.chunks).forEach(([chunk, tags]) => tags.forEach((tag) => { if (!native.get(tag)) native.define(tag, makeStub(tag, chunk)); }));
  console.info("%c HA-APPLIANCE-CARDS %c v" + VERSION + " (chargement à la demande) ", "color:#fff;background:#03a9f4;font-weight:700;border-radius:3px 0 0 3px", "color:#03a9f4;background:#fff;font-weight:700;border-radius:0 3px 3px 0");
})();
