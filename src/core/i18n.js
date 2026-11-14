/* ------------------------------------------------------------------ */
/* i18n — strings live in src/i18n/<lang>.json, inlined by build.js    */
/* ------------------------------------------------------------------ */
const STRINGS = /*@i18n common*/{};
const lang = (hass) => window.applianceResolveLanguage(STRINGS,
  (hass && (hass.locale?.language || hass.language)) || document.documentElement.lang || 'en');
const tr = (hass, key) => STRINGS[lang(hass)][key] ?? STRINGS.en[key] ?? key;
