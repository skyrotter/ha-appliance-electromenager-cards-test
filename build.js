#!/usr/bin/env node
/*
 * Builds dist/ha-appliance-electromenager-cards.js from src/ (HACS installs a
 * single file). No dependencies: files are concatenated in the order below,
 * like <script> tags in a page.
 *
 *   node build.js           write dist/
 *   node build.js --check   fail if dist/ is not up to date (used by CI)
 *
 * Markers replaced while building:
 *   /*@css*\/``               the CSS files of CSS_FILES, as a template literal
 *   /*@i18n <section>*\/{}    that section of every src/i18n/<lang>.json,
 *                             giving { en: {...}, fr: {...}, ... }
 *
 * English (en.json) is the reference: missing keys in other languages fall
 * back to English at runtime and are reported as warnings.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const NAME = "ha-appliance-electromenager-cards.js";
const DIST = path.join(ROOT, "dist", NAME);

/* The 26 core cards share one scope (one IIFE): order matters. */
const CORE_FILES = [
  "core/version.js",       // VERSION : à mettre à jour avant chaque release (vérifié par le workflow Release)
  "core/i18n.js",          // STRINGS, lang(), tr()
  "core/illustrations.js", // DEFS and drawing helpers, empty SVG object
  "core/svg/*.js",         // SVG.<kind> = illustration, one file per kind
  "core/definitions.js",   // DEF: what each kind shows and needs
  "core/helpers.js",       // state parsing and formatting
  "core/base.js",          // ApplianceCardBase
  "core/editor.js",        // visual editor schema, stub config
  "core/style.js",         // STYLE, built from CSS_FILES
  "core/register.js",      // defines the custom elements
];
/* Concatenated into STYLE: order matters (cascade). */
const CSS_FILES = [
  "card", "illustration-shared", "washer-dryer", "dishwasher", "water-heater", "oven-microwave",
  "radiator", "cooktop", "vmc", "solar", "freezers", "printer-3d", "pool-pump", "pellet-stove",
  "fridge", "air-fryer", "coffee-maker", "tv", "range-hood", "ac-split", "heat-pump",
  "towel-dryer", "server-rack", "desktop-pc", "laptop", "wine-cooler", "beer-tap", "av-receiver", "smart-speaker", "fan", "generic", "tool-charger", "ceiling-fan", "dehumidifier", "air-purifier", "monitor", "kettle-toaster", "plugs-piano-garland", "wet-vacuum", "dosing-pump", "fitness", "ps5", "thermomix", "cookeo", "printer",
].map((n) => `core/style/${n}.css`);
/* Self-contained cards, each in its own IIFE. */
const CARD_FILES = [
  "card-helpers", "editor-labels", "aquarium", "reef-aquarium", "linky", "battery", "ev-charger", "robot-vacuum", "robot-mower", "pellet-boiler", "gas-boiler", "water-heat-pump", "air-water-heat-pump", "diesel-heater", "jacuzzi", "internet-box", "pet-feeder", "portable-ac", "access", "sauna", "pumps", "pool-robot", "ups", "underfloor-heating", "lights", "shutters", "water-meter", "gas-meter", "electric-meter", "trv", "room-climate", "mailbox", "smoke-detector", "smart-lock", "cat-flap", "pet-fountain", "leak-detector", "mini-pc", "nas", "tv-box", "scale", "thermo-heater", "water-valves", "water-softener", "camera", "poe-switch", "raspberry-pi", "water-filter", "irrigation", "led-strip", "rain-gauge", "plant-monitor", "humidifier", "fan-heater", "inflatable-spa", "heat-meter", "picker", "zigbee-coordinator",
].map((n) => `cards/${n}.js`);

const read = (p) => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
// one trailing newline per file, so files are joined by exactly one blank line
const load = (rel) => read(path.join(SRC, rel)).replace(/\s+$/, "") + "\n";
const expand = (rel) => {
  if (!rel.includes("*")) return [rel];
  const dir = path.dirname(rel), ext = path.extname(rel);
  return fs.readdirSync(path.join(SRC, dir)).filter((f) => f.endsWith(ext)).sort().map((f) => `${dir}/${f}`);
};

let warnings = 0;
const warn = (msg) => { warnings++; console.warn(`warning: ${msg}`); };

// Every source file must be listed, so nothing is silently left out
const listed = new Set(["header.js", "lazy/loader.js", ...CORE_FILES.flatMap(expand), ...CSS_FILES, ...CARD_FILES]);
const walk = (dir) => fs.readdirSync(path.join(SRC, dir), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(`${dir}${e.name}/`) : [`${dir}${e.name}`]);
for (const f of walk("").filter((f) => /\.(js|css)$/.test(f) && !listed.has(f))) warn(`src/${f} is not listed in build.js`);

