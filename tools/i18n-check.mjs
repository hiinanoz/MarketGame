// Çeviri denetimi: koddaki t('…') çağrıları + index.html sabit metinleri ↔ src/locales/*.json
//   node tools/i18n-check.mjs            → her dil için eksik / kullanılmayan sayısı
//   node tools/i18n-check.mjs en         → İngilizcede eksik anahtarlar (JSON, çeviriye hazır)
//   node tools/i18n-check.mjs --keys     → tüm anahtarlar
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const keys = new Set();
const hasLetter = (s) => /\p{L}{2,}/u.test(s);
const add = (s) => { s = s.trim().replace(/\s+/g, ' '); if (hasLetter(s)) keys.add(s); };

// 1) JS: t('…'), t("…"), t(`…`) — ilk argüman düz metin olmalı (içinde ${} yok; değişkenler {ad} ile)
const unq = (q, s) => (q === '`' ? s : s.replace(new RegExp(`\\\\${q}`, 'g'), q).replace(/\\n/g, '\n'));
for (const f of readdirSync(join(root, 'src')).filter((f) => f.endsWith('.js') && f !== 'i18n.js')) {
  const src = readFileSync(join(root, 'src', f), 'utf8');
  for (const m of src.matchAll(/\bt\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    if (m[1] === '`' && m[2].includes('${')) { console.warn(`! ${f}: t(\`…\${}…\`) — {ad} kullan: ${m[2].slice(0, 60)}`); continue; }
    keys.add(unq(m[1], m[2]));
  }
}

// 2) index.html: data-tx öğelerinin içi tek parça, kalan metin düğümleri ve title/aria-label/placeholder
let html = readFileSync(join(root, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '');
html = html.replace(/<(\w+)([^>]*\sdata-tx[^>]*)>([\s\S]*?)<\/\1>/g, (all, tag, attrs, inner) => { keys.add(inner.trim()); return `<${tag}${attrs}></${tag}>`; });
for (const m of html.matchAll(/\s(?:title|aria-label|placeholder)="([^"]*)"/g)) add(m[1]);
for (const m of html.matchAll(/<title>([^<]*)<\/title>/g)) add(m[1]);
for (const m of html.replace(/<title>[^<]*<\/title>/, '').matchAll(/>([^<>]+)</g)) add(m[1]);

const all = [...keys].sort();
const arg = process.argv[2];
if (arg === '--keys') { console.log(JSON.stringify(all, null, 1)); process.exit(0); }

const dir = join(root, 'src/locales');
for (const f of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const code = f.replace('.json', '');
  const dict = JSON.parse(readFileSync(join(dir, f), 'utf8'));
  const missing = all.filter((k) => !(k in dict));
  const unused = Object.keys(dict).filter((k) => !keys.has(k));
  if (arg === code) {
    console.log(JSON.stringify(Object.fromEntries(missing.map((k) => [k, ''])), null, 2));
    if (unused.length) console.error(`kullanılmayan: ${unused.length}\n` + unused.map((k) => '  ' + k).join('\n'));
  } else if (!arg) {
    console.log(`${code}: ${all.length - missing.length}/${all.length} çevrildi, eksik ${missing.length}, kullanılmayan ${unused.length}`);
  }
}
