## Development and translations

`dist/ha-appliance-electromenager-cards.js` is generated: edit `src/` instead, then rebuild (Node.js, no dependencies):

```sh
node build.js           # writes dist/
node build.js --check   # fails if dist/ is out of date (run by CI)
```

HACS installs a single file, so `build.js` concatenates the files of `src/` in the order it lists (like `<script>` tags in a page):

```
src/
  header.js            licence banner
  core/                the 28 core cards, sharing one scope (order matters)
    version.js  i18n.js  illustrations.js  definitions.js  helpers.js
    base.js  editor.js  style.js  register.js
    svg/<kind>.js      one illustration per kind: SVG.washer = () => `…`
    style/*.css        card styles, concatenated into STYLE (order listed in build.js)
  cards/*.js           self-contained cards (aquarium, linky, battery, …), one IIFE each
  i18n/<lang>.json     texts, one file per language
```

- New core card: add its `DEF` entry (`core/definitions.js`), `core/svg/<kind>.js` (picked up automatically), a CSS file listed in `CSS_FILES` and its strings. New self-contained card: add `cards/<name>.js` and list it in `CARD_FILES`. The build warns about any `src/` file it does not list.
- Texts: one file per language in `src/i18n/` (`en.json`, `fr.json`, `de.json`, `nb.json`, `nl.json`, `ro.json`). Each file has a `common` section for the 28 core cards and one section per extra card (`aquarium`, `linky`, …). The build inlines them where the source says `/*@i18n <section>*/{}`. The `editor` section holds the visual editor labels of every extra card, keyed by option name (`entity_floor_temp`, `show_power`…): add a key there in every language when you add an option.
- English is the reference: a key missing in another language falls back to English, and the build prints a warning.
- To add a language, copy `en.json` to e.g. `it.json`, translate it and rebuild: the cards follow the Home Assistant language, and the extra cards list it in their `language` option.
- Standalone editors use `window.applianceLanguageField(T)` (where `T` is the card's translation table) for the complete language selector. Native language names are maintained once in `src/cards/card-helpers.js`; new codes without a name entry are still listed using their code. The helper lists only languages available for that card.
- Commit `src/` and the rebuilt `dist/` together. On a merge conflict in `dist/`, resolve `src/` and re-run `node build.js`.

---

### Portuguese translations

`pt-PT.json` and `pt-BR.json` are complete, independent translations of the English reference. Preserve keys, units, placeholders such as `{n}` and `{t}`, and configuration identifiers in backticks. Use concise labels that fit the card tiles.

| Concept | Portugal | Brazil |
|---|---|---|
| Refrigerator | Frigorífico | Geladeira |
| Washing machine | Máquina de lavar roupa | Lavadora de roupas |
| Screen | Ecrã | Tela |
| Control | Controlo | Controle |
| Humidity | Humidade | Umidade |
| Flow rate | Caudal | Vazão |
| Leak | Fuga | Vazamento |

Language resolution is shared by core cards, standalone cards, editors and the picker through `window.applianceResolveLanguage`. It preserves regional variants, accepts case and underscore variations, maps generic `pt` to `pt-PT`, retains Norwegian aliases and Serbian Latin, and falls back to English for unsupported languages.

After editing either Portuguese file, run `node tests/portuguese.cjs`, rebuild, and run `node build.js --check`. Open `docs/tests.html` through a local HTTP server for the browser regression suite. The demo discovers both Portuguese variants automatically from the built card schemas; select each language to inspect card names, states, alerts and longer labels at narrow widths.

## Lazy loading build (test)

`dist/ha-appliance-electromenager-cards.js` holds all the cards (about 5.6 MB). The lazy build replaces it with a small loader (about 100 KB) plus one file per card, next to it in `dist/`. A card's file is only downloaded when the card is displayed in a dashboard or in the editor.

```sh
node build.js --lazy --out dist   # loader + chunks in dist/ (replaces the single file)
node build.js --lazy              # same, in dist-lazy/ (not committed), to try it locally
node build.js --check             # detects a lazy dist/ and checks it
```

- `ha-appliance-electromenager-cards.js` is the loader, so the Lovelace resource and HACS keep working unchanged. `.shared.js` (common helpers), `.core.js` (the base cards) and `.<card>.js` are fetched from the same folder, with `?v=<version>` to bypass the browser cache after an update.
- The loader declares every card as a stub element, so Home Assistant sees them all immediately (card picker, editor). When a card is needed, the stub loads its chunk and takes over the real class.
- Test it on a pre-release first (tag `vX.Y.Z-beta1` from a branch with the lazy `dist/`): the release workflow attaches every `dist/*.js` file, then add the repository to HACS as a custom repository with « Show beta versions ». Check that HACS downloads all the files of `dist/`.
