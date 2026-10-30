// Çeviri. Kaynak dil Türkçe: koddaki metin aynen anahtardır → t('Yeni oyun'), t('Gün {n}', { n }).
// Dil dosyaları src/locales/<dil>.json: { "Türkçe metin": "karşılığı" }. Çoğul gereken yerde değer
// { "one": "…", "other": "…" } olabilir (sayı p.n). Eksik metin İngilizceye, o da yoksa Türkçeye düşer.
// Dil, modül yüklenirken belirlenir (config.js gibi modüllerdeki sabit metinler de çevrilsin); değiştirince sayfa yenilenir.
// Eksik/kullanılmayan anahtarlar: node tools/i18n-check.mjs
import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ko from './locales/ko.json';
import ja from './locales/ja.json';

const DICTS = { en, de, es, fr, it, ko, ja };
const TAGS = { tr: 'tr-TR', en: 'en-US', de: 'de-DE', es: 'es-ES', fr: 'fr-FR', it: 'it-IT', ko: 'ko-KR', ja: 'ja-JP' };

/** Ayarlardaki dil listesi (her dil kendi adıyla). */
export const LANGS = [
  ['tr', 'Türkçe'], ['en', 'English'], ['de', 'Deutsch'], ['es', 'Español'], ['fr', 'Français'],
  ['it', 'Italiano'], ['ko', '한국어'], ['ja', '日本語'],
];

function detect() {
  let pref = 'auto';
  try { pref = JSON.parse(localStorage.getItem('marketgame-options') || '{}').lang || 'auto'; } catch { /* gizli mod */ }
  if (pref !== 'auto' && TAGS[pref]) return pref;
  for (const l of navigator.languages || [navigator.language || 'tr']) {
    const code = String(l).slice(0, 2).toLowerCase();
    if (TAGS[code]) return code;
  }
  return 'en';
}

export const lang = detect();
const dict = DICTS[lang] || null;
const plural = new Intl.PluralRules(TAGS[lang]);
document.documentElement.lang = lang;

/** Türkçe kaynak metnin seçili dildeki karşılığı; {ad} yer tutucuları p'den doldurulur. */
export function t(src, p) {
  let s = lang === 'tr' ? src : (dict?.[src] ?? en[src] ?? src);
  if (typeof s === 'object') s = s[plural.select(p?.n ?? 0)] ?? s.other;
  return p ? s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m)) : s;
}

/** Sayı biçimi (binlik ayırıcı dile göre). */
export const num = (n, opts) => Number(n).toLocaleString(TAGS[lang], opts);

/** Büyük harf (Türkçede i → İ, diğer dillerde I). */
export const upper = (s) => String(s).toLocaleUpperCase(TAGS[lang]);

/** Tarih/saat biçimi. */
export const dateTime = (d) => new Date(d).toLocaleString(TAGS[lang]);

/**
 * index.html'deki sabit metinleri çevirir: metin düğümleri (boşluklar korunur), title/aria-label/placeholder,
 * ve data-tx işaretli öğelerin innerHTML'i (içinde <b> gibi biçim olan paragraflar tek parça çevrilir).
 */
export function translateDom(root = document.body) {
  if (lang === 'tr') return;
  const norm = (s) => s.trim().replace(/\s+/g, ' ');
  for (const el of root.querySelectorAll('[data-tx]')) el.innerHTML = t(norm(el.innerHTML));
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.parentElement.closest('[data-tx], script, style')) continue;
    const key = norm(n.nodeValue);
    if (!key) continue;
    const tr = t(key);
    if (tr !== key) n.nodeValue = n.nodeValue.replace(/\S[\s\S]*\S|\S/, tr);
  }
  for (const a of ['title', 'aria-label', 'placeholder']) {
    for (const el of root.querySelectorAll(`[${a}]`)) el.setAttribute(a, t(el.getAttribute(a)));
  }
  document.title = t(document.title);
}