/* ---- i18n ---- */
const I18N_DIR = path.join(SRC, "i18n");
const langs = fs.readdirSync(I18N_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .sort((a, b) => (a === "en" ? -1 : b === "en" ? 1 : a.localeCompare(b)));
if (!langs.includes("en")) throw new Error("src/i18n/en.json is required (reference language)");
const i18n = Object.fromEntries(langs.map((l) => [l, JSON.parse(read(path.join(I18N_DIR, `${l}.json`)))]));
for (const l of langs.filter((l) => l !== "en")) {
  for (const [ns, ref] of Object.entries(i18n.en)) {
    const strings = i18n[l][ns] || {};
    const missing = Object.keys(ref).filter((k) => !(k in strings));
    const extra = Object.keys(strings).filter((k) => !(k in ref));
    if (missing.length) warn(`${l}.json ${ns}: missing ${missing.join(", ")}`);
    if (extra.length) warn(`${l}.json ${ns}: not in en.json ${extra.join(", ")}`);
  }
  for (const ns of Object.keys(i18n[l]).filter((ns) => !(ns in i18n.en))) warn(`${l}.json: namespace "${ns}" not in en.json`);
}

/* ---- assemble ---- */
const css = CSS_FILES.map(load).join("\n").replace(/[\\`]|\$\{/g, (c) => `\\${c}`);
let out = load("header.js")
  + '(() => {\n"use strict";\n' + CORE_FILES.flatMap(expand).map(load).join("\n") + "})();\n"
  + CARD_FILES.map((f) => "\n" + load(f)).join("");

const cssMarkers = out.split("/*@css*/``").length - 1;
if (cssMarkers !== 1) throw new Error(`expected one /*@css*/\`\` marker, found ${cssMarkers}`);
out = out.replace("/*@css*/``", () => "`\n" + css + "`");

const used = new Set();
const inlineI18n = (text) => text.replace(/^([ \t]*)(.*?)\/\*@i18n (\w+)\*\/\{\}/gm, (_, indent, before, ns) => {
  if (!i18n.en[ns]) throw new Error(`namespace "${ns}" missing from src/i18n/en.json`);
  used.add(ns);
  const table = Object.fromEntries(langs.filter((l) => i18n[l][ns]).map((l) => [l, i18n[l][ns]]));
  return indent + before + JSON.stringify(table, null, 2).replace(/\n/g, `\n${indent}`);
});
out = inlineI18n(out);
for (const ns of Object.keys(i18n.en).filter((ns) => !used.has(ns))) warn(`en.json: namespace "${ns}" is not used by the source`);

/* ---- lazy build (--lazy [--out dir]) : un petit chargeur + un fichier par carte ----
 * Le chargeur déclare chaque carte sous forme de « souche » (liste produite en exécutant les morceaux dans un bac à sable)
 * et ne télécharge le code d'une carte que lorsqu'elle s'affiche. Les morceaux sont à plat, à côté du chargeur. */
const buildLazy = (check = false, dir = null) => {
  const vm = require("vm");
  const oi = process.argv.indexOf("--out");
  const outDir = dir || path.resolve(ROOT, oi > 0 ? process.argv[oi + 1] : "dist-lazy");
  const version = /const VERSION = "([^"]+)"/.exec(load("core/version.js"))[1];
  const sub = (code) => inlineI18n(code);
  // morceaux : shared (aides communes des cartes), core (cartes de base), puis une carte par fichier
  const parts = [["shared", ["card-helpers", "editor-labels"].map((n) => load(`cards/${n}.js`)).join("\n")],
    ["core", '"use strict";\n' + CORE_FILES.flatMap(expand).map(load).join("\n").replace("/*@css*/``", () => "`\n" + css + "`") + `console.info("%c HA-APPLIANCE-CARDS %c v${version} ", "color:#fff;background:#03a9f4;font-weight:700;border-radius:3px 0 0 3px", "color:#03a9f4;background:#fff;font-weight:700;border-radius:0 3px 3px 0");\n`],
    ...CARD_FILES.filter((f) => !/card-helpers|editor-labels/.test(f)).map((f) => [path.basename(f, ".js"), load(f)])]
    .map(([n, code]) => [n, sub(code)]);
  // le code core fait console.info en fin de register.js : le chargeur s'en charge, on retire le doublon
  const parts2 = parts.map(([n, code]) => [n, n === "core" ? code.replace(/console\.info\(`%c HA-APPLIANCE-CARDS[\s\S]*?\);\n/, "").replace(/console\.info\("%c HA-APPLIANCE-CARDS[\s\S]*?\);\n$/, "") : code]);

  // exécution dans un bac à sable : relève les éléments déclarés et les fiches du sélecteur par morceau
  const deep = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => "" : deep()), apply: () => deep(), construct: () => deep(), set: () => true, has: () => true });
  const ctx = { console: { info() {}, log() {}, warn() {}, error() {} }, HTMLElement: class {}, customCards: undefined, Intl, JSON, Math, Date, Object, Array, String, Number, Promise, Set, Map, WeakMap, Symbol, RegExp, Error, URL,
    setTimeout() {}, setInterval() {}, clearTimeout() {}, clearInterval() {}, requestAnimationFrame() {}, cancelAnimationFrame() {} };
  for (const k of ["document", "navigator", "localStorage", "sessionStorage", "location", "matchMedia", "getComputedStyle", "CustomEvent", "Event", "ResizeObserver", "IntersectionObserver", "MutationObserver", "fetch", "performance", "CSS", "DOMParser", "Image"]) ctx[k] = deep();
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ctx.customCards = [];
  const manifest = { chunks: {}, cards: [], tags: [] };
  for (const [n, code] of parts2) {
    const defined = [];
    const ce = { define: (name) => defined.push(name), get: () => undefined, whenDefined: () => Promise.resolve() };
    const before = ctx.customCards.length;
    try { vm.runInContext(`((customElements) => {\n${code}\n})`, ctx, { filename: `${n}.js` })(ce); }
    catch (e) { throw new Error(`lazy build: « ${n} » ne s'exécute pas dans le bac à sable : ${e.message}`); }
    const tags = defined.filter((t) => !t.endsWith("-editor"));
    if (tags.length) manifest.chunks[n] = tags;
    manifest.tags.push(...tags);
    manifest.cards.push(...ctx.customCards.slice(before).map((c) => JSON.parse(JSON.stringify(c))));
  }
  const isOurs = (f) => f.startsWith("ha-appliance-electromenager-cards") && f.endsWith(".js");
  const files = {};
  for (const [n, code] of parts2) files[n === "shared" || manifest.chunks[n] ? `ha-appliance-electromenager-cards.${n}.js` : null] = `export default (customElements) => {\n${code}\n};\n`;
  delete files.null;
  files["ha-appliance-electromenager-cards.js"] = load("header.js") + load("lazy/loader.js")
    .replace('"/*@version*/"', JSON.stringify(version)).replace("/*@manifest*/{}", () => JSON.stringify(manifest));
  if (check) {
    const have = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter(isOurs) : [];
    const bad = Object.keys(files).filter((f) => !have.includes(f) || read(path.join(outDir, f)) !== files[f]).concat(have.filter((f) => !(f in files)));
    if (bad.length) { console.error(`${path.relative(ROOT, outDir)}/ is out of date (${bad.slice(0, 5).join(", ")}…): run \`node build.js --lazy --out ${path.relative(ROOT, outDir)}\` and commit the result.`); process.exit(1); }
    console.log(`${path.relative(ROOT, outDir)}/ (lazy build) is up to date.`); return;
  }
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(outDir).filter(isOurs)) fs.unlinkSync(path.join(outDir, f));
  for (const [f, c] of Object.entries(files)) fs.writeFileSync(path.join(outDir, f), c);
  const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} Ko`;
  console.log(`built lazy ${path.relative(ROOT, outDir)}/: loader ${kb(files["ha-appliance-electromenager-cards.js"])}, ${Object.keys(files).length - 1} chunks, ${manifest.tags.length} cards`);
};
// dist/ déjà au format « à la demande » (chargeur + morceaux) : --check le compare à un build lazy
const lazyDist = fs.existsSync(DIST) && read(DIST).includes("__applianceLazy");
if (process.argv.includes("--lazy") || (process.argv.includes("--check") && lazyDist)) { buildLazy(process.argv.includes("--check"), lazyDist ? path.dirname(DIST) : null); process.exit(0); }

if (process.argv.includes("--check")) {
  const current = fs.existsSync(DIST) ? read(DIST) : "";
  if (current !== out) {
    console.error(`dist/${NAME} is out of date: run \`node build.js\` and commit the result.`);
    process.exit(1);
  }
  console.log(`dist/${NAME} is up to date (${langs.join(", ")}).`);
} else {
  fs.writeFileSync(DIST, out);
  console.log(`built dist/${NAME} (${langs.join(", ")}${warnings ? `, ${warnings} warning(s)` : ""}).`);
}
